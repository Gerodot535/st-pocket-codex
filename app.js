const MODULE_NAME = 'st_pocket_codex';
const PROMPT_KEY_PREFIX = 'st_pcx_sec_';
const APP_VERSION = '1.0.0';

const ST_POS = {
    NONE: -1,        // Goes ONLY into {{notebook}} macro
    AFTER_MAIN: 0,   // After Main Prompt
    IN_CHAT: 1,      // In-Chat @ Depth
    BEFORE_MAIN: 2,  // Before Main Prompt
};

const ST_ROLE = {
    SYSTEM: 0,
    USER: 1,
    ASSISTANT: 2,
};

const THEMES = [
    { id: 'krakoa', name: 'Люди Икс: Кракоа', sub: 'АРХИВ КРАКОА', color: '#00e68a' },
    { id: 'scroll', name: 'Средневековый Свиток', sub: 'КОРОЛЕВСКИЙ ПЕРГАМЕНТ', color: '#9c7121' },
    { id: 'rose', name: 'Розовый Кварц', sub: 'ФАРФОРОВАЯ КАМЕЛИЯ', color: '#d64d7e' },
    { id: 'demonic', name: 'Демонический Гримуар', sub: 'КОДЕКС БЕЗДНЫ', color: '#e62e45' },
    { id: 'manga', name: 'Манга-редакция', sub: 'ЧИСТЫЙ ЛИСТ', color: '#c93b3b' },
    { id: 'notebook', name: 'Классический Блокнот', sub: 'ЛИЧНЫЙ ДНЕВНИК', color: '#b84a27' },
    { id: 'celestial', name: 'Астральный Кодекс', sub: 'ЗВЕЗДНАЯ АСТРОЛЯБИЯ', color: '#f0c674' },
    { id: 'cyber', name: 'Кибер-Нейролинк', sub: 'НЕЙРОАРХИВ', color: '#00f0ff' },
];

const LANGUAGES = [
    { id: 'Русский', label: 'Русский' },
    { id: 'English', label: 'English' },
    { id: 'Язык запроса автора', label: 'Как в запросе' },
];

const DEFAULT_GM_SYSTEM_PROMPT = `Ты — универсальный соавтор. Твоя цель — зафиксировать Авторскую Заметку для сюжета и истории, создав точный и готовый к работе блок по запросу автора.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Пользователь может поручить тебе АБСОЛЮТНО ЛЮБУЮ задачу: зафиксировать отношения персонажей, создать биографическую деталь, задать правило игры, стиль повествования или сюжетный план.
Точно определи суть запроса и адаптируй формат текста под неё, не выдумывая лишних сущностей, без приветствий и формальностей.

Верни результат строго в JSON-формате:
{
  "title": "Короткое название записи для списка (2-5 слов)",
  "content": "Готовый чистый текст заметки"
}`;

function makeDefaultCategory(id, name, pos = 1, depth = 2, role = 0, showHeader = true) {
    return {
        id,
        name,
        enabled: true,
        injectPos: pos,
        injectDepth: depth,
        injectRole: role,
        injectInterval: 1,
        showHeader,
    };
}

const DEFAULT_CATEGORIES = [
    makeDefaultCategory('classic_an', 'Классическая заметка Автора', 1, 2, 0, false),
    makeDefaultCategory('relations', 'Отношения и Биография', 1, 4, 0, true),
    makeDefaultCategory('plot', 'Сюжетный план', 1, 2, 0, true),
    makeDefaultCategory('rules', 'Правила и Стиль', 2, 0, 0, true),
];

const DEFAULT_SETTINGS = {
    theme: 'krakoa',
    scope: 'chat',
    activeTab: 'classic_an',
    replaceAuthorsNote: true,
    includeGlobalWithChat: true,
    aiProfileId: '',
    aiLang: 'Русский',
    aiChatRadius: 10,
    aiWordsMin: 40,
    aiWordsMax: 160,
    aiSendCharDesc: true,
    aiSendUserDesc: true,
    aiMaxTokens: 2800,
    gmSystemPrompt: DEFAULT_GM_SYSTEM_PROMPT,
    globalData: {
        categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
        notes: [],
    },
};

/* =========================================================
   PURE VECTOR SVG ICONS (STRICTLY ZERO EMOJIS)
   ========================================================= */
const ICONS = {
    book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h6M9 11h4"/></svg>`,
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
    importDoc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>`,
    reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`,
    help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>`,
    grip: `<svg viewBox="0 0 16 24" fill="currentColor"><circle cx="5" cy="5" r="1.6"/><circle cx="11" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="11" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="11" cy="19" r="1.6"/></svg>`,
    route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
};

const THEME_CRESTS = {
    krakoa: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5"/>
        <circle cx="20" cy="20" r="10"/>
        <path d="M13 13 L27 27 M27 13 L13 27"/>
        <circle cx="20" cy="20" r="3" fill="currentColor"/>
    </svg>`,
    scroll: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 7h20a3 3 0 0 1 0 6H10a3 3 0 0 1 0-6z"/>
        <path d="M12 13v16M28 13v16"/>
        <path d="M9 29h22a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6z"/>
        <path d="M16 18h8M16 23h6"/>
    </svg>`,
    rose: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="20" cy="20" r="4" fill="currentColor" fill-opacity="0.25"/>
        <path d="M20 7c3.5 4 4.5 7.5 0 11-4.5-3.5-3.5-7 0-11z"/>
        <path d="M33 20c-4 3.5-7.5 4.5-11 0 3.5-4.5 7-3.5 11 0z"/>
        <path d="M20 33c-3.5-4-4.5-7.5 0-11 4.5 3.5 3.5 7 0 11z"/>
        <path d="M7 20c4-3.5 7.5-4.5 11 0-3.5 4.5-7 3.5-11 0z"/>
        <circle cx="20" cy="20" r="15" stroke-dasharray="2 3"/>
    </svg>`,
    demonic: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="20" cy="20" r="17" stroke-dasharray="3 2"/>
        <circle cx="20" cy="20" r="13"/>
        <path d="M20 5 L29 31 L8 15 L32 15 L11 31 Z" stroke-linejoin="round"/>
        <circle cx="20" cy="20" r="2.5" fill="currentColor"/>
    </svg>`,
    manga: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.9">
        <rect x="6" y="6" width="28" height="28"/>
        <path d="M6 16h28M18 16v18"/>
        <circle cx="27" cy="25" r="4" fill="currentColor"/>
    </svg>`,
    notebook: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="9" y="5" width="24" height="30" rx="3"/>
        <path d="M5 10 H11 M5 16.5 H11 M5 23 H11 M5 29.5 H11" stroke-linecap="round"/>
        <path d="M15 13 H27 M15 19.5 H27 M15 26 H22" stroke-linecap="round"/>
    </svg>`,
    celestial: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4">
        <circle cx="20" cy="20" r="16"/>
        <ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(32 20 20)"/>
        <ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(-32 20 20)"/>
        <path d="M20 8 L22.2 17.8 L32 20 L22.2 22.2 L20 32 L17.8 22.2 L8 20 L17.8 17.8 Z" fill="currentColor"/>
    </svg>`,
    cyber: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M10 4 H30 L36 10 V30 L30 36 H10 L4 30 V10 Z"/>
        <path d="M13 20 H27 M20 13 V27"/>
        <rect x="17.5" y="17.5" width="5" height="5" fill="currentColor"/>
    </svg>`,
};

const NOTE_OUTPUT_JSON_SCHEMA = {
    name: 'author_note_response',
    strict: true,
    value: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Короткое название записи для списка (2-5 слов)' },
            content: { type: 'string', description: 'Готовый чистый текст заметки' },
        },
        required: ['title', 'content'],
        additionalProperties: false,
    },
};

let stApi = null;
let scriptModRef = null;
let sharedModRef = null;
let powerUserModRef = null;
let isExpandingMacro = false;
let macrosRegisteredOnce = false;
const activeRegisteredPromptKeys = new Set();

let uiState = {
    view: 'notes',
    editTab: 'manual',
    renamingTabId: null,
    showSectionInject: false,
    showGmPromptEditor: false,
    showAiHelp: false,
    editingNoteId: null,
    showThemes: false,
    aiGenerating: false,
    aiPromptDraft: '',
    aiStatus: '',
};

async function initStApi() {
    const ctx = window.SillyTavern?.getContext?.() || {};
    let scriptMod = {};
    let extMod = {};
    try { scriptMod = await import('../../../script.js'); } catch {}
    try { extMod = await import('../../extensions.js'); } catch {}
    try { sharedModRef = await import('../../shared.js'); } catch {}
    try { powerUserModRef = await import('../../../power-user.js'); } catch {}
    scriptModRef = scriptMod;

    stApi = {
        get ctx() { return window.SillyTavern?.getContext?.() || ctx; },
        get extensionSettings() {
            return this.ctx.extensionSettings || extMod.extension_settings || window.extension_settings || {};
        },
        get chatMetadata() {
            return this.ctx.chatMetadata || scriptMod.chat_metadata || window.chat_metadata;
        },
        get eventSource() {
            return this.ctx.eventSource || scriptMod.eventSource;
        },
        get eventTypes() {
            return this.ctx.eventTypes || this.ctx.event_types || scriptMod.event_types || {};
        },
        get connectionService() {
            return this.ctx.ConnectionManagerRequestService || sharedModRef?.ConnectionManagerRequestService || null;
        },
        saveSettings() {
            const fn = this.ctx.saveSettingsDebounced || scriptMod.saveSettingsDebounced;
            if (typeof fn === 'function') fn();
        },
        saveMetadata() {
            const fn = this.ctx.saveMetadataDebounced || extMod.saveMetadataDebounced || scriptMod.saveChatDebounced;
            if (typeof fn === 'function') fn();
        },
        setPrompt(key, value, pos, depth, scan, role) {
            const fn = this.ctx.setExtensionPrompt || scriptMod.setExtensionPrompt;
            if (typeof fn === 'function') {
                fn(key, value, pos, depth, scan, role);
            }
        },
        refreshNativeFloatingPrompt() {
            if (typeof scriptModRef?.setFloatingPrompt === 'function') {
                try { scriptModRef.setFloatingPrompt(); } catch {}
            }
        },
        registerMacro(name, fn) {
            if (typeof this.ctx.registerMacro === 'function') {
                try { this.ctx.registerMacro(name, fn); } catch {}
            }
        },
        async generateRawFallback(systemPrompt, userPrompt) {
            if (typeof this.ctx.generateRaw === 'function') {
                return await this.ctx.generateRaw({ prompt: userPrompt, systemPrompt, jsonSchema: NOTE_OUTPUT_JSON_SCHEMA });
            }
            if (typeof scriptMod.generateRaw === 'function') {
                return await scriptMod.generateRaw({ prompt: userPrompt, systemPrompt, jsonSchema: NOTE_OUTPUT_JSON_SCHEMA });
            }
            if (typeof this.ctx.generateQuietPrompt === 'function') {
                return await this.ctx.generateQuietPrompt({ quietPrompt: `${systemPrompt}\n\n${userPrompt}`, quietToLoud: false, skipWIAN: true });
            }
            if (typeof scriptMod.generateQuietPrompt === 'function') {
                return await scriptMod.generateQuietPrompt(`${systemPrompt}\n\n${userPrompt}`, false, true);
            }
            throw new Error('Активное подключение не найдено.');
        }
    };
}

function ensureStylesAndFonts() {
    if (!document.getElementById('pcx-fresh-stylesheet')) {
        const cssLink = document.createElement('link');
        cssLink.id = 'pcx-fresh-stylesheet';
        cssLink.rel = 'stylesheet';
        cssLink.href = new URL(`./style.css?v=${APP_VERSION}`, import.meta.url).href;
        document.head.appendChild(cssLink);
    }
    if (!document.getElementById('pcx-google-fonts')) {
        const link = document.createElement('link');
        link.id = 'pcx-google-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=JetBrains+Mono:wght@400;600;700&family=Montserrat:wght@500;600;700;800&family=Caveat:wght@600;700&display=swap';
        document.head.appendChild(link);
    }
}

function isAnyChatOpen() {
    try {
        const ctx = stApi.ctx;
        const hasChar = ctx.characterId !== undefined && ctx.characterId !== null && ctx.characterId !== '' && Number(ctx.characterId) >= 0;
        const hasGroup = Boolean(ctx.groupId);
        return hasChar || hasGroup;
    } catch {
        return false;
    }
}

function normalizeCategoryList(categories, fallbackPos = 1, fallbackDepth = 2, fallbackRole = 0) {
    if (!Array.isArray(categories) || categories.length === 0) {
        return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!categories.some(c => c.id === 'classic_an' || c.name === 'Классическая заметка Автора')) {
        categories.unshift(makeDefaultCategory('classic_an', 'Классическая заметка Автора', fallbackPos, fallbackDepth, fallbackRole, false));
    }
    for (const c of categories) {
        if (c.enabled === undefined) c.enabled = true;
        if (c.injectPos === undefined) c.injectPos = fallbackPos;
        if (c.injectDepth === undefined) c.injectDepth = fallbackDepth;
        if (c.injectRole === undefined) c.injectRole = fallbackRole;
        if (c.injectInterval === undefined) c.injectInterval = 1;
        if (c.showHeader === undefined) c.showHeader = (c.id !== 'classic_an');
    }
    return categories;
}

function ensureSettings() {
    const root = stApi.extensionSettings;
    if (!root[MODULE_NAME]) {
        root[MODULE_NAME] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
    const s = root[MODULE_NAME];
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (s[k] === undefined) {
            s[k] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS[k]));
        }
    }
    if (!s.gmSystemPrompt || s.gmSystemPrompt.includes('SillyTavern') || s.gmSystemPrompt.includes('world_and_mechanics')) {
        s.gmSystemPrompt = DEFAULT_GM_SYSTEM_PROMPT;
    }

    const legacyPos = s.injectPosition !== undefined ? Number(s.injectPosition) : 1;
    const legacyDepth = s.injectDepth !== undefined ? Number(s.injectDepth) : 2;
    const legacyRole = s.injectRole !== undefined ? Number(s.injectRole) : 0;

    if (!s.globalData || !Array.isArray(s.globalData.categories)) {
        s.globalData = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.globalData));
    } else {
        normalizeCategoryList(s.globalData.categories, legacyPos, legacyDepth, legacyRole);
    }
    return s;
}

function getConnectionProfiles() {
    const cm = stApi.extensionSettings?.connectionManager;
    if (!cm || !Array.isArray(cm.profiles)) return [];
    return [...cm.profiles].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

// Fix #1: Never write into temporary empty metadata when on SillyTavern's welcome screen!
function getChatStore() {
    if (!isAnyChatOpen()) return null;
    try {
        const meta = stApi.chatMetadata;
        if (!meta || typeof meta !== 'object' || !Object.isExtensible(meta)) return null;
        const s = ensureSettings();
        const legacyPos = s.injectPosition !== undefined ? Number(s.injectPosition) : 1;
        const legacyDepth = s.injectDepth !== undefined ? Number(s.injectDepth) : 2;
        const legacyRole = s.injectRole !== undefined ? Number(s.injectRole) : 0;

        if (!meta[MODULE_NAME]) {
            meta[MODULE_NAME] = {
                categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
                notes: [],
            };
        }
        const store = meta[MODULE_NAME];
        store.categories = normalizeCategoryList(store.categories, legacyPos, legacyDepth, legacyRole);
        if (!Array.isArray(store.notes)) {
            store.notes = [];
        }
        return store;
    } catch {
        return null;
    }
}

function getActiveStore() {
    const s = ensureSettings();
    if (s.scope === 'chat' && isAnyChatOpen()) {
        const chatStore = getChatStore();
        if (chatStore) return chatStore;
    }
    return s.globalData;
}

function describeCategoryRoute(cat) {
    if (!cat) return '';
    const pos = Number(cat.injectPos);
    const roleNames = { 0: 'System', 1: 'User', 2: 'Assistant' };
    const r = roleNames[Number(cat.injectRole) || 0] || 'System';
    const intv = Math.max(1, Number(cat.injectInterval) || 1);
    const intvPart = intv > 1 ? ` · раз в ${intv} х.` : '';

    if (pos === ST_POS.NONE) return 'В макрос {{notebook}}';
    if (pos === ST_POS.BEFORE_MAIN) return `Перед промптом · ${r}${intvPart}`;
    if (pos === ST_POS.AFTER_MAIN) return `После промпта · ${r}${intvPart}`;
    return `Глубина ${Math.max(0, Number(cat.injectDepth) || 0)} · ${r}${intvPart}`;
}

function syncAuthorsNoteReplacementUI() {
    const s = ensureSettings();
    const fallbackWandItem = document.getElementById('pcx-wand-fallback');

    if (s.replaceAuthorsNote) {
        document.body.classList.add('pcx-replace-an');
        const fp = document.getElementById('floatingPrompt');
        if (fp) fp.style.display = 'none';

        const anOption = document.getElementById('option_toggle_AN');
        if (anOption) {
            const span = anOption.querySelector('span') || anOption.querySelector('a');
            if (span && !span.dataset.pcxOrig) {
                span.dataset.pcxOrig = span.textContent;
                span.textContent = 'Кодекс Автора';
            }
        }
        if (fallbackWandItem) fallbackWandItem.style.display = 'none';
    } else {
        document.body.classList.remove('pcx-replace-an');
        const anOption = document.getElementById('option_toggle_AN');
        if (anOption) {
            const span = anOption.querySelector('span') || anOption.querySelector('a');
            if (span && span.dataset.pcxOrig) {
                span.textContent = span.dataset.pcxOrig;
                delete span.dataset.pcxOrig;
            }
        }
        if (fallbackWandItem) fallbackWandItem.style.display = '';
    }
}

function getUnmanagedLegacyAuthorsNote() {
    if (!isAnyChatOpen()) return '';
    const meta = stApi.chatMetadata;
    if (!meta || meta.pcx_managed_an) return '';
    if (typeof meta.note_prompt !== 'string') return '';
    const trimmed = meta.note_prompt.trim();
    if (trimmed.length < 4) return '';
    return trimmed;
}

function importAndClearLegacyAuthorsNote() {
    const text = getUnmanagedLegacyAuthorsNote();
    if (!text) return false;

    const store = getChatStore() || ensureSettings().globalData;
    const classicTab = store.categories.find(c => c.id === 'classic_an') || store.categories[0];
    store.notes.unshift({
        id: 'note_' + Date.now(),
        categoryId: classicTab?.id || 'classic_an',
        priority: 'normal',
        title: 'Перенесено из Заметок Автора',
        content: text,
        enabled: true,
    });

    if (stApi.chatMetadata) {
        stApi.chatMetadata.pcx_managed_an = true;
    }
    saveAll();
    return true;
}

/* =========================================================
   CHARACTER DESCRIPTION (SOLO + GROUP CHATS) & USER PERSONA
   ========================================================= */
function formatSingleCharacterCard(ch, fallbackName) {
    if (!ch) return '';
    const name = ch.name || fallbackName || 'Персонаж';
    const desc = (ch.description || ch.data?.description || '').trim();
    const pers = (ch.personality || ch.data?.personality || '').trim();
    const scen = (ch.scenario || ch.data?.scenario || '').trim();
    const parts = [];
    if (desc) parts.push(desc);
    if (pers) parts.push(`Личность: ${pers}`);
    if (scen) parts.push(`Сценарий: ${scen}`);
    if (parts.length === 0) return '';
    return `[Описание персонажа (${name})]\n${parts.join('\n')}`;
}

// Fix #2: Full support for both solo chats and Group Chats!
function getCharacterDescriptionText() {
    try {
        const ctx = stApi.ctx;
        const chars = Array.isArray(ctx.characters) ? ctx.characters : [];

        // Group chat mode
        if (ctx.groupId && Array.isArray(ctx.groups)) {
            const grp = ctx.groups.find(g => String(g.id) === String(ctx.groupId));
            if (grp && Array.isArray(grp.members)) {
                const memberBlocks = grp.members
                    .map(avatar => chars.find(c => c.avatar === avatar))
                    .filter(Boolean)
                    .map(ch => formatSingleCharacterCard(ch, ch.name))
                    .filter(Boolean);
                if (memberBlocks.length > 0) return memberBlocks.join('\n\n');
            }
        }

        // Solo character mode
        const chId = ctx.characterId;
        if (chId !== undefined && chId !== null && chId !== '' && chars[chId]) {
            const block = formatSingleCharacterCard(chars[chId], ctx.name2);
            if (block) return block;
        }

        // DOM fallback
        const domDesc = (document.getElementById('description_textarea')?.value || '').trim();
        if (domDesc) return `[Описание персонажа (${ctx.name2 || 'Персонаж'})]\n${domDesc}`;
        return '';
    } catch {
        return '';
    }
}

function getUserPersonaDescriptionText() {
    try {
        const ctx = stApi.ctx;
        const userName = ctx.name1 || 'Игрок';
        const persona = (
            ctx.powerUserSettings?.persona_description ||
            powerUserModRef?.power_user?.persona_description ||
            document.getElementById('persona_description')?.value ||
            ''
        ).trim();
        if (!persona) return '';
        return `[Описание игрока / Персоны (${userName})]\n${persona}`;
    } catch {
        return '';
    }
}

function buildWordLimitPhrase(minW, maxW) {
    const min = Math.max(0, Number(minW) || 0);
    const max = Math.max(0, Number(maxW) || 0);
    if (min > 0 && max > 0) {
        const lo = Math.min(min, max);
        const hi = Math.max(min, max);
        return `строго от ${lo} до ${hi} слов`;
    }
    if (min > 0) return `не менее ${min} слов`;
    if (max > 0) return `не более ${max} слов`;
    return 'без ограничений (оптимально под задачу)';
}

function buildChatContextSnippet(radius) {
    const count = Math.max(0, Number(radius) || 0);
    if (count === 0 || !isAnyChatOpen()) return '';
    try {
        const ctx = stApi.ctx;
        const charName = ctx.name2 || 'Персонаж';
        const userName = ctx.name1 || 'Игрок';
        const chatArr = Array.isArray(ctx.chat) ? ctx.chat : [];
        const recent = chatArr
            .filter(m => m && !m.is_system && typeof m.mes === 'string' && m.mes.trim())
            .slice(-count)
            .map(m => `${m.name || (m.is_user ? userName : charName)}: ${m.mes.slice(0, 1000)}`)
            .join('\n---\n');

        return `Участники истории: {{user}} = "${userName}", {{char}} = "${charName}".\n` +
            (recent ? `Последние реплики истории (${count}):\n${recent}` : '');
    } catch {
        return '';
    }
}

function extractNoteFromModelOutput(raw) {
    let txt = typeof raw === 'string'
        ? raw
        : (raw?.content || raw?.choices?.[0]?.message?.content || raw?.text || '');

    if (raw && typeof raw === 'object' && typeof raw.content === 'string' && typeof raw.title === 'string') {
        return { title: raw.title.trim(), content: raw.content.trim() };
    }

    txt = String(txt || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const unfenced = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        const firstBrace = unfenced.indexOf('{');
        const lastBrace = unfenced.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const parsed = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
            if (parsed && typeof parsed === 'object') {
                const contentStr = typeof parsed.content === 'string'
                    ? parsed.content
                    : (typeof parsed.note === 'string' ? parsed.note : (typeof parsed.text === 'string' ? parsed.text : ''));
                const titleStr = typeof parsed.title === 'string' ? parsed.title : '';
                if (contentStr) {
                    return { title: titleStr.trim(), content: contentStr.trim() };
                }
            }
        }
    } catch {}

    const titleMatch = unfenced.match(/^(?:ЗАГОЛОВОК|TITLE|НАЗВАНИЕ)\s*:\s*(.+)$/im);
    if (titleMatch) {
        const parsedTitle = titleMatch[1].trim().replace(/^["«]|["»]$/g, '');
        const parsedBody = unfenced
            .replace(titleMatch[0], '')
            .replace(/^\s*(?:ТЕКСТ|CONTENT|ЗАПИСЬ)\s*:\s*/im, '')
            .trim();
        return { title: parsedTitle, content: parsedBody };
    }

    return { title: '', content: unfenced };
}

async function runAiNoteGeneration(taskText, currentDraftText) {
    const s = ensureSettings();
    const wordPhrase = buildWordLimitPhrase(s.aiWordsMin, s.aiWordsMax);
    const langPhrase = (s.aiLang && s.aiLang.trim()) ? s.aiLang.trim() : 'Русский';

    let systemPrompt = (s.gmSystemPrompt && s.gmSystemPrompt.trim())
        ? s.gmSystemPrompt.trim()
        : DEFAULT_GM_SYSTEM_PROMPT;

    systemPrompt = systemPrompt
        .replace(/\{\{lang\}\}/gi, langPhrase)
        .replace(/\{\{word_limit\}\}/gi, wordPhrase);

    const parts = [];
    if (s.aiSendCharDesc) {
        const charDesc = getCharacterDescriptionText();
        if (charDesc) parts.push(charDesc);
    }
    if (s.aiSendUserDesc) {
        const userDesc = getUserPersonaDescriptionText();
        if (userDesc) parts.push(userDesc);
    }
    const contextBlock = buildChatContextSnippet(s.aiChatRadius);
    if (contextBlock) parts.push(contextBlock);

    if (currentDraftText && currentDraftText.trim()) {
        parts.push(`[Текущий черновик записи]\n${currentDraftText.trim()}`);
    }
    parts.push(`[Запрос автора]\n${taskText.trim() || 'Оформи и улучши текущий черновик.'}`);
    const userPrompt = parts.join('\n\n');

    const profileId = s.aiProfileId || '';
    const service = stApi.connectionService;
    const maxTokens = Math.max(600, Number(s.aiMaxTokens) || 2800);

    if (profileId && service && typeof service.sendRequest === 'function') {
        const profiles = getConnectionProfiles();
        const chosen = profiles.find(p => p.id === profileId);
        if (chosen) {
            const isTc = chosen.mode === 'tc';
            const payloadPrompt = isTc
                ? `${systemPrompt}\n\n${userPrompt}`
                : [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ];
            try {
                const res = await service.sendRequest(
                    profileId,
                    payloadPrompt,
                    maxTokens,
                    { stream: false, extractData: true, includePreset: false, includeInstruct: false },
                    isTc ? {} : {
                        response_format: {
                            type: 'json_schema',
                            json_schema: {
                                name: NOTE_OUTPUT_JSON_SCHEMA.name,
                                strict: true,
                                schema: NOTE_OUTPUT_JSON_SCHEMA.value,
                            },
                        },
                    }
                );
                return extractNoteFromModelOutput(res);
            } catch {
                const res2 = await service.sendRequest(
                    profileId,
                    payloadPrompt,
                    maxTokens,
                    { stream: false, extractData: true, includePreset: false, includeInstruct: false }
                );
                return extractNoteFromModelOutput(res2);
            }
        }
    }

    try {
        const raw = await stApi.generateRawFallback(systemPrompt, userPrompt);
        return extractNoteFromModelOutput(raw);
    } catch {
        const fn = stApi.ctx.generateRaw || scriptModRef?.generateRaw;
        if (typeof fn === 'function') {
            const raw2 = await fn({ prompt: userPrompt, systemPrompt });
            return extractNoteFromModelOutput(raw2);
        }
        throw new Error('Не удалось получить ответ от модели.');
    }
}

/* =========================================================
   PER-SECTION ROUTING ENGINE & {{notebook}} NON-INJECTED GLUE
   ========================================================= */
function gatherOrderedSectionsWithNotes() {
    const s = ensureSettings();
    const result = [];

    const pushFromStore = (store, scopeTag) => {
        if (!store || !Array.isArray(store.categories) || !Array.isArray(store.notes)) return;
        for (const cat of store.categories) {
            if (cat.enabled === false) continue;
            const activeNotes = store.notes.filter(n => n.categoryId === cat.id && n.enabled !== false);
            if (activeNotes.length === 0) continue;

            const compiledItems = [];
            for (const n of activeNotes) {
                const safeText = String(n.content || '').replace(/\{\{notebook\}\}/gi, '').trim();
                if (!safeText) continue;
                const tag = n.priority === 'critical' ? '[ВАЖНО] ' : '';
                compiledItems.push(`${tag}${safeText}`);
            }
            if (compiledItems.length === 0) continue;

            const body = compiledItems.join('\n\n');
            const formattedBlock = cat.showHeader !== false
                ? `### ${cat.name}\n${body}`
                : body;

            result.push({
                keyId: `${scopeTag}_${cat.id}`,
                name: cat.name,
                pos: Number(cat.injectPos ?? 1),
                depth: Math.max(0, Number(cat.injectDepth) || 0),
                role: Number(cat.injectRole) || 0,
                interval: Math.max(1, Number(cat.injectInterval) || 1),
                text: formattedBlock,
            });
        }
    };

    const chatStore = getChatStore();
    if (s.includeGlobalWithChat) {
        pushFromStore(s.globalData, 'glob');
    }
    if (chatStore) {
        pushFromStore(chatStore, 'chat');
    } else if (!s.includeGlobalWithChat) {
        pushFromStore(s.globalData, 'glob');
    }

    return result;
}

function buildMacroNotebookText() {
    if (isExpandingMacro) return '';
    isExpandingMacro = true;
    try {
        const all = gatherOrderedSectionsWithNotes();
        const uninjected = all.filter(sec => sec.pos === ST_POS.NONE);
        return uninjected.map(sec => sec.text).join('\n\n').trim();
    } finally {
        isExpandingMacro = false;
    }
}

function buildAutoInjectGroups(ignoreInterval = false) {
    const all = gatherOrderedSectionsWithNotes();
    const chatLen = Array.isArray(stApi.ctx?.chat) ? stApi.ctx.chat.length : 0;
    const groupsMap = new Map();

    for (const sec of all) {
        if (sec.pos === ST_POS.NONE) continue;
        if (!ignoreInterval && sec.interval > 1 && (chatLen % sec.interval !== 0)) continue;

        const sig = `${sec.pos}_${sec.pos === ST_POS.IN_CHAT ? sec.depth : 0}_${sec.role}`;
        if (!groupsMap.has(sig)) {
            groupsMap.set(sig, {
                sig,
                pos: sec.pos,
                depth: sec.pos === ST_POS.IN_CHAT ? sec.depth : 0,
                role: sec.role,
                sectionNames: [],
                blocks: [],
            });
        }
        const g = groupsMap.get(sig);
        g.sectionNames.push(sec.name);
        g.blocks.push(sec.text);
    }

    return Array.from(groupsMap.values()).map(g => ({
        ...g,
        combinedText: g.blocks.join('\n\n').trim(),
    }));
}

function countAllActiveNotes() {
    const s = ensureSettings();
    let count = 0;
    const countInStore = (st) => {
        if (!st || !Array.isArray(st.categories) || !Array.isArray(st.notes)) return 0;
        const enabledCats = new Set(st.categories.filter(c => c.enabled !== false).map(c => c.id));
        return st.notes.filter(n => n.enabled !== false && enabledCats.has(n.categoryId)).length;
    };
    if (s.includeGlobalWithChat) count += countInStore(s.globalData);
    const chatStore = getChatStore();
    if (chatStore) count += countInStore(chatStore);
    else if (!s.includeGlobalWithChat) count += countInStore(s.globalData);
    return count;
}

function syncNativeAuthorsNoteMetadata(promptText, pos, depth, role) {
    if (!isAnyChatOpen()) return false;
    const meta = stApi.chatMetadata;
    if (!meta || typeof meta !== 'object' || !Object.isExtensible(meta)) return false;
    if (getUnmanagedLegacyAuthorsNote()) return false;

    meta.pcx_managed_an = true;
    meta.note_prompt = promptText;
    meta.note_position = pos;
    meta.note_depth = depth;
    meta.note_role = role;
    meta.note_interval = 1;

    const noteEl = document.getElementById('note_prompt');
    if (noteEl) noteEl.value = promptText;

    stApi.refreshNativeFloatingPrompt();
    return true;
}

function clearManagedNativeAuthorsNote(releaseOwnership = false) {
    if (!isAnyChatOpen()) return;
    const meta = stApi.chatMetadata;
    if (meta && meta.pcx_managed_an) {
        meta.note_prompt = '';
        if (releaseOwnership) delete meta.pcx_managed_an;
        const noteEl = document.getElementById('note_prompt');
        if (noteEl) noteEl.value = '';
        stApi.refreshNativeFloatingPrompt();
    }
}

function updateExtensionPrompt() {
    const s = ensureSettings();

    stApi.setPrompt('st_pocket_codex_prompt', '', ST_POS.IN_CHAT, 0, false, ST_ROLE.SYSTEM);
    for (const oldKey of activeRegisteredPromptKeys) {
        stApi.setPrompt(oldKey, '', ST_POS.IN_CHAT, 0, false, ST_ROLE.SYSTEM);
    }
    activeRegisteredPromptKeys.clear();

    if (!isAnyChatOpen()) return;

    const groups = buildAutoInjectGroups(false);

    if (groups.length === 0) {
        clearManagedNativeAuthorsNote(!s.replaceAuthorsNote);
        return;
    }

    const remainingGroups = [...groups];

    if (s.replaceAuthorsNote) {
        const primaryIdx = remainingGroups.findIndex(g => g.pos === ST_POS.IN_CHAT);
        const anchorIdx = primaryIdx !== -1 ? primaryIdx : 0;
        const anchorGroup = remainingGroups[anchorIdx];

        const synced = syncNativeAuthorsNoteMetadata(
            anchorGroup.combinedText,
            anchorGroup.pos,
            anchorGroup.depth,
            anchorGroup.role
        );
        if (synced) {
            remainingGroups.splice(anchorIdx, 1);
        }
    } else {
        clearManagedNativeAuthorsNote(true);
    }

    remainingGroups.forEach((g, idx) => {
        const key = `${PROMPT_KEY_PREFIX}${idx}_${g.sig}`;
        activeRegisteredPromptKeys.add(key);
        stApi.setPrompt(key, g.combinedText, g.pos, g.depth, true, g.role);
    });
}

function saveAll() {
    syncAuthorsNoteReplacementUI();
    updateExtensionPrompt();
    stApi.saveSettings();
    if (isAnyChatOpen()) stApi.saveMetadata();
}

// Fix #4: Register macro strictly once per browser session!
function registerNotebookMacroOnce() {
    if (macrosRegisteredOnce) return;
    macrosRegisteredOnce = true;
    stApi.registerMacro('notebook', () => buildMacroNotebookText());
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function applyThemeClasses() {
    const s = ensureSettings();
    const themeObj = THEMES.find(t => t.id === s.theme) || THEMES[0];
    const win = document.getElementById('pcx-window');
    if (win) {
        THEMES.forEach(t => win.classList.remove(`pcx-theme-${t.id}`));
        win.classList.add(`pcx-theme-${themeObj.id}`);
    }
}

/* =========================================================
   TOUCH & MOUSE DRAG-AND-DROP FOR CARDS AND SECTION TABS
   ========================================================= */
function enableCardTouchReorder(win, store, currentCatId) {
    const bodyEl = win.querySelector('.pcx-body');
    if (!bodyEl) return;

    const grips = bodyEl.querySelectorAll('.pcx-card-grip');
    grips.forEach(grip => {
        grip.addEventListener('pointerdown', (e) => {
            if (e.button && e.button !== 0) return;
            const card = grip.closest('.pcx-card');
            if (!card) return;

            e.preventDefault();
            e.stopPropagation();
            try { grip.setPointerCapture(e.pointerId); } catch {}

            card.classList.add('pcx-card-dragging');
            navigator.vibrate?.(12);

            const onPointerMove = (ev) => {
                ev.preventDefault();
                const y = ev.clientY;

                const bodyRect = bodyEl.getBoundingClientRect();
                if (y < bodyRect.top + 44) bodyEl.scrollTop -= 8;
                else if (y > bodyRect.bottom - 44) bodyEl.scrollTop += 8;

                const siblings = [...bodyEl.querySelectorAll('.pcx-card:not(.pcx-card-dragging)')];
                let nextSibling = null;
                for (const sib of siblings) {
                    const rect = sib.getBoundingClientRect();
                    if (y < rect.top + rect.height / 2) {
                        nextSibling = sib;
                        break;
                    }
                }
                if (nextSibling) {
                    bodyEl.insertBefore(card, nextSibling);
                } else {
                    bodyEl.appendChild(card);
                }
            };

            const finishDrag = (ev) => {
                grip.removeEventListener('pointermove', onPointerMove);
                grip.removeEventListener('pointerup', finishDrag);
                grip.removeEventListener('pointercancel', finishDrag);
                try { grip.releasePointerCapture(ev.pointerId); } catch {}
                card.classList.remove('pcx-card-dragging');

                const orderedIds = [...bodyEl.querySelectorAll('.pcx-card')]
                    .map(el => el.dataset.noteId)
                    .filter(Boolean);

                const catMap = new Map();
                for (const n of store.notes) {
                    if (n.categoryId === currentCatId) catMap.set(n.id, n);
                }
                const reorderedCatNotes = orderedIds.map(id => catMap.get(id)).filter(Boolean);

                const resultNotes = [];
                let inserted = false;
                for (const n of store.notes) {
                    if (n.categoryId === currentCatId) {
                        if (!inserted) {
                            resultNotes.push(...reorderedCatNotes);
                            inserted = true;
                        }
                    } else {
                        resultNotes.push(n);
                    }
                }
                if (!inserted) resultNotes.push(...reorderedCatNotes);

                store.notes = resultNotes;
                saveAll();
            };

            grip.addEventListener('pointermove', onPointerMove);
            grip.addEventListener('pointerup', finishDrag);
            grip.addEventListener('pointercancel', finishDrag);
        });
    });
}

function enableTabTouchAndMouseReorder(win, store, settings) {
    const tabsBar = win.querySelector('.pcx-tabs-bar');
    if (!tabsBar) return;

    let suppressNextClick = false;

    const persistTabOrderFromDom = () => {
        const orderedTabIds = [...tabsBar.querySelectorAll('.pcx-tab')]
            .map(el => el.dataset.tab)
            .filter(Boolean);
        const map = new Map(store.categories.map(c => [c.id, c]));
        const nextCats = orderedTabIds.map(id => map.get(id)).filter(Boolean);
        if (nextCats.length === store.categories.length) {
            store.categories = nextCats;
            saveAll();
        }
    };

    const moveTabAtClientX = (tab, clientX) => {
        const barRect = tabsBar.getBoundingClientRect();
        if (clientX < barRect.left + 42) tabsBar.scrollLeft -= 8;
        else if (clientX > barRect.right - 42) tabsBar.scrollLeft += 8;

        const siblings = [...tabsBar.querySelectorAll('.pcx-tab:not(.pcx-tab-dragging)')];
        let beforeEl = null;
        for (const sib of siblings) {
            const r = sib.getBoundingClientRect();
            if (clientX < r.left + r.width / 2) {
                beforeEl = sib;
                break;
            }
        }
        if (beforeEl) {
            tabsBar.insertBefore(tab, beforeEl);
        } else {
            tabsBar.appendChild(tab);
        }
    };

    tabsBar.querySelectorAll('.pcx-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (suppressNextClick) {
                e.preventDefault();
                e.stopPropagation();
                suppressNextClick = false;
                return;
            }
            resetEditDrafts();
            settings.activeTab = tab.dataset.tab;
            uiState.view = 'notes';
            saveAll();
            renderModal();
        });

        let holdTimer = null;
        let isTouchDragging = false;
        let startX = 0;
        let startY = 0;

        tab.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isTouchDragging = false;

            holdTimer = setTimeout(() => {
                isTouchDragging = true;
                suppressNextClick = true;
                tab.classList.add('pcx-tab-dragging');
                navigator.vibrate?.(18);
            }, 210);
        }, { passive: true });

        tab.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            if (!t) return;
            if (!isTouchDragging) {
                if (Math.abs(t.clientX - startX) > 9 || Math.abs(t.clientY - startY) > 9) {
                    clearTimeout(holdTimer);
                }
                return;
            }
            e.preventDefault();
            moveTabAtClientX(tab, t.clientX);
        }, { passive: false });

        const endTouch = () => {
            clearTimeout(holdTimer);
            if (isTouchDragging) {
                isTouchDragging = false;
                tab.classList.remove('pcx-tab-dragging');
                persistTabOrderFromDom();
                setTimeout(() => { suppressNextClick = false; }, 120);
            }
        };
        tab.addEventListener('touchend', endTouch);
        tab.addEventListener('touchcancel', endTouch);

        tab.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const mStartX = e.clientX;
            let mouseDragging = false;

            const onMouseMove = (ev) => {
                if (!mouseDragging && Math.abs(ev.clientX - mStartX) > 7) {
                    mouseDragging = true;
                    suppressNextClick = true;
                    tab.classList.add('pcx-tab-dragging');
                }
                if (mouseDragging) {
                    ev.preventDefault();
                    moveTabAtClientX(tab, ev.clientX);
                }
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                if (mouseDragging) {
                    tab.classList.remove('pcx-tab-dragging');
                    persistTabOrderFromDom();
                    setTimeout(() => { suppressNextClick = false; }, 80);
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    });
}

function renderModal() {
    const s = ensureSettings();
    const chatOpen = isAnyChatOpen();
    const effectiveScope = (s.scope === 'chat' && chatOpen) ? 'chat' : 'global';
    const store = getActiveStore();
    const themeObj = THEMES.find(t => t.id === s.theme) || THEMES[0];

    if (!store.categories.some(c => c.id === s.activeTab)) {
        s.activeTab = store.categories[0]?.id || 'classic_an';
    }
    const currentCat = store.categories.find(c => c.id === s.activeTab) || store.categories[0];

    applyThemeClasses();

    const win = document.getElementById('pcx-window');
    if (!win) return;

    const themePillsHtml = THEMES.map(t => `
        <button type="button" class="pcx-theme-pill ${t.id === s.theme ? 'pcx-active' : ''}" data-theme="${t.id}">
            <span class="pcx-theme-dot" style="background:${t.color}"></span>
            <span>${escapeHtml(t.name)}</span>
        </button>
    `).join('');

    const tabsHtml = `
        <button type="button" class="pcx-add-tab-pill" id="pcx-add-tab-btn" title="Создать новую вкладку в начале списка">
            ${ICONS.plus}<span>Раздел</span>
        </button>
        ` + store.categories.map(cat => {
            const count = store.notes.filter(n => n.categoryId === cat.id && n.enabled !== false).length;
            const isActive = cat.id === s.activeTab && uiState.view === 'notes';
            const isMuted = cat.enabled === false;
            return `
                <button type="button" class="pcx-tab ${isActive ? 'pcx-active' : ''} ${isMuted ? 'pcx-tab-muted' : ''}" data-tab="${escapeHtml(cat.id)}" title="Удерживай, чтобы перетащить раздел">
                    <span>${escapeHtml(cat.name)}</span>
                    ${count > 0 ? `<span class="pcx-tab-count">${count}</span>` : ''}
                </button>
            `;
        }).join('');

    let bodyHtml = '';

    if (uiState.view === 'inject') {
        const legacyText = getUnmanagedLegacyAuthorsNote();
        const autoGroups = buildAutoInjectGroups(true);
        const macroPreview = buildMacroNotebookText();
        const roleLabels = { 0: 'System', 1: 'User', 2: 'Assistant' };

        const autoGroupsHtml = autoGroups.length === 0
            ? `<div class="pcx-preview-box">(Сейчас нет активных разделов на авто-инжекте)</div>`
            : autoGroups.map(g => {
                const where = g.pos === ST_POS.BEFORE_MAIN
                    ? `Перед главным промптом · ${roleLabels[g.role]}`
                    : (g.pos === ST_POS.AFTER_MAIN
                        ? `После главного промпта · ${roleLabels[g.role]}`
                        : `Глубина ${g.depth} · ${roleLabels[g.role]}`);
                return `
                    <div style="display:flex;flex-direction:column;gap:5px;">
                        <span style="font-size:11.5px;font-weight:700;color:var(--pcx-accent);">${escapeHtml(where)} (${escapeHtml(g.sectionNames.join(' + '))})</span>
                        <div class="pcx-preview-box notranslate" translate="no">${escapeHtml(g.combinedText)}</div>
                    </div>
                `;
            }).join('');

        bodyHtml = `
            <div class="pcx-panel-box">
                <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer">
                    <input type="checkbox" id="pcx-replace-an" ${s.replaceAuthorsNote ? 'checked' : ''}>
                    <span>Заменять стандартные «Заметки Автора» этим Кодексом (совместимо с Лорбуками ↑AN и ↓AN)</span>
                </label>

                <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer">
                    <input type="checkbox" id="pcx-inc-global" ${s.includeGlobalWithChat ? 'checked' : ''}>
                    <span>Подключать «Общие» разделы ко всем историям</span>
                </label>

                ${legacyText ? `
                    <div style="display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--pcx-accent-2);border-radius:var(--pcx-radius);">
                        <span style="font-size:12px;color:var(--pcx-accent-2);">В чате остался старый текст внутри бывшей Заметки Автора (${legacyText.length} симв.).</span>
                        <button type="button" id="pcx-import-legacy-an" class="pcx-secondary-btn">
                            ${ICONS.importDoc}<span>Перенести в «Классическую заметку Автора»</span>
                        </button>
                    </div>
                ` : ''}

                <div style="padding-top:8px;border-top:1px solid var(--pcx-border);display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                        <div>
                            <div style="font-size:12.5px;font-weight:700;color:var(--pcx-text);">Макрос неинжектированных разделов</div>
                            <div style="font-size:11px;color:var(--pcx-text-muted);">Собирает все разделы, у которых выбран пункт «В макрос»</div>
                        </div>
                        <button type="button" class="pcx-macro-chip notranslate" translate="no" data-copy="{{notebook}}">${ICONS.copy}<span>{{notebook}}</span></button>
                    </div>
                    <div class="pcx-preview-box notranslate" translate="no">${escapeHtml(macroPreview || '(Нет активных записей с отправкой в макрос {{notebook}})')}</div>
                </div>

                <div style="padding-top:8px;border-top:1px solid var(--pcx-border);display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:12.5px;font-weight:700;color:var(--pcx-text);">Карта активных авто-инжектов по разделам</div>
                    ${autoGroupsHtml}
                </div>
            </div>
        `;
    } else if (uiState.view === 'edit') {
        const existing = uiState.editingNoteId
            ? store.notes.find(n => n.id === uiState.editingNoteId)
            : null;
        const titleVal = uiState.draftTitle !== undefined ? uiState.draftTitle : (existing ? existing.title : '');
        const contentVal = uiState.draftContent !== undefined ? uiState.draftContent : (existing ? existing.content : '');
        const prioVal = uiState.draftPrio !== undefined ? uiState.draftPrio : (existing ? (existing.priority || 'normal') : 'normal');
        const catVal = uiState.draftCat !== undefined ? uiState.draftCat : (existing ? existing.categoryId : (currentCat?.id || store.categories[0].id));

        const profiles = getConnectionProfiles();

        bodyHtml = `
            <div class="pcx-panel-box">
                <div class="pcx-mode-tabs">
                    <button type="button" class="pcx-mode-tab ${uiState.editTab === 'manual' ? 'pcx-active' : ''}" data-edittab="manual">
                        ${ICONS.edit}<span>Текст записи</span>
                    </button>
                    <button type="button" class="pcx-mode-tab ${uiState.editTab === 'ai' ? 'pcx-active' : ''}" data-edittab="ai">
                        ${ICONS.spark}<span>Поручить Соавтору</span>
                    </button>
                </div>

                ${uiState.editTab === 'ai' ? `
                    <div class="pcx-row-2">
                        <div>
                            <label class="pcx-field-label">Профиль подключения</label>
                            <select id="pcx-ai-profile" class="pcx-select">
                                <option value="" ${!s.aiProfileId ? 'selected' : ''}>[ Текущее подключение ]</option>
                                ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === s.aiProfileId ? 'selected' : ''}>${escapeHtml(p.name || p.id)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="pcx-field-label">Целевой язык</label>
                            <select id="pcx-ai-lang" class="pcx-select">
                                ${LANGUAGES.map(l => `<option value="${escapeHtml(l.id)}" ${s.aiLang === l.id ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                            <span class="pcx-field-label" style="margin:0">Параметры объёма и чтения истории</span>
                            <button type="button" class="pcx-mini-btn ${uiState.showAiHelp ? 'pcx-active' : ''}" id="pcx-toggle-ai-help">
                                ${ICONS.help}<span>Подсказка</span>
                            </button>
                        </div>

                        <div class="pcx-row-3">
                            <div>
                                <label class="pcx-field-label">Слов от</label>
                                <input id="pcx-ai-wmin" type="number" min="0" max="5000" class="pcx-input" value="${Math.max(0, Number(s.aiWordsMin) || 0)}">
                            </div>
                            <div>
                                <label class="pcx-field-label">Слов до</label>
                                <input id="pcx-ai-wmax" type="number" min="0" max="5000" class="pcx-input" value="${Math.max(0, Number(s.aiWordsMax) || 0)}">
                            </div>
                            <div>
                                <label class="pcx-field-label">Сообщений чата</label>
                                <input id="pcx-ai-radius" type="number" min="0" max="200" class="pcx-input" value="${Math.max(0, Number(s.aiChatRadius) ?? 10)}">
                            </div>
                        </div>
                    </div>

                    <div style="display:flex;gap:14px;flex-wrap:wrap;padding:2px 0;">
                        <label style="display:inline-flex;align-items:center;gap:7px;font-size:12px;cursor:pointer">
                            <input type="checkbox" id="pcx-ai-char-desc" ${s.aiSendCharDesc !== false ? 'checked' : ''}>
                            <span>Отправлять описание персонажа</span>
                        </label>
                        <label style="display:inline-flex;align-items:center;gap:7px;font-size:12px;cursor:pointer">
                            <input type="checkbox" id="pcx-ai-user-desc" ${s.aiSendUserDesc !== false ? 'checked' : ''}>
                            <span>Отправлять описание игрока</span>
                        </label>
                    </div>

                    ${uiState.showAiHelp ? `
                        <div class="pcx-help-popover">
                            <div><b>Слов от / до:</b> желаемый объём заметки. Значение <b>0</b> снимает ограничение по длине.</div>
                            <div><b>Сообщений чата:</b> сколько последних реплик истории прочитает соавтор. Значение <b>0</b> отключает чтение чата.</div>
                            <div><b>Описание персонажа / игрока:</b> передаёт соавтору анкету героя (или всех героев группы) и твою персону.</div>
                        </div>
                    ` : ''}

                    <div>
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
                            <label class="pcx-field-label" style="margin:0">Запрос для Соавтора</label>
                            <button type="button" class="pcx-mini-btn ${uiState.showGmPromptEditor ? 'pcx-active' : ''}" id="pcx-toggle-gm-prompt">
                                ${ICONS.sliders}<span>${uiState.showGmPromptEditor ? 'Скрыть промпт' : 'Промпт соавтора'}</span>
                            </button>
                        </div>
                        <textarea id="pcx-ai-task" class="pcx-textarea" style="min-height:88px" placeholder="Например: зафиксировать отношения персонажа, создать биографическую деталь, задать правило игры или сюжетный план...">${escapeHtml(uiState.aiPromptDraft || '')}</textarea>
                    </div>

                    ${uiState.showGmPromptEditor ? `
                        <div style="padding:10px;border:1px solid var(--pcx-border);border-radius:var(--pcx-radius);background:var(--pcx-bg);display:flex;flex-direction:column;gap:8px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                                <span style="font-size:11px;color:var(--pcx-text-muted);">Внутренние метки промпта: <b translate="no" class="notranslate">{{lang}}</b>, <b translate="no" class="notranslate">{{word_limit}}</b></span>
                                <button type="button" class="pcx-mini-btn" id="pcx-reset-gm-prompt">${ICONS.reset}<span>По умолчанию</span></button>
                            </div>
                            <textarea id="pcx-gm-sys-prompt" class="pcx-textarea pcx-mono-area" style="min-height:175px">${escapeHtml(s.gmSystemPrompt)}</textarea>
                        </div>
                    ` : ''}

                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                        <span style="font-size:11.5px;color:var(--pcx-text-muted)">${escapeHtml(uiState.aiStatus || 'Готовый блок откроется во вкладке «Текст записи» для правки')}</span>
                        <button type="button" id="pcx-run-ai-btn" class="pcx-primary-btn" ${uiState.aiGenerating ? 'disabled' : ''}>
                            ${uiState.aiGenerating ? ICONS.spinner : ICONS.spark}
                            <span>${uiState.aiGenerating ? 'Создаём блок...' : 'Создать заметку'}</span>
                        </button>
                    </div>
                ` : `
                    <div class="pcx-row-2">
                        <div>
                            <label class="pcx-field-label">Раздел</label>
                            <select id="pcx-note-cat" class="pcx-select">
                                ${store.categories.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === catVal ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="pcx-field-label">Метка записи</label>
                            <select id="pcx-note-prio" class="pcx-select">
                                <option value="normal" ${prioVal === 'normal' ? 'selected' : ''}>Обычная запись</option>
                                <option value="high" ${prioVal === 'high' ? 'selected' : ''}>Акцент сцены</option>
                                <option value="critical" ${prioVal === 'critical' ? 'selected' : ''}>Строгое правило [ВАЖНО]</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="pcx-field-label">Название карточки (только для себя в списке)</label>
                        <input id="pcx-note-title" class="pcx-input" placeholder="Короткая бирка для удобства..." value="${escapeHtml(titleVal)}">
                    </div>

                    <div>
                        <label class="pcx-field-label">Текст заметки для сюжета / истории</label>
                        <textarea id="pcx-note-content" class="pcx-textarea" style="min-height:175px" placeholder="Зафиксируй отношения персонажей, биографическую деталь, правило игры или сюжетный план...">${escapeHtml(contentVal)}</textarea>
                    </div>

                    <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:4px;">
                        <button type="button" id="pcx-cancel-edit" class="pcx-icon-btn">Отмена</button>
                        <button type="button" id="pcx-save-note" class="pcx-primary-btn">${ICONS.check}<span>Сохранить запись</span></button>
                    </div>
                `}
            </div>
        `;
    } else if (uiState.view === 'tab_form') {
        const editingTab = uiState.renamingTabId
            ? store.categories.find(c => c.id === uiState.renamingTabId)
            : null;
        const tabNameVal = editingTab ? editingTab.name : '';
        const tabPosVal = editingTab ? Number(editingTab.injectPos ?? 1) : 1;

        bodyHtml = `
            <div class="pcx-panel-box">
                <div>
                    <label class="pcx-field-label">${editingTab ? 'Новое название раздела' : 'Название нового раздела (появится первым в списке)'}</label>
                    <input id="pcx-new-tab-name" class="pcx-input" placeholder="Например: Отношения / Биография / Правила" value="${escapeHtml(tabNameVal)}">
                </div>
                <div>
                    <label class="pcx-field-label">Куда отправлять этот раздел?</label>
                    <select id="pcx-new-tab-pos" class="pcx-select">
                        <option value="1" ${tabPosVal === 1 ? 'selected' : ''}>В глубине чата (@ Depth)</option>
                        <option value="2" ${tabPosVal === 2 ? 'selected' : ''}>Перед главным промптом</option>
                        <option value="0" ${tabPosVal === 0 ? 'selected' : ''}>После главного промпта</option>
                        <option value="-1" ${tabPosVal === -1 ? 'selected' : ''}>Не инжектить (в макрос {{notebook}})</option>
                    </select>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end">
                    <button type="button" id="pcx-cancel-tab" class="pcx-icon-btn">Отмена</button>
                    <button type="button" id="pcx-create-tab-confirm" class="pcx-primary-btn">
                        ${editingTab ? ICONS.check : ICONS.plus}
                        <span>${editingTab ? 'Сохранить раздел' : 'Создать спереди'}</span>
                    </button>
                </div>
            </div>
        `;
    } else {
        const catNotes = store.notes.filter(n => n.categoryId === currentCat?.id);
        const catEnabled = currentCat?.enabled !== false;
        const cPos = Number(currentCat?.injectPos ?? 1);

        const secInjectHtml = currentCat ? `
            <div class="pcx-sec-inject-bar">
                <div class="pcx-sec-inject-summary">
                    <span class="pcx-sec-inject-label">
                        ${ICONS.route}
                        <span>Куда идёт раздел: <b translate="no" class="notranslate">${escapeHtml(describeCategoryRoute(currentCat))}</b></span>
                    </span>
                    <button type="button" class="pcx-mini-btn ${uiState.showSectionInject ? 'pcx-active' : ''}" id="pcx-toggle-sec-inject">
                        ${ICONS.sliders}<span>${uiState.showSectionInject ? 'Готово' : 'Настроить'}</span>
                    </button>
                </div>

                ${uiState.showSectionInject ? `
                    <div style="padding-top:8px;border-top:1px solid var(--pcx-border);display:flex;flex-direction:column;gap:10px;">
                        <div>
                            <label class="pcx-field-label">Позиция вставки именно для раздела «${escapeHtml(currentCat.name)}»</label>
                            <select id="pcx-sec-pos" class="pcx-select">
                                <option value="1" ${cPos === 1 ? 'selected' : ''}>В глубине чата (@ Depth)</option>
                                <option value="2" ${cPos === 2 ? 'selected' : ''}>Перед главным промптом</option>
                                <option value="0" ${cPos === 0 ? 'selected' : ''}>После главного промпта</option>
                                <option value="-1" ${cPos === -1 ? 'selected' : ''}>Не инжектить (отправить в макрос {{notebook}})</option>
                            </select>
                        </div>

                        ${cPos !== -1 ? `
                            <div class="${cPos === 1 ? 'pcx-row-3' : 'pcx-row-2'}">
                                ${cPos === 1 ? `
                                <div>
                                    <label class="pcx-field-label">Глубина</label>
                                    <input id="pcx-sec-depth" type="number" min="0" max="999" class="pcx-input" value="${Math.max(0, Number(currentCat.injectDepth) || 0)}">
                                </div>
                                ` : ''}
                                <div>
                                    <label class="pcx-field-label">Роль</label>
                                    <select id="pcx-sec-role" class="pcx-select">
                                        <option value="0" ${Number(currentCat.injectRole) === 0 ? 'selected' : ''}>Система (System)</option>
                                        <option value="1" ${Number(currentCat.injectRole) === 1 ? 'selected' : ''}>Пользователь (User)</option>
                                        <option value="2" ${Number(currentCat.injectRole) === 2 ? 'selected' : ''}>Ассистент (Assistant)</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="pcx-field-label">Интервал (ходы)</label>
                                    <input id="pcx-sec-interval" type="number" min="1" max="100" class="pcx-input" value="${Math.max(1, Number(currentCat.injectInterval) || 1)}">
                                </div>
                            </div>
                        ` : ''}

                        <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
                            <input type="checkbox" id="pcx-sec-header" ${currentCat.showHeader !== false ? 'checked' : ''}>
                            <span>Добавлять подзаголовок «### ${escapeHtml(currentCat.name)}» перед записями этого раздела</span>
                        </label>
                    </div>
                ` : ''}
            </div>
        ` : '';

        const cardsHtml = catNotes.length === 0
            ? `<div class="pcx-empty">Раздел <b>«${escapeHtml(currentCat?.name || '')}»</b> пока пуст.<br>Нажми <b>«Новая запись»</b>, чтобы добавить карточку.<br><span style="font-size:11.5px;opacity:0.8">Совет: удерживай вкладку раздела, чтобы передвинуть её пальцем и изменить порядок склейки.</span></div>`
            : catNotes.map((note, idx) => {
                const isOn = note.enabled !== false && catEnabled;
                const prioLabel = note.priority === 'critical' ? 'Строгое правило' : (note.priority === 'high' ? 'Акцент сцены' : 'Обычная запись');
                return `
                    <div class="pcx-card ${isOn ? '' : 'pcx-card-off'}" data-note-id="${escapeHtml(note.id)}">
                        <div class="pcx-card-top">
                            <div class="pcx-card-title-group">
                                <span class="pcx-card-grip" title="Потяни вверх или вниз, чтобы изменить порядок">${ICONS.grip}</span>
                                <div class="pcx-switch ${note.enabled !== false ? 'pcx-on' : ''}" data-action="toggle" data-id="${escapeHtml(note.id)}"></div>
                                <div class="pcx-card-title">${escapeHtml(note.title || ('Запись ' + (idx + 1)))}</div>
                            </div>
                            <span class="pcx-prio-badge">${prioLabel}</span>
                        </div>
                        <div class="pcx-card-content">${escapeHtml(note.content)}</div>
                        <div class="pcx-card-footer">
                            <button type="button" class="pcx-mini-btn" data-action="edit" data-id="${escapeHtml(note.id)}">${ICONS.edit}<span>Изменить</span></button>
                            <button type="button" class="pcx-mini-btn" data-action="delete" data-id="${escapeHtml(note.id)}">${ICONS.trash}</button>
                        </div>
                    </div>
                `;
            }).join('');

        bodyHtml = secInjectHtml + cardsHtml;
    }

    const catEnabled = currentCat?.enabled !== false;

    win.innerHTML = `
        <div class="pcx-header">
            <div class="pcx-header-left">
                <div class="pcx-crest">${THEME_CRESTS[themeObj.id] || THEME_CRESTS.krakoa}</div>
                <div class="pcx-title-wrap">
                    <div class="pcx-title-main">${escapeHtml(themeObj.name)}</div>
                    <div class="pcx-title-sub">${escapeHtml(themeObj.sub)}</div>
                </div>
            </div>
            <div class="pcx-header-actions">
                <button type="button" class="pcx-icon-btn ${uiState.showThemes ? 'pcx-active' : ''}" id="pcx-btn-themes">
                    ${ICONS.palette}<span>Тема</span>
                </button>
                <button type="button" class="pcx-icon-btn ${uiState.view === 'inject' ? 'pcx-active' : ''}" id="pcx-btn-inject">
                    ${ICONS.sliders}<span>Обзор</span>
                </button>
                <button type="button" class="pcx-icon-btn" id="pcx-btn-close" title="Закрыть">${ICONS.close}</button>
            </div>
        </div>

        <div class="pcx-theme-strip ${uiState.showThemes ? 'pcx-show' : ''}">
            ${themePillsHtml}
        </div>

        <div class="pcx-nav-wrap">
            <div class="pcx-nav-top">
                <div class="pcx-scope-switch">
                    <button type="button" class="pcx-scope-btn ${effectiveScope === 'chat' ? 'pcx-active' : ''}" data-scope="chat" ${!chatOpen ? 'disabled title="Сначала открой любой чат с персонажем"' : ''}>
                        ${ICONS.chat}<span>${chatOpen ? 'Этот чат' : 'Чат не открыт'}</span>
                    </button>
                    <button type="button" class="pcx-scope-btn ${effectiveScope === 'global' ? 'pcx-active' : ''}" data-scope="global">
                        ${ICONS.globe}<span>Общие</span>
                    </button>
                </div>

                ${uiState.view === 'notes' && currentCat ? `
                    <div style="display:flex;align-items:center;gap:5px;">
                        <button type="button" class="pcx-mini-btn" id="pcx-rename-cat" title="Переименовать этот раздел">${ICONS.edit}</button>
                        <button type="button" class="pcx-mini-btn" id="pcx-toggle-cat">${catEnabled ? 'Выкл. раздел' : 'Вкл. раздел'}</button>
                        ${store.categories.length > 1 ? `<button type="button" class="pcx-mini-btn" id="pcx-delete-cat" title="Удалить этот раздел">${ICONS.trash}</button>` : ''}
                    </div>
                ` : ''}
            </div>

            <div class="pcx-tabs-bar">
                ${tabsHtml}
            </div>
        </div>

        <div class="pcx-body">
            ${bodyHtml}
        </div>

        <div class="pcx-footer">
            <span style="font-size:12px;color:var(--pcx-text-muted)">
                Активно записей: <b>${countAllActiveNotes()}</b>
            </span>
            <button type="button" class="pcx-primary-btn" id="pcx-new-note-btn">${ICONS.plus}<span>Новая запись</span></button>
        </div>
    `;

    bindModalEvents();
    enableTabTouchAndMouseReorder(win, store, s);
    if (uiState.view === 'notes' && currentCat) {
        enableCardTouchReorder(win, store, currentCat.id);
    }
}

function resetEditDrafts() {
    delete uiState.draftTitle;
    delete uiState.draftContent;
    delete uiState.draftPrio;
    delete uiState.draftCat;
    uiState.aiStatus = '';
}

function captureCurrentEditFields(win) {
    if (!win) return;
    const t = win.querySelector('#pcx-note-title');
    const c = win.querySelector('#pcx-note-content');
    const p = win.querySelector('#pcx-note-prio');
    const cat = win.querySelector('#pcx-note-cat');
    const task = win.querySelector('#pcx-ai-task');
    const gmSys = win.querySelector('#pcx-gm-sys-prompt');
    if (t) uiState.draftTitle = t.value;
    if (c) uiState.draftContent = c.value;
    if (p) uiState.draftPrio = p.value;
    if (cat) uiState.draftCat = cat.value;
    if (task) uiState.aiPromptDraft = task.value;
    if (gmSys) {
        ensureSettings().gmSystemPrompt = gmSys.value;
    }
}

function bindModalEvents() {
    const s = ensureSettings();
    const store = getActiveStore();
    const currentCat = store.categories.find(c => c.id === s.activeTab) || store.categories[0];
    const win = document.getElementById('pcx-window');
    if (!win) return;

    win.querySelector('#pcx-btn-close')?.addEventListener('click', closeModal);

    win.querySelector('#pcx-note-title')?.addEventListener('input', e => { uiState.draftTitle = e.target.value; });
    win.querySelector('#pcx-note-content')?.addEventListener('input', e => { uiState.draftContent = e.target.value; });
    win.querySelector('#pcx-note-prio')?.addEventListener('change', e => { uiState.draftPrio = e.target.value; });
    win.querySelector('#pcx-note-cat')?.addEventListener('change', e => { uiState.draftCat = e.target.value; });
    win.querySelector('#pcx-ai-task')?.addEventListener('input', e => { uiState.aiPromptDraft = e.target.value; });
    win.querySelector('#pcx-gm-sys-prompt')?.addEventListener('input', e => {
        s.gmSystemPrompt = e.target.value;
        stApi.saveSettings();
    });

    win.querySelector('#pcx-toggle-sec-inject')?.addEventListener('click', () => {
        uiState.showSectionInject = !uiState.showSectionInject;
        renderModal();
    });

    win.querySelector('#pcx-sec-pos')?.addEventListener('change', (e) => {
        if (!currentCat) return;
        currentCat.injectPos = Number(e.target.value);
        saveAll();
        renderModal();
    });

    win.querySelector('#pcx-sec-depth')?.addEventListener('input', (e) => {
        if (!currentCat) return;
        currentCat.injectDepth = Math.max(0, Number(e.target.value) || 0);
        saveAll();
        const lbl = win.querySelector('.pcx-sec-inject-label b');
        if (lbl) lbl.textContent = describeCategoryRoute(currentCat);
    });

    win.querySelector('#pcx-sec-role')?.addEventListener('change', (e) => {
        if (!currentCat) return;
        currentCat.injectRole = Number(e.target.value);
        saveAll();
        renderModal();
    });

    win.querySelector('#pcx-sec-interval')?.addEventListener('input', (e) => {
        if (!currentCat) return;
        currentCat.injectInterval = Math.max(1, Number(e.target.value) || 1);
        saveAll();
        const lbl = win.querySelector('.pcx-sec-inject-label b');
        if (lbl) lbl.textContent = describeCategoryRoute(currentCat);
    });

    win.querySelector('#pcx-sec-header')?.addEventListener('change', (e) => {
        if (!currentCat) return;
        currentCat.showHeader = e.target.checked;
        saveAll();
    });

    win.querySelectorAll('.pcx-mode-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            captureCurrentEditFields(win);
            uiState.editTab = btn.dataset.edittab;
            renderModal();
        });
    });

    win.querySelector('#pcx-toggle-ai-help')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.showAiHelp = !uiState.showAiHelp;
        renderModal();
    });

    win.querySelector('#pcx-toggle-gm-prompt')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.showGmPromptEditor = !uiState.showGmPromptEditor;
        renderModal();
    });

    win.querySelector('#pcx-reset-gm-prompt')?.addEventListener('click', () => {
        s.gmSystemPrompt = DEFAULT_GM_SYSTEM_PROMPT;
        saveAll();
        renderModal();
    });

    win.querySelector('#pcx-btn-themes')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.showThemes = !uiState.showThemes;
        renderModal();
    });

    win.querySelector('#pcx-btn-inject')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.view = uiState.view === 'inject' ? 'notes' : 'inject';
        renderModal();
    });

    win.querySelectorAll('.pcx-theme-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            captureCurrentEditFields(win);
            s.theme = btn.dataset.theme;
            saveAll();
            renderModal();
        });
    });

    win.querySelectorAll('.pcx-scope-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            resetEditDrafts();
            s.scope = btn.dataset.scope;
            uiState.view = 'notes';
            saveAll();
            renderModal();
        });
    });

    win.querySelector('#pcx-add-tab-btn')?.addEventListener('click', () => {
        resetEditDrafts();
        uiState.renamingTabId = null;
        uiState.view = 'tab_form';
        renderModal();
    });

    // Fix #6: Rename existing section cleanly without losing its notes!
    win.querySelector('#pcx-rename-cat')?.addEventListener('click', () => {
        if (!currentCat) return;
        resetEditDrafts();
        uiState.renamingTabId = currentCat.id;
        uiState.view = 'tab_form';
        renderModal();
    });

    win.querySelector('#pcx-cancel-tab')?.addEventListener('click', () => {
        uiState.renamingTabId = null;
        uiState.view = 'notes';
        renderModal();
    });

    win.querySelector('#pcx-create-tab-confirm')?.addEventListener('click', () => {
        const name = win.querySelector('#pcx-new-tab-name')?.value?.trim();
        if (!name) return;
        const pos = Number(win.querySelector('#pcx-new-tab-pos')?.value ?? 1);

        if (uiState.renamingTabId) {
            const targetCat = store.categories.find(c => c.id === uiState.renamingTabId);
            if (targetCat) {
                targetCat.name = name;
                targetCat.injectPos = pos;
            }
            uiState.renamingTabId = null;
        } else {
            const newId = 'cat_' + Date.now();
            store.categories.unshift(makeDefaultCategory(newId, name, pos, 2, 0, true));
            s.activeTab = newId;
        }
        uiState.view = 'notes';
        saveAll();
        renderModal();
    });

    win.querySelector('#pcx-toggle-cat')?.addEventListener('click', () => {
        if (currentCat) {
            currentCat.enabled = currentCat.enabled === false ? true : false;
            saveAll();
            renderModal();
        }
    });

    win.querySelector('#pcx-delete-cat')?.addEventListener('click', () => {
        if (store.categories.length <= 1) return;
        if (!window.confirm(`Удалить раздел «${currentCat?.name || ''}» и все записи внутри него?`)) return;
        store.notes = store.notes.filter(n => n.categoryId !== s.activeTab);
        store.categories = store.categories.filter(c => c.id !== s.activeTab);
        s.activeTab = store.categories[0].id;
        saveAll();
        renderModal();
    });

    win.querySelector('#pcx-new-note-btn')?.addEventListener('click', () => {
        resetEditDrafts();
        uiState.view = 'edit';
        uiState.editTab = 'manual';
        uiState.editingNoteId = null;
        renderModal();
    });

    win.querySelector('#pcx-ai-profile')?.addEventListener('change', (e) => {
        s.aiProfileId = e.target.value;
        saveAll();
    });

    win.querySelector('#pcx-ai-lang')?.addEventListener('change', (e) => {
        s.aiLang = e.target.value;
        saveAll();
    });

    win.querySelector('#pcx-ai-wmin')?.addEventListener('input', (e) => {
        s.aiWordsMin = Math.max(0, Math.min(5000, Number(e.target.value) || 0));
        saveAll();
    });

    win.querySelector('#pcx-ai-wmax')?.addEventListener('input', (e) => {
        s.aiWordsMax = Math.max(0, Math.min(5000, Number(e.target.value) || 0));
        saveAll();
    });

    win.querySelector('#pcx-ai-radius')?.addEventListener('input', (e) => {
        s.aiChatRadius = Math.max(0, Math.min(200, Number(e.target.value) || 0));
        saveAll();
    });

    win.querySelector('#pcx-ai-char-desc')?.addEventListener('change', (e) => {
        s.aiSendCharDesc = e.target.checked;
        saveAll();
    });

    win.querySelector('#pcx-ai-user-desc')?.addEventListener('change', (e) => {
        s.aiSendUserDesc = e.target.checked;
        saveAll();
    });

    win.querySelector('#pcx-run-ai-btn')?.addEventListener('click', async () => {
        if (uiState.aiGenerating) return;
        captureCurrentEditFields(win);
        const taskText = uiState.aiPromptDraft || '';
        const currentContent = uiState.draftContent || '';
        if (!taskText.trim() && !currentContent.trim()) {
            uiState.aiStatus = 'Опиши задачу для соавтора в поле выше.';
            renderModal();
            return;
        }

        uiState.aiGenerating = true;
        uiState.aiStatus = 'Соавтор пишет заметку...';
        renderModal();

        try {
            const result = await runAiNoteGeneration(taskText, currentContent);
            if (result.content) {
                uiState.draftContent = result.content;
                if (result.title && !(uiState.draftTitle && uiState.draftTitle.trim())) {
                    uiState.draftTitle = result.title;
                }
                uiState.aiStatus = '';
                uiState.editTab = 'manual';
            } else {
                uiState.aiStatus = 'Модель вернула пустой ответ.';
            }
        } catch (err) {
            console.error('[Pocket Codex AI]', err);
            uiState.aiStatus = 'Ошибка: ' + (err?.message || String(err));
        } finally {
            uiState.aiGenerating = false;
            renderModal();
        }
    });

    win.querySelector('#pcx-cancel-edit')?.addEventListener('click', () => {
        resetEditDrafts();
        uiState.view = 'notes';
        uiState.editingNoteId = null;
        renderModal();
    });

    win.querySelector('#pcx-save-note')?.addEventListener('click', () => {
        const catId = win.querySelector('#pcx-note-cat')?.value || s.activeTab;
        const prio = win.querySelector('#pcx-note-prio')?.value || 'normal';
        const title = win.querySelector('#pcx-note-title')?.value?.trim() || '';
        const content = win.querySelector('#pcx-note-content')?.value?.trim() || '';
        if (!content) return;

        if (uiState.editingNoteId) {
            const target = store.notes.find(n => n.id === uiState.editingNoteId);
            if (target) {
                target.categoryId = catId;
                target.priority = prio;
                target.title = title;
                target.content = content;
            }
        } else {
            store.notes.unshift({
                id: 'note_' + Date.now(),
                categoryId: catId,
                priority: prio,
                title,
                content,
                enabled: true,
            });
        }
        s.activeTab = catId;
        resetEditDrafts();
        uiState.view = 'notes';
        uiState.editingNoteId = null;
        saveAll();
        renderModal();
    });

    win.querySelectorAll('[data-action="toggle"]').forEach(el => {
        el.addEventListener('click', () => {
            const note = store.notes.find(n => n.id === el.dataset.id);
            if (note) {
                note.enabled = note.enabled === false ? true : false;
                saveAll();
                renderModal();
            }
        });
    });

    win.querySelectorAll('[data-action="edit"]').forEach(el => {
        el.addEventListener('click', () => {
            resetEditDrafts();
            uiState.view = 'edit';
            uiState.editTab = 'manual';
            uiState.editingNoteId = el.dataset.id;
            renderModal();
        });
    });

    win.querySelectorAll('[data-action="delete"]').forEach(el => {
        el.addEventListener('click', () => {
            if (!window.confirm('Удалить эту запись из Кодекса?')) return;
            store.notes = store.notes.filter(n => n.id !== el.dataset.id);
            saveAll();
            renderModal();
        });
    });

    win.querySelector('#pcx-replace-an')?.addEventListener('change', (e) => {
        s.replaceAuthorsNote = e.target.checked;
        const drawerChk = document.getElementById('pcx-toggle-replace-an-drawer');
        if (drawerChk) drawerChk.checked = s.replaceAuthorsNote;
        saveAll();
        renderModal();
    });

    win.querySelector('#pcx-import-legacy-an')?.addEventListener('click', () => {
        if (importAndClearLegacyAuthorsNote()) {
            s.activeTab = 'classic_an';
            uiState.view = 'notes';
            renderModal();
        }
    });

    win.querySelector('#pcx-inc-global')?.addEventListener('change', (e) => {
        s.includeGlobalWithChat = e.target.checked;
        saveAll();
        renderModal();
    });

    win.querySelectorAll('.pcx-macro-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const txt = chip.dataset.copy;
            navigator.clipboard?.writeText(txt);
            chip.innerHTML = `${ICONS.check}<span>Скопировано: ${escapeHtml(txt)}</span>`;
            setTimeout(() => {
                chip.innerHTML = `${ICONS.copy}<span>${escapeHtml(txt)}</span>`;
            }, 1300);
        });
    });
}

function openModal(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
        e.stopPropagation();
    }
    ensureStylesAndFonts();
    let dlg = document.getElementById('pcx-dialog');
    if (!dlg) {
        mountUI();
        dlg = document.getElementById('pcx-dialog');
    }
    if (!dlg) return;

    renderModal();

    if (!dlg.open) {
        try {
            dlg.showModal();
        } catch {
            dlg.setAttribute('open', '');
        }
    }
}

function closeModal() {
    if (uiState.aiGenerating) return;
    const win = document.getElementById('pcx-window');
    if (uiState.view === 'edit') captureCurrentEditFields(win);

    const dlg = document.getElementById('pcx-dialog');
    if (!dlg) return;
    try {
        if (dlg.open) dlg.close();
        else dlg.removeAttribute('open');
    } catch {
        dlg.removeAttribute('open');
    }
}

function setupAuthorsNoteInterceptor() {
    if (window.__pcxAnInterceptorBound) return;
    window.__pcxAnInterceptorBound = true;

    document.addEventListener('click', (e) => {
        const target = e.target?.closest?.('#option_toggle_AN, #AN_button');
        if (!target) return;
        const s = ensureSettings();
        if (!s.replaceAuthorsNote) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const optMenu = document.getElementById('options');
        if (optMenu) optMenu.style.display = 'none';

        openModal();
    }, true);
}

function mountExtensionMenuEntries() {
    document.getElementById('pcx-fab')?.remove();
    document.getElementById('pcx-sendbar-btn')?.remove();
    document.getElementById('pcx-wand-item')?.remove();

    const extMenu = document.getElementById('extensionsMenu');
    if (extMenu && !document.getElementById('pcx-wand-fallback')) {
        const item = document.createElement('div');
        item.id = 'pcx-wand-fallback';
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.innerHTML = `<span style="width:18px;height:18px;display:inline-flex">${ICONS.book}</span><span>Кодекс Автора</span>`;
        item.addEventListener('click', openModal);
        extMenu.appendChild(item);
    }

    const extSettings = document.getElementById('extensions_settings');
    if (extSettings && !document.getElementById('pcx-settings-drawer')) {
        const s = ensureSettings();
        const drawer = document.createElement('div');
        drawer.id = 'pcx-settings-drawer';
        drawer.className = 'inline-drawer';
        drawer.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Pocket Codex (Кодекс Автора)</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display:none;padding:10px;">
                <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
                    <button type="button" id="pcx-open-from-settings" class="menu_button pcx-drawer-btn">
                        ${ICONS.book}<span>Открыть Кодекс Автора</span>
                    </button>
                    <label class="checkbox_label" style="margin-top:4px;">
                        <input type="checkbox" id="pcx-toggle-replace-an-drawer" ${s.replaceAuthorsNote ? 'checked' : ''}>
                        <span>Заменять стандартные «Заметки Автора» этим Кодексом</span>
                    </label>
                </div>
            </div>
        `;
        extSettings.appendChild(drawer);

        drawer.querySelector('#pcx-open-from-settings')?.addEventListener('click', openModal);
        drawer.querySelector('#pcx-toggle-replace-an-drawer')?.addEventListener('change', (e) => {
            const st = ensureSettings();
            st.replaceAuthorsNote = e.target.checked;
            saveAll();
        });
    }
}

function mountUI() {
    ensureStylesAndFonts();

    // Fix #5: Safe backdrop pointerdown+pointerup check so text-selection drag never closes modal!
    if (!document.getElementById('pcx-dialog')) {
        const dlg = document.createElement('dialog');
        dlg.id = 'pcx-dialog';
        dlg.innerHTML = `<div id="pcx-window"></div>`;
        let downOnBackdrop = false;
        dlg.addEventListener('pointerdown', e => {
            downOnBackdrop = (e.target === dlg);
        });
        dlg.addEventListener('click', e => {
            if (downOnBackdrop && e.target === dlg) closeModal();
            downOnBackdrop = false;
        });
        document.body.appendChild(dlg);
    }

    mountExtensionMenuEntries();
    setupAuthorsNoteInterceptor();
    syncAuthorsNoteReplacementUI();
    applyThemeClasses();
    updateExtensionPrompt();
}

jQuery(async () => {
    await initStApi();
    ensureSettings();
    mountUI();
    registerNotebookMacroOnce();

    const evSource = stApi.eventSource;
    const evTypes = stApi.eventTypes;

    if (evSource && typeof evSource.on === 'function') {
        if (evTypes.CHAT_CHANGED) {
            evSource.on(evTypes.CHAT_CHANGED, () => {
                resetEditDrafts();
                syncAuthorsNoteReplacementUI();
                updateExtensionPrompt();
                const dlg = document.getElementById('pcx-dialog');
                if (dlg?.open) renderModal();
            });
        }

        // Fix #3: Keep turn intervals & native AN synced across all chat mutations
        const syncEvents = [
            evTypes.GENERATION_STARTED,
            evTypes.MESSAGE_SENT,
            evTypes.MESSAGE_RECEIVED,
            evTypes.MESSAGE_DELETED,
            evTypes.MESSAGE_SWIPED,
        ].filter(Boolean);

        for (const evName of syncEvents) {
            evSource.on(evName, () => {
                updateExtensionPrompt();
            });
        }
    }
});
