// cardforge 自测：node test.mjs，全绿即通过
import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, 'cardforge.js');
const dir = await mkdtemp(join(tmpdir(), 'cardforge-test-'));
let passed = 0, failed = 0;

function check(name, fn) {
  try { fn(); passed++; console.log(`  PASS ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n    ${e.message}`); }
}
async function runCli(...args) {
  return execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

// ---------- 测试卡：构造一个真实酒馆 v3 卡 ----------
const testCard = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: '星轨观测者',
    description: '一名在废弃天文台独自记录星图的老观测员。',
    personality: '沉默寡言，对星空有近乎偏执的热爱。',
    scenario: '暴雨将至的午夜天文台。',
    first_mes: '「你来得不巧，今晚云层很厚。」老人头也没抬。',
    mes_example: '',
    creator_notes: 'cardforge 测试用卡',
    system_prompt: '',
    character_version: '2.1',
    tags: ['测试', '观星'],
    character_book: {
      name: '天文台设定',
      entries: [
        { id: 0, keys: ['星图'], content: '星图是观测员四十年积累的手绘记录。', constant: false, insertion_order: 100 },
        { id: 1, keys: ['暴雨'], content: '暴雨将损坏屋顶的观测窗。', constant: true, insertion_order: 50 },
        { id: 2, keys: [], content: '' }
      ]
    }
  }
};
const cardPath = join(dir, 'test-card.json');
await writeFile(cardPath, JSON.stringify(testCard, null, 2), 'utf8');

// ---------- 模式1: inspect ----------
console.log('[inspect]');
{
  const out = JSON.parse(await runCli('inspect', cardPath));
  check('识别为 stv3', () => assert.equal(out.cardType, 'stv3'));
  check('spec_version=3.0', () => assert.equal(out.structure.specVersion, '3.0'));
  check('核心字段全在', () => assert.deepEqual(out.completeness.missing, []));
  check('世界书统计 3 条', () => assert.equal(out.structure.character_book.entries, 3));
  check('发现空content条目异常', () => assert(out.issues.some(i => i.includes('无content'))));
  check('无BOM', () => assert.equal(out.encoding.hasBOM, false));
}
{
  // 坏卡：spec缺失 + BOM
  const badPath = join(dir, 'bad.json');
  await writeFile(badPath, '\ufeff{"data":{"name":"残卡"}}', 'utf8');
  const out = JSON.parse(await runCli('inspect', badPath));
  check('坏卡: spec异常被报告', () => assert(out.issues.some(i => i.includes('spec'))));
  check('坏卡: BOM被报告', () => assert(out.issues.some(i => i.includes('BOM'))));
}
{
  // 纯世界书
  const wbPath = join(dir, 'wb.json');
  await writeFile(wbPath, JSON.stringify({ entries: [{ keys: ['a'], content: 'x' }] }), 'utf8');
  const out = JSON.parse(await runCli('inspect', wbPath));
  check('识别纯世界书', () => assert.equal(out.cardType, 'worldbook'));
}

// ---------- 模式2: forge ----------
console.log('[forge]');
{
  const outPath = join(dir, 'forged.json');
  await runCli('forge', '--format', 'v3', '--out', outPath,
    '--name', '铁匠铺学徒', '--desc', '打铁的', '--personality', '憨',
    '--scenario', '村口铁匠铺', '--first-meeting', '「客官打点什么？」');
  const forged = JSON.parse(await readFile(outPath, 'utf8'));
  check('spec正确', () => assert.equal(forged.spec, 'chara_card_v3'));
  check('spec_version=3.0', () => assert.equal(forged.spec_version, '3.0'));
  check('name字段正确', () => assert.equal(forged.data.name, '铁匠铺学徒'));
  check('first_mes映射正确', () => assert.equal(forged.data.first_mes, '「客官打点什么？」'));
  check('世界书为空数组', () => assert.deepEqual(forged.data.character_book.entries, []));

  // 验收要求：forge 生成的 json 能被 inspect 正确读回
  const back = JSON.parse(await runCli('inspect', outPath));
  check('forge产物可被inspect读回且为stv3', () => assert.equal(back.cardType, 'stv3'));
  check('forge产物无缺字段', () => assert.deepEqual(back.completeness.missing, []));

  // 带世界书写卡
  const bookPath = join(dir, 'book.json');
  await writeFile(bookPath, JSON.stringify({ entries: [{ keys: ['铁'], content: '铁料行情。' }] }), 'utf8');
  const outPath2 = join(dir, 'forged2.json');
  await runCli('forge', '--out', outPath2, '--name', '带书卡', '--book', bookPath);
  const back2 = JSON.parse(await runCli('inspect', outPath2));
  check('带世界书forge后inspect统计正确', () => assert.equal(back2.structure.character_book.entries, 1));
}

// ---------- 模式3: convert ----------
console.log('[convert]');
{
  // md -> v3（内联构造测试样例卡，无外部依赖）
  const mdText = `# 结构卡：星桥医师 v1

> **版本头：v1 · 2026-01-01。**

> **人设壳：** 温和细致的旅路医者。

## 一、卡名与定位

- **卡名**：星桥医师
- **卡ID**：starbridge
- **版本**：v1
- **定位**：测试用医者卡。
- **核心理念**：先诊断，后施治。

## 二、卡体

### ① 身份段

你是星桥医师，一名行走于旅途的医者。

### ⑤ 跑偏自愈条

- 停笔重锚定。

### ⑥ RoE红线段

1. 只在授权范围内行动。
`;
  const mdFile = join(dir, 'sample.md');
  await writeFile(mdFile, mdText, 'utf8');
  const jsonOut = join(dir, 'sample.json');
  await runCli('convert', mdFile, '--out', jsonOut);
  const conv = JSON.parse(await readFile(jsonOut, 'utf8'));
  check('md转换spec正确', () => assert.equal(conv.spec, 'chara_card_v3'));
  check('md转换提取了name', () => assert.equal(conv.data.name, '星桥医师'));
  check('md转换description含身份段', () => assert(conv.data.description.includes('星桥医师') || conv.data.description.length > 10));
  check('md转换生成世界书自愈条', () => assert(conv.data.character_book.entries.some(e => e.comment === '跑偏自愈条')));
  check('md转换生成RoE条目', () => assert(conv.data.character_book.entries.some(e => e.comment === 'RoE红线段')));

  // 转出的json再inspect应识别为stv3
  const back = JSON.parse(await runCli('inspect', jsonOut));
  check('convert产物可被inspect读回', () => assert.equal(back.cardType, 'stv3'));

  // stv3 -> md 概要
  const mdOut = join(dir, 'summary.md');
  await runCli('convert', cardPath, '--out', mdOut);
  const mdSummary = await readFile(mdOut, 'utf8');
  check('json转md含标题', () => assert(mdSummary.includes('# 角色卡概要：星轨观测者')));
  check('json转md含世界书条目数', () => assert(mdSummary.includes('## 世界书（3 条）')));
  check('json转md含开场白', () => assert(mdSummary.includes('你来得不巧')));

  // 往返：forge -> convert -> 概要含名字
  await runCli('convert', join(dir, 'forged.json'), '--out', join(dir, 'forged.md'));
  const fm = await readFile(join(dir, 'forged.md'), 'utf8');
  check('forge卡转md概要含名字', () => assert(fm.includes('铁匠铺学徒')));
}

// ---------- parseMd 单元 ----------
console.log('[parseMd]');
{
  const { parseSummonCard } = await import('file:///' + join(__dirname, 'lib', 'parseMd.js').replace(/\\/g, '/'));
  const s = parseSummonCard('# 卡\n\n> **版本头：v2 · 2026-10-10。**\n\n## ⑤ 跑偏自愈条\n\n内容\n\n### ⑥ RoE红线段\n\n红线\n');
  check('标题提取', () => assert.equal(s.title, '卡'));
  check('版本头提取', () => assert(s.versionHeader.includes('v2')));
  check('自愈条段落识别', () => assert.equal(s.selfHeal.heading, '⑤ 跑偏自愈条'));
  check('RoE段落识别', () => assert.equal(s.roe.heading, '⑥ RoE红线段'));
}

await rm(dir, { recursive: true, force: true });
console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
