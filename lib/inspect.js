// 解卡：识别卡类型、结构清单、字段完整性、规模统计、异常项
import { readFile } from 'node:fs/promises';
import { parseSummonCard } from './parseMd.js';

const V3_CORE = ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example'];

function checkBOM(buf) {
  return buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
}

export async function inspectFile(path) {
  const buf = await readFile(path);
  const text = buf.toString('utf8');
  const report = {
    file: path,
    encoding: { hasBOM: checkBOM(buf), bytes: buf.length },
    cardType: 'unknown',
    structure: {},
    completeness: { missing: [], present: [] },
    stats: {},
    issues: []
  };

  const lower = path.toLowerCase();
  if (lower.endsWith('.json')) return inspectJson(text, report);
  if (lower.endsWith('.md')) return inspectMd(text, report);
  // .txt 及其他：按文本卡处理
  report.cardType = 'text-card';
  report.stats = { chars: text.length, lines: text.split(/\r?\n/).length };
  if (!text.trim()) report.issues.push('文件为空');
  return report;
}

function inspectJson(text, report) {
  // 剥BOM后再解析；BOM本身单独报告
  const clean = text.replace(/^\ufeff/, '');
  let obj;
  try { obj = JSON.parse(clean); }
  catch (e) { report.cardType = 'invalid-json'; report.issues.push('JSON解析失败: ' + e.message); return report; }

  report.stats = { chars: text.length, jsonKeys: Object.keys(obj).length };

  // 纯世界书
  if (!obj.spec && !obj.data && obj.entries) {
    report.cardType = 'worldbook';
    const entries = Array.isArray(obj.entries) ? obj.entries : Object.values(obj.entries);
    report.structure = { entries: entries.length };
    report.stats.bookEntries = entries.length;
    return report;
  }

  const spec = obj.spec || (obj.data ? 'chara_card_v2(推断)' : null);
  if (obj.spec === 'chara_card_v3') report.cardType = 'stv3';
  else if (obj.spec === 'chara_card_v2') report.cardType = 'stv2';
  else if (obj.data) { report.cardType = 'unknown-spec'; report.issues.push('spec异常: 缺失或非标准值: ' + JSON.stringify(obj.spec ?? null)); }
  else { report.cardType = 'flat-card'; report.issues.push('无spec/data包装，可能是裸字段卡'); }

  const data = obj.data || obj;
  report.structure.spec = obj.spec ?? null;
  report.structure.specVersion = obj.spec_version ?? data.spec_version ?? null;
  report.structure.dataFields = Object.keys(data).sort();

  // 字段完整性（v3核心字段）
  for (const f of V3_CORE) {
    if (data[f] === undefined) report.completeness.missing.push(f);
    else if (typeof data[f] === 'string' && !data[f].trim()) report.issues.push(`字段 ${f} 存在但为空字符串`);
    else report.completeness.present.push(f);
  }

  // character_book 统计
  const book = data.character_book;
  if (book) {
    const entries = Array.isArray(book.entries) ? book.entries : [];
    report.structure.character_book = {
      entries: entries.length,
      withKeys: entries.filter(e => Array.isArray(e.keys) && e.keys.length).length,
      emptyContent: entries.filter(e => !e.content || !String(e.content).trim()).length
    };
    report.stats.bookEntries = entries.length;
    if (!Array.isArray(book.entries)) report.issues.push('character_book.entries 不是数组');
    entries.forEach((e, i) => { if (!e.content) report.issues.push(`世界书条目#${i} 无content`); });
  } else {
    report.structure.character_book = null;
  }

  // 其他异常
  if (obj.spec === 'chara_card_v3' && report.structure.specVersion !== '3.0')
    report.issues.push(`v3卡的spec_version应为"3.0"，实际: ${JSON.stringify(report.structure.specVersion)}`);
  if (typeof data.name !== 'string' || !data.name) report.issues.push('缺少有效的 name');
  if (report.encoding.hasBOM) report.issues.push('JSON带UTF-8 BOM，部分酒馆版本可能解析失败');
  return report;
}

function inspectMd(text, report) {
  report.cardType = 'md-card';
  report.stats = { chars: text.length, lines: text.split(/\r?\n/).length };
  const parsed = parseSummonCard(text);
  report.structure = parsed;
  // 异常项
  if (!parsed.title) report.issues.push('未找到一级标题');
  if (!parsed.versionHeader) report.issues.push('未找到版本头（前15行内无"版本头/vN"标记）');
  for (const key of ['persona', 'identity', 'authLock', 'roe', 'selfHeal']) {
    if (!parsed[key]) report.issues.push(`未识别到段落: ${{ persona: '人设段', identity: '身份段', authLock: '授权锁', roe: '行为边界(RoE红线)', selfHeal: '自愈条' }[key]}`);
  }
  if (report.encoding.hasBOM) report.issues.push('文件带UTF-8 BOM');
  return report;
}
