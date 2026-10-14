// 转换：md结构卡 -> v3 json；v3 json -> md概要
import { parseSummonCard } from './parseMd.js';

// 把 md 结构卡的段落映射到 v3 字段
export function mdToStv3(text) {
  const parsed = parseSummonCard(text);
  const sections = parsed.sections;

  const lines = text.split(/\r?\n/);
  const sliceSection = (heading, stopRe) => {
    const idx = lines.findIndex(l => l.includes(heading));
    if (idx < 0) return '';
    let out = [];
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^#{1,4}\s/.test(lines[i]) || (stopRe && stopRe.test(lines[i]))) break;
      out.push(lines[i]);
    }
    return out.join('\n').trim();
  };

  // 版本头后面的引用块=简介来源
  const nameMatch = /卡名[：:]\s*(.+)/.exec(text);
  const idMatch = /卡ID[：:]\s*(.+)/.exec(text);
  const versionMatch = /(?:卡)?版本[：:]\s*(\S+)/.exec(text);
  const locMatch = /定位[：:]\s*(.+)/.exec(text);
  const conceptMatch = /核心理念[：:]\s*(.+)/.exec(text);

  const identity = sliceSection('身份段') || sliceSection('卡体');
  const roe = sliceSection('RoE') || sliceSection('红线');
  const selfHeal = sliceSection('自愈条') || sliceSection('自愈机制');
  const persona = parsed.persona ? sliceSection('人设壳', /^>?\s*锻造日期/) || sliceSection('人设段') : '';

  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: (nameMatch ? nameMatch[1].split('（')[0].trim() : (parsed.title || '').replace(/^结构卡[:：]?\s*/, '').trim()).replace(/\s+v\d+(\.\d+)*$/i, ''),
      description: [
        conceptMatch ? '核心理念：' + conceptMatch[1].trim() : '',
        locMatch ? '定位：' + locMatch[1].trim() : '',
        identity
      ].filter(Boolean).join('\n\n'),
      personality: persona,
      scenario: roe ? '行为边界（RoE红线）：\n' + roe : '',
      first_mes: '',
      mes_example: '',
      creator_notes: [parsed.versionHeader, '锻造自 md 结构卡（cardforge convert）'].filter(Boolean).join('\n'),
      system_prompt: identity,
      character_version: versionMatch ? versionMatch[1].replace(/[（(].*$/, '').trim() : 'v1',
      tags: [idMatch ? idMatch[1].trim() : ''].filter(Boolean),
      creator: 'cardforge',
      character_book: {
        name: '运行规约',
        entries: [
          ...(selfHeal ? [{
            keys: ['跑偏', '自愈'],
            content: selfHeal,
            comment: '跑偏自愈条',
            constant: true,
            insertion_order: 10
          }] : []),
          ...(roe ? [{
            keys: ['RoE', '授权', '红线'],
            content: roe,
            comment: 'RoE红线段',
            constant: true,
            insertion_order: 5
          }] : [])
        ]
      },
      extensions: { source: 'md-card', cardId: idMatch ? idMatch[1].trim() : null }
    }
  };
}

// v3 json -> md 概要
export function stv3ToMd(obj) {
  const d = obj.data || obj;
  const book = d.character_book?.entries ?? [];
  const L = [];
  L.push(`# 角色卡概要：${d.name || '未命名'}`);
  L.push('');
  L.push(`> spec: ${obj.spec ?? '未知'} · spec_version: ${obj.spec_version ?? '未知'} · character_version: ${d.character_version ?? '未知'}`);
  L.push('');
  if (d.description) L.push('## 描述\n\n' + d.description + '\n');
  if (d.personality) L.push('## 人设\n\n' + d.personality + '\n');
  if (d.scenario) L.push('## 场景\n\n' + d.scenario + '\n');
  if (d.first_mes) L.push('## 开场白\n\n' + d.first_mes + '\n');
  if (d.system_prompt) L.push('## 系统提示词\n\n' + d.system_prompt + '\n');
  if (d.tags?.length) L.push('## 标签\n\n' + d.tags.join('、') + '\n');
  if (book.length) {
    L.push(`## 世界书（${book.length} 条）\n`);
    book.forEach((e, i) => {
      L.push(`### 条目${i + 1}${e.comment ? '：' + e.comment : ''}`);
      L.push(`- 关键词: ${(e.keys ?? []).join('、') || '（无）'}`);
      L.push(`- 常驻: ${e.constant ? '是' : '否'}`);
      L.push('');
      L.push((e.content ?? '').slice(0, 400) + ((e.content ?? '').length > 400 ? '\n\n（内容过长已截断）' : ''));
      L.push('');
    });
  }
  if (d.creator_notes) L.push('## 创建者备注\n\n' + d.creator_notes + '\n');
  return L.join('\n');
}
