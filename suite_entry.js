import { THEMES, LANGUAGES, HELP_TIPS, HELP_TIPS_EN, ICONS, THEME_CRESTS, SUITE_CSS, renderProceduralCoverSvg } from './modules/themes_and_icons.js';
import { CODEX_PROMPT_PRESETS, FORGE_BOOK_PRESETS, formatCleanParagraphs, isSchemaUnsupportedError, unwrapAndParseModelJson, UI_DICT, tUi, displayCategoryName } from './modules/presets_and_i18n.js';
import { createForgeController, sanitizeCoverDataUrl } from './modules/forge_module.js';
import { executePcxAiRequest, lastPcxAiDiagnostics, toBlobDisplayUrl, readImageFileLossless } from './modules/ai_engine.js';

const MODULE_NAME = 'st_pocket_codex';
const PROMPT_KEY_PREFIX = 'st_pcx_slot_';

const ST_POS = { LOCAL_ONLY: -2, MACRO_ONLY: -1, AFTER_MAIN: 0, IN_CHAT: 1, BEFORE_MAIN: 2 };
const ST_ROLE = { SYSTEM: 0, USER: 1, ASSISTANT: 2 };

const LEGACY_GM_PROMPT_SNIPPET = 'Готовый чистый текст заметки';
const DEFAULT_GM_SYSTEM_PROMPT = CODEX_PROMPT_PRESETS[0].prompt;

function makeDefaultCategory(id, name, pos = 1, depth = 2, role = 0, showHeader = true) {
    return {
        id,
        name,
        enabled: true,
        injectPos: Number(pos),
        injectDepth: Math.max(0, Number(depth) || 0),
        injectRole: Number(role) || 0,
        injectInterval: 1,
        showHeader: Boolean(showHeader),
        headerMode: showHeader ? 'sec_and_custom_notes' : 'only_notes',
        subHeaderStyle: 'h4_blank',
    };
}

const DEFAULT_CATEGORIES = [
    makeDefaultCategory('classic_an', 'Классическая заметка Автора', 1, 2, 0, false),
    makeDefaultCategory('relations', 'Отношения и Биография', 1, 4, 0, true),
    makeDefaultCategory('plot', 'Сюжетный план', 1, 2, 0, true),
    makeDefaultCategory('personal', 'Личные памятки', -2, 0, 0, false),
];

const DEFAULT_SETTINGS = {
    uiLang: 'ru',
    theme: 'celestial',
    scope: 'chat',
    activeTab: 'classic_an',
    showTooltips: true,
    includeGlobalWithChat: true,
    aiTransportMode: 'preset', // 'preset' (through ST active preset preserving assistant & '\n') | 'direct' (JSON schema)
    presetCorrectionPrompt: '',
    aiProfileId: '',
    aiLang: 'Русский',
    aiChatRadius: 10,
    aiWordsMin: 40,
    aiWordsMax: 180,
    aiSendCharDesc: true,
    aiSendUserDesc: true,
    aiMaxTokens: 3400,
    gmPresetId: 'universal',
    gmSystemPrompt: DEFAULT_GM_SYSTEM_PROMPT,
    forgePresetId: 'world_universal',
    forgeBookSystemPrompt: FORGE_BOOK_PRESETS[0].bookPrompt,
    forgePageSystemPrompt: FORGE_BOOK_PRESETS[0].pagePrompt,
    forgeWordsMin: 60,
    forgeWordsMax: 220,
    forgeEntryCount: 5,
    collapsedForgeEntries: {},
    customCodexPresets: [],
    customForgePresets: [],
    globalNotebookCover: '',
    globalData: { categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)), notes: [] },
};

const NOTE_OUTPUT_JSON_SCHEMA = {
    name: 'author_note_response',
    strict: true,
    value: {
        type: 'object',
        properties: { title: { type: 'string' }, content: { type: 'string' } },
        required: ['title', 'content'],
        additionalProperties: false,
    },
};

let stApi = null, scriptModRef = null, sharedModRef = null, powerUserModRef = null, worldInfoModRef = null, forgeCtrl = null;
let isExpandingMacro = false;
let codexAiSeq = 0;
let renderGeneration = 0;
let lastCompiledPromptSignature = '';
let debouncedSaveTimer = null;
const activeRegisteredPromptKeys = new Set();
const lastActivatedWiKeys = new Set();
const ownSavedWiPayloads = new WeakSet();

const uiState = {
    wing: 'home',            // 'home' | 'codex' | 'forge'
    codexSub: 'shelf',       // 'shelf' | 'list' | 'edit'
    editTab: 'manual',       // 'manual' | 'ai'
    editingNoteId: null,
    draftAttachments: null,
    showGmPromptEditor: false,
    showCustomPresetCreator: false,
    customPresetNameDraft: '',
    customPresetPhDraft: '',
    openTipId: null,
    aiGenerating: false,
    aiPromptDraft: '',
    aiRefinementText: '',
    aiCandidates: [],
    aiCandidateIdx: 0,
    aiStatus: '',
    noteQuery: '',
    noteFilter: 'all',       // 'all' | 'on' | 'off' | 'prio' | 'files'
    lastDeletedNote: null,
    subModal: null,          // null | 'settings' | 'guide' | 'layers' | 'section' | 'diagnostics'
    secModalMode: 'edit',    // 'create' | 'edit'
    secModalCatId: '',
    secDraft: null,
    notebookCoverTarget: '', // 'chat' | 'global'
};

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHelpBtn(tipId) {
    return `<button type="button" class="pcx-q-btn ${uiState.openTipId === tipId ? 'pcx-q-open' : ''}" data-tip="${tipId}" title="Подсказка">?</button>`;
}

function renderHelpBubble(tipId) {
    if (uiState.openTipId !== tipId) return '';
    const lang = stApi ? (ensureSettings().uiLang || 'ru') : 'ru';
    const dict = lang === 'en' ? HELP_TIPS_EN : HELP_TIPS;
    const text = dict[tipId] || HELP_TIPS[tipId];
    if (!text) return '';
    return `<div class="pcx-q-bubble">${escapeHtml(text)}</div>`;
}

async function importCoreModule(candidates) {
    let lastError = null;
    for (const specifier of candidates) {
        try { return await import(specifier); }
        catch (error) { lastError = error; }
    }
    console.warn('[PocketCodex] Core module import failed:', candidates.join(', '), lastError);
    return {};
}

async function initStApi() {
    const ctx = window.SillyTavern?.getContext?.() || {};
    const scriptMod = await importCoreModule(['../../../../script.js', '../../../script.js']);
    const extMod = await importCoreModule(['../../../extensions.js', '../../extensions.js']);
    sharedModRef = await importCoreModule(['../../shared.js', '../../../extensions/shared.js']);
    powerUserModRef = await importCoreModule(['../../../power-user.js', '../../power-user.js']);
    worldInfoModRef = await importCoreModule(['../../../world-info.js', '../../world-info.js']);
    scriptModRef = scriptMod;

    const coreTypes = scriptMod.extension_prompt_types || ctx.extension_prompt_types;
    if (coreTypes) {
        if (coreTypes.NONE !== undefined) ST_POS.MACRO_ONLY = coreTypes.NONE;
        if (coreTypes.IN_PROMPT !== undefined) ST_POS.AFTER_MAIN = coreTypes.IN_PROMPT;
        if (coreTypes.IN_CHAT !== undefined) ST_POS.IN_CHAT = coreTypes.IN_CHAT;
        if (coreTypes.BEFORE_PROMPT !== undefined) ST_POS.BEFORE_MAIN = coreTypes.BEFORE_PROMPT;
    }

    stApi = {
        get ctx() { return window.SillyTavern?.getContext?.() || ctx; },
        get extensionSettings() { return this.ctx.extensionSettings || extMod.extension_settings || window.extension_settings || {}; },
        get chatMetadata() { return this.ctx.chatMetadata || scriptMod.chat_metadata || window.chat_metadata; },
        get eventSource() { return this.ctx.eventSource || scriptMod.eventSource; },
        get eventTypes() { return this.ctx.eventTypes || this.ctx.event_types || scriptMod.event_types || {}; },
        get connectionService() { return this.ctx.ConnectionManagerRequestService || sharedModRef?.ConnectionManagerRequestService || null; },
        getRequestHeaders() {
            const fn = this.ctx.getRequestHeaders || scriptMod.getRequestHeaders;
            return typeof fn === 'function' ? fn() : { 'Content-Type': 'application/json' };
        },
        isChatOpen() {
            const c = this.ctx;
            return Boolean((c.characterId !== undefined && c.characterId !== null && c.characterId !== '') || c.groupId);
        },
        saveSettings() {
            const fn = this.ctx.saveSettingsDebounced || scriptMod.saveSettingsDebounced;
            if (typeof fn === 'function') fn();
        },
        saveMetadata() {
            if (!this.isChatOpen()) return Promise.resolve(false);
            const debouncedFn = this.ctx.saveMetadataDebounced || extMod.saveMetadataDebounced;
            if (typeof debouncedFn === 'function') {
                return Promise.resolve().then(() => debouncedFn()).then(() => true).catch(() => false);
            }
            const immediateFn = this.ctx.saveMetadata || extMod.saveMetadata;
            if (typeof immediateFn === 'function') {
                return Promise.resolve().then(() => immediateFn()).then(() => true).catch(() => false);
            }
            return Promise.resolve(false);
        },
        setPrompt(key, value, pos, depth, scan, role) {
            const fn = this.ctx.setExtensionPrompt || scriptMod.setExtensionPrompt;
            if (typeof fn === 'function') fn(key, value, pos, depth, scan, role);
        },
        registerMacro(name, fn) {
            if (typeof this.ctx.registerMacro === 'function') {
                try { this.ctx.registerMacro(name, fn); } catch {}
            }
        },
        get worldInfoMod() { return worldInfoModRef; },
        getGlobalLorebooks() {
            const arr = worldInfoModRef?.selected_world_info || worldInfoModRef?.world_info?.globalSelect;
            if (Array.isArray(arr)) return [...arr];
            const domVals = window.jQuery ? window.jQuery('#world_info').val() : null;
            return Array.isArray(domVals) ? domVals.map(opt => {
                const text = window.jQuery(`#world_info option[value="${opt}"]`).text();
                return text || String(opt);
            }).filter(Boolean) : [];
        },
        async toggleGlobalLorebook(bookId) {
            if (!bookId) return false;
            const current = this.getGlobalLorebooks();
            const isActive = current.includes(bookId);
            const slashFn = this.ctx.executeSlashCommandsWithOptions || scriptMod.executeSlashCommandsWithOptions;
            if (typeof slashFn === 'function') {
                try {
                    const quotedName = JSON.stringify(String(bookId));
                    const cmd = isActive ? `/world state=off silent=true ${quotedName}` : `/world silent=true ${quotedName}`;
                    await slashFn(cmd, { handleParserErrors: false, handleExecutionErrors: false });
                    return !isActive;
                } catch {}
            }
            const wiArr = worldInfoModRef?.selected_world_info;
            if (Array.isArray(wiArr)) {
                const idx = wiArr.indexOf(bookId);
                if (idx !== -1) wiArr.splice(idx, 1);
                else wiArr.push(bookId);
                if (worldInfoModRef?.world_info && typeof worldInfoModRef.world_info === 'object') {
                    worldInfoModRef.world_info.globalSelect = wiArr;
                }
                if (window.jQuery && Array.isArray(worldInfoModRef?.world_names)) {
                    const indices = wiArr.map(n => String(worldInfoModRef.world_names.indexOf(n))).filter(v => v !== '-1');
                    window.jQuery('#world_info').val(indices).trigger('change');
                }
                this.saveSettings();
                return idx === -1;
            }
            return isActive;
        },
        getCharLorebook() {
            const c = this.ctx;
            if (c.characterId === undefined || c.characterId === null || c.characterId === '') return '';
            const ch = Array.isArray(c.characters) ? c.characters[c.characterId] : null;
            return ch?.data?.extensions?.world || '';
        },
        getChatLorebooks() {
            if (!this.isChatOpen() || !this.chatMetadata) return [];
            const primary = this.chatMetadata.world_info ? String(this.chatMetadata.world_info).trim() : '';
            const extras = Array.isArray(this.chatMetadata.pcx_extra_world_info)
                ? this.chatMetadata.pcx_extra_world_info.map(x => String(x || '').trim()).filter(Boolean)
                : [];
            const combined = [];
            if (primary) combined.push(primary);
            for (const b of extras) {
                if (!combined.includes(b)) combined.push(b);
            }
            return combined;
        },
        async toggleChatLorebook(bookId) {
            if (!bookId || !this.isChatOpen() || !this.chatMetadata) return false;
            const list = this.getChatLorebooks();
            const idx = list.indexOf(bookId);
            if (idx !== -1) list.splice(idx, 1);
            else list.push(bookId);
            if (list.length === 0) {
                delete this.chatMetadata.world_info;
                delete this.chatMetadata.pcx_extra_world_info;
            } else {
                this.chatMetadata.world_info = list[0];
                if (list.length > 1) this.chatMetadata.pcx_extra_world_info = list.slice(1);
                else delete this.chatMetadata.pcx_extra_world_info;
            }
            if (window.jQuery) {
                window.jQuery('.chat_lorebook_button').toggleClass('world_set', list.length > 0);
            }
            await this.saveMetadata();
            await this.refreshWorldInfoUI();
            if (typeof worldInfoModRef?.getSortedEntries === 'function') {
                try { await worldInfoModRef.getSortedEntries(); } catch {}
            }
            return idx === -1;
        },
        getMemoryBooksStatus() {
            const extAll = this.extensionSettings || {};
            const disabled = Array.isArray(extAll.disabledExtensions) ? extAll.disabledExtensions : [];
            const isOff = disabled.some(d => /memory[-_]?books/i.test(String(d || '')));
            const mbCfg = extAll.STMemoryBooks;
            const hasDomOrCfg = Boolean(
                mbCfg
                || (typeof document !== 'undefined' && document.querySelector('[id*="stmb"], [class*="stmb"], [data-i18n*="STMemoryBooks"]'))
            );
            const installed = hasDomOrCfg;
            if (!installed) {
                return { installed: false, enabled: false, targetBook: '', mode: 'absent' };
            }
            const enabled = !isOff && (mbCfg?.moduleSettings?.enabled !== false);
            if (!this.isChatOpen()) {
                return { installed: true, enabled, targetBook: '', mode: 'no_chat' };
            }

            const c = this.ctx || {};
            const isGroup = Boolean(c.groupId);
            const ch = (!isGroup && c.characterId !== undefined && c.characterId !== null && Array.isArray(c.characters))
                ? c.characters[c.characterId]
                : null;
            const charKey = ch?.avatar ? String(ch.avatar).trim() : '';
            const manualOn = Boolean(mbCfg?.moduleSettings?.manualModeEnabled);
            const locks = mbCfg?.characterMemoryBookLocks;

            if (manualOn && !isGroup && charKey && locks && typeof locks === 'object' && locks[charKey]?.lorebookName) {
                return { installed: true, enabled, targetBook: String(locks[charKey].lorebookName).trim(), mode: 'lock' };
            }
            if (manualOn) {
                const manualBook = String(this.chatMetadata?.STMemoryBooks?.manualLorebook || '').trim();
                return { installed: true, enabled, targetBook: manualBook, mode: 'manual' };
            }
            const chatPrimary = String(this.chatMetadata?.world_info || '').trim();
            return { installed: true, enabled, targetBook: chatPrimary, mode: 'chat' };
        },
        async assignMemoryBook(bookId) {
            const status = this.getMemoryBooksStatus();
            if (!status.installed) return { ok: false, reason: 'not_installed' };
            if (!bookId || !this.isChatOpen() || !this.chatMetadata) {
                return { ok: false, reason: 'no_chat' };
            }
            if (status.mode === 'lock') {
                return { ok: false, reason: 'locked', targetBook: status.targetBook };
            }
            if (status.mode === 'manual') {
                if (!this.chatMetadata.STMemoryBooks || typeof this.chatMetadata.STMemoryBooks !== 'object') {
                    this.chatMetadata.STMemoryBooks = {};
                }
                const cur = String(this.chatMetadata.STMemoryBooks.manualLorebook || '').trim();
                if (cur === bookId) {
                    delete this.chatMetadata.STMemoryBooks.manualLorebook;
                } else {
                    this.chatMetadata.STMemoryBooks.manualLorebook = bookId;
                    const chatList = this.getChatLorebooks();
                    if (!chatList.includes(bookId)) {
                        await this.toggleChatLorebook(bookId);
                        return { ok: true, active: true, mode: 'manual' };
                    }
                }
                await this.saveMetadata();
                return { ok: true, active: cur !== bookId, mode: 'manual' };
            }

            const currentList = this.getChatLorebooks();
            if (currentList[0] === bookId) {
                if (currentList.length > 1) {
                    const rotated = [...currentList.slice(1), bookId];
                    this.chatMetadata.world_info = rotated[0];
                    this.chatMetadata.pcx_extra_world_info = rotated.slice(1);
                } else {
                    delete this.chatMetadata.world_info;
                    delete this.chatMetadata.pcx_extra_world_info;
                }
            } else {
                const rest = currentList.filter(x => x !== bookId);
                this.chatMetadata.world_info = bookId;
                if (rest.length > 0) this.chatMetadata.pcx_extra_world_info = rest;
                else delete this.chatMetadata.pcx_extra_world_info;
            }
            if (window.jQuery) {
                window.jQuery('.chat_lorebook_button').toggleClass('world_set', Boolean(this.chatMetadata.world_info));
            }
            await this.saveMetadata();
            await this.refreshWorldInfoUI();
            if (typeof worldInfoModRef?.getSortedEntries === 'function') {
                try { await worldInfoModRef.getSortedEntries(); } catch {}
            }
            return { ok: true, active: this.chatMetadata.world_info === bookId, mode: 'chat' };
        },
        async toggleCharLorebook(bookId) {
            const c = this.ctx;
            if (c.groupId || c.characterId === undefined || c.characterId === null || c.characterId === '') return false;
            const ch = Array.isArray(c.characters) ? c.characters[c.characterId] : null;
            if (!ch) return false;
            const cur = ch?.data?.extensions?.world || '';
            const nextVal = (cur === bookId) ? '' : bookId;
            const updatePrimary = worldInfoModRef?.charUpdatePrimaryWorld;
            if (typeof updatePrimary === 'function' && !c.groupId) {
                await updatePrimary(nextVal);
            } else if (typeof c.writeExtensionField === 'function') {
                const UNSET_EXTENSION_FIELD = '__@@UNSET@@__';
                await c.writeExtensionField(c.characterId, 'world', nextVal || UNSET_EXTENSION_FIELD);
            } else {
                if (!ch.data) ch.data = {};
                if (!ch.data.extensions) ch.data.extensions = {};
                if (nextVal) ch.data.extensions.world = nextVal;
                else delete ch.data.extensions.world;
                scriptMod.saveCharacterDebounced?.();
            }
            if (window.jQuery) window.jQuery('#character_world').val(nextVal);
            await this.refreshWorldInfoUI();
            return Boolean(nextVal);
        },
        wasWiEntryActivated(bookName, uid) {
            if (!bookName || uid === undefined || uid === null) return false;
            return lastActivatedWiKeys.has(`${bookName}::${uid}`);
        },
        isOwnWorldInfoSave(bookData) {
            return Boolean(bookData && typeof bookData === 'object' && ownSavedWiPayloads.has(bookData));
        },
        async saveWorldInfoBook(name, data) {
            if (!name || !data || typeof data !== 'object') {
                throw new Error('Некорректные данные Лорбука для сохранения.');
            }
            const cacheSnapshot = JSON.parse(JSON.stringify(data));
            ownSavedWiPayloads.add(cacheSnapshot);
            try {
                const res = await fetch('/api/worldinfo/edit', {
                    method: 'POST',
                    headers: this.getRequestHeaders(),
                    body: JSON.stringify({ name, data: cacheSnapshot }),
                });
                if (!res.ok) {
                    const errTxt = await res.text().catch(() => '');
                    throw new Error(`Ошибка сохранения Лорбука на сервере (HTTP ${res.status})${errTxt ? ': ' + errTxt.slice(0, 140) : ''}`);
                }
                const ack = await res.json();
                if (!ack || ack.ok !== true) {
                    throw new Error('Сервер не подтвердил запись Лорбука на диск.');
                }
                worldInfoModRef?.worldInfoCache?.set?.(name, cacheSnapshot);
                const evSrc = this.eventSource, evT = this.eventTypes;
                if (evSrc?.emit && evT?.WORLDINFO_UPDATED) {
                    await evSrc.emit(evT.WORLDINFO_UPDATED, name, cacheSnapshot);
                }
                try { worldInfoModRef?.reloadEditor?.(name, false); } catch {}
                return JSON.parse(JSON.stringify(cacheSnapshot));
            } finally {
                ownSavedWiPayloads.delete(cacheSnapshot);
            }
        },
        async deleteWorldInfoBook(name) {
            const res = await fetch('/api/worldinfo/delete', {
                method: 'POST', headers: this.getRequestHeaders(), body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error(`Не удалось удалить файл Лорбука (HTTP ${res.status}).`);
            try { worldInfoModRef?.worldInfoCache?.delete?.(name); } catch {}
            try {
                const pu = this.ctx.powerUserSettings || powerUserModRef?.power_user;
                if (pu && pu.persona_description_lorebook === name) {
                    pu.persona_description_lorebook = '';
                    this.saveSettings();
                }
            } catch {}
            await this.refreshWorldInfoUI();
        },
        async refreshWorldInfoUI() {
            if (typeof worldInfoModRef?.updateWorldInfoList === 'function') {
                try { await worldInfoModRef.updateWorldInfoList(); } catch {}
            }
        },
        async generateWithSchemaFallback(systemPrompt, userPrompt, schemaObj) {
            const fn = this.ctx.generateRaw || scriptMod.generateRaw;
            if (typeof fn === 'function') {
                if (!schemaObj) return await fn({ prompt: userPrompt, systemPrompt });
                try { return await fn({ prompt: userPrompt, systemPrompt, jsonSchema: schemaObj }); }
                catch (err) {
                    if (!isSchemaUnsupportedError(err)) throw err;
                    return await fn({ prompt: userPrompt, systemPrompt });
                }
            }
            const qFn = this.ctx.generateQuietPrompt || scriptMod.generateQuietPrompt;
            if (typeof qFn === 'function') return await qFn({ quietPrompt: `${systemPrompt}\n\n${userPrompt}`, quietToLoud: false, skipWIAN: true });
            throw new Error('Активное подключение не найдено.');
        },
    };
}

function injectStylesAndFonts() {
    const existing = document.getElementById('pcx-embedded-css');
    if (existing) {
        if (existing.textContent !== SUITE_CSS) existing.textContent = SUITE_CSS;
    } else {
        const st = document.createElement('style');
        st.id = 'pcx-embedded-css';
        st.textContent = SUITE_CSS;
        document.head.appendChild(st);
    }
}

const VALID_HEADER_MODES = ['sec_and_auto_notes', 'sec_and_custom_notes', 'only_notes', 'none'];
const VALID_SUBHEADER_STYLES = ['h4_blank', 'bracket_blank', 'colon_blank', 'h4_line'];

function normalizeStore(store) {
    if (!store.categories || !Array.isArray(store.categories) || store.categories.length === 0) {
        store.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
    if (!Array.isArray(store.notes)) store.notes = [];
    for (const c of store.categories) {
        if (c.enabled === undefined) c.enabled = true;
        c.injectPos = c.injectPos !== undefined ? Number(c.injectPos) : ST_POS.IN_CHAT;
        c.injectDepth = c.injectDepth !== undefined ? Math.max(0, Number(c.injectDepth)) : 2;
        if (Number.isNaN(c.injectDepth)) c.injectDepth = 0;
        c.injectRole = c.injectRole !== undefined ? Number(c.injectRole) : 0;
        c.injectInterval = Math.max(1, Number(c.injectInterval) || 1);
        if (c.showHeader === undefined) c.showHeader = (c.id !== 'classic_an');
        if (!c.headerMode || !VALID_HEADER_MODES.includes(c.headerMode)) {
            c.headerMode = c.showHeader ? 'sec_and_custom_notes' : 'only_notes';
        }
        c.showHeader = (c.headerMode === 'sec_and_auto_notes' || c.headerMode === 'sec_and_custom_notes');
        if (!c.subHeaderStyle || !VALID_SUBHEADER_STYLES.includes(c.subHeaderStyle)) {
            c.subHeaderStyle = 'h4_blank';
        }
    }
    const catIdSet = new Set(store.categories.map(c => c.id));
    const fallbackCatId = store.categories[0]?.id || 'classic_an';
    for (const n of store.notes) {
        if (!n.categoryId || !catIdSet.has(n.categoryId)) n.categoryId = fallbackCatId;
        if (n.includeTitle === undefined) n.includeTitle = false;
        if (!n.subHeaderStyle) n.subHeaderStyle = 'inherit';
        if (n.collapsed === undefined) n.collapsed = false;
    }
    return store;
}

function ensureSettings() {
    const root = stApi.extensionSettings;
    if (!root[MODULE_NAME]) root[MODULE_NAME] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const s = root[MODULE_NAME];
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (s[k] === undefined) s[k] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS[k]));
    }
    if (typeof s.gmSystemPrompt === 'string' && s.gmSystemPrompt.includes(LEGACY_GM_PROMPT_SNIPPET)) {
        s.gmSystemPrompt = DEFAULT_GM_SYSTEM_PROMPT;
    }
    if (!s.globalData || typeof s.globalData !== 'object') s.globalData = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.globalData));
    else normalizeStore(s.globalData);
    return s;
}

function getAllCodexPresets() {
    const s = ensureSettings();
    const custom = Array.isArray(s.customCodexPresets)
        ? s.customCodexPresets.filter(p => p && p.id && p.name).map(p => ({ ...p, isCustom: true }))
        : [];
    return [...CODEX_PROMPT_PRESETS, ...custom];
}

function getActiveCodexPreset() {
    const s = ensureSettings();
    const all = getAllCodexPresets();
    return all.find(p => p.id === s.gmPresetId) || all[0];
}

function getConnectionProfiles() {
    const cm = stApi.extensionSettings?.connectionManager;
    if (!cm || !Array.isArray(cm.profiles)) return [];
    return [...cm.profiles].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function getChatStore() {
    try {
        if (!stApi.isChatOpen()) return null;
        const meta = stApi.chatMetadata;
        if (!meta || typeof meta !== 'object' || !Object.isExtensible(meta)) return null;
        if (!meta[MODULE_NAME]) meta[MODULE_NAME] = { categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)), notes: [] };
        return normalizeStore(meta[MODULE_NAME]);
    } catch { return null; }
}

function getActiveStore() {
    const s = ensureSettings();
    if (!stApi.isChatOpen()) { s.scope = 'global'; return s.globalData; }
    if (s.scope === 'chat') { const cs = getChatStore(); if (cs) return cs; }
    return s.globalData;
}

function getActiveChatDisplayName(uiLang = 'ru') {
    if (!stApi.isChatOpen()) return tUi(uiLang, 'Чат не открыт', 'No Active Chat');
    const c = stApi.ctx || {};
    if (c.groupId && Array.isArray(c.groups)) {
        const g = c.groups.find(x => String(x.id) === String(c.groupId));
        if (g?.name) return g.name;
    }
    if (c.name2) return c.name2;
    const ch = (c.characterId !== undefined && Array.isArray(c.characters)) ? c.characters[c.characterId] : null;
    return ch?.name || tUi(uiLang, 'Текущий чат', 'Current Chat');
}

function getActiveCharPortraitUrl() {
    if (!stApi.isChatOpen()) return '';
    const c = stApi.ctx || {};
    if (!c.groupId && c.characterId !== undefined && c.characterId !== null && Array.isArray(c.characters)) {
        const ch = c.characters[c.characterId];
        if (ch?.avatar) return `/characters/${encodeURIComponent(ch.avatar)}`;
    }
    return '';
}

function renderNotebookCoverGraphic({ scope = 'chat', title = 'Notebook', count = 0, uiLang = 'ru' } = {}) {
    const s = ensureSettings();
    if (scope === 'chat') {
        const customChatCover = sanitizeCoverDataUrl(stApi.chatMetadata?.pcx_notebook_cover);
        if (customChatCover) {
            return `<img class="pcx-cover-img" src="${escapeHtml(toBlobDisplayUrl(customChatCover))}" alt="${escapeHtml(title)}">`;
        }
        const charUrl = getActiveCharPortraitUrl();
        if (charUrl) {
            return `<img class="pcx-cover-img" src="${escapeHtml(charUrl)}" alt="${escapeHtml(title)}">`;
        }
    } else {
        const customGlobalCover = sanitizeCoverDataUrl(s.globalNotebookCover);
        if (customGlobalCover) {
            return `<img class="pcx-cover-img" src="${escapeHtml(toBlobDisplayUrl(customGlobalCover))}" alt="${escapeHtml(title)}">`;
        }
    }
    return renderProceduralCoverSvg({
        title,
        subtitle: uiLang === 'en' ? 'NOTEBOOK' : 'NOTEBOOK',
        countLabel: `${count} NOTES`,
        seed: `${scope}_${title}`,
    });
}

function describeCategoryRouteShort(cat) {
    if (!cat) return '';
    const uiLang = ensureSettings().uiLang || 'ru';
    const pos = Number(cat.injectPos);
    const r = ({ 0: 'System', 1: 'User', 2: 'Assistant' })[Number(cat.injectRole) || 0] || 'System';
    const intv = Number(cat.injectInterval) > 1 ? ` · 1/${cat.injectInterval}` : '';
    if (pos === ST_POS.LOCAL_ONLY) return tUi(uiLang, 'Личный черновик (Никуда)', 'Private Draft');
    if (pos === ST_POS.MACRO_ONLY) return '{{notebook}}';
    if (pos === ST_POS.BEFORE_MAIN) return `${tUi(uiLang, 'До чара', 'Before Char')} · ${r}${intv}`;
    if (pos === ST_POS.AFTER_MAIN) return `${tUi(uiLang, 'После чара', 'After Char')} · ${r}${intv}`;
    return `@ Depth ${Math.max(0, Number(cat.injectDepth) || 0)} · ${r}${intv}`;
}

function describeHeaderModeLabel(mode, uiLang = 'ru') {
    const mapRu = {
        sec_and_custom_notes: 'Шапка раздела + выбранные подзаголовки карточек',
        sec_and_auto_notes: 'Шапка раздела + подзаголовки всех карточек',
        only_notes: 'Без шапки раздела (только подзаголовки карточек)',
        none: 'Чистый текст без шапок и подзаголовков',
    };
    const mapEn = {
        sec_and_custom_notes: 'Section header + selected note subheaders',
        sec_and_auto_notes: 'Section header + all note subheaders',
        only_notes: 'No section header (note subheaders only)',
        none: 'Raw body text without headers',
    };
    return (uiLang === 'en' ? mapEn[mode] : mapRu[mode]) || mapRu.sec_and_custom_notes;
}

function readTextAttachment(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 450 * 1024) { reject(new Error('Файл больше 450 КБ')); return; }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.onload = () => resolve({
            id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            kind: 'text',
            name: file.name,
            text: String(reader.result || ''),
            includeInPrompt: true,
        });
        reader.readAsText(file);
    });
}

function openImageLightbox(src) {
    document.getElementById('pcx-lightbox')?.remove();
    const box = document.createElement('div');
    box.id = 'pcx-lightbox';
    const img = document.createElement('img');
    img.src = toBlobDisplayUrl(src);
    box.appendChild(img);
    box.addEventListener('click', () => box.remove());
    (document.getElementById('pcx-dialog') || document.body).appendChild(box);
}

function formatSingleCharCard(ch, fallbackName, { includeScenario = true } = {}) {
    if (!ch) return '';
    const name = ch.name || fallbackName || 'Персонаж';
    const desc = (ch.description || ch.data?.description || '').trim();
    const pers = (ch.personality || ch.data?.personality || '').trim();
    const scen = includeScenario ? (ch.scenario || ch.data?.scenario || '').trim() : '';
    const parts = [];
    if (desc) parts.push(desc);
    if (pers) parts.push(`Личность: ${pers}`);
    if (scen) parts.push(`Сценарий: ${scen}`);
    return parts.length ? `[Описание персонажа (${name})]\n${parts.join('\n')}` : '';
}

function getCharacterDescriptionText({ includeScenario = true } = {}) {
    try {
        const ctx = stApi.ctx;
        const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
        if (ctx.groupId && Array.isArray(ctx.groups)) {
            const grp = ctx.groups.find(g => String(g.id) === String(ctx.groupId));
            if (grp && Array.isArray(grp.members)) {
                const memberCards = grp.members
                    .slice(0, 5)
                    .map(av => chars.find(c => c.avatar === av))
                    .filter(Boolean)
                    .map(ch => formatSingleCharCard(ch, ch.name, { includeScenario }))
                    .filter(Boolean);
                if (memberCards.length > 0) return memberCards.join('\n\n');
            }
        }
        if (ctx.characterId !== undefined && ctx.characterId !== null && chars[ctx.characterId]) {
            return formatSingleCharCard(chars[ctx.characterId], ctx.name2, { includeScenario });
        }
        const domDesc = (document.getElementById('description_textarea')?.value || '').trim();
        return domDesc ? `[Описание персонажа (${ctx.name2 || 'Персонаж'})]\n${domDesc}` : '';
    } catch { return ''; }
}

function getUserPersonaDescriptionText() {
    try {
        const ctx = stApi.ctx;
        const persona = (ctx.powerUserSettings?.persona_description || powerUserModRef?.power_user?.persona_description || document.getElementById('persona_description')?.value || '').trim();
        return persona ? `[Описание игрока (${ctx.name1 || 'Игрок'})]\n${persona}` : '';
    } catch { return ''; }
}

function buildWordLimitPhrase(minW, maxW) {
    const min = Math.max(0, Number(minW) || 0), max = Math.max(0, Number(maxW) || 0);
    if (min > 0 && max > 0) return `строго от ${Math.min(min, max)} до ${Math.max(min, max)} слов`;
    if (min > 0) return `не менее ${min} слов`;
    if (max > 0) return `не более ${max} слов`;
    return 'без жёстких ограничений (оптимально под задачу)';
}

function buildChatContextSnippet(radius) {
    const count = Math.max(0, Number(radius) || 0);
    if (count === 0) return '';
    try {
        const ctx = stApi.ctx;
        const charName = ctx.name2 || 'Персонаж', userName = ctx.name1 || 'Игрок';
        const valid = (Array.isArray(ctx.chat) ? ctx.chat : []).filter(m => m && !m.is_system && typeof m.mes === 'string' && m.mes.trim());
        const slice = valid.slice(-count);
        const formatted = slice.map((m, i) => `[Сообщение ${i + 1}/${slice.length} — ${m.name || (m.is_user ? userName : charName)}]:\n${m.mes.trim()}`).join('\n\n---\n\n');
        return `Участники: {{user}} = "${userName}", {{char}} = "${charName}".\n` + (formatted ? `Последние полные сообщения (${slice.length} шт.):\n\n${formatted}` : '');
    } catch { return ''; }
}

function extractNoteFromModelOutput(raw) {
    const unwrapped = unwrapAndParseModelJson(raw, 'note');
    if (unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)) {
        const cStr = typeof unwrapped.content === 'string' ? unwrapped.content : (unwrapped.note || unwrapped.text || '');
        if (cStr) {
            return { title: String(unwrapped.title || '').trim(), content: formatCleanParagraphs(cStr) };
        }
    }
    let txt = typeof raw === 'string' ? raw : (typeof raw?.content === 'string' ? raw.content : (raw?.choices?.[0]?.message?.content || raw?.text || ''));
    txt = String(txt || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const unfenced = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const tm = unfenced.match(/^(?:ЗАГОЛОВОК|TITLE|НАЗВАНИЕ)\s*:\s*(.+)$/im);
    if (tm) {
        return {
            title: tm[1].trim().replace(/^["«]|["»]$/g, ''),
            content: formatCleanParagraphs(unfenced.replace(tm[0], '').replace(/^\s*(?:ТЕКСТ|CONTENT|ЗАПИСЬ)\s*:\s*/im, '').trim()),
        };
    }
    return { title: '', content: formatCleanParagraphs(unfenced) };
}

async function runAiNoteGeneration({ taskText, currentDraftText, attachments, previousCandidate, refinementInstruction }) {
    const s = ensureSettings();
    const uiLang = s.uiLang || 'ru';
    const activePreset = getActiveCodexPreset();
    const rawSys = (s.gmSystemPrompt && s.gmSystemPrompt.trim()) ? s.gmSystemPrompt.trim() : activePreset.prompt;
    const systemPrompt = rawSys
        .replace(/\{\{lang\}\}/gi, (s.aiLang || 'Русский').trim())
        .replace(/\{\{word_limit\}\}/gi, buildWordLimitPhrase(s.aiWordsMin, s.aiWordsMax));

    const parts = [];
    if (s.aiSendCharDesc) { const cd = getCharacterDescriptionText(); if (cd) parts.push(cd); }
    if (s.aiSendUserDesc) { const ud = getUserPersonaDescriptionText(); if (ud) parts.push(ud); }
    const cb = buildChatContextSnippet(s.aiChatRadius);
    if (cb) parts.push(cb);
    if (Array.isArray(attachments)) {
        const docs = attachments.filter(a => a.kind === 'text' && a.includeInPrompt !== false && a.text);
        if (docs.length) parts.push('[Прикреплённые файлы]\n' + docs.map(d => `--- ${d.name} ---\n${d.text.slice(0, 15000)}`).join('\n\n'));
    }
    if (previousCandidate && refinementInstruction) {
        parts.push(`[Исходный запрос]\n${taskText.trim() || '(нет)'}`);
        parts.push(`[Предыдущий вариант]\nЗаголовок: ${previousCandidate.title || ''}\nТекст:\n${previousCandidate.content || ''}`);
        parts.push(`[Что изменить]\n${refinementInstruction.trim()}`);
    } else {
        if (currentDraftText && currentDraftText.trim()) parts.push(`[Черновик]\n${currentDraftText.trim()}`);
        parts.push(`[Запрос автора]\n${taskText.trim() || 'Доработай черновик.'}`);
    }
    if (s.aiTransportMode !== 'direct') {
        parts.push('Верни ответ строго в формате JSON: {"title": "Короткий заголовок", "content": "Чистый текст заметки с разделением абзацев"} (либо чистым текстом без лишних вступлений).');
    }

    const userPrompt = parts.join('\n\n');
    const profileId = (s.aiProfileId || '').trim();
    let profileLabel = tUi(uiLang, '[ Текущее подключение SillyTavern ]', '[ Current SillyTavern Connection ]');
    if (profileId) {
        const chosen = getConnectionProfiles().find(p => p.id === profileId);
        if (!chosen) {
            throw new Error(tUi(
                uiLang,
                'Выбранный профиль подключения ИИ больше не существует. Выберите другой профиль.',
                'The selected AI Connection Profile no longer exists. Please choose another profile.',
            ));
        }
        profileLabel = chosen.name || profileId;
    }

    const raw = await executePcxAiRequest({
        stApi,
        settings: s,
        profileId,
        profileLabel,
        systemPrompt,
        userPrompt,
        jsonSchema: NOTE_OUTPUT_JSON_SCHEMA,
    });
    return extractNoteFromModelOutput(raw);
}

// ==================== BACKGROUND PROMPT INJECTION (PRESERVING ROLES & INTENTIONAL \n!) ====================
function formatSubheaderWithBody(titleText, bodyText, style = 'h4_blank', isCritical = false) {
    const cleanTitle = String(titleText || '').trim();
    const strictPrefix = isCritical ? '[ВАЖНО] ' : '';
    if (!cleanTitle) {
        return isCritical ? `[ВАЖНО]\n${bodyText}` : bodyText;
    }
    if (style === 'bracket_blank') return `[${strictPrefix}${cleanTitle}]\n\n${bodyText}`;
    if (style === 'colon_blank') return `${strictPrefix}${cleanTitle}:\n\n${bodyText}`;
    if (style === 'h4_line') return `#### ${strictPrefix}${cleanTitle}\n${bodyText}`;
    return `#### ${strictPrefix}${cleanTitle}\n\n${bodyText}`;
}

function shouldShowNoteSubheader(note, cat) {
    const mode = cat?.headerMode || (cat?.showHeader !== false ? 'sec_and_custom_notes' : 'only_notes');
    if (mode === 'none') return false;
    const hasTitle = Boolean(note.title && note.title.trim());
    if (!hasTitle) return false;
    if (mode === 'sec_and_auto_notes') return note.forceHideTitle !== true;
    return Boolean(note.includeTitle);
}

function compileSingleNoteText(note, cat) {
    const pieces = [];
    const rawBody = String(note.content ?? '').replace(/\{\{notebook\}\}/gi, '');
    const isIntentionalSpacer = rawBody.length > 0 && rawBody.trim().length === 0;
    const mainText = isIntentionalSpacer ? rawBody : rawBody.replace(/^\n+|\n+$/g, '');

    if (mainText.length > 0) {
        if (isIntentionalSpacer) {
            pieces.push(mainText);
        } else {
            const isCrit = note.priority === 'critical';
            const showSub = shouldShowNoteSubheader(note, cat);
            const effStyle = (note.subHeaderStyle && note.subHeaderStyle !== 'inherit')
                ? note.subHeaderStyle
                : (cat?.subHeaderStyle || 'h4_blank');
            if (showSub) {
                pieces.push(formatSubheaderWithBody(note.title, mainText, effStyle, isCrit));
            } else {
                pieces.push(isCrit ? `[ВАЖНО]\n${mainText}` : mainText);
            }
        }
    }
    if (Array.isArray(note.attachments)) {
        for (const att of note.attachments) {
            if (att.kind === 'text' && att.includeInPrompt !== false && att.text) {
                pieces.push(String(att.text).replace(/\{\{notebook\}\}/gi, ''));
            }
        }
    }
    return pieces.filter(p => p.length > 0).join('\n\n');
}

function gatherOrderedSectionsWithNotes() {
    const s = ensureSettings();
    const result = [];
    const pushFromStore = (store, scopeTag) => {
        if (!store || !Array.isArray(store.categories) || !Array.isArray(store.notes)) return;
        for (const cat of store.categories) {
            if (cat.enabled === false) continue;
            const activeNotes = store.notes.filter(n => n.categoryId === cat.id && n.enabled !== false);
            if (!activeNotes.length) continue;
            const compiled = activeNotes.map(n => compileSingleNoteText(n, cat)).filter(p => p.length > 0);
            if (!compiled.length) continue;
            const body = compiled.join('\n\n');
            const rawDepth = Number(cat.injectDepth);
            const mode = cat.headerMode || (cat.showHeader !== false ? 'sec_and_custom_notes' : 'only_notes');
            const showSecHeading = (mode === 'sec_and_auto_notes' || mode === 'sec_and_custom_notes');
            result.push({
                keyId: `${scopeTag}_${cat.id}`,
                name: cat.name,
                pos: Number(cat.injectPos ?? ST_POS.IN_CHAT),
                depth: Number.isNaN(rawDepth) ? 0 : Math.max(0, rawDepth),
                role: Number(cat.injectRole) || 0,
                interval: Math.max(1, Number(cat.injectInterval) || 1),
                text: showSecHeading ? `### ${cat.name}\n\n${body}` : body,
            });
        }
    };
    const chatStore = getChatStore();
    if (s.includeGlobalWithChat) pushFromStore(s.globalData, 'glob');
    if (chatStore) pushFromStore(chatStore, 'chat');
    else if (!s.includeGlobalWithChat) pushFromStore(s.globalData, 'glob');
    return result;
}

function buildSectionHeaderLivePreview(secDraft) {
    const uiLang = stApi ? (ensureSettings().uiLang || 'ru') : 'ru';
    const secName = (secDraft?.name || '').trim() || tUi(uiLang, 'Отношения и Биография', 'Relationships & Bio');
    const pos = Number(secDraft?.injectPos ?? ST_POS.IN_CHAT);
    if (pos === ST_POS.LOCAL_ONLY) {
        return tUi(
            uiLang,
            '[ Личный черновик: этот раздел виден только вам и НЕ отправляется в ИИ ]',
            '[ Private Draft: visible only to you and NEVER injected into AI prompts ]',
        );
    }
    const mode = secDraft?.headerMode || 'sec_and_custom_notes';
    const subStyle = secDraft?.subHeaderStyle || 'h4_blank';
    const roleName = ({ 0: 'System', 1: 'User', 2: 'Assistant' })[Number(secDraft?.injectRole) || 0] || 'System';
    const dest = pos === ST_POS.MACRO_ONLY
        ? 'Макрос {{notebook}}'
        : (pos === ST_POS.BEFORE_MAIN
            ? `До промпта персонажа · ${roleName}`
            : (pos === ST_POS.AFTER_MAIN
                ? `После промпта персонажа · ${roleName}`
                : `@ Depth ${Math.max(0, Number(secDraft?.injectDepth) || 0)} · ${roleName}`));
    const showSec = (mode === 'sec_and_auto_notes' || mode === 'sec_and_custom_notes');
    const showSub = (mode !== 'none');
    const sampleTitle = tUi(uiLang, 'Режиссура сцены и детали', 'Scene Direction & Details');
    const sampleBody = tUi(
        uiLang,
        'Камерный нуар, стук колёс и мягкий свет бра в коридоре.\n\nПерсонажи помнят недавний спор на перроне.',
        'Quiet noir pacing, rhythmic train wheels, and warm corridor sconces.\n\nCharacters remember their recent argument on the platform.',
    );
    const noteFormatted = showSub ? formatSubheaderWithBody(sampleTitle, sampleBody, subStyle, false) : sampleBody;
    const body = showSec ? `### ${secName}\n\n${noteFormatted}` : noteFormatted;
    return `${tUi(uiLang, 'Куда упадёт:', 'Destination:')} ${dest}\n────────────────────────\n${body}`;
}

function buildMacroNotebookText() {
    if (isExpandingMacro) return '';
    isExpandingMacro = true;
    try {
        return gatherOrderedSectionsWithNotes()
            .filter(sec => sec.pos === ST_POS.MACRO_ONLY)
            .map(sec => sec.text)
            .join('\n\n');
    } finally {
        isExpandingMacro = false;
    }
}

function buildAutoInjectGroups(ignoreInterval = false) {
    const all = gatherOrderedSectionsWithNotes();
    const chatMsgs = Array.isArray(stApi.ctx?.chat) ? stApi.ctx.chat : [];
    const userTurnCount = chatMsgs.filter(m => m && !m.is_system && m.is_user).length;
    const groupsMap = new Map();
    for (const sec of all) {
        if (sec.pos === ST_POS.MACRO_ONLY || sec.pos === ST_POS.LOCAL_ONLY) continue;
        if (!ignoreInterval && sec.interval > 1 && (userTurnCount % sec.interval !== 0)) continue;
        const effectiveDepth = sec.pos === ST_POS.IN_CHAT ? sec.depth : 0;
        const sig = `p${sec.pos}_d${effectiveDepth}_r${sec.role}`;
        if (!groupsMap.has(sig)) {
            groupsMap.set(sig, { sig, pos: sec.pos, depth: effectiveDepth, role: sec.role, sectionNames: [], blocks: [] });
        }
        const g = groupsMap.get(sig);
        g.sectionNames.push(sec.name);
        g.blocks.push(sec.text);
    }
    return Array.from(groupsMap.values()).map(g => ({ ...g, combinedText: g.blocks.join('\n\n') }));
}

function countAllPromptActiveNotes() {
    const s = ensureSettings();
    let count = 0;
    const countInStore = (st) => {
        if (!st?.categories || !st?.notes) return 0;
        const promptCats = new Set(st.categories.filter(c => c.enabled !== false && Number(c.injectPos) !== ST_POS.LOCAL_ONLY).map(c => c.id));
        return st.notes.filter(n => n.enabled !== false && promptCats.has(n.categoryId)).length;
    };
    if (s.includeGlobalWithChat) count += countInStore(s.globalData);
    const chatStore = getChatStore();
    if (chatStore) count += countInStore(chatStore);
    else if (!s.includeGlobalWithChat) count += countInStore(s.globalData);
    return count;
}

function updateExtensionPrompt({ force = false } = {}) {
    const groups = buildAutoInjectGroups(false);
    const nextSig = JSON.stringify(groups.map(g => [g.sig, g.combinedText]));
    if (!force && nextSig === lastCompiledPromptSignature) return;
    lastCompiledPromptSignature = nextSig;

    stApi.setPrompt('st_pocket_codex_prompt', '', ST_POS.MACRO_ONLY, 0, false, ST_ROLE.SYSTEM);
    for (const oldKey of activeRegisteredPromptKeys) {
        stApi.setPrompt(oldKey, '', ST_POS.MACRO_ONLY, 0, false, ST_ROLE.SYSTEM);
    }
    activeRegisteredPromptKeys.clear();
    groups.forEach((g, idx) => {
        const key = `${PROMPT_KEY_PREFIX}${idx}_${g.sig}`;
        activeRegisteredPromptKeys.add(key);
        stApi.setPrompt(key, g.combinedText, g.pos, g.depth, false, g.role);
    });
}

function saveAll() {
    clearTimeout(debouncedSaveTimer);
    updateExtensionPrompt({ force: true });
    stApi.saveSettings();
    stApi.saveMetadata();
}

function scheduleSaveAll() {
    clearTimeout(debouncedSaveTimer);
    debouncedSaveTimer = setTimeout(() => {
        updateExtensionPrompt();
        stApi.saveSettings();
        stApi.saveMetadata();
    }, 260);
}

function applyThemeClasses() {
    const s = ensureSettings();
    const themeObj = THEMES.find(t => t.id === s.theme) || THEMES[0];
    for (const el of [document.getElementById('pcx-window'), document.getElementById('pcx-sub-dialog')]) {
        if (!el) continue;
        THEMES.forEach(t => el.classList.remove(`pcx-theme-${t.id}`));
        el.classList.add(`pcx-theme-${themeObj.id}`);
        el.classList.toggle('pcx-no-tips', s.showTooltips === false);
    }
}

// ==================== ZERO-LAG DRAG-AND-DROP (GRIP-ONLY, NO SCROLL BLOCKING!) ====================
function enableSmoothCardDrag(win, store, currentCatId) {
    const scrollEl = win.querySelector('.pcx-main');
    const stackEl = win.querySelector('#pcx-notes-stack');
    if (!scrollEl || !stackEl) return;

    const startCardDrag = (card, startClientY, isTouch) => {
        window.getSelection?.()?.removeAllRanges?.();
        document.body.classList.add('pcx-dragging-active');
        navigator.vibrate?.(12);
        const rect = card.getBoundingClientRect();
        const offsetY = startClientY - rect.top;
        const placeholder = document.createElement('div');
        placeholder.className = 'pcx-drag-placeholder';
        placeholder.style.height = `${rect.height}px`;
        card.parentNode.insertBefore(placeholder, card);
        card.classList.add('pcx-card-floating');
        card.style.width = `${rect.width}px`;
        card.style.left = `${rect.left}px`;
        card.style.top = `${rect.top}px`;

        let latestY = startClientY, rafId = null;
        const updatePosition = () => {
            rafId = null;
            card.style.top = `${latestY - offsetY}px`;
            const sRect = scrollEl.getBoundingClientRect();
            if (latestY < sRect.top + 48) scrollEl.scrollTop -= 9;
            else if (latestY > sRect.bottom - 48) scrollEl.scrollTop += 9;
            const siblings = [...stackEl.querySelectorAll('.pcx-note-card:not(.pcx-card-floating)')];
            let beforeNode = null;
            for (const sib of siblings) {
                const r = sib.getBoundingClientRect();
                if (latestY < r.top + r.height / 2) { beforeNode = sib; break; }
            }
            if (beforeNode) {
                if (placeholder.nextSibling !== beforeNode) stackEl.insertBefore(placeholder, beforeNode);
            } else {
                stackEl.appendChild(placeholder);
            }
        };

        const onMove = (ev) => {
            if (ev.cancelable) ev.preventDefault();
            latestY = isTouch ? (ev.touches[0]?.clientY ?? latestY) : ev.clientY;
            if (!rafId) rafId = requestAnimationFrame(updatePosition);
        };

        const onEnd = () => {
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
            card.style.width = ''; card.style.left = ''; card.style.top = '';
            placeholder.parentNode?.insertBefore(card, placeholder);
            placeholder.remove();
            if (!stackEl.isConnected) return;
            const orderedIds = [...stackEl.querySelectorAll('.pcx-note-card')].map(el => el.dataset.noteId).filter(Boolean);
            if (!orderedIds.length) return;
            const orderedSet = new Set(orderedIds);
            const catMap = new Map();
            for (const n of store.notes) if (n.categoryId === currentCatId) catMap.set(n.id, n);
            const reorderedQueue = orderedIds.map(id => catMap.get(id)).filter(Boolean);
            let qIdx = 0;
            store.notes = store.notes.map(n => {
                if (n.categoryId !== currentCatId || !orderedSet.has(n.id)) return n;
                return reorderedQueue[qIdx++] || n;
            });
            saveAll();
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

    stackEl.querySelectorAll('.pcx-note-grip').forEach(grip => {
        grip.addEventListener('contextmenu', e => e.preventDefault());
        grip.addEventListener('touchstart', e => {
            if (e.touches.length !== 1) return;
            e.preventDefault(); e.stopPropagation();
            const card = grip.closest('.pcx-note-card');
            if (card) startCardDrag(card, e.touches[0].clientY, true);
        }, { passive: false });
        grip.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            const card = grip.closest('.pcx-note-card');
            if (card) startCardDrag(card, e.clientY, false);
        });
    });
}

// Section drag-and-drop strictly via .pcx-sec-grip so tapping/scrolling tabs NEVER fights clicks!
function enableSectionGripReorder(win, store) {
    const strip = win.querySelector('#pcx-sec-carousel');
    if (!strip) return;

    const persistOrder = () => {
        const ids = [...strip.querySelectorAll('[data-sec-tab]')].map(el => el.dataset.secTab).filter(Boolean);
        const map = new Map(store.categories.map(c => [c.id, c]));
        const nextCats = ids.map(id => map.get(id)).filter(Boolean);
        if (nextCats.length === store.categories.length) {
            store.categories = nextCats;
            saveAll();
        }
    };

    const moveChip = (chip, clientX) => {
        const rect = strip.getBoundingClientRect();
        if (clientX < rect.left + 36) strip.scrollLeft -= 8;
        else if (clientX > rect.right - 36) strip.scrollLeft += 8;
        const addBtn = strip.querySelector('#pcx-add-tab-btn');
        const siblings = [...strip.querySelectorAll('[data-sec-tab]:not(.pcx-tab-dragging)')];
        let beforeEl = addBtn || null;
        for (const sib of siblings) {
            const r = sib.getBoundingClientRect();
            if (clientX < r.left + r.width / 2) { beforeEl = sib; break; }
        }
        if (beforeEl) strip.insertBefore(chip, beforeEl);
        else strip.appendChild(chip);
    };

    strip.querySelectorAll('.pcx-sec-grip').forEach(grip => {
        const startSecDrag = (chip, isTouch) => {
            document.body.classList.add('pcx-dragging-active');
            chip.classList.add('pcx-tab-dragging');
            navigator.vibrate?.(12);
            const onMove = (ev) => {
                if (ev.cancelable) ev.preventDefault();
                const cx = isTouch ? ev.touches[0]?.clientX : ev.clientX;
                if (cx !== undefined) moveChip(chip, cx);
            };
            const onEnd = () => {
                document.body.classList.remove('pcx-dragging-active');
                chip.classList.remove('pcx-tab-dragging');
                if (isTouch) {
                    window.removeEventListener('touchmove', onMove);
                    window.removeEventListener('touchend', onEnd);
                    window.removeEventListener('touchcancel', onEnd);
                } else {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onEnd);
                }
                persistOrder();
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

        grip.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
        grip.addEventListener('touchstart', e => {
            if (e.touches.length !== 1) return;
            e.preventDefault(); e.stopPropagation();
            const chip = grip.closest('[data-sec-tab]');
            if (chip) startSecDrag(chip, true);
        }, { passive: false });
        grip.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            const chip = grip.closest('[data-sec-tab]');
            if (chip) startSecDrag(chip, false);
        });
    });
}

// ==================== SUB-DIALOG MODALS (SETTINGS & 13 THEMES, GUIDE, LAYER MAP, SECTION ROUTE, DIAGNOSTICS) ====================
function closeSubModal() {
    uiState.subModal = null;
    uiState.secDraft = null;
    const subDlg = document.getElementById('pcx-sub-dialog');
    if (subDlg) {
        try { if (subDlg.open) subDlg.close(); else subDlg.removeAttribute('open'); } catch { subDlg.removeAttribute('open'); }
        subDlg.innerHTML = '';
    }
}

function openSubModal(kind, extra = {}) {
    const win = document.getElementById('pcx-window');
    captureCurrentEditFields(win);
    uiState.subModal = kind;
    if (kind === 'section') {
        const store = getActiveStore();
        if (extra.mode === 'create') {
            uiState.secModalMode = 'create';
            uiState.secModalCatId = '';
            uiState.secDraft = makeDefaultCategory('new', '', 1, 2, 0, true);
        } else {
            const cat = store.categories.find(c => c.id === extra.catId) || store.categories[0];
            uiState.secModalMode = 'edit';
            uiState.secModalCatId = cat?.id || '';
            uiState.secDraft = cat ? JSON.parse(JSON.stringify(cat)) : makeDefaultCategory('new', '', 1, 2, 0, true);
        }
    }
    renderSubModal();
    const subDlg = document.getElementById('pcx-sub-dialog');
    if (subDlg && !subDlg.open) {
        try { subDlg.showModal(); } catch { subDlg.setAttribute('open', ''); }
    }
}

function renderSubModal() {
    const subDlg = document.getElementById('pcx-sub-dialog');
    if (!subDlg || !uiState.subModal) return;
    applyThemeClasses();
    const s = ensureSettings();
    const uiLang = s.uiLang || 'ru';
    const store = getActiveStore();

    // 1. NEXUSMATCH-STYLE SETTINGS & 13 THEMES SHEET
    if (uiState.subModal === 'settings') {
        subDlg.innerHTML = `
            <div class="pcx-dlg-head">
                <div>
                    <h2>${tUi(uiLang, 'Настройки, Темы и Режим ИИ', 'Settings, Themes & AI Mode')}</h2>
                    <small>${tUi(uiLang, 'Единая панель палитр, языка интерфейса и способа отправки запросов к модели.', 'Unified palette selector, UI language, and AI prompt transport settings.')}</small>
                </div>
                <button type="button" class="pcx-sq-top-btn pcx-icon-only" data-close-sub="1">${ICONS.close}</button>
            </div>
            <div class="pcx-dlg-body">
                <div class="pcx-pair">
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Язык интерфейса', 'App Language')}</span>
                        <select id="pcx-sub-uilang" class="pcx-input">
                            <option value="ru" ${uiLang === 'ru' ? 'selected' : ''}>Русский (RU)</option>
                            <option value="en" ${uiLang === 'en' ? 'selected' : ''}>English (EN)</option>
                        </select>
                    </label>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Способ отправки к ИИ', 'AI Request Transport')}</span>
                        <select id="pcx-sub-transport" class="pcx-input">
                            <option value="preset" ${s.aiTransportMode !== 'direct' ? 'selected' : ''}>${tUi(uiLang, 'Через активный пресет Таверны', 'Through Active Tavern Preset')}</option>
                            <option value="direct" ${s.aiTransportMode === 'direct' ? 'selected' : ''}>${tUi(uiLang, 'Прямой запрос (JSON-схема)', 'Direct Request (JSON Schema)')}</option>
                        </select>
                    </label>
                </div>

                <div class="pcx-guide-note">
                    ${s.aiTransportMode !== 'direct'
                        ? tUi(
                            uiLang,
                            'Режим «Через активный пресет Таверны» бережно сохраняет все включённые модули роли assistant (включая префиллы), @ Depth-блоки и намеренные пустые строки-тоглы "\\n".',
                            '"Through Active Tavern Preset" preserves 100% of enabled assistant-role blocks, @ Depth injections, and intentional "\\n" empty toggles.',
                        )
                        : tUi(
                            uiLang,
                            'Режим «Прямой запрос (JSON-схема)» отправляет только системный промпт расширения и ваше задание без обёртки ролевого пресета Таверны.',
                            '"Direct Request (JSON Schema)" sends only the extension system prompt and your task without the active RP preset.',
                        )}
                </div>

                ${s.aiTransportMode !== 'direct' ? `
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Поправочная инструкция для пресета (необязательно)', 'Optional Preset Correction Prompt')}</span>
                        <input type="text" id="pcx-sub-correction" class="pcx-input" placeholder="${tUi(uiLang, 'Например: Сейчас не пиши пост от лица персонажа, выполни только задание редактора...', 'Optional override note appended after task...')}" value="${escapeHtml(s.presetCorrectionPrompt || '')}">
                    </label>
                ` : ''}

                <div class="pcx-field">
                    <span>${tUi(uiLang, 'Тема оформления (13 палитр + Синхронизация с Таверной)', 'Visual Theme (13 Palettes + Tavern Sync)')}</span>
                    <div class="pcx-theme-grid-2col">
                        ${THEMES.map(t => `
                            <button type="button" class="pcx-theme-card-opt ${t.id === s.theme ? 'pcx-active' : ''}" data-pick-theme="${escapeHtml(t.id)}">
                                <span class="pcx-theme-dot" style="background:${t.color}"></span>
                                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.8rem;font-weight:650;">${escapeHtml(uiLang === 'en' ? (t.nameEn || t.name) : t.name)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="pcx-actions pcx-between pcx-surface" style="padding:10px 12px;background:var(--paper);">
                    <div>
                        <strong style="font-size:0.84rem;display:block;">${tUi(uiLang, 'Кружочки быстрых подсказок (?)', 'Inline (?) Help Tooltips')}</strong>
                        <small>${tUi(uiLang, 'Можно отключить, когда освоитесь с разделами', 'Hide inline help buttons across forms')}</small>
                    </div>
                    <button type="button" class="pcx-sq-switch" id="pcx-sub-tips-sw" role="switch" aria-checked="${s.showTooltips !== false}"><span></span></button>
                </div>

                <div class="pcx-actions pcx-between">
                    <div class="pcx-actions">
                        <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" id="pcx-sub-open-diag">${ICONS.terminal}<span>${tUi(uiLang, 'Последний запрос ИИ', 'Last AI Request')}</span></button>
                        <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" id="pcx-sub-open-guide">${ICONS.help}<span>${tUi(uiLang, 'Путеводитель', 'Guide')}</span></button>
                    </div>
                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-danger-ghost" id="pcx-sub-reset-defaults">${ICONS.reset}<span>${tUi(uiLang, 'Сбросить настройки', 'Reset Defaults')}</span></button>
                </div>
            </div>
            <div class="pcx-dlg-foot">
                <small>${tUi(uiLang, 'Все заметки и книги сохраняются автоматически.', 'All notes and Lorebooks save automatically.')}</small>
                <button type="button" class="pcx-btn pcx-btn-primary" data-close-sub="1">${tUi(uiLang, 'Готово', 'Done')}</button>
            </div>
        `;

        subDlg.querySelectorAll('[data-close-sub]').forEach(b => b.addEventListener('click', closeSubModal));
        subDlg.querySelector('#pcx-sub-uilang')?.addEventListener('change', e => {
            s.uiLang = e.target.value;
            saveAll();
            renderModal({ preserveBodyScroll: true });
            renderSubModal();
        });
        subDlg.querySelector('#pcx-sub-transport')?.addEventListener('change', e => {
            s.aiTransportMode = e.target.value;
            saveAll();
            renderModal({ preserveBodyScroll: true });
            renderSubModal();
        });
        subDlg.querySelector('#pcx-sub-correction')?.addEventListener('input', e => {
            s.presetCorrectionPrompt = e.target.value;
            scheduleSaveAll();
        });
        subDlg.querySelectorAll('[data-pick-theme]').forEach(btn => btn.addEventListener('click', () => {
            s.theme = btn.dataset.pickTheme;
            applyThemeClasses();
            saveAll();
            renderModal({ preserveBodyScroll: true });
            renderSubModal();
        }));
        subDlg.querySelector('#pcx-sub-tips-sw')?.addEventListener('click', () => {
            s.showTooltips = s.showTooltips === false;
            uiState.openTipId = null;
            const chk = document.getElementById('pcx-drawer-tips-chk');
            if (chk) chk.checked = s.showTooltips;
            applyThemeClasses();
            saveAll();
            renderModal({ preserveBodyScroll: true });
            renderSubModal();
        });
        subDlg.querySelector('#pcx-sub-open-diag')?.addEventListener('click', () => openSubModal('diagnostics'));
        subDlg.querySelector('#pcx-sub-open-guide')?.addEventListener('click', () => openSubModal('guide'));
        subDlg.querySelector('#pcx-sub-reset-defaults')?.addEventListener('click', () => {
            const msg = tUi(
                uiLang,
                'Сбросить тему, системные промпты и настройки расширения по умолчанию? (Ваши заметки и книги не пострадают.)',
                'Reset extension theme, prompts, and settings to defaults? (Your saved notes and Lorebooks stay untouched.)',
            );
            if (!window.confirm(msg)) return;
            const savedGlobalData = s.globalData ? JSON.parse(JSON.stringify(s.globalData)) : JSON.parse(JSON.stringify(DEFAULT_SETTINGS.globalData));
            const savedCover = s.globalNotebookCover || '';
            const fresh = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            fresh.globalData = normalizeStore(savedGlobalData);
            fresh.globalNotebookCover = savedCover;
            stApi.extensionSettings[MODULE_NAME] = fresh;
            applyThemeClasses();
            saveAll();
            renderModal();
            renderSubModal();
        });
        return;
    }

    // 2. CALM STEP-BY-STEP GUIDE MODAL ("ВЕДЁТ ЗА РУЧКУ", ZERO VISUAL CLUTTER!)
    if (uiState.subModal === 'guide') {
        subDlg.innerHTML = `
            <div class="pcx-dlg-head">
                <div>
                    <h2>${tUi(uiLang, 'Путеводитель по Pocket Codex & Forge', 'Pocket Codex & Forge Step-by-Step Guide')}</h2>
                    <small>${tUi(uiLang, 'Спокойная пошаговая памятка: как устроен порядок записей и как всё работает вместе.', 'Calm step-by-step walkthrough of Notebook layers, Lorebooks, and Memory Books.')}</small>
                </div>
                <button type="button" class="pcx-sq-top-btn pcx-icon-only" data-close-sub="1">${ICONS.close}</button>
            </div>
            <div class="pcx-dlg-body">
                <details class="pcx-spoiler" open>
                    <summary>
                        <span>${tUi(uiLang, '1. Порядок работы и расположение слоёв в Заметках (Тетради)', '1. How Order & Layers Work in Author Notebooks')}</span>
                        ${ICONS.chevDown}
                    </summary>
                    <div class="pcx-spoiler-body">
                        <p>${tUi(
                            uiLang,
                            'На полке вас ждут две Тетради с обложками: «Тетрадь этого чата» (хранит заметки строго для текущего героя) и «Общая тетрадь автора» (ваши любимые сквозные правила для всех ролевых сразу — переключатель на её обложке включает или выключает подмес в чаты).',
                            'On the Notebook Shelf you have two covered volumes: "This Chat Notebook" (for the active character only) and "Global Author Notebook" (cross-chat rules toggled directly on its cover).',
                        )}</p>
                        <p>${tUi(
                            uiLang,
                            'Как собирается порядок отправки в нейросеть: сначала идут включённые разделы в том порядке, как они стоят слева направо в верхней полосе вкладок, а внутри каждого раздела карточки склеиваются сверху вниз (порядок меняется перетаскиванием за ручку «⋮⋮» слева).',
                            'Prompt order: enabled sections assemble from left to right matching the section carousel, and cards inside each section assemble from top to bottom (drag the "⋮⋮" handle to reorder).',
                        )}</p>
                        <p>${tUi(
                            uiLang,
                            'Куда лучше направлять разделы: свежую сцену, одежду и режиссуру ставьте на @ Depth 1–2 (прямо перед ответом модели); отношения и сюжет — на @ Depth 4–8; постоянные правила мира — «До промпта чара» или в макрос {{notebook}}; а личные наброски — в «Никуда (черновик)».',
                            'Recommended routing: put immediate scene/outfit notes at @ Depth 1–2; ongoing plot & relationships at @ Depth 4–8; world rules Before Char or in {{notebook}}; personal ideas in Private Draft.',
                        )}</p>
                        <div class="pcx-sample-card">
                            <strong>${tUi(uiLang, 'Образец записи в Тетради (Раздел «Режиссура сцены» · @ Depth 2 · System):', 'Sample Notebook Card ("Scene Direction" · @ Depth 2 · System):')}</strong>
                            <span class="pcx-muted">${tUi(
                                uiLang,
                                '[Камертон сцены]\nПоздний дождливый вечер в купе первого класса. Держи спокойный книжный темп без резких скачков времени.\n\nВиктор скрывает письмо ревизора во внутреннем кармане пальто и настороженно реагирует на упоминание станции Вербовая.',
                                '[Scene Tone]\nLate rainy evening in a first-class train compartment. Keep a measured literary pace without skipping time.\n\nVictor hides the inspector letter in his coat pocket and reacts guardedly whenever Willow Station is mentioned.',
                            )}</span>
                        </div>
                    </div>
                </details>

                <details class="pcx-spoiler">
                    <summary>
                        <span>${tUi(uiLang, '2. Кузница Лорбуков и пошаговая работа с Memory Books', '2. Lorebook Forge & Step-by-Step Memory Books Workflow')}</span>
                        ${ICONS.chevDown}
                    </summary>
                    <div class="pcx-spoiler-body">
                        <p>${tUi(
                            uiLang,
                            'В Кузнице каждый том можно независимо подключить кнопками на обложке: «Чат» (привязывает к текущему диалогу сразу сколько угодно книг!), «Глоб.» (на всю Таверну) и «Чар» (основной лорбук героя). Внутри книги порядок страниц также перетаскивается за ручку «⋮⋮», меняя приоритет вставки.',
                            'In the Forge, each tome has 3 independent scope buttons on its cover: Chat (bind multiple books to one chat), Global, and Char. Inside any tome, drag pages by "⋮⋮" to adjust insertion priority.',
                        )}</p>
                        <p>${tUi(
                            uiLang,
                            'Как удобно вести ролевую с Memory Books: создайте в Кузнице отдельный пустой том (например, «Память чата») и нажмите на нём плашку «Memory Books». Тогда основной лор мира останется чистым во второй книге чата, а авто-воспоминания Memory Books будут аккуратно складываться в выделенный том без каши.',
                            'Clean Memory Books setup: create a dedicated blank tome (e.g. "Chat Memories") and tap its "Memory Books" button. World lore stays clean in your main lorebook while auto-memories save neatly into the dedicated volume.',
                        )}</p>
                        <p>${tUi(
                            uiLang,
                            'Если расширение Memory Books у вас НЕ установлено — ничего настраивать не нужно: Pocket Codex автоматически скрывает все плашки и фильтры Memory Books, оставляя чистую классическую Полку из 3 кнопок привязки.',
                            'If Memory Books is NOT installed, Pocket Codex automatically hides all Memory Books indicators and buttons so nothing clutters your shelf.',
                        )}</p>
                        <div class="pcx-sample-card">
                            <strong>${tUi(uiLang, 'Образец записи памяти в томе для Memory Books (По ключам · Стоп-рек. включён):', 'Sample Memory Entry in a Memory Books Tome (Keyword · No-Recursion ON):')}</strong>
                            <span class="pcx-muted">${tUi(
                                uiLang,
                                'Заголовок: Договор на Северном вокзале (Эпизод 3)\nКлючи: северный вокзал, латунный жетон, клятва виктора\nТекст: На перроне Северного вокзала Виктор передал свой служебный латунный жетон и пообещал уничтожить архивную ведомость в обмен на молчание о пассажире купе №4.',
                                'Title: North Station Pact (Episode 3)\nKeys: north station, brass token, victor oath\nContent: On the North Station platform, Victor handed over his brass token and promised to burn the ledger in exchange for silence about compartment #4.',
                            )}</span>
                        </div>
                    </div>
                </details>

                <details class="pcx-spoiler">
                    <summary>
                        <span>${tUi(uiLang, '3. Соавтор ИИ, свои пресеты (+ Свой) и защита пресета Таверны', '3. AI Co-Author, Custom Presets & Tavern Preset Fidelity')}</span>
                        ${ICONS.chevDown}
                    </summary>
                    <div class="pcx-spoiler-body">
                        <p>${tUi(
                            uiLang,
                            'В Соавторе Тетради и в Кузнице доступны по 8 готовых шаблонов, а кнопкой «+ Свой» можно сохранить любое количество собственных пресетов со своими правилами.',
                            'Both Notebook Co-Author and Lorebook Forge include 8 built-in presets plus "+ Custom" to save your own reusable prompt templates.',
                        )}</p>
                        <p>${tUi(
                            uiLang,
                            'В окне « Настройки» можно выбрать отправку «Через активный пресет Таверны» (передаёт ваш боевой пресет со всеми блоками assistant и пустыми тоглами "\\n", что идеально для прокси) или «Прямой запрос (JSON-схема)». Проверить отправленный запрос всегда можно кнопкой «Последний запрос ИИ».',
                            'In Settings (gear icon), switch anytime between "Through Active Tavern Preset" (preserving assistant blocks & "\\n" toggles) and "Direct JSON Schema", and verify exact blocks in "Last AI Request".',
                        )}</p>
                    </div>
                </details>
            </div>
            <div class="pcx-dlg-foot">
                <span></span>
                <button type="button" class="pcx-btn pcx-btn-primary" data-close-sub="1">${tUi(uiLang, 'Всё понятно', 'Got It')}</button>
            </div>
        `;
        subDlg.querySelectorAll('[data-close-sub]').forEach(b => b.addEventListener('click', closeSubModal));
        return;
    }

    // 3. PROMPT LAYER MAP MODAL
    if (uiState.subModal === 'layers') {
        const macroPreview = buildMacroNotebookText();
        const autoGroups = buildAutoInjectGroups(true);
        const roleLabels = { 0: 'System', 1: 'User', 2: 'Assistant' };
        subDlg.innerHTML = `
            <div class="pcx-dlg-head">
                <div>
                    <h2>${tUi(uiLang, 'Карта всех слоёв промпта', 'Prompt Layer Map')}</h2>
                    <small>${tUi(uiLang, 'Наглядная раскладка: куда именно падает каждый ваш раздел Тетради и макрос {{notebook}}.', 'Live overview of every Notebook section route and {{notebook}} macro output.')}</small>
                </div>
                <button type="button" class="pcx-sq-top-btn pcx-icon-only" data-close-sub="1">${ICONS.close}</button>
            </div>
            <div class="pcx-dlg-body">
                <div class="pcx-actions pcx-between pcx-surface" style="padding:10px 12px;background:var(--paper);">
                    <div>
                        <strong style="font-size:0.84rem;display:block;">${tUi(uiLang, 'Держать «Общую тетрадь» включённой внутри чатов', 'Keep Global Notebook Active Inside Chats')}</strong>
                        <small>${tUi(uiLang, 'Сквозные заметки из Общей тетради работают параллельно с Тетрадью открытого чата', 'Global rules inject alongside the active character Notebook')}</small>
                    </div>
                    <button type="button" class="pcx-sq-switch" id="pcx-lay-glob-sw" role="switch" aria-checked="${Boolean(s.includeGlobalWithChat)}"><span></span></button>
                </div>

                <div class="pcx-chain-step">
                    <div class="pcx-actions pcx-between">
                        <strong>Макрос <code>{{notebook}}</code></strong>
                        <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-copy-macro-btn">${ICONS.copy}<span>{{notebook}}</span></button>
                    </div>
                    <pre style="margin:4px 0 0;padding:9px 10px;border-radius:7px;background:var(--panel);border:1px solid var(--line);font-family:var(--mono);font-size:0.76rem;white-space:pre-wrap;max-height:140px;overflow-y:auto;">${escapeHtml(macroPreview || tUi(uiLang, '(Нет активных карточек со статусом «В макрос»)', '(No active cards routed to {{notebook}})'))}</pre>
                </div>

                ${autoGroups.length === 0
                    ? `<div class="pcx-guide-note">${tUi(uiLang, 'Сейчас нет активных карточек на автоматической отправке в промпт.', 'No active cards are currently auto-injected into the prompt.')}</div>`
                    : autoGroups.map(g => {
                        const where = g.pos === ST_POS.BEFORE_MAIN
                            ? `${tUi(uiLang, 'До промпта чара', 'Before Char')} · ${roleLabels[g.role]}`
                            : (g.pos === ST_POS.AFTER_MAIN
                                ? `${tUi(uiLang, 'После промпта чара', 'After Char')} · ${roleLabels[g.role]}`
                                : `@ Depth ${g.depth} · ${roleLabels[g.role]}`);
                        return `
                            <div class="pcx-chain-step">
                                <div class="pcx-actions pcx-between">
                                    <strong>${escapeHtml(g.sectionNames.join(' + '))}</strong>
                                    <span class="pcx-status-badge">${escapeHtml(where)}</span>
                                </div>
                                <pre style="margin:4px 0 0;padding:9px 10px;border-radius:7px;background:var(--panel);border:1px solid var(--line);font-family:var(--mono);font-size:0.76rem;white-space:pre-wrap;max-height:160px;overflow-y:auto;">${escapeHtml(g.combinedText)}</pre>
                            </div>
                        `;
                    }).join('')}
            </div>
            <div class="pcx-dlg-foot">
                <span></span>
                <button type="button" class="pcx-btn pcx-btn-primary" data-close-sub="1">${tUi(uiLang, 'Закрыть карту', 'Close Map')}</button>
            </div>
        `;
        subDlg.querySelectorAll('[data-close-sub]').forEach(b => b.addEventListener('click', closeSubModal));
        subDlg.querySelector('#pcx-lay-glob-sw')?.addEventListener('click', () => {
            s.includeGlobalWithChat = !s.includeGlobalWithChat;
            saveAll();
            renderModal({ preserveBodyScroll: true });
            renderSubModal();
        });
        subDlg.querySelector('#pcx-copy-macro-btn')?.addEventListener('click', e => {
            navigator.clipboard?.writeText('{{notebook}}');
            const btn = e.currentTarget;
            btn.innerHTML = `${ICONS.check}<span>Скопировано</span>`;
            setTimeout(() => { if (btn.isConnected) btn.innerHTML = `${ICONS.copy}<span>{{notebook}}</span>`; }, 1100);
        });
        return;
    }

    // 4. SECTION ROUTE & HEADER MODAL (1:1 Concept openSectionRouteModal!)
    if (uiState.subModal === 'section' && uiState.secDraft) {
        const d = uiState.secDraft;
        const hideDepthRow = (Number(d.injectPos) === ST_POS.MACRO_ONLY || Number(d.injectPos) === ST_POS.LOCAL_ONLY);
        subDlg.innerHTML = `
            <div class="pcx-dlg-head">
                <div>
                    <h2>${uiState.secModalMode === 'create' ? tUi(uiLang, 'Новый раздел Тетради', 'New Notebook Section') : tUi(uiLang, 'Индивидуальный маршрут раздела', 'Section Route & Header')}</h2>
                    <small>${tUi(uiLang, 'Каждый раздел Тетради падает в свою собственную точку промпта независимо от соседних вкладок.', 'Every Notebook section routes to its own prompt layer independently.')}</small>
                </div>
                <button type="button" class="pcx-sq-top-btn pcx-icon-only" data-close-sub="1">${ICONS.close}</button>
            </div>
            <div class="pcx-dlg-body">
                <div class="pcx-pair">
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Название раздела', 'Section Name')}</span>
                        <input type="text" id="pcx-sec-name" class="pcx-input" placeholder="${tUi(uiLang, 'Например: Улики и Тайны', 'e.g. Clues & Secrets')}" value="${escapeHtml(d.name || '')}">
                    </label>
                    <div class="pcx-actions pcx-between pcx-surface" style="padding:9px 12px;align-self:end;background:var(--paper);">
                        <span style="font-size:0.84rem;font-weight:650;">${tUi(uiLang, 'Раздел включён', 'Section Enabled')}</span>
                        <button type="button" class="pcx-sq-switch" id="pcx-sec-en" role="switch" aria-checked="${d.enabled !== false}"><span></span></button>
                    </div>
                </div>

                <label class="pcx-field">
                    <span>${tUi(uiLang, 'Куда отправлять этот раздел?', 'Destination Layer')}</span>
                    <select id="pcx-sec-pos" class="pcx-input">
                        <option value="${ST_POS.IN_CHAT}" ${Number(d.injectPos) === ST_POS.IN_CHAT ? 'selected' : ''}>${tUi(uiLang, '@ Depth — Вглубь истории чата', '@ Depth — Inside Chat History')}</option>
                        <option value="${ST_POS.BEFORE_MAIN}" ${Number(d.injectPos) === ST_POS.BEFORE_MAIN ? 'selected' : ''}>${tUi(uiLang, 'До основного промпта персонажа', 'Before Character Prompt')}</option>
                        <option value="${ST_POS.AFTER_MAIN}" ${Number(d.injectPos) === ST_POS.AFTER_MAIN ? 'selected' : ''}>${tUi(uiLang, 'После основного промпта персонажа', 'After Character Prompt')}</option>
                        <option value="${ST_POS.MACRO_ONLY}" ${Number(d.injectPos) === ST_POS.MACRO_ONLY ? 'selected' : ''}>${tUi(uiLang, 'Только по макросу {{notebook}}', 'Only via {{notebook}} Macro')}</option>
                        <option value="${ST_POS.LOCAL_ONLY}" ${Number(d.injectPos) === ST_POS.LOCAL_ONLY ? 'selected' : ''}>${tUi(uiLang, 'Никуда (личная черновая вкладка)', 'Nowhere (Private Scratchpad)')}</option>
                    </select>
                </label>

                <div class="pcx-row-3" id="pcx-sec-depth-wrap" ${hideDepthRow ? 'hidden' : ''}>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Глубина (@ Depth)', 'Depth')}</span>
                        <input type="number" id="pcx-sec-depth" class="pcx-input" min="0" max="999" value="${Math.max(0, Number(d.injectDepth) || 0)}">
                    </label>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Роль блока', 'Message Role')}</span>
                        <select id="pcx-sec-role" class="pcx-input">
                            <option value="0" ${Number(d.injectRole) === 0 ? 'selected' : ''}>System</option>
                            <option value="1" ${Number(d.injectRole) === 1 ? 'selected' : ''}>User</option>
                            <option value="2" ${Number(d.injectRole) === 2 ? 'selected' : ''}>Assistant</option>
                        </select>
                    </label>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Интервал (N ход)', 'Interval')}</span>
                        <input type="number" id="pcx-sec-intv" class="pcx-input" min="1" max="50" value="${Math.max(1, Number(d.injectInterval) || 1)}">
                    </label>
                </div>

                <div class="pcx-pair">
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Режим шапки раздела (4 варианта)', 'Header Mode')}</span>
                        <select id="pcx-sec-hmode" class="pcx-input">
                            <option value="sec_and_custom_notes" ${d.headerMode === 'sec_and_custom_notes' ? 'selected' : ''}>${describeHeaderModeLabel('sec_and_custom_notes', uiLang)}</option>
                            <option value="sec_and_auto_notes" ${d.headerMode === 'sec_and_auto_notes' ? 'selected' : ''}>${describeHeaderModeLabel('sec_and_auto_notes', uiLang)}</option>
                            <option value="only_notes" ${d.headerMode === 'only_notes' ? 'selected' : ''}>${describeHeaderModeLabel('only_notes', uiLang)}</option>
                            <option value="none" ${d.headerMode === 'none' ? 'selected' : ''}>${describeHeaderModeLabel('none', uiLang)}</option>
                        </select>
                    </label>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Стиль подзаголовков (4 варианта)', 'Subheader Style')}</span>
                        <select id="pcx-sec-sstyle" class="pcx-input">
                            <option value="h4_blank" ${d.subHeaderStyle === 'h4_blank' ? 'selected' : ''}>#### Подзаголовок + пустая строка</option>
                            <option value="bracket_blank" ${d.subHeaderStyle === 'bracket_blank' ? 'selected' : ''}>[Подзаголовок] + пустая строка</option>
                            <option value="colon_blank" ${d.subHeaderStyle === 'colon_blank' ? 'selected' : ''}>Подзаголовок: + пустая строка</option>
                            <option value="h4_line" ${d.subHeaderStyle === 'h4_line' ? 'selected' : ''}>#### Подзаголовок + перенос строки</option>
                        </select>
                    </label>
                </div>

                <pre id="pcx-sec-live-prev" style="margin:0;padding:11px 12px;border-radius:8px;background:var(--paper);border:1px solid var(--line);font-family:var(--mono);font-size:0.77rem;white-space:pre-wrap;line-height:1.45;">${escapeHtml(buildSectionHeaderLivePreview(d))}</pre>
            </div>
            <div class="pcx-dlg-foot">
                ${uiState.secModalMode === 'edit' && store.categories.length > 1
                    ? `<button type="button" class="pcx-btn pcx-btn-sm pcx-btn-danger-ghost" id="pcx-sec-del">${tUi(uiLang, 'Удалить раздел', 'Delete Section')}</button>`
                    : '<span></span>'}
                <div class="pcx-actions">
                    <button type="button" class="pcx-btn pcx-btn-secondary" data-close-sub="1">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                    <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-sec-save">${tUi(uiLang, 'Сохранить маршрут', 'Save Route')}</button>
                </div>
            </div>
        `;

        const syncDraftAndPreview = () => {
            d.name = subDlg.querySelector('#pcx-sec-name').value;
            d.injectPos = Number(subDlg.querySelector('#pcx-sec-pos').value);
            const dv = Number(subDlg.querySelector('#pcx-sec-depth').value);
            d.injectDepth = Number.isNaN(dv) ? 0 : Math.max(0, dv);
            d.injectRole = Number(subDlg.querySelector('#pcx-sec-role').value) || 0;
            d.injectInterval = Math.max(1, Number(subDlg.querySelector('#pcx-sec-intv').value) || 1);
            d.headerMode = subDlg.querySelector('#pcx-sec-hmode').value;
            d.subHeaderStyle = subDlg.querySelector('#pcx-sec-sstyle').value;
            d.showHeader = (d.headerMode === 'sec_and_auto_notes' || d.headerMode === 'sec_and_custom_notes');
            const wrap = subDlg.querySelector('#pcx-sec-depth-wrap');
            if (wrap) wrap.hidden = (d.injectPos === ST_POS.MACRO_ONLY || d.injectPos === ST_POS.LOCAL_ONLY);
            const prev = subDlg.querySelector('#pcx-sec-live-prev');
            if (prev) prev.textContent = buildSectionHeaderLivePreview(d);
        };

        subDlg.querySelectorAll('input, select').forEach(el => el.addEventListener('input', syncDraftAndPreview));
        subDlg.querySelector('#pcx-sec-en')?.addEventListener('click', e => {
            d.enabled = d.enabled === false;
            e.currentTarget.setAttribute('aria-checked', String(d.enabled));
        });
        subDlg.querySelectorAll('[data-close-sub]').forEach(b => b.addEventListener('click', closeSubModal));
        subDlg.querySelector('#pcx-sec-del')?.addEventListener('click', () => {
            const target = store.categories.find(c => c.id === uiState.secModalCatId);
            if (!target || store.categories.length <= 1) return;
            if (!window.confirm(tUi(uiLang, `Удалить раздел «${target.name}» и его карточки?`, `Delete section "${target.name}" and its cards?`))) return;
            store.notes = store.notes.filter(n => n.categoryId !== target.id);
            store.categories = store.categories.filter(c => c.id !== target.id);
            s.activeTab = store.categories[0].id;
            saveAll();
            closeSubModal();
            renderModal({ preserveBodyScroll: true });
        });
        subDlg.querySelector('#pcx-sec-save')?.addEventListener('click', () => {
            syncDraftAndPreview();
            const cleanName = (d.name || '').trim();
            if (!cleanName) { window.alert(tUi(uiLang, 'Введите название раздела.', 'Enter a section name.')); return; }
            if (uiState.secModalMode === 'create') {
                const newId = 'cat_' + Date.now();
                store.categories.push({ ...d, id: newId, name: cleanName });
                s.activeTab = newId;
            } else {
                const target = store.categories.find(c => c.id === uiState.secModalCatId);
                if (target) Object.assign(target, { ...d, id: target.id, name: cleanName });
            }
            saveAll();
            closeSubModal();
            renderModal({ preserveBodyScroll: true });
        });
        return;
    }

    // 5. LAST AI REQUEST DIAGNOSTICS MODAL (PROVES ASSISTANT ROLES & "\n" TOGGLES!)
    if (uiState.subModal === 'diagnostics') {
        const dg = lastPcxAiDiagnostics;
        subDlg.innerHTML = `
            <div class="pcx-dlg-head">
                <div>
                    <h2>${tUi(uiLang, 'Последний запрос расширения к ИИ', 'Last AI Request Inspector')}</h2>
                    <small>${escapeHtml(dg.status)} · ${escapeHtml(dg.profileLabel)}</small>
                </div>
                <button type="button" class="pcx-sq-top-btn pcx-icon-only" data-close-sub="1">${ICONS.close}</button>
            </div>
            <div class="pcx-dlg-body">
                <div class="pcx-actions">
                    <span class="pcx-status-badge">${dg.transportMode === 'preset' ? tUi(uiLang, 'Через пресет Таверны', 'Tavern Preset Mode') : tUi(uiLang, 'Прямой JSON-запрос', 'Direct JSON Mode')}</span>
                    ${dg.transportMode === 'preset' ? `
                        <span class="pcx-key-badge">assistant: ${dg.assistantBlocksCount}</span>
                        <span class="pcx-key-badge">\\n toggles: ${dg.whitespaceTogglesCount}</span>
                    ` : ''}
                </div>

                ${dg.presetTrace.length > 0 ? `
                    <details class="pcx-spoiler" open>
                        <summary><span>${tUi(uiLang, `Карта отправленных модулей пресета (${dg.presetTrace.length})`, `Sent Preset Blocks (${dg.presetTrace.length})`)}</span>${ICONS.chevDown}</summary>
                        <div class="pcx-spoiler-body">
                            ${dg.presetTrace.map((t, idx) => `
                                <div class="pcx-chain-step">
                                    <div class="pcx-actions pcx-between">
                                        <strong>#${idx + 1} · ${escapeHtml(t.label)}</strong>
                                        <span class="pcx-key-badge">${escapeHtml(t.role)} · ${t.chars} симв.</span>
                                    </div>
                                    <small>${escapeHtml(t.preview)}</small>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : ''}

                ${dg.systemPrompt ? `
                    <details class="pcx-spoiler">
                        <summary><span>System Prompt расширения</span>${ICONS.chevDown}</summary>
                        <div class="pcx-spoiler-body"><pre style="margin:0;white-space:pre-wrap;font-family:var(--mono);font-size:0.76rem;">${escapeHtml(dg.systemPrompt)}</pre></div>
                    </details>
                ` : ''}

                ${dg.userPrompt ? `
                    <details class="pcx-spoiler">
                        <summary><span>User Task (задание + контекст)</span>${ICONS.chevDown}</summary>
                        <div class="pcx-spoiler-body"><pre style="margin:0;white-space:pre-wrap;font-family:var(--mono);font-size:0.76rem;max-height:200px;overflow-y:auto;">${escapeHtml(dg.userPrompt)}</pre></div>
                    </details>
                ` : ''}

                ${dg.responsePreview ? `
                    <details class="pcx-spoiler">
                        <summary><span>Ответ модели</span>${ICONS.chevDown}</summary>
                        <div class="pcx-spoiler-body"><pre style="margin:0;white-space:pre-wrap;font-family:var(--mono);font-size:0.76rem;max-height:200px;overflow-y:auto;">${escapeHtml(dg.responsePreview)}</pre></div>
                    </details>
                ` : ''}
            </div>
            <div class="pcx-dlg-foot">
                <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-diag-back-settings">${tUi(uiLang, 'К настройкам', 'Back to Settings')}</button>
                <button type="button" class="pcx-btn pcx-btn-primary" data-close-sub="1">${tUi(uiLang, 'Закрыть', 'Close')}</button>
            </div>
        `;
        subDlg.querySelectorAll('[data-close-sub]').forEach(b => b.addEventListener('click', closeSubModal));
        subDlg.querySelector('#pcx-diag-back-settings')?.addEventListener('click', () => openSubModal('settings'));
    }
}

// ==================== MAIN VIEWS: HOME, CODEX (SHELF + LIST + EDITOR), FORGE ====================
function renderHomeView(s, store, uiLang, chatOpen) {
    forgeCtrl?.ensureBooksLoadedQuietly?.();
    const chatBooks = stApi.getChatLorebooks();
    const shelfSnap = forgeCtrl?.getShelfSnapshot?.() || [];
    const activeNotesCnt = countAllPromptActiveNotes();
    const mbInfo = stApi.getMemoryBooksStatus();

    const chatName = getActiveChatDisplayName(uiLang);
    const chatStore = getChatStore();
    const nbNotesCount = chatOpen && chatStore ? chatStore.notes.length : s.globalData.notes.length;
    const nbSecsCount = chatOpen && chatStore ? chatStore.categories.length : s.globalData.categories.length;
    const nbTitle = chatOpen ? `${tUi(uiLang, 'Тетрадь:', 'Notebook:')} ${chatName}` : tUi(uiLang, 'Общая тетрадь автора', 'Global Author Notebook');

    const primaryBookId = chatBooks[0] || stApi.getCharLorebook() || stApi.getGlobalLorebooks()[0] || shelfSnap[0]?.id || '';
    const primaryBookMeta = shelfSnap.find(b => b.id === primaryBookId) || (primaryBookId ? { id: primaryBookId, name: primaryBookId, cover: '', count: undefined } : null);

    // Memory Books pill is STRICTLY hidden if Memory Books is NOT installed!
    const mbPillHtml = !mbInfo.installed ? '' : `
        <button type="button" class="pcx-live-pill" data-home-go="forge">
            ${ICONS.memory}
            <span><strong>Memory Books:</strong> ${!mbInfo.enabled
                ? tUi(uiLang, 'выключен в Таверне', 'disabled in ST')
                : (!chatOpen
                    ? tUi(uiLang, 'откройте чат', 'open a chat')
                    : (mbInfo.targetBook
                        ? `«${escapeHtml(mbInfo.targetBook)}»`
                        : tUi(uiLang, 'том не выбран', 'no tome assigned')))}</span>
        </button>`;

    return `
        <div class="pcx-status-strip">
            <button type="button" class="pcx-live-pill" data-open-layers="1">
                <span class="pcx-live-dot"></span>
                <span>${tUi(
                    uiLang,
                    `В сцене: ${activeNotesCnt} зап. Тетради · Книг в чате: ${chatBooks.length}`,
                    `Active: ${activeNotesCnt} Notebook notes · Bound Lorebooks: ${chatBooks.length}`,
                )}</span>
            </button>
            ${mbPillHtml}
        </div>

        <div class="pcx-page-head">
            <div>
                <h1>${tUi(uiLang, 'Тетрадь автора и Кузница миров', "Author's Notebook & Lorebook Forge")}</h1>
                <p>${tUi(
                    uiLang,
                    'Каждый раздел Тетради падает на свою глубину промпта, а Кузница позволяет ковать целые Лорбуки и отдельные страницы вручную или вместе с Соавтором ИИ.',
                    'Every Notebook section routes to its own prompt layer, while the Forge crafts full Lorebooks and individual pages manually or with AI Co-Author.',
                )}</p>
            </div>
        </div>

        <div class="pcx-home-grid">
            <div class="pcx-stack">
                <div class="pcx-section-label">${tUi(uiLang, 'Инструменты расширения', 'Workspaces')}</div>
                <div class="pcx-mode-list">
                    <button type="button" class="pcx-mode-row" data-home-go="codex_shelf">
                        <span class="pcx-icon-tile">${ICONS.book}</span>
                        <span class="pcx-row-copy">
                            <strong>${tUi(uiLang, 'Тетради автора (Полка с обложками)', 'Author Notebooks (Covered Shelf)')}</strong>
                            <small>${tUi(
                                uiLang,
                                `Тетрадь открытого чата и Общая тетрадь со сменными обложками · ${store.categories.length} разд.`,
                                `Chat Notebook & Global Notebook with custom covers · ${store.categories.length} sections`,
                            )}</small>
                        </span>
                        ${ICONS.chevRight}
                    </button>

                    <button type="button" class="pcx-mode-row" data-home-go="coauthor">
                        <span class="pcx-icon-tile pcx-warm">${ICONS.spark}</span>
                        <span class="pcx-row-copy">
                            <strong>${tUi(uiLang, 'Соавтор ИИ для заметок', 'AI Co-Author for Notes')}</strong>
                            <small>${tUi(
                                uiLang,
                                '8 готовых пресетов + сохранение своих шаблонов, работа через активный пресет Таверны и доработка черновиков',
                                '8 built-in presets + save your own custom presets, active Tavern preset mode & draft refinement',
                            )}</small>
                        </span>
                        ${ICONS.chevRight}
                    </button>

                    <button type="button" class="pcx-mode-row" data-home-go="forge">
                        <span class="pcx-icon-tile pcx-warm">${ICONS.shelf}</span>
                        <span class="pcx-row-copy">
                            <strong>${tUi(uiLang, 'Полка Кузницы Лорбуков', 'Lorebook Forge Shelf')}</strong>
                            <small>${tUi(
                                uiLang,
                                'Арт-обложки, привязка Чат / Глобально / Персонаж, перетаскивание страниц и Инспектор рекурсии',
                                'Cover art, Chat / Global / Character bindings, page drag-and-drop & Recursion Inspector',
                            )}</small>
                        </span>
                        ${ICONS.chevRight}
                    </button>

                    <button type="button" class="pcx-mode-row" data-home-go="forge_hub">
                        <span class="pcx-icon-tile">${ICONS.forge}</span>
                        <span class="pcx-row-copy">
                            <strong>${tUi(uiLang, 'Мастер Ковки Лорбука или страницы', 'Forge New Lorebook or Page')}</strong>
                            <small>${tUi(
                                uiLang,
                                'Целый том с ИИ, перенос разделов из Тетради, «мой текст дословно + ключи от ИИ» или чистая ручная сборка',
                                'Full AI Lorebook, transfer Notebook sections, Verbatim Text + AI Keys, or manual tome creation',
                            )}</small>
                        </span>
                        ${ICONS.chevRight}
                    </button>
                </div>
            </div>

            <div class="pcx-stack">
                <div class="pcx-section-label">${tUi(uiLang, 'Активные тома сейчас', 'Active Volumes')}</div>

                <div class="pcx-session-card">
                    <div class="pcx-book-spine-art" data-home-go="codex_open_active">
                        ${renderNotebookCoverGraphic({ scope: chatOpen ? 'chat' : 'global', title: chatOpen ? chatName : 'Global', count: nbNotesCount, uiLang })}
                    </div>
                    <div class="pcx-session-card-body">
                        <span class="pcx-status-badge">${chatOpen ? tUi(uiLang, 'Тетрадь чата', 'Chat Notebook') : tUi(uiLang, 'Общая тетрадь', 'Global Notebook')}</span>
                        <h2>${escapeHtml(nbTitle)}</h2>
                        <small>${tUi(uiLang, `Карточек: ${nbNotesCount} · Разделов: ${nbSecsCount}`, `Cards: ${nbNotesCount} · Sections: ${nbSecsCount}`)}</small>
                        <div class="pcx-actions" style="margin-top:4px;">
                            <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary" data-home-go="codex_open_active">${tUi(uiLang, 'В тетрадь', 'Open Notebook')}</button>
                            <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-soft" data-home-go="codex_shelf">${tUi(uiLang, 'Обложки', 'Covers')}</button>
                        </div>
                    </div>
                </div>

                ${primaryBookMeta ? `
                    <div class="pcx-session-card">
                        <div class="pcx-book-spine-art" data-home-open-book="${escapeHtml(primaryBookMeta.id)}">
                            ${primaryBookMeta.cover
                                ? `<img src="${escapeHtml(toBlobDisplayUrl(primaryBookMeta.cover))}" alt="${escapeHtml(primaryBookMeta.name)}">`
                                : renderProceduralCoverSvg({ title: primaryBookMeta.name, subtitle: 'FORGE', countLabel: primaryBookMeta.count !== undefined ? `${primaryBookMeta.count} PAGES` : '', seed: primaryBookMeta.id })}
                        </div>
                        <div class="pcx-session-card-body">
                            <span class="pcx-status-badge pcx-warm">${chatBooks.includes(primaryBookMeta.id) ? tUi(uiLang, 'Активен в чате', 'Bound to Chat') : tUi(uiLang, 'На полке Кузницы', 'On Forge Shelf')}</span>
                            <h2>${escapeHtml(primaryBookMeta.name)}</h2>
                            <small>${chatBooks.length > 1
                                ? tUi(uiLang, `Ещё привязано в чат: ${chatBooks.length - 1} кн.`, `Extra bound in chat: ${chatBooks.length - 1}`)
                                : (primaryBookMeta.count !== undefined ? tUi(uiLang, `Страниц в томе: ${primaryBookMeta.count}`, `Pages: ${primaryBookMeta.count}`) : tUi(uiLang, 'Готов к открытию', 'Ready to open'))}</small>
                            <div class="pcx-actions" style="margin-top:4px;">
                                <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary" data-home-open-book="${escapeHtml(primaryBookMeta.id)}">${tUi(uiLang, 'В книгу', 'Open Book')}</button>
                                <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-soft" data-home-open-rec="${escapeHtml(primaryBookMeta.id)}">${tUi(uiLang, 'Рекурсия', 'Recursion')}</button>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <details class="pcx-spoiler" ${store.categories.length <= 4 ? 'open' : ''}>
                    <summary>
                        <span>${tUi(uiLang, `Маршруты разделов Тетради (${store.categories.length})`, `Notebook Section Routes (${store.categories.length})`)}</span>
                        ${ICONS.chevDown}
                    </summary>
                    <div class="pcx-spoiler-body">
                        ${store.categories.map(cat => `
                            <div class="pcx-actions pcx-between" style="padding-bottom:6px;border-bottom:1px solid var(--line);">
                                <strong style="font-size:0.84rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(displayCategoryName(cat, uiLang))}</strong>
                                <button type="button" class="pcx-chip ${cat.enabled === false ? 'pcx-off-sec' : ''}" data-edit-sec-modal="${escapeHtml(cat.id)}">${escapeHtml(describeCategoryRouteShort(cat))}</button>
                            </div>
                        `).join('')}
                        <div class="pcx-actions pcx-between" style="padding-top:4px;">
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-open-layers="1">${tUi(uiLang, 'Полная карта слоёв', 'Full Layer Map')}</button>
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-soft" data-add-sec-modal="1">+ ${tUi(uiLang, 'Новый раздел', 'New Section')}</button>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    `;
}

function renderCodexShelfView(s, uiLang, chatOpen) {
    const chatName = getActiveChatDisplayName(uiLang);
    const chatStore = getChatStore();
    const chatNotes = chatStore ? chatStore.notes : [];
    const chatActiveCnt = chatStore
        ? chatStore.notes.filter(n => n.enabled !== false && chatStore.categories.some(c => c.id === n.categoryId && c.enabled !== false && Number(c.injectPos) !== ST_POS.LOCAL_ONLY)).length
        : 0;

    const globStore = s.globalData;
    const globNotes = globStore.notes || [];
    const globActiveCnt = globNotes.filter(n => n.enabled !== false && globStore.categories.some(c => c.id === n.categoryId && c.enabled !== false && Number(c.injectPos) !== ST_POS.LOCAL_ONLY)).length;

    return `
        <div class="pcx-page-head">
            <div>
                <h1>${tUi(uiLang, 'Тетради Автора', "Author's Notebooks")}</h1>
                <p>${tUi(
                    uiLang,
                    'Выберите нужную Тетрадь на полке: заметки не вываливаются кучей, у каждой Тетради своя обложка и свои разделы маршрутизации.',
                    'Choose a Notebook volume below: each Notebook has its own cover art and independent prompt-routed sections.',
                )}</p>
            </div>
            <div class="pcx-actions">
                <button type="button" class="pcx-btn pcx-btn-secondary" data-open-layers="1">${tUi(uiLang, 'Карта слоёв промпта', 'Prompt Layer Map')}</button>
                <button type="button" class="pcx-btn pcx-btn-primary" data-nb-quick-ai="${chatOpen ? 'chat' : 'global'}">+ ${tUi(uiLang, 'Запись с ИИ', 'AI Note')}</button>
            </div>
        </div>

        <div class="pcx-shelf-grid">
            <article class="pcx-book-card ${chatOpen ? 'pcx-bound' : 'pcx-disabled-card'}">
                <div class="pcx-book-cover" ${chatOpen ? 'data-open-nb="chat"' : ''}>
                    ${renderNotebookCoverGraphic({ scope: 'chat', title: chatName, count: chatNotes.length, uiLang })}
                    <div class="pcx-cover-top-bar">
                        <span class="pcx-cover-tag">${chatNotes.length} ${tUi(uiLang, 'зап.', 'notes')}</span>
                        ${chatOpen && chatActiveCnt > 0 ? `<span class="pcx-cover-tag pcx-active-hit">${chatActiveCnt} ${tUi(uiLang, 'в сцене', 'live')}</span>` : ''}
                    </div>
                    ${chatOpen ? `<button type="button" class="pcx-cover-art-btn" data-nb-cover="chat">${tUi(uiLang, 'Обложка', 'Cover')}</button>` : ''}
                </div>
                <div class="pcx-book-meta" ${chatOpen ? 'data-open-nb="chat"' : ''}>
                    <strong>${chatOpen ? `${tUi(uiLang, 'Тетрадь:', 'Notebook:')} ${escapeHtml(chatName)}` : tUi(uiLang, 'Тетрадь чата (чат не открыт)', 'Chat Notebook (no chat open)')}</strong>
                    <small>${chatOpen
                        ? tUi(uiLang, `Только для этого чата · ${chatStore?.categories?.length || 4} разд.`, `Exclusive to this chat · ${chatStore?.categories?.length || 4} sections`)
                        : tUi(uiLang, 'Откройте любой диалог в Таверне, чтобы вести Тетрадь персонажа', 'Open any chat in SillyTavern to use its character Notebook')}</small>
                </div>
                <div class="pcx-bind-strip pcx-single-col">
                    <button type="button" class="pcx-bind-pill ${chatOpen ? 'pcx-on' : ''}" disabled>${chatOpen ? tUi(uiLang, 'Привязана к текущему чату', 'Bound to Active Chat') : tUi(uiLang, 'Ожидает открытия чата', 'Waiting for Chat')}</button>
                </div>
                <div class="pcx-book-foot">
                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary pcx-btn-main-open" data-open-nb="chat" ${!chatOpen ? 'disabled' : ''}>${tUi(uiLang, 'Открыть', 'Open')}</button>
                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-soft" data-nb-quick-ai="chat" ${!chatOpen ? 'disabled' : ''}>+ ИИ</button>
                    ${chatOpen && stApi.chatMetadata?.pcx_notebook_cover ? `<button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" data-nb-reset-cover="chat" title="${tUi(uiLang, 'Вернуть портрет чара / гравюру', 'Reset custom cover')}">${ICONS.reset}</button>` : ''}
                </div>
            </article>

            <article class="pcx-book-card ${s.includeGlobalWithChat ? 'pcx-bound' : ''}">
                <div class="pcx-book-cover" data-open-nb="global">
                    ${renderNotebookCoverGraphic({ scope: 'global', title: uiLang === 'en' ? 'Global Notebook' : 'Общая Тетрадь', count: globNotes.length, uiLang })}
                    <div class="pcx-cover-top-bar">
                        <span class="pcx-cover-tag">${globNotes.length} ${tUi(uiLang, 'зап.', 'notes')}</span>
                        ${s.includeGlobalWithChat && globActiveCnt > 0 ? `<span class="pcx-cover-tag pcx-active-hit">${globActiveCnt} ${tUi(uiLang, 'сквозных', 'global')}</span>` : ''}
                    </div>
                    <button type="button" class="pcx-cover-art-btn" data-nb-cover="global">${tUi(uiLang, 'Обложка', 'Cover')}</button>
                </div>
                <div class="pcx-book-meta" data-open-nb="global">
                    <strong>${tUi(uiLang, 'Общая тетрадь автора', 'Global Author Notebook')}</strong>
                    <small>${tUi(uiLang, `Сквозные авторские правила и заметки для всех чатов · ${globStore.categories.length} разд.`, `Cross-chat rules & notes available everywhere · ${globStore.categories.length} sections`)}</small>
                </div>
                <div class="pcx-bind-strip pcx-single-col">
                    <button type="button" class="pcx-bind-pill ${s.includeGlobalWithChat ? 'pcx-on' : ''}" id="pcx-nb-toggle-global-mix">
                        ${s.includeGlobalWithChat
                            ? tUi(uiLang, 'Подмешивать в чаты: ВКЛ', 'Mix into Chats: ON')
                            : tUi(uiLang, 'Подмешивать в чаты: ВЫКЛ', 'Mix into Chats: OFF')}
                    </button>
                </div>
                <div class="pcx-book-foot">
                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary pcx-btn-main-open" data-open-nb="global">${tUi(uiLang, 'Открыть', 'Open')}</button>
                    <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-soft" data-nb-quick-ai="global">+ ИИ</button>
                    ${s.globalNotebookCover ? `<button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" data-nb-reset-cover="global" title="${tUi(uiLang, 'Сбросить обложку к гравюре', 'Reset cover')}">${ICONS.reset}</button>` : ''}
                </div>
            </article>
        </div>
        <input type="file" id="pcx-nb-cover-input" accept="image/*" hidden>
    `;
}

function renderCodexListView(s, store, currentCat, uiLang, chatOpen) {
    const chatTotal = getChatStore()?.notes?.length || 0;
    const globalTotal = s.globalData?.notes?.length || 0;
    const catEnabled = currentCat?.enabled !== false;
    const allCatNotes = store.notes.filter(n => n.categoryId === currentCat.id);
    const q = (uiState.noteQuery || '').trim().toLowerCase();
    const visibleNotes = allCatNotes.filter(n => {
        if (uiState.noteFilter === 'on' && n.enabled === false) return false;
        if (uiState.noteFilter === 'off' && n.enabled !== false) return false;
        if (uiState.noteFilter === 'prio' && n.priority !== 'critical') return false;
        if (uiState.noteFilter === 'files' && (!Array.isArray(n.attachments) || !n.attachments.length)) return false;
        if (!q) return true;
        const attNames = Array.isArray(n.attachments) ? n.attachments.map(a => a?.name || '').join(' ') : '';
        return `${n.title || ''} ${n.content || ''} ${attNames}`.toLowerCase().includes(q);
    });
    const allCollapsed = allCatNotes.length > 0 && allCatNotes.every(n => Boolean(n.collapsed));
    const nbHeading = (s.scope === 'chat' && chatOpen)
        ? `${tUi(uiLang, 'Тетрадь:', 'Notebook:')} ${getActiveChatDisplayName(uiLang)}`
        : tUi(uiLang, 'Общая тетрадь автора', 'Global Author Notebook');

    const undoBarHtml = canUndoDeletedNote(uiState.lastDeletedNote, s) ? `
        <div class="pcx-undo-bar">
            <span>${tUi(uiLang, 'Заметка удалена:', 'Note deleted:')} <strong>${escapeHtml(uiState.lastDeletedNote.note.title || (uiState.lastDeletedNote.note.content || '').slice(0, 34) || '#')}</strong></span>
            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-note-undo-btn">${ICONS.undo}<span>${tUi(uiLang, 'Вернуть', 'Undo')}</span></button>
        </div>` : '';

    return `
        <button type="button" class="pcx-back-link" id="pcx-back-nb-shelf">${ICONS.chevLeft}<span>${tUi(uiLang, 'На полку Тетрадей (Обложки)', 'Back to Notebook Shelf')}</span></button>

        <div class="pcx-page-head">
            <div>
                <h1>${escapeHtml(nbHeading)}</h1>
                <p>${tUi(
                    uiLang,
                    'У каждого раздела — свой маршрут падения в промпт. Свайпайте карусель разделов и перетаскивайте разделы или карточки за ручку «⋮⋮».',
                    'Every section routes independently. Swipe the section carousel smoothly or drag sections and cards by the grip handle.',
                )}</p>
            </div>
            <div class="pcx-actions">
                <button type="button" class="pcx-btn pcx-btn-secondary" data-open-layers="1">${tUi(uiLang, 'Карта слоёв', 'Layer Map')}</button>
                <button type="button" class="pcx-btn pcx-btn-soft" id="pcx-new-note-ai-btn">${tUi(uiLang, 'С Соавтором ИИ', 'AI Co-Author')}</button>
                <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-new-note-btn">+ ${tUi(uiLang, 'Запись', 'New Note')}</button>
            </div>
        </div>

        <div class="pcx-actions pcx-between" style="border-bottom:1px solid var(--line);margin-bottom:13px;">
            <div class="pcx-tabs" style="border:0;margin:0;">
                <button type="button" class="pcx-tab-u" aria-selected="${s.scope === 'chat' && chatOpen}" data-scope="chat" ${!chatOpen ? 'disabled' : ''}>
                    <span>${chatOpen ? tUi(uiLang, 'Этот чат', 'This Chat') : tUi(uiLang, 'Нет чата', 'No Chat')}</span>
                    <em class="pcx-count-tag">${chatTotal}</em>
                </button>
                <button type="button" class="pcx-tab-u" aria-selected="${s.scope === 'global' || !chatOpen}" data-scope="global">
                    <span>${tUi(uiLang, 'Общие заметки', 'Global Notes')}</span>
                    <em class="pcx-count-tag">${globalTotal}</em>
                </button>
            </div>
            <label class="pcx-chk-label" style="padding-bottom:6px;">
                <input type="checkbox" id="pcx-chk-mix-global" ${s.includeGlobalWithChat ? 'checked' : ''}>
                <span>${tUi(uiLang, 'Подмешивать Общие в чат', 'Include Global in Chat')}</span>
            </label>
        </div>

        <div class="pcx-carousel-row" id="pcx-sec-carousel">
            ${store.categories.map(c => {
                const cnt = store.notes.filter(n => n.categoryId === c.id && n.enabled !== false).length;
                const isAct = c.id === currentCat.id;
                return `
                    <button type="button" class="pcx-chip ${isAct ? 'pcx-active' : ''} ${c.enabled === false ? 'pcx-off-sec' : ''}" data-sec-tab="${escapeHtml(c.id)}">
                        <span class="pcx-sec-grip" title="${tUi(uiLang, 'Потяните за ручку, чтобы переставить раздел', 'Drag handle to reorder section')}">${ICONS.gripSm}</span>
                        <span>${escapeHtml(displayCategoryName(c, uiLang))}</span>
                        <span class="pcx-key-badge">${cnt}</span>
                    </button>`;
            }).join('')}
            <button type="button" class="pcx-chip" id="pcx-add-tab-btn" data-add-sec-modal="1">+ ${tUi(uiLang, 'Раздел', 'Section')}</button>
        </div>

        <div class="pcx-sec-route-bar">
            <div class="pcx-sec-route-info">
                <strong>${escapeHtml(displayCategoryName(currentCat, uiLang))}:</strong>
                <span class="pcx-status-badge ${Number(currentCat.injectPos) === ST_POS.LOCAL_ONLY ? 'pcx-warm' : ''}">${escapeHtml(describeCategoryRouteShort(currentCat))}</span>
                <small>· ${escapeHtml(describeHeaderModeLabel(currentCat.headerMode, uiLang))}</small>
            </div>
            <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" data-edit-sec-modal="${escapeHtml(currentCat.id)}">
                ${tUi(uiLang, 'Маршрут и шапка раздела', 'Section Route & Header')}
            </button>
        </div>

        ${undoBarHtml}

        ${allCatNotes.length > 0 ? `
            <div class="pcx-search-bar">
                <input type="search" id="pcx-codex-search" class="pcx-input" value="${escapeHtml(uiState.noteQuery || '')}" placeholder="${tUi(uiLang, 'Поиск по карточкам раздела...', 'Search notes in section...')}">
                <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-collapse-all-btn">${allCollapsed ? tUi(uiLang, 'Развернуть все', 'Expand All') : tUi(uiLang, 'Свернуть все', 'Collapse All')}</button>
            </div>
            <div class="pcx-carousel-row">
                ${[
                    ['all', `${tUi(uiLang, 'Все', 'All')} (${allCatNotes.length})`],
                    ['on', tUi(uiLang, 'Включённые', 'Active')],
                    ['off', tUi(uiLang, 'Выключенные', 'Muted')],
                    ['prio', tUi(uiLang, 'Важные (!)', 'Priority (!)')],
                    ['files', tUi(uiLang, 'С файлами/артом', 'With Attachments')],
                ].map(([fid, lbl]) => `<button type="button" class="pcx-chip ${uiState.noteFilter === fid ? 'pcx-active' : ''}" data-nfilter="${fid}">${escapeHtml(lbl)}</button>`).join('')}
            </div>
        ` : ''}

        <div class="pcx-stack" id="pcx-notes-stack">
            ${allCatNotes.length === 0
                ? `<div class="pcx-surface pcx-panel"><small>${tUi(uiLang, `Раздел «${displayCategoryName(currentCat, uiLang)}» пока пуст. Нажмите «+ Запись» или «С Соавтором ИИ» выше.`, `Section "${displayCategoryName(currentCat, uiLang)}" is empty. Tap "+ New Note" or "AI Co-Author" above.`)}</small></div>`
                : (visibleNotes.length === 0
                    ? `<div class="pcx-surface pcx-panel"><small>${tUi(uiLang, 'По выбранному фильтру или запросу карточек не найдено.', 'No cards match your current filter or search.')}</small></div>`
                    : visibleNotes.map((note, idx) => {
                        const isOn = note.enabled !== false && catEnabled;
                        const isCol = Boolean(note.collapsed);
                        const atts = Array.isArray(note.attachments) ? note.attachments : [];
                        const displayTitle = note.title || (note.content || '').trim().slice(0, 48) || (tUi(uiLang, 'Запись ', 'Note ') + (idx + 1));
                        const subShown = shouldShowNoteSubheader(note, currentCat);
                        return `
                            <article class="pcx-note-card ${!isOn ? 'pcx-disabled-card' : ''} ${!isCol ? 'pcx-is-open' : ''}" data-note-id="${escapeHtml(note.id)}">
                                <div class="pcx-note-head">
                                    <div class="pcx-note-title-wrap">
                                        <span class="pcx-drag-grip pcx-note-grip" title="${tUi(uiLang, 'Потяните, чтобы изменить порядок в промпте', 'Drag to reorder in prompt')}">${ICONS.grip}</span>
                                        <button type="button" class="pcx-note-title-btn" data-action="collapse" data-id="${escapeHtml(note.id)}">
                                            <span class="pcx-note-title-text">${escapeHtml(displayTitle)}</span>
                                            ${note.priority === 'critical' ? `<span class="pcx-status-badge pcx-warm">! ${tUi(uiLang, 'Важно', 'Prio')}</span>` : ''}
                                            ${subShown ? `<span class="pcx-key-badge">${tUi(uiLang, 'Подзаг.', 'Header')}</span>` : ''}
                                            ${atts.length ? `<span class="pcx-key-badge">${atts.length} ${tUi(uiLang, 'влож.', 'att.')}</span>` : ''}
                                        </button>
                                    </div>
                                    <div class="pcx-actions">
                                        <button type="button" class="pcx-sq-switch" role="switch" aria-checked="${note.enabled !== false}" data-action="toggle" data-id="${escapeHtml(note.id)}" title="${tUi(uiLang, 'Вкл / Выкл в промпте', 'Toggle in prompt')}"><span></span></button>
                                    </div>
                                </div>
                                ${!isCol ? `
                                    <div class="pcx-note-body">
                                        ${note.content ? `<div class="pcx-note-text-preview">${escapeHtml(note.content)}</div>` : ''}
                                        ${atts.length ? `
                                            <div class="pcx-att-grid">
                                                ${atts.map(att => att.kind === 'image'
                                                    ? `<div class="pcx-att-thumb" data-lightbox="${escapeHtml(att.dataUrl)}"><img src="${escapeHtml(toBlobDisplayUrl(att.dataUrl))}" alt=""></div>`
                                                    : `<div class="pcx-att-doc-row"><span>${ICONS.fileText} ${escapeHtml(att.name)}</span><span class="pcx-key-badge">${att.includeInPrompt !== false ? tUi(uiLang, 'В промпте', 'In prompt') : tUi(uiLang, 'Скрыт', 'Muted')}</span></div>`
                                                ).join('')}
                                            </div>` : ''}
                                        <div class="pcx-actions pcx-between" style="padding-top:6px;border-top:1px solid var(--line);">
                                            <div class="pcx-actions">
                                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-action="edit" data-id="${escapeHtml(note.id)}" data-etab="manual">${tUi(uiLang, 'Править', 'Edit')}</button>
                                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-soft" data-action="edit" data-id="${escapeHtml(note.id)}" data-etab="ai">${tUi(uiLang, 'Доработать с ИИ', 'AI Refine')}</button>
                                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-action="copy" data-id="${escapeHtml(note.id)}">${ICONS.copy}</button>
                                            </div>
                                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-danger-ghost" data-action="delete" data-id="${escapeHtml(note.id)}">${tUi(uiLang, 'Удалить', 'Delete')}</button>
                                        </div>
                                    </div>
                                ` : ''}
                            </article>`;
                    }).join(''))}
        </div>
    `;
}

function renderCodexNoteEditorView(s, store, currentCat, uiLang) {
    const existing = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
    if (!uiState.draftAttachments) {
        uiState.draftAttachments = existing && Array.isArray(existing.attachments) ? JSON.parse(JSON.stringify(existing.attachments)) : [];
    }
    const titleVal = uiState.draftTitle !== undefined ? uiState.draftTitle : (existing?.title || '');
    const contentVal = uiState.draftContent !== undefined ? uiState.draftContent : (existing?.content || '');
    const catVal = uiState.draftCat !== undefined ? uiState.draftCat : (existing?.categoryId || currentCat.id);
    const subStyleVal = uiState.draftSubStyle !== undefined ? uiState.draftSubStyle : (existing?.subHeaderStyle || 'inherit');
    const selectedCatObj = store.categories.find(c => c.id === catVal) || currentCat;
    const autoAllMode = selectedCatObj?.headerMode === 'sec_and_auto_notes';
    const incTitle = uiState.draftIncTitle !== undefined
        ? uiState.draftIncTitle
        : (autoAllMode ? (existing?.forceHideTitle !== true) : Boolean(existing?.includeTitle));
    const isStrict = uiState.draftStrict !== undefined ? uiState.draftStrict : (existing?.priority === 'critical');

    const allPresets = getAllCodexPresets();
    const activePreset = getActiveCodexPreset();
    const profiles = getConnectionProfiles();
    const cand = uiState.aiCandidates[uiState.aiCandidateIdx] || null;
    const aiModeShort = s.aiTransportMode === 'direct'
        ? tUi(uiLang, 'Режим ИИ: JSON-схема', 'AI Mode: JSON Schema')
        : tUi(uiLang, 'Режим ИИ: Через пресет Таверны', 'AI Mode: Tavern Preset');

    return `
        <button type="button" class="pcx-back-link" id="pcx-cancel-edit">${ICONS.chevLeft}<span>${tUi(uiLang, 'Назад к карточкам Тетради', 'Back to Notebook Cards')}</span></button>

        <div class="pcx-surface pcx-panel pcx-stack">
            <div class="pcx-actions pcx-between">
                <h2>${existing ? tUi(uiLang, 'Редактирование записи Тетради', 'Edit Notebook Entry') : tUi(uiLang, 'Новая запись в Тетради', 'New Notebook Entry')}</h2>
                <span class="pcx-status-badge">${s.scope === 'chat' ? tUi(uiLang, 'Тетрадь чата', 'Chat Notebook') : tUi(uiLang, 'Общая тетрадь', 'Global Notebook')}</span>
            </div>

            <div class="pcx-seg-tabs">
                <button type="button" class="pcx-seg-tab ${uiState.editTab === 'manual' ? 'pcx-active' : ''}" data-edittab="manual">${tUi(uiLang, 'Написать вручную', 'Write Manually')}</button>
                <button type="button" class="pcx-seg-tab ${uiState.editTab === 'ai' ? 'pcx-active' : ''}" data-edittab="ai">${tUi(uiLang, 'С Соавтором (ИИ)', 'With AI Co-Author')}</button>
            </div>

            ${uiState.editTab === 'ai' ? `
                <div class="pcx-pair">
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Шаблон задачи (или свой запрос ниже)', 'Co-Author Preset')}</span>
                        <select id="pcx-ai-preset" class="pcx-input">
                            ${allPresets.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === activePreset.id ? 'selected' : ''}>${p.isCustom ? '[Мой] ' : ''}${escapeHtml(uiLang === 'en' ? (p.nameEn || p.name) : p.name)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'В какой раздел положить', 'Target Section')}</span>
                        <select id="pcx-note-cat" class="pcx-input">
                            ${store.categories.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === catVal ? 'selected' : ''}>${escapeHtml(displayCategoryName(c, uiLang))} (${escapeHtml(describeCategoryRouteShort(c))})</option>`).join('')}
                        </select>
                    </label>
                </div>

                <div class="pcx-actions pcx-between">
                    <button type="button" class="pcx-chip" data-open-settings-modal="1">${escapeHtml(aiModeShort)}</button>
                    <div class="pcx-actions">
                        <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" id="pcx-open-custom-preset-btn">${ICONS.plus}<span>${tUi(uiLang, 'Свой пресет', 'Save Custom')}</span></button>
                        <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" id="pcx-toggle-gm-prompt">${ICONS.sliders}<span>${uiState.showGmPromptEditor ? tUi(uiLang, 'Скрыть промпт', 'Hide Prompt') : tUi(uiLang, 'Системный промпт', 'System Prompt')}</span></button>
                    </div>
                </div>

                ${activePreset.isCustom ? `
                    <div class="pcx-actions pcx-between pcx-surface" style="padding:8px 11px;background:var(--paper);">
                        <small>${tUi(uiLang, 'Ваш пресет:', 'Custom preset:')} <strong>«${escapeHtml(activePreset.name)}»</strong></small>
                        <div class="pcx-actions">
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-update-custom-preset-btn">${ICONS.save}<span>${tUi(uiLang, 'Обновить', 'Update')}</span></button>
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-danger-ghost" id="pcx-delete-custom-preset-btn">${ICONS.trash}<span>${tUi(uiLang, 'Удалить', 'Delete')}</span></button>
                        </div>
                    </div>` : ''}

                ${uiState.showCustomPresetCreator ? `
                    <div class="pcx-surface pcx-panel pcx-stack" style="background:var(--paper);">
                        <strong>${tUi(uiLang, 'Сохранить свой личный пресет Соавтора', 'Save Custom Co-Author Preset')}</strong>
                        <div class="pcx-pair">
                            <input type="text" id="pcx-custom-preset-name" class="pcx-input" placeholder="${tUi(uiLang, 'Название вашего пресета...', 'Your preset name...')}" value="${escapeHtml(uiState.customPresetNameDraft || '')}">
                            <input type="text" id="pcx-custom-preset-ph" class="pcx-input" placeholder="${tUi(uiLang, 'Подсказка поля запроса (необязательно)...', 'Optional placeholder...')}" value="${escapeHtml(uiState.customPresetPhDraft || '')}">
                        </div>
                        <textarea id="pcx-gm-sys-prompt" class="pcx-input pcx-mono" rows="4">${escapeHtml(s.gmSystemPrompt)}</textarea>
                        <div class="pcx-actions pcx-end">
                            <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-secondary" id="pcx-cancel-custom-preset-btn">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                            <button type="button" class="pcx-btn pcx-btn-sm pcx-btn-primary" id="pcx-save-custom-preset-btn">${ICONS.save}<span>${tUi(uiLang, 'Сохранить пресет', 'Save Preset')}</span></button>
                        </div>
                    </div>` : ''}

                ${(uiState.showGmPromptEditor && !uiState.showCustomPresetCreator) ? `
                    <div class="pcx-surface pcx-panel pcx-stack" style="background:var(--paper);">
                        <div class="pcx-actions pcx-between">
                            <small>Макросы: <code>{{lang}}</code>, <code>{{word_limit}}</code></small>
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-reset-gm-prompt">${ICONS.reset}<span>${tUi(uiLang, 'Сбросить к шаблону', 'Reset to Preset')}</span></button>
                        </div>
                        <textarea id="pcx-gm-sys-prompt" class="pcx-input pcx-mono" rows="4">${escapeHtml(s.gmSystemPrompt)}</textarea>
                    </div>` : ''}

                <label class="pcx-field">
                    <span>${tUi(uiLang, 'Ваше задание для Соавтора (вводите свободно всё, что нужно)', 'Your Request for Co-Author (write anything you need)')}</span>
                    <textarea id="pcx-ai-task" class="pcx-input" rows="4" placeholder="${escapeHtml(activePreset.placeholder || '')}">${escapeHtml(uiState.aiPromptDraft)}</textarea>
                </label>

                <div class="pcx-row-3">
                    <label class="pcx-field"><span>${tUi(uiLang, 'Слов от', 'Min Words')}</span><input type="number" id="pcx-ai-wmin" class="pcx-input" min="0" max="5000" value="${s.aiWordsMin}"></label>
                    <label class="pcx-field"><span>${tUi(uiLang, 'Слов до', 'Max Words')}</span><input type="number" id="pcx-ai-wmax" class="pcx-input" min="0" max="5000" value="${s.aiWordsMax}"></label>
                    <label class="pcx-field"><span>${tUi(uiLang, 'Сообщений чата', 'Chat Msgs')}</span><input type="number" id="pcx-ai-radius" class="pcx-input" min="0" max="200" value="${s.aiChatRadius}"></label>
                </div>

                <div class="pcx-pair">
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Профиль подключения ИИ', 'AI Connection Profile')}</span>
                        <select id="pcx-ai-profile" class="pcx-input">
                            <option value="" ${!s.aiProfileId ? 'selected' : ''}>${tUi(uiLang, '[ Текущее подключение SillyTavern ]', '[ Current Connection ]')}</option>
                            ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${s.aiProfileId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Целевой язык текста', 'Output Language')}</span>
                        <select id="pcx-ai-lang" class="pcx-input">
                            ${LANGUAGES.map(l => `<option value="${escapeHtml(l.id)}" ${s.aiLang === l.id ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('')}
                        </select>
                    </label>
                </div>

                <div class="pcx-actions pcx-between">
                    <div class="pcx-chk-row">
                        <label class="pcx-chk-label"><input type="checkbox" id="pcx-ai-char-desc" ${s.aiSendCharDesc ? 'checked' : ''}><span>${tUi(uiLang, 'Описание персонажа', 'Character Card')}</span></label>
                        <label class="pcx-chk-label"><input type="checkbox" id="pcx-ai-user-desc" ${s.aiSendUserDesc ? 'checked' : ''}><span>${tUi(uiLang, 'Персона игрока', 'User Persona')}</span></label>
                    </div>
                    <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-run-ai-btn" ${uiState.aiGenerating ? 'disabled' : ''}>
                        ${uiState.aiGenerating ? ICONS.spinner : ICONS.spark}
                        <span>${uiState.aiGenerating ? tUi(uiLang, 'Соавтор пишет...', 'Generating...') : tUi(uiLang, 'Сгенерировать вариант', 'Generate Draft')}</span>
                    </button>
                </div>

                ${uiState.aiStatus ? `<div class="pcx-guide-note">${escapeHtml(uiState.aiStatus)}</div>` : ''}

                ${cand ? `
                    <div class="pcx-ai-cand-box">
                        <div class="pcx-actions pcx-between">
                            <strong>${tUi(uiLang, 'Вариант от Соавтора', 'Co-Author Candidate')} (${uiState.aiCandidateIdx + 1}/${uiState.aiCandidates.length})</strong>
                            <div class="pcx-actions">
                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-cand-prev" ${uiState.aiCandidateIdx <= 0 ? 'disabled' : ''}>${ICONS.chevLeft}</button>
                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-cand-next" ${uiState.aiCandidateIdx >= uiState.aiCandidates.length - 1 ? 'disabled' : ''}>${ICONS.chevRight}</button>
                            </div>
                        </div>
                        <input type="text" id="pcx-cand-title" class="pcx-input" placeholder="${tUi(uiLang, 'Заголовок карточки', 'Card title')}" value="${escapeHtml(cand.title || '')}">
                        <textarea id="pcx-cand-content" class="pcx-input" rows="5">${escapeHtml(cand.content || '')}</textarea>
                        <div class="pcx-search-bar" style="margin:0;">
                            <input type="text" id="pcx-ai-refine-input" class="pcx-input" placeholder="${tUi(uiLang, 'Что поправить или дополнить?...', 'What should AI refine?...')}" value="${escapeHtml(uiState.aiRefinementText || '')}">
                            <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-run-refine-btn" ${uiState.aiGenerating ? 'disabled' : ''}>${tUi(uiLang, 'Доработать', 'Refine')}</button>
                        </div>
                        <div class="pcx-actions pcx-end">
                            <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-accept-cand-btn">${tUi(uiLang, 'Перенести в редактор', 'Edit in Manual')}</button>
                            <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-save-cand-direct">${ICONS.check}<span>${tUi(uiLang, 'Сразу сохранить в Тетрадь', 'Save to Notebook')}</span></button>
                        </div>
                    </div>` : ''}
            ` : `
                <div class="pcx-pair">
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Раздел Тетради', 'Section')}</span>
                        <select id="pcx-note-cat" class="pcx-input">
                            ${store.categories.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === catVal ? 'selected' : ''}>${escapeHtml(displayCategoryName(c, uiLang))} (${escapeHtml(describeCategoryRouteShort(c))})</option>`).join('')}
                        </select>
                    </label>
                    <label class="pcx-field">
                        <span>${tUi(uiLang, 'Стиль подзаголовка карточки', 'Card Subheader Style')}</span>
                        <select id="pcx-note-substyle" class="pcx-input">
                            <option value="inherit" ${subStyleVal === 'inherit' ? 'selected' : ''}>${tUi(uiLang, 'Как в настройках раздела', 'Inherit from section')}</option>
                            <option value="h4_blank" ${subStyleVal === 'h4_blank' ? 'selected' : ''}>#### Подзаголовок + отступ</option>
                            <option value="bracket_blank" ${subStyleVal === 'bracket_blank' ? 'selected' : ''}>[Подзаголовок] + отступ</option>
                            <option value="colon_blank" ${subStyleVal === 'colon_blank' ? 'selected' : ''}>Подзаголовок: + отступ</option>
                            <option value="h4_line" ${subStyleVal === 'h4_line' ? 'selected' : ''}>#### Подзаголовок + строка</option>
                        </select>
                    </label>
                </div>

                <label class="pcx-field">
                    <span>${tUi(uiLang, 'Заголовок карточки', 'Card Title')}</span>
                    <input type="text" id="pcx-note-title" class="pcx-input" placeholder="${tUi(uiLang, 'Например: Режиссура ночного перегона', 'e.g. Night Train Direction')}" value="${escapeHtml(titleVal)}">
                </label>

                <div class="pcx-pair">
                    <div class="pcx-actions pcx-between pcx-surface" style="padding:9px 12px;background:var(--paper);">
                        <span style="font-size:0.82rem;font-weight:650;">${tUi(uiLang, 'Отправлять заголовок в промпт', 'Include Title in Prompt')} ${renderHelpBtn('note_title_inc')}</span>
                        <button type="button" class="pcx-sq-switch" id="pcx-note-inctitle-toggle" role="switch" aria-checked="${incTitle}"><span></span></button>
                    </div>
                    <div class="pcx-actions pcx-between pcx-surface" style="padding:9px 12px;background:var(--paper);">
                        <span style="font-size:0.82rem;font-weight:650;">${tUi(uiLang, 'Повышенный приоритет [ВАЖНО]', 'High Priority [IMPORTANT]')} ${renderHelpBtn('note_strict')}</span>
                        <button type="button" class="pcx-sq-switch" id="pcx-note-strict-toggle" role="switch" aria-checked="${isStrict}"><span></span></button>
                    </div>
                </div>
                ${renderHelpBubble('note_title_inc')}
                ${renderHelpBubble('note_strict')}

                <div class="pcx-field">
                    <div class="pcx-actions pcx-between">
                        <span>${tUi(uiLang, 'Текст заметки (пустые строки и переносы сохраняются как вы написали)', 'Note Content (blank lines & spacing preserved verbatim)')}</span>
                        <div class="pcx-actions">
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-note-format-btn">${ICONS.align}<span>${tUi(uiLang, 'Выровнять отступы', 'Clean Paragraphs')}</span></button>
                            <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" id="pcx-attach-file-btn">${ICONS.clip}<span>+ ${tUi(uiLang, 'Файл / Арт', 'Attach')}</span></button>
                            <input type="file" id="pcx-file-input" accept="image/*,.txt,.md,.json,.csv" multiple hidden>
                        </div>
                    </div>
                    <textarea id="pcx-note-content" class="pcx-input" rows="7" placeholder="${tUi(uiLang, 'Введите текст заметки...', 'Write your note here...')}"></textarea>
                </div>

                ${uiState.draftAttachments.length > 0 ? `
                    <div class="pcx-stack">
                        ${uiState.draftAttachments.map(att => att.kind === 'image'
                            ? `<div class="pcx-att-doc-row">
                                <div class="pcx-actions" data-lightbox="${escapeHtml(att.dataUrl)}" style="cursor:pointer;">
                                    <img src="${escapeHtml(toBlobDisplayUrl(att.dataUrl))}" style="width:36px;height:36px;border-radius:5px;object-fit:cover;">
                                    <span>${escapeHtml(att.name || 'image')}</span>
                                </div>
                                <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-danger-ghost" data-del-att="${escapeHtml(att.id)}">${ICONS.trash}</button>
                            </div>`
                            : `<div class="pcx-att-doc-row">
                                <span>${ICONS.fileText} ${escapeHtml(att.name)}</span>
                                <div class="pcx-actions">
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-secondary" data-unpack-att="${escapeHtml(att.id)}">${tUi(uiLang, 'В текст', 'Unpack')}</button>
                                    <button type="button" class="pcx-sq-switch" role="switch" aria-checked="${att.includeInPrompt !== false}" data-toggle-att="${escapeHtml(att.id)}"><span></span></button>
                                    <button type="button" class="pcx-btn pcx-btn-xs pcx-btn-danger-ghost" data-del-att="${escapeHtml(att.id)}">${ICONS.trash}</button>
                                </div>
                            </div>`
                        ).join('')}
                    </div>` : ''}

                <div class="pcx-actions pcx-end">
                    <button type="button" class="pcx-btn pcx-btn-secondary" id="pcx-cancel-edit-2">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                    <button type="button" class="pcx-btn pcx-btn-primary" id="pcx-save-note">${ICONS.check}<span>${tUi(uiLang, 'Сохранить карточку', 'Save Note')}</span></button>
                </div>
            `}
        </div>
    `;
}

// ==================== MASTER RENDER ====================
function renderModal(opts = {}) {
    const generation = ++renderGeneration;
    const chatIdAtStart = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
    const s = ensureSettings();
    const uiLang = s.uiLang || 'ru';
    const dUi = UI_DICT[uiLang] || UI_DICT.ru;
    const chatOpen = stApi.isChatOpen();
    const store = getActiveStore();

    if (!store.categories.some(c => c.id === s.activeTab)) {
        s.activeTab = store.categories[0]?.id || 'classic_an';
    }
    const currentCat = store.categories.find(c => c.id === s.activeTab) || store.categories[0];

    const win = document.getElementById('pcx-window');
    if (!win) return;

    const prevMain = win.querySelector('.pcx-main');
    const savedScrollTop = opts.preserveBodyScroll && prevMain ? prevMain.scrollTop : 0;
    const prevSecStrip = win.querySelector('#pcx-sec-carousel');
    const savedSecScroll = prevSecStrip ? prevSecStrip.scrollLeft : 0;
    const activeEl = document.activeElement;
    const savedSearchFocus = (activeEl && win.contains(activeEl) && activeEl.tagName === 'INPUT' && activeEl.type === 'search' && activeEl.id)
        ? { id: activeEl.id, start: activeEl.selectionStart, end: activeEl.selectionEnd }
        : null;

    applyThemeClasses();

    let mainHtml = '';
    if (uiState.wing === 'forge') {
        mainHtml = forgeCtrl.renderForgeBody();
    } else if (uiState.wing === 'codex') {
        if (uiState.codexSub === 'edit') mainHtml = renderCodexNoteEditorView(s, store, currentCat, uiLang);
        else if (uiState.codexSub === 'list') mainHtml = renderCodexListView(s, store, currentCat, uiLang, chatOpen);
        else mainHtml = renderCodexShelfView(s, uiLang, chatOpen);
    } else {
        mainHtml = renderHomeView(s, store, uiLang, chatOpen);
    }

    if (generation !== renderGeneration) return;
    if ((stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '') !== chatIdAtStart) return;

    win.innerHTML = `
        <header class="pcx-topbar">
            <div class="pcx-top-inner">
                <button type="button" class="pcx-brand" id="pcx-brand-home-btn" title="${tUi(uiLang, 'На Главную', 'Back to Home')}">
                    <span class="pcx-mark">${THEME_CRESTS[s.theme] || THEME_CRESTS.celestial}</span>
                    <span>
                        <span class="pcx-brand-name">Pocket Codex</span>
                        <span class="pcx-brand-sub">${tUi(uiLang, 'Тетрадь автора и Кузница Лорбуков', "Author's Notebook & Lorebook Forge")}</span>
                    </span>
                </button>
                <div class="pcx-top-actions">
                    <button type="button" class="pcx-sq-top-btn pcx-icon-only" id="pcx-btn-layers" title="${tUi(uiLang, 'Карта всех слоёв промпта', 'Prompt Layer Map')}">${ICONS.layers}</button>
                    <button type="button" class="pcx-sq-top-btn pcx-icon-only" id="pcx-btn-guide" title="${tUi(uiLang, 'Путеводитель и образцы', 'Step-by-Step Guide')}">${ICONS.help}</button>
                    <button type="button" class="pcx-sq-top-btn pcx-icon-only" id="pcx-btn-settings" title="${tUi(uiLang, 'Настройки, 13 тем и режим ИИ', 'Settings, 13 Themes & AI Mode')}">${ICONS.gear}</button>
                    <button type="button" class="pcx-sq-top-btn pcx-icon-only" id="pcx-btn-close" title="${tUi(uiLang, 'Закрыть', 'Close')}">${ICONS.close}</button>
                </div>
            </div>
        </header>

        <div class="pcx-shell">
            <aside class="pcx-sidebar" aria-label="${tUi(uiLang, 'Навигация', 'Navigation')}">
                <nav class="pcx-main-nav">
                    <button type="button" class="pcx-nav-btn" data-wing="home" ${uiState.wing === 'home' ? 'aria-current="page"' : ''}>
                        ${ICONS.home}<span>${escapeHtml(dUi.wingHome || tUi(uiLang, 'Главная', 'Home'))}</span>
                    </button>
                    <button type="button" class="pcx-nav-btn" data-wing="codex" ${uiState.wing === 'codex' ? 'aria-current="page"' : ''}>
                        ${ICONS.book}<span>${escapeHtml(dUi.wingCodex || tUi(uiLang, 'Тетрадь', 'Notebook'))}</span>
                    </button>
                    <button type="button" class="pcx-nav-btn" data-wing="forge" id="pcx-mod-forge" ${uiState.wing === 'forge' ? 'aria-current="page"' : ''}>
                        ${ICONS.forge}<span>${escapeHtml(dUi.wingForge || tUi(uiLang, 'Кузница', 'Forge'))}</span>
                    </button>
                </nav>
                <div class="pcx-side-foot">
                    <div class="pcx-privacy-badge">
                        <strong>${ICONS.lock}<span>${tUi(uiLang, 'Слепой контур лора', 'Blind Lore Shield')}</span></strong>
                        <span>${tUi(uiLang, 'При генерации новых страниц ИИ видит только пустой структурный скелет разметки — тексты ваших книг не сливаются.', 'When forging new pages, AI receives only an empty structural format skeleton — existing lore prose is never leaked.')}</span>
                    </div>
                </div>
            </aside>

            <main class="pcx-main">
                <div class="pcx-main-inner">${mainHtml}</div>
            </main>
        </div>
    `;

    // Set manual note textarea value directly so leading/trailing '\n' newlines are never eaten by HTML parser!
    const noteContentTa = win.querySelector('#pcx-note-content');
    if (noteContentTa) {
        const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
        noteContentTa.value = uiState.draftContent !== undefined ? uiState.draftContent : (ex?.content || '');
    }

    const nextSecStrip = win.querySelector('#pcx-sec-carousel');
    if (nextSecStrip) nextSecStrip.scrollLeft = savedSecScroll;
    const nextMain = win.querySelector('.pcx-main');
    if (nextMain && opts.preserveBodyScroll) nextMain.scrollTop = savedScrollTop;

    if (savedSearchFocus) {
        const nextInp = win.querySelector('#' + savedSearchFocus.id);
        if (nextInp) {
            nextInp.focus({ preventScroll: true });
            try { nextInp.setSelectionRange(savedSearchFocus.start, savedSearchFocus.end); } catch {}
        }
    }

    bindMainWindowEvents(win, s, store, currentCat, chatOpen);
    if (uiState.wing === 'forge') {
        forgeCtrl.bindForgeEvents(win);
    } else if (uiState.wing === 'codex' && uiState.codexSub === 'list') {
        enableSectionGripReorder(win, store);
        if (currentCat) enableSmoothCardDrag(win, store, currentCat.id);
    }
}

function getCurrentChatUndoKey() {
    if (!stApi.isChatOpen()) return '';
    const c = stApi.ctx || {};
    const cid = c.getCurrentChatId?.() || c.chatId || '';
    if (!cid) return '';
    const charAvatar = (c.characterId !== undefined && c.characterId !== null && Array.isArray(c.characters))
        ? (c.characters[c.characterId]?.avatar || String(c.characterId))
        : null;
    return JSON.stringify([c.groupId ?? null, charAvatar, String(cid)]);
}

function canUndoDeletedNote(last, s) {
    if (!last || !last.note) return false;
    if (last.scope !== s.scope) return false;
    if (last.scope === 'global') return true;
    const curKey = getCurrentChatUndoKey();
    return Boolean(curKey && last.chatKey && last.chatKey === curKey);
}

function resetEditDrafts() {
    codexAiSeq++;
    uiState.aiGenerating = false;
    delete uiState.draftTitle;
    delete uiState.draftContent;
    delete uiState.draftIncTitle;
    delete uiState.draftSubStyle;
    delete uiState.draftStrict;
    delete uiState.draftCat;
    uiState.draftAttachments = null;
    uiState.aiCandidates = [];
    uiState.aiCandidateIdx = 0;
    uiState.aiRefinementText = '';
    uiState.aiStatus = '';
}

function captureCurrentEditFields(win) {
    if (!win) return;
    forgeCtrl?.captureForgeFields?.(win);
    const t = win.querySelector('#pcx-note-title');
    const c = win.querySelector('#pcx-note-content');
    const cat = win.querySelector('#pcx-note-cat');
    const subSt = win.querySelector('#pcx-note-substyle');
    const task = win.querySelector('#pcx-ai-task');
    const refIn = win.querySelector('#pcx-ai-refine-input');
    const candT = win.querySelector('#pcx-cand-title');
    const candC = win.querySelector('#pcx-cand-content');
    const gmSys = win.querySelector('#pcx-gm-sys-prompt');
    if (t) uiState.draftTitle = t.value;
    if (c) uiState.draftContent = c.value;
    if (cat) uiState.draftCat = cat.value;
    if (subSt) uiState.draftSubStyle = subSt.value;
    if (task) uiState.aiPromptDraft = task.value;
    if (refIn) uiState.aiRefinementText = refIn.value;
    if (uiState.aiCandidates[uiState.aiCandidateIdx]) {
        if (candT) uiState.aiCandidates[uiState.aiCandidateIdx].title = candT.value;
        if (candC) uiState.aiCandidates[uiState.aiCandidateIdx].content = candC.value;
    }
    if (gmSys) ensureSettings().gmSystemPrompt = gmSys.value;
}

function saveNoteRecord(store, s, currentCat, { title, content, catId, subSt, atts, incTitle, isStrict }) {
    if (!content && (!atts || !atts.length)) return false;
    const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
    const catObj = store.categories.find(c => c.id === catId) || currentCat;
    const autoAll = catObj?.headerMode === 'sec_and_auto_notes';
    const forceHideTitle = autoAll ? !incTitle : false;
    const prio = isStrict ? 'critical' : 'normal';

    if (ex) {
        Object.assign(ex, {
            categoryId: catId,
            priority: prio,
            title,
            includeTitle: incTitle,
            forceHideTitle,
            subHeaderStyle: subSt,
            content,
            attachments: atts,
        });
    } else {
        store.notes.unshift({
            id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            categoryId: catId,
            priority: prio,
            title,
            includeTitle: incTitle,
            forceHideTitle,
            subHeaderStyle: subSt,
            collapsed: false,
            content,
            attachments: atts,
            enabled: true,
        });
    }
    s.activeTab = catId;
    resetEditDrafts();
    uiState.codexSub = 'list';
    uiState.editingNoteId = null;
    saveAll();
    renderModal();
    return true;
}

function bindMainWindowEvents(win, s, store, currentCat, chatOpen) {
    // Topbar & Modal triggers
    win.querySelector('#pcx-brand-home-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.wing = 'home';
        renderModal();
    });
    win.querySelector('#pcx-btn-close')?.addEventListener('click', closeModal);
    win.querySelector('#pcx-btn-settings')?.addEventListener('click', () => openSubModal('settings'));
    win.querySelector('#pcx-btn-guide')?.addEventListener('click', () => openSubModal('guide'));
    win.querySelector('#pcx-btn-layers')?.addEventListener('click', () => openSubModal('layers'));
    win.querySelectorAll('[data-open-layers]').forEach(b => b.addEventListener('click', () => openSubModal('layers')));
    win.querySelectorAll('[data-open-settings-modal]').forEach(b => b.addEventListener('click', () => openSubModal('settings')));
    win.querySelectorAll('[data-edit-sec-modal]').forEach(b => b.addEventListener('click', () => openSubModal('section', { mode: 'edit', catId: b.dataset.editSecModal })));
    win.querySelectorAll('[data-add-sec-modal]').forEach(b => b.addEventListener('click', () => openSubModal('section', { mode: 'create' })));

    win.querySelectorAll('[data-tip]').forEach(qBtn => qBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        captureCurrentEditFields(win);
        uiState.openTipId = (uiState.openTipId === qBtn.dataset.tip) ? null : qBtn.dataset.tip;
        renderModal({ preserveBodyScroll: true });
    }));

    // 3-Pillar Navigation
    win.querySelectorAll('[data-wing]').forEach(wBtn => wBtn.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const nextWing = wBtn.dataset.wing;
        uiState.wing = nextWing;
        if (nextWing === 'codex') {
            uiState.codexSub = 'shelf';
        } else if (nextWing === 'forge') {
            forgeCtrl.onEnterForge();
        }
        renderModal();
    }));

    // Home actions
    win.querySelectorAll('[data-home-go]').forEach(btn => btn.addEventListener('click', () => {
        const dest = btn.dataset.homeGo;
        if (dest === 'codex_shelf') {
            uiState.wing = 'codex';
            uiState.codexSub = 'shelf';
            renderModal();
        } else if (dest === 'codex_open_active') {
            s.scope = chatOpen ? 'chat' : 'global';
            uiState.wing = 'codex';
            uiState.codexSub = 'list';
            saveAll();
            renderModal();
        } else if (dest === 'coauthor') {
            resetEditDrafts();
            s.scope = chatOpen ? 'chat' : 'global';
            uiState.wing = 'codex';
            uiState.codexSub = 'edit';
            uiState.editTab = 'ai';
            uiState.editingNoteId = null;
            renderModal();
        } else if (dest === 'forge') {
            uiState.wing = 'forge';
            forgeCtrl.onEnterForge();
            renderModal();
        } else if (dest === 'forge_hub') {
            uiState.wing = 'forge';
            forgeCtrl.onEnterForgeHub?.();
            renderModal();
        }
    }));

    win.querySelectorAll('[data-home-open-book]').forEach(btn => btn.addEventListener('click', async () => {
        const bookId = btn.dataset.homeOpenBook;
        uiState.wing = 'forge';
        await forgeCtrl.openBookFromHome(bookId, { openRecursion: false });
    }));
    win.querySelectorAll('[data-home-open-rec]').forEach(btn => btn.addEventListener('click', async () => {
        const bookId = btn.dataset.homeOpenRec;
        uiState.wing = 'forge';
        await forgeCtrl.openBookFromHome(bookId, { openRecursion: true });
    }));

    // Notebook Shelf actions (covers, opening chat/global notebook)
    win.querySelectorAll('[data-open-nb]').forEach(el => el.addEventListener('click', () => {
        const targetScope = el.dataset.openNb;
        if (targetScope === 'chat' && !chatOpen) return;
        resetEditDrafts();
        s.scope = targetScope;
        uiState.codexSub = 'list';
        saveAll();
        renderModal();
    }));
    win.querySelectorAll('[data-nb-quick-ai]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        const targetScope = btn.dataset.nbQuickAi;
        if (targetScope === 'chat' && !chatOpen) return;
        resetEditDrafts();
        s.scope = targetScope;
        uiState.codexSub = 'edit';
        uiState.editTab = 'ai';
        uiState.editingNoteId = null;
        saveAll();
        renderModal();
    }));
    win.querySelector('#pcx-nb-toggle-global-mix')?.addEventListener('click', () => {
        s.includeGlobalWithChat = !s.includeGlobalWithChat;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelectorAll('[data-nb-cover]').forEach(btn => btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        uiState.notebookCoverTarget = btn.dataset.nbCover || 'global';
        win.querySelector('#pcx-nb-cover-input')?.click();
    }));
    win.querySelectorAll('[data-nb-reset-cover]').forEach(btn => btn.addEventListener('click', async e => {
        e.preventDefault(); e.stopPropagation();
        if (btn.dataset.nbResetCover === 'chat' && stApi.chatMetadata) {
            delete stApi.chatMetadata.pcx_notebook_cover;
            await stApi.saveMetadata();
        } else {
            s.globalNotebookCover = '';
            stApi.saveSettings();
        }
        renderModal({ preserveBodyScroll: true });
    }));
    win.querySelector('#pcx-nb-cover-input')?.addEventListener('change', async e => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
            const att = await readImageFileLossless(f);
            const safe = sanitizeCoverDataUrl(att.dataUrl);
            if (!safe) throw new Error('Неподдерживаемый формат обложки.');
            if (uiState.notebookCoverTarget === 'chat' && stApi.isChatOpen() && stApi.chatMetadata) {
                stApi.chatMetadata.pcx_notebook_cover = safe;
                await stApi.saveMetadata();
            } else {
                s.globalNotebookCover = safe;
                stApi.saveSettings();
            }
            renderModal({ preserveBodyScroll: true });
        } catch (err) {
            window.alert(err?.message || String(err));
        }
    });

    // Inside Opened Notebook (List View)
    win.querySelector('#pcx-back-nb-shelf')?.addEventListener('click', () => {
        uiState.codexSub = 'shelf';
        renderModal();
    });
    win.querySelectorAll('[data-scope]').forEach(btn => btn.addEventListener('click', () => {
        if (btn.disabled) return;
        resetEditDrafts();
        s.scope = btn.dataset.scope;
        uiState.codexSub = 'list';
        saveAll();
        renderModal();
    }));
    win.querySelector('#pcx-chk-mix-global')?.addEventListener('change', e => {
        s.includeGlobalWithChat = e.target.checked;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelectorAll('[data-sec-tab]').forEach(tab => tab.addEventListener('click', e => {
        if (e.target.closest('.pcx-sec-grip')) return;
        resetEditDrafts();
        s.activeTab = tab.dataset.secTab;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    }));
    win.querySelector('#pcx-new-note-btn')?.addEventListener('click', () => {
        resetEditDrafts();
        uiState.codexSub = 'edit';
        uiState.editTab = 'manual';
        uiState.editingNoteId = null;
        renderModal();
    });
    win.querySelector('#pcx-new-note-ai-btn')?.addEventListener('click', () => {
        resetEditDrafts();
        uiState.codexSub = 'edit';
        uiState.editTab = 'ai';
        uiState.editingNoteId = null;
        renderModal();
    });
    win.querySelector('#pcx-codex-search')?.addEventListener('input', e => {
        uiState.noteQuery = e.target.value;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelectorAll('[data-nfilter]').forEach(chip => chip.addEventListener('click', () => {
        uiState.noteFilter = chip.dataset.nfilter || 'all';
        renderModal({ preserveBodyScroll: true });
    }));
    win.querySelector('#pcx-collapse-all-btn')?.addEventListener('click', () => {
        if (!currentCat) return;
        const list = store.notes.filter(n => n.categoryId === currentCat.id);
        const nextCol = !list.every(n => n.collapsed);
        for (const n of list) n.collapsed = nextCol;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-note-undo-btn')?.addEventListener('click', () => {
        const last = uiState.lastDeletedNote;
        if (!canUndoDeletedNote(last, s)) { renderModal({ preserveBodyScroll: true }); return; }
        const targetStore = last.scope === 'global' ? s.globalData : getChatStore();
        if (targetStore && Array.isArray(targetStore.notes) && !targetStore.notes.some(n => n.id === last.note.id)) {
            targetStore.notes.unshift(last.note);
            normalizeStore(targetStore);
        }
        uiState.lastDeletedNote = null;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    });

    win.querySelectorAll('[data-action="collapse"]').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation();
        const note = store.notes.find(n => n.id === el.dataset.id);
        if (note) { note.collapsed = !note.collapsed; saveAll(); renderModal({ preserveBodyScroll: true }); }
    }));
    win.querySelectorAll('[data-action="toggle"]').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation();
        const note = store.notes.find(n => n.id === el.dataset.id);
        if (note) { note.enabled = note.enabled === false; saveAll(); renderModal({ preserveBodyScroll: true }); }
    }));
    win.querySelectorAll('[data-action="copy"]').forEach(btn => btn.addEventListener('click', () => {
        const note = store.notes.find(n => n.id === btn.dataset.id);
        if (!note) return;
        navigator.clipboard?.writeText(note.content || '');
        btn.innerHTML = ICONS.check;
        setTimeout(() => { if (btn.isConnected) btn.innerHTML = ICONS.copy; }, 1100);
    }));
    win.querySelectorAll('[data-action="edit"]').forEach(el => el.addEventListener('click', () => {
        resetEditDrafts();
        uiState.codexSub = 'edit';
        uiState.editTab = el.dataset.etab === 'ai' ? 'ai' : 'manual';
        uiState.editingNoteId = el.dataset.id;
        renderModal();
    }));
    win.querySelectorAll('[data-action="delete"]').forEach(el => el.addEventListener('click', () => {
        const target = store.notes.find(n => n.id === el.dataset.id);
        if (!target) return;
        const uiLang = s.uiLang || 'ru';
        const label = target.title || (target.content || '').trim().slice(0, 32) || '#';
        if (!window.confirm(tUi(uiLang, `Удалить карточку «${label}»?`, `Delete card "${label}"?`))) return;
        uiState.lastDeletedNote = {
            scope: s.scope,
            chatKey: s.scope === 'chat' ? getCurrentChatUndoKey() : null,
            note: JSON.parse(JSON.stringify(target)),
        };
        store.notes = store.notes.filter(n => n.id !== el.dataset.id);
        saveAll();
        renderModal({ preserveBodyScroll: true });
    }));

    // Note Editor (Manual & AI Co-Author)
    win.querySelectorAll('[data-edittab]').forEach(btn => btn.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.editTab = btn.dataset.edittab;
        renderModal({ preserveBodyScroll: true });
    }));
    win.querySelector('#pcx-note-title')?.addEventListener('input', e => { uiState.draftTitle = e.target.value; });
    win.querySelector('#pcx-note-content')?.addEventListener('input', e => { uiState.draftContent = e.target.value; });
    win.querySelector('#pcx-note-cat')?.addEventListener('change', e => {
        captureCurrentEditFields(win);
        uiState.draftCat = e.target.value;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-note-substyle')?.addEventListener('change', e => { uiState.draftSubStyle = e.target.value; });
    win.querySelector('#pcx-note-format-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.draftContent = formatCleanParagraphs(uiState.draftContent || '');
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-note-inctitle-toggle')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
        const catIdNow = uiState.draftCat || ex?.categoryId || currentCat?.id;
        const catObjNow = store.categories.find(c => c.id === catIdNow) || currentCat;
        const autoAll = catObjNow?.headerMode === 'sec_and_auto_notes';
        const curVal = uiState.draftIncTitle !== undefined ? uiState.draftIncTitle : (autoAll ? (ex?.forceHideTitle !== true) : Boolean(ex?.includeTitle));
        uiState.draftIncTitle = !curVal;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-note-strict-toggle')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
        uiState.draftStrict = !(uiState.draftStrict !== undefined ? uiState.draftStrict : (ex?.priority === 'critical'));
        renderModal({ preserveBodyScroll: true });
    });

    win.querySelector('#pcx-attach-file-btn')?.addEventListener('click', () => win.querySelector('#pcx-file-input')?.click());
    win.querySelector('#pcx-file-input')?.addEventListener('change', async e => {
        const files = [...(e.target.files || [])];
        if (!files.length) return;
        captureCurrentEditFields(win);
        if (!Array.isArray(uiState.draftAttachments)) uiState.draftAttachments = [];
        for (const f of files) {
            try {
                uiState.draftAttachments.push(f.type.startsWith('image/') ? await readImageFileLossless(f) : await readTextAttachment(f));
            } catch (err) { window.alert(err?.message); }
        }
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelectorAll('[data-unpack-att]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        captureCurrentEditFields(win);
        const target = (uiState.draftAttachments || []).find(a => a.id === btn.dataset.unpackAtt);
        if (!target || !target.text) return;
        uiState.draftContent = formatCleanParagraphs(uiState.draftContent ? `${uiState.draftContent}\n\n${target.text}` : target.text);
        if (!uiState.draftTitle) uiState.draftTitle = target.name.replace(/\.[^.]+$/, '');
        uiState.draftAttachments = uiState.draftAttachments.filter(a => a.id !== target.id);
        renderModal({ preserveBodyScroll: true });
    }));
    win.querySelectorAll('[data-del-att]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        captureCurrentEditFields(win);
        uiState.draftAttachments = (uiState.draftAttachments || []).filter(a => a.id !== btn.dataset.delAtt);
        renderModal({ preserveBodyScroll: true });
    }));
    win.querySelectorAll('[data-toggle-att]').forEach(sw => sw.addEventListener('click', e => {
        e.stopPropagation();
        captureCurrentEditFields(win);
        const t = (uiState.draftAttachments || []).find(a => a.id === sw.dataset.toggleAtt);
        if (t) t.includeInPrompt = t.includeInPrompt === false;
        renderModal({ preserveBodyScroll: true });
    }));
    win.querySelectorAll('[data-lightbox]').forEach(el => el.addEventListener('click', e => {
        if (!e.target.closest('[data-del-att]')) openImageLightbox(el.dataset.lightbox);
    }));

    // Custom & Built-in Presets in Co-Author
    win.querySelector('#pcx-ai-preset')?.addEventListener('change', e => {
        captureCurrentEditFields(win);
        const allPr = getAllCodexPresets();
        const chosen = allPr.find(p => p.id === e.target.value) || allPr[0];
        s.gmPresetId = chosen.id;
        s.gmSystemPrompt = chosen.prompt;
        uiState.showCustomPresetCreator = false;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-open-custom-preset-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.showCustomPresetCreator = !uiState.showCustomPresetCreator;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-cancel-custom-preset-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.showCustomPresetCreator = false;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-custom-preset-name')?.addEventListener('input', e => { uiState.customPresetNameDraft = e.target.value; });
    win.querySelector('#pcx-custom-preset-ph')?.addEventListener('input', e => { uiState.customPresetPhDraft = e.target.value; });
    win.querySelector('#pcx-save-custom-preset-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const nm = (uiState.customPresetNameDraft || '').trim();
        const sys = (s.gmSystemPrompt || '').trim();
        if (!nm) { window.alert('Введите название вашего пресета.'); return; }
        if (!sys) { window.alert('Системный промпт не может быть пустым.'); return; }
        if (!Array.isArray(s.customCodexPresets)) s.customCodexPresets = [];
        const newId = 'user_cx_' + Date.now();
        s.customCodexPresets.push({
            id: newId,
            name: nm,
            nameEn: nm,
            placeholder: (uiState.customPresetPhDraft || '').trim() || 'Опишите задачу для Соавтора...',
            prompt: sys,
        });
        s.gmPresetId = newId;
        uiState.showCustomPresetCreator = false;
        uiState.customPresetNameDraft = '';
        uiState.customPresetPhDraft = '';
        saveAll();
        try { window.toastr?.success?.(`Пресет «${nm}» сохранён!`); } catch {}
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-update-custom-preset-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const target = (s.customCodexPresets || []).find(p => p.id === s.gmPresetId);
        if (!target) return;
        target.prompt = s.gmSystemPrompt;
        saveAll();
        try { window.toastr?.success?.(`Пресет «${target.name}» обновлён!`); } catch {}
    });
    win.querySelector('#pcx-delete-custom-preset-btn')?.addEventListener('click', () => {
        const target = (s.customCodexPresets || []).find(p => p.id === s.gmPresetId);
        if (!target || !window.confirm(`Удалить ваш пресет «${target.name}»?`)) return;
        s.customCodexPresets = s.customCodexPresets.filter(p => p.id !== target.id);
        s.gmPresetId = CODEX_PROMPT_PRESETS[0].id;
        s.gmSystemPrompt = CODEX_PROMPT_PRESETS[0].prompt;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-toggle-gm-prompt')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.showGmPromptEditor = !uiState.showGmPromptEditor;
        uiState.showCustomPresetCreator = false;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-reset-gm-prompt')?.addEventListener('click', () => {
        s.gmSystemPrompt = getActiveCodexPreset().prompt;
        saveAll();
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-gm-sys-prompt')?.addEventListener('input', e => {
        s.gmSystemPrompt = e.target.value;
        scheduleSaveAll();
    });

    // Debounced AI numeric inputs (zero keystroke lag!)
    win.querySelector('#pcx-ai-profile')?.addEventListener('change', e => { s.aiProfileId = e.target.value; saveAll(); });
    win.querySelector('#pcx-ai-lang')?.addEventListener('change', e => { s.aiLang = e.target.value; saveAll(); });
    win.querySelector('#pcx-ai-wmin')?.addEventListener('input', e => { s.aiWordsMin = Math.max(0, Math.min(5000, Number(e.target.value) || 0)); scheduleSaveAll(); });
    win.querySelector('#pcx-ai-wmax')?.addEventListener('input', e => { s.aiWordsMax = Math.max(0, Math.min(5000, Number(e.target.value) || 0)); scheduleSaveAll(); });
    win.querySelector('#pcx-ai-radius')?.addEventListener('input', e => { s.aiChatRadius = Math.max(0, Math.min(200, Number(e.target.value) || 0)); scheduleSaveAll(); });
    win.querySelector('#pcx-ai-char-desc')?.addEventListener('change', e => { s.aiSendCharDesc = e.target.checked; saveAll(); });
    win.querySelector('#pcx-ai-user-desc')?.addEventListener('change', e => { s.aiSendUserDesc = e.target.checked; saveAll(); });

    win.querySelector('#pcx-run-ai-btn')?.addEventListener('click', async () => {
        if (uiState.aiGenerating) return;
        captureCurrentEditFields(win);
        const taskText = uiState.aiPromptDraft || '';
        const currentContent = uiState.draftContent || '';
        const atts = uiState.draftAttachments || [];
        if (!taskText.trim() && !currentContent.trim() && !atts.length) {
            uiState.aiStatus = 'Опишите задачу выше.';
            renderModal({ preserveBodyScroll: true });
            return;
        }
        const reqSeq = ++codexAiSeq;
        const chatAtStart = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
        const scopeAtStart = s.scope;
        uiState.aiGenerating = true;
        uiState.aiStatus = 'Соавтор создаёт вариант...';
        renderModal({ preserveBodyScroll: true });
        try {
            const res = await runAiNoteGeneration({ taskText, currentDraftText: currentContent, attachments: atts });
            if (reqSeq !== codexAiSeq || (stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '') !== chatAtStart || s.scope !== scopeAtStart) return;
            if (res.content) {
                uiState.aiCandidates.push({ title: res.title || '', content: res.content });
                uiState.aiCandidateIdx = uiState.aiCandidates.length - 1;
                uiState.aiStatus = 'Проверьте вариант ниже!';
            } else {
                uiState.aiStatus = 'Пустой ответ модели.';
            }
        } catch (err) {
            if (reqSeq === codexAiSeq) uiState.aiStatus = 'Ошибка: ' + (err?.message || String(err));
        } finally {
            if (reqSeq === codexAiSeq) { uiState.aiGenerating = false; renderModal({ preserveBodyScroll: true }); }
        }
    });

    win.querySelector('#pcx-run-refine-btn')?.addEventListener('click', async () => {
        if (uiState.aiGenerating) return;
        captureCurrentEditFields(win);
        const prev = uiState.aiCandidates[uiState.aiCandidateIdx];
        const refText = (uiState.aiRefinementText || '').trim();
        if (!prev || !refText) return;
        const reqSeq = ++codexAiSeq;
        const chatAtStart = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
        const scopeAtStart = s.scope;
        uiState.aiGenerating = true;
        uiState.aiStatus = 'Вносим правки...';
        renderModal({ preserveBodyScroll: true });
        try {
            const res = await runAiNoteGeneration({
                taskText: uiState.aiPromptDraft || '',
                currentDraftText: uiState.draftContent || '',
                attachments: uiState.draftAttachments || [],
                previousCandidate: prev,
                refinementInstruction: refText,
            });
            if (reqSeq !== codexAiSeq || (stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '') !== chatAtStart || s.scope !== scopeAtStart) return;
            if (res.content) {
                uiState.aiCandidates.push({ title: res.title || prev.title || '', content: res.content });
                uiState.aiCandidateIdx = uiState.aiCandidates.length - 1;
                uiState.aiRefinementText = '';
                uiState.aiStatus = 'Обновлённый вариант готов!';
            }
        } catch (err) {
            if (reqSeq === codexAiSeq) uiState.aiStatus = 'Ошибка: ' + (err?.message || String(err));
        } finally {
            if (reqSeq === codexAiSeq) { uiState.aiGenerating = false; renderModal({ preserveBodyScroll: true }); }
        }
    });

    win.querySelector('#pcx-cand-prev')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        if (uiState.aiCandidateIdx > 0) uiState.aiCandidateIdx--;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-cand-next')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        if (uiState.aiCandidateIdx < uiState.aiCandidates.length - 1) uiState.aiCandidateIdx++;
        renderModal({ preserveBodyScroll: true });
    });
    win.querySelector('#pcx-accept-cand-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const chosen = uiState.aiCandidates[uiState.aiCandidateIdx];
        if (!chosen) return;
        uiState.draftContent = formatCleanParagraphs(chosen.content);
        if (chosen.title && !(uiState.draftTitle && uiState.draftTitle.trim())) uiState.draftTitle = chosen.title;
        uiState.editTab = 'manual';
        renderModal();
    });
    win.querySelector('#pcx-save-cand-direct')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const chosen = uiState.aiCandidates[uiState.aiCandidateIdx];
        if (!chosen) return;
        const catId = win.querySelector('#pcx-note-cat')?.value || uiState.draftCat || s.activeTab;
        const catObj = store.categories.find(c => c.id === catId) || currentCat;
        const autoAll = catObj?.headerMode === 'sec_and_auto_notes';
        saveNoteRecord(store, s, currentCat, {
            title: (chosen.title || uiState.draftTitle || '').trim(),
            content: formatCleanParagraphs(chosen.content || ''),
            catId,
            subSt: uiState.draftSubStyle || 'inherit',
            atts: Array.isArray(uiState.draftAttachments) ? uiState.draftAttachments : [],
            incTitle: uiState.draftIncTitle !== undefined ? uiState.draftIncTitle : (autoAll ? true : Boolean(chosen.title)),
            isStrict: Boolean(uiState.draftStrict),
        });
    });

    win.querySelectorAll('#pcx-cancel-edit, #pcx-cancel-edit-2').forEach(b => b.addEventListener('click', () => {
        resetEditDrafts();
        uiState.codexSub = 'list';
        uiState.editingNoteId = null;
        renderModal();
    }));

    win.querySelector('#pcx-save-note')?.addEventListener('click', () => {
        const catId = win.querySelector('#pcx-note-cat')?.value || s.activeTab;
        const title = (win.querySelector('#pcx-note-title')?.value || '').trim();
        const rawContent = win.querySelector('#pcx-note-content')?.value ?? '';
        const isIntentionalSpacer = rawContent.length > 0 && rawContent.trim().length === 0;
        const content = isIntentionalSpacer ? rawContent : rawContent.replace(/^\n+|\n+$/g, '');
        const subSt = win.querySelector('#pcx-note-substyle')?.value || uiState.draftSubStyle || 'inherit';
        const atts = Array.isArray(uiState.draftAttachments) ? uiState.draftAttachments : [];
        const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
        const catObj = store.categories.find(c => c.id === catId) || currentCat;
        const autoAll = catObj?.headerMode === 'sec_and_auto_notes';
        const incTitle = uiState.draftIncTitle !== undefined
            ? uiState.draftIncTitle
            : (autoAll ? (ex?.forceHideTitle !== true) : Boolean(ex?.includeTitle));
        const isStrict = Boolean(uiState.draftStrict !== undefined ? uiState.draftStrict : (ex?.priority === 'critical'));
        saveNoteRecord(store, s, currentCat, { title, content, catId, subSt, atts, incTitle, isStrict });
    });
}

// ==================== MOUNT & LIFECYCLE ====================
function openModal(e) {
    if (e && typeof e.preventDefault === 'function') { e.preventDefault(); e.stopPropagation(); }
    injectStylesAndFonts();
    let dlg = document.getElementById('pcx-dialog');
    if (!dlg) { mountUI(); dlg = document.getElementById('pcx-dialog'); }
    if (!dlg) return;
    renderModal();
    if (!dlg.open) {
        try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    }
}

function closeModal() {
    if (uiState.aiGenerating || forgeCtrl?.isBusy) return;
    closeSubModal();
    document.getElementById('pcx-lightbox')?.remove();
    const win = document.getElementById('pcx-window');
    captureCurrentEditFields(win);
    const dlg = document.getElementById('pcx-dialog');
    if (!dlg) return;
    try { if (dlg.open) dlg.close(); else dlg.removeAttribute('open'); } catch { dlg.removeAttribute('open'); }
}

function mountExtensionButtons() {
    if (!document.getElementById('pcx-sendbar-btn')) {
        const wandBtn = document.getElementById('extensionsMenuButton');
        const leftSend = document.getElementById('leftSendForm');
        const btn = document.createElement('div');
        btn.id = 'pcx-sendbar-btn';
        btn.className = 'interactable';
        btn.tabIndex = 0;
        btn.setAttribute('role', 'button');
        btn.title = 'Pocket Codex & Forge [BETA]';
        btn.innerHTML = ICONS.book;
        btn.addEventListener('click', openModal);
        btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(e); });
        if (wandBtn?.parentElement) wandBtn.insertAdjacentElement('afterend', btn);
        else if (leftSend) leftSend.appendChild(btn);
    }
    const extSettings = document.getElementById('extensions_settings');
    if (extSettings && !document.getElementById('pcx-settings-drawer')) {
        const s = ensureSettings();
        const drawer = document.createElement('div');
        drawer.id = 'pcx-settings-drawer';
        drawer.className = 'inline-drawer';
        drawer.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header"><b>Pocket Codex & Forge [BETA]</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
            <div class="inline-drawer-content" style="display:none;padding:10px;">
                <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
                    <button type="button" id="pcx-open-from-settings" class="menu_button pcx-drawer-btn">${ICONS.book}<span>Открыть Кодекс и Кузницу / Open Codex</span></button>
                    <label class="checkbox_label" style="margin-top:4px;"><input type="checkbox" id="pcx-drawer-tips-chk" ${s.showTooltips !== false ? 'checked' : ''}><span>Показывать кружочки подсказок (?)</span></label>
                </div>
            </div>`;
        extSettings.appendChild(drawer);
        drawer.querySelector('#pcx-open-from-settings')?.addEventListener('click', openModal);
        drawer.querySelector('#pcx-drawer-tips-chk')?.addEventListener('change', e => {
            const st = ensureSettings();
            st.showTooltips = e.target.checked;
            uiState.openTipId = null;
            applyThemeClasses();
            saveAll();
        });
    }
}

function mountUI() {
    injectStylesAndFonts();
    if (!document.getElementById('pcx-dialog')) {
        const dlg = document.createElement('dialog');
        dlg.id = 'pcx-dialog';
        dlg.innerHTML = `<div id="pcx-window"></div>`;
        let downOnBackdrop = false;
        dlg.addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
        dlg.addEventListener('pointerdown', e => { downOnBackdrop = (e.target === dlg); });
        dlg.addEventListener('click', e => { if (downOnBackdrop && e.target === dlg) closeModal(); downOnBackdrop = false; });
        document.body.appendChild(dlg);
    }
    if (!document.getElementById('pcx-sub-dialog')) {
        const subDlg = document.createElement('dialog');
        subDlg.id = 'pcx-sub-dialog';
        let subDownBackdrop = false;
        subDlg.addEventListener('cancel', e => { e.preventDefault(); closeSubModal(); });
        subDlg.addEventListener('pointerdown', e => { subDownBackdrop = (e.target === subDlg); });
        subDlg.addEventListener('click', e => { if (subDownBackdrop && e.target === subDlg) closeSubModal(); subDownBackdrop = false; });
        document.body.appendChild(subDlg);
    }
    mountExtensionButtons();
    applyThemeClasses();
    updateExtensionPrompt({ force: true });
}

jQuery(async () => {
    await initStApi();
    ensureSettings();
    forgeCtrl = createForgeController({
        stApi,
        escapeHtml,
        renderHelpBtn,
        renderHelpBubble,
        compressImageFile: readImageFileLossless,
        readTextAttachment,
        getActiveStore,
        ensureSettings,
        getConnectionProfiles,
        getCharacterDescriptionText,
        getUserPersonaDescriptionText,
        buildChatContextSnippet,
        buildWordLimitPhrase,
        saveAllCodex: saveAll,
        requestRender: renderModal,
    });
    mountUI();
    stApi.registerMacro('notebook', () => buildMacroNotebookText());

    // External launcher integration (e.g. from NexusMatch Forge)
    window.addEventListener('pcx:open-forge', () => {
        uiState.wing = 'forge';
        forgeCtrl.onEnterForge();
        openModal();
    });

    const evSource = stApi.eventSource, evTypes = stApi.eventTypes;
    if (evSource && typeof evSource.on === 'function') {
        if (evTypes.WORLDINFO_ENTRIES_LOADED) {
            const loadExtraChatLore = async (payload) => {
                try {
                    if (!payload || !Array.isArray(payload.chatLore) || !stApi.isChatOpen()) return;
                    const chatIdAtStart = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
                    const extras = Array.isArray(stApi.chatMetadata?.pcx_extra_world_info)
                        ? stApi.chatMetadata.pcx_extra_world_info.map(x => String(x || '').trim()).filter(Boolean)
                        : [];
                    if (!extras.length) return;
                    const alreadyLoaded = new Set([
                        ...(payload.globalLore || []).map(e => e?.world),
                        ...(payload.characterLore || []).map(e => e?.world),
                        ...(payload.chatLore || []).map(e => e?.world),
                        ...(payload.personaLore || []).map(e => e?.world),
                    ].filter(Boolean));
                    const loadedEntries = [];
                    for (const bookName of extras) {
                        if (alreadyLoaded.has(bookName)) continue;
                        try {
                            let data = null;
                            if (typeof worldInfoModRef?.loadWorldInfo === 'function') {
                                data = await worldInfoModRef.loadWorldInfo(bookName);
                            } else {
                                const r = await fetch('/api/worldinfo/get', {
                                    method: 'POST', headers: stApi.getRequestHeaders(), body: JSON.stringify({ name: bookName }),
                                });
                                if (r.ok) data = await r.json();
                            }
                            if (data?.entries && typeof data.entries === 'object') {
                                for (const [dictKey, ent] of Object.entries(data.entries)) {
                                    if (!ent || typeof ent !== 'object') continue;
                                    const resolvedUid = (ent.uid !== undefined && ent.uid !== null && ent.uid !== '')
                                        ? ent.uid
                                        : (Number.isNaN(Number(dictKey)) ? dictKey : Number(dictKey));
                                    const { uid: _ignored, ...rest } = ent;
                                    loadedEntries.push({ uid: resolvedUid, world: bookName, ...rest });
                                }
                                alreadyLoaded.add(bookName);
                            }
                        } catch (bookErr) {
                            console.warn(`[PocketCodex] Skipping broken extra chat lorebook "${bookName}":`, bookErr);
                        }
                    }
                    const chatIdNow = stApi.ctx?.getCurrentChatId?.() || stApi.ctx?.chatId || '';
                    if (stApi.isChatOpen() && chatIdNow === chatIdAtStart) {
                        payload.chatLore.push(...loadedEntries);
                    }
                } catch (err) {
                    console.warn('[PocketCodex] Extra chat lorebooks load warning:', err);
                }
            };
            evSource.on(evTypes.WORLDINFO_ENTRIES_LOADED, loadExtraChatLore);
            evSource.makeFirst?.(evTypes.WORLDINFO_ENTRIES_LOADED, loadExtraChatLore);
        }
        if (evTypes.WORLDINFO_UPDATED) {
            evSource.on(evTypes.WORLDINFO_UPDATED, (bookName, bookData) => {
                if (stApi.isOwnWorldInfoSave(bookData)) return;
                const changed = forgeCtrl?.onExternalWorldInfoUpdated?.(bookName, bookData);
                if (!changed) return;
                const dlg = document.getElementById('pcx-dialog');
                const isEditingAny = uiState.codexSub === 'edit' || uiState.subModal !== null || forgeCtrl?.isEditingForm;
                if (dlg?.open && !isEditingAny) {
                    renderModal({ preserveBodyScroll: true });
                }
            });
        }
        if (evTypes.WORLD_INFO_ACTIVATED) {
            evSource.on(evTypes.WORLD_INFO_ACTIVATED, (activatedList) => {
                lastActivatedWiKeys.clear();
                if (Array.isArray(activatedList)) {
                    for (const ent of activatedList) {
                        if (ent && ent.world !== undefined && ent.uid !== undefined) {
                            lastActivatedWiKeys.add(`${ent.world}::${ent.uid}`);
                        }
                    }
                }
                const dlg = document.getElementById('pcx-dialog');
                const isEditingAny = uiState.codexSub === 'edit' || uiState.subModal !== null || forgeCtrl?.isEditingForm;
                if (dlg?.open && !isEditingAny) {
                    renderModal({ preserveBodyScroll: true });
                }
            });
        }
        for (const ev of [evTypes.CHAT_CHANGED, evTypes.GENERATION_STARTED, evTypes.MESSAGE_SENT, evTypes.MESSAGE_RECEIVED, evTypes.MESSAGE_DELETED, evTypes.WORLDINFO_SETTINGS_UPDATED].filter(Boolean)) {
            evSource.on(ev, () => {
                if (ev === evTypes.GENERATION_STARTED) lastActivatedWiKeys.clear();
                if (ev === evTypes.CHAT_CHANGED) {
                    codexAiSeq++;
                    lastActivatedWiKeys.clear();
                    resetEditDrafts();
                    forgeCtrl?.resetTransientState?.();
                }
                updateExtensionPrompt();
                const dlg = document.getElementById('pcx-dialog');
                if (!dlg?.open) return;
                if (ev === evTypes.CHAT_CHANGED) {
                    renderModal({ preserveBodyScroll: true });
                    return;
                }
                const isEditingAny = uiState.codexSub === 'edit' || uiState.subModal !== null || forgeCtrl?.isEditingForm;
                if (!isEditingAny && (ev === evTypes.WORLDINFO_SETTINGS_UPDATED || ev === evTypes.MESSAGE_SENT || ev === evTypes.MESSAGE_RECEIVED)) {
                    renderModal({ preserveBodyScroll: true });
                }
            });
        }
    }
});
