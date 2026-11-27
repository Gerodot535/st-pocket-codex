import { ICONS, LANGUAGES, renderProceduralCoverSvg } from './themes_and_icons.js?v=1.1.6';
import { executePcxAiRequest, toBlobDisplayUrl, readImageFileLossless } from './ai_engine.js?v=1.1.6';
import {
    FORGE_BOOK_PRESETS,
    formatCleanParagraphs,
    analyzeBookRecursion,
    buildEntryCountPhrase,
    parseSmartTriggerKeys,
    isSchemaUnsupportedError,
    unwrapAndParseModelJson,
    matchTriggerKeyInText,
    checkEntrySecondaryKeysInText,
    tUi,
    displayCategoryName,
} from './presets_and_i18n.js?v=1.1.6';

const FORGE_JSON_SCHEMA = {
    name: 'lorebook_forge_entries',
    strict: true,
    value: {
        type: 'object',
        properties: {
            entries: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        comment: { type: 'string' },
                        keys: { type: 'array', items: { type: 'string' } },
                        content: { type: 'string' },
                        constant: { type: 'boolean' },
                        position: { type: 'number' },
                        depth: { type: 'number' },
                    },
                    required: ['comment', 'keys', 'content', 'constant', 'position', 'depth'],
                    additionalProperties: false,
                },
            },
        },
        required: ['entries'],
        additionalProperties: false,
    },
};

const SINGLE_PAGE_JSON_SCHEMA = {
    name: 'lorebook_single_entry',
    strict: true,
    value: {
        type: 'object',
        properties: {
            comment: { type: 'string' },
            keys: { type: 'array', items: { type: 'string' } },
            content: { type: 'string' },
            constant: { type: 'boolean' },
        },
        required: ['comment', 'keys', 'content', 'constant'],
        additionalProperties: false,
    },
};

const KEYS_ONLY_JSON_SCHEMA = {
    name: 'lorebook_keys_only',
    strict: true,
    value: {
        type: 'object',
        properties: {
            comment: { type: 'string' },
            keys: { type: 'array', items: { type: 'string' } },
        },
        required: ['comment', 'keys'],
        additionalProperties: false,
    },
};

const VERBATIM_META_JSON_SCHEMA = {
    name: 'lorebook_verbatim_metadata',
    strict: true,
    value: {
        type: 'object',
        properties: {
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        index: { type: 'number' },
                        comment: { type: 'string' },
                        keys: { type: 'array', items: { type: 'string' } },
                        constant: { type: 'boolean' },
                        position: { type: 'number' },
                        depth: { type: 'number' },
                    },
                    required: ['index', 'comment', 'keys', 'constant', 'position', 'depth'],
                    additionalProperties: false,
                },
            },
        },
        required: ['items'],
        additionalProperties: false,
    },
};

function parseSafeDepth(val, fallback = 4) {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function parseSafePosition(val, fallback = 1) {
    const n = Number(val);
    return Number.isInteger(n) && n >= 0 && n <= 7 ? n : fallback;
}

function renderPositionOptions(selectedPos, uiLang = 'ru') {
    const p = parseSafePosition(selectedPos, 1);
    const opts = [
        [0, tUi(uiLang, 'До описания чара', 'Before Char Defs')],
        [1, tUi(uiLang, 'После описания чара', 'After Char Defs')],
        [2, tUi(uiLang, 'До Заметок Автора (AN)', 'Before Author\'s Note')],
        [3, tUi(uiLang, 'После Заметок Автора (AN)', 'After Author\'s Note')],
        [4, tUi(uiLang, 'В глубине чата (@ Depth)', 'In-Chat @ Depth')],
        [5, tUi(uiLang, 'Перед примерами речи', 'Top of Examples')],
        [6, tUi(uiLang, 'После примеров речи', 'Bottom of Examples')],
        [7, tUi(uiLang, 'Шлюз Outlet', 'Outlet')],
    ];
    return opts.map(([val, label]) => `<option value="${val}" ${p === val ? 'selected' : ''}>${label}</option>`).join('');
}

function makeStandardWiEntry(uid, item = {}, wiTemplate = null) {
    const numUid = Number(uid);
    const rawKeys = item.key !== undefined ? item.key : item.keys;
    const keysArr = parseSmartTriggerKeys(rawKeys);
    const base = (wiTemplate && typeof wiTemplate === 'object')
        ? JSON.parse(JSON.stringify(wiTemplate))
        : {};
    return {
        ...base,
        uid: numUid,
        key: keysArr,
        keysecondary: Array.isArray(item.keysecondary) ? item.keysecondary : [],
        comment: String(item.comment || 'Статья лора').trim().slice(0, 95),
        content: String(item.content || '').trim(),
        constant: Boolean(item.constant),
        vectorized: Boolean(item.vectorized),
        selective: item.selective !== undefined ? Boolean(item.selective) : true,
        selectiveLogic: Number(item.selectiveLogic) || 0,
        addMemo: true,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : 100,
        position: parseSafePosition(item.position, 1),
        disable: Boolean(item.disable),
        excludeRecursion: Boolean(item.excludeRecursion),
        preventRecursion: Boolean(item.preventRecursion),
        delayUntilRecursion: typeof base.delayUntilRecursion === 'number'
            ? (Number(item.delayUntilRecursion) || 0)
            : Boolean(item.delayUntilRecursion),
        probability: Number.isFinite(Number(item.probability)) ? Number(item.probability) : 100,
        useProbability: item.useProbability !== undefined ? Boolean(item.useProbability) : true,
        depth: parseSafeDepth(item.depth, 4),
        outletName: String(item.outletName || '').trim(),
        group: item.group || '',
        groupOverride: Boolean(item.groupOverride),
        groupWeight: Number.isFinite(Number(item.groupWeight)) ? Number(item.groupWeight) : 100,
        scanDepth: item.scanDepth ?? null,
        caseSensitive: item.caseSensitive ?? null,
        matchWholeWords: item.matchWholeWords ?? null,
        useGroupScoring: item.useGroupScoring ?? null,
        automationId: item.automationId || '',
        role: item.role !== undefined ? Number(item.role) : 0,
        sticky: item.sticky !== undefined && item.sticky !== null ? Number(item.sticky) : (base.sticky ?? null),
        cooldown: item.cooldown !== undefined && item.cooldown !== null ? Number(item.cooldown) : (base.cooldown ?? null),
        delay: item.delay !== undefined && item.delay !== null ? Number(item.delay) : (base.delay ?? null),
        displayIndex: Number.isFinite(Number(item.displayIndex)) ? Number(item.displayIndex) : numUid,
    };
}

const SAFE_COVER_DATA_URL_RE = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

export function sanitizeCoverDataUrl(raw) {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > 4_000_000) return '';
    return SAFE_COVER_DATA_URL_RE.test(trimmed) ? trimmed.replace(/\s+/g, '') : '';
}

const FORGE_SCALAR_FIELDS = [
    'comment', 'content', 'constant', 'vectorized',
    'position', 'depth', 'role', 'outletName',
    'preventRecursion', 'excludeRecursion',
];

function normalizeEntryEditableSnapshot(ent = {}) {
    return {
        comment: String(ent.comment ?? '').trim().slice(0, 95),
        content: String(ent.content ?? ''),
        constant: Boolean(ent.constant),
        vectorized: Boolean(ent.vectorized),
        position: parseSafePosition(ent.position, 1),
        depth: parseSafeDepth(ent.depth, 4),
        role: Number.isFinite(Number(ent.role)) ? Number(ent.role) : 0,
        outletName: String(ent.outletName ?? '').trim(),
        preventRecursion: Boolean(ent.preventRecursion),
        excludeRecursion: Boolean(ent.excludeRecursion),
        key: Array.isArray(ent.key) ? ent.key.map(k => String(k)) : parseSmartTriggerKeys(ent.key),
    };
}

function shallowEqualField(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((v, idx) => v === b[idx]);
    }
    return a === b;
}

function pluralizePages(n, uiLang = 'ru') {
    if (uiLang === 'en') return n === 1 ? '1 page' : `${n} pages`;
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} страница`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} страницы`;
    return `${n} страниц`;
}

export function createForgeController(deps) {
    const {
        stApi, escapeHtml, renderHelpBtn, renderHelpBubble,
        compressImageFile, readTextAttachment, getActiveStore,
        ensureSettings, getConnectionProfiles, getCharacterDescriptionText,
        getEffectiveScenarioText, getCharacterSourcePickerState,
        setCharacterSourceSelection, bindLorebookToTargetChar,
        getUserPersonaDescriptionText, buildChatContextSnippet, buildWordLimitPhrase,
        saveAllCodex, requestRender,
    } = deps;

    const state = {
        screen: 'shelf',
        books: [],
        bookCounts: {},
        loading: false,
        showRecursionPanel: false,

        activeBookId: '',
        activeBookData: null,

        newBookName: '',
        newBookCover: '',
        newBookBindScope: 'none',

        bindDrawerMode: '',      // '' | 'char' | 'chat'
        bindCharQuery: '',
        bindChatCharAvatar: '',
        bindChatList: [],
        bindChatLoading: false,

        shelfQuery: '',
        shelfFilter: 'all',
        entryQuery: '',
        entryFilter: 'all',
        saveError: '',
        lastDeletedEntry: null,

        // Single-page editor (manual + AI co-author with presets & word limits)
        entrySessionId: 0,
        entryTracker: null,
        entryCreatedUid: null,
        entrySavingBusy: false,
        editingUid: null,
        editingOriginBookId: '',
        entryBaseSnapshot: null,
        entryConflictForceHash: '',
        entryOriginalKeys: null,
        entryKeysRawText: '',
        entryKeysDirty: false,
        entryDraft: null,
        entryTargetBookId: '',
        entryEditTab: 'manual',
        showPagePromptEditor: false,
        pageAiTask: '',
        pageAiMatchFormat: true,
        pageAiUseChar: true,
        pageAiUsePersona: false,
        pageAiUseChat: true,
        pageAiGenerating: false,
        pageAiStatus: '',
        pageAiCandidates: [],
        pageAiCandIdx: 0,
        pageAiRefineText: '',
        keysGenerating: false,

        // Full Lorebook Wizard
        showBookPromptEditor: false,
        wizUseChar: true,
        wizUseScenario: true,
        wizUsePersona: false,
        wizUseChat: true,
        wizChatCount: 12,
        wizSelectedCats: {},
        wizMuteExportedCats: false,
        wizUploadedDocs: [],
        wizCustomPrompt: '',
        wizMode: 'ai_adapt',
        wizForging: false,
        wizStatus: '',
        wizOriginSession: null,
        commitSavingBusy: false,
        manualCreateBusy: false,
        undoBusy: false,

        stagedEntries: [],
        stagedCollapsed: {},
        targetBookMode: 'new',
        targetBookName: '',
        targetExistingId: '',
        targetCover: '',
        bindAfterScope: 'none',
    };

    let bookLoadSeq = 0;
    let forgeAiSeq = 0;
    let chatEpoch = 0;
    let entrySessionSeq = 0;
    let recCacheSig = '';
    let recCacheValue = null;

    function getCachedRecursionReport(entriesObj) {
        const entries = Object.values(entriesObj || {});
        const parts = [stApi.ctx?.name1, stApi.ctx?.name2].filter(Boolean);
        const wiMod = stApi.worldInfoMod;
        const sig = JSON.stringify({
            parts,
            ww: wiMod?.world_info_match_whole_words,
            cs: wiMod?.world_info_case_sensitive,
            items: entries.map(e => [e?.uid, e?.disable, e?.constant, e?.preventRecursion, e?.excludeRecursion, e?.key, e?.keysecondary, e?.selective, e?.selectiveLogic, e?.matchWholeWords, e?.caseSensitive, (e?.content || '').length, (e?.content || '').slice(0, 64)]),
        });
        if (sig === recCacheSig && recCacheValue) return recCacheValue;
        recCacheSig = sig;
        recCacheValue = analyzeBookRecursion(entriesObj, parts, {
            matchWholeWords: wiMod?.world_info_match_whole_words,
            caseSensitive: wiMod?.world_info_case_sensitive,
        });
        return recCacheValue;
    }

    function getBookCollapsedMap(bookId) {
        const s = ensureSettings();
        if (!s.collapsedForgeEntries || typeof s.collapsedForgeEntries !== 'object') {
            s.collapsedForgeEntries = {};
        }
        if (!s.collapsedForgeEntries[bookId] || typeof s.collapsedForgeEntries[bookId] !== 'object') {
            s.collapsedForgeEntries[bookId] = {};
        }
        return s.collapsedForgeEntries[bookId];
    }

    function getAllForgeBookPresets() {
        const s = ensureSettings();
        const custom = Array.isArray(s.customForgePresets)
            ? s.customForgePresets.filter(p => p && p.id && p.name).map(p => ({ ...p, isCustom: true }))
            : [];
        return [...FORGE_BOOK_PRESETS, ...custom];
    }

    function getActiveForgeBookPreset() {
        const s = ensureSettings();
        const all = getAllForgeBookPresets();
        return all.find(p => p.id === s.forgePresetId) || all[0];
    }

    async function callForgeModel(systemPrompt, userPrompt, schemaObj, maxTokens = 3800) {
        const s = ensureSettings();
        const uiLang = s.uiLang || 'ru';
        const profileId = (s.aiProfileId || '').trim();
        let profileLabel = tUi(uiLang, '[ Текущее подключение SillyTavern ]', '[ Current SillyTavern Connection ]');
        if (profileId) {
            const chosen = getConnectionProfiles().find(p => p.id === profileId);
            if (!chosen) {
                throw new Error(tUi(
                    uiLang,
                    'Выбранный профиль подключения ИИ больше не существует. Выберите другой профиль в списке.',
                    'The selected AI Connection Profile no longer exists. Please choose another profile.',
                ));
            }
            profileLabel = chosen.name || profileId;
        }
        return await executePcxAiRequest({
            stApi,
            settings: { ...s, aiMaxTokens: maxTokens },
            profileId,
            profileLabel,
            systemPrompt,
            userPrompt,
            jsonSchema: schemaObj,
        });
    }

    function parseJsonObjectFromModel(raw, expectedKind = 'any') {
        return unwrapAndParseModelJson(raw, expectedKind);
    }

    async function fetchBooksList({ strict = false } = {}) {
        state.loading = true;
        try {
            const res = await fetch('/api/worldinfo/list', {
                method: 'POST', headers: stApi.getRequestHeaders(), body: JSON.stringify({}),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} /api/worldinfo/list`);
            }
            const list = await res.json();
            if (!Array.isArray(list)) {
                throw new Error('Invalid /api/worldinfo/list payload');
            }
            state.books = list;
            hydrateBookCountsInBackground(state.books);
            return list;
        } catch (err) {
            console.warn('[Forge] List error:', err);
            if (strict) throw err;
            return state.books;
        } finally {
            state.loading = false;
        }
    }

    let hydratingCounts = false;
    async function hydrateBookCountsInBackground(booksList) {
        if (hydratingCounts) return;
        const missing = (booksList || []).filter(b => state.bookCounts[b.file_id] === undefined);
        if (!missing.length) return;
        hydratingCounts = true;
        let anyChanged = false;
        try {
            const chunkSize = 6;
            for (let i = 0; i < missing.length; i += chunkSize) {
                const batch = missing.slice(i, i + chunkSize);
                await Promise.all(batch.map(async (b) => {
                    try {
                        const data = await loadBookData(b.file_id);
                        state.bookCounts[b.file_id] = Object.keys(data.entries || {}).length;
                        const safeCover = sanitizeCoverDataUrl(data.extensions?.pocket_codex_cover);
                        if (safeCover && (!b.extensions || !b.extensions.pocket_codex_cover)) {
                            b.extensions = b.extensions || {};
                            b.extensions.pocket_codex_cover = safeCover;
                        }
                        anyChanged = true;
                    } catch {}
                }));
            }
            if (anyChanged && state.screen === 'shelf') {
                const activeEl = document.activeElement;
                if (!activeEl || activeEl.id !== 'pcx-fg-shelf-search') {
                    requestRender({ preserveBodyScroll: true });
                }
            }
        } finally {
            hydratingCounts = false;
        }
    }

    function normalizeLoadedEntries(data) {
        if (!data || typeof data !== 'object') return { entries: {}, extensions: {} };
        if (!data.entries || typeof data.entries !== 'object') data.entries = {};
        if (!data.extensions || typeof data.extensions !== 'object') data.extensions = {};
        for (const [k, ent] of Object.entries(data.entries)) {
            if (!ent || typeof ent !== 'object') {
                delete data.entries[k];
                continue;
            }
            if (ent.uid === undefined || ent.uid === null || ent.uid === '') {
                const numK = Number(k);
                ent.uid = Number.isNaN(numK) ? k : numK;
            }
        }
        return data;
    }

    const bookWriteQueues = new Map();

    function enqueueBookWrite(fileId, taskFn) {
        const key = String(fileId || '');
        const prev = bookWriteQueues.get(key) || Promise.resolve();
        const runPromise = prev.catch(() => {}).then(() => taskFn());
        const queueTail = runPromise.catch(() => {}).finally(() => {
            if (bookWriteQueues.get(key) === queueTail) {
                bookWriteQueues.delete(key);
            }
        });
        bookWriteQueues.set(key, queueTail);
        return runPromise;
    }

    async function loadBookData(fileId, { preferCache = true } = {}) {
        const wiCache = stApi.worldInfoMod?.worldInfoCache;
        if (preferCache && wiCache && typeof wiCache.has === 'function' && wiCache.has(fileId)) {
            const cached = wiCache.get(fileId);
            if (cached && typeof cached === 'object') {
                const cloned = normalizeLoadedEntries(JSON.parse(JSON.stringify(cached)));
                state.bookCounts[fileId] = Object.keys(cloned.entries).length;
                return cloned;
            }
        }
        const res = await fetch('/api/worldinfo/get', {
            method: 'POST', headers: stApi.getRequestHeaders(), body: JSON.stringify({ name: fileId }), cache: 'no-cache',
        });
        if (!res.ok) throw new Error(`Не удалось загрузить файл Лорбука (HTTP ${res.status}).`);
        const data = normalizeLoadedEntries(await res.json());
        try { wiCache?.set?.(fileId, JSON.parse(JSON.stringify(data))); } catch {}
        state.bookCounts[fileId] = Object.keys(data.entries).length;
        return data;
    }

    async function openBookAtomic(fileId) {
        const seq = ++bookLoadSeq;
        state.saveError = '';
        const data = await loadBookData(fileId, { preferCache: false });
        if (seq !== bookLoadSeq) return null;
        state.activeBookId = fileId;
        state.activeBookData = data;
        return data;
    }

    async function saveBookData(fileId, data, { refreshList = false } = {}) {
        const isNewBookFile = refreshList || !state.books.some(b => b.file_id === fileId);
        const payload = normalizeLoadedEntries(JSON.parse(JSON.stringify(data)));
        if (payload.extensions && Object.prototype.hasOwnProperty.call(payload.extensions, 'pocket_codex_cover')) {
            const safeCover = sanitizeCoverDataUrl(payload.extensions.pocket_codex_cover);
            if (safeCover) payload.extensions.pocket_codex_cover = safeCover;
            else delete payload.extensions.pocket_codex_cover;
        }
        const saved = await stApi.saveWorldInfoBook(fileId, payload);
        state.bookCounts[fileId] = Object.keys(saved.entries || {}).length;
        state.saveError = '';
        if (isNewBookFile) await stApi.refreshWorldInfoUI();
        return saved;
    }

    async function mutateBookAtomically(fileId, mutatorFn) {
        return enqueueBookWrite(fileId, async () => {
            const fresh = await loadBookData(fileId, { preferCache: false });
            const workingCopy = JSON.parse(JSON.stringify(fresh));
            const resVal = await mutatorFn(workingCopy, fresh);
            if (resVal === false) return null;
            const saved = await saveBookData(fileId, workingCopy);
            if (state.activeBookId === fileId) {
                state.activeBookData = saved;
            }
            return saved;
        });
    }

    function getChatBoundBooks() {
        if (typeof stApi.getChatLorebooks === 'function') return stApi.getChatLorebooks();
        const single = stApi.isChatOpen() ? (stApi.chatMetadata?.world_info || '') : '';
        return single ? [single] : [];
    }

    async function toggleBindBookToChat(fileId) {
        if (typeof stApi.toggleChatLorebook === 'function') {
            await stApi.toggleChatLorebook(fileId);
            return;
        }
        if (!stApi.isChatOpen() || !stApi.chatMetadata) return;
        if (stApi.chatMetadata.world_info === fileId) delete stApi.chatMetadata.world_info;
        else stApi.chatMetadata.world_info = fileId;
        stApi.saveMetadata();
        stApi.refreshWorldInfoUI();
    }

    function isSingleCharOpen() {
        const c = stApi.ctx;
        return Boolean(!c.groupId && c.characterId !== undefined && c.characterId !== null && c.characterId !== '');
    }

    function captureContextAnchor() {
        const c = stApi.ctx || {};
        const chatId = String(c.getCurrentChatId?.() ?? c.chatId ?? '');
        const charId = c.characterId !== undefined && c.characterId !== null ? String(c.characterId) : '';
        const groupId = c.groupId ? String(c.groupId) : '';
        const chatMetaRef = stApi.chatMetadata || null;
        const storeRef = typeof getActiveStore === 'function' ? getActiveStore() : null;
        return {
            isChatOpen: Boolean(stApi.isChatOpen()),
            chatId,
            charId,
            groupId,
            chatMetaRef,
            storeRef,
        };
    }

    function isSameContextAnchor(anchor) {
        if (!anchor) return true;
        const now = captureContextAnchor();
        if (anchor.isChatOpen !== now.isChatOpen) return false;
        if (anchor.chatId !== now.chatId) return false;
        if (anchor.charId !== now.charId) return false;
        if (anchor.groupId !== now.groupId) return false;
        if (anchor.chatMetaRef && now.chatMetaRef && anchor.chatMetaRef !== now.chatMetaRef) return false;
        if (anchor.storeRef && now.storeRef && anchor.storeRef !== now.storeRef) return false;
        return true;
    }

    async function applyBindingScope(fileId, scope, expectedAnchor = null) {
        if (!fileId || scope === 'none') return true;
        if (expectedAnchor && (scope === 'chat' || scope === 'char') && !isSameContextAnchor(expectedAnchor)) {
            return false;
        }
        if (scope === 'global') {
            const globals = stApi.getGlobalLorebooks?.() || [];
            if (!globals.includes(fileId)) await stApi.toggleGlobalLorebook?.(fileId);
        } else if (scope === 'chat') {
            if (!getChatBoundBooks().includes(fileId)) {
                await toggleBindBookToChat(fileId);
            }
        } else if (scope === 'char') {
            if (isSingleCharOpen() && stApi.getCharLorebook?.() !== fileId) {
                await stApi.toggleCharLorebook?.(fileId);
            }
        }
        return true;
    }

    function scanEntryAgainstRecentChat(ent, bookId = state.activeBookId) {
        const uiLang = ensureSettings().uiLang || 'ru';
        const inLastPrompt = Boolean(bookId && stApi.wasWiEntryActivated?.(bookId, ent.uid));
        if (ent.disable) return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, 'Страница выключена тумблером', 'Muted via toggle') };
        if (ent.constant) {
            return {
                live: true,
                inLastPrompt,
                hitKeys: [],
                label: inLastPrompt
                    ? tUi(uiLang, 'Постоянно • Попала в последний промпт', 'Constant • Sent in last prompt')
                    : tUi(uiLang, 'Постоянно: всегда готова к отправке', 'Constant: always active when book is bound'),
            };
        }
        if (ent.vectorized && (!Array.isArray(ent.key) || ent.key.length === 0)) {
            return {
                live: inLastPrompt,
                inLastPrompt,
                hitKeys: [],
                label: inLastPrompt
                    ? tUi(uiLang, 'Вектор • Попала в последний промпт', 'Vector • Sent in last prompt')
                    : tUi(uiLang, 'Вектор: активируется по смыслу (Vector Storage)', 'Vector: activates via semantic similarity'),
            };
        }
        const keys = Array.isArray(ent.key) ? ent.key.map(k => String(k).trim()).filter(Boolean) : [];
        if (!keys.length) return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, 'Нет ключевых слов — добавь ключи или выбери «Постоянно»', 'No trigger keys — add keys or switch to Constant') };
        if (!stApi.isChatOpen()) return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, 'Ждёт упоминания ключей в чате', 'Waiting for trigger keys in chat') };

        const wiMod = stApi.worldInfoMod;
        const depth = Math.max(1, Number(ent.scanDepth ?? wiMod?.world_info_depth ?? 2) || 2);
        const includeNames = wiMod?.world_info_include_names !== false;
        const wholeWords = (ent.matchWholeWords !== null && ent.matchWholeWords !== undefined)
            ? Boolean(ent.matchWholeWords)
            : (wiMod?.world_info_match_whole_words !== undefined ? Boolean(wiMod.world_info_match_whole_words) : true);
        const caseSens = (ent.caseSensitive !== null && ent.caseSensitive !== undefined)
            ? Boolean(ent.caseSensitive)
            : Boolean(wiMod?.world_info_case_sensitive);

        const chatArr = Array.isArray(stApi.ctx?.chat) ? stApi.ctx.chat : [];
        const recent = chatArr.filter(m => m && !m.is_system && typeof m.mes === 'string').slice(-depth);
        if (!recent.length) return { live: inLastPrompt, inLastPrompt, hitKeys: [], label: tUi(uiLang, `Спит (сканирует последние ${depth} сообщ.)`, `Idle (scans last ${depth} msgs)`) };

        const rawHaystack = recent.map(m => includeNames && m.name ? `${m.name}: ${m.mes}` : m.mes).join('\n');
        const lowHaystack = rawHaystack.toLowerCase();
        const participantNames = [stApi.ctx?.name1, stApi.ctx?.name2].filter(Boolean).map(n => String(n).toLowerCase());
        const hitKeys = [];
        let matchedParticipantName = false;

        for (const k of keys) {
            if (matchTriggerKeyInText(lowHaystack, rawHaystack, k, wholeWords, caseSens)) {
                hitKeys.push(k);
                if (includeNames && participantNames.includes(k.toLowerCase())) matchedParticipantName = true;
            }
        }

        const secOk = checkEntrySecondaryKeysInText(lowHaystack, rawHaystack, ent, wholeWords, caseSens);
        if (hitKeys.length > 0 && secOk) {
            const warnName = matchedParticipantName ? tUi(uiLang, ' (имя участника чата)', ' (matches participant name)') : '';
            const prefix = inLastPrompt
                ? tUi(uiLang, 'В последнем промпте • ключ: ', 'In last prompt • key: ')
                : tUi(uiLang, 'Ключ замечен в чате: ', 'Key noticed in chat: ');
            return {
                live: true,
                inLastPrompt,
                hitKeys,
                label: `${prefix}${hitKeys.slice(0, 3).join(', ')}${warnName}`,
            };
        }
        if (inLastPrompt) {
            return {
                live: true,
                inLastPrompt: true,
                hitKeys,
                label: tUi(uiLang, 'Попала в последний промпт (по рекурсии / sticky)', 'Sent in last prompt (via recursion / sticky)'),
            };
        }
        return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, `Спит — ждёт ключ в последних ${depth} сообщ.`, `Idle — waiting for key in last ${depth} msgs`) };
    }

    function isMemoryBooksEntry(ent) {
        if (!ent || typeof ent !== 'object') return false;
        if (ent.stmemorybooks === true || ent.STMB_chatId || ent.STMB_canonicalLorebook) return true;
        return /^\[?\s*memory\s*#?\d+/i.test(String(ent.comment || ''));
    }

    async function loadSavedChatsForBindPicker(avatarFileName) {
        state.bindChatCharAvatar = String(avatarFileName || '');
        state.bindChatList = [];
        if (!state.bindChatCharAvatar || typeof stApi.listCharacterChatsWithLore !== 'function') {
            requestRender({ preserveBodyScroll: true });
            return;
        }
        state.bindChatLoading = true;
        requestRender({ preserveBodyScroll: true });
        try {
            state.bindChatList = await stApi.listCharacterChatsWithLore(state.bindChatCharAvatar);
        } finally {
            state.bindChatLoading = false;
            requestRender({ preserveBodyScroll: true });
        }
    }

    function buildHumanBindSummary(fileId, uiLang = 'ru') {
        const globals = stApi.getGlobalLorebooks?.() || [];
        const isGlob = globals.includes(fileId);
        const isChat = getChatBoundBooks().includes(fileId);
        const boundChars = stApi.getCharactersBoundToBook?.(fileId) || [];
        const parts = [];
        if (isGlob) parts.push(tUi(uiLang, 'Везде (во всех чатах)', 'Everywhere (Global)'));
        if (boundChars.length === 1) {
            parts.push(`${tUi(uiLang, 'Персонаж', 'Character')} «${boundChars[0].name}»`);
        } else if (boundChars.length > 1) {
            parts.push(`${tUi(uiLang, 'Персонажи:', 'Characters:')} ${boundChars.slice(0, 2).map(c => `«${c.name}»`).join(', ')}${boundChars.length > 2 ? ` +${boundChars.length - 2}` : ''}`);
        }
        if (isChat && stApi.isChatOpen()) {
            const chatNm = stApi.getActiveChatDisplayName?.(uiLang) || '';
            parts.push(chatNm ? `${tUi(uiLang, 'Текущий чат с', 'Current chat with')} «${chatNm}»` : tUi(uiLang, 'Текущий чат', 'Current chat'));
        }
        if (!parts.length) {
            return tUi(uiLang, 'Книга пока лежит на полке и никуда не подключена.', 'This Lorebook is resting on the shelf and not bound anywhere yet.');
        }
        return `${tUi(uiLang, 'Подключена:', 'Active in:')} ${parts.join(' · ')}`;
    }

    function renderBindPills(fileId, { inlineMode = false } = {}) {
        const uiLang = ensureSettings().uiLang || 'ru';
        const globals = stApi.getGlobalLorebooks?.() || [];
        const isGlob = globals.includes(fileId);
        const isChat = getChatBoundBooks().includes(fileId);
        const boundChars = stApi.getCharactersBoundToBook?.(fileId) || [];
        const isAnyCharBound = boundChars.length > 0 || (stApi.getCharLorebook?.() === fileId);
        const chatOpen = stApi.isChatOpen();
        const mb = stApi.getMemoryBooksStatus?.() || { installed: false, enabled: false, targetBook: '', mode: 'chat' };
        const isMbTarget = Boolean(mb.installed && mb.enabled && mb.targetBook && mb.targetBook === fileId);
        const mbTitle = mb.mode === 'lock'
            ? tUi(uiLang, 'Книга закреплена замком персонажа в настройках Memory Books', 'Locked to character inside Memory Books settings')
            : tUi(uiLang, 'Назначить этот Лорбук приёмником воспоминаний Memory Books в текущем чате', 'Route Memory Books memories into this Lorebook for the active chat');

        if (inlineMode) {
            const charBtnLabel = boundChars.length === 1
                ? `${tUi(uiLang, 'Персонаж', 'Char')} · ${boundChars[0].name.slice(0, 18)}`
                : (boundChars.length > 1
                    ? `${tUi(uiLang, 'Персонажи', 'Chars')} · ${boundChars.length}`
                    : tUi(uiLang, 'Персонаж', 'Character'));
            const activeChatShort = (isChat && chatOpen)
                ? (stApi.getActiveChatDisplayName?.(uiLang) || '').slice(0, 16)
                : '';
            const chatBtnLabel = activeChatShort
                ? `${tUi(uiLang, 'Чат', 'Chat')} · ${activeChatShort}`
                : tUi(uiLang, 'Чат', 'Chat');

            const allChars = Array.isArray(stApi.ctx?.characters) ? stApi.ctx.characters.filter(c => c?.avatar) : [];
            const cq = state.bindCharQuery.trim().toLowerCase();
            const filteredChars = cq
                ? allChars.filter(c => String(c.name || c.avatar).toLowerCase().includes(cq))
                : allChars;
            const boundByAv = new Map(boundChars.map(b => [b.avatar, b.mode]));

            let drawerHtml = '';
            if (state.bindDrawerMode === 'char') {
                drawerHtml = `
                    <div class="pcx-stack" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
                        <div class="pcx-actions pcx-between">
                            <small>${tUi(uiLang, 'Отметьте персонажей, для которых работает эта книга (заходить в чат не нужно):', 'Tap characters to attach or detach this Lorebook (no need to enter chat):')}</small>
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-fg-close-drawer="1">${tUi(uiLang, 'Скрыть', 'Close')}</button>
                        </div>
                        ${allChars.length > 6 ? `<input type="search" id="pcx-fg-bind-char-q" class="pcx-input" placeholder="${tUi(uiLang, 'Быстрый фильтр по имени...', 'Filter by character name...')}" value="${escapeHtml(state.bindCharQuery)}">` : ''}
                        <div class="pcx-stack" style="max-height:210px;overflow-y:auto;gap:5px;">
                            ${filteredChars.length === 0
                                ? `<small>${tUi(uiLang, 'Персонажи не найдены.', 'No characters found.')}</small>`
                                : filteredChars.map(ch => {
                                    const bMode = boundByAv.get(ch.avatar);
                                    const on = Boolean(bMode);
                                    const badge = bMode === 'extra'
                                        ? tUi(uiLang, 'Доп. книга', 'Extra')
                                        : (bMode === 'primary' ? tUi(uiLang, 'Подключена', 'Bound') : tUi(uiLang, 'Подключить', 'Attach'));
                                    return `<button type="button" class="pcx-actions pcx-between pcx-surface" data-fg-bind-char="${escapeHtml(ch.avatar)}" data-fg-book="${escapeHtml(fileId)}" style="width:100%;padding:7px 10px;text-align:left;cursor:pointer;border-color:${on ? 'var(--accent)' : 'var(--line)'};background:${on ? 'var(--accent-wash)' : 'var(--paper)'};">
                                        <span style="font-weight:${on ? '600' : '400'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ch.name || ch.avatar)}</span>
                                        <span class="pcx-key-badge" style="${on ? 'border-color:var(--accent);color:var(--accent);' : ''}">${escapeHtml(badge)}</span>
                                    </button>`;
                                }).join('')}
                        </div>
                    </div>`;
            } else if (state.bindDrawerMode === 'chat') {
                const openChatTitle = chatOpen ? (stApi.getActiveChatDisplayName?.(uiLang) || tUi(uiLang, 'Текущий чат', 'Current chat')) : '';
                drawerHtml = `
                    <div class="pcx-stack" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
                        <div class="pcx-actions pcx-between">
                            <small>${tUi(uiLang, 'Выберите чат, в котором должна работать только эта книга:', 'Choose a specific chat where this Lorebook should be active:')}</small>
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-fg-close-drawer="1">${tUi(uiLang, 'Скрыть', 'Close')}</button>
                        </div>
                        ${chatOpen ? `
                            <button type="button" class="pcx-actions pcx-between pcx-surface" data-fg-bind-curchat="1" data-fg-book="${escapeHtml(fileId)}" style="width:100%;padding:8px 10px;text-align:left;cursor:pointer;border-color:${isChat ? 'var(--accent)' : 'var(--line)'};background:${isChat ? 'var(--accent-wash)' : 'var(--paper)'};">
                                <span><strong>${tUi(uiLang, 'Открытый сейчас чат:', 'Currently open chat:')}</strong> «${escapeHtml(openChatTitle)}»</span>
                                <span class="pcx-key-badge" style="${isChat ? 'border-color:var(--accent);color:var(--accent);' : ''}">${isChat ? tUi(uiLang, 'Подключена', 'Bound') : tUi(uiLang, 'Подключить', 'Attach')}</span>
                            </button>` : ''}
                        ${allChars.length > 0 ? `
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Сохранённые чаты персонажа', 'Character Saved Chats')}</span>
                                <select id="pcx-fg-bind-chat-char" class="pcx-input">
                                    <option value="">${tUi(uiLang, '— Выберите персонажа —', '— Select character —')}</option>
                                    ${allChars.map(ch => `<option value="${escapeHtml(ch.avatar)}" ${state.bindChatCharAvatar === ch.avatar ? 'selected' : ''}>${escapeHtml(ch.name || ch.avatar)}</option>`).join('')}
                                </select>
                            </label>` : ''}
                        ${state.bindChatLoading ? `<small>${ICONS.spinner} ${tUi(uiLang, 'Читаем список чатов...', 'Loading chats...')}</small>` : ''}
                        ${(!state.bindChatLoading && state.bindChatCharAvatar) ? `
                            <div class="pcx-stack" style="max-height:190px;overflow-y:auto;gap:5px;">
                                ${state.bindChatList.length === 0
                                    ? `<small>${tUi(uiLang, 'У этого персонажа пока нет сохранённых чатов.', 'No saved chats for this character yet.')}</small>`
                                    : state.bindChatList.map(ct => {
                                        const cOn = Array.isArray(ct.books) && ct.books.includes(fileId);
                                        return `<button type="button" class="pcx-actions pcx-between pcx-surface" data-fg-bind-savedchat="${escapeHtml(ct.fileId)}" data-fg-book="${escapeHtml(fileId)}" style="width:100%;padding:7px 10px;text-align:left;cursor:pointer;border-color:${cOn ? 'var(--accent)' : 'var(--line)'};background:${cOn ? 'var(--accent-wash)' : 'var(--paper)'};">
                                            <div style="min-width:0;flex:1;">
                                                <div style="font-weight:${cOn ? '600' : '400'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ct.label)}</div>
                                                ${ct.lastMes ? `<small style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.75;">${escapeHtml(ct.lastMes)}</small>` : ''}
                                            </div>
                                            <span class="pcx-key-badge" style="${cOn ? 'border-color:var(--accent);color:var(--accent);' : ''}">${cOn ? tUi(uiLang, 'Подключена', 'Bound') : tUi(uiLang, 'Подключить', 'Attach')}</span>
                                        </button>`;
                                    }).join('')}
                            </div>` : ''}
                    </div>`;
            }

            return `
                <div style="width:100%;">
                    <div class="pcx-actions" style="flex-wrap:wrap;">
                        <button type="button" class="pcx-chip ${isGlob ? 'pcx-active' : ''}" data-fg-scope="global" data-fg-book="${escapeHtml(fileId)}" title="${tUi(uiLang, 'Работает сразу во всех чатах Таверны', 'Active across all chats in SillyTavern')}">${tUi(uiLang, 'Везде', 'Everywhere')}</button>
                        <button type="button" class="pcx-chip ${(isAnyCharBound || state.bindDrawerMode === 'char') ? 'pcx-active' : ''}" data-fg-scope="char_drawer" data-fg-book="${escapeHtml(fileId)}">${escapeHtml(charBtnLabel)} ${ICONS.chevDown}</button>
                        <button type="button" class="pcx-chip ${(isChat || state.bindDrawerMode === 'chat') ? 'pcx-active' : ''}" data-fg-scope="chat_drawer" data-fg-book="${escapeHtml(fileId)}">${escapeHtml(chatBtnLabel)} ${ICONS.chevDown}</button>
                        ${(mb.installed && mb.enabled && chatOpen) ? `<button type="button" class="pcx-chip ${isMbTarget ? 'pcx-active' : ''}" data-fg-scope="memory" data-fg-book="${escapeHtml(fileId)}" title="${escapeHtml(mbTitle)}">${ICONS.memory}<span>Memory Books</span></button>` : ''}
                    </div>
                    ${drawerHtml}
                </div>`;
        }

        return `
            <div class="pcx-bind-strip" title="${tUi(uiLang, 'Где работает эта книга', 'Where this Lorebook is active')}">
                <button type="button" class="pcx-bind-pill ${isGlob ? 'pcx-on' : ''}" data-fg-scope="global" data-fg-book="${escapeHtml(fileId)}" title="${tUi(uiLang, 'Включить во всех чатах Таверны', 'Toggle Everywhere (Global)')}">${tUi(uiLang, 'Везде', 'Global')}</button>
                <button type="button" class="pcx-bind-pill ${isAnyCharBound ? 'pcx-on' : ''}" data-fg-scope="shelf_char" data-fg-book="${escapeHtml(fileId)}" title="${tUi(uiLang, 'Выбрать персонажей для этой книги', 'Choose characters for this book')}">${tUi(uiLang, 'Чар', 'Char')}${boundChars.length > 1 ? `·${boundChars.length}` : ''}</button>
                <button type="button" class="pcx-bind-pill ${isChat ? 'pcx-on' : ''}" data-fg-scope="shelf_chat" data-fg-book="${escapeHtml(fileId)}" title="${tUi(uiLang, 'Подключить к чату', 'Attach to chat')}">${tUi(uiLang, 'Чат', 'Chat')}</button>
            </div>
            ${(mb.installed && mb.enabled && chatOpen) ? `<div class="pcx-mb-pill-row"><button type="button" class="pcx-bind-pill ${isMbTarget ? 'pcx-on' : ''}" data-fg-scope="memory" data-fg-book="${escapeHtml(fileId)}" title="${escapeHtml(mbTitle)}">${ICONS.memory}<span>${isMbTarget ? tUi(uiLang, 'Приёмник Memory Books', 'Memory Books Target') : 'Memory Books'}</span></button></div>` : ''}`;
    }

    function isSingleCharOpen() {
        const c = stApi.ctx;
        return Boolean(!c.groupId && c.characterId !== undefined && c.characterId !== null && c.characterId !== '');
    }

    function captureContextAnchor() {
        const c = stApi.ctx || {};
        const chatId = String(c.getCurrentChatId?.() ?? c.chatId ?? '');
        const charId = c.characterId !== undefined && c.characterId !== null ? String(c.characterId) : '';
        const groupId = c.groupId ? String(c.groupId) : '';
        const chatMetaRef = stApi.chatMetadata || null;
        const storeRef = typeof getActiveStore === 'function' ? getActiveStore() : null;
        return {
            isChatOpen: Boolean(stApi.isChatOpen()),
            chatId,
            charId,
            groupId,
            chatMetaRef,
            storeRef,
        };
    }

    function isSameContextAnchor(anchor) {
        if (!anchor) return true;
        const now = captureContextAnchor();
        if (anchor.isChatOpen !== now.isChatOpen) return false;
        if (anchor.chatId !== now.chatId) return false;
        if (anchor.charId !== now.charId) return false;
        if (anchor.groupId !== now.groupId) return false;
        if (anchor.chatMetaRef && now.chatMetaRef && anchor.chatMetaRef !== now.chatMetaRef) return false;
        if (anchor.storeRef && now.storeRef && anchor.storeRef !== now.storeRef) return false;
        return true;
    }

    async function applyBindingScope(fileId, scope, expectedAnchor = null) {
        if (!fileId || scope === 'none') return true;
        if (expectedAnchor && (scope === 'chat' || scope === 'char') && !isSameContextAnchor(expectedAnchor)) {
            return false;
        }
        if (scope === 'global') {
            const globals = stApi.getGlobalLorebooks?.() || [];
            if (!globals.includes(fileId)) await stApi.toggleGlobalLorebook?.(fileId);
        } else if (scope === 'chat') {
            if (!getChatBoundBooks().includes(fileId)) {
                await toggleBindBookToChat(fileId);
            }
        } else if (scope === 'char') {
            if (isSingleCharOpen() && stApi.getCharLorebook?.() !== fileId) {
                await stApi.toggleCharLorebook?.(fileId);
            }
        }
        return true;
    }

    function scanEntryAgainstRecentChat(ent, bookId = state.activeBookId) {
        const uiLang = ensureSettings().uiLang || 'ru';
        const inLastPrompt = Boolean(bookId && stApi.wasWiEntryActivated?.(bookId, ent.uid));
        if (ent.disable) return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, 'Страница выключена тумблером', 'Muted via toggle') };
        if (ent.constant) {
            return {
                live: true,
                inLastPrompt,
                hitKeys: [],
                label: inLastPrompt
                    ? tUi(uiLang, 'Постоянно • Попала в последний промпт', 'Constant • Sent in last prompt')
                    : tUi(uiLang, 'Постоянно: всегда готова к отправке', 'Constant: always active when book is bound'),
            };
        }
        if (ent.vectorized && (!Array.isArray(ent.key) || ent.key.length === 0)) {
            return {
                live: inLastPrompt,
                inLastPrompt,
                hitKeys: [],
                label: inLastPrompt
                    ? tUi(uiLang, 'Вектор • Попала в последний промпт', 'Vector • Sent in last prompt')
                    : tUi(uiLang, 'Вектор: активируется по смыслу (Vector Storage)', 'Vector: activates via semantic similarity'),
            };
        }
        const keys = Array.isArray(ent.key) ? ent.key.map(k => String(k).trim()).filter(Boolean) : [];
        if (!keys.length) return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, 'Нет ключевых слов — добавь ключи или выбери «Постоянно»', 'No trigger keys — add keys or switch to Constant') };
        if (!stApi.isChatOpen()) return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, 'Ждёт упоминания ключей в чате', 'Waiting for trigger keys in chat') };

        const wiMod = stApi.worldInfoMod;
        const depth = Math.max(1, Number(ent.scanDepth ?? wiMod?.world_info_depth ?? 2) || 2);
        const includeNames = wiMod?.world_info_include_names !== false;
        const wholeWords = (ent.matchWholeWords !== null && ent.matchWholeWords !== undefined)
            ? Boolean(ent.matchWholeWords)
            : (wiMod?.world_info_match_whole_words !== undefined ? Boolean(wiMod.world_info_match_whole_words) : true);
        const caseSens = (ent.caseSensitive !== null && ent.caseSensitive !== undefined)
            ? Boolean(ent.caseSensitive)
            : Boolean(wiMod?.world_info_case_sensitive);

        const chatArr = Array.isArray(stApi.ctx?.chat) ? stApi.ctx.chat : [];
        const recent = chatArr.filter(m => m && !m.is_system && typeof m.mes === 'string').slice(-depth);
        if (!recent.length) return { live: inLastPrompt, inLastPrompt, hitKeys: [], label: tUi(uiLang, `Спит (сканирует последние ${depth} сообщ.)`, `Idle (scans last ${depth} msgs)`) };

        const rawHaystack = recent.map(m => includeNames && m.name ? `${m.name}: ${m.mes}` : m.mes).join('\n');
        const lowHaystack = rawHaystack.toLowerCase();
        const participantNames = [stApi.ctx?.name1, stApi.ctx?.name2].filter(Boolean).map(n => String(n).toLowerCase());
        const hitKeys = [];
        let matchedParticipantName = false;

        for (const k of keys) {
            if (matchTriggerKeyInText(lowHaystack, rawHaystack, k, wholeWords, caseSens)) {
                hitKeys.push(k);
                if (includeNames && participantNames.includes(k.toLowerCase())) matchedParticipantName = true;
            }
        }

        const secOk = checkEntrySecondaryKeysInText(lowHaystack, rawHaystack, ent, wholeWords, caseSens);
        if (hitKeys.length > 0 && secOk) {
            const warnName = matchedParticipantName ? tUi(uiLang, ' (имя участника чата)', ' (matches participant name)') : '';
            const prefix = inLastPrompt
                ? tUi(uiLang, 'В последнем промпте • ключ: ', 'In last prompt • key: ')
                : tUi(uiLang, 'Ключ замечен в чате: ', 'Key noticed in chat: ');
            return {
                live: true,
                inLastPrompt,
                hitKeys,
                label: `${prefix}${hitKeys.slice(0, 3).join(', ')}${warnName}`,
            };
        }
        if (inLastPrompt) {
            return {
                live: true,
                inLastPrompt: true,
                hitKeys,
                label: tUi(uiLang, 'Попала в последний промпт (по рекурсии / sticky)', 'Sent in last prompt (via recursion / sticky)'),
            };
        }
        return { live: false, inLastPrompt: false, hitKeys: [], label: tUi(uiLang, `Спит — ждёт ключ в последних ${depth} сообщ.`, `Idle — waiting for key in last ${depth} msgs`) };
    }

    function isMemoryBooksEntry(ent) {
        if (!ent || typeof ent !== 'object') return false;
        if (ent.stmemorybooks === true || ent.STMB_chatId || ent.STMB_canonicalLorebook) return true;
        return /^\[?\s*memory\s*#?\d+/i.test(String(ent.comment || ''));
    }

    function openEntryEditor({ bookId, uid = null, initialTab = 'manual', bookData = null }) {
        const resolvedBookId = bookId || state.activeBookId || (state.books[0]?.file_id || '');
        const sourceBook = bookData || (resolvedBookId === state.activeBookId ? state.activeBookData : null);
        state.entrySessionId = ++entrySessionSeq;
        state.entryCreatedUid = null;
        state.entrySavingBusy = false;
        state.pageAiGenerating = false;
        state.keysGenerating = false;
        state.entryTracker = {
            sessionId: state.entrySessionId,
            targetBookId: resolvedBookId,
            allocatedUid: uid !== null && uid !== undefined ? String(uid) : null,
            directSaveInFlight: false,
            manualCommitted: false,
        };
        state.entryTargetBookId = resolvedBookId;
        state.editingOriginBookId = uid !== null ? resolvedBookId : '';
        state.editingUid = uid;
        state.entryEditTab = initialTab;
        state.pageAiStatus = '';
        state.pageAiCandidates = [];
        state.pageAiCandIdx = 0;
        state.pageAiRefineText = '';
        state.saveError = '';

        if (uid !== null && sourceBook?.entries?.[uid]) {
            state.entryDraft = JSON.parse(JSON.stringify(sourceBook.entries[uid]));
            state.entryBaseSnapshot = normalizeEntryEditableSnapshot(sourceBook.entries[uid]);
            state.entryConflictForceHash = '';
            state.entryOriginalKeys = Array.isArray(state.entryDraft.key) ? [...state.entryDraft.key] : [];
            state.entryKeysRawText = state.entryOriginalKeys.join(', ');
            state.entryKeysDirty = false;
        } else {
            state.entryDraft = makeStandardWiEntry(0, { comment: '', keys: [], content: '', position: 1, depth: 4, outletName: '' }, stApi.worldInfoMod?.newWorldInfoEntryTemplate);
            state.entryBaseSnapshot = null;
            state.entryConflictForceHash = '';
            state.entryOriginalKeys = [];
            state.entryKeysRawText = '';
            state.entryKeysDirty = false;
        }
        state.screen = 'entry_edit';
    }

    async function saveDraftToTargetBook(draftObj, explicitCtx = null) {
        const isBackgroundPinned = Boolean(explicitCtx);
        const tracker = isBackgroundPinned ? (explicitCtx.tracker || null) : (state.entryTracker || null);

        if (!isBackgroundPinned) {
            if (state.entrySavingBusy || tracker?.directSaveInFlight) return false;
            state.entrySavingBusy = true;
        } else if (tracker?.manualCommitted) {
            return false;
        }

        const initialUid = isBackgroundPinned
            ? (tracker?.allocatedUid ?? explicitCtx.editingUid)
            : (state.editingUid !== null ? state.editingUid : (tracker?.allocatedUid ?? state.entryCreatedUid));
        const hasInitialUid = initialUid !== null && initialUid !== undefined;
        const targetBookId = isBackgroundPinned
            ? explicitCtx.targetBookId
            : (hasInitialUid
                ? (state.editingOriginBookId || state.entryTargetBookId || state.activeBookId)
                : (state.entryTargetBookId || state.activeBookId));

        const usedSessionId = isBackgroundPinned ? explicitCtx.sessionId : state.entrySessionId;
        const baseSnap = isBackgroundPinned ? explicitCtx.baseSnapshot : state.entryBaseSnapshot;
        const keysDirty = isBackgroundPinned ? explicitCtx.keysDirty : state.entryKeysDirty;
        const origKeys = isBackgroundPinned ? explicitCtx.originalKeys : state.entryOriginalKeys;
        const forceHash = isBackgroundPinned ? explicitCtx.conflictForceHash : state.entryConflictForceHash;

        if (!targetBookId) {
            if (!isBackgroundPinned) state.entrySavingBusy = false;
            return false;
        }

        const s = ensureSettings();
        const uiLang = s.uiLang || 'ru';
        const cleanDraft = JSON.parse(JSON.stringify(draftObj));
        cleanDraft.position = parseSafePosition(cleanDraft.position, 1);
        cleanDraft.depth = parseSafeDepth(cleanDraft.depth, 4);

        let createdUidStr = null;

        try {
            const savedBook = await mutateBookAtomically(targetBookId, (freshBook) => {
                if (isBackgroundPinned && tracker?.manualCommitted) {
                    return;
                }
                const entries = freshBook.entries;
                const resolvedUid = (tracker && tracker.allocatedUid !== null && tracker.allocatedUid !== undefined)
                    ? tracker.allocatedUid
                    : initialUid;
                const isEditingExisting = resolvedUid !== null && resolvedUid !== undefined;
                const editUidStr = String(resolvedUid);

                if (isEditingExisting) {
                    if (!Object.prototype.hasOwnProperty.call(entries, editUidStr) || !entries[editUidStr]) {
                        throw new Error(tUi(
                            uiLang,
                            `Конфликт сохранения: страница #${editUidStr} была удалена во внешнем редакторе, пока форма была открыта. Ваш текст сохранён в черновике.`,
                            `Save conflict: entry #${editUidStr} was deleted in an external editor while this form was open. Your text is preserved in the draft.`,
                        ));
                    }
                    const existingEntry = entries[editUidStr];
                    const preservedUid = existingEntry.uid !== undefined
                        ? existingEntry.uid
                        : (Number.isNaN(Number(editUidStr)) ? editUidStr : Number(editUidStr));

                    const serverSnap = normalizeEntryEditableSnapshot(existingEntry);
                    const draftSnap = normalizeEntryEditableSnapshot({
                        ...cleanDraft,
                        key: keysDirty
                            ? parseSmartTriggerKeys(cleanDraft.key)
                            : (baseSnap ? baseSnap.key : existingEntry.key),
                    });

                    const editablePatch = {};
                    const conflictingFields = [];

                    for (const field of FORGE_SCALAR_FIELDS) {
                        const userChanged = !baseSnap || !shallowEqualField(draftSnap[field], baseSnap[field]);
                        if (!userChanged) continue;
                        editablePatch[field] = draftSnap[field];
                        if (baseSnap && !shallowEqualField(serverSnap[field], baseSnap[field]) && !shallowEqualField(serverSnap[field], draftSnap[field])) {
                            conflictingFields.push(field);
                        }
                    }

                    if (keysDirty) {
                        const userChangedKeys = !baseSnap || !shallowEqualField(draftSnap.key, baseSnap.key);
                        if (userChangedKeys) {
                            editablePatch.key = draftSnap.key;
                            if (baseSnap && !shallowEqualField(serverSnap.key, baseSnap.key) && !shallowEqualField(serverSnap.key, draftSnap.key)) {
                                conflictingFields.push('key');
                            }
                        }
                    }

                    if (conflictingFields.length > 0) {
                        const conflictSig = JSON.stringify({ uid: editUidStr, serverSnap, draftSnap });
                        if (forceHash !== conflictSig) {
                            if (state.entrySessionId === usedSessionId) {
                                state.entryConflictForceHash = conflictSig;
                            }
                            throw new Error(tUi(
                                uiLang,
                                `Конфликт версий (#${editUidStr}): поле (${conflictingFields.join(', ')}) было одновременно изменено во внешнем редакторе. Черновик сохранён — нажмите «Сохранить» повторно, чтобы применить вашу правку поверх внешней.`,
                                `Version conflict (#${editUidStr}): field (${conflictingFields.join(', ')}) was concurrently modified externally. Draft preserved — click Save again to apply your changes over the external version.`,
                            ));
                        }
                    }

                    entries[editUidStr] = { ...existingEntry, ...editablePatch, uid: preservedUid };
                } else {
                    const parsedNewKeys = (!keysDirty && Array.isArray(origKeys) && origKeys.length > 0)
                        ? [...origKeys]
                        : parseSmartTriggerKeys(cleanDraft.key);
                    const uids = Object.keys(entries).map(Number).filter(n => !Number.isNaN(n));
                    const nextUid = uids.length > 0 ? (Math.max(...uids) + 1) : 0;
                    createdUidStr = String(nextUid);
                    if (tracker) {
                        tracker.allocatedUid = createdUidStr;
                        if (!isBackgroundPinned) tracker.manualCommitted = true;
                    }
                    entries[createdUidStr] = makeStandardWiEntry(nextUid, { ...cleanDraft, keys: parsedNewKeys }, stApi.worldInfoMod?.newWorldInfoEntryTemplate);
                }
            });

            if (!isBackgroundPinned && tracker) {
                tracker.manualCommitted = true;
            }

            state.bookCounts[targetBookId] = Object.keys(savedBook.entries || {}).length;

            if (state.entrySessionId === usedSessionId) {
                if (createdUidStr !== null) {
                    state.entryCreatedUid = createdUidStr;
                    state.editingUid = createdUidStr;
                }
                state.activeBookId = targetBookId;
                state.activeBookData = savedBook;
                state.editingOriginBookId = '';
                state.entryBaseSnapshot = null;
                state.entryConflictForceHash = '';
                state.screen = 'book_entries';
            } else if (state.activeBookId === targetBookId && state.screen !== 'entry_edit') {
                state.activeBookData = savedBook;
            }
            return true;
        } catch (err) {
            const msg = err?.message || String(err);
            if (state.entrySessionId === usedSessionId) {
                state.saveError = msg;
            }
            try { window.toastr?.warning?.(msg); } catch {}
            return false;
        } finally {
            if (!isBackgroundPinned) {
                state.entrySavingBusy = false;
            }
        }
    }

    async function generateKeysForCurrentDraft() {
        const d = state.entryDraft;
        if (!d || !String(d.content || '').trim() || state.keysGenerating) return;
        const reqSeq = ++forgeAiSeq;
        const epochAtStart = chatEpoch;
        const sessionAtStart = state.entrySessionId;
        const chatAtStart = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
        state.keysGenerating = true;
        requestRender({ preserveBodyScroll: true });
        try {
            const s = ensureSettings();
            const lang = s.aiLang || 'Русский';
            const sys = `Ты — мастер ключевых слов для интерактивных Лорбуков. Прочитай готовую статью и подбери 4–7 точных ключевых слов-триггеров на языке "${lang}" (имена собственные, локации, предметы, короткие корни без общих бытовых слов). Также предложи короткое название страницы (2–4 слова) в поле "comment". Верни строго JSON: { "comment": "...", "keys": ["..."] }.`;
            const usr = `[Название сейчас]: ${d.comment || '(пусто)'}\n[Текст страницы]:\n${d.content.trim()}`;
            const raw = await callForgeModel(sys, usr, KEYS_ONLY_JSON_SCHEMA, 1200);
            if (reqSeq !== forgeAiSeq || epochAtStart !== chatEpoch || state.entrySessionId !== sessionAtStart || (stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '') !== chatAtStart) return;
            const parsed = parseJsonObjectFromModel(raw, 'keys');
            const newKeys = parseSmartTriggerKeys(parsed?.keys);
            if (!newKeys.length) {
                throw new Error(tUi(s.uiLang || 'ru', 'Модель не вернула массив ключевых слов.', 'Model did not return a valid keys array.'));
            }
            d.key = newKeys;
            state.entryKeysRawText = newKeys.join(', ');
            state.entryKeysDirty = true;
            if (!String(d.comment || '').trim() && parsed?.comment) d.comment = String(parsed.comment).trim();
        } catch (err) {
            if (state.entrySessionId === sessionAtStart) {
                window.alert('Ошибка подбора ключей: ' + (err?.message || String(err)));
            }
        } finally {
            if (state.entrySessionId === sessionAtStart && reqSeq === forgeAiSeq) {
                state.keysGenerating = false;
                requestRender({ preserveBodyScroll: true });
            }
        }
    }

    function extractBookFormatSkeleton(bookObj) {
        const entries = Object.values(bookObj?.entries || {}).filter(e => e && String(e.content || '').trim());
        if (!entries.length) return '';
        let bracketHeaders = 0, mdHeaders = 0, bulletLists = 0, colonFields = 0, totalParas = 0, totalWords = 0, totalKeys = 0;
        for (const e of entries) {
            const txt = String(e.content || '').trim();
            if (/\[[^\]\n]{2,60}\]/.test(txt)) bracketHeaders++;
            if (/^#{1,5}\s+/m.test(txt)) mdHeaders++;
            if (/^[-*]\s+/m.test(txt)) bulletLists++;
            if (/^[A-Za-zА-Яа-яЁё0-9 _-]{2,28}:\s+\S/m.test(txt)) colonFields++;
            totalParas += txt.split(/\n\s*\n/).filter(Boolean).length;
            totalWords += txt.split(/\s+/).filter(Boolean).length;
            totalKeys += Array.isArray(e.key) ? e.key.filter(Boolean).length : 0;
        }
        const n = entries.length;
        const avgParas = Math.max(1, Math.round(totalParas / n));
        const avgWords = Math.max(20, Math.round(totalWords / n));
        const avgKeys = Math.max(3, Math.round(totalKeys / n));
        const markers = [];
        if (bracketHeaders / n >= 0.35) markers.push('подзаголовки секций в квадратных скобках [РАЗДЕЛ] с отступом');
        if (mdHeaders / n >= 0.35) markers.push('Markdown-подзаголовки ### с пустой строкой');
        if (colonFields / n >= 0.4) markers.push('структурированные поля вида «Параметр: значение»');
        if (bulletLists / n >= 0.35) markers.push('маркированные перечни через дефис');
        if (!markers.length) markers.push('связные художественно-энциклопедические абзацы через пустую строку');
        return `[Сверка ТОЛЬКО с форматом вёрстки книги (знания и тексты установленных Лорбуков скрыты и НЕ используются): среднее число абзацев ~${avgParas}, ориентир длины ~${avgWords} слов, среднее число ключей ~${avgKeys}, стиль разметки: ${markers.join('; ')}. Создавай полностью самостоятельную запись без опоры на чужие лорбуки.]`;
    }

    async function runSinglePageAiGeneration({ isRefinement = false, directSave = false } = {}) {
        if (state.pageAiGenerating || state.entrySavingBusy) return;
        const s = ensureSettings();
        const uiLang = s.uiLang || 'ru';
        const d = state.entryDraft;
        const prevCand = isRefinement ? state.pageAiCandidates[state.pageAiCandIdx] : null;
        if (isRefinement && (!prevCand || !state.pageAiRefineText.trim())) return;
        const hasAnyPageContext = Boolean(
            state.pageAiTask.trim()
            || (d?.content || '').trim()
            || (d?.comment || '').trim()
            || (stApi.isChatOpen() && (state.pageAiUseChar || state.pageAiUseChat || state.pageAiUsePersona))
        );
        if (!isRefinement && !hasAnyPageContext) {
            state.pageAiStatus = tUi(
                uiLang,
                'Сейчас не открыт чат персонажа — откройте диалог в Таверне или напишите коротко тему страницы в поле пожеланий выше.',
                'No chat is open right now — open a character chat or write a brief topic in the request box above.',
            );
            requestRender({ preserveBodyScroll: true });
            return;
        }

        const reqSeq = ++forgeAiSeq;
        const epochAtStart = chatEpoch;
        const sessionAtStart = state.entrySessionId;
        const chatAtStart = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
        const draftSnapshot = JSON.parse(JSON.stringify(d || {}));
        const taskAtStart = state.pageAiTask;
        const refineAtStart = state.pageAiRefineText;
        const matchFormatAtStart = state.pageAiMatchFormat;
        const useCharAtStart = state.pageAiUseChar;
        const usePersonaAtStart = state.pageAiUsePersona;
        const useChatAtStart = state.pageAiUseChat;

        const trackerAtStart = state.entryTracker;
        const pinnedEditingUid = state.editingUid !== null ? state.editingUid : (trackerAtStart?.allocatedUid ?? state.entryCreatedUid);
        const pinnedTargetBookId = pinnedEditingUid !== null
            ? (state.editingOriginBookId || state.entryTargetBookId || state.activeBookId)
            : (state.entryTargetBookId || state.activeBookId);
        if (directSave && trackerAtStart) {
            trackerAtStart.directSaveInFlight = true;
        }
        const pinnedSaveCtx = {
            sessionId: sessionAtStart,
            tracker: trackerAtStart,
            editingUid: pinnedEditingUid,
            targetBookId: pinnedTargetBookId,
            baseSnapshot: state.entryBaseSnapshot ? JSON.parse(JSON.stringify(state.entryBaseSnapshot)) : null,
            keysDirty: true,
            originalKeys: Array.isArray(state.entryOriginalKeys) ? [...state.entryOriginalKeys] : [],
            conflictForceHash: state.entryConflictForceHash || '',
        };

        state.pageAiGenerating = true;
        state.pageAiStatus = directSave
            ? tUi(uiLang, 'Куём и сразу сохраняем страницу в Лорбук...', 'Forging and saving page to Lorebook...')
            : (isRefinement ? tUi(uiLang, 'Соавтор вносит правки...', 'Refining candidate...') : tUi(uiLang, 'Соавтор создаёт страницу и подбирает ключи...', 'Drafting page & trigger keys...'));
        requestRender({ preserveBodyScroll: true });

        try {
            const lang = s.aiLang || 'Русский';
            const wordLim = buildWordLimitPhrase(s.forgeWordsMin, s.forgeWordsMax);
            const preset = getActiveForgeBookPreset();
            const rawTemplate = (s.forgePageSystemPrompt && s.forgePageSystemPrompt.trim())
                ? s.forgePageSystemPrompt.trim()
                : preset.pagePrompt;

            const sysPrompt = rawTemplate
                .replace(/\{\{lang\}\}/gi, lang)
                .replace(/\{\{word_limit\}\}/gi, wordLim);

            const blocks = [];
            if (matchFormatAtStart && pinnedTargetBookId) {
                try {
                    const bookObj = (pinnedTargetBookId === state.activeBookId && state.activeBookData)
                        ? state.activeBookData
                        : await loadBookData(pinnedTargetBookId);
                    const fmtHint = extractBookFormatSkeleton(bookObj);
                    if (fmtHint) blocks.push(fmtHint);
                } catch {}
            }
            if (useCharAtStart) { const cd = getCharacterDescriptionText(); if (cd) blocks.push(cd); }
            if (usePersonaAtStart) { const pd = getUserPersonaDescriptionText(); if (pd) blocks.push(pd); }
            if (useChatAtStart) { const ct = buildChatContextSnippet(s.aiChatRadius ?? 10); if (ct) blocks.push(ct); }

            if (isRefinement && prevCand) {
                blocks.push(`[Исходный замысел]\n${taskAtStart.trim() || '(доработка черновика)'}`);
                blocks.push(`[Предыдущий вариант]\nНазвание: ${prevCand.comment}\nКлючи: ${prevCand.keys}\nТекст:\n${prevCand.content}`);
                blocks.push(`[Что изменить]\n${refineAtStart.trim()}`);
            } else {
                if (draftSnapshot?.comment && draftSnapshot.comment.trim()) blocks.push(`[Заголовок черновика]\n${draftSnapshot.comment.trim()}`);
                if (draftSnapshot?.content && draftSnapshot.content.trim()) blocks.push(`[Черновик в редакторе]\n${draftSnapshot.content.trim()}`);
                if (taskAtStart.trim()) {
                    blocks.push(`[ПРЯМЫЕ УКАЗАНИЯ И ПОЖЕЛАНИЯ АВТОРА (ВЫСШИЙ ПРИОРИТЕТ)]\n${taskAtStart.trim()}`);
                } else {
                    blocks.push(`[АКТИВНЫЙ ШАБЛОН ЗАДАЧИ: «${preset.name}»]\nАвтор выбрал этот готовый шаблон без дополнительного текста. Создай содержательную страницу Лорбука с триггерными ключами строго по системной инструкции шаблона «${preset.name}», опираясь на переданный контекст.`);
                }
            }

            const raw = await callForgeModel(sysPrompt, blocks.join('\n\n'), SINGLE_PAGE_JSON_SCHEMA, Math.max(1200, Number(s.aiMaxTokens) || 3400));
            if (epochAtStart !== chatEpoch || (stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '') !== chatAtStart) return;
            if (!directSave && (reqSeq !== forgeAiSeq || state.entrySessionId !== sessionAtStart)) return;

            const parsed = parseJsonObjectFromModel(raw, 'page');
            const rawBody = typeof parsed?.content === 'string' ? parsed.content : '';
            const cleanBody = formatCleanParagraphs(rawBody);
            if (!parsed || !cleanBody) {
                throw new Error(tUi(uiLang, 'Модель не вернула корректный JSON страницы.', 'Model did not return a valid page JSON.'));
            }

            const genKeysArr = parseSmartTriggerKeys(parsed.keys);

            if (directSave) {
                const payloadDraft = state.entrySessionId === sessionAtStart ? d : draftSnapshot;
                payloadDraft.comment = String(parsed.comment || payloadDraft.comment || 'Новая страница').trim();
                payloadDraft.key = genKeysArr;
                payloadDraft.content = cleanBody;
                payloadDraft.constant = Boolean(parsed.constant);
                if (state.entrySessionId === sessionAtStart) {
                    state.entryKeysRawText = genKeysArr.join(', ');
                    state.entryKeysDirty = true;
                }
                const ok = await saveDraftToTargetBook(payloadDraft, pinnedSaveCtx);
                if (state.entrySessionId === sessionAtStart) {
                    if (ok) {
                        state.pageAiTask = '';
                    } else {
                        state.pageAiCandidates.push({
                            comment: payloadDraft.comment,
                            keys: genKeysArr.join(', '),
                            content: cleanBody,
                            constant: Boolean(parsed.constant),
                        });
                        state.pageAiCandIdx = state.pageAiCandidates.length - 1;
                        state.pageAiStatus = 'Ошибка сохранения: ' + state.saveError;
                    }
                }
                return;
            }

            state.pageAiCandidates.push({
                comment: String(parsed.comment || 'Новая страница').trim(),
                keys: genKeysArr.join(', '),
                content: cleanBody,
                constant: Boolean(parsed.constant),
            });
            state.pageAiCandIdx = state.pageAiCandidates.length - 1;
            if (isRefinement) state.pageAiRefineText = '';
            state.pageAiStatus = tUi(uiLang, 'Вариант готов! Проверь отступы и ключи ниже.', 'Draft ready! Review spacing and trigger keys below.');
        } catch (err) {
            if (state.entrySessionId === sessionAtStart && epochAtStart === chatEpoch) {
                state.pageAiStatus = 'Ошибка: ' + (err?.message || String(err));
            }
        } finally {
            if (directSave && trackerAtStart) {
                trackerAtStart.directSaveInFlight = false;
            }
            if (state.entrySessionId === sessionAtStart) {
                state.pageAiGenerating = false;
                requestRender({ preserveBodyScroll: true });
            } else if (directSave && state.screen !== 'entry_edit') {
                requestRender({ preserveBodyScroll: true });
            }
        }
    }

    function buildDynamicForgePrompts() {
        const s = ensureSettings();
        const store = getActiveStore();
        const lang = s.aiLang || 'Русский';
        const sourceBlocks = [];
        const selectedCatIds = Object.keys(state.wizSelectedCats).filter(k => state.wizSelectedCats[k]);
        const selectedNotes = [];

        for (const catId of selectedCatIds) {
            const cat = store.categories.find(c => c.id === catId);
            if (!cat) continue;
            for (const n of store.notes.filter(x => x.categoryId === catId && x.enabled !== false)) {
                if (n.content && n.content.trim()) {
                    selectedNotes.push({ section: cat.name, title: n.title || cat.name, content: n.content });
                }
            }
        }

        // In verbatim_keys mode, NEVER silently send hidden chat/character switches — only send the verbatim items!
        if (state.wizMode === 'ai_adapt') {
            if (state.wizUseChar) {
                // Exclude scenario inside character card block so wizUseScenario controls scenario strictly!
                const cd = getCharacterDescriptionText({ includeScenario: false });
                if (cd) sourceBlocks.push(cd);
            }
            if (state.wizUseScenario) {
                const effScen = typeof getEffectiveScenarioText === 'function' ? getEffectiveScenarioText() : '';
                if (effScen) {
                    sourceBlocks.push(effScen);
                } else {
                    const ctx = stApi.ctx;
                    const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
                    const scenParts = [];
                    if (ctx.groupId && Array.isArray(ctx.groups)) {
                        const grp = ctx.groups.find(g => String(g.id) === String(ctx.groupId));
                        if (grp && Array.isArray(grp.members)) {
                            for (const av of grp.members.slice(0, 5)) {
                                const mCh = chars.find(c => c.avatar === av);
                                const mScen = (mCh?.scenario || mCh?.data?.scenario || '').trim();
                                if (mScen) scenParts.push(`${mCh.name || 'Персонаж'}: ${mScen}`);
                            }
                        }
                    } else {
                        const ch = (ctx.characterId !== undefined && ctx.characterId !== null) ? chars[ctx.characterId] : null;
                        const scen = (ch?.scenario || ch?.data?.scenario || '').trim();
                        const firstMes = (ch?.first_mes || '').trim();
                        if (scen) scenParts.push(scen);
                        if (firstMes) scenParts.push(firstMes);
                    }
                    if (scenParts.length) sourceBlocks.push(`[Сценарий и завязка]\n${scenParts.join('\n\n')}`);
                }
            }
            if (state.wizUsePersona) { const pd = getUserPersonaDescriptionText(); if (pd) sourceBlocks.push(pd); }
            if (state.wizUseChat) { const ct = buildChatContextSnippet(state.wizChatCount); if (ct) sourceBlocks.push(ct); }
            if (state.wizUploadedDocs.length > 0) {
                sourceBlocks.push('[Документы]\n' + state.wizUploadedDocs.map(d => `--- ${d.name} ---\n${d.text.slice(0, 14000)}`).join('\n\n'));
            }
            if (selectedNotes.length > 0) {
                sourceBlocks.push('[Исходные заметки из Кодекса (опора канона)]\n' + selectedNotes.map((n, i) => `Запись #${i + 1} (${n.section} | ${n.title}):\n${n.content.trim()}`).join('\n\n'));
            }
        }

        const preset = getActiveForgeBookPreset();
        if (state.wizMode !== 'verbatim_keys') {
            if (state.wizCustomPrompt.trim()) {
                sourceBlocks.push(`[ПРЯМЫЕ УКАЗАНИЯ АВТОРА / ТЕМА И СЕТТИНГ (ВЫСШИЙ ПРИОРИТЕТ)]\n${state.wizCustomPrompt.trim()}`);
            } else if (sourceBlocks.length > 0) {
                sourceBlocks.push(`[АКТИВНЫЙ ШАБЛОН КУЗНИЦЫ: «${preset.name}»]\nАвтор выбрал готовый шаблон без дополнительного текста. Создай страницы Лорбука строго по системной инструкции шаблона «${preset.name}», опираясь на переданный контекст.`);
            }
        }
        const rawBookTemplate = (s.forgeBookSystemPrompt && s.forgeBookSystemPrompt.trim())
            ? s.forgeBookSystemPrompt.trim()
            : preset.bookPrompt;

        const wordLim = buildWordLimitPhrase(s.forgeWordsMin, s.forgeWordsMax);
        const entryCntPhrase = buildEntryCountPhrase(s.forgeEntryCount, s.uiLang || 'ru');

        const verbatimItems = [
            ...selectedNotes.map(n => ({ title: n.title || n.section, rawContent: n.content })),
            ...state.wizUploadedDocs.map(d => ({ title: d.name.replace(/\.[^.]+$/, ''), rawContent: d.text })),
        ];

        const sysPrompt = state.wizMode === 'verbatim_keys'
            ? `Ты — архивариус Лорбуков. Для каждого пронумерованного фрагмента придумай ТОЛЬКО метаданные (сам текст возвращать НЕ НУЖНО — он сохранится у автора дословно без изменений): короткое название в "comment", массив из 4–7 точных ключевых слов в "keys" на языке "${lang}", флаг "constant" (false для лора/мест/деталей, true только для глобальных правил), "position" (0 = до чара, 1 = после чара, 4 = глубина чата) и "depth" (число >= 0, например 4). Верни строго JSON: { "items": [ { "index": 0, "comment": "...", "keys": ["..."], "constant": false, "position": 1, "depth": 4 } ] }.`
            : rawBookTemplate
                .replace(/\{\{lang\}\}/gi, lang)
                .replace(/\{\{word_limit\}\}/gi, wordLim)
                .replace(/\{\{entry_count\}\}/gi, entryCntPhrase);

        const userPrompt = state.wizMode === 'verbatim_keys'
            ? verbatimItems.map((it, idx) => `[INDEX ${idx}] (${it.title}):\n${String(it.rawContent || '').slice(0, 6000)}`).join('\n\n---\n\n')
            : sourceBlocks.join('\n\n');

        return { sysPrompt, userPrompt, selectedNotes, verbatimItems };
    }

    async function executeAutoForge({ directCommit = false } = {}) {
        if (state.wizForging || state.commitSavingBusy) return;
        const s = ensureSettings();
        const uiLang = s.uiLang || 'ru';
        const originSession = {
            anchor: captureContextAnchor(),
            bindScope: state.bindAfterScope,
            muteCats: Boolean(state.wizMuteExportedCats),
            selectedCatIds: Object.keys(state.wizSelectedCats).filter(k => state.wizSelectedCats[k]),
            targetBookMode: state.targetBookMode,
            targetBookName: state.targetBookName,
            targetExistingId: state.targetExistingId,
            targetCover: state.targetCover,
        };
        state.wizOriginSession = originSession;
        const { sysPrompt, userPrompt, verbatimItems } = buildDynamicForgePrompts();

        if (state.wizMode === 'direct_no_ai' || state.wizMode === 'direct') {
            if (verbatimItems.length === 0) {
                state.wizStatus = tUi(uiLang, 'Отметь разделы Кодекса в спойлере ниже или прикрепи файл.', 'Select Codex sections below or attach a text file.');
                requestRender(); return;
            }
            // Preserve exact original text without forced mutation!
            state.stagedEntries = verbatimItems.map(it => ({
                included: true,
                comment: it.title,
                keys: it.title,
                content: String(it.rawContent || ''),
                constant: false, vectorized: false, position: 1, depth: 4, role: 0,
            }));
            state.stagedCollapsed = {};
            state.targetBookName = state.targetBookName || ('Lorebook_' + (stApi.ctx.name2 || 'Story'));
            if (directCommit) { await commitApprovedLorebook(originSession); return; }
            state.screen = 'approve'; state.wizStatus = ''; requestRender(); return;
        }

        if (state.wizMode === 'verbatim_keys' && verbatimItems.length === 0) {
            state.wizStatus = tUi(uiLang, 'Для дословного переноса отметь хотя бы один раздел Кодекса с записями или прикрепи файл.', 'Select at least one Codex section with notes or attach a file for verbatim mode.');
            requestRender(); return;
        }

        if (!userPrompt.trim()) {
            state.wizStatus = tUi(uiLang, 'Напиши тему/сеттинг выше или выбери источники.', 'Enter a theme/setting above or select source notes.');
            requestRender(); return;
        }

        const reqSeq = ++forgeAiSeq;
        const chatAtStart = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
        state.wizForging = true;
        state.wizStatus = directCommit
            ? tUi(uiLang, 'Куём и сохраняем готовый Лорбук...', 'Forging and saving Lorebook...')
            : tUi(uiLang, 'Кузница собирает черновик страниц...', 'Forging draft pages...');
        requestRender();

        try {
            if (state.wizMode === 'verbatim_keys') {
                const rawResp = await callForgeModel(sysPrompt, userPrompt, VERBATIM_META_JSON_SCHEMA, 3200);
                if (reqSeq !== forgeAiSeq || (stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '') !== chatAtStart) return;
                const obj = parseJsonObjectFromModel(rawResp, 'verbatim_keys');
                const metaItems = Array.isArray(obj?.items) ? obj.items : [];
                if (!metaItems.length) throw new Error(tUi(uiLang, 'Модель не вернула ключи для записей.', 'Model did not return metadata items.'));
                const metaByIdx = new Map(metaItems.map((m, idx) => [Number.isInteger(Number(m?.index)) ? Number(m.index) : idx, m]));

                state.stagedEntries = verbatimItems.map((orig, idx) => {
                    const m = metaByIdx.get(idx) || {};
                    const parsedKeys = parseSmartTriggerKeys(m.keys);
                    return {
                        included: true,
                        comment: String(m.comment || orig.title || 'Статья лора').trim(),
                        keys: parsedKeys.length ? parsedKeys.join(', ') : orig.title,
                        // 100% untouched original text — AI cannot rewrite a single character!
                        content: String(orig.rawContent || ''),
                        constant: Boolean(m.constant),
                        vectorized: false,
                        position: parseSafePosition(m.position, 1),
                        depth: parseSafeDepth(m.depth, 4),
                        role: 0,
                    };
                });
            } else {
                const estMaxTokens = Math.min(8192, Math.max(4400, (Number(s.forgeEntryCount) || 5) * 450));
                const rawResp = await callForgeModel(sysPrompt, userPrompt, FORGE_JSON_SCHEMA, estMaxTokens);
                if (reqSeq !== forgeAiSeq || (stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '') !== chatAtStart) return;
                const obj = parseJsonObjectFromModel(rawResp, 'book');
                const parsedEntries = Array.isArray(obj?.entries) ? obj.entries : null;
                if (!parsedEntries || parsedEntries.length === 0) {
                    throw new Error(tUi(uiLang, 'Модель не вернула список страниц.', 'Model did not return an entries list.'));
                }

                state.stagedEntries = parsedEntries.map(e => ({
                    included: true,
                    comment: String(e.comment || 'Статья лора').trim(),
                    keys: parseSmartTriggerKeys(e.keys).join(', '),
                    content: formatCleanParagraphs(e.content || ''),
                    constant: Boolean(e.constant),
                    vectorized: false,
                    position: parseSafePosition(e.position, 1),
                    depth: parseSafeDepth(e.depth, 4),
                    role: 0,
                }));
            }

            state.stagedCollapsed = {};
            state.targetBookName = state.targetBookName || ('Lorebook_' + (stApi.ctx.name2 || 'World'));
            state.wizStatus = '';
            if (directCommit) {
                await commitApprovedLorebook(originSession);
                return;
            }
            state.screen = 'approve';
        } catch (err) {
            if (reqSeq === forgeAiSeq) {
                state.wizStatus = 'Ошибка: ' + (err?.message || String(err));
            }
        } finally {
            if (reqSeq === forgeAiSeq) {
                state.wizForging = false;
                requestRender();
            }
        }
    }

    async function commitApprovedLorebook(explicitOriginSession = null) {
        if (state.commitSavingBusy) return false;
        const uiLang = ensureSettings().uiLang || 'ru';
        const chosenItems = state.stagedEntries.filter(e => e.included && String(e.content || '').trim());
        if (chosenItems.length === 0) return false;

        state.commitSavingBusy = true;
        const isPinnedDirect = Boolean(explicitOriginSession && explicitOriginSession.anchor);
        const session = isPinnedDirect
            ? explicitOriginSession
            : (state.wizOriginSession || {
                anchor: captureContextAnchor(),
                bindScope: state.bindAfterScope,
                muteCats: Boolean(state.wizMuteExportedCats),
                selectedCatIds: Object.keys(state.wizSelectedCats).filter(k => state.wizSelectedCats[k]),
            });

        const useTargetMode = isPinnedDirect && session.targetBookMode ? session.targetBookMode : state.targetBookMode;
        const useTargetExisting = isPinnedDirect && session.targetExistingId !== undefined ? session.targetExistingId : state.targetExistingId;
        const useTargetName = isPinnedDirect && session.targetBookName !== undefined ? session.targetBookName : state.targetBookName;
        const useTargetCover = isPinnedDirect && session.targetCover !== undefined ? session.targetCover : state.targetCover;

        try {
            let fileId = '';
            let confirmedExistingMerge = false;
            if (useTargetMode === 'existing' && useTargetExisting) {
                fileId = useTargetExisting;
                confirmedExistingMerge = true;
            } else {
                const rawName = (useTargetName || '').trim() || ('Lorebook_' + (stApi.ctx.name2 || 'World'));
                const sanitized = rawName.replace(/[<>:"/\\|?*]/g, '_');
                // Strict list check — throws and aborts if /api/worldinfo/list fails (e.g. HTTP 503)!
                const liveList = await fetchBooksList({ strict: true });
                const matched = liveList.find(b => String(b.file_id).toLowerCase() === sanitized.toLowerCase());
                if (matched) {
                    const mergeOk = window.confirm(tUi(
                        uiLang,
                        `Лорбук «${matched.file_id}» уже существует! Дописать новые страницы в конец книги «${matched.file_id}» (ОК) или отменить (Отмена)?`,
                        `Lorebook "${matched.file_id}" already exists! Append new pages to "${matched.file_id}" (OK) or cancel (Cancel)?`,
                    ));
                    if (!mergeOk) return false;
                    fileId = matched.file_id;
                    confirmedExistingMerge = true;
                } else {
                    fileId = sanitized;
                }
            }

            const existingCheck = confirmedExistingMerge || state.books.some(b => b.file_id === fileId) || (useTargetMode === 'existing');
            const wiTpl = stApi.worldInfoMod?.newWorldInfoEntryTemplate;
            let savedData = null;

            const safeTargetCover = sanitizeCoverDataUrl(useTargetCover);
            if (existingCheck) {
                savedData = await mutateBookAtomically(fileId, (workingCopy) => {
                    if (safeTargetCover) {
                        workingCopy.extensions = workingCopy.extensions || {};
                        workingCopy.extensions.pocket_codex_cover = safeTargetCover;
                    }
                    const uids = Object.keys(workingCopy.entries).map(Number).filter(n => !Number.isNaN(n));
                    let nextUid = uids.length > 0 ? (Math.max(...uids) + 1) : 0;
                    for (const item of chosenItems) {
                        workingCopy.entries[String(nextUid)] = makeStandardWiEntry(nextUid, item, wiTpl);
                        nextUid++;
                    }
                });
            } else {
                const workingCopy = { entries: {}, extensions: {} };
                if (safeTargetCover) {
                    workingCopy.extensions.pocket_codex_cover = safeTargetCover;
                }
                let nextUid = 0;
                for (const item of chosenItems) {
                    workingCopy.entries[String(nextUid)] = makeStandardWiEntry(nextUid, item, wiTpl);
                    nextUid++;
                }
                savedData = await enqueueBookWrite(fileId, async () => {
                    const recheck = await fetchBooksList({ strict: true });
                    if (recheck.some(b => String(b.file_id).toLowerCase() === fileId.toLowerCase())) {
                        throw new Error(tUi(
                            uiLang,
                            `Конфликт имени: Лорбук «${fileId}» был только что создан в другом окне. Нажмите «Сохранить» ещё раз, чтобы безопасно дописать страницы в конец книги.`,
                            `Name conflict: Lorebook "${fileId}" was concurrently created in another client. Click Save again to safely append pages.`,
                        ));
                    }
                    return saveBookData(fileId, workingCopy, { refreshList: true });
                });
            }

            let postSaveNotice = '';
            const contextStillMatches = isSameContextAnchor(session.anchor);
            if (session.bindScope === 'target_char' && typeof bindLorebookToTargetChar === 'function') {
                await bindLorebookToTargetChar(fileId);
            } else if (contextStillMatches) {
                await applyBindingScope(fileId, session.bindScope, session.anchor);
                if (session.muteCats && session.selectedCatIds.length > 0 && isSameContextAnchor(session.anchor)) {
                    const targetStore = session.anchor.storeRef || getActiveStore();
                    if (targetStore && Array.isArray(targetStore.categories)) {
                        for (const cid of session.selectedCatIds) {
                            const c = targetStore.categories.find(x => x.id === cid);
                            if (c) c.enabled = false;
                        }
                        saveAllCodex();
                    }
                }
            } else if (session.bindScope !== 'none' || (session.muteCats && session.selectedCatIds.length > 0)) {
                if (session.bindScope === 'global') {
                    await applyBindingScope(fileId, 'global');
                }
                postSaveNotice = tUi(
                    uiLang,
                    `Лорбук «${fileId}» сохранён, но активный чат был переключён во время экспорта: привязка книги и отключение разделов в исходном чате не применялись к новому чату.`,
                    `Lorebook "${fileId}" was saved, but the active chat changed during export: chat binding and section muting were skipped to protect the current chat.`,
                );
                try { window.toastr?.warning?.(postSaveNotice); } catch {}
            }

            state.wizOriginSession = null;
            state.wizUploadedDocs = [];
            state.stagedEntries = [];
            await fetchBooksList();
            try {
                window.dispatchEvent(new CustomEvent('nmf:lorebook-forged', { detail: { bookId: fileId } }));
            } catch {}
            state.activeBookId = fileId;
            state.activeBookData = savedData;
            state.saveError = postSaveNotice;
            state.wizStatus = postSaveNotice;
            state.screen = 'book_entries';
            state.commitSavingBusy = false;
            requestRender();
            return true;
        } catch (err) {
            const msg = 'Ошибка сохранения: ' + (err?.message || String(err));
            state.saveError = msg;
            state.wizStatus = msg;
            if (state.stagedEntries.length > 0) {
                state.screen = 'approve';
            }
            state.commitSavingBusy = false;
            try { window.toastr?.error?.(msg); } catch {}
            window.alert(msg);
            requestRender({ preserveBodyScroll: true });
            return false;
        } finally {
            state.commitSavingBusy = false;
        }
    }

    function renderBookCoverGraphic(bookId, bookName, rawCover, countNum, uiLang) {
        const safeCover = sanitizeCoverDataUrl(rawCover);
        if (safeCover) {
            return `<img class="pcx-cover-img" src="${escapeHtml(toBlobDisplayUrl(safeCover))}" alt="${escapeHtml(bookName)}">`;
        }
        const cntText = countNum !== undefined ? `${countNum} PAGES` : '';
        return renderProceduralCoverSvg({
            title: bookName || bookId,
            subtitle: uiLang === 'en' ? 'FORGE' : 'FORGE',
            countLabel: cntText,
            seed: bookId || bookName,
        });
    }

    function renderForgeBody() {
        const s = ensureSettings();
        const uiLang = s.uiLang || 'ru';
        const chatBoundList = getChatBoundBooks();
        const charBound = stApi.getCharLorebook?.() || '';
        const globalList = stApi.getGlobalLorebooks?.() || [];
        const store = getActiveStore();
        const profiles = getConnectionProfiles();
        const activePreset = getActiveForgeBookPreset();
        const allForgePresets = getAllForgeBookPresets();
        const mbStatus = stApi.getMemoryBooksStatus?.() || { installed: false, enabled: false, targetBook: '', mode: 'chat' };
        const aiModeShort = s.aiTransportMode === 'direct'
            ? tUi(uiLang, 'Режим ИИ: JSON-схема', 'AI Mode: JSON Schema')
            : tUi(uiLang, 'Режим ИИ: Через пресет Таверны', 'AI Mode: Tavern Preset');

        // 1. CREATE HUB (1:1 Concept renderForgeHub)
        if (state.screen === 'create_hub') {
            const hasBooks = state.books.length > 0;
            return `
                <button type="button" class="pcx-back-link" id="pcx-fg-back-shelf">${ICONS.chevLeft}<span>${tUi(uiLang, 'Назад на Полку Кузницы', 'Back to Forge Shelf')}</span></button>
                <div class="pcx-page-head">
                    <div>
                        <h1>${tUi(uiLang, 'Что выковать в Кузнице?', 'What would you like to forge?')}</h1>
                        
                    </div>
                </div>
                <div class="pcx-hub-grid">
                    <button type="button" class="pcx-hub-card" id="pcx-hub-whole-ai">
                        <div class="pcx-hub-card-head"><span class="pcx-icon-tile pcx-warm">${ICONS.forge}</span><span>${tUi(uiLang, 'Целый Лорбук (Мастер Ковки)', 'Full Lorebook (Forge Wizard)')}</span></div>
                        <small>${tUi(uiLang, 'Сгенерировать новые страницы мира по вашей теме и пресету, перенести заметки из Тетради или подобрать ИИ-ключи к вашему дословному тексту.', 'Generate world pages from your idea, transfer Notebook sections, or add AI keys to your verbatim text.')}</small>
                    </button>
                    <button type="button" class="pcx-hub-card" id="pcx-hub-whole-manual">
                        <div class="pcx-hub-card-head"><span class="pcx-icon-tile">${ICONS.book}</span><span>${tUi(uiLang, 'Пустой Лорбук вручную', 'Blank Lorebook Manually')}</span></div>
                        <small>${tUi(uiLang, 'Создать чистый том с арт-обложкой, сразу выбрать привязку (Чат / Глобально / К чару / На полке) и наполнять самому.', 'Create a clean tome with cover art and scope binding.')}</small>
                    </button>
                    <button type="button" class="pcx-hub-card" id="pcx-hub-page-ai" ${!hasBooks ? 'disabled' : ''}>
                        <div class="pcx-hub-card-head"><span class="pcx-icon-tile pcx-warm">${ICONS.spark}</span><span>${tUi(uiLang, 'Отдельную страницу с ИИ', 'Single Page with AI')}</span></div>
                        <small>${hasBooks ? tUi(uiLang, 'Добавить свежую локацию, NPC, фракцию или реликвию в любой существующий Лорбук по вашему запросу (со слепым скелетом формата).', 'Craft a new lore page into any existing Lorebook from your prompt.') : tUi(uiLang, 'Сначала создайте хотя бы один Лорбук.', 'Create at least one Lorebook first.')}</small>
                    </button>
                    <button type="button" class="pcx-hub-card" id="pcx-hub-page-manual" ${!hasBooks ? 'disabled' : ''}>
                        <div class="pcx-hub-card-head"><span class="pcx-icon-tile">${ICONS.edit}</span><span>${tUi(uiLang, 'Отдельную страницу вручную', 'Single Page Manually')}</span></div>
                        <small>${hasBooks ? tUi(uiLang, 'Написать статью самому на любую из 8 позиций World Info (включая глубину 0 и Outlet), а ключи ввести или подобрать кнопкой ИИ.', 'Write a page manually with optional 1-tap AI trigger key generation.') : tUi(uiLang, 'Сначала создайте хотя бы один Лорбук.', 'Create at least one Lorebook first.')}</small>
                    </button>
                </div>`;
        }

        // 2. NEW MANUAL BOOK (1:1 Concept renderForgeNewManualBook)
        if (state.screen === 'new_book') {
            const previewCover = sanitizeCoverDataUrl(state.newBookCover);
            return `
                <button type="button" class="pcx-back-link" id="pcx-fg-open-hub-btn">${ICONS.chevLeft}<span>${tUi(uiLang, 'Назад в выбор Кузницы', 'Back to Forge Hub')}</span></button>
                <div class="pcx-surface pcx-panel pcx-stack">
                    <h2>${tUi(uiLang, 'Новый пустой Лорбук', 'New Blank Lorebook')}</h2>
                    ${state.saveError ? `<div class="pcx-guide-note" style="background:var(--danger-wash);color:var(--danger);">${escapeHtml(state.saveError)}</div>` : ''}
                    <div class="pcx-pair">
                        <label class="pcx-field">
                            <span>${tUi(uiLang, 'Название Лорбука', 'Lorebook Name')}</span>
                            <input type="text" id="pcx-fg-newname" class="pcx-input" placeholder="${tUi(uiLang, 'Например: Хроники Кракоа / Мир Ведьмака', 'e.g. Chronicles of Krakoa')}" value="${escapeHtml(state.newBookName)}">
                        </label>
                        <label class="pcx-field">
                            <span>${tUi(uiLang, 'Куда сразу подключить?', 'Initial Binding Scope')} ${renderHelpBtn('forge_scope')}</span>
                            <select id="pcx-fg-newscope" class="pcx-input">
                                ${stApi.isChatOpen() ? `<option value="chat" ${state.newBookBindScope === 'chat' ? 'selected' : ''}>${tUi(uiLang, 'Только в текущий чат (доп. книга)', 'Current Chat Only')}</option>` : ''}
                                <option value="global" ${state.newBookBindScope === 'global' ? 'selected' : ''}>${tUi(uiLang, 'Глобально (в меню Мира Таверны)', 'Global (ST World Info menu)')}</option>
                                ${isSingleCharOpen() ? `<option value="char" ${state.newBookBindScope === 'char' ? 'selected' : ''}>${tUi(uiLang, 'К карточке текущего персонажа', 'Current Character Card')}</option>` : ''}
                                <option value="none" ${state.newBookBindScope === 'none' ? 'selected' : ''}>${tUi(uiLang, 'Пока оставить свободным на полке', 'Leave unbound on shelf')}</option>
                            </select>
                        </label>
                    </div>
                    ${renderHelpBubble('forge_scope')}
                    <div class="pcx-actions">
                        <div id="pcx-fg-newcover-pick" style="width:72px;aspect-ratio:2/2.65;border-radius:8px;overflow:hidden;border:1px solid var(--line-strong);cursor:pointer;flex:none;">
                            ${previewCover ? `<img src="${escapeHtml(toBlobDisplayUrl(previewCover))}" style="width:100%;height:100%;object-fit:cover;display:block;">` : renderProceduralCoverSvg({ title: state.newBookName || 'Tome', subtitle: 'FORGE', seed: state.newBookName || 'new' })}
                        </div>
                        <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fg-newcover-btn">${ICONS.image}<span>${previewCover ? tUi(uiLang, 'Сменить Арт-обложку', 'Change Cover Art') : tUi(uiLang, '+ Прикрепить Арт-обложку (без сжатия)', '+ Attach Cover Art (lossless)')}</span></button>
                        <input type="file" id="pcx-fg-newcover-input" accept="image/*" hidden>
                    </div>
                    <div class="pcx-actions pcx-end">
                        <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fg-back-shelf-2">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                        <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fg-create-manual-confirm">${ICONS.check}<span>${tUi(uiLang, 'Создать том', 'Create Tome')}</span></button>
                    </div>
                </div>`;
        }

        // 3. FULL LOREBOOK WIZARD (1:1 Concept renderForgeWizard + Custom Presets)
        if (state.screen === 'wizard') {
            const curBookPrompt = (s.forgeBookSystemPrompt && s.forgeBookSystemPrompt.trim()) ? s.forgeBookSystemPrompt : activePreset.bookPrompt;
            const charPicker = typeof getCharacterSourcePickerState === 'function'
                ? getCharacterSourcePickerState(uiLang)
                : { selectedValue: '', hasExternalCard: false, canBindTargetChar: false, targetCharName: '', options: [] };
            return `
                <button type="button" class="pcx-back-link" id="pcx-fg-open-hub-btn">${ICONS.chevLeft}<span>${tUi(uiLang, 'Назад в Кузницу', 'Back to Forge Hub')}</span></button>
                <div class="pcx-surface pcx-panel pcx-stack">
                    <div class="pcx-actions pcx-between">
                        <h2>${tUi(uiLang, 'Мастер Ковки Лорбука', 'Lorebook Forge Wizard')}</h2>
                        <button type="button" class="pcx-chip" data-open-settings-modal="1">${escapeHtml(aiModeShort)}</button>
                    </div>
                    <div class="pcx-pair">
                        <label class="pcx-field">
                            <span>${tUi(uiLang, 'Куда сохранить результат?', 'Save Target')}</span>
                            <select id="pcx-fg-target-mode" class="pcx-input">
                                <option value="new" ${state.targetBookMode === 'new' ? 'selected' : ''}>${tUi(uiLang, 'Создать новый Лорбук', 'Create New Lorebook')}</option>
                                ${state.books.length > 0 ? `<option value="existing" ${state.targetBookMode === 'existing' ? 'selected' : ''}>${tUi(uiLang, 'Дополнить существующий том', 'Append to Existing Tome')}</option>` : ''}
                            </select>
                        </label>
                        ${state.targetBookMode === 'existing' && state.books.length > 0 ? `
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Выберите книгу на полке', 'Target Book')}</span>
                                <select id="pcx-fg-target-existing" class="pcx-input">
                                    ${state.books.map(b => `<option value="${escapeHtml(b.file_id)}" ${state.targetExistingId === b.file_id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
                                </select>
                            </label>
                        ` : `
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Название новой книги', 'New Book Name')}</span>
                                <input type="text" id="pcx-fg-target-name" class="pcx-input" placeholder="${tUi(uiLang, 'Хроники мира...', 'World Chronicles...')}" value="${escapeHtml(state.targetBookName)}">
                            </label>
                        `}
                    </div>
                    <div class="pcx-pair">
                        <label class="pcx-field">
                            <span>${tUi(uiLang, 'Подключение книги после ковки', 'Bind Scope After Forge')}</span>
                            <select id="pcx-fg-bind-scope-after" class="pcx-input">
                                ${stApi.isChatOpen() ? `<option value="chat" ${state.bindAfterScope === 'chat' ? 'selected' : ''}>${tUi(uiLang, 'Только в этот чат', 'This Chat Only')}</option>` : ''}
                                <option value="global" ${state.bindAfterScope === 'global' ? 'selected' : ''}>${tUi(uiLang, 'Глобально (меню Мира Таверны)', 'Global (World Info menu)')}</option>
                                ${charPicker.canBindTargetChar ? `<option value="target_char" ${state.bindAfterScope === 'target_char' ? 'selected' : ''}>${tUi(uiLang, `К карточке «${charPicker.targetCharName}» в СТ`, `To "${charPicker.targetCharName}" in ST`)}</option>` : (isSingleCharOpen() ? `<option value="char" ${state.bindAfterScope === 'char' ? 'selected' : ''}>${tUi(uiLang, 'К карточке персонажа', 'Character Card')}</option>` : '')}
                                <option value="none" ${state.bindAfterScope === 'none' ? 'selected' : ''}>${tUi(uiLang, 'Не подключать сразу', 'Do Not Bind Immediately')}</option>
                            </select>
                        </label>
                        <label class="pcx-field">
                            <span>${tUi(uiLang, 'Режим сборки', 'Forge Assembly Mode')} ${renderHelpBtn('forge_mode')}</span>
                            <select id="pcx-fg-wiz-mode" class="pcx-input">
                                <option value="ai_adapt" ${state.wizMode === 'ai_adapt' ? 'selected' : ''}>${tUi(uiLang, 'Генерация Лорбука с Соавтором ИИ', 'AI Lorebook Generation')}</option>
                                <option value="verbatim_keys" ${state.wizMode === 'verbatim_keys' ? 'selected' : ''}>${tUi(uiLang, 'Мой текст дословно + ключи от ИИ', 'Verbatim Text + AI Trigger Keys')}</option>
                                <option value="direct_no_ai" ${(state.wizMode === 'direct_no_ai' || state.wizMode === 'direct') ? 'selected' : ''}>${tUi(uiLang, 'Прямой перенос заметок из Тетради без ИИ', 'Direct Notebook Transfer (No AI)')}</option>
                            </select>
                        </label>
                    </div>
                    ${renderHelpBubble('forge_mode')}

                    ${state.wizMode === 'ai_adapt' ? `
                        <div class="pcx-pair">
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Шаблон промпта Кузницы', 'Forge Preset')}</span>
                                <select id="pcx-fg-book-preset" class="pcx-input">
                                    ${allForgePresets.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === activePreset.id ? 'selected' : ''}>${p.isCustom ? '[Мой] ' : ''}${escapeHtml(uiLang === 'en' ? (p.nameEn || p.name) : p.name)}</option>`).join('')}
                                </select>
                            </label>
                            <div class="pcx-field" style="align-content:end;">
                                <div class="pcx-actions">
                                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fg-open-custom-preset">${ICONS.plus}<span>${tUi(uiLang, 'Свой пресет', 'Save Custom')}</span></button>
                                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fg-toggle-book-prompt">${ICONS.sliders}<span>${state.showBookPromptEditor ? tUi(uiLang, 'Скрыть промпт', 'Hide Prompt') : tUi(uiLang, 'Промпт ИИ', 'System Prompt')}</span></button>
                                </div>
                            </div>
                        </div>

                        <div class="pcx-preset-active-bar">
                            <strong>${tUi(uiLang, 'Выбран шаблон:', 'Selected preset:')} «${escapeHtml(uiLang === 'en' ? (activePreset.nameEn || activePreset.name) : activePreset.name)}»</strong>
                            <small>${escapeHtml(activePreset.placeholder || '')} ${tUi(uiLang, '(Поле пожеланий ниже необязательно — можно запускать сразу по контексту чата или вписать свои уточнения).', '(Wish box below is optional — run immediately from chat context or add custom details).')}</small>
                        </div>

                        ${activePreset.isCustom ? `
                            <div class="pcx-actions pcx-between pcx-surface" style="padding:8px 11px;background:var(--paper);">
                                <small>${tUi(uiLang, 'Активен ваш пресет:', 'Active custom preset:')} <strong>«${escapeHtml(activePreset.name)}»</strong></small>
                                <div class="pcx-actions">
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fg-update-custom-preset">${ICONS.save}<span>${tUi(uiLang, 'Обновить', 'Update')}</span></button>
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-danger-ghost" id="pcx-fg-del-custom-preset">${ICONS.trash}<span>${tUi(uiLang, 'Удалить', 'Delete')}</span></button>
                                </div>
                            </div>` : ''}

                        ${state.showCustomForgePresetBox ? `
                            <div class="pcx-surface pcx-panel pcx-stack" style="background:var(--paper);">
                                <strong>${tUi(uiLang, 'Сохранить свой личный пресет Кузницы', 'Save Custom Forge Preset')}</strong>
                                <div class="pcx-pair">
                                    <input type="text" id="pcx-fg-custom-name" class="pcx-input" placeholder="${tUi(uiLang, 'Название вашего пресета...', 'Your preset name...')}" value="${escapeHtml(state.customForgeNameDraft || '')}">
                                    <input type="text" id="pcx-fg-custom-ph" class="pcx-input" placeholder="${tUi(uiLang, 'Подсказка поля идеи (необязательно)...', 'Optional placeholder...')}" value="${escapeHtml(state.customForgePhDraft || '')}">
                                </div>
                                <textarea id="pcx-fg-book-sysprompt" class="pcx-input pcx-mono" rows="4">${escapeHtml(curBookPrompt)}</textarea>
                                <div class="pcx-actions pcx-end">
                                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" id="pcx-fg-cancel-custom-preset">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary" id="pcx-fg-save-custom-preset">${ICONS.save}<span>${tUi(uiLang, 'Сохранить пресет', 'Save Preset')}</span></button>
                                </div>
                            </div>` : ''}

                        ${(state.showBookPromptEditor && !state.showCustomForgePresetBox) ? `
                            <div class="pcx-surface pcx-panel pcx-stack" style="background:var(--paper);">
                                <div class="pcx-actions pcx-between">
                                    <small>Макросы: <code>{{lang}}</code>, <code>{{word_limit}}</code>, <code>{{entry_count_rule}}</code></small>
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fg-reset-book-prompt">${ICONS.reset}<span>${tUi(uiLang, 'К шаблону', 'Reset')}</span></button>
                                </div>
                                <textarea id="pcx-fg-book-sysprompt" class="pcx-input pcx-mono" rows="4">${escapeHtml(curBookPrompt)}</textarea>
                            </div>` : ''}

                        <div class="pcx-row-3">
                            <label class="pcx-field"><span>${tUi(uiLang, 'Записей (0 = авто)', 'Entries (0=auto)')}</span><input type="number" id="pcx-fg-entry-cnt" class="pcx-input" min="0" max="50" value="${s.forgeEntryCount ?? 0}"></label>
                            <label class="pcx-field"><span>${tUi(uiLang, 'Слов от', 'Min Words')}</span><input type="number" id="pcx-fg-wmin" class="pcx-input" min="0" max="5000" value="${s.forgeWordsMin ?? 60}"></label>
                            <label class="pcx-field"><span>${tUi(uiLang, 'Слов до', 'Max Words')}</span><input type="number" id="pcx-fg-wmax" class="pcx-input" min="0" max="5000" value="${s.forgeWordsMax ?? 240}"></label>
                        </div>

                        <div class="pcx-pair">
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Профиль подключения ИИ', 'AI Connection Profile')}</span>
                                <select id="pcx-fg-wiz-profile" class="pcx-input">
                                    <option value="" ${!s.aiProfileId ? 'selected' : ''}>${tUi(uiLang, '[ Текущее подключение SillyTavern ]', '[ Current Connection ]')}</option>
                                    ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${s.aiProfileId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                                </select>
                            </label>
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Язык текста', 'Output Language')}</span>
                                <select id="pcx-fg-wiz-lang" class="pcx-input">${LANGUAGES.map(l => `<option value="${escapeHtml(l.id)}" ${s.aiLang === l.id ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('')}</select>
                            </label>
                        </div>
                    ` : ''}

                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Ваше задание / сырой текст мира (пишите свободно всё, что нужно включить)', 'Your World Idea / Raw Lore Text')}</span>
                        <textarea id="pcx-fg-wiz-task" class="pcx-input" rows="4" placeholder="${escapeHtml(activePreset.placeholder || '')}">${escapeHtml(state.wizCustomPrompt)}</textarea>
                    </label>

                    <div class="pcx-surface pcx-panel pcx-stack" style="background:var(--paper);">
                        <strong>${tUi(uiLang, 'Источники контекста и перенос из Тетради', 'Context Sources & Notebook Transfer')}</strong>
                        ${charPicker.options.length > 0 ? `
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Карточка / определения персонажа для Кузницы', 'Character Card / Definitions Source')}</span>
                                <select id="pcx-fg-char-source" class="pcx-input">
                                    ${charPicker.options.map(opt => `<option value="${escapeHtml(opt.value)}" ${charPicker.selectedValue === opt.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
                                </select>
                            </label>` : ''}
                        <div class="pcx-chk-row">
                            <label class="pcx-chk-label"><input type="checkbox" id="pcx-fg-src-char" ${state.wizUseChar ? 'checked' : ''}><span>${tUi(uiLang, 'Карточка персонажа', 'Character Card')}</span></label>
                            <label class="pcx-chk-label"><input type="checkbox" id="pcx-fg-src-scen" ${state.wizUseScenario ? 'checked' : ''}><span>${tUi(uiLang, 'Сценарий', 'Scenario')}</span></label>
                            <label class="pcx-chk-label"><input type="checkbox" id="pcx-fg-src-pers" ${state.wizUsePersona ? 'checked' : ''}><span>${tUi(uiLang, 'Персона игрока', 'User Persona')}</span></label>
                            <label class="pcx-chk-label"><input type="checkbox" id="pcx-fg-src-chat" ${state.wizUseChat ? 'checked' : ''}><span>${tUi(uiLang, 'Последние посты чата', 'Recent Chat')}</span></label>
                        </div>
                        <small>${tUi(uiLang, 'Отметьте разделы Тетради, если хотите переплавить их карточки в страницы Лорбука:', 'Select Notebook sections to smelt into Lorebook entries:')}</small>
                        <div class="pcx-chip-row">
                            ${store.categories.map(c => {
                                const on = Boolean(state.wizSelectedCats[c.id]);
                                const cnt = store.notes.filter(n => n.categoryId === c.id && n.enabled !== false).length;
                                return `<button type="button" class="pcx-chip ${on ? 'pcx-active' : ''}" data-wz-cat="${escapeHtml(c.id)}"><span>${escapeHtml(displayCategoryName(c, uiLang))}</span><span class="pcx-key-badge">${cnt}</span></button>`;
                            }).join('')}
                        </div>
                        <div class="pcx-actions pcx-between">
                            <label class="pcx-chk-label">
                                <input type="checkbox" id="pcx-fg-mute-cats" ${state.wizMuteExportedCats ? 'checked' : ''}>
                                <span>${tUi(uiLang, 'Выключить перенесённые разделы Тетради после записи', 'Auto-mute transferred Notebook sections')}</span>
                            </label>
                            <div>
                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fg-wiz-doc-btn">${ICONS.clip}<span>${state.wizUploadedDocs.length ? `${tUi(uiLang, 'Файлов:', 'Files:')} ${state.wizUploadedDocs.length}` : tUi(uiLang, '+ Прикрепить .txt / .md', '+ Attach .txt / .md')}</span></button>
                                <input type="file" id="pcx-fg-wiz-doc-in" accept=".txt,.md,.json,.csv" multiple hidden>
                            </div>
                        </div>
                    </div>

                    ${state.wizStatus ? `<div class="pcx-guide-note">${state.wizForging ? ICONS.spinner : ''} <span>${escapeHtml(state.wizStatus)}</span></div>` : ''}

                    <div class="pcx-actions pcx-end">
                        <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fg-run-wiz-draft" ${state.wizForging ? 'disabled' : ''}>${tUi(uiLang, 'Сначала на стол проверки (Черновик)', 'Preview on Staging Table')}</button>
                        <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fg-run-wiz-direct" ${state.wizForging ? 'disabled' : ''}>${state.wizForging ? ICONS.spinner : ICONS.forge}<span>${tUi(uiLang, 'Выковать и сразу сохранить', 'Forge & Save Directly')}</span></button>
                    </div>
                </div>`;
        }

        // 4. STAGING TABLE (1:1 Concept renderForgeStaging)
        if (state.screen === 'approve') {
            const allStCol = state.stagedEntries.length > 0 && state.stagedEntries.every((_, i) => Boolean(state.stagedCollapsed[i]));
            const incCount = state.stagedEntries.filter(x => x.included).length;
            return `
                <button type="button" class="pcx-back-link" id="pcx-fg-back-wiz">${ICONS.chevLeft}<span>${tUi(uiLang, 'Назад к настройкам Ковки', 'Back to Wizard')}</span></button>
                <div class="pcx-page-head">
                    <div>
                        <h1>${tUi(uiLang, 'Стол проверки перед записью в том', 'Staging Table Before Commit')}</h1>
                        <p>${tUi(uiLang, 'Проверьте или поправьте сгенерированные статьи и ключи вручную — в Лорбук попадут только отмеченные карточки.', 'Review, edit, or toggle drafted entries before committing them atomically into the Lorebook.')}</p>
                    </div>
                    <div class="pcx-actions">
                        ${state.stagedEntries.length > 1 ? `<button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-st-collapse-all">${allStCol ? tUi(uiLang, 'Развернуть все', 'Expand All') : tUi(uiLang, 'Свернуть все', 'Collapse All')}</button>` : ''}
                        <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fg-commit-btn" ${(state.commitSavingBusy || incCount === 0) ? 'disabled' : ''}>${ICONS.check}<span>${tUi(uiLang, `Записать (${incCount}) в Лорбук`, `Commit (${incCount})`)}</span></button>
                    </div>
                </div>
                ${state.saveError ? `<div class="pcx-guide-note" style="background:var(--danger-wash);color:var(--danger);">${escapeHtml(state.saveError)}</div>` : ''}
                <div class="pcx-stack">
                    ${state.stagedEntries.map((st, idx) => {
                        const isCol = Boolean(state.stagedCollapsed[idx]);
                        return `
                            <article class="pcx-note-card ${!st.included ? 'pcx-disabled-card' : ''} ${!isCol ? 'pcx-is-open' : ''}" data-stage-idx="${idx}">
                                <div class="pcx-note-head">
                                    <div class="pcx-note-title-wrap">
                                        <input type="checkbox" class="pcx-st-inc" data-idx="${idx}" ${st.included ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);">
                                        <button type="button" class="pcx-note-title-btn" data-st-col="${idx}">
                                            <span class="pcx-note-title-text">${escapeHtml(st.comment || ('Страница #' + (idx + 1)))}</span>
                                        </button>
                                    </div>
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-st-col="${idx}">${isCol ? ICONS.chevDown : ICONS.chevUp}</button>
                                </div>
                                ${!isCol ? `
                                    <div class="pcx-note-body">
                                        <div class="pcx-pair">
                                            <label class="pcx-field"><span>${tUi(uiLang, 'Заголовок страницы', 'Page Title')}</span><input class="pcx-input pcx-st-comment" data-idx="${idx}" value="${escapeHtml(st.comment)}"></label>
                                            <label class="pcx-field"><span>${tUi(uiLang, 'Ключи срабатывания', 'Trigger Keys')}</span><input class="pcx-input pcx-st-keys" data-idx="${idx}" value="${escapeHtml(st.keys)}"></label>
                                        </div>
                                        <div class="pcx-row-3">
                                            <label class="pcx-field"><span>${tUi(uiLang, 'Активация', 'Trigger')}</span><select class="pcx-input pcx-st-trig" data-idx="${idx}"><option value="keys" ${(!st.constant && !st.vectorized) ? 'selected' : ''}>По ключам</option><option value="const" ${st.constant ? 'selected' : ''}>Постоянно</option><option value="vec" ${st.vectorized ? 'selected' : ''}>Вектор</option></select></label>
                                            <label class="pcx-field"><span>${tUi(uiLang, 'Позиция', 'Position')}</span><select class="pcx-input pcx-st-pos" data-idx="${idx}">${renderPositionOptions(st.position, uiLang)}</select></label>
                                            <label class="pcx-field"><span>${Number(st.position) === 4 ? tUi(uiLang, 'Глубина', 'Depth') : tUi(uiLang, 'Роль', 'Role')}</span>${Number(st.position) === 4 ? `<input type="number" min="0" max="999" class="pcx-input pcx-st-depth" data-idx="${idx}" value="${parseSafeDepth(st.depth, 4)}">` : `<select class="pcx-input pcx-st-role" data-idx="${idx}"><option value="0" ${Number(st.role) === 0 ? 'selected' : ''}>System</option><option value="1" ${Number(st.role) === 1 ? 'selected' : ''}>User</option><option value="2" ${Number(st.role) === 2 ? 'selected' : ''}>Assistant</option></select>`}</label>
                                        </div>
                                        ${Number(st.position) === 7 ? `<label class="pcx-field"><span>Outlet ({{outlet::Имя}})</span><input class="pcx-input pcx-st-outlet" data-idx="${idx}" placeholder="LoreOutlet" value="${escapeHtml(st.outletName || '')}"></label>` : ''}
                                        <textarea class="pcx-input pcx-st-content" data-idx="${idx}" rows="4">${escapeHtml(st.content)}</textarea>
                                    </div>` : ''}
                            </article>`;
                    }).join('')}
                </div>`;
        }

        // 5. SINGLE PAGE EDITOR (1:1 Concept renderForgeEntryEditor + Custom Presets + 3-way merge)
        if (state.screen === 'entry_edit' && state.entryDraft) {
            const d = state.entryDraft;
            const curPagePrompt = (s.forgePageSystemPrompt && s.forgePageSystemPrompt.trim()) ? s.forgePageSystemPrompt : activePreset.pagePrompt;
            const cand = state.pageAiCandidates[state.pageAiCandIdx] || null;
            const keysVal = state.entryKeysDirty ? state.entryKeysRawText : (Array.isArray(d.key) ? d.key.join(', ') : '');
            const trigMode = d.constant ? 'const' : (d.vectorized ? 'vec' : 'keys');

            return `
                <button type="button" class="pcx-back-link" id="pcx-fge-cancel">${ICONS.chevLeft}<span>${state.activeBookId ? tUi(uiLang, 'Назад к страницам книги', 'Back to Book Pages') : tUi(uiLang, 'Назад на Полку', 'Back to Shelf')}</span></button>
                <div class="pcx-surface pcx-panel pcx-stack">
                    <div class="pcx-actions pcx-between">
                        <h2>${state.editingUid !== null ? tUi(uiLang, 'Редактор страницы Лорбука', 'Edit Lorebook Page') : tUi(uiLang, 'Новая страница Лорбука', 'New Lorebook Page')}</h2>
                        <select id="pcx-fge-book-select" class="pcx-input" style="width:auto !important;min-width:165px;max-width:260px;">
                            ${state.books.map(b => `<option value="${escapeHtml(b.file_id)}" ${b.file_id === state.entryTargetBookId ? 'selected' : ''}>${tUi(uiLang, 'Том:', 'Tome:')} ${escapeHtml(b.name)}</option>`).join('')}
                        </select>
                    </div>
                    ${state.saveError ? `<div class="pcx-guide-note" style="background:var(--danger-wash);color:var(--danger);">${escapeHtml(state.saveError)}</div>` : ''}

                    <div class="pcx-seg-tabs">
                        <button type="button" class="pcx-seg-tab ${state.entryEditTab === 'manual' ? 'pcx-active' : ''}" data-fgetab="manual">${tUi(uiLang, 'Вручную', 'Manual')}</button>
                        <button type="button" class="pcx-seg-tab ${state.entryEditTab === 'ai' ? 'pcx-active' : ''}" data-fgetab="ai">${tUi(uiLang, 'С Соавтором (ИИ)', 'AI Co-Author')}</button>
                    </div>

                    ${state.entryEditTab === 'ai' ? `
                        <div class="pcx-pair">
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Шаблон задачи (Пресет)', 'Forge Preset')}</span>
                                <select id="pcx-fgp-preset" class="pcx-input">
                                    ${allForgePresets.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === activePreset.id ? 'selected' : ''}>${p.isCustom ? '[Мой] ' : ''}${escapeHtml(uiLang === 'en' ? (p.nameEn || p.name) : p.name)}</option>`).join('')}
                                </select>
                            </label>
                            <div class="pcx-field" style="align-content:end;">
                                <div class="pcx-actions">
                                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fg-open-custom-preset">${ICONS.plus}<span>${tUi(uiLang, 'Свой', 'Custom')}</span></button>
                                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fgp-toggle-prompt">${ICONS.sliders}<span>${state.showPagePromptEditor ? tUi(uiLang, 'Скрыть промпт', 'Hide Prompt') : tUi(uiLang, 'Промпт ИИ', 'System Prompt')}</span></button>
                                </div>
                            </div>
                        </div>

                        <div class="pcx-preset-active-bar">
                            <strong>${tUi(uiLang, 'Выбран шаблон:', 'Selected preset:')} «${escapeHtml(uiLang === 'en' ? (activePreset.nameEn || activePreset.name) : activePreset.name)}»</strong>
                            <small>${escapeHtml(activePreset.placeholder || '')} ${tUi(uiLang, '(Поле пожеланий ниже необязательно — можно запускать сразу по контексту чата или вписать свои уточнения).', '(Wish box below is optional — run immediately from chat context or add custom details).')}</small>
                        </div>

                        ${activePreset.isCustom ? `
                            <div class="pcx-actions pcx-between pcx-surface" style="padding:8px 11px;background:var(--paper);">
                                <small>${tUi(uiLang, 'Ваш пресет:', 'Custom preset:')} <strong>«${escapeHtml(activePreset.name)}»</strong></small>
                                <div class="pcx-actions">
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fg-update-custom-preset">${ICONS.save}<span>${tUi(uiLang, 'Обновить', 'Update')}</span></button>
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-danger-ghost" id="pcx-fg-del-custom-preset">${ICONS.trash}</button>
                                </div>
                            </div>` : ''}

                        ${state.showCustomForgePresetBox ? `
                            <div class="pcx-surface pcx-panel pcx-stack" style="background:var(--paper);">
                                <strong>${tUi(uiLang, 'Сохранить свой пресет страницы', 'Save Custom Page Preset')}</strong>
                                <div class="pcx-pair">
                                    <input type="text" id="pcx-fg-custom-name" class="pcx-input" placeholder="${tUi(uiLang, 'Название вашего пресета...', 'Your preset name...')}" value="${escapeHtml(state.customForgeNameDraft || '')}">
                                    <input type="text" id="pcx-fg-custom-ph" class="pcx-input" placeholder="${tUi(uiLang, 'Подсказка поля идеи...', 'Optional placeholder...')}" value="${escapeHtml(state.customForgePhDraft || '')}">
                                </div>
                                <textarea id="pcx-fgp-sysprompt" class="pcx-input pcx-mono" rows="4">${escapeHtml(curPagePrompt)}</textarea>
                                <div class="pcx-actions pcx-end">
                                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" id="pcx-fg-cancel-custom-preset">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary" id="pcx-fg-save-custom-preset">${ICONS.save}<span>${tUi(uiLang, 'Сохранить пресет', 'Save Preset')}</span></button>
                                </div>
                            </div>` : ''}

                        ${(state.showPagePromptEditor && !state.showCustomForgePresetBox) ? `
                            <div class="pcx-surface pcx-panel pcx-stack" style="background:var(--paper);">
                                <div class="pcx-actions pcx-between">
                                    <small>Макросы: <code>{{lang}}</code>, <code>{{word_limit}}</code></small>
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fgp-reset-prompt">${ICONS.reset}<span>${tUi(uiLang, 'К шаблону', 'Reset')}</span></button>
                                </div>
                                <textarea id="pcx-fgp-sysprompt" class="pcx-input pcx-mono" rows="4">${escapeHtml(curPagePrompt)}</textarea>
                            </div>` : ''}

                        <div class="pcx-row-3">
                            <label class="pcx-field"><span>${tUi(uiLang, 'Слов от', 'Min Words')}</span><input type="number" id="pcx-fgp-wmin" class="pcx-input" min="0" max="5000" value="${s.forgeWordsMin ?? 60}"></label>
                            <label class="pcx-field"><span>${tUi(uiLang, 'Слов до', 'Max Words')}</span><input type="number" id="pcx-fgp-wmax" class="pcx-input" min="0" max="5000" value="${s.forgeWordsMax ?? 240}"></label>
                            <label class="pcx-field"><span>${tUi(uiLang, 'Постов чата', 'Chat Msgs')}</span><input type="number" id="pcx-fgp-radius" class="pcx-input" min="0" max="200" value="${s.aiChatRadius ?? 10}"></label>
                        </div>

                        <label class="pcx-field">
                            <span>${tUi(uiLang, 'О чём придумать или как доработать страницу? (ваш свободный запрос)', 'What should AI write or refine on this page?')}</span>
                            <textarea id="pcx-fgp-task" class="pcx-input" rows="4" placeholder="${escapeHtml(activePreset.placeholder || '')}">${escapeHtml(state.pageAiTask)}</textarea>
                        </label>

                        <details class="pcx-spoiler">
                            <summary><span>${tUi(uiLang, 'Контекст, профиль ИИ и слепой контур приватности', 'Context, AI Profile & Blind Lore Privacy')}</span>${ICONS.chevDown}</summary>
                            <div class="pcx-spoiler-body">
                                <div class="pcx-pair">
                                    <label class="pcx-field">
                                        <span>${tUi(uiLang, 'Профиль подключения ИИ', 'AI Connection Profile')}</span>
                                        <select id="pcx-fgp-profile" class="pcx-input">
                                            <option value="" ${!s.aiProfileId ? 'selected' : ''}>${tUi(uiLang, '[ Текущее подключение ]', '[ Current Connection ]')}</option>
                                            ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${s.aiProfileId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                                        </select>
                                    </label>
                                    <label class="pcx-field">
                                        <span>${tUi(uiLang, 'Целевой язык', 'Language')}</span>
                                        <select id="pcx-fgp-lang" class="pcx-input">${LANGUAGES.map(l => `<option value="${escapeHtml(l.id)}" ${s.aiLang === l.id ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('')}</select>
                                    </label>
                                </div>
                                <div class="pcx-chk-row">
                                    <label class="pcx-chk-label"><input type="checkbox" id="pcx-fgp-fmt" ${state.pageAiMatchFormat ? 'checked' : ''}><span>${tUi(uiLang, 'Слепой скелет разметки книги (без слива чужих текстов)', 'Blind structural skeleton only')}</span></label>
                                    <label class="pcx-chk-label"><input type="checkbox" id="pcx-fgp-char" ${state.pageAiUseChar ? 'checked' : ''}><span>${tUi(uiLang, 'Персонаж', 'Character')}</span></label>
                                    <label class="pcx-chk-label"><input type="checkbox" id="pcx-fgp-pers" ${state.pageAiUsePersona ? 'checked' : ''}><span>${tUi(uiLang, 'Персона', 'Persona')}</span></label>
                                    <label class="pcx-chk-label"><input type="checkbox" id="pcx-fgp-chat" ${state.pageAiUseChat ? 'checked' : ''}><span>${tUi(uiLang, 'Чат', 'Chat')}</span></label>
                                </div>
                            </div>
                        </details>

                        ${state.pageAiStatus ? `<div class="pcx-guide-note">${state.pageAiGenerating ? ICONS.spinner : ''} <span>${escapeHtml(state.pageAiStatus)}</span></div>` : ''}

                        <div class="pcx-actions pcx-between">
                            <button type="button" class="pcx-chip" data-open-settings-modal="1">${escapeHtml(aiModeShort)}</button>
                            <div class="pcx-actions">
                                <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fgp-run-draft" ${state.pageAiGenerating ? 'disabled' : ''}>${tUi(uiLang, 'Сначала черновик', 'Draft First')}</button>
                                <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fgp-run-direct" ${state.pageAiGenerating ? 'disabled' : ''}>${state.pageAiGenerating ? ICONS.spinner : ICONS.spark}<span>${tUi(uiLang, 'Создать и сразу сохранить', 'Forge & Save')}</span></button>
                            </div>
                        </div>

                        ${cand ? `
                            <div class="pcx-ai-cand-box">
                                <div class="pcx-actions pcx-between">
                                    <strong>${tUi(uiLang, 'Черновик страницы от Соавтора', 'AI Page Draft')} (${state.pageAiCandIdx + 1}/${state.pageAiCandidates.length})</strong>
                                    <div class="pcx-actions">
                                        <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fgc-prev" ${state.pageAiCandIdx <= 0 ? 'disabled' : ''}>${ICONS.chevLeft}</button>
                                        <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fgc-next" ${state.pageAiCandIdx >= state.pageAiCandidates.length - 1 ? 'disabled' : ''}>${ICONS.chevRight}</button>
                                    </div>
                                </div>
                                <input type="text" id="pcx-fgc-comment" class="pcx-input" value="${escapeHtml(cand.comment || '')}" placeholder="${tUi(uiLang, 'Название страницы', 'Page title')}">
                                <input type="text" id="pcx-fgc-keys" class="pcx-input" value="${escapeHtml(cand.keys || '')}" placeholder="${tUi(uiLang, 'Ключи через запятую', 'Comma-separated keys')}">
                                <textarea id="pcx-fgc-content" class="pcx-input" rows="5">${escapeHtml(cand.content || '')}</textarea>
                                <div class="pcx-search-bar" style="margin:0;">
                                    <input type="text" id="pcx-fgc-refine" class="pcx-input" placeholder="${tUi(uiLang, 'Что уточнить или исправить в черновике?...', 'What should AI refine in this draft?...')}" value="${escapeHtml(state.pageAiRefineText)}">
                                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fgc-run-refine" ${state.pageAiGenerating ? 'disabled' : ''}>${tUi(uiLang, 'Доработать', 'Refine')}</button>
                                </div>
                                <div class="pcx-actions pcx-end">
                                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fgc-to-manual">${tUi(uiLang, 'Перенести в ручной редактор', 'Move to Manual')}</button>
                                    <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fgc-save-now">${ICONS.check}<span>${tUi(uiLang, 'Сохранить страницу в книгу', 'Save Page to Book')}</span></button>
                                </div>
                            </div>` : ''}
                    ` : `
                        <label class="pcx-field">
                            <span>${tUi(uiLang, 'Название страницы', 'Page Title')}</span>
                            <input type="text" id="pcx-fge-comment" class="pcx-input" value="${escapeHtml(d.comment || '')}" placeholder="${tUi(uiLang, 'Например: Купе №4 и ведомственный сургуч', 'e.g. Compartment #4 & Royal Wax')}">
                        </label>
                        <div class="pcx-field">
                            <div class="pcx-actions pcx-between">
                                <span>${tUi(uiLang, 'Ключевые слова (через запятую, поддерживается /regex/i)', 'Trigger Keys (comma-separated or /regex/i)')}</span>
                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-soft" id="pcx-fge-genkeys" ${state.keysGenerating ? 'disabled' : ''}>${state.keysGenerating ? ICONS.spinner : ICONS.spark}<span>${tUi(uiLang, 'Подобрать ключи ИИ', 'Generate Keys with AI')}</span></button>
                            </div>
                            <input type="text" id="pcx-fge-keys" class="pcx-input" value="${escapeHtml(keysVal)}" placeholder="купе 4, сургуч, /\\bревизор\\w*/i">
                        </div>
                        <div class="pcx-pair">
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Режим активации', 'Trigger Mode')} ${renderHelpBtn('forge_trig')}</span>
                                <select id="pcx-fge-trig" class="pcx-input">
                                    <option value="keys" ${trigMode === 'keys' ? 'selected' : ''}>${tUi(uiLang, 'По ключам в чате', 'By Keywords')}</option>
                                    <option value="const" ${trigMode === 'const' ? 'selected' : ''}>${tUi(uiLang, 'Постоянно в контексте', 'Constant')}</option>
                                    <option value="vec" ${trigMode === 'vec' ? 'selected' : ''}>${tUi(uiLang, 'Векторизация (RAG)', 'Vectorized (RAG)')}</option>
                                </select>
                            </label>
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Позиция World Info (0–7)', 'Position (0–7)')}</span>
                                <select id="pcx-fge-pos" class="pcx-input">${renderPositionOptions(d.position, uiLang)}</select>
                            </label>
                        </div>
                        ${renderHelpBubble('forge_trig')}
                        ${Number(d.position) === 4 ? `
                            <div class="pcx-pair">
                                <label class="pcx-field"><span>${tUi(uiLang, 'Глубина (@ Depth, 0 = самый низ)', 'Depth (@ Depth, 0 = bottom)')}</span><input type="number" id="pcx-fge-depth" class="pcx-input" min="0" max="999" value="${parseSafeDepth(d.depth, 4)}"></label>
                                <label class="pcx-field">
                                    <span>${tUi(uiLang, 'Роль сообщения', 'Message Role')}</span>
                                    <select id="pcx-fge-role" class="pcx-input">
                                        <option value="0" ${Number(d.role) === 0 ? 'selected' : ''}>System</option>
                                        <option value="1" ${Number(d.role) === 1 ? 'selected' : ''}>User</option>
                                        <option value="2" ${Number(d.role) === 2 ? 'selected' : ''}>Assistant</option>
                                    </select>
                                </label>
                            </div>` : ''}
                        ${Number(d.position) === 7 ? `
                            <label class="pcx-field">
                                <span>${tUi(uiLang, 'Имя шлюза Outlet (для вставки в пресет через {{outlet::Имя}})', 'Outlet Name (for {{outlet::Name}})')}</span>
                                <input type="text" id="pcx-fge-outlet" class="pcx-input" value="${escapeHtml(d.outletName || '')}" placeholder="LoreOutlet">
                            </label>` : ''}
                        <div class="pcx-field">
                            <div class="pcx-actions pcx-between">
                                <span>${tUi(uiLang, 'Содержание страницы', 'Page Content')}</span>
                                <div class="pcx-actions">
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fge-format-btn">${ICONS.align}<span>${tUi(uiLang, 'Выровнять отступы', 'Clean Paragraphs')}</span></button>
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fge-import-txt">${ICONS.clip}<span>+ .txt</span></button>
                                    <input type="file" id="pcx-fge-file-in" accept=".txt,.md" hidden>
                                </div>
                            </div>
                            <textarea id="pcx-fge-content" class="pcx-input" rows="8">${escapeHtml(d.content || '')}</textarea>
                        </div>
                        <div class="pcx-chk-row">
                            <label class="pcx-chk-label"><input type="checkbox" id="pcx-fge-prevrec" ${d.preventRecursion ? 'checked' : ''}><span>${tUi(uiLang, 'Не будить другие записи (prevent_recursion)', 'Prevent further recursion')}</span></label>
                            <label class="pcx-chk-label"><input type="checkbox" id="pcx-fge-exclrec" ${d.excludeRecursion ? 'checked' : ''}><span>${tUi(uiLang, 'Не срабатывать от других записей (exclude_recursion)', 'Exclude from recursion')}</span></label>
                        </div>
                        <div class="pcx-actions pcx-end">
                            <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fge-cancel-2">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                            <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fge-save" ${state.entrySavingBusy ? 'disabled' : ''}>${ICONS.check}<span>${tUi(uiLang, 'Сохранить страницу', 'Save Page')}</span></button>
                        </div>
                    `}
                </div>`;
        }

        // 6. OPEN BOOK ENTRIES (1:1 Concept renderForgeBookEntries + Organic Collapsible + Page Drag-and-Drop!)
        if (state.screen === 'book_entries' && state.activeBookData) {
            const entriesObj = state.activeBookData.entries || {};
            const list = Object.values(entriesObj).sort((a, b) => {
                const da = Number.isFinite(Number(a?.displayIndex)) ? Number(a.displayIndex) : 999999;
                const db = Number.isFinite(Number(b?.displayIndex)) ? Number(b.displayIndex) : 999999;
                return da !== db ? da - db : Number(a?.uid) - Number(b?.uid);
            });
            const totalEntries = list.length;
            const colMap = getBookCollapsedMap(state.activeBookId);
            const allCollapsed = list.length > 0 && list.every(e => Boolean(colMap[e.uid]));
            const isAnyBound = globalList.includes(state.activeBookId) || chatBoundList.includes(state.activeBookId) || (charBound === state.activeBookId);
            const recReport = getCachedRecursionReport(entriesObj);
            const loopUidSet = new Set(recReport.loops.flatMap(l => l.uids.map(String)));

            const q = state.entryQuery.trim().toLowerCase();
            const filteredEntries = list.filter(ent => {
                if (state.entryFilter === 'on' && ent.disable) return false;
                if (state.entryFilter === 'off' && !ent.disable) return false;
                if (state.entryFilter === 'const' && !ent.constant) return false;
                if (state.entryFilter === 'keys' && (ent.constant || ent.vectorized)) return false;
                if (state.entryFilter === 'vec' && !ent.vectorized) return false;
                if (state.entryFilter === 'norec' && !ent.preventRecursion) return false;
                if (state.entryFilter === 'mb' && !isMemoryBooksEntry(ent)) return false;
                if (state.entryFilter === 'live' && !scanEntryAgainstRecentChat(ent, state.activeBookId).live) return false;
                if (!q) return true;
                return `${ent.comment || ''} ${(ent.key || []).join(' ')} ${ent.content || ''}`.toLowerCase().includes(q);
            });

            const recursionPanelHtml = !state.showRecursionPanel ? '' : `
                <div class="pcx-surface pcx-panel pcx-stack" style="margin-bottom:14px;">
                    <div class="pcx-actions pcx-between">
                        <div>
                            <h3>${tUi(uiLang, 'Инспектор рекурсии', 'Recursion Inspector')} · ${escapeHtml(state.activeBookId)}</h3>
                            <small>${tUi(uiLang, 'Проверка цепочек ключей между страницами и защита от бесконечного каскада токенов.', 'Inspect keyword chains across pages and isolate cascade loops in one click.')}</small>
                        </div>
                        <div class="pcx-actions">
                            ${recReport.loops.length > 0 ? `<button type="button" class="pcx-btn pcx-btn-xs pcx-btn-primary" id="pcx-fg-break-loops">${tUi(uiLang, 'Разорвать петли', 'Break Loops')}</button>` : ''}
                            ${totalEntries > 0 ? `<button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fg-toggle-all-rec">${recReport.allIsolated ? tUi(uiLang, 'Разрешить цепочки', 'Allow Chains') : tUi(uiLang, 'Стоп-рек. на все', 'Isolate All')}</button>` : ''}
                        </div>
                    </div>
                    ${recReport.loops.length === 0 && recReport.chains.length === 0 && recReport.broadWarnings.length === 0
                        ? `<div class="pcx-guide-note">${tUi(uiLang, 'Чисто! Замкнутых петель и скрытых каскадов между страницами не обнаружено.', 'Clean! No mutual loops or hidden cascade chains detected.')}</div>`
                        : ''}
                    ${recReport.loops.map(lp => `<div class="pcx-chain-step" style="border-color:var(--danger);"><strong>${tUi(uiLang, 'Замкнутая петля:', 'Mutual Loop:')}</strong><small>${escapeHtml(lp.label)}</small></div>`).join('')}
                    ${recReport.broadWarnings.map(w => `<div class="pcx-chain-step" style="border-color:var(--gold-ink);"><strong>${tUi(uiLang, 'Широкий ключ', 'Broad Key')} «${escapeHtml(w.key)}» (${escapeHtml(w.title)})</strong><small>${escapeHtml(w.reason)}</small></div>`).join('')}
                    ${recReport.chains.slice(0, 12).map(ch => `<div class="pcx-chain-step"><strong>«${escapeHtml(ch.title)}»</strong><small>-> ${ch.targets.map(t => `«${escapeHtml(t.title)}» (${escapeHtml(t.key)})`).join(', ')}</small></div>`).join('')}
                </div>`;

            const filterChips = [
                ['all', `${tUi(uiLang, 'Все', 'All')} (${totalEntries})`],
                ['live', tUi(uiLang, 'Сработали в чате', 'Triggered Live')],
                ['const', tUi(uiLang, 'Постоянные', 'Constant')],
                ['keys', tUi(uiLang, 'По ключам', 'Keyword')],
                ['vec', tUi(uiLang, 'Векторные', 'Vector')],
                ['norec', tUi(uiLang, 'Без рекурсии', 'No-Recursion')],
                ['off', tUi(uiLang, 'Выключенные', 'Disabled')],
                ...(mbStatus.installed ? [['mb', 'Memory Books']] : []),
            ];

            return `
                <button type="button" class="pcx-back-link" id="pcx-fg-back-shelf">${ICONS.chevLeft}<span>${tUi(uiLang, 'Назад на Полку книг', 'Back to Forge Shelf')}</span></button>
                <div class="pcx-page-head">
                    <div>
                        <h1>${escapeHtml(state.activeBookId)}</h1>
                        <p>${escapeHtml(buildHumanBindSummary(state.activeBookId, uiLang))}</p>
                    </div>
                    <div class="pcx-actions">
                        <button type="button" class="pcx-btn pcx-btn-soft ${state.showRecursionPanel ? 'pcx-active' : ''}" id="pcx-fg-rec-btn">${ICONS.loop}<span>${tUi(uiLang, 'Инспектор рекурсии', 'Recursion Inspector')}${recReport.loops.length ? ` (${recReport.loops.length})` : ''}</span></button>
                        <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fge-new-ai-btn">+ ${tUi(uiLang, 'С ИИ', 'AI Page')}</button>
                        <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fge-new-btn">+ ${tUi(uiLang, 'Вручную', 'Manual')}</button>
                    </div>
                </div>

                <div class="pcx-sec-route-bar">
                    <div class="pcx-sec-route-info" style="flex-direction:column;align-items:stretch;gap:8px;width:100%;">
                        <strong>${tUi(uiLang, 'Где работает книга:', 'Where this book works:')}</strong>
                        ${renderBindPills(state.activeBookId, { inlineMode: true })}
                    </div>
                </div>

                ${state.saveError ? `<div class="pcx-guide-note" style="background:var(--danger-wash);color:var(--danger);margin-bottom:12px;">${escapeHtml(state.saveError)}</div>` : ''}
                ${state.lastDeletedEntry && state.lastDeletedEntry.bookId === state.activeBookId ? `
                    <div class="pcx-undo-bar">
                        <span>${tUi(uiLang, 'Страница удалена:', 'Page deleted:')} <strong>${escapeHtml(state.lastDeletedEntry.entry.comment || ('#' + state.lastDeletedEntry.uid))}</strong></span>
                        <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-fg-undo-del">${ICONS.undo}<span>${tUi(uiLang, 'Вернуть', 'Undo')}</span></button>
                    </div>` : ''}

                ${recursionPanelHtml}

                ${totalEntries > 0 ? `
                    <div class="pcx-search-bar" style="grid-template-columns:1fr;">
                        <input type="search" id="pcx-fg-entry-search" class="pcx-input" placeholder="${tUi(uiLang, 'Поиск страницы по названию, ключам или тексту...', 'Search pages by title, keys, or lore...')}" value="${escapeHtml(state.entryQuery)}">
                    </div>
                    <div class="pcx-carousel-row">
                        ${filterChips.map(([fid, lbl]) => `<button type="button" class="pcx-chip ${state.entryFilter === fid ? 'pcx-active' : ''}" data-fg-efilter="${fid}">${escapeHtml(lbl)}</button>`).join('')}
                    </div>
                ` : ''}

                <div class="pcx-stack">
                    ${totalEntries === 0
                        ? `<div class="pcx-surface pcx-panel"><small>${tUi(uiLang, 'В этой книге пока нет страниц. Нажмите «+ С ИИ» или «+ Вручную» выше.', 'No pages in this Lorebook yet. Tap "+ AI Page" or "+ Manual" above.')}</small></div>`
                        : (filteredEntries.length === 0
                            ? `<div class="pcx-surface pcx-panel"><small>${tUi(uiLang, 'По выбранному фильтру страниц не найдено.', 'No pages match your current filter.')}</small></div>`
                            : filteredEntries.map(ent => {
                                const isOn = !ent.disable;
                                const isCol = Boolean(colMap[ent.uid]);
                                const safeUid = escapeHtml(String(ent.uid));
                                const keysArr = Array.isArray(ent.key) ? ent.key.map(k => String(k).trim()).filter(Boolean) : [];
                                const scanInfo = scanEntryAgainstRecentChat(ent, state.activeBookId);
                                const hasLoop = loopUidSet.has(String(ent.uid));
                                const posNum = Number(ent.position ?? 0);
                                const roleNames = { 0: 'System', 1: 'User', 2: 'Assistant' };
                                const posShort = posNum === 4
                                    ? `@ Depth ${parseSafeDepth(ent.depth, 4)} · ${roleNames[Number(ent.role) || 0] || 'System'}`
                                    : (posNum === 7 ? `Outlet {{${ent.outletName || 'Lore'}}}` : `WI Pos ${posNum}`);

                                return `
                                    <article class="pcx-entry-row ${scanInfo.live && isOn && isAnyBound ? 'pcx-fired' : ''} ${!isOn ? 'pcx-disabled-card' : ''} ${!isCol ? 'pcx-is-open' : ''}" data-fg-entry-uid="${safeUid}">
                                        <div class="pcx-entry-top">
                                            <div class="pcx-note-title-wrap">
                                                <span class="pcx-drag-grip pcx-fg-entry-grip" title="${tUi(uiLang, 'Потяните, чтобы изменить порядок страницы в промпте', 'Drag to reorder page')}">${ICONS.grip}</span>
                                                <button type="button" class="pcx-note-title-btn" data-fg-collapse="${safeUid}">
                                                    <span class="pcx-note-title-text">${escapeHtml(ent.comment || (tUi(uiLang, 'Страница #', 'Page #') + String(ent.uid)))}</span>
                                                    ${ent.constant ? `<span class="pcx-status-badge pcx-warm">${tUi(uiLang, 'Пост.', 'Const')}</span>` : ''}
                                                    ${ent.vectorized ? `<span class="pcx-status-badge pcx-warm">${tUi(uiLang, 'Вектор', 'Vec')}</span>` : ''}
                                                    ${scanInfo.live && isOn && isAnyBound ? `<span class="pcx-status-badge">${tUi(uiLang, 'В сцене', 'Live')}</span>` : ''}
                                                    ${mbStatus.installed && isMemoryBooksEntry(ent) ? `<span class="pcx-key-badge">MB</span>` : ''}
                                                    ${hasLoop ? `<span class="pcx-status-badge pcx-danger">${tUi(uiLang, 'Петля', 'Loop')}</span>` : ''}
                                                </button>
                                            </div>
                                            <div class="pcx-actions">
                                                <button type="button" class="pcx-chip ${ent.preventRecursion ? 'pcx-active' : ''}" data-fg-norec="${safeUid}" title="${tUi(uiLang, 'Запретить будить другие записи (prevent_recursion)', 'Prevent recursion')}">${tUi(uiLang, 'Стоп-рек.', 'No-Rec')}</button>
                                                <button type="button" class="pcx-sq-switch" role="switch" aria-checked="${isOn}" data-fg-toggle="${safeUid}" title="${tUi(uiLang, 'Вкл / Выкл страницу', 'Toggle page')}"><span></span></button>
                                            </div>
                                        </div>
                                        ${!isCol ? `
                                            <div class="pcx-chip-row">
                                                ${keysArr.map(k => `<span class="pcx-key-badge">${escapeHtml(k)}</span>`).join('')}
                                                <small>· ${escapeHtml(posShort)}</small>
                                            </div>
                                            <div class="pcx-note-text-preview">${escapeHtml(ent.content || '')}</div>
                                            <div class="pcx-actions pcx-between" style="padding-top:8px;border-top:1px solid var(--line);">
                                                <div class="pcx-actions">
                                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-fg-edit="${safeUid}">${tUi(uiLang, 'Править вручную', 'Edit')}</button>
                                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-soft" data-fg-ai-edit="${safeUid}">${tUi(uiLang, 'Доработать с ИИ', 'AI Edit')}</button>
                                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-fg-vec="${safeUid}">${ent.vectorized ? 'RAG: ON' : 'RAG'}</button>
                                                </div>
                                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-danger-ghost" data-fg-del="${safeUid}">${tUi(uiLang, 'Удалить', 'Delete')}</button>
                                            </div>
                                        ` : ''}
                                        <button type="button" class="pcx-entry-tongue" data-fg-collapse="${safeUid}" aria-expanded="${!isCol}" title="${isCol ? tUi(uiLang, 'Развернуть запись', 'Expand entry') : tUi(uiLang, 'Свернуть запись', 'Collapse entry')}">${isCol ? ICONS.chevDown : ICONS.chevUp}</button>
                                    </article>`;
                            }).join(''))}
                </div>`;
        }

        // 7. LOREBOOK SHELF WITH 2 / 2.65 COVERS (1:1 Concept renderForgeShelf!)
        const sortedBooks = [...state.books].sort((a, b) => {
            const aActive = globalList.includes(a.file_id) || chatBoundList.includes(a.file_id) || charBound === a.file_id ? 1 : 0;
            const bActive = globalList.includes(b.file_id) || chatBoundList.includes(b.file_id) || charBound === b.file_id ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            return String(a.name || a.file_id).localeCompare(String(b.name || b.file_id));
        });

        const shelfQ = state.shelfQuery.trim().toLowerCase();
        const visibleBooks = sortedBooks.filter(b => {
            const isGlob = globalList.includes(b.file_id);
            const isChat = chatBoundList.includes(b.file_id);
            const isChar = charBound === b.file_id;
            const isBound = isGlob || isChat || isChar;
            const isMb = Boolean(mbStatus.installed && mbStatus.enabled && mbStatus.targetBook && mbStatus.targetBook === b.file_id);
            if (state.shelfFilter === 'chat' && !isChat) return false;
            if (state.shelfFilter === 'global' && !isGlob) return false;
            if (state.shelfFilter === 'char' && !isChar) return false;
            if (state.shelfFilter === 'bound' && !isBound) return false;
            if (state.shelfFilter === 'unbound' && isBound) return false;
            if (state.shelfFilter === 'mb' && !isMb) return false;
            if (!shelfQ) return true;
            return String(b.name || b.file_id).toLowerCase().includes(shelfQ);
        });

        const shelfFilters = [
            ['all', tUi(uiLang, 'Все книги', 'All Books')],
            ['chat', tUi(uiLang, 'Привязаны в Чат', 'In This Chat')],
            ['global', tUi(uiLang, 'Глобальные', 'Global')],
            ['char', tUi(uiLang, 'К Персонажу', 'Character')],
            ['unbound', tUi(uiLang, 'Свободные на полке', 'Unbound')],
            ...(mbStatus.installed ? [['mb', 'Memory Books']] : []),
        ];

        const mbStripHtml = !mbStatus.installed ? '' : `
            <div class="pcx-status-strip">
                <span class="pcx-live-pill">
                    ${ICONS.memory}
                    <span><strong>Memory Books:</strong> ${!mbStatus.enabled
                        ? tUi(uiLang, 'сейчас выключен в Таверне', 'currently disabled in ST')
                        : (!stApi.isChatOpen()
                            ? tUi(uiLang, 'откройте чат, чтобы назначить том памяти', 'open a chat to assign target tome')
                            : (mbStatus.targetBook
                                ? `${tUi(uiLang, 'пишет память в том', 'target tome')} «${escapeHtml(mbStatus.targetBook)}»`
                                : tUi(uiLang, 'нажмите «Memory Books» на нужной книге ниже', 'tap Memory Books on any tome below')))}</span>
                </span>
            </div>`;

        return `
            ${mbStripHtml}
            <div class="pcx-page-head">
                <div>
                    <h1>${tUi(uiLang, 'Кузница Лорбуков', 'Lorebook Forge')}</h1>
                    
                </div>
                <div class="pcx-actions">
                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-fg-new-manual-btn">+ ${tUi(uiLang, 'Пустой том', 'Blank Tome')}</button>
                    <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-fg-open-hub-btn">${tUi(uiLang, 'Выковать / Добавить...', 'Forge / Create...')}</button>
                </div>
            </div>

            <div class="pcx-search-bar">
                <input type="search" id="pcx-fg-shelf-search" class="pcx-input" placeholder="${tUi(uiLang, 'Поиск книги на полке...', 'Search Lorebooks on shelf...')}" value="${escapeHtml(state.shelfQuery)}">
                <span class="pcx-live-pill">${state.books.length} ${tUi(uiLang, 'кн.', 'books')}</span>
            </div>

            <div class="pcx-carousel-row">
                ${shelfFilters.map(([fid, lbl]) => `<button type="button" class="pcx-chip ${state.shelfFilter === fid ? 'pcx-active' : ''}" data-fg-sfilter="${fid}">${escapeHtml(lbl)}</button>`).join('')}
            </div>

            ${state.loading && state.books.length === 0
                ? `<div class="pcx-surface pcx-panel"><small>${tUi(uiLang, 'Открываем полку Лорбуков Таверны...', 'Loading Lorebooks...')}</small></div>`
                : (sortedBooks.length === 0
                    ? `<div class="pcx-surface pcx-panel"><small>${tUi(uiLang, 'На полке пока нет Лорбуков. Нажмите «Выковать / Добавить...» выше.', 'No Lorebooks yet. Tap "Forge / Create..." above.')}</small></div>`
                    : (visibleBooks.length === 0
                        ? `<div class="pcx-surface pcx-panel"><small>${tUi(uiLang, 'Книг по запросу не найдено.', 'No matching Lorebooks found.')}</small></div>`
                        : `<div class="pcx-shelf-grid">${visibleBooks.map(b => {
                            const isGlob = globalList.includes(b.file_id);
                            const isChat = chatBoundList.includes(b.file_id);
                            const isChar = charBound === b.file_id;
                            const isMbBook = Boolean(mbStatus.installed && mbStatus.enabled && mbStatus.targetBook && mbStatus.targetBook === b.file_id);
                            const anyBound = isGlob || isChat || isChar || isMbBook;
                            const cnt = state.bookCounts[b.file_id];
                            const cntTag = cnt !== undefined ? `${cnt} ${tUi(uiLang, 'стр.', 'p.')}` : tUi(uiLang, 'Том', 'Tome');
                            const statusSub = [
                                isChat ? tUi(uiLang, 'В чате', 'In Chat') : '',
                                isGlob ? tUi(uiLang, 'Глобально', 'Global') : '',
                                isChar ? tUi(uiLang, 'Персонаж', 'Char') : '',
                                isMbBook ? 'Memory Books' : '',
                            ].filter(Boolean).join(' · ') || tUi(uiLang, 'Свободен на полке', 'Unbound on shelf');

                            return `
                                <article class="pcx-book-card ${anyBound ? 'pcx-bound' : ''}">
                                    <div class="pcx-book-cover" data-fg-open="${escapeHtml(b.file_id)}">
                                        ${renderBookCoverGraphic(b.file_id, b.name, b.extensions?.pocket_codex_cover, cnt, uiLang)}
                                        <div class="pcx-cover-top-bar">
                                            <span class="pcx-cover-tag">${escapeHtml(cntTag)}</span>
                                            ${anyBound ? `<span class="pcx-cover-tag pcx-active-hit">${tUi(uiLang, 'Активен', 'Active')}</span>` : ''}
                                        </div>
                                        <button type="button" class="pcx-cover-art-btn" data-fg-cover="${escapeHtml(b.file_id)}">${tUi(uiLang, 'Обложка', 'Cover')}</button>
                                    </div>
                                    <div class="pcx-book-meta" data-fg-open="${escapeHtml(b.file_id)}">
                                        <strong>${escapeHtml(b.name)}</strong>
                                        <small>${escapeHtml(statusSub)}</small>
                                    </div>
                                    ${renderBindPills(b.file_id)}
                                    <div class="pcx-book-foot">
                                        <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary pcx-btn-main-open" data-fg-open="${escapeHtml(b.file_id)}">${tUi(uiLang, 'Открыть', 'Open')}</button>
                                        <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-soft" data-fg-quick-ai="${escapeHtml(b.file_id)}" title="${tUi(uiLang, 'Быстро добавить страницу с ИИ', 'Quick AI Page')}">+ ИИ</button>
                                        <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-danger-ghost" data-fg-delbook="${escapeHtml(b.file_id)}" title="${tUi(uiLang, 'Удалить том', 'Delete Tome')}">×</button>
                                    </div>
                                </article>`;
                        }).join('')}</div><input type="file" id="pcx-fg-shelf-cover-in" accept="image/*" hidden>`))}
        `;
    }

    function captureEntryFields(win) {
        if (!win) return;
        const s = ensureSettings();
        const bookSys = win.querySelector('#pcx-fg-book-sysprompt');
        const pageSys = win.querySelector('#pcx-fgp-sysprompt');
        if (bookSys) s.forgeBookSystemPrompt = bookSys.value;
        if (pageSys) s.forgePageSystemPrompt = pageSys.value;

        if (state.screen !== 'entry_edit' || !state.entryDraft) return;
        const d = state.entryDraft;
        const cEl = win.querySelector('#pcx-fge-comment');
        const kEl = win.querySelector('#pcx-fge-keys');
        const depEl = win.querySelector('#pcx-fge-depth');
        const roleEl = win.querySelector('#pcx-fge-role');
        const outEl = win.querySelector('#pcx-fge-outlet');
        const tEl = win.querySelector('#pcx-fge-content');
        const taskEl = win.querySelector('#pcx-fgp-task');
        const refEl = win.querySelector('#pcx-fgc-refine');
        const candC = win.querySelector('#pcx-fgc-comment');
        const candK = win.querySelector('#pcx-fgc-keys');
        const candT = win.querySelector('#pcx-fgc-content');

        if (cEl) d.comment = cEl.value;
        if (depEl) d.depth = parseSafeDepth(depEl.value, 0);
        if (roleEl) d.role = Number(roleEl.value);
        if (outEl) d.outletName = outEl.value;
        if (kEl && state.entryKeysDirty) {
            state.entryKeysRawText = kEl.value;
            d.key = parseSmartTriggerKeys(kEl.value);
        }
        if (tEl) d.content = tEl.value;
        if (taskEl) state.pageAiTask = taskEl.value;
        if (refEl) state.pageAiRefineText = refEl.value;
        const cand = state.pageAiCandidates[state.pageAiCandIdx];
        if (cand) {
            if (candC) cand.comment = candC.value;
            if (candK) cand.keys = candK.value;
            if (candT) cand.content = candT.value;
        }
    }

    function bindForgeEvents(win) {
        const s = ensureSettings();
        const goShelf = () => { state.screen = 'shelf'; requestRender(); fetchBooksList().then(() => { if (state.screen === 'shelf') requestRender({ preserveBodyScroll: true }); }); };
        win.querySelector('#pcx-fg-back-shelf')?.addEventListener('click', goShelf);
        win.querySelector('#pcx-fg-back-shelf-2')?.addEventListener('click', goShelf);

        win.querySelector('#pcx-fg-open-hub-btn')?.addEventListener('click', () => { state.screen = 'create_hub'; requestRender(); });
        const defaultSafeScope = () => (stApi.isChatOpen() ? 'chat' : 'none');
        win.querySelector('#pcx-fg-new-manual-btn')?.addEventListener('click', () => {
            state.newBookName = ''; state.newBookCover = ''; state.newBookBindScope = defaultSafeScope();
            state.screen = 'new_book'; requestRender();
        });

        win.querySelector('#pcx-hub-whole-ai')?.addEventListener('click', () => {
            state.wizMode = 'ai_adapt'; state.bindAfterScope = defaultSafeScope(); state.screen = 'wizard'; requestRender();
        });
        win.querySelector('#pcx-hub-whole-manual')?.addEventListener('click', () => {
            state.newBookName = ''; state.newBookCover = ''; state.newBookBindScope = defaultSafeScope();
            state.screen = 'new_book'; requestRender();
        });
        win.querySelector('#pcx-hub-page-ai')?.addEventListener('click', () => {
            if (!state.books.length) return;
            const defaultBook = getChatBoundBooks()[0] || stApi.getCharLorebook?.() || stApi.getGlobalLorebooks?.()?.[0] || state.books[0].file_id;
            openEntryEditor({ bookId: defaultBook, uid: null, initialTab: 'ai' });
            requestRender();
        });
        win.querySelector('#pcx-hub-page-manual')?.addEventListener('click', () => {
            if (!state.books.length) return;
            const defaultBook = getChatBoundBooks()[0] || stApi.getCharLorebook?.() || stApi.getGlobalLorebooks?.()?.[0] || state.books[0].file_id;
            openEntryEditor({ bookId: defaultBook, uid: null, initialTab: 'manual' });
            requestRender();
        });

        win.querySelectorAll('[data-fg-scope]').forEach(btn => btn.addEventListener('click', async e => {
            e.stopPropagation();
            const scope = btn.dataset.fgScope, bookId = btn.dataset.fgBook;
            if (!bookId) return;
            if (scope === 'global') {
                await stApi.toggleGlobalLorebook?.(bookId);
            } else if (scope === 'char_drawer') {
                state.bindDrawerMode = state.bindDrawerMode === 'char' ? '' : 'char';
            } else if (scope === 'chat_drawer') {
                const opening = state.bindDrawerMode !== 'chat';
                state.bindDrawerMode = opening ? 'chat' : '';
                if (opening && !state.bindChatCharAvatar) {
                    const c = stApi.ctx || {};
                    const activeAv = (!c.groupId && c.characterId !== undefined && c.characterId !== null && Array.isArray(c.characters))
                        ? (c.characters[c.characterId]?.avatar || '')
                        : '';
                    if (activeAv) {
                        loadSavedChatsForBindPicker(activeAv);
                        return;
                    }
                }
            } else if (scope === 'shelf_char') {
                const loaded = await openBookAtomic(bookId);
                if (loaded) {
                    state.bindDrawerMode = 'char';
                    state.entryQuery = '';
                    state.entryFilter = 'all';
                    state.screen = 'book_entries';
                }
            } else if (scope === 'shelf_chat') {
                if (stApi.isChatOpen()) {
                    await toggleBindBookToChat(bookId);
                } else {
                    const loaded = await openBookAtomic(bookId);
                    if (loaded) {
                        state.bindDrawerMode = 'chat';
                        state.entryQuery = '';
                        state.entryFilter = 'all';
                        state.screen = 'book_entries';
                    }
                }
            } else if (scope === 'chat') {
                await toggleBindBookToChat(bookId);
            } else if (scope === 'char') {
                await stApi.toggleCharLorebook?.(bookId);
            } else if (scope === 'memory') {
                const res = await stApi.assignMemoryBook?.(bookId);
                if (res && !res.ok && res.reason === 'locked') {
                    const uiLang = s.uiLang || 'ru';
                    window.alert(tUi(
                        uiLang,
                        `Для этого персонажа включён замок на Лорбук «${res.targetBook}» в настройках Memory Books. Снимите замок в Memory Books, чтобы менять книгу свободно.`,
                        `This character is locked to Lorebook "${res.targetBook}" inside Memory Books settings.`
                    ));
                } else if (res?.ok && res.active) {
                    try { window.toastr?.success?.(`Книга «${bookId}» назначена приёмником для Memory Books!`); } catch {}
                }
            }
            requestRender({ preserveBodyScroll: true });
        }));

        win.querySelectorAll('[data-fg-close-drawer]').forEach(b => b.addEventListener('click', () => {
            state.bindDrawerMode = '';
            requestRender({ preserveBodyScroll: true });
        }));
        win.querySelector('#pcx-fg-bind-char-q')?.addEventListener('input', e => {
            state.bindCharQuery = e.target.value;
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelectorAll('[data-fg-bind-char]').forEach(b => b.addEventListener('click', async () => {
            const av = b.dataset.fgBindChar, bookId = b.dataset.fgBook;
            if (!av || !bookId) return;
            await stApi.toggleBookForCharacterAvatar?.(bookId, av);
            requestRender({ preserveBodyScroll: true });
        }));
        win.querySelectorAll('[data-fg-bind-curchat]').forEach(b => b.addEventListener('click', async () => {
            const bookId = b.dataset.fgBook;
            if (!bookId) return;
            await toggleBindBookToChat(bookId);
            requestRender({ preserveBodyScroll: true });
        }));
        win.querySelector('#pcx-fg-bind-chat-char')?.addEventListener('change', e => {
            loadSavedChatsForBindPicker(e.target.value);
        });
        win.querySelectorAll('[data-fg-bind-savedchat]').forEach(b => b.addEventListener('click', async () => {
            const chatId = b.dataset.fgBindSavedchat, bookId = b.dataset.fgBook;
            if (!chatId || !bookId || !state.bindChatCharAvatar) return;
            try {
                await stApi.toggleBookInSavedChat?.(bookId, state.bindChatCharAvatar, chatId);
                await loadSavedChatsForBindPicker(state.bindChatCharAvatar);
            } catch (err) {
                window.alert('Не удалось изменить привязку чата: ' + (err?.message || String(err)));
            }
        }));

        win.querySelector('#pcx-fg-newname')?.addEventListener('input', e => { state.newBookName = e.target.value; });
        win.querySelector('#pcx-fg-newscope')?.addEventListener('change', e => { state.newBookBindScope = e.target.value; });
        win.querySelector('#pcx-fg-newcover-btn')?.addEventListener('click', () => win.querySelector('#pcx-fg-newcover-input')?.click());
        win.querySelector('#pcx-fg-newcover-pick')?.addEventListener('click', () => win.querySelector('#pcx-fg-newcover-input')?.click());
        win.querySelector('#pcx-fg-newcover-input')?.addEventListener('change', async e => {
            const f = e.target.files?.[0]; if (!f) return;
            try { state.newBookCover = (await readImageFileLossless(f)).dataUrl; requestRender(); } catch (err) { window.alert(err?.message || String(err)); }
        });
        win.querySelector('#pcx-fg-shelf-search')?.addEventListener('input', e => {
            state.shelfQuery = e.target.value;
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-shelf-search-clear')?.addEventListener('click', () => {
            state.shelfQuery = '';
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelectorAll('[data-fg-sfilter]').forEach(chip => chip.addEventListener('click', () => {
            state.shelfFilter = chip.dataset.fgSfilter || 'all';
            requestRender({ preserveBodyScroll: true });
        }));

        win.querySelector('#pcx-fg-entry-search')?.addEventListener('input', e => {
            state.entryQuery = e.target.value;
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-entry-search-clear')?.addEventListener('click', () => {
            state.entryQuery = '';
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelectorAll('[data-fg-efilter]').forEach(chip => chip.addEventListener('click', () => {
            state.entryFilter = chip.dataset.fgEfilter || 'all';
            requestRender({ preserveBodyScroll: true });
        }));

        win.querySelector('#pcx-fg-undo-del')?.addEventListener('click', async () => {
            if (state.undoBusy) return;
            const last = state.lastDeletedEntry;
            if (!last || !last.bookId || !last.entry) return;
            state.undoBusy = true;
            try {
                await mutateBookAtomically(last.bookId, (fresh) => {
                    const desiredKey = String(last.uid);
                    if (!fresh.entries[desiredKey]) {
                        fresh.entries[desiredKey] = last.entry;
                    } else {
                        const uids = Object.keys(fresh.entries).map(Number).filter(n => !Number.isNaN(n));
                        const safeUid = uids.length > 0 ? (Math.max(...uids) + 1) : 0;
                        fresh.entries[String(safeUid)] = { ...last.entry, uid: safeUid };
                    }
                });
                state.lastDeletedEntry = null;
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
            finally { state.undoBusy = false; }
        });

        win.querySelector('#pcx-fg-create-manual-confirm')?.addEventListener('click', async () => {
            if (state.manualCreateBusy) return;
            const name = (state.newBookName || '').trim(); if (!name) return;
            state.manualCreateBusy = true;
            const uiLang = s.uiLang || 'ru';
            const sanitized = name.replace(/[<>:"/\\|?*]/g, '_');
            const originAnchor = captureContextAnchor();
            const originScope = state.newBookBindScope;
            try {
                // Strict check — halts if /api/worldinfo/list fails (503) so we never overwrite blindly!
                const liveList = await fetchBooksList({ strict: true });
                const matched = liveList.find(b => String(b.file_id).toLowerCase() === sanitized.toLowerCase());
                if (matched) {
                    const exactId = matched.file_id;
                    const openOk = window.confirm(tUi(
                        uiLang,
                        `Лорбук «${exactId}» уже существует на полке! Открыть существующий том без стирания (ОК) или отменить (Отмена)?`,
                        `Lorebook "${exactId}" already exists! Open the existing tome safely without erasing it (OK) or cancel (Cancel)?`,
                    ));
                    if (!openOk) return;
                    let existingData = await loadBookData(exactId, { preferCache: false });
                    const safeNewCover = sanitizeCoverDataUrl(state.newBookCover);
                    if (safeNewCover) {
                        existingData = await mutateBookAtomically(exactId, (fresh) => {
                            fresh.extensions = fresh.extensions || {};
                            fresh.extensions.pocket_codex_cover = safeNewCover;
                        });
                    }
                    if (isSameContextAnchor(originAnchor)) {
                        await applyBindingScope(exactId, originScope, originAnchor);
                    }
                    state.activeBookId = exactId; state.activeBookData = existingData; state.screen = 'book_entries'; requestRender();
                    return;
                }
                const data = { entries: {}, extensions: {} };
                const safeNewCover = sanitizeCoverDataUrl(state.newBookCover);
                if (safeNewCover) data.extensions.pocket_codex_cover = safeNewCover;
                const saved = await enqueueBookWrite(sanitized, async () => {
                    const recheck = await fetchBooksList({ strict: true });
                    if (recheck.some(b => String(b.file_id).toLowerCase() === sanitized.toLowerCase())) {
                        throw new Error(tUi(
                            uiLang,
                            `Конфликт имени: Лорбук «${sanitized}» был только что создан в другом окне — пустая перезапись отменена.`,
                            `Name conflict: Lorebook "${sanitized}" was concurrently created in another client — blank overwrite aborted.`,
                        ));
                    }
                    return saveBookData(sanitized, data, { refreshList: true });
                });
                let postNotice = '';
                if (isSameContextAnchor(originAnchor)) {
                    await applyBindingScope(sanitized, originScope, originAnchor);
                } else if (originScope === 'global') {
                    await applyBindingScope(sanitized, 'global');
                } else if (originScope !== 'none') {
                    postNotice = tUi(
                        uiLang,
                        `Лорбук «${sanitized}» создан, но чат сменился во время записи — привязка к новому чату пропущена.`,
                        `Lorebook "${sanitized}" was created, but the active chat changed during save — binding to the new chat was skipped.`,
                    );
                    try { window.toastr?.warning?.(postNotice); } catch {}
                }
                await fetchBooksList();
                state.activeBookId = sanitized; state.activeBookData = saved; state.saveError = postNotice; state.screen = 'book_entries';
                state.manualCreateBusy = false;
                requestRender();
            } catch (err) {
                const msg = tUi(uiLang, 'Не удалось проверить или создать Лорбук: ', 'Failed to verify or create Lorebook: ') + (err?.message || String(err));
                state.saveError = msg;
                state.manualCreateBusy = false;
                try { window.toastr?.error?.(msg); } catch {}
                window.alert(msg);
                requestRender({ preserveBodyScroll: true });
            } finally {
                state.manualCreateBusy = false;
            }
        });

        win.querySelectorAll('[data-fg-open]').forEach(el => el.addEventListener('click', async () => {
            const targetId = el.dataset.fgOpen;
            if (!targetId) return;
            try {
                const loaded = await openBookAtomic(targetId);
                if (!loaded) return; // Stale click superseded by a newer click!
                state.showRecursionPanel = false;
                state.entryQuery = '';
                state.entryFilter = 'all';
                state.screen = 'book_entries';
                requestRender();
            } catch (err) { window.alert(err?.message || String(err)); }
        }));
        win.querySelectorAll('[data-fg-quick-ai]').forEach(btn => btn.addEventListener('click', async () => {
            const bookId = btn.dataset.fgQuickAi;
            if (!bookId) return;
            try {
                const loaded = await openBookAtomic(bookId);
                if (!loaded) return;
                openEntryEditor({ bookId, uid: null, initialTab: 'ai', bookData: loaded });
                requestRender();
            } catch (err) { window.alert(err?.message || String(err)); }
        }));
        win.querySelectorAll('[data-fg-delbook]').forEach(btn => btn.addEventListener('click', async () => {
            const bookId = btn.dataset.fgDelbook;
            const uiLang = s.uiLang || 'ru';
            if (!bookId || !window.confirm(tUi(uiLang, `Удалить Лорбук «${bookId}» целиком?`, `Delete Lorebook "${bookId}" permanently?`))) return;
            try {
                // Delete file on server FIRST; only unbind if deletion actually succeeded!
                await stApi.deleteWorldInfoBook(bookId);
                if (getChatBoundBooks().includes(bookId)) await toggleBindBookToChat(bookId);
                if ((stApi.getGlobalLorebooks?.() || []).includes(bookId)) await stApi.toggleGlobalLorebook?.(bookId);
                if (stApi.getCharLorebook?.() === bookId) await stApi.toggleCharLorebook?.(bookId);
                delete state.bookCounts[bookId];
                if (state.activeBookId === bookId) { state.activeBookId = ''; state.activeBookData = null; }
                await fetchBooksList();
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        }));

        let coverTargetBookId = '';
        win.querySelectorAll('[data-fg-cover]').forEach(el => el.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            coverTargetBookId = el.dataset.fgCover;
            win.querySelector('#pcx-fg-shelf-cover-in')?.click();
        }));
        win.querySelector('#pcx-fg-shelf-cover-in')?.addEventListener('change', async e => {
            const f = e.target.files?.[0]; if (!f || !coverTargetBookId) return;
            try {
                const att = await readImageFileLossless(f);
                const safeCover = sanitizeCoverDataUrl(att.dataUrl);
                if (!safeCover) throw new Error('Неподдерживаемый формат обложки (разрешены локальные PNG, JPEG, WebP и GIF).');
                await mutateBookAtomically(coverTargetBookId, (fresh) => {
                    fresh.extensions = fresh.extensions || {};
                    fresh.extensions.pocket_codex_cover = safeCover;
                });
                await fetchBooksList();
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        });

        // Inside book: Collapse/Expand pages & Recursion Inspector (No Search)
        win.querySelector('#pcx-fg-collapse-all')?.addEventListener('click', () => {
            if (!state.activeBookData) return;
            const colMap = getBookCollapsedMap(state.activeBookId);
            const entries = Object.values(state.activeBookData.entries || {});
            const nextCol = !entries.every(e => Boolean(colMap[e.uid]));
            for (const e of entries) colMap[e.uid] = nextCol;
            stApi.saveSettings();
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelectorAll('[data-fg-collapse]').forEach(el => el.addEventListener('click', e => {
            e.stopPropagation();
            const uid = el.dataset.fgCollapse;
            const colMap = getBookCollapsedMap(state.activeBookId);
            colMap[uid] = !colMap[uid];
            stApi.saveSettings();
            requestRender({ preserveBodyScroll: true });
        }));
        win.querySelector('#pcx-fg-rec-btn')?.addEventListener('click', () => {
            state.showRecursionPanel = !state.showRecursionPanel;
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-break-loops')?.addEventListener('click', async () => {
            if (!state.activeBookData || !state.activeBookId) return;
            const targetBook = state.activeBookId;
            const rep = getCachedRecursionReport(state.activeBookData.entries);
            if (!rep.loops.length) return;
            const affectedTitles = [...new Set(rep.loops.flatMap(lp => lp.uids.map(u => state.activeBookData.entries[u]?.comment || ('#' + u))))];
            const uiLang = s.uiLang || 'ru';
            if (!window.confirm(tUi(
                uiLang,
                `Отключить каскад рекурсии у страниц в петлях (${affectedTitles.join(', ')})?`,
                `Isolate recursion on loop entries (${affectedTitles.join(', ')})?`,
            ))) return;
            try {
                await mutateBookAtomically(targetBook, (fresh) => {
                    for (const lp of rep.loops) {
                        for (const uid of lp.uids) {
                            if (fresh.entries[uid]) fresh.entries[uid].preventRecursion = true;
                        }
                    }
                });
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        });
        win.querySelector('#pcx-fg-toggle-all-rec')?.addEventListener('click', async () => {
            if (!state.activeBookData || !state.activeBookId) return;
            const targetBook = state.activeBookId;
            try {
                await mutateBookAtomically(targetBook, (fresh) => {
                    const list = Object.values(fresh.entries || {});
                    const allIso = list.length > 0 && list.every(e => Boolean(e.preventRecursion));
                    for (const e of list) e.preventRecursion = !allIso;
                });
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        });

        win.querySelector('#pcx-fge-new-btn')?.addEventListener('click', () => {
            openEntryEditor({ bookId: state.activeBookId, uid: null, initialTab: 'manual' });
            requestRender();
        });
        win.querySelector('#pcx-fge-new-ai-btn')?.addEventListener('click', () => {
            openEntryEditor({ bookId: state.activeBookId, uid: null, initialTab: 'ai' });
            requestRender();
        });

        win.querySelectorAll('[data-fg-toggle]').forEach(sw => sw.addEventListener('click', async () => {
            const uid = sw.dataset.fgToggle, bookId = state.activeBookId;
            if (!bookId || !state.activeBookData?.entries?.[uid]) return;
            try {
                await mutateBookAtomically(bookId, (fresh) => {
                    if (fresh.entries[uid]) fresh.entries[uid].disable = !fresh.entries[uid].disable;
                });
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        }));
        win.querySelectorAll('[data-fg-norec]').forEach(btn => btn.addEventListener('click', async () => {
            const uid = btn.dataset.fgNorec, bookId = state.activeBookId;
            if (!bookId || !state.activeBookData?.entries?.[uid]) return;
            try {
                await mutateBookAtomically(bookId, (fresh) => {
                    if (fresh.entries[uid]) fresh.entries[uid].preventRecursion = !fresh.entries[uid].preventRecursion;
                });
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        }));
        win.querySelectorAll('[data-fg-vec]').forEach(btn => btn.addEventListener('click', async () => {
            const uid = btn.dataset.fgVec, bookId = state.activeBookId;
            if (!bookId || !state.activeBookData?.entries?.[uid]) return;
            try {
                await mutateBookAtomically(bookId, (fresh) => {
                    if (fresh.entries[uid]) {
                        fresh.entries[uid].vectorized = !fresh.entries[uid].vectorized;
                        if (fresh.entries[uid].vectorized) fresh.entries[uid].constant = false;
                    }
                });
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        }));
        win.querySelectorAll('[data-fg-edit]').forEach(btn => btn.addEventListener('click', () => {
            if (!state.activeBookData?.entries?.[btn.dataset.fgEdit]) return;
            openEntryEditor({ bookId: state.activeBookId, uid: btn.dataset.fgEdit, initialTab: 'manual', bookData: state.activeBookData });
            requestRender();
        }));
        win.querySelectorAll('[data-fg-ai-edit]').forEach(btn => btn.addEventListener('click', () => {
            if (!state.activeBookData?.entries?.[btn.dataset.fgAiEdit]) return;
            openEntryEditor({ bookId: state.activeBookId, uid: btn.dataset.fgAiEdit, initialTab: 'ai', bookData: state.activeBookData });
            requestRender();
        }));
        win.querySelectorAll('[data-fg-del]').forEach(btn => btn.addEventListener('click', async () => {
            const uid = btn.dataset.fgDel, bookId = state.activeBookId;
            const ent = state.activeBookData?.entries?.[uid];
            if (!bookId || !ent) return;
            const uiLang = s.uiLang || 'ru';
            const title = ent.comment || ('#' + uid);
            if (!window.confirm(tUi(uiLang, `Удалить страницу «${title}»?`, `Delete page "${title}"?`))) return;
            try {
                const snapshot = JSON.parse(JSON.stringify(ent));
                await mutateBookAtomically(bookId, (fresh) => {
                    delete fresh.entries[uid];
                });
                state.lastDeletedEntry = { bookId, uid, entry: snapshot };
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        }));

        // Entry editor events
        if (state.screen === 'entry_edit' && state.entryDraft) {
            const d = state.entryDraft;
            const cancelEdit = async () => {
                state.entrySessionId = ++entrySessionSeq;
                state.pageAiGenerating = false;
                state.keysGenerating = false;
                if (state.activeBookId) {
                    if (!state.activeBookData) state.activeBookData = await loadBookData(state.activeBookId);
                    state.screen = 'book_entries';
                } else state.screen = 'shelf';
                requestRender();
            };

            win.querySelector('#pcx-fge-cancel')?.addEventListener('click', cancelEdit);
            win.querySelector('#pcx-fge-cancel-2')?.addEventListener('click', cancelEdit);
            win.querySelector('#pcx-fge-book-select')?.addEventListener('change', e => { state.entryTargetBookId = e.target.value; });

            win.querySelectorAll('[data-fgetab]').forEach(tabBtn => tabBtn.addEventListener('click', () => {
                captureEntryFields(win); state.entryEditTab = tabBtn.dataset.fgetab; requestRender();
            }));

            win.querySelector('#pcx-fge-comment')?.addEventListener('input', e => { d.comment = e.target.value; });
            win.querySelector('#pcx-fge-keys')?.addEventListener('input', e => {
                state.entryKeysDirty = true;
                state.entryKeysRawText = e.target.value;
                d.key = parseSmartTriggerKeys(e.target.value);
            });
            win.querySelector('#pcx-fge-genkeys')?.addEventListener('click', () => { captureEntryFields(win); generateKeysForCurrentDraft(); });
            win.querySelector('#pcx-fge-trig')?.addEventListener('change', e => { d.constant = (e.target.value === 'const'); d.vectorized = (e.target.value === 'vec'); });
            win.querySelector('#pcx-fge-pos')?.addEventListener('change', e => { captureEntryFields(win); d.position = Number(e.target.value); requestRender({ preserveBodyScroll: true }); });
            win.querySelector('#pcx-fge-depth')?.addEventListener('input', e => { d.depth = parseSafeDepth(e.target.value, 0); });
            win.querySelector('#pcx-fge-outlet')?.addEventListener('input', e => { d.outletName = e.target.value; });
            win.querySelector('#pcx-fge-role')?.addEventListener('change', e => { d.role = Number(e.target.value); });
            win.querySelector('#pcx-fge-content')?.addEventListener('input', e => { d.content = e.target.value; });
            win.querySelector('#pcx-fge-prevrec')?.addEventListener('change', e => { d.preventRecursion = e.target.checked; });
            win.querySelector('#pcx-fge-exclrec')?.addEventListener('change', e => { d.excludeRecursion = e.target.checked; });
            win.querySelector('#pcx-fge-format-btn')?.addEventListener('click', () => {
                captureEntryFields(win);
                d.content = formatCleanParagraphs(d.content || '');
                requestRender({ preserveBodyScroll: true });
            });
            win.querySelector('#pcx-fge-import-txt')?.addEventListener('click', () => win.querySelector('#pcx-fge-file-in')?.click());
            win.querySelector('#pcx-fge-file-in')?.addEventListener('change', async e => {
                const f = e.target.files?.[0]; if (!f) return;
                captureEntryFields(win);
                const doc = await readTextAttachment(f);
                d.content = formatCleanParagraphs(d.content ? `${d.content}\n\n${doc.text}` : doc.text);
                if (!d.comment) d.comment = doc.name.replace(/\.[^.]+$/, '');
                requestRender();
            });
            win.querySelector('#pcx-fge-save')?.addEventListener('click', async () => {
                captureEntryFields(win);
                if (!String(d.content || '').trim()) return;
                await saveDraftToTargetBook(d);
                requestRender({ preserveBodyScroll: true });
            });

            // Single Page AI Preset, Custom Presets, Word Count & Prompt Editor
            win.querySelector('#pcx-fgp-preset')?.addEventListener('change', e => {
                captureEntryFields(win);
                const allPr = getAllForgeBookPresets();
                const chosen = allPr.find(p => p.id === e.target.value) || allPr[0];
                s.forgePresetId = chosen.id;
                s.forgePageSystemPrompt = chosen.pagePrompt;
                s.forgeBookSystemPrompt = chosen.bookPrompt;
                state.showCustomForgePresetBox = false;
                stApi.saveSettings();
                requestRender({ preserveBodyScroll: true });
            });
            win.querySelector('#pcx-fgp-toggle-prompt')?.addEventListener('click', () => {
                captureEntryFields(win);
                state.showPagePromptEditor = !state.showPagePromptEditor;
                state.showCustomForgePresetBox = false;
                requestRender({ preserveBodyScroll: true });
            });
            win.querySelector('#pcx-fgp-reset-prompt')?.addEventListener('click', () => {
                const pr = getActiveForgeBookPreset();
                s.forgePageSystemPrompt = pr.pagePrompt;
                stApi.saveSettings();
                requestRender({ preserveBodyScroll: true });
            });
            win.querySelector('#pcx-fgp-sysprompt')?.addEventListener('input', e => { s.forgePageSystemPrompt = e.target.value; stApi.saveSettings(); });
            win.querySelector('#pcx-fgp-wmin')?.addEventListener('input', e => { s.forgeWordsMin = Math.max(0, Math.min(4000, Number(e.target.value) || 0)); stApi.saveSettings(); });
            win.querySelector('#pcx-fgp-wmax')?.addEventListener('input', e => { s.forgeWordsMax = Math.max(0, Math.min(4000, Number(e.target.value) || 0)); stApi.saveSettings(); });
            win.querySelector('#pcx-fgp-radius')?.addEventListener('input', e => { s.aiChatRadius = Math.max(0, Math.min(200, Number(e.target.value) || 0)); stApi.saveSettings(); });

            win.querySelector('#pcx-fgp-profile')?.addEventListener('change', e => { s.aiProfileId = e.target.value; stApi.saveSettings(); });
            win.querySelector('#pcx-fgp-lang')?.addEventListener('change', e => { s.aiLang = e.target.value; stApi.saveSettings(); });
            win.querySelector('#pcx-fgp-fmt')?.addEventListener('change', e => { state.pageAiMatchFormat = e.target.checked; });
            win.querySelector('#pcx-fgp-char')?.addEventListener('change', e => { state.pageAiUseChar = e.target.checked; });
            win.querySelector('#pcx-fgp-pers')?.addEventListener('change', e => { state.pageAiUsePersona = e.target.checked; });
            win.querySelector('#pcx-fgp-chat')?.addEventListener('change', e => { state.pageAiUseChat = e.target.checked; });
            win.querySelector('#pcx-fgp-task')?.addEventListener('input', e => { state.pageAiTask = e.target.value; });
            win.querySelector('#pcx-fgp-run-direct')?.addEventListener('click', () => { captureEntryFields(win); runSinglePageAiGeneration({ isRefinement: false, directSave: true }); });
            win.querySelector('#pcx-fgp-run-draft')?.addEventListener('click', () => { captureEntryFields(win); runSinglePageAiGeneration({ isRefinement: false, directSave: false }); });
            win.querySelector('#pcx-fgc-prev')?.addEventListener('click', () => { captureEntryFields(win); if (state.pageAiCandIdx > 0) state.pageAiCandIdx--; requestRender({ preserveBodyScroll: true }); });
            win.querySelector('#pcx-fgc-next')?.addEventListener('click', () => { captureEntryFields(win); if (state.pageAiCandIdx < state.pageAiCandidates.length - 1) state.pageAiCandIdx++; requestRender({ preserveBodyScroll: true }); });
            win.querySelector('#pcx-fgc-run-refine')?.addEventListener('click', () => { captureEntryFields(win); runSinglePageAiGeneration({ isRefinement: true, directSave: false }); });
            win.querySelector('#pcx-fgc-save-now')?.addEventListener('click', async () => {
                captureEntryFields(win);
                const chosen = state.pageAiCandidates[state.pageAiCandIdx];
                if (!chosen) return;
                d.comment = chosen.comment || d.comment;
                d.key = parseSmartTriggerKeys(chosen.keys);
                state.entryKeysRawText = d.key.join(', ');
                state.entryKeysDirty = true;
                d.content = formatCleanParagraphs(chosen.content);
                d.constant = Boolean(chosen.constant);
                await saveDraftToTargetBook(d);
                requestRender({ preserveBodyScroll: true });
            });
        }

        // Wizard & Approve events
        win.querySelector('#pcx-fg-back-wiz')?.addEventListener('click', () => { state.wizOriginSession = null; state.screen = 'wizard'; requestRender(); });
        win.querySelector('#pcx-fg-target-mode')?.addEventListener('change', e => {
            state.targetBookMode = e.target.value;
            if (state.targetBookMode === 'existing' && !state.targetExistingId && state.books[0]) state.targetExistingId = state.books[0].file_id;
            requestRender();
        });
        win.querySelector('#pcx-fg-target-name')?.addEventListener('input', e => { state.targetBookName = e.target.value; });
        win.querySelector('#pcx-fg-target-existing')?.addEventListener('change', e => { state.targetExistingId = e.target.value; });
        win.querySelector('#pcx-fg-bind-scope-after')?.addEventListener('change', e => { state.bindAfterScope = e.target.value; });
        win.querySelector('#pcx-fg-wiz-mode')?.addEventListener('change', e => { state.wizMode = e.target.value; requestRender(); });

        win.querySelector('#pcx-fg-book-preset')?.addEventListener('change', e => {
            captureEntryFields(win);
            const allPr = getAllForgeBookPresets();
            const chosen = allPr.find(p => p.id === e.target.value) || allPr[0];
            s.forgePresetId = chosen.id;
            s.forgeBookSystemPrompt = chosen.bookPrompt;
            s.forgePageSystemPrompt = chosen.pagePrompt;
            state.showCustomForgePresetBox = false;
            stApi.saveSettings();
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-toggle-book-prompt')?.addEventListener('click', () => {
            captureEntryFields(win);
            state.showBookPromptEditor = !state.showBookPromptEditor;
            state.showCustomForgePresetBox = false;
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-open-custom-preset')?.addEventListener('click', () => {
            captureEntryFields(win);
            state.showCustomForgePresetBox = !state.showCustomForgePresetBox;
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-cancel-custom-preset')?.addEventListener('click', () => {
            captureEntryFields(win);
            state.showCustomForgePresetBox = false;
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-custom-name')?.addEventListener('input', e => { state.customForgeNameDraft = e.target.value; });
        win.querySelector('#pcx-fg-custom-ph')?.addEventListener('input', e => { state.customForgePhDraft = e.target.value; });
        win.querySelector('#pcx-fg-save-custom-preset')?.addEventListener('click', () => {
            captureEntryFields(win);
            const nm = (state.customForgeNameDraft || '').trim();
            const isPageMode = state.screen === 'entry_edit';
            const sysText = (isPageMode ? s.forgePageSystemPrompt : s.forgeBookSystemPrompt || '').trim();
            if (!nm) { window.alert('Введите название вашего пресета Кузницы.'); return; }
            if (!sysText) { window.alert('Системный промпт не может быть пустым.'); return; }
            if (!Array.isArray(s.customForgePresets)) s.customForgePresets = [];
            const newId = 'user_fg_' + Date.now();
            s.customForgePresets.push({
                id: newId,
                name: nm,
                nameEn: nm,
                placeholder: (state.customForgePhDraft || '').trim() || 'Опишите вашу задачу для Кузницы...',
                bookPrompt: s.forgeBookSystemPrompt || FORGE_BOOK_PRESETS[0].bookPrompt,
                pagePrompt: s.forgePageSystemPrompt || FORGE_BOOK_PRESETS[0].pagePrompt,
            });
            s.forgePresetId = newId;
            state.showCustomForgePresetBox = false;
            state.customForgeNameDraft = '';
            state.customForgePhDraft = '';
            stApi.saveSettings();
            try { window.toastr?.success?.(`Пресет Кузницы «${nm}» сохранён!`); } catch {}
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-update-custom-preset')?.addEventListener('click', () => {
            captureEntryFields(win);
            if (!Array.isArray(s.customForgePresets)) return;
            const target = s.customForgePresets.find(p => p.id === s.forgePresetId);
            if (!target) return;
            target.bookPrompt = s.forgeBookSystemPrompt;
            target.pagePrompt = s.forgePageSystemPrompt;
            stApi.saveSettings();
            try { window.toastr?.success?.(`Пресет «${target.name}» обновлён!`); } catch {}
        });
        win.querySelector('#pcx-fg-del-custom-preset')?.addEventListener('click', () => {
            if (!Array.isArray(s.customForgePresets)) return;
            const target = s.customForgePresets.find(p => p.id === s.forgePresetId);
            if (!target) return;
            if (!window.confirm(`Удалить ваш пресет Кузницы «${target.name}»?`)) return;
            s.customForgePresets = s.customForgePresets.filter(p => p.id !== target.id);
            s.forgePresetId = FORGE_BOOK_PRESETS[0].id;
            s.forgeBookSystemPrompt = FORGE_BOOK_PRESETS[0].bookPrompt;
            s.forgePageSystemPrompt = FORGE_BOOK_PRESETS[0].pagePrompt;
            stApi.saveSettings();
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-reset-book-prompt')?.addEventListener('click', () => {
            const pr = getActiveForgeBookPreset();
            s.forgeBookSystemPrompt = pr.bookPrompt;
            stApi.saveSettings();
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-book-sysprompt')?.addEventListener('input', e => { s.forgeBookSystemPrompt = e.target.value; stApi.saveSettings(); });
        win.querySelector('#pcx-fg-entry-cnt')?.addEventListener('input', e => { s.forgeEntryCount = Math.max(0, Math.min(30, Number(e.target.value) || 0)); stApi.saveSettings(); });
        win.querySelector('#pcx-fg-wmin')?.addEventListener('input', e => { s.forgeWordsMin = Math.max(0, Math.min(4000, Number(e.target.value) || 0)); stApi.saveSettings(); });
        win.querySelector('#pcx-fg-wmax')?.addEventListener('input', e => { s.forgeWordsMax = Math.max(0, Math.min(4000, Number(e.target.value) || 0)); stApi.saveSettings(); });

        win.querySelector('#pcx-fg-wiz-profile')?.addEventListener('change', e => { s.aiProfileId = e.target.value; stApi.saveSettings(); });
        win.querySelector('#pcx-fg-wiz-lang')?.addEventListener('change', e => { s.aiLang = e.target.value; stApi.saveSettings(); });
        win.querySelectorAll('.pcx-fg-cat-chk').forEach(chk => chk.addEventListener('change', () => { state.wizSelectedCats[chk.dataset.catid] = chk.checked; }));
        win.querySelectorAll('[data-wz-cat]').forEach(btn => btn.addEventListener('click', () => {
            const cid = btn.dataset.wzCat;
            if (!cid) return;
            state.wizSelectedCats[cid] = !state.wizSelectedCats[cid];
            requestRender({ preserveBodyScroll: true });
        }));
        win.querySelector('#pcx-fgc-to-manual')?.addEventListener('click', () => {
            captureEntryFields(win);
            const c = state.pageAiCandidates[state.pageAiCandIdx];
            if (c && state.entryDraft) {
                state.entryDraft.comment = c.comment || state.entryDraft.comment;
                state.entryKeysRawText = c.keys || '';
                state.entryKeysDirty = true;
                state.entryDraft.key = parseSmartTriggerKeys(c.keys || '');
                state.entryDraft.content = formatCleanParagraphs(c.content || '');
                state.entryEditTab = 'manual';
                requestRender({ preserveBodyScroll: true });
            }
        });
        win.querySelector('#pcx-fg-mute-cats')?.addEventListener('change', e => { state.wizMuteExportedCats = e.target.checked; });
        win.querySelector('#pcx-fg-char-source')?.addEventListener('change', e => {
            if (typeof setCharacterSourceSelection === 'function') {
                setCharacterSourceSelection(e.target.value);
                const cp = typeof getCharacterSourcePickerState === 'function' ? getCharacterSourcePickerState(uiLang) : null;
                if (cp?.canBindTargetChar && state.bindAfterScope === 'none') {
                    state.bindAfterScope = 'target_char';
                }
                requestRender({ preserveBodyScroll: true });
            }
        });
        win.querySelector('#pcx-fg-src-char')?.addEventListener('change', e => { state.wizUseChar = e.target.checked; });
        win.querySelector('#pcx-fg-src-scen')?.addEventListener('change', e => { state.wizUseScenario = e.target.checked; });
        win.querySelector('#pcx-fg-src-pers')?.addEventListener('change', e => { state.wizUsePersona = e.target.checked; });
        win.querySelector('#pcx-fg-src-chat')?.addEventListener('change', e => { state.wizUseChat = e.target.checked; });
        win.querySelector('#pcx-fg-wiz-task')?.addEventListener('input', e => { state.wizCustomPrompt = e.target.value; });
        win.querySelector('#pcx-fg-wiz-doc-btn')?.addEventListener('click', () => win.querySelector('#pcx-fg-wiz-doc-in')?.click());
        win.querySelector('#pcx-fg-wiz-doc-in')?.addEventListener('change', async e => {
            for (const f of [...(e.target.files || [])]) {
                try { const doc = await readTextAttachment(f); state.wizUploadedDocs.push({ name: doc.name, text: doc.text }); } catch (err) { window.alert(err?.message); }
            }
            requestRender();
        });
        win.querySelector('#pcx-fg-run-wiz-direct')?.addEventListener('click', () => { captureEntryFields(win); executeAutoForge({ directCommit: true }); });
        win.querySelector('#pcx-fg-run-wiz-draft')?.addEventListener('click', () => { captureEntryFields(win); executeAutoForge({ directCommit: false }); });

        if (state.screen === 'approve') {
            win.querySelector('#pcx-st-collapse-all')?.addEventListener('click', () => {
                const nextCol = !state.stagedEntries.every((_, i) => state.stagedCollapsed[i]);
                state.stagedEntries.forEach((_, i) => { state.stagedCollapsed[i] = nextCol; });
                requestRender({ preserveBodyScroll: true });
            });
            win.querySelectorAll('[data-st-col]').forEach(el => el.addEventListener('click', e => {
                e.stopPropagation();
                const idx = Number(el.dataset.stCol);
                state.stagedCollapsed[idx] = !state.stagedCollapsed[idx];
                requestRender({ preserveBodyScroll: true });
            }));
            win.querySelectorAll('.pcx-st-inc').forEach(el => el.addEventListener('change', () => { state.stagedEntries[Number(el.dataset.idx)].included = el.checked; }));
            win.querySelectorAll('.pcx-st-comment').forEach(el => el.addEventListener('input', () => { state.stagedEntries[Number(el.dataset.idx)].comment = el.value; }));
            win.querySelectorAll('.pcx-st-keys').forEach(el => el.addEventListener('input', () => { state.stagedEntries[Number(el.dataset.idx)].keys = el.value; }));
            win.querySelectorAll('.pcx-st-trig').forEach(el => el.addEventListener('change', () => {
                const it = state.stagedEntries[Number(el.dataset.idx)]; it.constant = (el.value === 'const'); it.vectorized = (el.value === 'vec');
            }));
            win.querySelectorAll('.pcx-st-pos').forEach(el => el.addEventListener('change', () => {
                state.stagedEntries[Number(el.dataset.idx)].position = Number(el.value); requestRender({ preserveBodyScroll: true });
            }));
            win.querySelectorAll('.pcx-st-depth').forEach(el => el.addEventListener('input', () => { state.stagedEntries[Number(el.dataset.idx)].depth = parseSafeDepth(el.value, 0); }));
            win.querySelectorAll('.pcx-st-outlet').forEach(el => el.addEventListener('input', () => { state.stagedEntries[Number(el.dataset.idx)].outletName = el.value; }));
            win.querySelectorAll('.pcx-st-role').forEach(el => el.addEventListener('change', () => { state.stagedEntries[Number(el.dataset.idx)].role = Number(el.value); }));
            win.querySelectorAll('.pcx-st-content').forEach(el => el.addEventListener('input', () => { state.stagedEntries[Number(el.dataset.idx)].content = el.value; }));
            win.querySelector('#pcx-fg-commit-btn')?.addEventListener('click', () => commitApprovedLorebook());
        }
        // Live Drag-and-Drop reordering for Lorebook pages (updates displayIndex & prompt insertion order!)
        if (state.screen === 'book_entries' && state.activeBookId && state.activeBookData) {
            const bodyEl = win.querySelector('.pcx-main');
            const targetBookId = state.activeBookId;
            if (bodyEl) {
                const startEntryDrag = (card, startY, isTouch) => {
                    const rect = card.getBoundingClientRect();
                    const offsetY = startY - rect.top;
                    const placeholder = document.createElement('div');
                    placeholder.className = 'pcx-drag-placeholder';
                    placeholder.style.height = `${rect.height}px`;
                    card.parentNode.insertBefore(placeholder, card);
                    card.classList.add('pcx-card-floating');
                    card.style.width = `${rect.width}px`;
                    card.style.left = `${rect.left}px`;
                    card.style.top = `${rect.top}px`;
                    document.body.classList.add('pcx-dragging-active');
                    if (isTouch) navigator.vibrate?.(15);

                    let curY = startY, rafId = null;
                    const updatePos = () => {
                        rafId = null;
                        card.style.top = `${curY - offsetY}px`;
                        const bodyRect = bodyEl.getBoundingClientRect();
                        if (curY < bodyRect.top + 48) bodyEl.scrollTop -= 9;
                        else if (curY > bodyRect.bottom - 48) bodyEl.scrollTop += 9;
                        const siblings = [...bodyEl.querySelectorAll('[data-fg-entry-uid]:not(.pcx-card-floating)')];
                        let beforeEl = null;
                        for (const sib of siblings) {
                            const r = sib.getBoundingClientRect();
                            if (curY < r.top + r.height / 2) { beforeEl = sib; break; }
                        }
                        if (beforeEl) bodyEl.insertBefore(placeholder, beforeEl);
                        else bodyEl.appendChild(placeholder);
                    };
                    const onMove = ev => {
                        if (isTouch) {
                            if (!ev.touches[0]) return;
                            if (ev.cancelable) ev.preventDefault();
                            curY = ev.touches[0].clientY;
                        } else curY = ev.clientY;
                        if (!rafId) rafId = requestAnimationFrame(updatePos);
                    };
                    const onEnd = async () => {
                        if (rafId) cancelAnimationFrame(rafId);
                        document.body.classList.remove('pcx-dragging-active');
                        if (isTouch) {
                            window.removeEventListener('touchmove', onMove);
                            window.removeEventListener('touchend', onEnd);
                            window.removeEventListener('touchcancel', onEnd);
                        } else {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onEnd);
                        }
                        card.classList.remove('pcx-card-floating');
                        card.style.width = ''; card.style.left = ''; card.style.top = ''; card.style.transform = '';
                        placeholder.parentNode?.insertBefore(card, placeholder);
                        placeholder.remove();
                        if (!bodyEl.isConnected) return;
                        const orderedUids = [...bodyEl.querySelectorAll('[data-fg-entry-uid]')].map(el => el.dataset.fgEntryUid).filter(Boolean);
                        if (orderedUids.length < 2) return;
                        try {
                            await mutateBookAtomically(targetBookId, (fresh) => {
                                const allSorted = Object.values(fresh.entries || {}).sort((a, b) => {
                                    const da = Number.isFinite(Number(a?.displayIndex)) ? Number(a.displayIndex) : 999999;
                                    const db = Number.isFinite(Number(b?.displayIndex)) ? Number(b.displayIndex) : 999999;
                                    return da !== db ? da - db : Number(a?.uid) - Number(b?.uid);
                                });
                                const draggedSet = new Set(orderedUids);
                                let qIdx = 0;
                                const finalOrder = allSorted.map(ent => {
                                    const uStr = String(ent.uid);
                                    if (!draggedSet.has(uStr)) return ent;
                                    const nextUid = orderedUids[qIdx++];
                                    return fresh.entries[nextUid] || ent;
                                });
                                finalOrder.forEach((ent, idx) => {
                                    if (!ent) return;
                                    ent.displayIndex = idx;
                                    ent.order = Math.max(1, 500 - idx);
                                });
                            });
                            requestRender({ preserveBodyScroll: true });
                        } catch (err) {
                            console.warn('[PocketCodex] Page reorder failed:', err);
                        }
                    };
                    if (isTouch) {
                        window.addEventListener('touchmove', onMove, { passive: false });
                        window.addEventListener('touchend', onEnd);
                        window.addEventListener('touchcancel', onEnd);
                    } else {
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onEnd);
                    }
                };

                bodyEl.querySelectorAll('.pcx-fg-entry-grip').forEach(grip => {
                    grip.addEventListener('contextmenu', e => e.preventDefault());
                    grip.addEventListener('touchstart', e => {
                        if (e.touches.length !== 1) return;
                        e.preventDefault(); e.stopPropagation();
                        const card = grip.closest('[data-fg-entry-uid]');
                        if (card) startEntryDrag(card, e.touches[0].clientY, true);
                    }, { passive: false });
                    grip.addEventListener('mousedown', e => {
                        if (e.button !== 0) return;
                        e.preventDefault(); e.stopPropagation();
                        const card = grip.closest('[data-fg-entry-uid]');
                        if (card) startEntryDrag(card, e.clientY, false);
                    });
                });
            }
        }
    }

    return {
        onEnterForge() { state.screen = 'shelf'; fetchBooksList().then(() => { if (state.screen === 'shelf') requestRender({ preserveBodyScroll: true }); }); },
        onEnterForgeWithCard(card = {}) {
            state.wizMode = 'ai_adapt';
            state.wizUseChar = true;
            state.wizUseScenario = true;
            state.wizStatus = '';
            const safeCover = sanitizeCoverDataUrl(card.coverDataUrl || '');
            if (safeCover) state.targetCover = safeCover;
            const preferredWorld = String(card.world || '').trim();
            const suggestedName = preferredWorld || (card.name ? `${card.name} — Лорбук` : '');
            if (suggestedName) state.targetBookName = suggestedName;
            const cp = typeof getCharacterSourcePickerState === 'function' ? getCharacterSourcePickerState('ru') : null;
            state.bindAfterScope = cp?.canBindTargetChar ? 'target_char' : (stApi.isChatOpen() ? 'chat' : 'none');
            state.screen = 'wizard';
            fetchBooksList().then(() => {
                if (preferredWorld && state.books.some(b => b.file_id === preferredWorld)) {
                    state.targetBookMode = 'existing';
                    state.targetExistingId = preferredWorld;
                } else {
                    state.targetBookMode = 'new';
                }
                if (state.screen === 'wizard') requestRender({ preserveBodyScroll: true });
            });
        },
        ensureBooksLoadedQuietly() { if (!state.books.length && !state.loading) fetchBooksList().catch(() => {}); },
        getShelfSnapshot() {
            return state.books.map(b => ({
                id: b.file_id,
                name: b.name || b.file_id,
                cover: sanitizeCoverDataUrl(b.extensions?.pocket_codex_cover),
                count: state.bookCounts[b.file_id],
            }));
        },
        async openBookFromHome(bookId, { openRecursion = false } = {}) {
            if (!bookId) {
                state.screen = 'shelf';
                await fetchBooksList();
                requestRender();
                return;
            }
            const loaded = await openBookAtomic(bookId);
            if (!loaded) return;
            state.showRecursionPanel = Boolean(openRecursion);
            state.entryQuery = '';
            state.entryFilter = 'all';
            state.screen = 'book_entries';
            requestRender();
        },
        onEnterForgeHub() { state.screen = 'create_hub'; fetchBooksList().then(() => { if (state.screen === 'create_hub') requestRender({ preserveBodyScroll: true }); }); },
        onExternalWorldInfoUpdated(bookName, bookData) {
            if (!bookName || stApi.isOwnWorldInfoSave?.(bookData)) return false;
            let changed = false;
            if (bookData && typeof bookData === 'object') {
                const normalized = normalizeLoadedEntries(JSON.parse(JSON.stringify(bookData)));
                state.bookCounts[bookName] = Object.keys(normalized.entries || {}).length;
                const shelfBook = state.books.find(b => b.file_id === bookName);
                if (shelfBook) {
                    const safeCover = sanitizeCoverDataUrl(normalized.extensions?.pocket_codex_cover);
                    shelfBook.extensions = shelfBook.extensions || {};
                    if (safeCover) shelfBook.extensions.pocket_codex_cover = safeCover;
                    else delete shelfBook.extensions.pocket_codex_cover;
                }
                if (state.activeBookId === bookName && !this.isEditingForm) {
                    state.activeBookData = normalized;
                }
                changed = true;
            }
            if (!state.books.some(b => b.file_id === bookName)) {
                fetchBooksList().then(() => requestRender({ preserveBodyScroll: true })).catch(() => {});
                changed = true;
            }
            return changed;
        },
        renderForgeBody,
        bindForgeEvents,
        captureForgeFields: captureEntryFields,
        resetTransientState() {
            forgeAiSeq++;
            chatEpoch++;
            state.entrySessionId = ++entrySessionSeq;
            state.saveError = '';
            state.pageAiGenerating = false;
            state.keysGenerating = false;
            state.wizForging = false;
        },
        get isEditingForm() {
            return state.screen === 'entry_edit' || state.screen === 'approve' || state.screen === 'new_book' || state.screen === 'wizard';
        },
        get isBusy() { return state.wizForging || state.pageAiGenerating || state.keysGenerating || state.entrySavingBusy || state.commitSavingBusy || state.manualCreateBusy; },
    };
}
