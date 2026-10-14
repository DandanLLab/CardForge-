// 写卡：生成标准 chara_card_v3 JSON
export function forgeCard(opts) {
  const book = opts.book || { entries: [] };
  return {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: opts.name ?? '',
      description: opts.desc ?? '',
      personality: opts.personality ?? '',
      scenario: opts.scenario ?? '',
      first_mes: opts.firstMeeting ?? '',
      mes_example: opts.mesExample ?? '',
      creator_notes: opts.creatorNotes ?? '',
      system_prompt: opts.systemPrompt ?? '',
      post_history_instructions: opts.postHistoryInstructions ?? '',
      alternate_greetings: opts.alternateGreetings ?? [],
      character_version: opts.characterVersion ?? '1.0',
      tags: opts.tags ?? [],
      creator: opts.creator ?? '',
      character_book: {
        name: opts.bookName ?? `${opts.name ?? 'character'}的领域设定集`,
        entries: Array.isArray(book) ? book : (book.entries ?? [])
      },
      extensions: {}
    }
  };
}

export function normalizeBookEntry(entry, i = 0) {
  return {
    id: entry.id ?? i,
    keys: Array.isArray(entry.keys) ? entry.keys : [],
    secondary_keys: Array.isArray(entry.secondary_keys) ? entry.secondary_keys : [],
    comment: entry.comment ?? entry.name ?? '',
    content: entry.content ?? '',
    constant: Boolean(entry.constant),
    selective: entry.selective === undefined ? true : Boolean(entry.selective),
    insertion_order: entry.insertion_order ?? entry.priority ?? 100,
    enabled: entry.enabled === undefined ? true : Boolean(entry.enabled),
    position: entry.position ?? 'before_char',
    extensions: entry.extensions ?? {}
  };
}
