export const THEMES = [
    { id: 'tavern', name: 'Тема Таверны', nameEn: 'Tavern Sync', sub: 'СИНХРОНИЗАЦИЯ С ТАВЕРНОЙ', subEn: 'TAVERN THEME SYNC', color: '#9ca3af' },
    { id: 'celestial', name: 'Гравюра Доре', nameEn: 'Gustave Doré', sub: 'ЗОЛОТО И УГОЛЬ', subEn: 'CHARCOAL & GOLD', color: '#c5a065' },
    { id: 'notebook', name: 'Бумага и Шалфей', nameEn: 'Paper & Sage', sub: 'ТЕТРАДЬ АВТОРА', subEn: 'AUTHOR NOTEBOOK', color: '#466352' },
    { id: 'krakoa', name: 'Люди Икс: Кракоа', nameEn: 'X-Men: Krakoa', sub: 'БИОАРХИВ КРАКОА', subEn: 'KRAKOA ARCHIVE', color: '#5b9a86' },
    { id: 'demonic', name: 'Демонический Гримуар', nameEn: 'Demonic Grimoire', sub: 'КОДЕКС БЕЗДНЫ', subEn: 'ABYSSAL CODEX', color: '#b4545f' },
    { id: 'scroll', name: 'Средневековый Свиток', nameEn: 'Royal Scroll', sub: 'КОРОЛЕВСКИЙ ПЕРГАМЕНТ', subEn: 'ROYAL PARCHMENT', color: '#8c383e' },
    { id: 'rose', name: 'Розовый Кварц', nameEn: 'Rose Quartz', sub: 'ФАРФОРОВАЯ КАМЕЛИЯ', subEn: 'PORCELAIN CAMELLIA', color: '#a85c74' },
    { id: 'manga', name: 'Манга-редакция', nameEn: 'Manga Edition', sub: 'ЧИСТЫЙ ТОМИК', subEn: 'INK VOLUME', color: '#a84644' },
    { id: 'cyber', name: 'Тихая Сталь', nameEn: 'Quiet Slate', sub: 'ИНЖЕНЕРНЫЙ ЖУРНАЛ', subEn: 'SLATE LEDGER', color: '#5f95ba' },
    { id: 'velvet', name: 'Полуночный Бархат', nameEn: 'Nocturne Velvet', sub: 'ГОТИЧЕСКИЙ САЛОН', subEn: 'GOTHIC SALON', color: '#a86d8c' },
    { id: 'apothecary', name: 'Изумрудный Гербарий', nameEn: 'Emerald Apothecary', sub: 'АЛХИМИЧЕСКИЙ АРХИВ', subEn: 'ALCHEMICAL HERRIBARIUM', color: '#5e997e' },
    { id: 'olympus', name: 'Мрамор и Золото', nameEn: 'Gilded Marble', sub: 'ЗАЛЫ ОЛИМПА', subEn: 'HALLS OF OLYMPUS', color: '#9c7838' },
    { id: 'abyss', name: 'Океаническая Бездна', nameEn: 'Abyssal Trench', sub: 'ГЛУБИННЫЙ АРХИВ', subEn: 'DEEP SEA ARCHIVE', color: '#5697ab' },
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
    scope: '«Тетрадь этого чата» хранит заметки только для открытого сейчас персонажа. «Общая тетрадь автора» хранит сквозные правила и заметки для всех чатов.',
    sec_header: 'Управляет тем, как оглавление раздела («### Название») и подзаголовки карточек подаются нейросети. Все заголовки автоматически отделяются чистой пустой строкой-отступом.',
    sec_pos: 'Индивидуальный маршрут этого раздела: внутрь переписки («@ Depth»), до/после промпта персонажа, в макрос {{notebook}} или «Никуда» (личная черновая вкладка).',
    sec_depth: 'Глубина 0 — самый низ после последней реплики (сильнее всего влияет на ответ). Глубина 4–10 — мягкое фоновое напоминание выше по истории.',
    sec_role: 'От чьего лица подаётся запись: «System» — голос режиссёра за кадром. «User» — от лица игрока. «Assistant» — от лица персонажа.',
    note_title_inc: 'Если включено — название карточки станет аккуратным подзаголовком отдельной строкой с отступом над текстом.',
    note_strict: 'Добавляет метку [ВАЖНО], чтобы модель уделяла этому пункту повышенное внимание.',
    ai_words: 'Желаемый объём текста в словах. Значение 0 снимает ограничения по длине.',
    ai_radius: 'Сколько последних полных сообщений чата прочитает Соавтор. Значение 0 отключает чтение переписки.',
    macro_info: 'Скопируйте {{notebook}} и вставьте в пресет — туда соберутся все разделы со статусом «В макрос».',
    forge_shelf: 'Библиотека всех Лорбуков Таверны! Включайте книги В чат, Глобально или К персонажу прямо на обложке.',
    forge_mode: '«Прямой перенос без ИИ» копирует записи как есть. «Дословно + ключи от ИИ» сохраняет ваш текст буква в букву и подбирает только триггеры. «С Соавтором ИИ» создаёт новые страницы мира.',
    forge_trig: '«По ключам» — страница просыпается при упоминании ключевых слов в чате. «Постоянно» — активна всегда. «Векторизация» — поиск по смыслу через Vector Storage.',
    forge_scope: '«Глобально» синхронизируется с главным меню Мира Таверны. «Чат» привязывает книгу к текущему диалогу (можно несколько книг сразу). «Чар» закрепляет основной Лорбук за карточкой героя.',
    forge_page_ai: 'Выберите пресет (или свой сохранённый шаблон) и напишите любую задумку страницы — Соавтор создаст статью и подберёт ключи.',
    forge_recursion: 'Рекурсия возникает, когда текст одной проснувшейся страницы содержит ключевое слово другой и будит её по цепочке. Инспектор находит взаимные петли и изолирует их в один клик.',
    forge_words: 'Объём каждой генерируемой страницы Лорбука в словах и желаемое число страниц.',
    memory_books: 'Показывает целевой Лорбук для расширения Memory Books. Нажмите плашку «Memory Books» на томе, чтобы направить запись памяти чата в него.',
};

export const HELP_TIPS_EN = {
    scope: '"Chat Notebook" stores notes only for the active character. "Global Notebook" stores cross-chat notes and author rules.',
    sec_header: 'Controls section headings ("### Section") and note subheaders with clean blank-line spacing.',
    sec_pos: 'Independent route for this section: inside chat history ("@ Depth"), before/after character prompt, into {{notebook}} macro, or "Nowhere" (private draft).',
    sec_depth: 'Depth 0 is right after the latest message. Depth 4–10 is a gentle background reminder higher up.',
    sec_role: 'System acts as narrator/director. User speaks as player; Assistant speaks as character.',
    note_title_inc: 'When enabled, the note title becomes a standalone subheader above the note body.',
    note_strict: 'Adds an [IMPORTANT] tag so the model prioritizes this rule.',
    ai_words: 'Target word range. Set 0 for no word limit.',
    ai_radius: 'Number of recent chat messages read by Co-Author. 0 disables chat reading.',
    macro_info: 'Copy {{notebook}} into your preset to collect all sections routed to Macro.',
    forge_shelf: 'All SillyTavern Lorebooks! Toggle Chat, Global, or Character bindings right on each cover.',
    forge_mode: 'Direct copy without AI, verbatim text + AI keys, or full AI worldbuilding.',
    forge_trig: 'By Keys wakes up on keyword match; Constant stays active; Vector uses ST Vector Storage.',
    forge_scope: 'Global syncs with ST World Info selector; Chat binds multiple books to current chat; Char binds to character card.',
    forge_page_ai: 'Pick a preset (or your own saved preset) and describe any page idea.',
    forge_recursion: 'Recursion happens when one activated entry triggers another entry via keywords. Isolate loops in 1 click.',
    forge_words: 'Target word range per Lorebook page and desired page count.',
    memory_books: 'Shows which Lorebook currently receives memories generated by Memory Books.',
};

export const ICONS = {
    home: `<svg class="pcx-ico" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>`,
    book: `<svg class="pcx-ico" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h11a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 7h7M8 11h7M8 15h4"/></svg>`,
    shelf: `<svg class="pcx-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A1.5 1.5 0 0 1 5.5 3h3A1.5 1.5 0 0 1 10 4.5v15"/><path d="M10 19.5v-13A1.5 1.5 0 0 1 11.5 5h3A1.5 1.5 0 0 1 16 6.5v13"/><path d="M3 19.5h18"/></svg>`,
    forge: `<svg class="pcx-ico" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17h12M8 17l1-5h6l1 5"/><path d="M4 9h16l-1.5 3h-13L4 9z"/><path d="M12 4v5M5 20h14"/></svg>`,
    gear: `<svg class="pcx-ico" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.02 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    terminal: `<svg class="pcx-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    lock: `<svg class="pcx-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
    memory: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.4 4.8 3.5 6V19a1.5 1.5 0 0 0 1.5 1.5h4A1.5 1.5 0 0 0 15.5 19v-3c2.1-1.2 3.5-3.4 3.5-6a7 7 0 0 0-7-7z"/><path d="M9.5 10.5h5M12 8v5"/></svg>`,
    save: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    palette: `<svg class="pcx-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/></svg>`,
    sliders: `<svg class="pcx-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>`,
    close: `<svg class="pcx-ico" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    plus: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    edit: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    trash: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
    copy: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    chat: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    globe: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    spark: `<svg class="pcx-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M18 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z"/></svg>`,
    spinner: `<svg width="16" height="16" class="pcx-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 22a10 10 0 0 1-10-10" opacity="0.3"/></svg>`,
    reset: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`,
    help: `<svg class="pcx-ico" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.4.9-1.4 1.8"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>`,
    grip: `<svg class="pcx-ico" width="14" height="16" viewBox="0 0 16 24" fill="currentColor"><circle cx="5" cy="6" r="1.5"/><circle cx="11" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/><circle cx="11" cy="18" r="1.5"/></svg>`,
    gripSm: `<svg class="pcx-ico" width="10" height="13" viewBox="0 0 12 20" fill="currentColor"><circle cx="3.5" cy="4.5" r="1.3"/><circle cx="8.5" cy="4.5" r="1.3"/><circle cx="3.5" cy="10" r="1.3"/><circle cx="8.5" cy="10" r="1.3"/><circle cx="3.5" cy="15.5" r="1.3"/><circle cx="8.5" cy="15.5" r="1.3"/></svg>`,
    clip: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,
    fileText: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`,
    image: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`,
    vector: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 7.5L11 15.5M15.5 7.5L13 15.5M9 6h6"/></svg>`,
    chevLeft: `<svg class="pcx-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
    chevRight: `<svg class="pcx-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
    chevDown: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
    chevUp: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`,
    user: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    key: `<svg class="pcx-ico" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2"/><path d="M17 6l3 3M14 9l2.5 2.5"/></svg>`,
    layers: `<svg class="pcx-ico" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 18l9 5 9-5"/></svg>`,
    pin: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`,
    loop: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
    align: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="15" y2="10"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="3" y1="20" x2="14" y2="20"/></svg>`,
    template: `<svg class="pcx-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    search: `<svg class="pcx-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7.5"/><line x1="20.5" y1="20.5" x2="16.35" y2="16.35"/></svg>`,
    undo: `<svg class="pcx-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
};

const CREST_BOOK_SVG = `<svg class="pcx-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19"/><path d="M9 7.5h6M9 11h4"/></svg>`;

export const THEME_CRESTS = Object.fromEntries(THEMES.map((t) => [t.id, CREST_BOOK_SVG]));
export const THEME_BANNERS = Object.fromEntries(THEMES.map((t) => [t.id, '']));

const COVER_PALETTES = [
    ['#1d2621', '#c7a46c', '#eef2ed'],
    ['#261c22', '#c89b6e', '#f4ecf0'],
    ['#1b222c', '#b89f6d', '#eaf0f6'],
    ['#28211b', '#cca567', '#f5eee4'],
    ['#1e2725', '#8fb59f', '#ebf3f0'],
    ['#2c1f1e', '#d19c78', '#f6ece9'],
];

function hashSeed(str) {
    let h = 2166136261;
    const s = String(str || 'codex');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
}

// 1:1 Gustave Doré engraved procedural SVG cover from PocketCodex_Atelier_Concept.html
export function renderProceduralCoverSvg({ title = 'Codex', subtitle = 'FORGE', countLabel = '', seed = '' } = {}) {
    const cleanTitle = String(title || 'Codex').trim();
    const pal = COVER_PALETTES[hashSeed(seed || cleanTitle) % COVER_PALETTES.length];
    const [bg, gold, light] = pal;
    const words = cleanTitle.replace(/[^\p{L}\p{N}\s]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
    const initials = (words.slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || cleanTitle.slice(0, 2).toUpperCase() || 'PC')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const footText = (countLabel ? `${countLabel} · ${subtitle}` : subtitle)
        .toUpperCase()
        .slice(0, 26)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<svg class="pcx-cover-svg" width="240" height="318" viewBox="0 0 240 318" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="240" height="318" fill="${bg}"/>
        <rect x="14" y="14" width="212" height="290" rx="4" fill="none" stroke="${gold}" stroke-opacity="0.52" stroke-width="1"/>
        <rect x="20" y="20" width="200" height="278" rx="2" fill="none" stroke="${gold}" stroke-opacity="0.24" stroke-width="1"/>
        <line x1="27" y1="0" x2="27" y2="318" stroke="#000" stroke-opacity="0.32" stroke-width="2"/>
        <circle cx="124" cy="128" r="44" fill="none" stroke="${gold}" stroke-opacity="0.55" stroke-width="1.2"/>
        <path d="M124 76 L132 120 L176 128 L132 136 L124 180 L116 136 L72 128 L116 120 Z" fill="${gold}" fill-opacity="0.22"/>
        <text x="124" y="135" text-anchor="middle" fill="${light}" font-family="Georgia, 'Times New Roman', serif" font-size="21" letter-spacing="3">${initials}</text>
        <line x1="56" y1="220" x2="192" y2="220" stroke="${gold}" stroke-opacity="0.45" stroke-width="1"/>
        <text x="124" y="244" text-anchor="middle" fill="${gold}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="9.5" letter-spacing="1.8">${footText}</text>
    </svg>`;
}

export const SUITE_CSS = `
@keyframes pcxSpinAnim { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.pcx-spin { animation: pcxSpinAnim 0.85s linear infinite; }
body.pcx-dragging-active, body.pcx-dragging-active * {
    user-select: none !important;
    -webkit-user-select: none !important;
    -webkit-touch-callout: none !important;
}

/* SENDBAR & DRAWER LAUNCHERS IN SILLYTAVERN */
#pcx-sendbar-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    padding: 0 4px !important;
    opacity: 0.86;
    touch-action: manipulation;
}
#pcx-sendbar-btn:hover { opacity: 1; }
#pcx-sendbar-btn svg { width: 21px !important; height: 21px !important; display: block; }
#pcx-settings-drawer .pcx-drawer-btn {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 10px !important;
    padding: 10px 14px !important;
    white-space: normal !important;
    line-height: 1.3 !important;
    cursor: pointer !important;
}
#pcx-settings-drawer .pcx-drawer-btn svg { width: 18px !important; height: 18px !important; flex-shrink: 0 !important; }

/* STRICT CLICK-FIGHTING PREVENTION: CLOSED DIALOGS NEVER EXIST IN LAYOUT OR HIT-TESTING */
dialog#pcx-dialog:not([open]),
dialog#pcx-sub-dialog:not([open]) {
    display: none !important;
    pointer-events: none !important;
    visibility: hidden !important;
}

dialog#pcx-dialog {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    outline: none !important;
    background: transparent !important;
    z-index: 2147483640 !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
}
dialog#pcx-dialog[open] {
    display: flex !important;
    align-items: stretch !important;
    justify-content: center !important;
}
dialog#pcx-dialog::backdrop { background: rgba(12, 11, 10, 0.72) !important; }

/* FULL-STUDIO ROOT WINDOW (1:1 PocketCodex_Atelier_Concept.html) */
#pcx-window,
dialog#pcx-sub-dialog {
    --serif: Georgia, "Times New Roman", serif;
    --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    --paper: #161513;
    --panel: #1f1d1a;
    --panel-alt: #272420;
    --ink: #ebe4d8;
    --muted: #9f9688;
    --line: #322e29;
    --line-strong: #474139;
    --accent: #c5a065;
    --accent-ink: #e2c48e;
    --wash: #2a2620;
    --wash-warm: #2f271d;
    --gold-ink: #e0be86;
    --danger: #cf655d;
    --danger-wash: #34201f;
    --active-dot: #76b58c;
    --btn-fg: #161513;
    --shadow: 0 24px 70px rgba(0, 0, 0, 0.58);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 15.5px;
    color: var(--ink);
    background: var(--paper);
}

/* 13 UNIFIED CALM / KIT + GUSTAVE DORE PALETTES (100% sibling match with NexusMatch Forge v2.0.1) */
#pcx-window.pcx-theme-tavern, dialog#pcx-sub-dialog.pcx-theme-tavern {
    --paper: var(--SmartThemeBlurTintColor, #171614);
    --panel: var(--SmartThemeChatTintColor, #201e1b);
    --panel-alt: rgba(128, 128, 128, 0.12);
    --ink: var(--SmartThemeBodyColor, #ebe4d8);
    --muted: var(--SmartThemeEmColor, #9f9688);
    --line: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.14));
    --line-strong: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.24));
    --accent: var(--SmartThemeQuoteColor, #c5a065);
    --accent-ink: var(--SmartThemeQuoteColor, #e2c48e);
    --wash: rgba(128, 128, 128, 0.14);
    --wash-warm: rgba(197, 160, 101, 0.14);
    --gold-ink: var(--SmartThemeQuoteColor, #e0be86);
    --danger: #cf655d;
    --danger-wash: rgba(207, 101, 93, 0.16);
    --active-dot: #65b082;
    --btn-fg: #14120e;
}
#pcx-window.pcx-theme-celestial, dialog#pcx-sub-dialog.pcx-theme-celestial {
    color-scheme: dark;
    --paper: #161513; --panel: #1f1d1a; --panel-alt: #272420;
    --ink: #ebe4d8; --muted: #9f9688; --line: #322e29; --line-strong: #474139;
    --accent: #c5a065; --accent-ink: #e2c48e; --wash: #2a2620; --wash-warm: #2f271d;
    --gold-ink: #e0be86; --danger: #cf655d; --danger-wash: #34201f; --active-dot: #76b58c; --btn-fg: #161513;
}
#pcx-window.pcx-theme-notebook, dialog#pcx-sub-dialog.pcx-theme-notebook {
    color-scheme: light;
    --paper: #f7f4ee; --panel: #fffdf9; --panel-alt: #f0ebe0;
    --ink: #24211d; --muted: #686158; --line: #ded8cc; --line-strong: #c6bdb0;
    --accent: #466352; --accent-ink: #31493b; --wash: #e5ede7; --wash-warm: #f2eadf;
    --gold-ink: #7d5a32; --danger: #9e3a33; --danger-wash: #f7e8e6; --active-dot: #3b7a57; --btn-fg: #fffdf9;
}
#pcx-window.pcx-theme-krakoa, dialog#pcx-sub-dialog.pcx-theme-krakoa {
    color-scheme: dark;
    --paper: #101413; --panel: #151b19; --panel-alt: #1c2421;
    --ink: #eaeee9; --muted: #90a098; --line: #27322e; --line-strong: #394943;
    --accent: #5b9a86; --accent-ink: #84bfa9; --wash: #1d2925; --wash-warm: #27241c;
    --gold-ink: #d4b67e; --danger: #cf655d; --danger-wash: #311d1d; --active-dot: #65b892; --btn-fg: #0c1411;
}
#pcx-window.pcx-theme-demonic, dialog#pcx-sub-dialog.pcx-theme-demonic {
    color-scheme: dark;
    --paper: #130e10; --panel: #1a1316; --panel-alt: #241a1e;
    --ink: #efe7e5; --muted: #a48a8e; --line: #38252b; --line-strong: #50343d;
    --accent: #b4545f; --accent-ink: #de8590; --wash: #2a1c21; --wash-warm: #2c2119;
    --gold-ink: #dab57c; --danger: #dc6d65; --danger-wash: #381d1d; --active-dot: #6eb389; --btn-fg: #fcf6f7;
}
#pcx-window.pcx-theme-scroll, dialog#pcx-sub-dialog.pcx-theme-scroll {
    color-scheme: light;
    --paper: #ede3cf; --panel: #f6efe1; --panel-alt: #e4d8c0;
    --ink: #2b2016; --muted: #6e5b48; --line: #cbbba0; --line-strong: #b39f80;
    --accent: #8c383e; --accent-ink: #6e272c; --wash: #e5d8c3; --wash-warm: #eadbc2;
    --gold-ink: #7a5621; --danger: #99312b; --danger-wash: #f2deda; --active-dot: #3a7552; --btn-fg: #faf4e8;
}
#pcx-window.pcx-theme-rose, dialog#pcx-sub-dialog.pcx-theme-rose {
    color-scheme: light;
    --paper: #f6eff1; --panel: #fcf8f9; --panel-alt: #ede3e6;
    --ink: #2f2127; --muted: #7a626c; --line: #ded0d5; --line-strong: #c9b5bc;
    --accent: #a85c74; --accent-ink: #823d53; --wash: #f0e2e7; --wash-warm: #f3e7df;
    --gold-ink: #825847; --danger: #a13731; --danger-wash: #f8e5e4; --active-dot: #3c7d5f; --btn-fg: #fdf9fa;
}
#pcx-window.pcx-theme-manga, dialog#pcx-sub-dialog.pcx-theme-manga {
    color-scheme: light;
    --paper: #f4f3ef; --panel: #fbfaf7; --panel-alt: #eae8e1;
    --ink: #1f1f22; --muted: #66666c; --line: #cfcdc4; --line-strong: #b4b1a6;
    --accent: #a84644; --accent-ink: #822f2d; --wash: #eae6e2; --wash-warm: #efebe1;
    --gold-ink: #6e532b; --danger: #9e3330; --danger-wash: #f6e4e3; --active-dot: #367855; --btn-fg: #fbfaf7;
}
#pcx-window.pcx-theme-cyber, dialog#pcx-sub-dialog.pcx-theme-cyber {
    color-scheme: dark;
    --paper: #0f1319; --panel: #151b24; --panel-alt: #1d2531;
    --ink: #e6ecf2; --muted: #8393a6; --line: #283445; --line-strong: #394a61;
    --accent: #5f95ba; --accent-ink: #8cbbe0; --wash: #1d2836; --wash-warm: #292326;
    --gold-ink: #cf9c76; --danger: #cf6767; --danger-wash: #311d20; --active-dot: #66b591; --btn-fg: #0b1117;
}
#pcx-window.pcx-theme-velvet, dialog#pcx-sub-dialog.pcx-theme-velvet {
    color-scheme: dark;
    --paper: #141017; --panel: #1c1621; --panel-alt: #251d2c;
    --ink: #f0e9ef; --muted: #a390a1; --line: #36293d; --line-strong: #4d3a57;
    --accent: #a86d8c; --accent-ink: #d49bb9; --wash: #291f30; --wash-warm: #2e251f;
    --gold-ink: #dcc08e; --danger: #cf6565; --danger-wash: #341d22; --active-dot: #72b58e; --btn-fg: #fcf7fa;
}
#pcx-window.pcx-theme-apothecary, dialog#pcx-sub-dialog.pcx-theme-apothecary {
    color-scheme: dark;
    --paper: #0f1513; --panel: #141d1a; --panel-alt: #1c2824;
    --ink: #e8efec; --muted: #899f96; --line: #263831; --line-strong: #375047;
    --accent: #5e997e; --accent-ink: #88c4a8; --wash: #1c2b25; --wash-warm: #29241c;
    --gold-ink: #d6b47a; --danger: #cf665e; --danger-wash: #301d1c; --active-dot: #6bc295; --btn-fg: #0a1410;
}
#pcx-window.pcx-theme-olympus, dialog#pcx-sub-dialog.pcx-theme-olympus {
    color-scheme: light;
    --paper: #f4f1ea; --panel: #fbf9f5; --panel-alt: #ebe6db;
    --ink: #222429; --muted: #696c73; --line: #d4ccbe; --line-strong: #bcaf9b;
    --accent: #9c7838; --accent-ink: #755822; --wash: #ede6d6; --wash-warm: #efe5d1;
    --gold-ink: #7d5d24; --danger: #9e3832; --danger-wash: #f6e5e3; --active-dot: #3a7a59; --btn-fg: #fcfaf6;
}
#pcx-window.pcx-theme-abyss, dialog#pcx-sub-dialog.pcx-theme-abyss {
    color-scheme: dark;
    --paper: #0d1419; --panel: #131d24; --panel-alt: #1a2730;
    --ink: #e6eef2; --muted: #829ba8; --line: #243642; --line-strong: #344d5e;
    --accent: #5697ab; --accent-ink: #85c2d6; --wash: #1a2b36; --wash-warm: #28231c;
    --gold-ink: #d6ac70; --danger: #cf6762; --danger-wash: #2f1d1f; --active-dot: #65ba94; --btn-fg: #091217;
}

#pcx-window {
    width: 100%;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    contain: layout style;
}
#pcx-window *, #pcx-window *::before, #pcx-window *::after,
dialog#pcx-sub-dialog *, dialog#pcx-sub-dialog *::before, dialog#pcx-sub-dialog *::after {
    box-sizing: border-box;
}
#pcx-window.pcx-no-tips .pcx-q-btn,
#pcx-window.pcx-no-tips .pcx-q-bubble { display: none !important; }

/* RESET AGAINST SILLYTAVERN GLOBAL CSS */
#pcx-window h1, #pcx-window h2, #pcx-window h3, #pcx-window h4, #pcx-window p,
dialog#pcx-sub-dialog h1, dialog#pcx-sub-dialog h2, dialog#pcx-sub-dialog h3, dialog#pcx-sub-dialog p {
    margin: 0;
    text-transform: none !important;
    text-shadow: none !important;
    color: var(--ink);
}
#pcx-window h1 {
    font: 400 clamp(1.55rem, 3.8vw, 2.35rem)/1.08 var(--serif) !important;
    letter-spacing: -0.035em !important;
}
#pcx-window h2, dialog#pcx-sub-dialog h2 {
    font: 650 1.12rem/1.24 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
    letter-spacing: -0.018em !important;
}
#pcx-window h3, dialog#pcx-sub-dialog h3 {
    font: 650 0.96rem/1.28 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
}
#pcx-window p, dialog#pcx-sub-dialog p { line-height: 1.5; }
#pcx-window small, #pcx-window .pcx-muted,
dialog#pcx-sub-dialog small, dialog#pcx-sub-dialog .pcx-muted {
    color: var(--muted);
    font-size: 0.81rem;
    line-height: 1.42;
}
#pcx-window button, #pcx-window input, #pcx-window select, #pcx-window textarea,
dialog#pcx-sub-dialog button, dialog#pcx-sub-dialog input, dialog#pcx-sub-dialog select, dialog#pcx-sub-dialog textarea {
    font-family: inherit;
    color: inherit;
    box-shadow: none;
    text-transform: none;
}
#pcx-window button, dialog#pcx-sub-dialog button {
    cursor: pointer;
    touch-action: manipulation;
    margin: 0;
}
#pcx-window button:disabled, dialog#pcx-sub-dialog button:disabled {
    opacity: 0.46;
    cursor: default;
}
#pcx-window svg.pcx-ico, dialog#pcx-sub-dialog svg.pcx-ico {
    display: block;
    flex: none;
}
#pcx-window [hidden], dialog#pcx-sub-dialog [hidden] { display: none !important; }

/* TOPBAR (1:1 Concept) */
.pcx-topbar {
    height: 58px;
    flex-shrink: 0;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
    z-index: 6;
}
.pcx-top-inner {
    height: 100%;
    max-width: 1380px;
    margin: 0 auto;
    padding: 0 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.pcx-brand {
    border: 0 !important;
    background: transparent !important;
    padding: 0 !important;
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: left;
    min-width: 0;
}
.pcx-mark {
    width: 33px;
    height: 33px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--btn-fg);
    display: grid;
    place-items: center;
    flex: none;
}
.pcx-brand-name {
    display: block;
    font-weight: 760;
    font-size: 0.98rem;
    letter-spacing: -0.025em;
    line-height: 1.12;
    white-space: nowrap;
    color: var(--ink);
}
.pcx-brand-sub {
    display: block;
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 2px;
    line-height: 1;
    white-space: nowrap;
}
.pcx-top-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
}
.pcx-sq-top-btn {
    height: 36px !important;
    min-width: 36px !important;
    padding: 0 9px !important;
    border: 1px solid var(--line) !important;
    border-radius: 8px !important;
    background: var(--panel) !important;
    color: var(--ink) !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    font-size: 0.77rem !important;
    font-weight: 700 !important;
    white-space: nowrap !important;
}
.pcx-sq-top-btn:hover { background: var(--wash) !important; border-color: var(--line-strong) !important; }
.pcx-sq-top-btn.pcx-icon-only { width: 36px !important; padding: 0 !important; }

/* SHELL & 3-PILLAR NAVIGATION (SIDEBAR ON DESKTOP, FRAMELESS BOTTOM BAR ON MOBILE) */
.pcx-shell {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: 1380px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 208px minmax(0, 1fr);
    overflow: hidden;
}
.pcx-sidebar {
    border-right: 1px solid var(--line);
    padding: 20px 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--paper);
    overflow-y: auto;
}
.pcx-main-nav { display: grid; gap: 4px; }
.pcx-nav-btn {
    min-height: 44px !important;
    border: 0 !important;
    border-radius: 8px !important;
    background: transparent !important;
    padding: 0 12px !important;
    color: var(--muted) !important;
    font-size: 0.88rem !important;
    font-weight: 650 !important;
    display: flex !important;
    align-items: center !important;
    gap: 9px !important;
    text-align: left !important;
}
.pcx-nav-btn:hover { background: var(--wash) !important; color: var(--ink) !important; }
.pcx-nav-btn[aria-current="page"] {
    background: var(--wash) !important;
    color: var(--accent-ink) !important;
}
.pcx-side-foot {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    display: grid;
    gap: 8px;
}
.pcx-privacy-badge {
    padding: 10px 11px;
    border-radius: 8px;
    background: var(--panel);
    border: 1px solid var(--line);
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.38;
    display: grid;
    gap: 4px;
}
.pcx-privacy-badge strong {
    color: var(--ink);
    font-size: 0.77rem;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* MAIN SCROLL AREA — DISPLAY: BLOCK PREVENTS FLEX-SHRINK CLIPPING FOREVER! */
.pcx-main {
    display: block !important;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
}
.pcx-main-inner {
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    padding: 26px clamp(16px, 3.8vw, 52px) 56px;
    display: block;
}

/* STATUS STRIP & HEADERS */
.pcx-status-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 15px;
}
.pcx-live-pill {
    min-height: 32px !important;
    padding: 4px 10px !important;
    border-radius: 7px !important;
    border: 1px solid var(--line) !important;
    background: var(--panel) !important;
    color: var(--ink) !important;
    font-size: 0.79rem !important;
    font-weight: 640 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 7px !important;
    text-align: left !important;
}
.pcx-live-pill:hover { border-color: var(--accent) !important; background: var(--wash) !important; }
.pcx-live-dot {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: var(--active-dot);
    flex: none;
}
.pcx-page-head {
    margin-bottom: 20px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
}
.pcx-page-head p {
    margin-top: 7px !important;
    color: var(--muted) !important;
    max-width: 640px;
    font-size: 0.91rem;
}
.pcx-back-link {
    background: none !important;
    border: 0 !important;
    min-height: 34px !important;
    padding: 0 2px !important;
    margin: 0 0 10px !important;
    color: var(--accent-ink) !important;
    font-size: 0.84rem !important;
    font-weight: 700 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
}

/* HOME & HUB GRIDS (NEVER SHRINK OR CLIP) */
.pcx-home-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.38fr) minmax(275px, 1fr);
    gap: 20px;
    align-items: start;
}
.pcx-hub-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}
.pcx-hub-card {
    padding: 15px 16px !important;
    border-radius: 10px !important;
    border: 1px solid var(--line) !important;
    background: var(--panel) !important;
    text-align: left !important;
    display: grid !important;
    gap: 7px !important;
    align-content: start !important;
}
.pcx-hub-card:hover { border-color: var(--accent) !important; background: var(--wash) !important; }
.pcx-hub-card-head { display: flex; align-items: center; gap: 10px; font-weight: 720; font-size: 0.95rem; color: var(--ink); }

.pcx-section-label {
    margin: 0 0 9px !important;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase !important;
    color: var(--muted) !important;
}
.pcx-surface, .pcx-mode-list {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    min-width: 0;
}
.pcx-mode-list { overflow: hidden; }
.pcx-mode-row {
    width: 100% !important;
    min-height: 78px !important;
    padding: 13px 15px !important;
    background: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 13px !important;
    text-align: left !important;
}
.pcx-mode-row + .pcx-mode-row { border-top: 1px solid var(--line) !important; }
.pcx-mode-row:hover { background: var(--wash) !important; }
.pcx-icon-tile {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: var(--wash);
    color: var(--accent-ink);
    display: grid;
    place-items: center;
    flex: none;
}
.pcx-icon-tile.pcx-warm { background: var(--wash-warm); color: var(--gold-ink); }
.pcx-row-copy { display: grid; gap: 3px; flex: 1; min-width: 0; }
.pcx-row-copy strong { font-size: 0.95rem; letter-spacing: -0.012em; color: var(--ink); }

.pcx-stack { display: grid; gap: 13px; min-width: 0; }
.pcx-panel { padding: clamp(14px, 2.2vw, 20px); }

/* PER-SECTION ROUTE BANNER IN NOTEBOOK */
.pcx-sec-route-bar {
    padding: 10px 13px;
    border-radius: 9px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 13px;
}
.pcx-sec-route-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.83rem;
}

/* ACTIVE COVER RESUME CARD (1:1 Concept .session-card) */
.pcx-session-card {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    overflow: hidden;
    border-radius: 10px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
}
.pcx-book-spine-art {
    background: #23201c;
    position: relative;
    min-height: 136px;
    border-right: 1px solid var(--line);
    cursor: pointer;
}
.pcx-book-spine-art svg,
.pcx-book-spine-art img {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    object-position: 50% 10%;
    display: block;
}
.pcx-session-card-body {
    padding: 12px 14px;
    display: grid;
    align-content: center;
    gap: 5px;
    min-width: 0;
}
.pcx-session-card-body h2 {
    font: 400 1.24rem/1.16 var(--serif) !important;
    letter-spacing: -0.025em !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* BUTTONS & CONTROLS */
.pcx-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.pcx-actions.pcx-between { justify-content: space-between; }
.pcx-actions.pcx-end { justify-content: flex-end; }
.pcx-btn {
    min-height: 38px !important;
    padding: 7px 12px !important;
    border-radius: 8px !important;
    border: 1px solid transparent !important;
    font-size: 0.84rem !important;
    font-weight: 680 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    text-decoration: none !important;
    background: transparent !important;
    white-space: nowrap;
}
.pcx-btn-sm { min-height: 32px !important; padding: 4px 9px !important; font-size: 0.78rem !important; }
.pcx-btn-xs { min-height: 27px !important; padding: 2px 8px !important; font-size: 0.73rem !important; border-radius: 6px !important; }
.pcx-btn-primary { background: var(--accent) !important; border-color: var(--accent) !important; color: var(--btn-fg) !important; }
.pcx-btn-primary:hover:not(:disabled) { opacity: 0.92; }
.pcx-btn-secondary { background: var(--panel) !important; border-color: var(--line-strong) !important; color: var(--ink) !important; }
.pcx-btn-secondary:hover:not(:disabled) { background: var(--wash) !important; }
.pcx-btn-soft { background: var(--wash) !important; color: var(--accent-ink) !important; border-color: transparent !important; }
.pcx-btn-soft:hover:not(:disabled) { border-color: var(--accent) !important; }
.pcx-btn-danger-ghost { background: transparent !important; border-color: var(--danger) !important; color: var(--danger) !important; }
.pcx-btn-danger-ghost:hover:not(:disabled) { background: var(--danger-wash) !important; }

/* UNDERLINE TABS & SEGMENTED SWITCHERS */
.pcx-tabs {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--line);
    margin: 0 0 14px;
}
.pcx-tab-u {
    background: none !important;
    border: 0 !important;
    border-bottom: 2px solid transparent !important;
    border-radius: 0 !important;
    padding: 0 2px 5px !important;
    min-height: 39px !important;
    color: var(--muted) !important;
    font-size: 0.87rem !important;
    font-weight: 660 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
}
.pcx-tab-u[aria-selected="true"] {
    color: var(--accent-ink) !important;
    border-bottom-color: var(--accent) !important;
}
.pcx-count-tag {
    font-style: normal;
    background: var(--wash);
    color: var(--accent-ink);
    font-size: 0.71rem;
    font-weight: 700;
    border-radius: 6px;
    padding: 2px 6px;
}
.pcx-seg-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    border-radius: 8px;
    background: var(--panel-alt);
    border: 1px solid var(--line);
}
.pcx-seg-tab {
    min-height: 36px !important;
    border: 0 !important;
    border-radius: 6px !important;
    background: transparent !important;
    color: var(--muted) !important;
    font-size: 0.84rem !important;
    font-weight: 680 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
}
.pcx-seg-tab.pcx-active {
    background: var(--panel) !important;
    color: var(--accent-ink) !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14) !important;
}

/* SINGLE-LINE HORIZONTAL SWIPE CAROUSEL (ZERO CLICK-FIGHTING, SMOOTH PAN-X) */
.pcx-carousel-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
    scrollbar-width: none;
    padding-bottom: 3px;
    margin-bottom: 12px;
}
.pcx-carousel-row::-webkit-scrollbar { display: none; }
.pcx-chip-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

.pcx-chip {
    min-height: 31px !important;
    padding: 4px 9px !important;
    border-radius: 6px !important;
    border: 1px solid var(--line) !important;
    background: var(--panel) !important;
    color: var(--muted) !important;
    font-size: 0.78rem !important;
    font-weight: 640 !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    flex-shrink: 0;
    white-space: nowrap;
}
.pcx-chip.pcx-active, .pcx-chip[aria-pressed="true"] {
    background: var(--wash) !important;
    border-color: var(--accent) !important;
    color: var(--accent-ink) !important;
}
.pcx-chip.pcx-off-sec { opacity: 0.58; border-style: dashed !important; }
.pcx-chip.pcx-tab-dragging {
    opacity: 0.94;
    border-color: var(--accent) !important;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35) !important;
}
.pcx-sec-grip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 3px 2px 0;
    color: var(--muted);
    opacity: 0.68;
    cursor: grab;
    touch-action: none;
}
.pcx-key-badge {
    padding: 2px 7px;
    border-radius: 6px;
    background: var(--panel-alt);
    border: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--ink);
    white-space: nowrap;
}
.pcx-status-badge {
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    background: var(--wash);
    color: var(--accent-ink);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
}
.pcx-status-badge.pcx-warm { background: var(--wash-warm); color: var(--gold-ink); }
.pcx-status-badge.pcx-danger { background: var(--danger-wash); color: var(--danger); }

/* NOTEBOOK CARDS & LOREBOOK ENTRY ROWS (SLIM COLLAPSED STRIP -> ORGANIC EXPANDED SHEET) */
.pcx-note-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
}
.pcx-note-card.pcx-disabled-card { opacity: 0.6; }
.pcx-note-head {
    padding: 10px 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.pcx-note-title-wrap {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    flex: 1;
}
.pcx-note-title-btn {
    border: 0 !important;
    background: transparent !important;
    padding: 2px 0 !important;
    text-align: left !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    min-width: 0 !important;
    flex: 1 !important;
    overflow: hidden !important;
    color: var(--ink) !important;
}
.pcx-note-title-text {
    font-weight: 680;
    font-size: 0.92rem;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pcx-note-card.pcx-is-open .pcx-note-title-text,
.pcx-entry-row.pcx-is-open .pcx-note-title-text {
    white-space: normal;
    overflow: visible;
}
.pcx-drag-grip {
    width: 24px;
    height: 28px;
    border-radius: 6px;
    color: var(--muted);
    opacity: 0.72;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    cursor: grab;
    touch-action: none;
}
.pcx-drag-grip:hover { background: var(--wash); opacity: 1; }
.pcx-note-body {
    padding: 12px 14px 14px;
    border-top: 1px solid var(--line);
    display: grid;
    gap: 10px;
}
.pcx-note-text-preview {
    font-size: 0.9rem;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--ink);
}

.pcx-entry-row {
    padding: 10px 12px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 7px;
    flex-shrink: 0;
    overflow: hidden;
}
.pcx-entry-row.pcx-fired { border-left: 3px solid var(--active-dot); }
.pcx-entry-row.pcx-disabled-card { opacity: 0.58; }
.pcx-entry-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
}
.pcx-entry-top > .pcx-actions,
.pcx-note-head > .pcx-actions {
    flex-shrink: 0;
    flex-wrap: nowrap;
}

.pcx-card-floating {
    position: fixed !important;
    z-index: 2147483646 !important;
    pointer-events: none !important;
    opacity: 0.95 !important;
    box-shadow: 0 16px 38px rgba(0, 0, 0, 0.45) !important;
    border-color: var(--accent) !important;
}
.pcx-drag-placeholder {
    border: 1px dashed var(--accent);
    border-radius: 10px;
    background: var(--wash);
    opacity: 0.55;
}

/* SHELF WITH ART COVERS (BOTH NOTEBOOKS SHELF & LOREBOOKS SHELF — 1:1 Concept) */
.pcx-shelf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(194px, 1fr));
    gap: 14px;
}
.pcx-book-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    text-align: left;
}
.pcx-book-card.pcx-bound { border-color: var(--accent); }
.pcx-book-cover {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 2.65;
    overflow: hidden;
    background: #23201c;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
}
.pcx-book-cover svg.pcx-cover-svg,
.pcx-book-cover img.pcx-cover-img {
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: 50% 8% !important;
}
.pcx-cover-top-bar {
    position: absolute;
    top: 7px;
    left: 7px;
    right: 7px;
    display: flex;
    justify-content: space-between;
    gap: 5px;
    pointer-events: none;
}
.pcx-cover-tag {
    padding: 3px 6px;
    border-radius: 6px;
    background: rgba(18, 16, 14, 0.84);
    color: #f4eee4;
    border: 1px solid rgba(255, 255, 255, 0.16);
    font-size: 0.68rem;
    font-weight: 680;
    white-space: nowrap;
}
.pcx-cover-tag.pcx-active-hit { background: rgba(34, 79, 54, 0.92); color: #e9f7ee; }
.pcx-cover-art-btn {
    position: absolute;
    right: 7px;
    bottom: 7px;
    padding: 3px 7px !important;
    min-height: 24px !important;
    border-radius: 6px !important;
    border: 1px solid rgba(255, 255, 255, 0.24) !important;
    background: rgba(18, 16, 14, 0.82) !important;
    color: #f4eee4 !important;
    font-size: 0.67rem !important;
    font-weight: 680 !important;
}
.pcx-book-meta {
    padding: 11px 11px 8px;
    display: grid;
    gap: 4px;
    flex: 1;
    cursor: pointer;
    min-width: 0;
}
.pcx-book-meta strong {
    font: 600 0.98rem/1.22 var(--serif);
    letter-spacing: -0.015em;
    color: var(--ink);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.pcx-bind-strip {
    padding: 0 11px 8px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
}
.pcx-bind-strip.pcx-single-col {
    grid-template-columns: minmax(0, 1fr);
}
.pcx-bind-pill {
    min-height: 27px !important;
    padding: 2px 5px !important;
    border-radius: 6px !important;
    border: 1px solid var(--line) !important;
    background: var(--paper) !important;
    color: var(--muted) !important;
    font-size: 0.69rem !important;
    font-weight: 700 !important;
    text-align: center !important;
    white-space: nowrap !important;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pcx-bind-pill.pcx-on {
    background: var(--wash) !important;
    border-color: var(--accent) !important;
    color: var(--accent-ink) !important;
}
.pcx-mb-pill-row {
    padding: 0 11px 8px;
}
.pcx-mb-pill-row .pcx-bind-pill {
    width: 100%;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 5px !important;
}
.pcx-book-foot {
    padding: 0 11px 11px;
    display: flex;
    gap: 5px;
}
.pcx-book-foot .pcx-btn-main-open { flex: 1; }

/* FORMS, INPUTS, SPOILERS & CANDIDATE STUDIO */
.pcx-search-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    margin-bottom: 11px;
}
#pcx-window .pcx-input,
#pcx-window select.pcx-input,
#pcx-window textarea.pcx-input,
dialog#pcx-sub-dialog .pcx-input,
dialog#pcx-sub-dialog select.pcx-input,
dialog#pcx-sub-dialog textarea.pcx-input {
    width: 100% !important;
    min-height: 39px !important;
    height: auto !important;
    padding: 8px 10px !important;
    border-radius: 8px !important;
    border: 1px solid var(--line-strong) !important;
    background: var(--paper) !important;
    color: var(--ink) !important;
    font-size: 0.87rem !important;
    line-height: 1.38 !important;
    margin: 0 !important;
}
#pcx-window textarea.pcx-input,
dialog#pcx-sub-dialog textarea.pcx-input {
    line-height: 1.5 !important;
    resize: vertical;
}
#pcx-window textarea.pcx-mono,
dialog#pcx-sub-dialog textarea.pcx-mono {
    font-family: var(--mono) !important;
    font-size: 0.8rem !important;
}
#pcx-window .pcx-field, dialog#pcx-sub-dialog .pcx-field { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; gap: 5px !important; font-size: 0.83rem !important; font-weight: 650 !important; min-width: 0 !important; color: var(--ink) !important; align-items: stretch !important; }
.pcx-field small { font-weight: 440; }
.pcx-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.pcx-row-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pcx-chk-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.pcx-chk-label { display: inline-flex; align-items: center; gap: 7px; font-size: 0.82rem; cursor: pointer; color: var(--ink); }
#pcx-window input[type="checkbox"], dialog#pcx-sub-dialog input[type="checkbox"] {
    appearance: checkbox !important;
    -webkit-appearance: checkbox !important;
    background-image: none !important;
    width: 16px !important;
    height: 16px !important;
    min-width: 16px !important;
    accent-color: var(--accent) !important;
    margin: 0 !important;
    border-radius: 4px !important;
    transform: none !important;
}
#pcx-window input[type="checkbox"]::before, #pcx-window input[type="checkbox"]::after,
dialog#pcx-sub-dialog input[type="checkbox"]::before, dialog#pcx-sub-dialog input[type="checkbox"]::after {
    content: none !important;
    display: none !important;
}

/* CALM SPOILERS (FOR GUIDE & SECTIONS) */
details.pcx-spoiler {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--paper);
    overflow: visible;
}
details.pcx-spoiler summary {
    padding: 10px 13px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 670;
    color: var(--ink);
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
details.pcx-spoiler summary::-webkit-details-marker { display: none; }
.pcx-spoiler-body {
    padding: 12px 13px;
    border-top: 1px solid var(--line);
    display: grid;
    gap: 10px;
    font-size: 0.84rem;
    line-height: 1.54;
    color: var(--ink);
}
.pcx-sample-card {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    font-size: 0.81rem;
    line-height: 1.48;
    display: grid;
    gap: 5px;
}

.pcx-ai-cand-box {
    padding: 13px;
    border-radius: 9px;
    border: 1px solid var(--accent);
    background: var(--paper);
    display: grid;
    gap: 10px;
}

/* SQUARE SWITCH (ZERO 999px PILLS!) */
.pcx-sq-switch {
    width: 36px !important;
    height: 21px !important;
    min-height: 21px !important;
    border-radius: 6px !important;
    border: 1px solid var(--line-strong) !important;
    background: var(--panel-alt) !important;
    padding: 2px !important;
    display: inline-flex !important;
    align-items: center !important;
    flex: none !important;
}
.pcx-sq-switch span {
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: var(--muted);
    transition: transform 0.14s ease, background 0.14s ease;
    display: block;
}
.pcx-sq-switch[aria-checked="true"] {
    background: var(--wash) !important;
    border-color: var(--accent) !important;
}
.pcx-sq-switch[aria-checked="true"] span {
    transform: translateX(15px);
    background: var(--accent);
}

/* INLINE HELP TOOLTIPS */
.pcx-q-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 17px !important;
    height: 17px !important;
    min-height: 17px !important;
    padding: 0 !important;
    border-radius: 5px !important;
    border: 1px solid var(--line-strong) !important;
    background: var(--panel-alt) !important;
    color: var(--muted) !important;
    font-size: 10.5px !important;
    font-weight: 700 !important;
    vertical-align: middle;
    margin-left: 4px !important;
}
.pcx-q-bubble {
    padding: 8px 11px;
    border-radius: 7px;
    border: 1px solid var(--accent);
    background: var(--wash);
    color: var(--ink);
    font-size: 0.79rem;
    line-height: 1.45;
}

/* ATTACHMENTS */
.pcx-att-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.pcx-att-thumb {
    position: relative;
    width: 68px;
    height: 68px;
    border-radius: 7px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    cursor: pointer;
}
.pcx-att-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pcx-att-doc-row {
    padding: 7px 10px;
    border-radius: 7px;
    border: 1px solid var(--line);
    background: var(--paper);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.8rem;
}

/* NEXUSMATCH-STYLE MODAL SHEETS & 2-COLUMN THEME GRID (#pcx-sub-dialog) */
dialog#pcx-sub-dialog {
    position: fixed !important;
    inset: 0 !important;
    margin: auto !important;
    padding: 0 !important;
    border: 1px solid var(--line-strong) !important;
    border-radius: 10px !important;
    background: var(--panel) !important;
    color: var(--ink) !important;
    width: min(650px, calc(100vw - 20px)) !important;
    max-width: 650px !important;
    max-height: calc(100dvh - 28px) !important;
    height: fit-content !important;
    box-shadow: var(--shadow) !important;
    z-index: 2147483646 !important;
    overflow: hidden !important;
}
dialog#pcx-sub-dialog[open] {
    display: flex !important;
    flex-direction: column !important;
}
dialog#pcx-sub-dialog::backdrop {
    background: rgba(12, 10, 9, 0.64) !important;
}
.pcx-dlg-head {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-shrink: 0;
}
.pcx-dlg-head h2 {
    font: 400 1.38rem/1.15 var(--serif) !important;
    letter-spacing: -0.025em !important;
}
.pcx-dlg-body {
    padding: 15px 16px;
    display: block !important;
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
}
.pcx-dlg-body > * + * { margin-top: 13px; }
.pcx-dlg-foot {
    padding: 11px 16px 13px;
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    flex-shrink: 0;
}

/* 1:1 NEXUSMATCH 2-COLUMN THEME PICKER CARDS */
.pcx-theme-grid-2col {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
}
.pcx-theme-card-opt {
    min-height: 38px !important;
    padding: 7px 10px !important;
    border-radius: 8px !important;
    border: 1px solid var(--line) !important;
    background: var(--paper) !important;
    color: var(--ink) !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    text-align: left !important;
    min-width: 0;
}
.pcx-theme-card-opt:hover { border-color: var(--line-strong) !important; background: var(--wash) !important; }
.pcx-theme-card-opt.pcx-active {
    border-color: var(--accent) !important;
    background: var(--wash) !important;
    color: var(--accent-ink) !important;
}
#pcx-window.pcx-theme-dot, dialog#pcx-sub-dialog.pcx-theme-dot {
    width: 11px;
    height: 11px;
    border-radius: 3px;
    flex: none;
    border: 1px solid rgba(255, 255, 255, 0.22);
}

.pcx-chain-step {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--paper);
    display: grid;
    gap: 4px;
}
.pcx-guide-note {
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--wash);
    color: var(--accent-ink);
    font-size: 0.82rem;
    line-height: 1.46;
}
.pcx-undo-bar {
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid var(--accent);
    background: var(--wash);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    font-size: 0.82rem;
}

/* MOBILE ADAPTATION (<= 820px) — 1:1 Concept */
@media (max-width: 980px) {
    .pcx-shell { grid-template-columns: 172px minmax(0, 1fr); }
    .pcx-home-grid { grid-template-columns: 1fr; }
}
@media (max-width: 820px) {
    .pcx-topbar { height: 54px; }
    .pcx-top-inner { padding: 0 12px; }
    .pcx-brand-sub { display: none; }
    .pcx-shell {
        display: flex;
        flex-direction: column;
    }
    .pcx-sidebar {
        order: 2;
        width: 100%;
        height: auto;
        border-right: 0;
        border-top: 1px solid var(--line);
        background: var(--panel);
        padding: 4px 8px max(6px, env(safe-area-inset-bottom));
        flex-shrink: 0;
        overflow: visible;
    }
    .pcx-main-nav {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
    }
    .pcx-nav-btn {
        flex-direction: column !important;
        justify-content: center !important;
        gap: 3px !important;
        text-align: center !important;
        font-size: 0.73rem !important;
        padding: 5px 2px !important;
        min-height: 49px !important;
    }
    .pcx-side-foot { display: none; }
    .pcx-main { order: 1; flex: 1; height: auto; }
    .pcx-main-inner { padding: 16px 13px 28px; }
    .pcx-shelf-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }
    .pcx-pair, .pcx-hub-grid { grid-template-columns: 1fr !important; }
}

/* ANTI-SQUISH ARMOR (PREVENTS 55+ CARDS FROM EVER COLLAPSING INTO 1PX LINES) */
.pcx-stack {
    display: flex !important;
    flex-direction: column !important;
    gap: 11px !important;
    min-width: 0;
    height: auto !important;
}
.pcx-stack > *,
.pcx-note-card,
.pcx-entry-row,
.pcx-surface,
.pcx-mode-list,
.pcx-session-card,
.pcx-sec-route-bar,
.pcx-search-bar,
.pcx-carousel-row,
.pcx-page-head,
.pcx-status-strip,
details.pcx-spoiler {
    flex-shrink: 0 !important;
}
#pcx-lightbox {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(10, 9, 8, 0.88);
    display: grid;
    place-items: center;
    padding: 18px;
    cursor: zoom-out;
}
#pcx-lightbox img {
    max-width: 94vw;
    max-height: 90dvh;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

`;
