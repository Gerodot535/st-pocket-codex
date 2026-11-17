import { THEMES, LANGUAGES, HELP_TIPS, HELP_TIPS_EN, ICONS, THEME_CRESTS, THEME_BANNERS, SUITE_CSS } from './modules/themes_and_icons.js';
import { CODEX_PROMPT_PRESETS, FORGE_BOOK_PRESETS, formatCleanParagraphs, UI_DICT, tUi, displayCategoryName } from './modules/presets_and_i18n.js';
import { createForgeController } from './modules/forge_module.js';

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
    theme: 'krakoa',
    scope: 'chat',
    activeTab: 'classic_an',
    showTooltips: true,
    includeGlobalWithChat: true,
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
    globalData: { categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)), notes: [] },
};

const NOTE_OUTPUT_JSON_SCHEMA = {
    name: 'author_note_response', strict: true,
    value: {
        type: 'object',
        properties: { title: { type: 'string' }, content: { type: 'string' } },
        required: ['title', 'content'], additionalProperties: false,
    },
};

let stApi = null, scriptModRef = null, sharedModRef = null, powerUserModRef = null, worldInfoModRef = null, forgeCtrl = null;
let isExpandingMacro = false;
const activeRegisteredPromptKeys = new Set();

let uiState = {
    wing: 'codex', view: 'notes', sectionMode: 'create', secDraft: null, editTab: 'manual',
    showGmPromptEditor: false, openTipId: null, editingNoteId: null, draftAttachments: null,
    showThemes: false, aiGenerating: false, aiPromptDraft: '', aiRefinementText: '',
    aiCandidates: [], aiCandidateIdx: 0, aiStatus: '',
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

async function initStApi() {
    const ctx = window.SillyTavern?.getContext?.() || {};
    let scriptMod = {}, extMod = {};
    try { scriptMod = await import('../../../script.js'); } catch {}
    try { extMod = await import('../../extensions.js'); } catch {}
    try { sharedModRef = await import('../../shared.js'); } catch {}
    try { powerUserModRef = await import('../../power-user.js'); } catch {
        try { powerUserModRef = await import('../../../power-user.js'); } catch {}
    }
    try { worldInfoModRef = await import('../../world-info.js'); } catch {
        try { worldInfoModRef = await import('../../../world-info.js'); } catch {}
    }
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
        saveSettings() { const fn = this.ctx.saveSettingsDebounced || scriptMod.saveSettingsDebounced; if (typeof fn === 'function') fn(); },
        saveMetadata() { if (!this.isChatOpen()) return; const fn = this.ctx.saveMetadataDebounced || extMod.saveMetadataDebounced || scriptMod.saveChatDebounced; if (typeof fn === 'function') fn(); },
        setPrompt(key, value, pos, depth, scan, role) { const fn = this.ctx.setExtensionPrompt || scriptMod.setExtensionPrompt; if (typeof fn === 'function') fn(key, value, pos, depth, scan, role); },
        registerMacro(name, fn) { if (typeof this.ctx.registerMacro === 'function') { try { this.ctx.registerMacro(name, fn); } catch {} } },
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
                    const cmd = isActive ? `/world state=off silent=true ${bookId}` : `/world silent=true ${bookId}`;
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
            this.saveMetadata();
            await this.refreshWorldInfoUI();
            if (typeof worldInfoModRef?.getSortedEntries === 'function') {
                try { await worldInfoModRef.getSortedEntries(); } catch {}
            }
            return idx === -1;
        },
        async toggleCharLorebook(bookId) {
            const c = this.ctx;
            if (c.characterId === undefined || c.characterId === null || c.characterId === '') return false;
            const ch = Array.isArray(c.characters) ? c.characters[c.characterId] : null;
            if (!ch) return false;
            const cur = ch?.data?.extensions?.world || '';
            const nextVal = (cur === bookId) ? '' : bookId;
            if (!ch.data) ch.data = {};
            if (!ch.data.extensions) ch.data.extensions = {};
            if (nextVal) ch.data.extensions.world = nextVal;
            else delete ch.data.extensions.world;
            if (typeof c.writeExtensionField === 'function') {
                try { await c.writeExtensionField(c.characterId, 'world', nextVal); } catch {}
            } else if (typeof scriptMod.saveCharacterDebounced === 'function') {
                scriptMod.saveCharacterDebounced();
            }
            if (window.jQuery) {
                window.jQuery('#character_world').val(nextVal);
            }
            await this.refreshWorldInfoUI();
            return Boolean(nextVal);
        },
        async saveWorldInfoNative(name, data) {
            if (typeof worldInfoModRef?.saveWorldInfo === 'function') await worldInfoModRef.saveWorldInfo(name, data, true);
            else throw new Error('Fallback REST');
        },
        async deleteWorldInfoBook(name) {
            const res = await fetch('/api/worldinfo/delete', {
                method: 'POST', headers: this.getRequestHeaders(), body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error('Не удалось удалить файл Лорбука.');
            await this.refreshWorldInfoUI();
        },
        async refreshWorldInfoUI() {
            if (typeof worldInfoModRef?.updateWorldInfoList === 'function') { try { await worldInfoModRef.updateWorldInfoList(); } catch {} }
        },
        async generateWithSchemaFallback(systemPrompt, userPrompt, schemaObj) {
            const fn = this.ctx.generateRaw || scriptMod.generateRaw;
            if (typeof fn === 'function') {
                try { return await fn({ prompt: userPrompt, systemPrompt, jsonSchema: schemaObj }); }
                catch { return await fn({ prompt: userPrompt, systemPrompt }); }
            }
            const qFn = this.ctx.generateQuietPrompt || scriptMod.generateQuietPrompt;
            if (typeof qFn === 'function') return await qFn({ quietPrompt: `${systemPrompt}\n\n${userPrompt}`, quietToLoud: false, skipWIAN: true });
            throw new Error('Активное подключение не найдено.');
        },
    };
}

function injectStylesAndFonts() {
    const existing = document.getElementById('pcx-embedded-css');
    if (existing) existing.textContent = SUITE_CSS;
    else {
        const st = document.createElement('style');
        st.id = 'pcx-embedded-css'; st.textContent = SUITE_CSS; document.head.appendChild(st);
    }
    if (!document.getElementById('pcx-google-fonts')) {
        const link = document.createElement('link');
        link.id = 'pcx-google-fonts'; link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=JetBrains+Mono:wght@400;600;700&family=Montserrat:wght@500;600;700;800&family=Caveat:wght@600;700&display=swap';
        document.head.appendChild(link);
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
    for (const n of store.notes) {
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
    // Upgrade legacy un-spaced GM default prompt seamlessly
    if (typeof s.gmSystemPrompt === 'string' && s.gmSystemPrompt.includes(LEGACY_GM_PROMPT_SNIPPET)) {
        s.gmSystemPrompt = DEFAULT_GM_SYSTEM_PROMPT;
    }
    if (!s.globalData || typeof s.globalData !== 'object') s.globalData = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.globalData));
    else normalizeStore(s.globalData);
    return s;
}

function getActiveCodexPreset() {
    const s = ensureSettings();
    return CODEX_PROMPT_PRESETS.find(p => p.id === s.gmPresetId) || CODEX_PROMPT_PRESETS[0];
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

function describeCategoryRouteShort(cat) {
    if (!cat) return '';
    const uiLang = ensureSettings().uiLang || 'ru';
    const pos = Number(cat.injectPos);
    const r = ({ 0: 'System', 1: 'User', 2: 'Assistant' })[Number(cat.injectRole) || 0] || 'System';
    if (pos === ST_POS.LOCAL_ONLY) return tUi(uiLang, 'Никуда', 'Nowhere');
    if (pos === ST_POS.MACRO_ONLY) return tUi(uiLang, 'В макрос', 'Macro');
    if (pos === ST_POS.BEFORE_MAIN) return tUi(uiLang, 'Перед промптом', 'Before Prompt');
    if (pos === ST_POS.AFTER_MAIN) return tUi(uiLang, 'После промпта', 'After Prompt');
    return `${tUi(uiLang, 'Глубина', 'Depth')} ${Math.max(0, Number(cat.injectDepth) || 0)} · ${r}`;
}

function compressImageFile(file, maxSide = 780, quality = 0.78) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Ошибка чтения картинки'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Неподдерживаемый формат'));
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > maxSide || h > maxSide) {
                    if (w > h) { h = Math.round((h * maxSide) / w); w = maxSide; }
                    else { w = Math.round((w * maxSide) / h); h = maxSide; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve({ id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), kind: 'image', name: file.name, dataUrl: canvas.toDataURL('image/webp', quality) });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function readTextAttachment(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 450 * 1024) { reject(new Error('Файл больше 450 КБ')); return; }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.onload = () => resolve({ id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), kind: 'text', name: file.name, text: String(reader.result || '').trim(), includeInPrompt: true });
        reader.readAsText(file);
    });
}

function openImageLightbox(src) {
    document.getElementById('pcx-lightbox')?.remove();
    const box = document.createElement('div'); box.id = 'pcx-lightbox';
    const img = document.createElement('img'); img.src = src; box.appendChild(img);
    box.addEventListener('click', () => box.remove());
    (document.getElementById('pcx-dialog') || document.body).appendChild(box);
}

function formatSingleCharCard(ch, fallbackName) {
    if (!ch) return '';
    const name = ch.name || fallbackName || 'Персонаж';
    const desc = (ch.description || ch.data?.description || '').trim();
    const pers = (ch.personality || ch.data?.personality || '').trim();
    const scen = (ch.scenario || ch.data?.scenario || '').trim();
    const parts = [];
    if (desc) parts.push(desc);
    if (pers) parts.push(`Личность: ${pers}`);
    if (scen) parts.push(`Сценарий: ${scen}`);
    return parts.length ? `[Описание персонажа (${name})]\n${parts.join('\n')}` : '';
}

function getCharacterDescriptionText() {
    try {
        const ctx = stApi.ctx;
        const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
        if (ctx.groupId && Array.isArray(ctx.groups)) {
            const grp = ctx.groups.find(g => String(g.id) === String(ctx.groupId));
            if (grp && Array.isArray(grp.members)) {
                const blocks = grp.members.map(av => chars.find(c => c.avatar === av)).map(ch => formatSingleCharCard(ch)).filter(Boolean);
                if (blocks.length) return blocks.join('\n\n');
            }
        }
        if (ctx.characterId !== undefined && ctx.characterId !== null && chars[ctx.characterId]) {
            return formatSingleCharCard(chars[ctx.characterId], ctx.name2);
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
    if (raw && typeof raw === 'object' && typeof raw.content === 'string' && typeof raw.title === 'string') {
        return { title: raw.title.trim(), content: formatCleanParagraphs(raw.content) };
    }
    let txt = typeof raw === 'string' ? raw : (raw?.content || raw?.choices?.[0]?.message?.content || raw?.text || '');
    txt = String(txt || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const unfenced = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
        const fb = unfenced.indexOf('{'), lb = unfenced.lastIndexOf('}');
        if (fb !== -1 && lb > fb) {
            const p = JSON.parse(unfenced.slice(fb, lb + 1));
            const cStr = typeof p.content === 'string' ? p.content : (p.note || p.text || '');
            if (cStr) return { title: String(p.title || '').trim(), content: formatCleanParagraphs(cStr) };
        }
    } catch {}
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
        const docs = attachments.filter(a => a.kind === 'text' && a.text);
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

    const userPrompt = parts.join('\n\n');
    const profileId = s.aiProfileId || '';
    const service = stApi.connectionService;
    const maxTokens = Math.max(800, Number(s.aiMaxTokens) || 3400);

    if (profileId && service && typeof service.sendRequest === 'function') {
        const chosen = getConnectionProfiles().find(p => p.id === profileId);
        if (chosen) {
            const isTc = chosen.mode === 'tc';
            const payload = isTc ? `${systemPrompt}\n\n${userPrompt}` : [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
            try {
                const res = await service.sendRequest(profileId, payload, maxTokens, { stream: false, extractData: true, includePreset: false, includeInstruct: false }, isTc ? {} : { response_format: { type: 'json_schema', json_schema: { name: NOTE_OUTPUT_JSON_SCHEMA.name, strict: true, schema: NOTE_OUTPUT_JSON_SCHEMA.value } } });
                return extractNoteFromModelOutput(res);
            } catch {
                const res2 = await service.sendRequest(profileId, payload, maxTokens, { stream: false, extractData: true, includePreset: false, includeInstruct: false });
                return extractNoteFromModelOutput(res2);
            }
        }
    }
    return extractNoteFromModelOutput(await stApi.generateWithSchemaFallback(systemPrompt, userPrompt, NOTE_OUTPUT_JSON_SCHEMA));
}

// ==================== CLEAN SPACED HEADERS & SUBHEADERS ====================
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
    const mainText = String(note.content || '').replace(/\{\{notebook\}\}/gi, '').trim();
    if (mainText) {
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
    if (Array.isArray(note.attachments)) {
        for (const att of note.attachments) {
            if (att.kind === 'text' && att.includeInPrompt !== false && att.text) {
                pieces.push(String(att.text).replace(/\{\{notebook\}\}/gi, '').trim());
            }
        }
    }
    return pieces.filter(Boolean).join('\n\n');
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
            const compiled = activeNotes.map(n => compileSingleNoteText(n, cat)).filter(Boolean);
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
    const mode = secDraft?.headerMode || 'sec_and_custom_notes';
    const subStyle = secDraft?.subHeaderStyle || 'h4_blank';
    const showSec = (mode === 'sec_and_auto_notes' || mode === 'sec_and_custom_notes');
    const showSub = (mode !== 'none');
    const sampleTitle = tUi(uiLang, 'Походное снаряжение и реликвии', 'Field Gear & Relics');
    const sampleBody = tUi(
        uiLang,
        '[ОБЩАЯ СУТЬ] Каждая вещь в дорожной сумке хранит память о старых странствиях.\n\n[ЗВЕЗДНЫЙ КОМПАС] Латунный прибор с треснувшим стеклом, указывающий путь сквозь туман.',
        '[OVERVIEW] Every item in the travel satchel carries a memory of past expeditions.\n\n[STAR COMPASS] Brass instrument with cracked glass that points through unnatural fog.',
    );
    const noteFormatted = showSub
        ? formatSubheaderWithBody(sampleTitle, sampleBody, subStyle, false)
        : sampleBody;
    return showSec ? `### ${secName}\n\n${noteFormatted}` : noteFormatted;
}

function buildMacroNotebookText() {
    if (isExpandingMacro) return '';
    isExpandingMacro = true;
    try { return gatherOrderedSectionsWithNotes().filter(sec => sec.pos === ST_POS.MACRO_ONLY).map(sec => sec.text).join('\n\n').trim(); }
    finally { isExpandingMacro = false; }
}

function buildAutoInjectGroups(ignoreInterval = false) {
    const all = gatherOrderedSectionsWithNotes();
    const chatLen = Array.isArray(stApi.ctx?.chat) ? stApi.ctx.chat.length : 0;
    const groupsMap = new Map();
    for (const sec of all) {
        if (sec.pos === ST_POS.MACRO_ONLY || sec.pos === ST_POS.LOCAL_ONLY) continue;
        if (!ignoreInterval && sec.interval > 1 && (chatLen % sec.interval !== 0)) continue;
        const effectiveDepth = sec.pos === ST_POS.IN_CHAT ? sec.depth : 0;
        const sig = `p${sec.pos}_d${effectiveDepth}_r${sec.role}`;
        if (!groupsMap.has(sig)) groupsMap.set(sig, { sig, pos: sec.pos, depth: effectiveDepth, role: sec.role, sectionNames: [], blocks: [] });
        const g = groupsMap.get(sig);
        g.sectionNames.push(sec.name); g.blocks.push(sec.text);
    }
    return Array.from(groupsMap.values()).map(g => ({ ...g, combinedText: g.blocks.join('\n\n').trim() }));
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

function updateExtensionPrompt() {
    stApi.setPrompt('st_pocket_codex_prompt', '', ST_POS.MACRO_ONLY, 0, false, ST_ROLE.SYSTEM);
    for (const oldKey of activeRegisteredPromptKeys) stApi.setPrompt(oldKey, '', ST_POS.MACRO_ONLY, 0, false, ST_ROLE.SYSTEM);
    activeRegisteredPromptKeys.clear();
    buildAutoInjectGroups(false).forEach((g, idx) => {
        const key = `${PROMPT_KEY_PREFIX}${idx}_${g.sig}`;
        activeRegisteredPromptKeys.add(key);
        stApi.setPrompt(key, g.combinedText, g.pos, g.depth, false, g.role);
    });
}

function saveAll() {
    updateExtensionPrompt(); stApi.saveSettings(); stApi.saveMetadata();
}

function applyThemeClasses() {
    const s = ensureSettings();
    const themeObj = THEMES.find(t => t.id === s.theme) || THEMES[0];
    const win = document.getElementById('pcx-window');
    if (win) {
        THEMES.forEach(t => win.classList.remove(`pcx-theme-${t.id}`));
        win.classList.add(`pcx-theme-${themeObj.id}`);
        win.classList.toggle('pcx-no-tips', s.showTooltips === false);
    }
}

function enableSmoothCardDrag(win, store, currentCatId) {
    const bodyEl = win.querySelector('.pcx-body');
    if (!bodyEl) return;
    const startCardDrag = (card, startClientY, isTouch) => {
        window.getSelection?.()?.removeAllRanges?.();
        document.body.classList.add('pcx-dragging-active');
        navigator.vibrate?.(14);
        const rect = card.getBoundingClientRect();
        const placeholder = document.createElement('div');
        placeholder.className = 'pcx-drag-placeholder'; placeholder.style.height = `${rect.height}px`;
        card.parentNode.insertBefore(placeholder, card);
        card.classList.add('pcx-card-floating');
        card.style.width = `${rect.width}px`; card.style.left = `${rect.left}px`; card.style.top = `${rect.top}px`;
        card.style.transform = 'translate3d(0, 0px, 0)';
        let latestY = startClientY, rafId = null;

        const updatePosition = () => {
            rafId = null;
            card.style.transform = `translate3d(0, ${latestY - startClientY}px, 0)`;
            const bodyRect = bodyEl.getBoundingClientRect();
            if (latestY < bodyRect.top + 48) bodyEl.scrollTop -= 9;
            else if (latestY > bodyRect.bottom - 48) bodyEl.scrollTop += 9;
            const siblings = [...bodyEl.querySelectorAll('.pcx-card:not(.pcx-card-floating)')];
            let beforeNode = null;
            for (const sib of siblings) {
                const r = sib.getBoundingClientRect();
                if (latestY < r.top + r.height / 2) { beforeNode = sib; break; }
            }
            if (beforeNode) { if (placeholder.nextSibling !== beforeNode) bodyEl.insertBefore(placeholder, beforeNode); }
            else bodyEl.appendChild(placeholder);
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
            card.style.width = ''; card.style.left = ''; card.style.top = ''; card.style.transform = '';
            placeholder.parentNode?.insertBefore(card, placeholder); placeholder.remove();
            const orderedIds = [...bodyEl.querySelectorAll('.pcx-card')].map(el => el.dataset.noteId).filter(Boolean);
            const catMap = new Map();
            for (const n of store.notes) if (n.categoryId === currentCatId) catMap.set(n.id, n);
            const reordered = orderedIds.map(id => catMap.get(id)).filter(Boolean);
            const res = []; let ins = false;
            for (const n of store.notes) {
                if (n.categoryId === currentCatId) { if (!ins) { res.push(...reordered); ins = true; } }
                else res.push(n);
            }
            if (!ins) res.push(...reordered);
            store.notes = res; saveAll();
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
    bodyEl.querySelectorAll('.pcx-card-grip').forEach(grip => {
        grip.addEventListener('contextmenu', e => e.preventDefault());
        grip.addEventListener('touchstart', e => {
            if (e.touches.length !== 1) return;
            e.preventDefault(); e.stopPropagation();
            const card = grip.closest('.pcx-card'); if (card) startCardDrag(card, e.touches[0].clientY, true);
        }, { passive: false });
        grip.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            const card = grip.closest('.pcx-card'); if (card) startCardDrag(card, e.clientY, false);
        });
    });
}

function enableTabReorder(win, store, settings) {
    const tabsBar = win.querySelector('.pcx-tabs-bar');
    if (!tabsBar) return;
    let suppressNextClick = false;
    const persistTabOrderFromDom = () => {
        const ids = [...tabsBar.querySelectorAll('.pcx-tab')].map(el => el.dataset.tab).filter(Boolean);
        const map = new Map(store.categories.map(c => [c.id, c]));
        const nextCats = ids.map(id => map.get(id)).filter(Boolean);
        if (nextCats.length === store.categories.length) { store.categories = nextCats; saveAll(); }
    };
    const moveTabAtClientX = (tab, clientX) => {
        const barRect = tabsBar.getBoundingClientRect();
        if (clientX < barRect.left + 40) tabsBar.scrollLeft -= 8;
        else if (clientX > barRect.right - 40) tabsBar.scrollLeft += 8;
        const siblings = [...tabsBar.querySelectorAll('.pcx-tab:not(.pcx-tab-dragging)')];
        let beforeEl = null;
        for (const sib of siblings) {
            const r = sib.getBoundingClientRect();
            if (clientX < r.left + r.width / 2) { beforeEl = sib; break; }
        }
        if (beforeEl) tabsBar.insertBefore(tab, beforeEl); else tabsBar.appendChild(tab);
    };
    tabsBar.querySelectorAll('.pcx-tab').forEach(tab => {
        tab.addEventListener('contextmenu', e => e.preventDefault());
        tab.addEventListener('click', e => {
            if (suppressNextClick) { e.preventDefault(); e.stopPropagation(); suppressNextClick = false; return; }
            resetEditDrafts(); settings.activeTab = tab.dataset.tab; uiState.view = 'notes';
            saveAll(); renderModal({ preserveTabsScroll: true });
        });
        let holdTimer = null, isTouchDragging = false, startX = 0, startY = 0;
        tab.addEventListener('touchstart', e => {
            if (e.touches.length !== 1) return;
            startX = e.touches[0].clientX; startY = e.touches[0].clientY; isTouchDragging = false;
            holdTimer = setTimeout(() => {
                isTouchDragging = true; suppressNextClick = true;
                window.getSelection?.()?.removeAllRanges?.();
                document.body.classList.add('pcx-dragging-active');
                tab.classList.add('pcx-tab-dragging'); navigator.vibrate?.(18);
            }, 220);
        }, { passive: true });
        tab.addEventListener('touchmove', e => {
            const t = e.touches[0]; if (!t) return;
            if (!isTouchDragging) { if (Math.abs(t.clientX - startX) > 9 || Math.abs(t.clientY - startY) > 9) clearTimeout(holdTimer); return; }
            if (e.cancelable) e.preventDefault();
            moveTabAtClientX(tab, t.clientX);
        }, { passive: false });
        const endTouch = () => {
            clearTimeout(holdTimer);
            if (isTouchDragging) {
                isTouchDragging = false; document.body.classList.remove('pcx-dragging-active');
                tab.classList.remove('pcx-tab-dragging'); persistTabOrderFromDom();
                setTimeout(() => { suppressNextClick = false; }, 120);
            }
        };
        tab.addEventListener('touchend', endTouch); tab.addEventListener('touchcancel', endTouch);
        tab.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            const mStartX = e.clientX; let mouseDragging = false;
            const onMouseMove = ev => {
                if (!mouseDragging && Math.abs(ev.clientX - mStartX) > 7) { mouseDragging = true; suppressNextClick = true; tab.classList.add('pcx-tab-dragging'); }
                if (mouseDragging) { ev.preventDefault(); moveTabAtClientX(tab, ev.clientX); }
            };
            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp);
                if (mouseDragging) { tab.classList.remove('pcx-tab-dragging'); persistTabOrderFromDom(); setTimeout(() => { suppressNextClick = false; }, 80); }
            };
            window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
        });
    });
}

function renderModal(opts = {}) {
    const s = ensureSettings();
    const uiLang = s.uiLang || 'ru';
    const dUi = UI_DICT[uiLang] || UI_DICT.ru;
    const chatOpen = stApi.isChatOpen();
    const store = getActiveStore();
    const themeObj = THEMES.find(t => t.id === s.theme) || THEMES[0];

    if (!store.categories.some(c => c.id === s.activeTab)) s.activeTab = store.categories[0]?.id || 'classic_an';
    const currentCat = store.categories.find(c => c.id === s.activeTab) || store.categories[0];

    const win = document.getElementById('pcx-window');
    if (!win) return;

    const prevTabsBar = win.querySelector('.pcx-tabs-bar');
    const savedTabsScroll = prevTabsBar ? prevTabsBar.scrollLeft : 0;
    const prevBody = win.querySelector('.pcx-body');
    const savedBodyScroll = opts.preserveBodyScroll && prevBody ? prevBody.scrollTop : 0;

    applyThemeClasses();

    const themePillsHtml = THEMES.map(t => `
        <button type="button" class="pcx-theme-pill ${t.id === s.theme ? 'pcx-active' : ''}" data-theme="${t.id}">
            <span class="pcx-theme-dot" style="background:${t.color}"></span><span>${escapeHtml(uiLang === 'en' ? (t.nameEn || t.name) : t.name)}</span>
        </button>`).join('');

    const isForgeWing = (uiState.wing === 'forge' && uiState.view !== 'guide' && uiState.view !== 'inject');
    let navSectionHtml = '', bodyHtml = '', footerHtml = '';

    if (uiState.view === 'guide') {
        bodyHtml = `
            <div class="pcx-panel-box">
                <div style="font-size:15px;font-weight:800;">${tUi(uiLang, 'Подробный путеводитель', 'Quick User Guide')}</div>
                <details class="pcx-spoiler" open>
                    <summary><span>1. Кодекс Автора и Кузница — всё в одном окне!</span><span style="width:15px;height:15px;display:inline-flex">${ICONS.chevDown}</span></summary>
                    <div class="pcx-spoiler-body">
                        <div>• <b>Кодекс Автора</b> — гибкие заметки для сюжета, отношений, правил сцены и коллекций вещей с отправкой на любую глубину чата.</div>
                        <div>• <b>Кузница Лорбуков</b> — полноценная полка и редактор всех Лорбуков Таверны! Включай книги Глобально, В чат или К персонажу, проверяй рекурсию ключей и создавай как целые миры, так и отдельные страницы вручную или с Соавтором.</div>
                    </div>
                </details>
                <details class="pcx-spoiler">
                    <summary><span>${tUi(uiLang, '2. Гибкие заголовки и чистые отступы (без склейки!)', '2. Clean Headers & Paragraph Spacing')}</span><span style="width:15px;height:15px;display:inline-flex">${ICONS.chevDown}</span></summary>
                    <div class="pcx-spoiler-body">
                        <div><b>${tUi(uiLang, 'Раздел + подзаголовок записи с отступом (по умолчанию):', 'Section + Note Subheader with blank line (default):')}</b><div class="pcx-preview-box" style="margin-top:4px">### ${tUi(uiLang, 'Арсенал и Реликвии', 'Relics & Gear')}\n\n#### ${tUi(uiLang, 'Походное снаряжение', 'Field Gear')}\n\n[${tUi(uiLang, 'ОБЩАЯ СУТЬ', 'OVERVIEW')}] ${tUi(uiLang, 'Каждая вещь хранит след давней экспедиции.', 'Every item bears the mark of an old expedition.')}\n\n[${tUi(uiLang, 'ЗВЕЗДНЫЙ КОМПАС', 'STAR COMPASS')}] ${tUi(uiLang, 'Старинный латунный прибор с треснувшим стеклом.', 'Antique brass compass with cracked glass.')}</div></div>
                        <div><b>${tUi(uiLang, 'Скобочный стиль подзаголовка:', 'Bracketed Subheader Style:')}</b><div class="pcx-preview-box" style="margin-top:4px">[${tUi(uiLang, 'Походное снаряжение', 'Field Gear')}]\n\n${tUi(uiLang, 'Каждая вещь хранит след давней экспедиции.', 'Every item bears the mark of an old expedition.')}</div></div>
                        <div><b>${tUi(uiLang, 'Без оглавлений (чистый текст):', 'No Headings (Plain Text):')}</b><div class="pcx-preview-box" style="margin-top:4px">[${tUi(uiLang, 'Правило: подробно описывай атмосферу, звуки и мимику.', 'Rule: describe atmosphere, sounds, and subtle expressions.')}]</div></div>
                    </div>
                </details>
                <details class="pcx-spoiler">
                    <summary><span>3. Пресеты промптов, Рекурсия и кнопка «Отступы»</span><span style="width:15px;height:15px;display:inline-flex">${ICONS.chevDown}</span></summary>
                    <div class="pcx-spoiler-body">
                        <div>• <b>Шаблоны промптов</b> — выбирай готовые роли для Соавтора и Кузницы (генератор свежих идей без пересказа анкеты, динамика отношений, каталог реликвий, атлас локаций, фракции и др.).</div>
                        <div>• <b>Инспектор рекурсии</b> — в любой книге нажми «Рекурсия», чтобы проверить, не цепляют ли статьи друг друга по кольцу, и изолируй петли в один клик.</div>
                        <div>• <b>Кнопка «Отступы»</b> — в редакторе записи или страницы в один клик разделяет слипшиеся блоки и подзаголовки пустыми строками.</div>
                    </div>
                </details>
            </div>`;
    } else if (uiState.view === 'inject') {
        const autoGroups = buildAutoInjectGroups(true);
        const macroPreview = buildMacroNotebookText();
        const roleLabels = { 0: 'System', 1: 'User', 2: 'Assistant' };
        const autoGroupsHtml = autoGroups.length === 0
            ? `<div class="pcx-preview-box">(Нет активных разделов на авто-инжекте)</div>`
            : autoGroups.map(g => {
                const where = g.pos === ST_POS.BEFORE_MAIN ? `Перед главным промптом · ${roleLabels[g.role]}` : (g.pos === ST_POS.AFTER_MAIN ? `После главного промпта · ${roleLabels[g.role]}` : `В чате @ Глубина ${g.depth} · ${roleLabels[g.role]}`);
                return `<div style="display:flex;flex-direction:column;gap:5px;"><span style="font-size:11.5px;font-weight:700;color:var(--pcx-accent);">${escapeHtml(where)} (${escapeHtml(g.sectionNames.join(' + '))})</span><div class="pcx-preview-box notranslate" translate="no">${escapeHtml(g.combinedText)}</div></div>`;
            }).join('');

        bodyHtml = `
            <div class="pcx-panel-box">
                <div>
                    <label class="pcx-field-label">${escapeHtml(dUi.uiLangLabel)}</label>
                    <select id="pcx-ui-lang-select" class="pcx-select">
                        <option value="ru" ${uiLang === 'ru' ? 'selected' : ''}>Русский (RU)</option>
                        <option value="en" ${uiLang === 'en' ? 'selected' : ''}>English (EN)</option>
                    </select>
                </div>
                <div class="pcx-toggle-row" id="pcx-tips-master-toggle">
                    <div class="pcx-toggle-row-text"><span class="pcx-toggle-row-title">${tUi(uiLang, 'Показывать значки подсказок (?) в интерфейсе', 'Show (?) Help Tooltips in UI')}</span><span class="pcx-toggle-row-sub">${tUi(uiLang, 'Выключи, когда освоишься', 'Hide inline help badges')}</span></div>
                    <div class="pcx-switch ${s.showTooltips !== false ? 'pcx-on' : ''}"></div>
                </div>
                <div class="pcx-toggle-row" id="pcx-inc-global-toggle">
                    <div class="pcx-toggle-row-text"><span class="pcx-toggle-row-title">${tUi(uiLang, 'Подключать «Общие» разделы ко всем чатам', 'Include Global Sections in All Chats')}</span><span class="pcx-toggle-row-sub">${tUi(uiLang, 'Объединяет сквозные записи с записями текущего чата', 'Merges global notes with active chat notes')}</span></div>
                    <div class="pcx-switch ${s.includeGlobalWithChat ? 'pcx-on' : ''}"></div>
                </div>
                <div style="padding-top:6px;border-top:1px solid var(--pcx-border);display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                        <div><div style="font-size:12.5px;font-weight:700;">Макрос пресетов ${renderHelpBtn('macro_info')}</div><div style="font-size:11px;color:var(--pcx-text-muted);">Собирает разделы со статусом «В макрос»</div></div>
                        <button type="button" class="pcx-macro-chip notranslate" translate="no" data-copy="{{notebook}}">${ICONS.copy}<span>{{notebook}}</span></button>
                    </div>
                    ${renderHelpBubble('macro_info')}
                    <div class="pcx-preview-box notranslate" translate="no">${escapeHtml(macroPreview || '(Пусто)')}</div>
                </div>
                <div style="padding-top:6px;border-top:1px solid var(--pcx-border);display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:12.5px;font-weight:700;">${tUi(uiLang, 'Карта активных авто-инжектов Кодекса (с отступами)', 'Active Codex Auto-Inject Map')}</div>
                    ${autoGroupsHtml}
                </div>
                <div style="padding-top:10px;border-top:1px solid var(--pcx-border);display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                    <div style="font-size:11.5px;color:var(--pcx-text-muted);">${tUi(uiLang, 'Сбросить тему, промпты и настройки расширения к заводским (заметки чатов сохранятся)', 'Reset extension theme, prompts & settings to factory defaults (chat notes stay safe)')}</div>
                    <button type="button" class="pcx-mini-btn" id="pcx-reset-all-settings-btn" style="border-color:var(--pcx-accent-2);color:var(--pcx-accent-2);height:32px;padding:0 12px;">${ICONS.reset}<span>${tUi(uiLang, 'Сбросить настройки по умолчанию', 'Reset Settings to Default')}</span></button>
                </div>
            </div>`;
    } else if (isForgeWing) {
        bodyHtml = forgeCtrl.renderForgeBody();
    } else {
        const tabsHtml = `<button type="button" class="pcx-add-tab-pill" id="pcx-add-tab-btn">${ICONS.plus}<span>${escapeHtml(dUi.addSection)}</span></button>` +
            store.categories.map(cat => {
                const count = store.notes.filter(n => n.categoryId === cat.id && n.enabled !== false).length;
                const isActive = cat.id === s.activeTab && (uiState.view === 'notes' || (uiState.view === 'section_editor' && uiState.sectionMode === 'edit'));
                return `<button type="button" class="pcx-tab ${isActive ? 'pcx-active' : ''} ${cat.enabled === false ? 'pcx-tab-muted' : ''}" data-tab="${escapeHtml(cat.id)}"><span>${escapeHtml(displayCategoryName(cat, uiLang))}</span>${count > 0 ? `<span class="pcx-tab-count">${count}</span>` : ''}</button>`;
            }).join('');

        navSectionHtml = `
            <div class="pcx-nav-wrap">
                <div class="pcx-nav-top">
                    <div class="pcx-scope-group">
                        <div class="pcx-scope-switch">
                            <button type="button" class="pcx-scope-btn ${s.scope === 'chat' && chatOpen ? 'pcx-active' : ''}" data-scope="chat" ${!chatOpen ? 'disabled' : ''}>${ICONS.chat}<span>${chatOpen ? escapeHtml(dUi.thisChat) : escapeHtml(dUi.noChat)}</span></button>
                            <button type="button" class="pcx-scope-btn ${s.scope === 'global' || !chatOpen ? 'pcx-active' : ''}" data-scope="global">${ICONS.globe}<span>${escapeHtml(dUi.globalScope)}</span></button>
                        </div>
                        ${renderHelpBtn('scope')}
                    </div>
                    ${currentCat ? `<button type="button" class="pcx-route-chip" id="pcx-open-sec-settings">${ICONS.edit}<span>${tUi(uiLang, 'Раздел', 'Section')} (${escapeHtml(describeCategoryRouteShort(currentCat))})</span></button>` : ''}
                </div>
                ${renderHelpBubble('scope')}
                <div class="pcx-tabs-bar">${tabsHtml}</div>
            </div>`;

        footerHtml = `
            <div class="pcx-footer">
                <span style="font-size:12px;color:var(--pcx-text-muted)">${escapeHtml(dUi.inPromptCount)} <b>${countAllPromptActiveNotes()}</b></span>
                <button type="button" class="pcx-primary-btn" id="pcx-new-note-btn">${ICONS.plus}<span>${escapeHtml(dUi.newNote)}</span></button>
            </div>`;

        if (uiState.view === 'section_editor') {
            const d = uiState.secDraft || makeDefaultCategory('tmp', '', 1, 2, 0, true);
            const pos = Number(d.injectPos), isEdit = uiState.sectionMode === 'edit';
            const hMode = d.headerMode || (d.showHeader !== false ? 'sec_and_custom_notes' : 'only_notes');
            const subStyle = d.subHeaderStyle || 'h4_blank';
            const liveHeaderSample = buildSectionHeaderLivePreview({ ...d, headerMode: hMode, subHeaderStyle: subStyle });

            bodyHtml = `
                <div class="pcx-panel-box">
                    <div style="font-size:14.5px;font-weight:800;">${isEdit ? `Раздел «${escapeHtml(currentCat?.name || '')}»` : 'Новый раздел'}</div>
                    <div><label class="pcx-field-label">Название раздела</label><input id="pcx-sec-name-input" class="pcx-input" value="${escapeHtml(d.name)}" placeholder="Например: Отношения и Биография"></div>

                    <div>
                        <label class="pcx-field-label">Режим заголовков раздела и записей ${renderHelpBtn('sec_header')}</label>
                        ${renderHelpBubble('sec_header')}
                        <select id="pcx-sec-hmode-select" class="pcx-select">
                            <option value="sec_and_auto_notes" ${hMode === 'sec_and_auto_notes' ? 'selected' : ''}>Заголовок раздела + подзаголовки всех записей</option>
                            <option value="sec_and_custom_notes" ${hMode === 'sec_and_custom_notes' ? 'selected' : ''}>Заголовок раздела + отмеченные подзаголовки</option>
                            <option value="only_notes" ${hMode === 'only_notes' ? 'selected' : ''}>Без заголовка раздела (только отмеченные подзаголовки)</option>
                            <option value="none" ${hMode === 'none' ? 'selected' : ''}>Без любых заголовков (только чистый текст)</option>
                        </select>
                    </div>

                    ${hMode !== 'none' ? `
                        <div>
                            <label class="pcx-field-label">Вид подзаголовка записи и отступа</label>
                            <select id="pcx-sec-substyle-select" class="pcx-select">
                                <option value="h4_blank" ${subStyle === 'h4_blank' ? 'selected' : ''}>#### Подзаголовок + пустая строка-отступ</option>
                                <option value="bracket_blank" ${subStyle === 'bracket_blank' ? 'selected' : ''}>[Подзаголовок] + пустая строка-отступ</option>
                                <option value="colon_blank" ${subStyle === 'colon_blank' ? 'selected' : ''}>Подзаголовок: + пустая строка-отступ</option>
                                <option value="h4_line" ${subStyle === 'h4_line' ? 'selected' : ''}>#### Подзаголовок + перенос строки</option>
                            </select>
                        </div>` : ''}

                    <div>
                        <span class="pcx-field-label">Наглядный пример склейки с отступами</span>
                        <div class="pcx-preview-box notranslate" translate="no" id="pcx-sec-live-preview" style="max-height:130px">${escapeHtml(liveHeaderSample)}</div>
                    </div>

                    <div>
                        <label class="pcx-field-label">Куда отправлять раздел? ${renderHelpBtn('sec_pos')}</label>
                        ${renderHelpBubble('sec_pos')}
                        <select id="pcx-sec-pos-select" class="pcx-select">
                            <option value="1" ${pos === ST_POS.IN_CHAT ? 'selected' : ''}>В глубине чата (@ Depth)</option>
                            <option value="2" ${pos === ST_POS.BEFORE_MAIN ? 'selected' : ''}>Перед главным промптом</option>
                            <option value="0" ${pos === ST_POS.AFTER_MAIN ? 'selected' : ''}>После главного промпта</option>
                            <option value="-1" ${pos === ST_POS.MACRO_ONLY ? 'selected' : ''}>В макрос {{notebook}}</option>
                            <option value="-2" ${pos === ST_POS.LOCAL_ONLY ? 'selected' : ''}>Никуда (личная памятка для себя)</option>
                        </select>
                    </div>
                    ${(pos !== ST_POS.MACRO_ONLY && pos !== ST_POS.LOCAL_ONLY) ? `
                        <div class="${pos === ST_POS.IN_CHAT ? 'pcx-row-2' : ''}">
                            ${pos === ST_POS.IN_CHAT ? `<div><label class="pcx-field-label">Глубина (0 = низ) ${renderHelpBtn('sec_depth')}</label><input id="pcx-sec-depth-input" type="number" min="0" max="999" class="pcx-input" value="${Math.max(0, Number(d.injectDepth) || 0)}"></div>` : ''}
                            <div><label class="pcx-field-label">Роль ${renderHelpBtn('sec_role')}</label><select id="pcx-sec-role-select" class="pcx-select"><option value="0" ${Number(d.injectRole) === 0 ? 'selected' : ''}>Система (System)</option><option value="1" ${Number(d.injectRole) === 1 ? 'selected' : ''}>Пользователь (User)</option><option value="2" ${Number(d.injectRole) === 2 ? 'selected' : ''}>Ассистент (Assistant)</option></select></div>
                        </div>
                        ${renderHelpBubble('sec_depth')}${renderHelpBubble('sec_role')}
                        <details class="pcx-spoiler"><summary style="padding:8px 11px;font-size:11.5px;color:var(--pcx-text-muted);"><span>Дополнительно (частота)</span><span style="width:14px;height:14px;display:inline-flex">${ICONS.chevDown}</span></summary><div class="pcx-spoiler-body" style="padding:10px 11px;"><label class="pcx-field-label">Каждые N сообщений (1 = каждый ход)</label><input id="pcx-sec-intv-input" type="number" min="1" max="100" class="pcx-input" value="${Math.max(1, Number(d.injectInterval) || 1)}"></div></details>
                    ` : ''}
                    ${isEdit ? `<div class="pcx-toggle-row" id="pcx-sec-enabled-toggle"><div class="pcx-toggle-row-text"><span class="pcx-toggle-row-title">Раздел включён</span></div><div class="pcx-switch ${d.enabled !== false ? 'pcx-on' : ''}"></div></div>` : ''}
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:4px;flex-wrap:wrap;">
                        <div>${(isEdit && store.categories.length > 1) ? `<button type="button" id="pcx-sec-delete-btn" class="pcx-icon-btn" style="color:var(--pcx-accent-2)">${ICONS.trash}<span>Удалить</span></button>` : ''}</div>
                        <div style="display:flex;gap:8px;"><button type="button" id="pcx-sec-cancel-btn" class="pcx-icon-btn">Отмена</button><button type="button" id="pcx-sec-save-btn" class="pcx-primary-btn">${ICONS.check}<span>${isEdit ? 'Сохранить' : 'Создать'}</span></button></div>
                    </div>
                </div>`;
        } else if (uiState.view === 'edit') {
            const existing = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
            const titleVal = uiState.draftTitle !== undefined ? uiState.draftTitle : (existing ? existing.title : '');
            const contentVal = uiState.draftContent !== undefined ? uiState.draftContent : (existing ? existing.content : '');
            const catVal = uiState.draftCat !== undefined ? uiState.draftCat : (existing ? existing.categoryId : (currentCat?.id || store.categories[0].id));
            const targetCatObj = store.categories.find(c => c.id === catVal) || currentCat;
            const autoAllInSec = targetCatObj?.headerMode === 'sec_and_auto_notes';

            const incTitleVal = uiState.draftIncTitle !== undefined
                ? uiState.draftIncTitle
                : (autoAllInSec ? (existing?.forceHideTitle !== true) : Boolean(existing?.includeTitle));
            const subStyleVal = uiState.draftSubStyle !== undefined ? uiState.draftSubStyle : (existing?.subHeaderStyle || 'inherit');
            const strictVal = uiState.draftStrict !== undefined ? uiState.draftStrict : (existing?.priority === 'critical');

            if (!Array.isArray(uiState.draftAttachments)) uiState.draftAttachments = existing && Array.isArray(existing.attachments) ? JSON.parse(JSON.stringify(existing.attachments)) : [];
            const profiles = getConnectionProfiles();
            const activeCodexPreset = getActiveCodexPreset();

            const draftAttHtml = uiState.draftAttachments.length === 0 ? '' : `
                <div class="pcx-att-list">${uiState.draftAttachments.map(att => att.kind === 'image'
                    ? `<div class="pcx-att-img-wrap" data-lightbox="${escapeHtml(att.dataUrl)}"><img src="${escapeHtml(att.dataUrl)}"><button type="button" class="pcx-att-del" data-del-att="${escapeHtml(att.id)}">${ICONS.close}</button></div>`
                    : `<div class="pcx-att-doc"><div class="pcx-att-doc-left">${ICONS.fileText}<span class="pcx-att-doc-name">${escapeHtml(att.name)}</span></div><div style="display:flex;align-items:center;gap:6px;"><button type="button" class="pcx-mini-btn" data-unpack-att="${escapeHtml(att.id)}">В текст записи</button><div class="pcx-switch ${att.includeInPrompt !== false ? 'pcx-on' : ''}" data-toggle-att="${escapeHtml(att.id)}"></div><button type="button" class="pcx-mini-btn" data-del-att="${escapeHtml(att.id)}">${ICONS.trash}</button></div></div>`
                ).join('')}</div>`;

            const activeCand = uiState.aiCandidates[uiState.aiCandidateIdx] || null;
            const studioHtml = !activeCand ? '' : `
                <div class="pcx-ai-studio">
                    <div class="pcx-ai-ver-bar">
                        <span style="font-size:12px;font-weight:800;color:var(--pcx-accent);">Результат Соавтора (${uiState.aiCandidateIdx + 1} / ${uiState.aiCandidates.length})</span>
                        ${uiState.aiCandidates.length > 1 ? `<div style="display:flex;gap:5px;"><button type="button" class="pcx-mini-btn" id="pcx-cand-prev" ${uiState.aiCandidateIdx <= 0 ? 'disabled' : ''}>${ICONS.chevLeft}</button><button type="button" class="pcx-mini-btn" id="pcx-cand-next" ${uiState.aiCandidateIdx >= uiState.aiCandidates.length - 1 ? 'disabled' : ''}>${ICONS.chevRight}</button></div>` : ''}
                    </div>
                    <div><label class="pcx-field-label">Название</label><input id="pcx-cand-title" class="pcx-input" value="${escapeHtml(activeCand.title || '')}"></div>
                    <div><label class="pcx-field-label">Текст записи (с отступами)</label><textarea id="pcx-cand-content" class="pcx-textarea" style="min-height:130px">${escapeHtml(activeCand.content || '')}</textarea></div>
                    <div style="padding-top:6px;border-top:1px solid var(--pcx-border);display:flex;flex-direction:column;gap:8px;">
                        <label class="pcx-field-label" style="margin:0">Что изменить в этой записи?</label>
                        <textarea id="pcx-ai-refine-input" class="pcx-textarea" style="min-height:56px" placeholder="Сделай короче, измени тон, добавь новую деталь...">${escapeHtml(uiState.aiRefinementText || '')}</textarea>
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                            <button type="button" id="pcx-run-refine-btn" class="pcx-secondary-btn" ${uiState.aiGenerating ? 'disabled' : ''}>${uiState.aiGenerating ? ICONS.spinner : ICONS.spark}<span>${uiState.aiGenerating ? 'Дорабатываем...' : 'Переделать'}</span></button>
                            <button type="button" id="pcx-accept-cand-btn" class="pcx-primary-btn">${ICONS.check}<span>Выбрать эту запись</span></button>
                        </div>
                    </div>
                </div>`;

            bodyHtml = `
                <div class="pcx-panel-box">
                    <div class="pcx-mode-tabs">
                        <button type="button" class="pcx-mode-tab ${uiState.editTab === 'manual' ? 'pcx-active' : ''}" data-edittab="manual">${ICONS.edit}<span>${tUi(uiLang, 'Сама запись', 'Note Editor')}</span></button>
                        <button type="button" class="pcx-mode-tab ${uiState.editTab === 'ai' ? 'pcx-active' : ''}" data-edittab="ai">${ICONS.spark}<span>${tUi(uiLang, 'Помощь Соавтора', 'AI Co-Author')}</span></button>
                    </div>
                    ${uiState.editTab === 'ai' ? `
                        <div class="pcx-preset-bar">
                            <div>
                                <label class="pcx-field-label">${ICONS.template}<span style="margin-left:5px">${tUi(uiLang, 'Предустановленный шаблон Соавтора', 'Co-Author Preset')}</span></label>
                                <select id="pcx-ai-preset" class="pcx-select">
                                    ${CODEX_PROMPT_PRESETS.map(pr => `<option value="${escapeHtml(pr.id)}" ${pr.id === activeCodexPreset.id ? 'selected' : ''}>${escapeHtml(uiLang === 'en' ? pr.nameEn : pr.name)}</option>`).join('')}
                                </select>
                            </div>
                            <button type="button" class="pcx-icon-btn ${uiState.showGmPromptEditor ? 'pcx-active' : ''}" style="height:38px;" id="pcx-toggle-gm-prompt">${ICONS.sliders}<span>${tUi(uiLang, 'Промпт', 'Prompt')}</span></button>
                        </div>

                        ${uiState.showGmPromptEditor ? `<div style="padding:10px;border:1px solid var(--pcx-border);border-radius:var(--pcx-radius);background:var(--pcx-bg);display:flex;flex-direction:column;gap:8px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:11px;color:var(--pcx-text-muted);">Метки: <b translate="no" class="notranslate">{{lang}}</b>, <b translate="no" class="notranslate">{{word_limit}}</b></span><button type="button" class="pcx-mini-btn" id="pcx-reset-gm-prompt">${ICONS.reset}<span>К шаблону</span></button></div><textarea id="pcx-gm-sys-prompt" class="pcx-textarea pcx-mono-area" style="min-height:145px">${escapeHtml(s.gmSystemPrompt)}</textarea></div>` : ''}

                        <div class="pcx-row-2">
                            <div><label class="pcx-field-label">Профиль подключения</label><select id="pcx-ai-profile" class="pcx-select"><option value="" ${!s.aiProfileId ? 'selected' : ''}>[ Текущее подключение ]</option>${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === s.aiProfileId ? 'selected' : ''}>${escapeHtml(p.name || p.id)}</option>`).join('')}</select></div>
                            <div><label class="pcx-field-label">Целевой язык</label><select id="pcx-ai-lang" class="pcx-select">${LANGUAGES.map(l => `<option value="${escapeHtml(l.id)}" ${s.aiLang === l.id ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('')}</select></div>
                        </div>
                        <div>
                            <div class="pcx-row-3">
                                <div><label class="pcx-field-label">Слов от ${renderHelpBtn('ai_words')}</label><input id="pcx-ai-wmin" type="number" min="0" max="5000" class="pcx-input" value="${Math.max(0, Number(s.aiWordsMin) || 0)}"></div>
                                <div><label class="pcx-field-label">Слов до</label><input id="pcx-ai-wmax" type="number" min="0" max="5000" class="pcx-input" value="${Math.max(0, Number(s.aiWordsMax) || 0)}"></div>
                                <div><label class="pcx-field-label">Чат ${renderHelpBtn('ai_radius')}</label><input id="pcx-ai-radius" type="number" min="0" max="200" class="pcx-input" value="${Math.max(0, Number(s.aiChatRadius) ?? 10)}"></div>
                            </div>
                            ${renderHelpBubble('ai_words')}${renderHelpBubble('ai_radius')}
                        </div>
                        <div style="display:flex;gap:14px;flex-wrap:wrap;">
                            <label style="display:inline-flex;align-items:center;gap:7px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-ai-char-desc" ${s.aiSendCharDesc !== false ? 'checked' : ''}><span>Описание персонажа</span></label>
                            <label style="display:inline-flex;align-items:center;gap:7px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-ai-user-desc" ${s.aiSendUserDesc !== false ? 'checked' : ''}><span>Описание игрока</span></label>
                        </div>
                        <div>
                            <label class="pcx-field-label">Запрос для Соавтора</label>
                            <textarea id="pcx-ai-task" class="pcx-textarea" style="min-height:84px" placeholder="${escapeHtml(activeCodexPreset.placeholder)}">${escapeHtml(uiState.aiPromptDraft || '')}</textarea>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;"><span style="font-size:11.5px;color:var(--pcx-text-muted)">${escapeHtml(uiState.aiStatus || 'Ответ появится ниже с чистыми абзацами')}</span><button type="button" id="pcx-run-ai-btn" class="pcx-primary-btn" ${uiState.aiGenerating ? 'disabled' : ''}>${uiState.aiGenerating ? ICONS.spinner : ICONS.spark}<span>${uiState.aiGenerating ? 'Пишем...' : 'Создать вариант'}</span></button></div>
                        ${studioHtml}
                    ` : `
                        <div><label class="pcx-field-label">${tUi(uiLang, 'Раздел хранения', 'Section')}</label><select id="pcx-note-cat" class="pcx-select">${store.categories.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === catVal ? 'selected' : ''}>${escapeHtml(displayCategoryName(c, uiLang))}</option>`).join('')}</select></div>
                        <div><label class="pcx-field-label">${tUi(uiLang, 'Название записи (подзаголовок)', 'Note Title (Subheader)')}</label><input id="pcx-note-title" class="pcx-input" placeholder="${tUi(uiLang, 'Например: Походное снаряжение / Правила сцены...', 'e.g. Field Gear / Scene Rules...')}" value="${escapeHtml(titleVal)}"></div>
                        <div>
                            <div class="pcx-toggle-row" id="pcx-note-inctitle-toggle">
                                <div class="pcx-toggle-row-text">
                                    <span class="pcx-toggle-row-title">Подзаголовок записи в промпте (с отступом) ${renderHelpBtn('note_title_inc')}</span>
                                    <span class="pcx-toggle-row-sub">${incTitleVal ? 'Выводится отдельной строкой с пустым отступом над текстом' : 'Название видно только тебе в списке карточек'}</span>
                                </div>
                                <div class="pcx-switch ${incTitleVal ? 'pcx-on' : ''}"></div>
                            </div>
                            ${renderHelpBubble('note_title_inc')}
                        </div>
                        ${incTitleVal ? `
                            <div>
                                <label class="pcx-field-label">Оформление этого подзаголовка</label>
                                <select id="pcx-note-substyle" class="pcx-select">
                                    <option value="inherit" ${subStyleVal === 'inherit' ? 'selected' : ''}>Как в настройках раздела</option>
                                    <option value="h4_blank" ${subStyleVal === 'h4_blank' ? 'selected' : ''}>#### Подзаголовок + пустая строка</option>
                                    <option value="bracket_blank" ${subStyleVal === 'bracket_blank' ? 'selected' : ''}>[Подзаголовок] + пустая строка</option>
                                    <option value="colon_blank" ${subStyleVal === 'colon_blank' ? 'selected' : ''}>Подзаголовок: + пустая строка</option>
                                    <option value="h4_line" ${subStyleVal === 'h4_line' ? 'selected' : ''}>#### Подзаголовок + перенос строки</option>
                                </select>
                            </div>` : ''}
                        <div>
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;flex-wrap:wrap;">
                                <label class="pcx-field-label" style="margin:0">Текст записи</label>
                                <div style="display:flex;gap:5px;">
                                    <button type="button" class="pcx-mini-btn" id="pcx-note-format-btn" title="Разделить слипшиеся блоки и расставить чистые отступы">${ICONS.align}<span>Отступы</span></button>
                                    <button type="button" class="pcx-mini-btn" id="pcx-attach-file-btn">${ICONS.clip}<span>Файл / Арт</span></button>
                                </div>
                                <input type="file" id="pcx-file-input" multiple accept=".txt,.md,.json,.csv,image/*" style="display:none">
                            </div>
                            <textarea id="pcx-note-content" class="pcx-textarea" style="min-height:150px" placeholder="${incTitleVal ? 'Пиши сразу суть с абзацами — подзаголовок встанет сверху с отступом автоматически...' : 'Зафиксируй деталь сюжета, правило игры, отношения или памятку...'}">${escapeHtml(contentVal)}</textarea>
                            ${draftAttHtml}
                        </div>
                        <div>
                            <div class="pcx-toggle-row" id="pcx-note-strict-toggle">
                                <div class="pcx-toggle-row-text"><span class="pcx-toggle-row-title">Строгое правило [ВАЖНО] ${renderHelpBtn('note_strict')}</span></div>
                                <div class="pcx-switch ${strictVal ? 'pcx-on' : ''}"></div>
                            </div>
                            ${renderHelpBubble('note_strict')}
                        </div>
                        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:4px;"><button type="button" id="pcx-cancel-edit" class="pcx-icon-btn">Отмена</button><button type="button" id="pcx-save-note" class="pcx-primary-btn">${ICONS.check}<span>Сохранить запись</span></button></div>
                    `}
                </div>`;
        } else {
            const catNotes = store.notes.filter(n => n.categoryId === currentCat?.id);
            const catEnabled = currentCat?.enabled !== false;
            const allCollapsed = catNotes.length > 0 && catNotes.every(n => n.collapsed);
            const subbarHtml = catNotes.length > 1 ? `<div class="pcx-subbar"><span>Записей: ${catNotes.length}</span><button type="button" class="pcx-mini-btn" id="pcx-collapse-all-btn">${allCollapsed ? ICONS.chevDown : ICONS.chevUp}<span>${allCollapsed ? escapeHtml(dUi.expandAll) : escapeHtml(dUi.collapseAll)}</span></button></div>` : '';
            const cardsHtml = catNotes.length === 0
                ? `<div class="pcx-empty">${tUi(uiLang, 'Раздел', 'Section')} <b>«${escapeHtml(displayCategoryName(currentCat, uiLang))}»</b> ${tUi(uiLang, 'пока пуст.<br>Нажми', 'is empty.<br>Tap')} <b>«${escapeHtml(dUi.newNote)}»</b>.</div>`
                : catNotes.map((note, idx) => {
                    const isOn = note.enabled !== false && catEnabled, isCol = Boolean(note.collapsed);
                    const atts = Array.isArray(note.attachments) ? note.attachments : [];
                    const displayTitle = note.title || (note.content || '').trim().slice(0, 42) || ('Запись ' + (idx + 1));
                    const subShown = shouldShowNoteSubheader(note, currentCat);
                    const cardAttsHtml = (isCol || !atts.length) ? '' : `<div class="pcx-att-list">${atts.map(att => att.kind === 'image' ? `<div class="pcx-att-img-wrap" data-lightbox="${escapeHtml(att.dataUrl)}"><img src="${escapeHtml(att.dataUrl)}"></div>` : `<div class="pcx-att-doc"><div class="pcx-att-doc-left">${ICONS.fileText}<span class="pcx-att-doc-name">${escapeHtml(att.name)}</span></div><span style="font-size:10.5px;opacity:0.75">${att.includeInPrompt !== false ? 'В промпте' : 'Скрыт'}</span></div>`).join('')}</div>`;
                    return `
                        <div class="pcx-card ${isOn ? '' : 'pcx-card-off'} ${isCol ? 'pcx-collapsed' : ''}" data-note-id="${escapeHtml(note.id)}">
                            <div class="pcx-card-top">
                                <div class="pcx-card-title-group">
                                    <span class="pcx-card-grip">${ICONS.grip}</span>
                                    <div class="pcx-switch ${note.enabled !== false ? 'pcx-on' : ''}" data-action="toggle" data-id="${escapeHtml(note.id)}"></div>
                                    <div class="pcx-card-title" data-action="collapse" data-id="${escapeHtml(note.id)}">${escapeHtml(displayTitle)}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                                    ${subShown ? `<span class="pcx-prio-badge">Подзаг.</span>` : ''}
                                    ${note.priority === 'critical' ? `<span class="pcx-prio-badge">ВАЖНО</span>` : ''}
                                    <button type="button" class="pcx-collapse-btn" data-action="collapse" data-id="${escapeHtml(note.id)}">${isCol ? ICONS.chevDown : ICONS.chevUp}</button>
                                </div>
                            </div>
                            ${(!isCol && note.content) ? `<div class="pcx-card-content">${escapeHtml(note.content)}</div>` : ''}
                            ${cardAttsHtml}
                            ${!isCol ? `<div class="pcx-card-footer"><button type="button" class="pcx-mini-btn" data-action="copy" data-id="${escapeHtml(note.id)}">${ICONS.copy}</button><button type="button" class="pcx-mini-btn" data-action="edit" data-id="${escapeHtml(note.id)}">${ICONS.edit}<span>Изменить</span></button><button type="button" class="pcx-mini-btn" data-action="delete" data-id="${escapeHtml(note.id)}">${ICONS.trash}</button></div>` : ''}
                        </div>`;
                }).join('');
            bodyHtml = subbarHtml + cardsHtml;
        }
    }

    const bannerSvg = THEME_BANNERS[themeObj.id] || THEME_BANNERS.tavern;

    win.innerHTML = `
        <div class="pcx-header">
            <div class="pcx-header-left">
                <div class="pcx-crest">${THEME_CRESTS[themeObj.id] || THEME_CRESTS.krakoa}</div>
                <div class="pcx-title-wrap">
                    <div class="pcx-title-main">
                        <span class="pcx-title-name">${escapeHtml(uiLang === 'en' ? (themeObj.nameEn || themeObj.name) : themeObj.name)}</span>
                        <span class="pcx-beta-tag" translate="no">BETA</span>
                    </div>
                    <div class="pcx-title-sub">${escapeHtml(uiLang === 'en' ? (themeObj.subEn || themeObj.sub) : themeObj.sub)}</div>
                </div>
            </div>
            <div class="pcx-header-actions">
                <button type="button" class="pcx-icon-btn ${uiState.view === 'guide' ? 'pcx-active' : ''}" id="pcx-btn-guide" title="Путеводитель">${ICONS.help}<span>${escapeHtml(dUi.guideBtn)}</span></button>
                <button type="button" class="pcx-icon-btn pcx-sq-btn ${uiState.showThemes ? 'pcx-active' : ''}" id="pcx-btn-themes" title="Темы оформления">${ICONS.palette}</button>
                <button type="button" class="pcx-icon-btn pcx-sq-btn ${uiState.view === 'inject' ? 'pcx-active' : ''}" id="pcx-btn-inject" title="Настройки и превью">${ICONS.sliders}</button>
                <button type="button" class="pcx-icon-btn pcx-sq-btn" id="pcx-btn-close" title="Закрыть">${ICONS.close}</button>
            </div>
        </div>

        ${bannerSvg}

        <div class="pcx-theme-strip ${uiState.showThemes ? 'pcx-show' : ''}">${themePillsHtml}</div>

        <div class="pcx-wing-bar">
            <div class="pcx-wing-switch">
                <button type="button" class="pcx-wing-btn ${uiState.wing === 'codex' && uiState.view !== 'guide' && uiState.view !== 'inject' ? 'pcx-active' : ''}" data-wing="codex">${ICONS.book}<span>${escapeHtml(dUi.wingCodex)}</span></button>
                <button type="button" class="pcx-wing-btn ${isForgeWing ? 'pcx-active' : ''}" data-wing="forge">${ICONS.forge}<span>${escapeHtml(dUi.wingForge)}</span></button>
            </div>
        </div>

        ${navSectionHtml}
        <div class="pcx-body">${bodyHtml}</div>
        ${footerHtml}
    `;

    const newTabsBar = win.querySelector('.pcx-tabs-bar');
    if (newTabsBar && !opts.scrollTabsToStart) newTabsBar.scrollLeft = savedTabsScroll;
    const newBody = win.querySelector('.pcx-body');
    if (newBody && opts.preserveBodyScroll) newBody.scrollTop = savedBodyScroll;

    bindCommonAndCodexEvents();
    if (isForgeWing) forgeCtrl.bindForgeEvents(win);
    else if (uiState.wing === 'codex' && uiState.view !== 'guide' && uiState.view !== 'inject') {
        enableTabReorder(win, store, s);
        if (uiState.view === 'notes' && currentCat) enableSmoothCardDrag(win, store, currentCat.id);
    }
}

function resetEditDrafts() {
    delete uiState.draftTitle; delete uiState.draftContent; delete uiState.draftIncTitle; delete uiState.draftSubStyle; delete uiState.draftStrict; delete uiState.draftCat;
    uiState.draftAttachments = null; uiState.aiCandidates = []; uiState.aiCandidateIdx = 0; uiState.aiRefinementText = ''; uiState.aiStatus = '';
}

function captureCurrentEditFields(win) {
    if (!win) return;
    forgeCtrl?.captureForgeFields?.(win);
    const t = win.querySelector('#pcx-note-title'), c = win.querySelector('#pcx-note-content'), cat = win.querySelector('#pcx-note-cat');
    const subSt = win.querySelector('#pcx-note-substyle');
    const task = win.querySelector('#pcx-ai-task'), refIn = win.querySelector('#pcx-ai-refine-input');
    const candT = win.querySelector('#pcx-cand-title'), candC = win.querySelector('#pcx-cand-content'), gmSys = win.querySelector('#pcx-gm-sys-prompt');
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

function bindCommonAndCodexEvents() {
    const s = ensureSettings(), store = getActiveStore();
    const currentCat = store.categories.find(c => c.id === s.activeTab) || store.categories[0];
    const win = document.getElementById('pcx-window');
    if (!win) return;

    win.querySelectorAll('[data-tip]').forEach(qBtn => qBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation(); captureCurrentEditFields(win);
        uiState.openTipId = (uiState.openTipId === qBtn.dataset.tip) ? null : qBtn.dataset.tip;
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    }));

    win.querySelectorAll('[data-wing]').forEach(wBtn => wBtn.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.wing = wBtn.dataset.wing;
        uiState.view = 'notes';
        if (uiState.wing === 'forge') forgeCtrl.onEnterForge();
        renderModal({ preserveTabsScroll: true });
    }));

    win.querySelector('#pcx-btn-close')?.addEventListener('click', closeModal);
    win.querySelector('#pcx-btn-guide')?.addEventListener('click', () => { captureCurrentEditFields(win); uiState.view = uiState.view === 'guide' ? 'notes' : 'guide'; renderModal({ preserveTabsScroll: true }); });
    win.querySelector('#pcx-btn-themes')?.addEventListener('click', () => { captureCurrentEditFields(win); uiState.showThemes = !uiState.showThemes; renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); });
    win.querySelector('#pcx-btn-inject')?.addEventListener('click', () => { captureCurrentEditFields(win); uiState.view = uiState.view === 'inject' ? 'notes' : 'inject'; renderModal({ preserveTabsScroll: true }); });

    win.querySelector('#pcx-ui-lang-select')?.addEventListener('change', e => {
        s.uiLang = e.target.value;
        saveAll();
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });

    win.querySelectorAll('.pcx-theme-pill').forEach(btn => btn.addEventListener('click', () => { captureCurrentEditFields(win); s.theme = btn.dataset.theme; saveAll(); renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); }));
    win.querySelectorAll('.pcx-scope-btn').forEach(btn => btn.addEventListener('click', () => { if (btn.disabled) return; resetEditDrafts(); s.scope = btn.dataset.scope; uiState.view = 'notes'; saveAll(); renderModal(); }));

    win.querySelector('#pcx-add-tab-btn')?.addEventListener('click', () => { resetEditDrafts(); uiState.sectionMode = 'create'; uiState.secDraft = makeDefaultCategory('new', '', 1, 2, 0, true); uiState.view = 'section_editor'; renderModal({ preserveTabsScroll: true }); });
    win.querySelector('#pcx-open-sec-settings')?.addEventListener('click', () => { if (!currentCat) return; captureCurrentEditFields(win); uiState.sectionMode = 'edit'; uiState.secDraft = JSON.parse(JSON.stringify(currentCat)); uiState.view = 'section_editor'; renderModal({ preserveTabsScroll: true }); });

    if (uiState.view === 'section_editor' && uiState.secDraft) {
        const d = uiState.secDraft;
        win.querySelector('#pcx-sec-name-input')?.addEventListener('input', e => {
            d.name = e.target.value;
            const prevEl = win.querySelector('#pcx-sec-live-preview');
            if (prevEl) prevEl.textContent = buildSectionHeaderLivePreview(d);
        });
        win.querySelector('#pcx-sec-hmode-select')?.addEventListener('change', e => {
            d.headerMode = e.target.value;
            d.showHeader = (d.headerMode === 'sec_and_auto_notes' || d.headerMode === 'sec_and_custom_notes');
            renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
        });
        win.querySelector('#pcx-sec-substyle-select')?.addEventListener('change', e => {
            d.subHeaderStyle = e.target.value;
            renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
        });
        win.querySelector('#pcx-sec-enabled-toggle')?.addEventListener('click', () => { d.enabled = d.enabled === false; renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); });
        win.querySelector('#pcx-sec-pos-select')?.addEventListener('change', e => { d.injectPos = Number(e.target.value); renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); });
        win.querySelector('#pcx-sec-depth-input')?.addEventListener('input', e => { const v = Number(e.target.value); d.injectDepth = Number.isNaN(v) ? 0 : Math.max(0, v); });
        win.querySelector('#pcx-sec-role-select')?.addEventListener('change', e => { d.injectRole = Number(e.target.value); });
        win.querySelector('#pcx-sec-intv-input')?.addEventListener('input', e => { d.injectInterval = Math.max(1, Number(e.target.value) || 1); });
        win.querySelector('#pcx-sec-cancel-btn')?.addEventListener('click', () => { uiState.view = 'notes'; uiState.secDraft = null; renderModal({ preserveTabsScroll: true }); });
        win.querySelector('#pcx-sec-delete-btn')?.addEventListener('click', () => {
            if (store.categories.length <= 1 || !currentCat) return;
            if (!window.confirm(`Удалить раздел «${currentCat.name}» и его записи?`)) return;
            store.notes = store.notes.filter(n => n.categoryId !== currentCat.id);
            store.categories = store.categories.filter(c => c.id !== currentCat.id);
            s.activeTab = store.categories[0].id; uiState.view = 'notes'; uiState.secDraft = null; saveAll(); renderModal();
        });
        win.querySelector('#pcx-sec-save-btn')?.addEventListener('click', () => {
            const cleanName = (d.name || '').trim(); if (!cleanName) return;
            d.showHeader = (d.headerMode === 'sec_and_auto_notes' || d.headerMode === 'sec_and_custom_notes');
            if (uiState.sectionMode === 'create') {
                const newId = 'cat_' + Date.now();
                store.categories.unshift({ ...d, id: newId, name: cleanName });
                s.activeTab = newId; uiState.view = 'notes'; uiState.secDraft = null; saveAll(); renderModal({ scrollTabsToStart: true });
            } else if (currentCat) {
                Object.assign(currentCat, { ...d, id: currentCat.id, name: cleanName });
                uiState.view = 'notes'; uiState.secDraft = null; saveAll(); renderModal({ preserveTabsScroll: true });
            }
        });
    }

    win.querySelector('#pcx-note-title')?.addEventListener('input', e => { uiState.draftTitle = e.target.value; });
    win.querySelector('#pcx-note-content')?.addEventListener('input', e => { uiState.draftContent = e.target.value; });
    win.querySelector('#pcx-note-cat')?.addEventListener('change', e => {
        captureCurrentEditFields(win);
        uiState.draftCat = e.target.value;
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });
    win.querySelector('#pcx-note-substyle')?.addEventListener('change', e => { uiState.draftSubStyle = e.target.value; });
    win.querySelector('#pcx-note-format-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        uiState.draftContent = formatCleanParagraphs(uiState.draftContent || '');
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });
    win.querySelector('#pcx-note-inctitle-toggle')?.addEventListener('click', e => {
        if (e.target.closest('.pcx-q-btn')) return;
        captureCurrentEditFields(win);
        const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
        const catIdNow = uiState.draftCat || ex?.categoryId || currentCat?.id;
        const catObjNow = store.categories.find(c => c.id === catIdNow) || currentCat;
        const autoAll = catObjNow?.headerMode === 'sec_and_auto_notes';
        const curVal = uiState.draftIncTitle !== undefined
            ? uiState.draftIncTitle
            : (autoAll ? (ex?.forceHideTitle !== true) : Boolean(ex?.includeTitle));
        uiState.draftIncTitle = !curVal;
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });
    win.querySelector('#pcx-note-strict-toggle')?.addEventListener('click', e => {
        if (e.target.closest('.pcx-q-btn')) return;
        captureCurrentEditFields(win);
        const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
        uiState.draftStrict = !(uiState.draftStrict !== undefined ? uiState.draftStrict : (ex?.priority === 'critical'));
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });

    win.querySelector('#pcx-attach-file-btn')?.addEventListener('click', () => win.querySelector('#pcx-file-input')?.click());
    win.querySelector('#pcx-file-input')?.addEventListener('change', async e => {
        const files = [...(e.target.files || [])]; if (!files.length) return;
        captureCurrentEditFields(win);
        if (!Array.isArray(uiState.draftAttachments)) uiState.draftAttachments = [];
        for (const f of files) {
            try {
                uiState.draftAttachments.push(f.type.startsWith('image/') ? await compressImageFile(f) : await readTextAttachment(f));
            } catch (err) { window.alert(err?.message); }
        }
        renderModal({ preserveTabsScroll: true });
    });

    win.querySelectorAll('[data-unpack-att]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation(); captureCurrentEditFields(win);
        const id = btn.dataset.unpackAtt;
        const target = (uiState.draftAttachments || []).find(a => a.id === id);
        if (!target || !target.text) return;
        uiState.draftContent = formatCleanParagraphs(uiState.draftContent ? `${uiState.draftContent}\n\n${target.text}` : target.text);
        if (!uiState.draftTitle) uiState.draftTitle = target.name.replace(/\.[^.]+$/, '');
        uiState.draftAttachments = uiState.draftAttachments.filter(a => a.id !== id);
        renderModal({ preserveTabsScroll: true });
    }));

    win.querySelectorAll('[data-del-att]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation(); captureCurrentEditFields(win);
        uiState.draftAttachments = (uiState.draftAttachments || []).filter(a => a.id !== btn.dataset.delAtt);
        renderModal({ preserveTabsScroll: true });
    }));
    win.querySelectorAll('[data-toggle-att]').forEach(sw => sw.addEventListener('click', e => {
        e.stopPropagation(); captureCurrentEditFields(win);
        const t = (uiState.draftAttachments || []).find(a => a.id === sw.dataset.toggleAtt);
        if (t) t.includeInPrompt = t.includeInPrompt === false;
        renderModal({ preserveTabsScroll: true });
    }));
    win.querySelectorAll('[data-lightbox]').forEach(el => el.addEventListener('click', e => { if (!e.target.closest('[data-del-att]')) openImageLightbox(el.dataset.lightbox); }));

    win.querySelectorAll('.pcx-mode-tab').forEach(btn => btn.addEventListener('click', () => { captureCurrentEditFields(win); uiState.editTab = btn.dataset.edittab; renderModal({ preserveTabsScroll: true }); }));

    win.querySelector('#pcx-ai-preset')?.addEventListener('change', e => {
        captureCurrentEditFields(win);
        const chosen = CODEX_PROMPT_PRESETS.find(p => p.id === e.target.value) || CODEX_PROMPT_PRESETS[0];
        s.gmPresetId = chosen.id;
        s.gmSystemPrompt = chosen.prompt;
        saveAll();
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });
    win.querySelector('#pcx-toggle-gm-prompt')?.addEventListener('click', () => { captureCurrentEditFields(win); uiState.showGmPromptEditor = !uiState.showGmPromptEditor; renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); });
    win.querySelector('#pcx-reset-gm-prompt')?.addEventListener('click', () => {
        const pr = getActiveCodexPreset();
        s.gmSystemPrompt = pr.prompt;
        saveAll();
        renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });
    win.querySelector('#pcx-gm-sys-prompt')?.addEventListener('input', e => { s.gmSystemPrompt = e.target.value; saveAll(); });

    win.querySelector('#pcx-new-note-btn')?.addEventListener('click', () => { resetEditDrafts(); uiState.view = 'edit'; uiState.editTab = 'manual'; uiState.editingNoteId = null; renderModal({ preserveTabsScroll: true }); });

    win.querySelector('#pcx-ai-profile')?.addEventListener('change', e => { s.aiProfileId = e.target.value; saveAll(); });
    win.querySelector('#pcx-ai-lang')?.addEventListener('change', e => { s.aiLang = e.target.value; saveAll(); });
    win.querySelector('#pcx-ai-wmin')?.addEventListener('input', e => { s.aiWordsMin = Math.max(0, Math.min(5000, Number(e.target.value) || 0)); saveAll(); });
    win.querySelector('#pcx-ai-wmax')?.addEventListener('input', e => { s.aiWordsMax = Math.max(0, Math.min(5000, Number(e.target.value) || 0)); saveAll(); });
    win.querySelector('#pcx-ai-radius')?.addEventListener('input', e => { s.aiChatRadius = Math.max(0, Math.min(200, Number(e.target.value) || 0)); saveAll(); });
    win.querySelector('#pcx-ai-char-desc')?.addEventListener('change', e => { s.aiSendCharDesc = e.target.checked; saveAll(); });
    win.querySelector('#pcx-ai-user-desc')?.addEventListener('change', e => { s.aiSendUserDesc = e.target.checked; saveAll(); });

    win.querySelector('#pcx-run-ai-btn')?.addEventListener('click', async () => {
        if (uiState.aiGenerating) return;
        captureCurrentEditFields(win);
        const taskText = uiState.aiPromptDraft || '', currentContent = uiState.draftContent || '', atts = uiState.draftAttachments || [];
        if (!taskText.trim() && !currentContent.trim() && !atts.length) { uiState.aiStatus = 'Опиши задачу выше.'; renderModal({ preserveTabsScroll: true }); return; }
        uiState.aiGenerating = true; uiState.aiStatus = 'Соавтор создаёт вариант...'; renderModal({ preserveTabsScroll: true });
        try {
            const res = await runAiNoteGeneration({ taskText, currentDraftText: currentContent, attachments: atts });
            if (res.content) { uiState.aiCandidates.push({ title: res.title || '', content: res.content }); uiState.aiCandidateIdx = uiState.aiCandidates.length - 1; uiState.aiStatus = 'Проверь вариант ниже!'; }
            else uiState.aiStatus = 'Пустой ответ.';
        } catch (err) { uiState.aiStatus = 'Ошибка: ' + (err?.message || String(err)); }
        finally { uiState.aiGenerating = false; renderModal({ preserveTabsScroll: true }); }
    });

    win.querySelector('#pcx-run-refine-btn')?.addEventListener('click', async () => {
        if (uiState.aiGenerating) return;
        captureCurrentEditFields(win);
        const prev = uiState.aiCandidates[uiState.aiCandidateIdx], refText = (uiState.aiRefinementText || '').trim();
        if (!prev || !refText) return;
        uiState.aiGenerating = true; uiState.aiStatus = 'Вносим правки...'; renderModal({ preserveTabsScroll: true });
        try {
            const res = await runAiNoteGeneration({ taskText: uiState.aiPromptDraft || '', currentDraftText: uiState.draftContent || '', attachments: uiState.draftAttachments || [], previousCandidate: prev, refinementInstruction: refText });
            if (res.content) { uiState.aiCandidates.push({ title: res.title || prev.title || '', content: res.content }); uiState.aiCandidateIdx = uiState.aiCandidates.length - 1; uiState.aiRefinementText = ''; uiState.aiStatus = 'Обновлённый вариант готов!'; }
        } catch (err) { uiState.aiStatus = 'Ошибка: ' + (err?.message || String(err)); }
        finally { uiState.aiGenerating = false; renderModal({ preserveTabsScroll: true }); }
    });

    win.querySelector('#pcx-cand-prev')?.addEventListener('click', () => { captureCurrentEditFields(win); if (uiState.aiCandidateIdx > 0) uiState.aiCandidateIdx--; renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); });
    win.querySelector('#pcx-cand-next')?.addEventListener('click', () => { captureCurrentEditFields(win); if (uiState.aiCandidateIdx < uiState.aiCandidates.length - 1) uiState.aiCandidateIdx++; renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); });
    win.querySelector('#pcx-accept-cand-btn')?.addEventListener('click', () => {
        captureCurrentEditFields(win);
        const chosen = uiState.aiCandidates[uiState.aiCandidateIdx]; if (!chosen) return;
        uiState.draftContent = formatCleanParagraphs(chosen.content);
        if (chosen.title && !(uiState.draftTitle && uiState.draftTitle.trim())) uiState.draftTitle = chosen.title;
        uiState.editTab = 'manual'; renderModal({ preserveTabsScroll: true });
    });

    win.querySelector('#pcx-cancel-edit')?.addEventListener('click', () => { resetEditDrafts(); uiState.view = 'notes'; uiState.editingNoteId = null; renderModal({ preserveTabsScroll: true }); });
    win.querySelector('#pcx-save-note')?.addEventListener('click', () => {
        const catId = win.querySelector('#pcx-note-cat')?.value || s.activeTab;
        const title = win.querySelector('#pcx-note-title')?.value?.trim() || '';
        const content = win.querySelector('#pcx-note-content')?.value?.trim() || '';
        const subSt = win.querySelector('#pcx-note-substyle')?.value || uiState.draftSubStyle || 'inherit';
        const atts = Array.isArray(uiState.draftAttachments) ? uiState.draftAttachments : [];
        if (!content && !atts.length) return;

        const ex = uiState.editingNoteId ? store.notes.find(n => n.id === uiState.editingNoteId) : null;
        const catObj = store.categories.find(c => c.id === catId) || currentCat;
        const autoAll = catObj?.headerMode === 'sec_and_auto_notes';

        const incTitle = uiState.draftIncTitle !== undefined
            ? uiState.draftIncTitle
            : (autoAll ? (ex?.forceHideTitle !== true) : Boolean(ex?.includeTitle));
        const forceHideTitle = autoAll ? !incTitle : false;
        const prio = (uiState.draftStrict !== undefined ? uiState.draftStrict : (ex?.priority === 'critical')) ? 'critical' : 'normal';

        if (ex) {
            Object.assign(ex, { categoryId: catId, priority: prio, title, includeTitle: incTitle, forceHideTitle, subHeaderStyle: subSt, content, attachments: atts });
        } else {
            store.notes.unshift({ id: 'note_' + Date.now(), categoryId: catId, priority: prio, title, includeTitle: incTitle, forceHideTitle, subHeaderStyle: subSt, collapsed: false, content, attachments: atts, enabled: true });
        }
        s.activeTab = catId; resetEditDrafts(); uiState.view = 'notes'; uiState.editingNoteId = null; saveAll(); renderModal({ preserveTabsScroll: true });
    });

    win.querySelector('#pcx-collapse-all-btn')?.addEventListener('click', () => {
        if (!currentCat) return;
        const list = store.notes.filter(n => n.categoryId === currentCat.id);
        const nextCol = !list.every(n => n.collapsed);
        for (const n of list) n.collapsed = nextCol;
        saveAll(); renderModal({ preserveTabsScroll: true });
    });
    win.querySelectorAll('[data-action="collapse"]').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation();
        const note = store.notes.find(n => n.id === el.dataset.id);
        if (note) { note.collapsed = !note.collapsed; saveAll(); renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); }
    }));
    win.querySelectorAll('[data-action="toggle"]').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation();
        const note = store.notes.find(n => n.id === el.dataset.id);
        if (note) { note.enabled = note.enabled === false; saveAll(); renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); }
    }));
    win.querySelectorAll('[data-action="copy"]').forEach(btn => btn.addEventListener('click', () => {
        const note = store.notes.find(n => n.id === btn.dataset.id); if (!note) return;
        navigator.clipboard?.writeText(note.content || ''); btn.innerHTML = ICONS.check; setTimeout(() => { btn.innerHTML = ICONS.copy; }, 1100);
    }));
    win.querySelectorAll('[data-action="edit"]').forEach(el => el.addEventListener('click', () => { resetEditDrafts(); uiState.view = 'edit'; uiState.editTab = 'manual'; uiState.editingNoteId = el.dataset.id; renderModal({ preserveTabsScroll: true }); }));
    win.querySelectorAll('[data-action="delete"]').forEach(el => el.addEventListener('click', () => {
        store.notes = store.notes.filter(n => n.id !== el.dataset.id); saveAll(); renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    }));

    win.querySelector('#pcx-tips-master-toggle')?.addEventListener('click', () => {
        s.showTooltips = s.showTooltips === false; uiState.openTipId = null;
        const chk = document.getElementById('pcx-drawer-tips-chk'); if (chk) chk.checked = s.showTooltips;
        saveAll(); renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
    });
    win.querySelector('#pcx-inc-global-toggle')?.addEventListener('click', () => { s.includeGlobalWithChat = !s.includeGlobalWithChat; saveAll(); renderModal({ preserveTabsScroll: true, preserveBodyScroll: true }); });
    win.querySelector('#pcx-reset-all-settings-btn')?.addEventListener('click', () => {
        const uiLang = s.uiLang || 'ru';
        const msg = tUi(
            uiLang,
            'Сбросить тему, системные промпты, лимиты и настройки расширения по умолчанию? (Твои написанные заметки в чатах и Общих не удалятся.)',
            'Reset extension theme, prompts, limits, and settings to factory defaults? (Your saved notes will be preserved.)',
        );
        if (!window.confirm(msg)) return;
        const savedGlobalNotes = Array.isArray(s.globalData?.notes) ? JSON.parse(JSON.stringify(s.globalData.notes)) : [];
        const fresh = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        fresh.globalData.notes = savedGlobalNotes;
        stApi.extensionSettings[MODULE_NAME] = fresh;
        const chatSt = getChatStore();
        if (chatSt) {
            const existingCustomCats = (chatSt.categories || []).filter(c => !DEFAULT_CATEGORIES.some(dc => dc.id === c.id));
            chatSt.categories = [...JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)), ...existingCustomCats];
        }
        resetEditDrafts();
        applyThemeClasses();
        saveAll();
        renderModal();
    });
    win.querySelectorAll('.pcx-macro-chip').forEach(chip => chip.addEventListener('click', () => {
        const txt = chip.dataset.copy; navigator.clipboard?.writeText(txt);
        chip.innerHTML = `${ICONS.check}<span>Скопировано</span>`; setTimeout(() => { chip.innerHTML = `${ICONS.copy}<span>${escapeHtml(txt)}</span>`; }, 1200);
    }));
}

function openModal(e) {
    if (e && typeof e.preventDefault === 'function') { e.preventDefault(); e.stopPropagation(); }
    injectStylesAndFonts();
    let dlg = document.getElementById('pcx-dialog');
    if (!dlg) { mountUI(); dlg = document.getElementById('pcx-dialog'); }
    if (!dlg) return;
    renderModal();
    if (!dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } }
}

function closeModal() {
    if (uiState.aiGenerating || forgeCtrl?.isBusy) return;
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
        btn.id = 'pcx-sendbar-btn'; btn.className = 'interactable'; btn.tabIndex = 0;
        btn.title = 'Pocket Codex & Forge [BETA]'; btn.innerHTML = ICONS.book;
        btn.addEventListener('click', openModal);
        if (wandBtn?.parentElement) wandBtn.insertAdjacentElement('afterend', btn);
        else if (leftSend) leftSend.appendChild(btn);
    }
    const extSettings = document.getElementById('extensions_settings');
    if (extSettings && !document.getElementById('pcx-settings-drawer')) {
        const s = ensureSettings();
        const drawer = document.createElement('div');
        drawer.id = 'pcx-settings-drawer'; drawer.className = 'inline-drawer';
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
            const st = ensureSettings(); st.showTooltips = e.target.checked; uiState.openTipId = null; applyThemeClasses(); saveAll();
        });
    }
}

function mountUI() {
    injectStylesAndFonts();
    if (!document.getElementById('pcx-dialog')) {
        const dlg = document.createElement('dialog');
        dlg.id = 'pcx-dialog'; dlg.innerHTML = `<div id="pcx-window"></div>`;
        let downOnBackdrop = false;
        dlg.addEventListener('pointerdown', e => { downOnBackdrop = (e.target === dlg); });
        dlg.addEventListener('click', e => { if (downOnBackdrop && e.target === dlg) closeModal(); downOnBackdrop = false; });
        document.body.appendChild(dlg);
    }
    mountExtensionButtons(); applyThemeClasses(); updateExtensionPrompt();
}

jQuery(async () => {
    await initStApi();
    ensureSettings();
    forgeCtrl = createForgeController({
        stApi, escapeHtml, renderHelpBtn, renderHelpBubble, compressImageFile, readTextAttachment,
        getActiveStore, ensureSettings, getConnectionProfiles, getCharacterDescriptionText,
        getUserPersonaDescriptionText, buildChatContextSnippet, buildWordLimitPhrase,
        saveAllCodex: saveAll, requestRender: renderModal,
    });
    mountUI();
    stApi.registerMacro('notebook', () => buildMacroNotebookText());

    const evSource = stApi.eventSource, evTypes = stApi.eventTypes;
    if (evSource && typeof evSource.on === 'function') {
        if (evTypes.WORLDINFO_ENTRIES_LOADED) {
            evSource.on(evTypes.WORLDINFO_ENTRIES_LOADED, async (payload) => {
                try {
                    if (!payload || !Array.isArray(payload.chatLore) || !stApi.isChatOpen()) return;
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
                    for (const bookName of extras) {
                        if (alreadyLoaded.has(bookName)) continue;
                        let data = null;
                        if (typeof worldInfoModRef?.loadWorldInfo === 'function') {
                            data = await worldInfoModRef.loadWorldInfo(bookName);
                        } else {
                            const r = await fetch('/api/worldinfo/get', {
                                method: 'POST', headers: stApi.getRequestHeaders(), body: JSON.stringify({ name: bookName }),
                            });
                            if (r.ok) data = await r.json();
                        }
                        if (data && data.entries && typeof data.entries === 'object') {
                            for (const ent of Object.values(data.entries)) {
                                if (ent) payload.chatLore.push({ ...ent, world: bookName });
                            }
                            alreadyLoaded.add(bookName);
                        }
                    }
                } catch (err) {
                    console.warn('[PocketCodex] Extra chat lorebooks load warning:', err);
                }
            });
        }
        for (const ev of [evTypes.CHAT_CHANGED, evTypes.GENERATION_STARTED, evTypes.MESSAGE_SENT, evTypes.MESSAGE_RECEIVED, evTypes.MESSAGE_DELETED, evTypes.WORLDINFO_SETTINGS_UPDATED].filter(Boolean)) {
            evSource.on(ev, () => {
                if (ev === evTypes.CHAT_CHANGED) resetEditDrafts();
                updateExtensionPrompt();
                const dlg = document.getElementById('pcx-dialog');
                if (dlg?.open && (ev === evTypes.CHAT_CHANGED || ev === evTypes.WORLDINFO_SETTINGS_UPDATED || ev === evTypes.MESSAGE_SENT || ev === evTypes.MESSAGE_RECEIVED)) {
                    renderModal({ preserveTabsScroll: true, preserveBodyScroll: true });
                }
            });
        }
    }
});
