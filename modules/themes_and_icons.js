export const THEMES = [
    { id: 'tavern', name: 'Тема Таверны', nameEn: 'Tavern Sync', sub: 'СИНХРОНИЗАЦИЯ С ТАВЕРНОЙ', subEn: 'TAVERN THEME SYNC', color: '#9ca3af' },
    { id: 'krakoa', name: 'Люди Икс: Кракоа', nameEn: 'X-Men: Krakoa', sub: 'HOX // BIOTECH DATA PAGE', subEn: 'HOX // BIOTECH DATA PAGE', color: '#1de9b6' },
    { id: 'demonic', name: 'Демонический Гримуар', nameEn: 'Demonic Grimoire', sub: 'КОДЕКС БЕЗДНЫ', subEn: 'ABYSSAL CODEX', color: '#e62e45' },
    { id: 'scroll', name: 'Средневековый Свиток', nameEn: 'Royal Scroll', sub: 'КОРОЛЕВСКИЙ ПЕРГАМЕНТ', subEn: 'ROYAL PARCHMENT', color: '#9c7121' },
    { id: 'rose', name: 'Розовый Кварц', nameEn: 'Rose Quartz', sub: 'ФАРФОРОВАЯ КАМЕЛИЯ', subEn: 'PORCELAIN CAMELLIA', color: '#d64d7e' },
    { id: 'manga', name: 'Манга-редакция', nameEn: 'Manga Edition', sub: 'ЧИСТЫЙ ТОМИК', subEn: 'INK VOLUME', color: '#c93b3b' },
    { id: 'notebook', name: 'Классический Блокнот', nameEn: 'Classic Notebook', sub: 'ЛИЧНЫЙ ДНЕВНИК', subEn: 'PERSONAL JOURNAL', color: '#b84a27' },
    { id: 'celestial', name: 'Астральный Кодекс', nameEn: 'Celestial Codex', sub: 'ЗВЕЗДНАЯ АСТРОЛЯБИЯ', subEn: 'STAR ASTROLABE', color: '#f0c674' },
    { id: 'cyber', name: 'Кибер-Нейролинк', nameEn: 'Cyber Neurolink', sub: 'ТАКТИЧЕСКИЙ HUD', subEn: 'TACTICAL HUD', color: '#00f0ff' },
    { id: 'velvet', name: 'Полуночный Бархат', nameEn: 'Nocturne Velvet', sub: 'ГОТИЧЕСКИЙ САЛОН', subEn: 'GOTHIC SALON', color: '#d9468f' },
    { id: 'apothecary', name: 'Изумрудный Гербарий', nameEn: 'Emerald Apothecary', sub: 'АЛХИМИЧЕСКИЙ АРХИВ', subEn: 'ALCHEMICAL HERBARIUM', color: '#38d399' },
    { id: 'olympus', name: 'Мрамор и Золото', nameEn: 'Gilded Marble', sub: 'ЗАЛЫ ОЛИМПА', subEn: 'HALLS OF OLYMPUS', color: '#b58428' },
    { id: 'abyss', name: 'Океаническая Бездна', nameEn: 'Abyssal Trench', sub: 'ГЛУБИННЫЙ СОНАР', subEn: 'DEEP SEA SONAR', color: '#22d3ee' },
];

export const LANGUAGES = [
    { id: 'Русский', label: 'Русский' },
    { id: 'English', label: 'English' },
    { id: 'Українська', label: 'Українська' },
    { id: 'Español', label: 'Español' },
    { id: 'Deutsch', label: 'Deutsch' },
    { id: 'Français', label: 'Français' },
    { id: '日本語', label: '日本語' },
    { id: 'Язык запроса автора', label: 'Как в запросе / Auto' },
];

export const HELP_TIPS = {
    scope: '«Этот чат» хранит заметки только для открытого сейчас персонажа. «Общие» хранят заметки, доступные сразу во всех твоих чатах.',
    sec_header: 'Управляет тем, как оглавление раздела («### Название») и подзаголовки карточек подаются нейросети. Все заголовки и подзаголовки автоматически отделяются чистой пустой строкой-отступом, никогда не сливаясь с текстом!',
    sec_pos: 'Маршрут раздела: внутрь переписки («В глубине чата»), в системное начало («Перед/После промпта»), в макрос {{notebook}} или «Никуда» (личная памятка только для твоих глаз).',
    sec_depth: 'Глубина 0 — самый низ после последней реплики (сильнее всего влияет на следующий ответ). Глубина 4–10 — мягкое фоновое напоминание выше по истории.',
    sec_role: 'От чьего лица подаётся запись: «Система» — голос режиссёра за кадром (подходит почти всегда). «Пользователь» — от лица игрока. «Ассистент» — как память персонажа.',
    note_title_inc: 'Если включено — название записи станет аккуратным подзаголовком отдельной строкой с отступом перед текстом (никогда не лепится в одну кашу с абзацем!).',
    note_strict: 'Добавляет усиленную метку [ВАЖНО], чтобы модель строго соблюдала этот пункт.',
    ai_words: 'Желаемый объём текста в словах. Значение 0 снимает ограничения по длине.',
    ai_radius: 'Сколько последних полных сообщений чата прочитает Соавтор. Значение 0 отключает чтение переписки.',
    macro_info: 'Скопируй {{notebook}} и вставь в пресет — туда соберутся все разделы со статусом «В макрос».',
    forge_shelf: 'Библиотека всех Лорбуков Таверны! Прямо на томе выбирай область работы: «Глобально» (включает книгу в верхнем меню Мира Таверны для всех чатов), «В чат» (только эта беседа) или «Персонаж» (все чаты с этим героем). Нажми на обложку для смены Арта!',
    forge_mode: '«Прямой перенос без ИИ» копирует записи как есть. «Дословно + ключи от ИИ» бережно сохраняет твой текст буква в букву и подбирает только триггеры. «С Соавтором ИИ» придумывает новые страницы мира по выбранному шаблону.',
    forge_trig: '«По ключам» — страница спит и просыпается только при упоминании ключевых слов в чате. «Постоянно» — висит в промпте всегда. «Векторизация» — активация по смыслу через Vector Storage Таверны.',
    forge_scope: '«Глобально» синхронизируется с главным меню Мира/Глобуса Таверны. «В чат» привязывает книгу только к текущему диалогу. «Персонаж» закрепляет основной Лорбук за карточкой героя.',
    forge_page_ai: 'Выбери готовый шаблон задачи или опиши идею страницы — Соавтор создаст свежую статью с абзацами, сам подберёт ключевые слова и учтёт канон книги.',
    forge_recursion: 'Рекурсия — это когда текст одной проснувшейся страницы содержит ключевое слово другой и будит её по цепочке. Петли (A <-> B) или слишком короткие ключи могут вывалить полкниги в контекст разом — инспектор находит их и позволяет изолировать в один клик.',
    forge_words: 'Объём каждой генерируемой страницы Лорбука в словах и желаемое число страниц. Значение 0 отдаёт выбор объёма на усмотрение модели.',
};

export const HELP_TIPS_EN = {
    scope: '"This Chat" stores notes only for the active character. "Global" notes are available across all chats.',
    sec_header: 'Controls section headings ("### Section") and note subheaders. All headings automatically insert a clean blank-line indent before text.',
    sec_pos: 'Injection route: inside chat history ("@ Depth"), before/after main prompt, into {{notebook}} macro, or "Nowhere" (private memo).',
    sec_depth: 'Depth 0 is right after the latest message (strongest impact). Depth 4–10 is a gentle background reminder higher up.',
    sec_role: 'System acts as narrator/director (best default). User speaks as player; Assistant as character memory.',
    note_title_inc: 'When enabled, the note title becomes a standalone subheader with a blank line indent above the note body.',
    note_strict: 'Adds an [IMPORTANT] tag so the model prioritizes this rule.',
    ai_words: 'Target word range. Set 0 for no word limit.',
    ai_radius: 'Number of recent full chat messages read by Co-Author. 0 disables chat reading.',
    macro_info: 'Copy {{notebook}} into your preset to collect all sections routed to Macro.',
    forge_shelf: 'All SillyTavern Lorebooks! Toggle Global (synced with ST World menu), Chat, or Character binding right on each tome.',
    forge_mode: 'Direct copy without AI, verbatim text + AI keys, or full AI worldbuilding with presets.',
    forge_trig: 'By Keys wakes up on keyword match; Constant stays active; Vector uses ST Vector Storage.',
    forge_scope: 'Global syncs with ST World Info selector; Chat binds to current conversation; Character binds to the character card.',
    forge_page_ai: 'Pick a prompt preset or describe any page idea — Co-Author writes clean paragraphs and generates trigger keys.',
    forge_recursion: 'Recursion happens when one activated entry mentions keywords of another entry. Mutual loops (A <-> B) can cascade — isolate them in 1 click.',
    forge_words: 'Target word range per Lorebook page and desired page count. Set 0 for automatic length.',
};

export const ICONS = {
    book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h6M9 11h4"/></svg>`,
    forge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H15v16H5.5A2.5 2.5 0 0 0 3 21.5v-16z"/><path d="M7.5 7.5v6h4" stroke-width="2"/><path d="M14 13l6.5-6.5"/><path d="M17.5 3.5l3.5 3.5-2 2-3.5-3.5 2-2z" fill="currentColor" fill-opacity="0.25"/></svg>`,
    palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-.5a2 2 0 0 1 2-2h1.5a4.5 4.5 0 0 0 4.5-4.5C22 6.5 17.5 2 12 2z"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1.2" fill="currentColor"/></svg>`,
    sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>`,
    spinner: `<svg class="pcx-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 22a10 10 0 0 1-10-10" opacity="0.3"/></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`,
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>`,
    grip: `<svg viewBox="0 0 16 24" fill="currentColor"><circle cx="5" cy="5" r="1.7"/><circle cx="11" cy="5" r="1.7"/><circle cx="5" cy="12" r="1.7"/><circle cx="11" cy="12" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="11" cy="19" r="1.7"/></svg>`,
    clip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
    fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
    vector: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 7.5L11 15.5M15.5 7.5L13 15.5M9 6h6"/></svg>`,
    chevLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
    chevRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
    chevDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
    chevUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2"/><path d="M17 6l3 3M14 9l2.5 2.5"/></svg>`,
    layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`,
    loop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    align: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="15" y2="10"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="14" y2="20"/></svg>`,
    template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
};

export const THEME_CRESTS = {
    tavern: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16h24v13a5 5 0 0 1-5 5H12a5 5 0 0 1-5-5V16z"/><path d="M31 18h3a3 3 0 0 1 0 6h-3"/><path d="M13 7c0 3 3 3 3 6M20 6c0 3 3 3 3 6M26 8c0 2.5 2 2.5 2 5"/></svg>`,
    krakoa: `<svg viewBox="0 0 44 44" fill="none"><path d="M4 22 C8 10, 14 6, 22 4 C30 6, 36 10, 40 22 C36 34, 30 38, 22 40 C14 38, 8 34, 4 22 Z" stroke="#b97a38" stroke-width="1.3" opacity="0.85"/><path d="M7 14 C12 17, 13 12, 18 9 M37 30 C32 27, 31 32, 26 35" stroke="#b97a38" stroke-width="1.2" stroke-linecap="round"/><circle cx="22" cy="22" r="12.5" fill="#0d1412" stroke="currentColor" stroke-width="2.2"/><path d="M13.5 13.5 L30.5 30.5 M30.5 13.5 L13.5 30.5" stroke="currentColor" stroke-width="2.4"/><circle cx="22" cy="22" r="2.8" fill="#e5a94c"/></svg>`,
    demonic: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="20" cy="20" r="17" stroke-dasharray="3 2"/><circle cx="20" cy="20" r="13"/><path d="M20 5 L29 31 L8 15 L32 15 L11 31 Z" stroke-linejoin="round"/><circle cx="20" cy="20" r="2.5" fill="currentColor"/></svg>`,
    scroll: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 7h20a3 3 0 0 1 0 6H10a3 3 0 0 1 0-6z"/><path d="M12 13v16M28 13v16"/><path d="M9 29h22a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6z"/><path d="M16 18h8M16 23h6"/></svg>`,
    rose: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="4" fill="currentColor" fill-opacity="0.25"/><path d="M20 7c3.5 4 4.5 7.5 0 11-4.5-3.5-3.5-7 0-11z"/><path d="M33 20c-4 3.5-7.5 4.5-11 0 3.5-4.5 7-3.5 11 0z"/><path d="M20 33c-3.5-4-4.5-7.5 0-11 4.5 3.5 3.5 7 0 11z"/><path d="M7 20c4-3.5 7.5-4.5 11 0-3.5 4.5-7 3.5-11 0z"/><circle cx="20" cy="20" r="15" stroke-dasharray="2 3"/></svg>`,
    manga: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="6" y="6" width="28" height="28"/><path d="M6 16h28M18 16v18"/><circle cx="27" cy="25" r="4" fill="#c93b3b" stroke="none"/></svg>`,
    notebook: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="5" width="24" height="30" rx="3"/><path d="M5 10 H11 M5 16.5 H11 M5 23 H11 M5 29.5 H11" stroke-linecap="round"/><path d="M15 13 H27 M15 19.5 H27 M15 26 H22" stroke-linecap="round"/></svg>`,
    celestial: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="20" cy="20" r="16"/><ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(32 20 20)"/><ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(-32 20 20)"/><path d="M20 8 L22.2 17.8 L32 20 L22.2 22.2 L20 32 L17.8 22.2 L8 20 L17.8 17.8 Z" fill="currentColor"/></svg>`,
    cyber: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 4 H30 L36 10 V30 L30 36 H10 L4 30 V10 Z"/><path d="M13 20 H27 M20 13 V27"/><rect x="17.5" y="17.5" width="5" height="5" fill="currentColor"/></svg>`,
    velvet: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7h18l-2 11a7 7 0 0 1-14 0L11 7z" fill="currentColor" fill-opacity="0.18"/><path d="M20 25v8M14 33h12"/><path d="M7 9c2.5 0 4 2 4 4.5S9 18 7 18M33 9c-2.5 0-4 2-4 4.5S31 18 33 18"/><circle cx="20" cy="13" r="2" fill="#e8c382" stroke="none"/></svg>`,
    apothecary: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M16 6h8M18 6v6l-8 13a5 5 0 0 0 4.3 7.5h11.4A5 5 0 0 0 30 25l-8-13V6"/><path d="M12.5 24c4-2 11 2 15 0" stroke="#d4a853"/><path d="M20 17c3-3 6.5-2.5 7 1-3.5.5-5.5 0-7-1z" fill="currentColor" fill-opacity="0.3"/></svg>`,
    olympus: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M11 32c-4-5-4.5-13 1-19M29 32c4-5 4.5-13-1-19"/><path d="M8 24l3-1M7.5 19l3.5.5M10 14l3 1.5M32 24l-3-1M32.5 19l-3.5.5M30 14l-3 1.5"/><path d="M15 33h10M17 15h6v18h-6z"/><path d="M14 15h12l-6-5-6 5z" fill="currentColor" fill-opacity="0.22"/></svg>`,
    abyss: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="20" cy="20" r="15" stroke-dasharray="4 2"/><circle cx="20" cy="20" r="9"/><path d="M20 5v6M20 29v6M5 20h6M29 20h6"/><circle cx="20" cy="20" r="3" fill="#f59e0b" stroke="none"/></svg>`,
};

export const THEME_BANNERS = {
    tavern: `<svg class="pcx-deco-banner" viewBox="0 0 600 20" preserveAspectRatio="none" fill="none"><line x1="16" y1="10" x2="265" y2="10" stroke="currentColor" stroke-opacity="0.25"/><circle cx="285" cy="10" r="2.5" fill="currentColor" fill-opacity="0.5"/><polygon points="300,5 305,10 300,15 295,10" fill="currentColor" fill-opacity="0.75"/><circle cx="315" cy="10" r="2.5" fill="currentColor" fill-opacity="0.5"/><line x1="335" y1="10" x2="584" y2="10" stroke="currentColor" stroke-opacity="0.25"/></svg>`,
    krakoa: `<svg class="pcx-deco-banner" viewBox="0 0 600 24" preserveAspectRatio="none" fill="none"><path d="M0 14 C45 4, 85 22, 140 12 C185 5, 220 12, 270 12 L540 12" stroke="#9e6830" stroke-width="1.6" opacity="0.72"/><path d="M0 19 C35 23, 70 8, 120 16 C160 21, 200 12, 250 12" stroke="#d99b43" stroke-width="1" opacity="0.55"/><line x1="255" y1="12" x2="585" y2="12" stroke="#1de9b6" stroke-width="1.1" opacity="0.6"/><circle cx="270" cy="12" r="3" fill="#1de9b6"/><circle cx="284" cy="12" r="2" fill="#e5a94c"/><path d="M300 7 L306 17 M314 7 L314 17 M322 12 A4 4 0 1 1 330 12" stroke="#e5a94c" stroke-width="1.3" opacity="0.85"/><path d="M565 7 V17 M560 12 H570" stroke="#1de9b6" stroke-width="1.3"/><circle cx="585" cy="12" r="4" stroke="#1de9b6" stroke-width="1.4"/></svg>`,
    demonic: `<svg class="pcx-deco-banner" viewBox="0 0 600 22" preserveAspectRatio="none" fill="none"><line x1="0" y1="11" x2="250" y2="11" stroke="#6e1d2a" stroke-width="1"/><path d="M260 11 L272 5 L284 11 L272 17 Z" stroke="#d6a456" stroke-width="1.2"/><polygon points="300,3 308,11 300,19 292,11" fill="#e62e45"/><path d="M316 11 L328 5 L340 11 L328 17 Z" stroke="#d6a456" stroke-width="1.2"/><line x1="350" y1="11" x2="600" y2="11" stroke="#6e1d2a" stroke-width="1"/></svg>`,
    scroll: `<svg class="pcx-deco-banner" viewBox="0 0 600 22" preserveAspectRatio="none" fill="none"><path d="M20 11 H255" stroke="#8c6218" stroke-width="1" stroke-dasharray="6 3"/><path d="M270 11 C280 4, 290 4, 300 11 C310 4, 320 4, 330 11 C320 18, 310 18, 300 11 C290 18, 280 18, 270 11 Z" stroke="#8a1c27" stroke-width="1.3"/><circle cx="300" cy="11" r="2.5" fill="#8a1c27"/><path d="M345 11 H580" stroke="#8c6218" stroke-width="1" stroke-dasharray="6 3"/></svg>`,
    rose: `<svg class="pcx-deco-banner" viewBox="0 0 600 22" preserveAspectRatio="none" fill="none"><path d="M20 11 Q150 4, 275 11" stroke="#df9bb5" stroke-width="1.1"/><circle cx="290" cy="11" r="2" fill="#b57464"/><circle cx="300" cy="11" r="4" fill="#d44d7e" fill-opacity="0.35" stroke="#d44d7e" stroke-width="1.2"/><circle cx="310" cy="11" r="2" fill="#b57464"/><path d="M325 11 Q450 18, 580 11" stroke="#df9bb5" stroke-width="1.1"/></svg>`,
    manga: `<svg class="pcx-deco-banner" viewBox="0 0 600 20" preserveAspectRatio="none" fill="none"><line x1="0" y1="7" x2="600" y2="7" stroke="#18181b" stroke-width="1.5"/><line x1="0" y1="13" x2="490" y2="13" stroke="#18181b" stroke-width="0.8"/><rect x="505" y="4" width="75" height="12" fill="#c93b3b"/></svg>`,
    notebook: `<svg class="pcx-deco-banner" viewBox="0 0 600 18" preserveAspectRatio="none" fill="none"><line x1="12" y1="9" x2="588" y2="9" stroke="#9e8267" stroke-width="1.4" stroke-dasharray="7 5"/></svg>`,
    celestial: `<svg class="pcx-deco-banner" viewBox="0 0 600 24" preserveAspectRatio="none" fill="none"><line x1="25" y1="12" x2="245" y2="12" stroke="#f0c674" stroke-opacity="0.3"/><circle cx="265" cy="12" r="3.5" stroke="#f0c674" stroke-width="1.1"/><path d="M284 8 A5 5 0 1 0 284 16 A3.8 3.8 0 1 1 284 8 Z" fill="#f0c674"/><path d="M300 4 L302 10 L308 12 L302 14 L300 20 L298 14 L292 12 L298 10 Z" fill="#f0c674"/><path d="M316 8 A5 5 0 1 1 316 16 A3.8 3.8 0 1 0 316 8 Z" fill="#f0c674"/><circle cx="335" cy="12" r="3.5" stroke="#f0c674" stroke-width="1.1"/><line x1="355" y1="12" x2="575" y2="12" stroke="#f0c674" stroke-opacity="0.3"/></svg>`,
    cyber: `<svg class="pcx-deco-banner" viewBox="0 0 600 22" preserveAspectRatio="none" fill="none"><polyline points="0,14 190,14 205,6 220,17 235,4 250,14 530,14 542,7 600,7" stroke="#00f0ff" stroke-width="1.3" opacity="0.8"/><rect x="552" y="11" width="10" height="5" fill="#00f0ff" opacity="0.7"/><rect x="568" y="11" width="18" height="5" fill="#ff0055" opacity="0.85"/></svg>`,
    velvet: `<svg class="pcx-deco-banner" viewBox="0 0 600 22" preserveAspectRatio="none" fill="none"><path d="M15 11 C95 3, 175 19, 265 11" stroke="#e8c382" stroke-width="1.1" opacity="0.65"/><polygon points="300,3 307,11 300,19 293,11" fill="#d9468f" stroke="#e8c382" stroke-width="1"/><circle cx="280" cy="11" r="2.2" fill="#e8c382"/><circle cx="320" cy="11" r="2.2" fill="#e8c382"/><path d="M335 11 C425 19, 505 3, 585 11" stroke="#e8c382" stroke-width="1.1" opacity="0.65"/></svg>`,
    apothecary: `<svg class="pcx-deco-banner" viewBox="0 0 600 22" preserveAspectRatio="none" fill="none"><line x1="20" y1="11" x2="252" y2="11" stroke="#38d399" stroke-opacity="0.35"/><circle cx="272" cy="11" r="3.5" stroke="#d4a853" stroke-width="1.2"/><polygon points="300,4 308,17 292,17" stroke="#38d399" stroke-width="1.3" fill="none"/><circle cx="328" cy="11" r="3.5" stroke="#d4a853" stroke-width="1.2"/><line x1="348" y1="11" x2="580" y2="11" stroke="#38d399" stroke-opacity="0.35"/></svg>`,
    olympus: `<svg class="pcx-deco-banner" viewBox="0 0 600 20" preserveAspectRatio="none" fill="none"><path d="M20 14 H245 V6 H260 V14 H275 V6 H325 V14 H340 V6 H355 V14 H580" stroke="#b58428" stroke-width="1.25" opacity="0.78"/><circle cx="300" cy="10" r="3" fill="#264e70"/></svg>`,
    abyss: `<svg class="pcx-deco-banner" viewBox="0 0 600 22" preserveAspectRatio="none" fill="none"><path d="M0 12 Q75 4, 150 12 T300 12 T450 12 T600 12" stroke="#22d3ee" stroke-width="1.2" opacity="0.65"/><circle cx="300" cy="12" r="4.5" stroke="#22d3ee" stroke-width="1.2"/><circle cx="300" cy="12" r="2" fill="#f59e0b"/></svg>`,
};

export const SUITE_CSS = `
@keyframes pcxSpinAnim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.pcx-spin { animation: pcxSpinAnim 0.85s linear infinite; }
body.pcx-dragging-active, body.pcx-dragging-active * { user-select: none !important; -webkit-user-select: none !important; -webkit-touch-callout: none !important; }
#pcx-sendbar-btn { display: flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important; padding: 0 4px !important; opacity: 0.82; transition: opacity 0.15s ease, transform 0.15s ease; }
#pcx-sendbar-btn:hover { opacity: 1; }
#pcx-sendbar-btn:active { transform: scale(0.92); }
#pcx-sendbar-btn svg { width: 21px !important; height: 21px !important; display: block; }
#pcx-settings-drawer .pcx-drawer-btn { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; display: flex !important; flex-direction: row !important; align-items: center !important; justify-content: center !important; gap: 10px !important; padding: 10px 14px !important; white-space: normal !important; line-height: 1.3 !important; cursor: pointer !important; }
#pcx-settings-drawer .pcx-drawer-btn svg { width: 18px !important; height: 18px !important; flex-shrink: 0 !important; }

dialog#pcx-dialog { position: fixed !important; inset: 0 !important; width: 100vw !important; max-width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important; margin: 0 !important; padding: 0 !important; border: none !important; outline: none !important; background: rgba(6, 8, 12, 0.76) !important; backdrop-filter: blur(6px) !important; -webkit-backdrop-filter: blur(6px) !important; z-index: 2147483645 !important; overflow: hidden !important; box-sizing: border-box !important; }
dialog#pcx-dialog[open] { display: flex !important; align-items: flex-end !important; justify-content: center !important; }
@media (min-width: 768px) { dialog#pcx-dialog[open] { align-items: center !important; } }
dialog#pcx-dialog::backdrop { background: rgba(0, 0, 0, 0.45) !important; }
#pcx-window { position: relative; width: 100%; max-width: 630px; height: 92dvh; max-height: 880px; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; color: var(--pcx-text); font-family: var(--pcx-font-body); }
#pcx-window.pcx-no-tips .pcx-q-btn, #pcx-window.pcx-no-tips .pcx-q-bubble { display: none !important; }

.pcx-q-btn { width: 17px; height: 17px; padding: 0; margin-left: 5px; border-radius: 50%; border: 1px solid var(--pcx-border); background: rgba(128,128,128,0.12); color: var(--pcx-text-muted); font-family: var(--pcx-font-body); font-size: 10.5px; font-weight: 800; line-height: 15px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; vertical-align: middle; flex-shrink: 0; }
.pcx-q-btn:hover, .pcx-q-btn.pcx-q-open { border-color: var(--pcx-accent); color: var(--pcx-accent); background: rgba(128,128,128,0.2); }
.pcx-q-bubble { margin: 5px 0 6px; padding: 8px 11px; border-radius: var(--pcx-radius); border-left: 3px solid var(--pcx-accent); background: rgba(128,128,128,0.11); color: var(--pcx-text); font-size: 11.5px; font-weight: 500; line-height: 1.46; }
.pcx-deco-banner { display: block; width: 100%; height: 19px; flex-shrink: 0; color: var(--pcx-accent); background: var(--pcx-bg-panel); border-bottom: 1px solid var(--pcx-border); }
.pcx-beta-tag { font-family: var(--pcx-font-mono); font-size: 8.5px; font-weight: 800; letter-spacing: 0.6px; padding: 1px 5px; border-radius: 4px; border: 1px solid var(--pcx-accent); color: var(--pcx-accent); background: rgba(128,128,128,0.1); flex-shrink: 0; }

.pcx-wing-bar { padding: 7px 12px; display: flex; align-items: center; background: var(--pcx-bg-panel); border-bottom: 1px solid var(--pcx-border); flex-shrink: 0; }
.pcx-wing-switch { display: grid; grid-template-columns: 1fr 1fr; width: 100%; border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); overflow: hidden; background: var(--pcx-bg); }
.pcx-wing-btn { height: 34px; border: none; background: transparent; color: var(--pcx-text-muted); font-size: 12.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; transition: background 0.15s ease, color 0.15s ease; }
.pcx-wing-btn svg { width: 16px; height: 16px; flex-shrink: 0; }
.pcx-wing-btn.pcx-active { background: var(--pcx-accent); color: #0b110f; }

.pcx-theme-tavern { --pcx-bg: var(--SmartThemeBlurTintColor, #17191e); --pcx-bg-panel: var(--SmartThemeChatTintColor, #20232b); --pcx-bg-card: rgba(128,128,128,0.09); --pcx-bg-card-off: rgba(128,128,128,0.03); --pcx-text: var(--SmartThemeBodyColor, #e8eaed); --pcx-text-muted: var(--SmartThemeEmColor, #9aa0a6); --pcx-accent: var(--SmartThemeQuoteColor, #7aa2f7); --pcx-accent-2: var(--SmartThemeUnderlineColor, #bb9af7); --pcx-border: var(--SmartThemeBorderColor, rgba(255,255,255,0.16)); --pcx-border-active: var(--SmartThemeQuoteColor, #7aa2f7); --pcx-glow: 0 4px 18px rgba(0,0,0,0.28); --pcx-font-title: var(--mainFontFamily, 'Montserrat', sans-serif); --pcx-font-body: var(--mainFontFamily, 'Montserrat', sans-serif); --pcx-font-mono: var(--monoFontFamily, 'JetBrains Mono', monospace); --pcx-radius: 10px; }
#pcx-window.pcx-theme-tavern { background: var(--SmartThemeBlurTintColor, #17191e); backdrop-filter: blur(var(--SmartThemeBlurStrength, 12px)); -webkit-backdrop-filter: blur(var(--SmartThemeBlurStrength, 12px)); border-top: 2px solid var(--pcx-accent); border-left: 1px solid var(--pcx-border); border-right: 1px solid var(--pcx-border); border-radius: 16px 16px 0 0; box-shadow: 0 -10px 40px rgba(0,0,0,0.55); }

.pcx-theme-krakoa { --pcx-bg: #0c100f; --pcx-bg-panel: #131816; --pcx-bg-card: linear-gradient(160deg, #f4f6f3 0%, #e7ece8 100%); --pcx-bg-card-off: #171e1b; --pcx-text: #f2f5f3; --pcx-text-muted: #9ab0a6; --pcx-accent: #1de9b6; --pcx-accent-2: #d99b43; --pcx-border: #332a20; --pcx-border-active: #c98a38; --pcx-glow: 0 6px 22px rgba(0,0,0,0.42); --pcx-font-title: 'Montserrat', system-ui, sans-serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 3px; }
#pcx-window.pcx-theme-krakoa { background: radial-gradient(ellipse at 12% 8%, rgba(185,122,56,0.24), transparent 48%), radial-gradient(ellipse at 88% 12%, rgba(29,233,182,0.14), transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(120,74,32,0.22), transparent 55%), repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 36px), #0c100f; border-top: 3px solid #d99b43; border-left: 1px solid #3a2b1c; border-right: 1px solid #203b33; border-radius: 14px 2px 0 0; box-shadow: 0 -12px 44px rgba(0,0,0,0.8); }
.pcx-theme-krakoa .pcx-header { background: linear-gradient(90deg, #1b140e 0%, #111917 55%, #0e1b18 100%); }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) { background: var(--pcx-bg-card); color: #111615; border: 1px solid #d4d9d5; border-top: 3px solid #111615; border-left: 4px solid #d99b43; border-radius: 2px 12px 2px 2px; }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-card-title, .pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-card-content, .pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-collapse-btn { color: #111615; }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-card-grip { color: #5c6b65; }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-mini-btn { color: #1d2624; border-color: #b7c2bc; background: rgba(0,0,0,0.03); }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-prio-badge { background: #111615; color: #1de9b6; border-radius: 999px; padding: 2px 9px; font-family: var(--pcx-font-mono); }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-switch { background: #cdd5d1; border-color: #111615; }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-switch.pcx-on { background: #111615; border-color: #111615; }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-switch.pcx-on::after { background: #1de9b6; }
.pcx-theme-krakoa .pcx-tab { border-radius: 999px; border-color: #3a2d1f; }
.pcx-theme-krakoa .pcx-tab.pcx-active { background: #f2f5f3; color: #0d1311; border-color: #1de9b6; font-weight: 800; }
.pcx-theme-krakoa .pcx-tab.pcx-active .pcx-tab-count { background: #111615; color: #1de9b6; }
.pcx-theme-krakoa .pcx-add-tab-pill { border-radius: 999px; border-color: #d99b43; color: #e9b15e; }

.pcx-theme-demonic { --pcx-bg: #0c0406; --pcx-bg-panel: #15070b; --pcx-bg-card: linear-gradient(150deg, #220a10 0%, #110407 100%); --pcx-bg-card-off: #100608; --pcx-text: #f6e3dc; --pcx-text-muted: #a8767c; --pcx-accent: #e62e45; --pcx-accent-2: #d6a456; --pcx-border: #4d1923; --pcx-border-active: #d6a456; --pcx-glow: 0 5px 22px rgba(230,46,69,0.22); --pcx-font-title: 'Cinzel', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 4px; }
#pcx-window.pcx-theme-demonic { background: radial-gradient(circle at 50% 0%, rgba(205,22,48,0.26), transparent 55%), radial-gradient(circle at 15% 95%, rgba(214,164,86,0.1), transparent 45%), #0c0406; border-top: 2.5px solid #d6a456; border-left: 1px solid #591c27; border-right: 1px solid #591c27; border-radius: 14px 14px 0 0; box-shadow: 0 -10px 44px rgba(0,0,0,0.85), inset 0 0 30px rgba(0,0,0,0.7); }
.pcx-theme-demonic .pcx-card:not(.pcx-card-off) { border: 1px solid #c8293e; box-shadow: inset 0 0 0 1px rgba(214,164,86,0.25), var(--pcx-glow); }

.pcx-theme-scroll { --pcx-bg: #efe0c2; --pcx-bg-panel: #e4cfa7; --pcx-bg-card: linear-gradient(180deg, #fbf2df 0%, #efe0be 100%); --pcx-bg-card-off: #e2cfa8; --pcx-text: #2b190d; --pcx-text-muted: #6e5239; --pcx-accent: #8a1c27; --pcx-accent-2: #8c6218; --pcx-border: #bfa375; --pcx-border-active: #8a1c27; --pcx-glow: 0 4px 14px rgba(72,42,14,0.16); --pcx-font-title: 'Cinzel', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 4px; }
#pcx-window.pcx-theme-scroll { background: radial-gradient(circle at 50% 50%, rgba(255,248,232,0.6) 45%, rgba(150,108,58,0.35) 100%), #efe0c2; border-top: 9px solid #382011; border-bottom: 9px solid #382011; border-left: 2px solid #8c6218; border-right: 2px solid #8c6218; border-radius: 6px 6px 0 0; box-shadow: 0 -10px 42px rgba(20,10,4,0.7); }
.pcx-theme-scroll .pcx-header { background: linear-gradient(180deg, #3a2112 0%, #27150b 100%); border-bottom: 2px solid #9c7121; }
.pcx-theme-scroll .pcx-header .pcx-title-main { color: #f5e6c8; }
.pcx-theme-scroll .pcx-header .pcx-title-sub { color: #d1b17a; }
.pcx-theme-scroll .pcx-header .pcx-crest { color: #e0b35a; }
.pcx-theme-scroll .pcx-header .pcx-icon-btn { color: #f5e6c8; border-color: #78552b; background: rgba(255,255,255,0.06); }
.pcx-theme-scroll .pcx-wing-btn.pcx-active, .pcx-theme-scroll .pcx-primary-btn { color: #fbf2df; }

.pcx-theme-rose { --pcx-bg: #fdf2f6; --pcx-bg-panel: #fae5ee; --pcx-bg-card: linear-gradient(145deg, #ffffff 0%, #fff6fa 100%); --pcx-bg-card-off: #f3dfe7; --pcx-text: #381d2a; --pcx-text-muted: #8c5e74; --pcx-accent: #d44d7e; --pcx-accent-2: #b57464; --pcx-border: #e6bfd0; --pcx-border-active: #db6590; --pcx-glow: 0 5px 18px rgba(212,77,126,0.14); --pcx-font-title: 'Cinzel', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 14px; }
#pcx-window.pcx-theme-rose { background: radial-gradient(circle at 90% 10%, rgba(244,162,194,0.34), transparent 48%), radial-gradient(circle at 10% 85%, rgba(232,186,170,0.28), transparent 50%), #fdf2f6; border-top: 3px solid #db6590; border-left: 1px solid #eccad8; border-right: 1px solid #eccad8; border-radius: 24px 24px 0 0; box-shadow: 0 -10px 38px rgba(130,45,78,0.25); }
.pcx-theme-rose .pcx-header { background: linear-gradient(135deg, #fbe4ee 0%, #f7d4e3 100%); }
.pcx-theme-rose .pcx-tab { border-radius: 999px; }
.pcx-theme-rose .pcx-wing-btn.pcx-active, .pcx-theme-rose .pcx-primary-btn { color: #ffffff; }

.pcx-theme-manga { --pcx-bg: #faf9f5; --pcx-bg-panel: #f1efe8; --pcx-bg-card: #ffffff; --pcx-bg-card-off: #eae8e0; --pcx-text: #161618; --pcx-text-muted: #606066; --pcx-accent: #161618; --pcx-accent-2: #c93b3b; --pcx-border: #c9c6bc; --pcx-border-active: #161618; --pcx-glow: 3px 3px 0px rgba(22,22,24,0.16); --pcx-font-title: 'Montserrat', system-ui, sans-serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 2px; }
#pcx-window.pcx-theme-manga { background-color: #faf9f5; border-top: 3.5px solid #161618; border-left: 2px solid #161618; border-right: 2px solid #161618; box-shadow: 0 -10px 30px rgba(0,0,0,0.32); }
.pcx-theme-manga .pcx-header { background: #ffffff; border-bottom: none; }
.pcx-theme-manga .pcx-card:not(.pcx-card-off) { border: 1.8px solid #161618; }
.pcx-theme-manga .pcx-wing-btn.pcx-active { color: #ffffff; }
.pcx-theme-manga .pcx-primary-btn { background: #c93b3b; border-color: #161618; color: #ffffff; }

.pcx-theme-notebook { --pcx-bg: #f6efe0; --pcx-bg-panel: #ede2cb; --pcx-bg-card: #fffdf8; --pcx-bg-card-off: #e8dec8; --pcx-text: #2b211c; --pcx-text-muted: #786652; --pcx-accent: #b84a27; --pcx-accent-2: #2b6e58; --pcx-border: #d1bfa1; --pcx-border-active: #b84a27; --pcx-glow: 0 3px 10px rgba(70,45,20,0.11); --pcx-font-title: 'Caveat', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 8px; }
#pcx-window.pcx-theme-notebook { background-color: #f6efe0; background-image: linear-gradient(90deg, transparent 26px, rgba(205,80,70,0.25) 26px, rgba(205,80,70,0.25) 27.5px, transparent 27.5px), repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(135,115,90,0.13) 28px); background-size: 100% 100%, 100% 28px; border-top: 6px solid #352318; border-radius: 16px 16px 0 0; box-shadow: 0 -10px 35px rgba(0,0,0,0.48); }
.pcx-theme-notebook .pcx-header { background: #3b271b; border-bottom: none; }
.pcx-theme-notebook .pcx-header .pcx-title-main { color: #f8efe0; font-size: 20px; }
.pcx-theme-notebook .pcx-header .pcx-title-sub { color: #ccb69b; }
.pcx-theme-notebook .pcx-header .pcx-icon-btn { color: #f8efe0; border-color: #6b4e3b; }
.pcx-theme-notebook .pcx-wing-btn.pcx-active, .pcx-theme-notebook .pcx-primary-btn { color: #fffdf8; }

.pcx-theme-celestial { --pcx-bg: #0b0f22; --pcx-bg-panel: #121836; --pcx-bg-card: linear-gradient(135deg, rgba(32,42,86,0.9), rgba(16,21,46,0.95)); --pcx-bg-card-off: rgba(15,19,38,0.65); --pcx-text: #eef1ff; --pcx-text-muted: #8b95c9; --pcx-accent: #f0c674; --pcx-accent-2: #7aa2f7; --pcx-border: rgba(240,198,116,0.25); --pcx-border-active: #f0c674; --pcx-glow: 0 4px 20px rgba(240,198,116,0.16); --pcx-font-title: 'Cinzel', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 12px; }
#pcx-window.pcx-theme-celestial { background: radial-gradient(circle at 20% 10%, rgba(122,162,247,0.2), transparent 48%), radial-gradient(circle at 85% 85%, rgba(240,198,116,0.12), transparent 48%), #0b0f22; border-top: 2px solid rgba(240,198,116,0.75); border-radius: 20px 20px 0 0; box-shadow: 0 -8px 42px rgba(5,8,24,0.88); }

.pcx-theme-cyber { --pcx-bg: #060912; --pcx-bg-panel: #0b1122; --pcx-bg-card: linear-gradient(135deg, #0f1933 0%, #080d1b 100%); --pcx-bg-card-off: #090c18; --pcx-text: #e2f8ff; --pcx-text-muted: #5d7a99; --pcx-accent: #00f0ff; --pcx-accent-2: #ff2a6d; --pcx-border: #173452; --pcx-border-active: #00f0ff; --pcx-glow: 0 4px 18px rgba(0,240,255,0.2); --pcx-font-title: 'JetBrains Mono', monospace; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 2px; }
#pcx-window.pcx-theme-cyber { background: linear-gradient(rgba(0,240,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.025) 1px, transparent 1px), #060912; background-size: 24px 24px; border-top: 2px solid #00f0ff; clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%); box-shadow: 0 -6px 34px rgba(0,0,0,0.8); }
.pcx-theme-cyber .pcx-card { clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%); }

.pcx-theme-velvet { --pcx-bg: #110815; --pcx-bg-panel: #1b0e22; --pcx-bg-card: linear-gradient(145deg, #271332 0%, #170a1e 100%); --pcx-bg-card-off: #140a1a; --pcx-text: #f9edf6; --pcx-text-muted: #b594ad; --pcx-accent: #e05297; --pcx-accent-2: #e8c382; --pcx-border: #4a2346; --pcx-border-active: #e8c382; --pcx-glow: 0 6px 24px rgba(224,82,151,0.2); --pcx-font-title: 'Cinzel', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 12px; }
#pcx-window.pcx-theme-velvet { background: radial-gradient(circle at 80% 8%, rgba(224,82,151,0.22), transparent 50%), radial-gradient(circle at 15% 90%, rgba(232,195,130,0.12), transparent 50%), #110815; border-top: 2.5px solid #e8c382; border-left: 1px solid #4a2346; border-right: 1px solid #4a2346; border-radius: 18px 18px 0 0; box-shadow: 0 -10px 44px rgba(0,0,0,0.86); }
.pcx-theme-velvet .pcx-card:not(.pcx-card-off) { border: 1px solid rgba(232,195,130,0.42); }
.pcx-theme-velvet .pcx-wing-btn.pcx-active, .pcx-theme-velvet .pcx-primary-btn { color: #190714; }

.pcx-theme-apothecary { --pcx-bg: #081310; --pcx-bg-panel: #0f201b; --pcx-bg-card: linear-gradient(155deg, #152c25 0%, #0b1915 100%); --pcx-bg-card-off: #0c1814; --pcx-text: #e9f7f1; --pcx-text-muted: #84ab9c; --pcx-accent: #38d399; --pcx-accent-2: #d4a853; --pcx-border: #1f4237; --pcx-border-active: #38d399; --pcx-glow: 0 5px 20px rgba(56,211,153,0.16); --pcx-font-title: 'Cinzel', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 8px; }
#pcx-window.pcx-theme-apothecary { background: radial-gradient(ellipse at 20% 0%, rgba(56,211,153,0.16), transparent 52%), radial-gradient(ellipse at 85% 95%, rgba(212,168,83,0.13), transparent 48%), #081310; border-top: 2.5px solid #d4a853; border-left: 1px solid #1f4237; border-right: 1px solid #1f4237; border-radius: 14px 14px 0 0; box-shadow: 0 -10px 42px rgba(0,0,0,0.85); }
.pcx-theme-apothecary .pcx-card:not(.pcx-card-off) { border-left: 3px solid #d4a853; }

.pcx-theme-olympus { --pcx-bg: #f5f1e8; --pcx-bg-panel: #ebe4d5; --pcx-bg-card: linear-gradient(180deg, #ffffff 0%, #f7f3ea 100%); --pcx-bg-card-off: #e6dfd0; --pcx-text: #1f242d; --pcx-text-muted: #686b73; --pcx-accent: #a87924; --pcx-accent-2: #264e70; --pcx-border: #cfc4ae; --pcx-border-active: #a87924; --pcx-glow: 0 4px 14px rgba(45,35,18,0.1); --pcx-font-title: 'Cinzel', Georgia, serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 6px; }
#pcx-window.pcx-theme-olympus { background: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.85), rgba(226,216,197,0.45)), #f5f1e8; border-top: 4px solid #a87924; border-left: 1px solid #c9bc9f; border-right: 1px solid #c9bc9f; border-radius: 14px 14px 0 0; box-shadow: 0 -10px 36px rgba(20,18,14,0.42); }
.pcx-theme-olympus .pcx-wing-btn.pcx-active, .pcx-theme-olympus .pcx-primary-btn, .pcx-theme-olympus .pcx-scope-btn.pcx-active { color: #fffdf9; }

.pcx-theme-abyss { --pcx-bg: #040d15; --pcx-bg-panel: #081826; --pcx-bg-card: linear-gradient(150deg, #0d2538 0%, #06131f 100%); --pcx-bg-card-off: #06111b; --pcx-text: #e4f5fc; --pcx-text-muted: #6f9cb3; --pcx-accent: #22d3ee; --pcx-accent-2: #f59e0b; --pcx-border: #143952; --pcx-border-active: #22d3ee; --pcx-glow: 0 5px 22px rgba(34,211,238,0.18); --pcx-font-title: 'Montserrat', system-ui, sans-serif; --pcx-font-body: 'Montserrat', system-ui, sans-serif; --pcx-font-mono: 'JetBrains Mono', monospace; --pcx-radius: 11px; }
#pcx-window.pcx-theme-abyss { background: radial-gradient(circle at 50% -10%, rgba(34,211,238,0.22), transparent 55%), radial-gradient(circle at 85% 100%, rgba(14,116,144,0.24), transparent 52%), #040d15; border-top: 2px solid #22d3ee; border-left: 1px solid #143952; border-right: 1px solid #143952; border-radius: 18px 18px 0 0; box-shadow: 0 -10px 44px rgba(0,0,0,0.88); }

/* MOBILE-SAFE HEADER: FULL THEME NAME + BETA NEVER CHOPPED! */
.pcx-header { padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--pcx-border); background: var(--pcx-bg-panel); flex-shrink: 0; }
.pcx-header-left { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1; }
.pcx-crest { width: 34px; height: 34px; flex-shrink: 0; color: var(--pcx-accent); display: flex; align-items: center; justify-content: center; }
.pcx-crest svg { width: 32px; height: 32px; }
.pcx-title-wrap { min-width: 0; flex: 1; }
.pcx-title-main { font-family: var(--pcx-font-title); font-size: 14px; font-weight: 700; color: var(--pcx-text); display: flex; align-items: center; gap: 6px; min-width: 0; }
.pcx-title-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcx-title-sub { font-family: var(--pcx-font-mono); font-size: 9px; color: var(--pcx-text-muted); letter-spacing: 0.6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcx-header-actions { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.pcx-icon-btn { height: 33px; padding: 0 9px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-border); background: rgba(128,128,128,0.07); color: var(--pcx-text); display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 11.5px; font-weight: 600; cursor: pointer; }
.pcx-icon-btn.pcx-sq-btn { width: 33px; padding: 0; }
.pcx-icon-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
.pcx-icon-btn.pcx-active, .pcx-icon-btn:hover { border-color: var(--pcx-accent); color: var(--pcx-accent); }

.pcx-theme-strip { display: none; padding: 8px 12px; background: var(--pcx-bg-panel); border-bottom: 1px solid var(--pcx-border); gap: 6px; overflow-x: auto; flex-shrink: 0; scrollbar-width: none; }
.pcx-theme-strip::-webkit-scrollbar { display: none; }
.pcx-theme-strip.pcx-show { display: flex; }
.pcx-theme-pill { padding: 6px 11px; border-radius: 999px; border: 1px solid var(--pcx-border); background: rgba(128,128,128,0.06); color: var(--pcx-text-muted); font-size: 11.5px; font-weight: 600; white-space: nowrap; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.pcx-theme-pill.pcx-active { border-color: var(--pcx-accent); color: var(--pcx-text); }
.pcx-theme-dot { width: 8px; height: 8px; border-radius: 50%; }

.pcx-nav-wrap { padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--pcx-border); background: var(--pcx-bg-panel); flex-shrink: 0; }
.pcx-nav-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
.pcx-scope-group { display: inline-flex; align-items: center; gap: 4px; }
.pcx-scope-switch { display: inline-flex; border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); overflow: hidden; }
.pcx-scope-btn { padding: 5px 10px; font-size: 11.5px; font-weight: 600; background: transparent; color: var(--pcx-text-muted); border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
.pcx-scope-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pcx-scope-btn svg { width: 13px; height: 13px; }
.pcx-scope-btn.pcx-active { background: var(--pcx-accent); color: #0b110f; font-weight: 700; }
.pcx-route-chip { height: 28px; padding: 0 10px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-border-active); background: rgba(128,128,128,0.1); color: var(--pcx-text); font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.pcx-route-chip svg { width: 13px; height: 13px; color: var(--pcx-accent); }

.pcx-tabs-bar { display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; scroll-behavior: auto; }
.pcx-tabs-bar::-webkit-scrollbar { display: none; }
.pcx-add-tab-pill { height: 31px; padding: 0 10px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-accent); background: transparent; color: var(--pcx-accent); font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.pcx-add-tab-pill svg { width: 14px; height: 14px; }
.pcx-tab { height: 31px; padding: 0 12px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-border); background: var(--pcx-bg); color: var(--pcx-text-muted); font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.pcx-tab.pcx-active { border-color: var(--pcx-border-active); color: var(--pcx-text); background: var(--pcx-bg-card); }
.pcx-tab.pcx-tab-muted { opacity: 0.45; text-decoration: line-through; }
.pcx-tab.pcx-tab-dragging { border-color: var(--pcx-accent) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.5); transform: scale(1.05); z-index: 25; }
.pcx-tab-count { font-family: var(--pcx-font-mono); font-size: 10px; padding: 1px 5px; border-radius: 4px; background: rgba(128,128,128,0.16); color: var(--pcx-accent); }

.pcx-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.pcx-subbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--pcx-text-muted); padding: 0 2px; }
.pcx-mini-btn { height: 27px; padding: 0 9px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-border); background: transparent; color: var(--pcx-text-muted); font-size: 11px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }
.pcx-mini-btn svg { width: 13px; height: 13px; }
.pcx-mini-btn:hover, .pcx-mini-btn.pcx-active { border-color: var(--pcx-accent); color: var(--pcx-text); }

.pcx-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 12px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-border); background: var(--pcx-bg); cursor: pointer; }
.pcx-toggle-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.pcx-toggle-row-title { font-size: 12.5px; font-weight: 700; color: var(--pcx-text); display: flex; align-items: center; flex-wrap: wrap; }
.pcx-toggle-row-sub { font-size: 11px; color: var(--pcx-text-muted); line-height: 1.35; }
.pcx-switch { width: 38px; height: 21px; border-radius: 12px; border: 1px solid var(--pcx-border-active); background: rgba(128,128,128,0.2); position: relative; cursor: pointer; flex-shrink: 0; }
.pcx-switch::after { content: ''; position: absolute; top: 2.5px; left: 2.5px; width: 14px; height: 14px; border-radius: 50%; background: var(--pcx-text-muted); transition: transform 0.18s ease, background 0.18s ease; }
.pcx-switch.pcx-on { border-color: var(--pcx-accent); }
.pcx-switch.pcx-on::after { transform: translateX(17px); background: var(--pcx-accent); }

.pcx-card { position: relative; background: var(--pcx-bg-card); border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); padding: 10px 12px; box-shadow: var(--pcx-glow); display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; }
.pcx-card.pcx-collapsed { padding: 8px 12px; gap: 0; }
.pcx-card:not(.pcx-card-off) { border-color: var(--pcx-border-active); }
.pcx-card.pcx-card-off { background: var(--pcx-bg-card-off); box-shadow: none; opacity: 0.58; }
.pcx-drag-placeholder { border: 2px dashed var(--pcx-accent) !important; border-radius: var(--pcx-radius); background: rgba(128,128,128,0.08); box-sizing: border-box; flex-shrink: 0; }
.pcx-card-floating { position: fixed !important; z-index: 2147483647 !important; pointer-events: none !important; margin: 0 !important; box-shadow: 0 16px 38px rgba(0,0,0,0.6) !important; opacity: 0.95 !important; will-change: transform; }
.pcx-card-grip { width: 26px; height: 28px; margin: -4px 0 -4px -6px; display: inline-flex; align-items: center; justify-content: center; color: var(--pcx-text-muted); cursor: grab; touch-action: none !important; user-select: none !important; -webkit-user-select: none !important; -webkit-touch-callout: none !important; flex-shrink: 0; }
.pcx-card-grip svg { width: 15px; height: 21px; pointer-events: none; }
.pcx-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.pcx-card-title-group { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.pcx-card-title { font-weight: 700; font-size: 13.5px; color: var(--pcx-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; flex: 1; }
.pcx-collapse-btn { width: 26px; height: 26px; padding: 0; border: none; background: transparent; color: var(--pcx-text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.pcx-collapse-btn svg { width: 16px; height: 16px; }
.pcx-prio-badge { font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(128,128,128,0.14); color: var(--pcx-accent-2); flex-shrink: 0; }
.pcx-card-content { font-size: 13.5px; line-height: 1.54; color: var(--pcx-text); white-space: pre-wrap; word-break: break-word; max-height: 260px; overflow-y: auto; }
.pcx-card-footer { display: flex; align-items: center; justify-content: flex-end; padding-top: 6px; border-top: 1px solid rgba(128,128,128,0.14); gap: 6px; flex-wrap: wrap; }

.pcx-forge-toolbar { display: flex; flex-direction: column; gap: 8px; }
.pcx-forge-toprow { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

.pcx-hub-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
@media (min-width: 480px) { .pcx-hub-grid { grid-template-columns: 1fr 1fr; } }
.pcx-hub-card { background: var(--pcx-bg); border: 1.5px solid var(--pcx-border); border-radius: var(--pcx-radius); padding: 13px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; text-align: left; color: var(--pcx-text); transition: border-color 0.15s ease, transform 0.12s ease; }
.pcx-hub-card:hover { border-color: var(--pcx-accent); transform: translateY(-1px); }
.pcx-hub-card-head { display: flex; align-items: center; gap: 9px; font-size: 13.5px; font-weight: 800; color: var(--pcx-text); }
.pcx-hub-card-head svg { width: 20px; height: 20px; color: var(--pcx-accent); flex-shrink: 0; }
.pcx-hub-card-desc { font-size: 11.5px; line-height: 1.45; color: var(--pcx-text-muted); }

.pcx-book-grid { display: grid; grid-template-columns: 1fr; gap: 11px; }
@media (min-width: 520px) { .pcx-book-grid { grid-template-columns: 1fr 1fr; } }
.pcx-tome-card { position: relative; background: var(--pcx-bg-panel); border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); padding: 11px; display: flex; flex-direction: column; gap: 9px; box-sizing: border-box; transition: border-color 0.16s ease, box-shadow 0.16s ease; }
.pcx-tome-card.pcx-book-bound { border-color: var(--pcx-accent); box-shadow: var(--pcx-glow); }
.pcx-tome-main { display: flex; gap: 12px; align-items: stretch; min-width: 0; }
.pcx-book-cover { width: 68px; height: 96px; border-radius: 4px 8px 8px 4px; border: 1px solid var(--pcx-border); border-left: 4px solid var(--pcx-accent); background: linear-gradient(145deg, rgba(128,128,128,0.16), rgba(0,0,0,0.22)), var(--pcx-bg); overflow: hidden; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--pcx-accent); position: relative; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.28); }
.pcx-book-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pcx-book-cover svg { width: 26px; height: 26px; opacity: 0.85; }
.pcx-cover-hint { position: absolute; inset: auto 0 0 0; padding: 2px 3px; background: rgba(0,0,0,0.68); color: #fff; font-size: 8.5px; font-weight: 700; text-align: center; letter-spacing: 0.3px; opacity: 0.88; }
.pcx-book-info { display: flex; flex-direction: column; justify-content: space-between; gap: 6px; min-width: 0; flex: 1; }
.pcx-book-title { font-family: var(--pcx-font-title); font-weight: 800; font-size: 13.5px; line-height: 1.28; color: var(--pcx-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; cursor: pointer; }
.pcx-book-meta { font-family: var(--pcx-font-mono); font-size: 10px; color: var(--pcx-text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pcx-bind-strip { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.pcx-bind-pill { height: 25px; padding: 0 8px; border-radius: 999px; border: 1px solid var(--pcx-border); background: var(--pcx-bg); color: var(--pcx-text-muted); font-size: 10.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.14s ease; }
.pcx-bind-pill svg { width: 11.5px; height: 11.5px; flex-shrink: 0; }
.pcx-bind-pill:hover { border-color: var(--pcx-accent); color: var(--pcx-text); }
.pcx-bind-pill.pcx-on { background: var(--pcx-accent); border-color: var(--pcx-accent); color: #0b110f; }
.pcx-theme-scroll .pcx-bind-pill.pcx-on, .pcx-theme-rose .pcx-bind-pill.pcx-on, .pcx-theme-manga .pcx-bind-pill.pcx-on, .pcx-theme-notebook .pcx-bind-pill.pcx-on { color: #ffffff; }
.pcx-bind-pill:disabled { opacity: 0.38; cursor: not-allowed; }
.pcx-tome-footer { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 7px; border-top: 1px solid rgba(128,128,128,0.15); }

.pcx-key-chips { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.pcx-key-chip { font-family: var(--pcx-font-mono); font-size: 10.5px; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--pcx-border); background: rgba(128,128,128,0.1); color: var(--pcx-text); display: inline-flex; align-items: center; gap: 4px; }
.pcx-key-chip.pcx-key-hit { border-color: var(--pcx-accent); background: rgba(29,233,182,0.14); color: var(--pcx-accent); font-weight: 700; }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-key-chip { color: #15201d; border-color: #b7c2bc; background: rgba(0,0,0,0.05); }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-key-chip.pcx-key-hit { background: #111615; color: #1de9b6; border-color: #111615; }
.pcx-scan-bar { font-size: 11px; line-height: 1.38; padding: 5px 9px; border-radius: var(--pcx-radius); background: rgba(128,128,128,0.09); color: var(--pcx-text-muted); display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
.pcx-scan-bar.pcx-scan-live { border-left: 3px solid var(--pcx-accent); color: var(--pcx-text); }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-scan-bar { color: #36443f; background: rgba(0,0,0,0.055); }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-scan-bar.pcx-scan-live { color: #0f1715; border-left-color: #111615; font-weight: 600; }

.pcx-rec-panel { background: var(--pcx-bg); border: 1.5px solid var(--pcx-border-active); border-radius: var(--pcx-radius); padding: 11px 12px; display: flex; flex-direction: column; gap: 9px; }
.pcx-rec-item { font-size: 11.5px; line-height: 1.42; padding: 6px 9px; border-radius: var(--pcx-radius); background: rgba(128,128,128,0.09); color: var(--pcx-text); }
.pcx-rec-item.pcx-rec-danger { border-left: 3px solid var(--pcx-accent-2); background: rgba(230, 80, 80, 0.11); }
.pcx-rec-note { font-size: 11px; line-height: 1.36; padding: 4px 8px; border-radius: var(--pcx-radius); border-left: 2.5px solid var(--pcx-accent-2); background: rgba(128,128,128,0.08); color: var(--pcx-text); }
.pcx-theme-krakoa .pcx-card:not(.pcx-card-off) .pcx-rec-note { color: #1a2421; background: rgba(217,155,67,0.16); border-left-color: #b97a38; }
.pcx-preset-bar { display: flex; align-items: flex-end; gap: 8px; }
.pcx-preset-bar > div { flex: 1; min-width: 0; }

.pcx-check-grid { display: flex; flex-direction: column; gap: 6px; }
.pcx-check-item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-border); background: var(--pcx-bg); font-size: 12px; cursor: pointer; }

.pcx-att-list { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }
.pcx-att-img-wrap { position: relative; width: 72px; height: 72px; border-radius: 6px; overflow: hidden; border: 1px solid var(--pcx-border); cursor: pointer; flex-shrink: 0; }
.pcx-att-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pcx-att-del { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.72); color: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.pcx-att-del svg { width: 11px; height: 11px; }
.pcx-att-doc { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 7px 10px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-border); background: rgba(128,128,128,0.08); font-size: 11.5px; flex-wrap: wrap; }
.pcx-att-doc-left { display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1; }
.pcx-att-doc-left svg { width: 15px; height: 15px; flex-shrink: 0; color: var(--pcx-accent-2); }
.pcx-att-doc-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pcx-spoiler { border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); background: var(--pcx-bg); overflow: hidden; }
.pcx-spoiler summary { padding: 11px 13px; font-size: 13px; font-weight: 700; color: var(--pcx-accent); cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pcx-spoiler summary::-webkit-details-marker { display: none; }
.pcx-spoiler-body { padding: 11px 13px; border-top: 1px solid var(--pcx-border); display: flex; flex-direction: column; gap: 9px; font-size: 12.5px; line-height: 1.54; color: var(--pcx-text); }

.pcx-ai-studio { padding: 12px; border-radius: var(--pcx-radius); border: 1.5px solid var(--pcx-accent); background: var(--pcx-bg); display: flex; flex-direction: column; gap: 10px; }
.pcx-ai-ver-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--pcx-border); }
.pcx-panel-box { background: var(--pcx-bg-panel); border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); padding: 14px; display: flex; flex-direction: column; gap: 11px; }
.pcx-mode-tabs { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); overflow: hidden; }
.pcx-mode-tab { height: 36px; border: none; background: transparent; color: var(--pcx-text-muted); font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
.pcx-mode-tab svg { width: 14px; height: 14px; }
.pcx-mode-tab.pcx-active { background: var(--pcx-accent); color: #0b110f; }
.pcx-field-label { font-size: 11.5px; font-weight: 600; color: var(--pcx-text-muted); margin-bottom: 5px; display: flex; align-items: center; }

#pcx-window input.pcx-input, #pcx-window select.pcx-select { width: 100% !important; height: 38px !important; min-height: 38px !important; max-height: 38px !important; margin: 0 !important; padding: 0 10px !important; box-sizing: border-box !important; background-color: var(--pcx-bg) !important; color: var(--pcx-text) !important; border: 1px solid var(--pcx-border) !important; border-radius: var(--pcx-radius) !important; font-family: var(--pcx-font-body) !important; font-size: 13px !important; line-height: 36px !important; }
#pcx-window textarea.pcx-textarea { width: 100% !important; margin: 0 !important; padding: 10px !important; box-sizing: border-box !important; background-color: var(--pcx-bg) !important; color: var(--pcx-text) !important; border: 1px solid var(--pcx-border) !important; border-radius: var(--pcx-radius) !important; font-family: var(--pcx-font-body) !important; font-size: 13.5px !important; line-height: 1.5 !important; min-height: 105px; resize: vertical; }
#pcx-window textarea.pcx-mono-area { font-family: var(--pcx-font-mono) !important; font-size: 12px !important; }
.pcx-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; }
.pcx-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: end; }

.pcx-primary-btn { height: 38px; padding: 0 16px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-accent); background: var(--pcx-accent); color: #0b110f; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
.pcx-primary-btn:disabled { opacity: 0.55; cursor: wait; }
.pcx-primary-btn svg { width: 15px; height: 15px; }
.pcx-secondary-btn { height: 36px; padding: 0 13px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-accent-2); background: transparent; color: var(--pcx-accent-2); font-weight: 700; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.pcx-secondary-btn:disabled { opacity: 0.55; cursor: wait; }
.pcx-secondary-btn svg { width: 15px; height: 15px; }
.pcx-macro-chip { font-family: var(--pcx-font-mono); font-size: 12px; padding: 7px 12px; border-radius: var(--pcx-radius); border: 1px solid var(--pcx-accent); background: rgba(128,128,128,0.08); color: var(--pcx-accent); cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.pcx-macro-chip svg { width: 14px; height: 14px; }
.pcx-preview-box { font-family: var(--pcx-font-mono); font-size: 11.5px; padding: 10px; border-radius: var(--pcx-radius); background: var(--pcx-bg); border: 1px solid var(--pcx-border); color: var(--pcx-text); white-space: pre-wrap; max-height: 165px; overflow-y: auto; }
.pcx-footer { padding: 10px 14px; border-top: 1px solid var(--pcx-border); background: var(--pcx-bg-panel); display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0; }
.pcx-empty { text-align: center; padding: 32px 18px; color: var(--pcx-text-muted); font-size: 13px; line-height: 1.55; border: 1px solid var(--pcx-border); border-radius: var(--pcx-radius); background: var(--pcx-bg-panel); }
#pcx-lightbox { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; padding: 16px; cursor: zoom-out; }
#pcx-lightbox img { max-width: 96vw; max-height: 90dvh; border-radius: 8px; object-fit: contain; }
`;
