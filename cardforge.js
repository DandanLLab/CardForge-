#!/usr/bin/env node
// cardforge.js — CardForge CLI
// 用法:
//   node cardforge.js inspect <文件>
//   node cardforge.js forge --format v3 --out xxx.json --name 名称 --desc 描述 [--personality ..] [--scenario ..] [--first-meeting ..] [--book book.json] [--creator ..] [--tags a,b]
//   node cardforge.js convert <输入> --out <输出>

import { writeFile, readFile } from 'node:fs/promises';
import { inspectFile } from './lib/inspect.js';
import { forgeCard } from './lib/forge.js';
import { mdToStv3, stv3ToMd } from './lib/convert.js';

function usage() {
  console.log(`CardForge v1（cardforge）
用法:
  node cardforge.js inspect <文件>                       解卡：类型/结构/完整性/异常
  node cardforge.js forge --out xxx.json --name N ...    写标准 chara_card_v3
    必选: --out --name
    可选: --format v3(默认) --desc --personality --scenario --first-meeting
          --mes-example --system-prompt --creator-notes --creator --tags a,b
          --character-version --book 世界书.json
  node cardforge.js convert <输入> --out <输出>           md卡<->v3 json 双向转换`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) args[key] = argv[++i];
      else args[key] = true;
    } else args._.push(a);
  }
  return args;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '-h' || cmd === '--help') { usage(); process.exit(cmd ? 0 : 1); }
  const args = parseArgs(rest);

  if (cmd === 'inspect') {
    const file = args._[0];
    if (!file) { console.error('缺少文件参数'); process.exit(1); }
    const report = await inspectFile(file);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (cmd === 'forge') {
    if (!args.out || !args.name) { console.error('forge 需要 --out 和 --name'); process.exit(1); }
    let book = { entries: [] };
    if (args.book) {
      try {
        book = JSON.parse(await readFile(args.book, 'utf8'));
      } catch (e) { console.error('读取世界书失败: ' + e.message); process.exit(1); }
    }
    const card = forgeCard({
      name: args.name,
      desc: args.desc ?? '',
      personality: args.personality ?? '',
      scenario: args.scenario ?? '',
      firstMeeting: args['first-meeting'] ?? '',
      mesExample: args['mes-example'] ?? '',
      systemPrompt: args['system-prompt'] ?? '',
      creatorNotes: args['creator-notes'] ?? '',
      creator: args.creator ?? 'cardforge',
      characterVersion: args['character-version'] ?? '1.0',
      tags: args.tags ? String(args.tags).split(',').map(s => s.trim()).filter(Boolean) : [],
      book
    });
    await writeFile(args.out, JSON.stringify(card, null, 2), 'utf8');
    console.log(`已生成 ${args.out}（spec=${card.spec}，世界书条目=${card.data.character_book.entries.length}）`);
    return;
  }

  if (cmd === 'convert') {
    const input = args._[0];
    if (!input || !args.out) { console.error('convert 需要 <输入> 和 --out'); process.exit(1); }
    const text = await readFile(input, 'utf8');
    let out;
    if (input.toLowerCase().endsWith('.md')) {
      out = mdToStv3(text);
      await writeFile(args.out, JSON.stringify(out, null, 2), 'utf8');
      console.log(`md -> v3 json 完成: ${args.out}`);
    } else if (input.toLowerCase().endsWith('.json')) {
      const obj = JSON.parse(text);
      if (!obj.spec && !obj.data) { console.error('不是标准角色卡 json（缺 spec/data）'); process.exit(1); }
      out = stv3ToMd(obj);
      await writeFile(args.out, out, 'utf8');
      console.log(`v3 json -> md 概要 完成: ${args.out}`);
    } else {
      console.error('仅支持 .md 与 .json 互转');
      process.exit(1);
    }
    return;
  }

  console.error(`未知命令: ${cmd}`);
  usage();
  process.exit(1);
}

main().catch(e => { console.error('执行失败: ' + e.message); process.exit(1); });
