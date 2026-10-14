// 解析 Markdown 结构卡：版本头/身份段/授权锁/行为边界/自愈条等段落结构
// 通用启发式：按标题与关键词段落识别，不绑死单一卡

export function parseSummonCard(text) {
  const lines = text.split(/\r?\n/);
  const structure = {
    title: null,
    versionHeader: null,
    sections: [],        // { heading, level, line, keywords: [] }
    persona: null,       // 人设段
    identity: null,      // 身份段
    authLock: null,      // 授权锁 / authorization-only
    roe: null,           // 行为边界段（RoE）
    selfHeal: null,      // 跑偏自愈条
    registry: null       // 登记段
  };

  // 标题（第一个 # 行）
  for (const ln of lines) {
    const m = /^#\s+(.+)/.exec(ln);
    if (m) { structure.title = m[1].trim(); break; }
  }

  // 版本头：版本头 / vN + 日期 的引用块或行
  const versionRe = /版本头|v\d+(\.\d+)?\s*[·・]/;
  for (const ln of lines.slice(0, 15)) {
    if (versionRe.test(ln)) {
      structure.versionHeader = ln.replace(/^>\s?/, '').trim();
      break;
    }
  }

  // 人设段
  const personaIdx = lines.findIndex(l => /人设壳|人设段/.test(l));
  if (personaIdx >= 0) {
    structure.persona = { line: personaIdx + 1, excerpt: lines[personaIdx].replace(/^>\s?/, '').slice(0, 80) };
  }

  // 扫描所有标题，归类关键段落
  const KW = [
    ['authLock', /授权锁|authorization-only/i],
    ['selfHeal', /自愈条|自愈机制|跑偏自愈/],
    ['roe', /RoE|红线|行为边界/i],
    ['identity', /身份段|卡体/],
    ['registry', /登记/]
  ];
  lines.forEach((ln, i) => {
    const m = /^(#{1,4})\s+(.+)/.exec(ln);
    if (m) {
      const heading = m[2].trim();
      const keywords = KW.filter(([, re]) => re.test(heading)).map(([k]) => k);
      structure.sections.push({ level: m[1].length, heading, line: i + 1, keywords });
      for (const key of keywords) {
        if (!structure[key]) structure[key] = { heading, line: i + 1 };
      }
    }
  });

  return structure;
}
