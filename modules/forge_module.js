import { ICONS, LANGUAGES } from './themes_and_icons.js';
import {
    FORGE_BOOK_PRESETS,
    formatCleanParagraphs,
    analyzeBookRecursion,
    buildEntryCountPhrase,
    tUi,
} from './presets_and_i18n.js';

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

function makeStandardWiEntry(uid, item = {}) {
    const numUid = Number(uid);
    const rawKeys = item.key !== undefined ? item.key : item.keys;
    const keysArr = Array.isArray(rawKeys)
        ? rawKeys.map(k => String(k).trim()).filter(Boolean)
        : String(rawKeys || '').split(',').map(k => k.trim()).filter(Boolean);
    return {
        uid: numUid, key: keysArr, keysecondary: Array.isArray(item.keysecondary) ? item.keysecondary : [],
        comment: String(item.comment || 'Статья лора').trim().slice(0, 95),
        content: String(item.content || '').trim(),
        constant: Boolean(item.constant), vectorized: Boolean(item.vectorized),
        selective: true, selectiveLogic: 0, addMemo: true,
        order: Number(item.order) || 100,
        position: item.position !== undefined ? Number(item.position) : 1,
        disable: Boolean(item.disable),
        excludeRecursion: Boolean(item.excludeRecursion),
        preventRecursion: Boolean(item.preventRecursion),
        delayUntilRecursion: Boolean(item.delayUntilRecursion),
        probability: 100, useProbability: true,
        depth: item.depth !== undefined ? Math.max(0, Number(item.depth) || 0) : 4,
        group: '', groupOverride: false, groupWeight: 100,
        scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null,
        automationId: '', role: item.role !== undefined ? Number(item.role) : 0,
        sticky: 0, cooldown: 0, delay: 0, displayIndex: numUid,
    };
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
        newBookBindScope: 'global',

        // Single-page editor (manual + AI co-author with presets & word limits)
        editingUid: null,
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
        wizMuteExportedCats: true,
        wizUploadedDocs: [],
        wizCustomPrompt: '',
        wizMode: 'ai_adapt',
        wizForging: false,
        wizStatus: '',

        stagedEntries: [],
        stagedCollapsed: {},
        targetBookMode: 'new',
        targetBookName: '',
        targetExistingId: '',
        targetCover: '',
        bindAfterScope: 'global',
    };

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

    function getActiveForgeBookPreset() {
        const s = ensureSettings();
        return FORGE_BOOK_PRESETS.find(p => p.id === s.forgePresetId) || FORGE_BOOK_PRESETS[0];
    }

    async function callForgeModel(systemPrompt, userPrompt, schemaObj, maxTokens = 3800) {
        const s = ensureSettings();
        const profileId = s.aiProfileId || '';
        const service = stApi.connectionService;
        if (profileId && service && typeof service.sendRequest === 'function') {
            const chosen = getConnectionProfiles().find(p => p.id === profileId);
            if (chosen) {
                const isTc = chosen.mode === 'tc';
                const payload = isTc
                    ? `${systemPrompt}\n\n${userPrompt}`
                    : [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
                try {
                    return await service.sendRequest(
                        profileId, payload, maxTokens,
                        { stream: false, extractData: true, includePreset: false, includeInstruct: false },
                        isTc ? {} : { response_format: { type: 'json_schema', json_schema: { name: schemaObj.name, strict: true, schema: schemaObj.value } } },
                    );
                } catch {
                    return await service.sendRequest(
                        profileId, payload, maxTokens,
                        { stream: false, extractData: true, includePreset: false, includeInstruct: false },
                    );
                }
            }
        }
        return await stApi.generateWithSchemaFallback(systemPrompt, userPrompt, schemaObj);
    }

    function parseJsonObjectFromModel(raw) {
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            if (raw.entries || raw.content !== undefined || raw.keys !== undefined) return raw;
        }
        let txt = typeof raw === 'string'
            ? raw
            : (raw?.content || raw?.choices?.[0]?.message?.content || raw?.text || '');
        txt = String(txt || '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        const fb = txt.indexOf('{'), lb = txt.lastIndexOf('}');
        if (fb !== -1 && lb > fb) return JSON.parse(txt.slice(fb, lb + 1));
        return null;
    }

    async function fetchBooksList() {
        state.loading = true;
        try {
            const res = await fetch('/api/worldinfo/list', {
                method: 'POST', headers: stApi.getRequestHeaders(), body: JSON.stringify({}),
            });
            if (res.ok) {
                state.books = await res.json();
                hydrateBookCountsInBackground(state.books);
            }
        } catch (err) { console.warn('[Forge] List error:', err); }
        finally { state.loading = false; }
    }

    async function hydrateBookCountsInBackground(booksList) {
        const missing = (booksList || []).filter(b => state.bookCounts[b.file_id] === undefined).slice(0, 40);
        if (!missing.length) return;
        let changed = false;
        await Promise.all(missing.map(async (b) => {
            try {
                const data = await loadBookData(b.file_id);
                state.bookCounts[b.file_id] = Object.keys(data.entries || {}).length;
                if (data.extensions?.pocket_codex_cover && (!b.extensions || !b.extensions.pocket_codex_cover)) {
                    b.extensions = b.extensions || {};
                    b.extensions.pocket_codex_cover = data.extensions.pocket_codex_cover;
                }
                changed = true;
            } catch {}
        }));
        if (changed && state.screen === 'shelf') requestRender({ preserveBodyScroll: true });
    }

    async function loadBookData(fileId) {
        const res = await fetch('/api/worldinfo/get', {
            method: 'POST', headers: stApi.getRequestHeaders(), body: JSON.stringify({ name: fileId }),
        });
        if (!res.ok) throw new Error('Не удалось загрузить файл Лорбука.');
        const data = await res.json();
        if (!data.entries || typeof data.entries !== 'object') data.entries = {};
        if (!data.extensions || typeof data.extensions !== 'object') data.extensions = {};
        state.bookCounts[fileId] = Object.keys(data.entries).length;
        return data;
    }

    async function saveBookData(fileId, data) {
        const res = await fetch('/api/worldinfo/edit', {
            method: 'POST', headers: stApi.getRequestHeaders(), body: JSON.stringify({ name: fileId, data }),
        });
        if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            throw new Error(`Ошибка сохранения Лорбука (HTTP ${res.status})${errTxt ? ': ' + errTxt.slice(0, 120) : ''}`);
        }
        state.bookCounts[fileId] = Object.keys(data?.entries || {}).length;
        await stApi.refreshWorldInfoUI();
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

    async function applyBindingScope(fileId, scope) {
        if (!fileId || scope === 'none') return;
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
    }

    function scanEntryAgainstRecentChat(ent) {
        if (ent.disable) return { live: false, hitKeys: [], label: 'Страница выключена тумблером' };
        if (ent.constant) return { live: true, hitKeys: [], label: 'Постоянно: всегда передаётся в промпт' };
        if (ent.vectorized && (!Array.isArray(ent.key) || ent.key.length === 0)) {
            return { live: false, hitKeys: [], label: 'Вектор: активируется по смыслу через Vector Storage' };
        }
        const keys = Array.isArray(ent.key) ? ent.key.map(k => String(k).trim()).filter(Boolean) : [];
        if (!keys.length) return { live: false, hitKeys: [], label: 'Нет ключевых слов — добавь ключи или выбери «Постоянно»' };
        if (!stApi.isChatOpen()) return { live: false, hitKeys: [], label: 'Ждёт упоминания ключей в чате' };

        const wiMod = stApi.worldInfoMod;
        const depth = Math.max(1, Number(ent.scanDepth ?? wiMod?.world_info_depth ?? 2) || 2);
        const includeNames = wiMod?.world_info_include_names !== false;
        const chatArr = Array.isArray(stApi.ctx?.chat) ? stApi.ctx.chat : [];
        const recent = chatArr.filter(m => m && !m.is_system && typeof m.mes === 'string').slice(-depth);
        if (!recent.length) return { live: false, hitKeys: [], label: `Спит (сканирует последние ${depth} сообщ.)` };

        const haystack = recent.map(m => includeNames && m.name ? `${m.name}: ${m.mes}` : m.mes).join('\n').toLowerCase();
        const participantNames = [stApi.ctx?.name1, stApi.ctx?.name2].filter(Boolean).map(n => String(n).toLowerCase());
        const hitKeys = [];
        let matchedParticipantName = false;

        for (const k of keys) {
            const low = k.toLowerCase();
            if (!low) continue;
            if (haystack.includes(low)) {
                hitKeys.push(k);
                if (includeNames && participantNames.includes(low)) matchedParticipantName = true;
            }
        }

        if (hitKeys.length > 0) {
            const warnName = matchedParticipantName ? ' (имя собеседника есть в каждой реплике)' : '';
            return {
                live: true,
                hitKeys,
                label: `Активна в чате — ключ: ${hitKeys.slice(0, 3).join(', ')}${warnName}`,
            };
        }
        return { live: false, hitKeys: [], label: `Спит — ждёт ключ в последних ${depth} сообщ.` };
    }

    function renderBindPills(fileId) {
        const uiLang = ensureSettings().uiLang || 'ru';
        const globals = stApi.getGlobalLorebooks?.() || [];
        const isGlob = globals.includes(fileId);
        const isChat = getChatBoundBooks().includes(fileId);
        const isChar = stApi.getCharLorebook?.() === fileId;
        const chatOpen = stApi.isChatOpen();
        const charOpen = isSingleCharOpen();

        return `
            <div class="pcx-bind-strip">
                <button type="button" class="pcx-bind-pill ${isGlob ? 'pcx-on' : ''}" data-fg-scope="global" data-fg-book="${escapeHtml(fileId)}" title="${tUi(uiLang, 'Включить глобально в меню Мира Таверны', 'Toggle Global Lorebook in ST')}">
                    ${ICONS.globe}<span>${tUi(uiLang, 'Глобально', 'Global')}</span>
                </button>
                <button type="button" class="pcx-bind-pill ${isChat ? 'pcx-on' : ''}" data-fg-scope="chat" data-fg-book="${escapeHtml(fileId)}" ${!chatOpen ? 'disabled' : ''} title="${tUi(uiLang, 'Привязать только к текущему открытому чату', 'Bind to current chat')}">
                    ${ICONS.chat}<span>${tUi(uiLang, 'В чат', 'Chat')}</span>
                </button>
                <button type="button" class="pcx-bind-pill ${isChar ? 'pcx-on' : ''}" data-fg-scope="char" data-fg-book="${escapeHtml(fileId)}" ${!charOpen ? 'disabled' : ''} title="${tUi(uiLang, 'Закрепить за карточкой текущего персонажа', 'Bind to character card')}">
                    ${ICONS.user}<span>${tUi(uiLang, 'Персонаж', 'Char')}</span>
                </button>
            </div>`;
    }

    function openEntryEditor({ bookId, uid = null, initialTab = 'manual' }) {
        state.entryTargetBookId = bookId || state.activeBookId || (state.books[0]?.file_id || '');
        state.editingUid = uid;
        state.entryEditTab = initialTab;
        state.pageAiStatus = '';
        state.pageAiCandidates = [];
        state.pageAiCandIdx = 0;
        state.pageAiRefineText = '';

        if (uid !== null && state.activeBookData?.entries?.[uid]) {
            state.entryDraft = JSON.parse(JSON.stringify(state.activeBookData.entries[uid]));
        } else {
            state.entryDraft = makeStandardWiEntry(0, { comment: '', keys: [], content: '', position: 1, depth: 4 });
        }
        state.screen = 'entry_edit';
    }

    async function saveDraftToTargetBook(draftObj) {
        const targetBookId = state.editingUid !== null ? state.activeBookId : (state.entryTargetBookId || state.activeBookId);
        if (!targetBookId) return;
        const bookObj = (targetBookId === state.activeBookId && state.activeBookData)
            ? state.activeBookData
            : await loadBookData(targetBookId);
        const entries = bookObj.entries;
        if (state.editingUid !== null && entries[state.editingUid]) {
            entries[state.editingUid] = { ...draftObj, uid: Number(state.editingUid) };
        } else {
            const uids = Object.keys(entries).map(Number).filter(n => !Number.isNaN(n));
            const nextUid = uids.length > 0 ? (Math.max(...uids) + 1) : 0;
            entries[String(nextUid)] = makeStandardWiEntry(nextUid, { ...draftObj, keys: draftObj.key });
        }
        await saveBookData(targetBookId, bookObj);
        state.activeBookId = targetBookId;
        state.activeBookData = bookObj;
        state.screen = 'book_entries';
    }

    async function generateKeysForCurrentDraft() {
        const d = state.entryDraft;
        if (!d || !String(d.content || '').trim() || state.keysGenerating) return;
        state.keysGenerating = true;
        requestRender({ preserveBodyScroll: true });
        try {
            const s = ensureSettings();
            const lang = s.aiLang || 'Русский';
            const sys = `Ты — мастер ключевых слов для интерактивных Лорбуков. Прочитай готовую статью и подбери 4–7 точных ключевых слов-триггеров на языке "${lang}" (имена собственные, локации, предметы, короткие корни без общих бытовых слов). Также предложи короткое название страницы (2–4 слова) в поле "comment". Верни строго JSON: { "comment": "...", "keys": ["..."] }.`;
            const usr = `[Название сейчас]: ${d.comment || '(пусто)'}\n[Текст страницы]:\n${d.content.trim()}`;
            const raw = await callForgeModel(sys, usr, KEYS_ONLY_JSON_SCHEMA, 1200);
            const parsed = parseJsonObjectFromModel(raw);
            if (parsed && Array.isArray(parsed.keys) && parsed.keys.length > 0) {
                d.key = parsed.keys.map(k => String(k).trim()).filter(Boolean);
                if (!String(d.comment || '').trim() && parsed.comment) d.comment = String(parsed.comment).trim();
            }
        } catch (err) {
            window.alert('Ошибка подбора ключей: ' + (err?.message || String(err)));
        } finally {
            state.keysGenerating = false;
            requestRender({ preserveBodyScroll: true });
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
            if (/^[-*•]\s+/m.test(txt)) bulletLists++;
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
        if (state.pageAiGenerating) return;
        const s = ensureSettings();
        const d = state.entryDraft;
        const prevCand = isRefinement ? state.pageAiCandidates[state.pageAiCandIdx] : null;
        if (isRefinement && (!prevCand || !state.pageAiRefineText.trim())) return;
        if (!isRefinement && !state.pageAiTask.trim() && !(d?.content || '').trim()) {
            state.pageAiStatus = 'Опиши тему страницы выше (локацию, персонажа, предмет, закон мира).';
            requestRender({ preserveBodyScroll: true });
            return;
        }

        state.pageAiGenerating = true;
        state.pageAiStatus = directSave
            ? 'Куём и сразу сохраняем страницу в Лорбук...'
            : (isRefinement ? 'Соавтор вносит правки...' : 'Соавтор создаёт страницу и подбирает ключи...');
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
            if (state.pageAiMatchFormat && state.entryTargetBookId) {
                try {
                    const bookObj = (state.entryTargetBookId === state.activeBookId && state.activeBookData)
                        ? state.activeBookData
                        : await loadBookData(state.entryTargetBookId);
                    const fmtHint = extractBookFormatSkeleton(bookObj);
                    if (fmtHint) blocks.push(fmtHint);
                } catch {}
            }
            if (state.pageAiUseChar) { const cd = getCharacterDescriptionText(); if (cd) blocks.push(cd); }
            if (state.pageAiUsePersona) { const pd = getUserPersonaDescriptionText(); if (pd) blocks.push(pd); }
            if (state.pageAiUseChat) { const ct = buildChatContextSnippet(s.aiChatRadius ?? 10); if (ct) blocks.push(ct); }

            if (isRefinement && prevCand) {
                blocks.push(`[Исходный замысел]\n${state.pageAiTask.trim() || '(доработка черновика)'}`);
                blocks.push(`[Предыдущий вариант]\nНазвание: ${prevCand.comment}\nКлючи: ${prevCand.keys}\nТекст:\n${prevCand.content}`);
                blocks.push(`[Что изменить]\n${state.pageAiRefineText.trim()}`);
            } else {
                if (d?.content && d.content.trim()) blocks.push(`[Черновик в редакторе]\n${d.content.trim()}`);
                blocks.push(`[Запрос автора для новой страницы Лорбука]\n${state.pageAiTask.trim() || 'Развей черновик в полноценную оригинальную страницу Лорбука с абзацами и подбери ключи.'}`);
            }

            const raw = await callForgeModel(sysPrompt, blocks.join('\n\n'), SINGLE_PAGE_JSON_SCHEMA, Math.max(1200, Number(s.aiMaxTokens) || 3400));
            const parsed = parseJsonObjectFromModel(raw);
            const cleanBody = formatCleanParagraphs(parsed?.content || '');
            if (!parsed || !cleanBody) {
                throw new Error('Модель не вернула текст страницы.');
            }

            const genKeysArr = Array.isArray(parsed.keys)
                ? parsed.keys.map(k => String(k).trim()).filter(Boolean)
                : String(parsed.keys || '').split(',').map(k => k.trim()).filter(Boolean);

            if (directSave) {
                d.comment = String(parsed.comment || d.comment || 'Новая страница').trim();
                d.key = genKeysArr;
                d.content = cleanBody;
                d.constant = Boolean(parsed.constant);
                state.pageAiTask = '';
                await saveDraftToTargetBook(d);
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
            state.pageAiStatus = 'Вариант готов! Проверь отступы и ключи ниже.';
        } catch (err) {
            state.pageAiStatus = 'Ошибка: ' + (err?.message || String(err));
        } finally {
            state.pageAiGenerating = false;
            requestRender({ preserveBodyScroll: true });
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
                    selectedNotes.push({ section: cat.name, title: n.title || cat.name, content: n.content.trim() });
                }
            }
        }

        if (state.wizUseChar) { const cd = getCharacterDescriptionText(); if (cd) sourceBlocks.push(cd); }
        if (state.wizUseScenario) {
            const ctx = stApi.ctx;
            const ch = (ctx.characterId !== undefined && Array.isArray(ctx.characters)) ? ctx.characters[ctx.characterId] : null;
            const scen = ch?.scenario || ch?.data?.scenario || '';
            const firstMes = ch?.first_mes || '';
            if (scen || firstMes) sourceBlocks.push(`[Сценарий и завязка]\n${scen}\n${firstMes}`.trim());
        }
        if (state.wizUsePersona) { const pd = getUserPersonaDescriptionText(); if (pd) sourceBlocks.push(pd); }
        if (state.wizUseChat) { const ct = buildChatContextSnippet(state.wizChatCount); if (ct) sourceBlocks.push(ct); }
        if (state.wizUploadedDocs.length > 0) {
            sourceBlocks.push('[Документы]\n' + state.wizUploadedDocs.map(d => `--- ${d.name} ---\n${d.text.slice(0, 14000)}`).join('\n\n'));
        }
        if (selectedNotes.length > 0) {
            sourceBlocks.push('[Исходные заметки из Кодекса (опора канона)]\n' + selectedNotes.map((n, i) => `Запись #${i + 1} (${n.section} | ${n.title}):\n${n.content}`).join('\n\n'));
        }
        if (state.wizCustomPrompt.trim()) sourceBlocks.push(`[Запрос автора / Тема и сеттинг Лорбука]\n${state.wizCustomPrompt.trim()}`);

        const preset = getActiveForgeBookPreset();
        const rawBookTemplate = (s.forgeBookSystemPrompt && s.forgeBookSystemPrompt.trim())
            ? s.forgeBookSystemPrompt.trim()
            : preset.bookPrompt;

        const wordLim = buildWordLimitPhrase(s.forgeWordsMin, s.forgeWordsMax);
        const entryCntPhrase = buildEntryCountPhrase(s.forgeEntryCount, s.uiLang || 'ru');

        const sysPrompt = state.wizMode === 'verbatim_keys'
            ? `Ты — архивариус Лорбуков. НЕ ПЕРЕПИСЫВАЙ и НЕ СОКРАЩАЙ авторский текст записей Кодекса! Перенеси поле "content" каждой записи ДОСЛОВНО буква в букву, сохраняя все абзацы. Дай короткое имя в "comment", подбери 4–7 точных ключевых слов-триггеров в "keys" на языке "${lang}", укажи "constant" (false для лора/мест/деталей, true только для вечных правил) и "position" (0 = до чара, 1 = после чара, 4 = глубина чата с "depth": 4). Верни строго JSON { "entries": [...] }.`
            : rawBookTemplate
                .replace(/\{\{lang\}\}/gi, lang)
                .replace(/\{\{word_limit\}\}/gi, wordLim)
                .replace(/\{\{entry_count\}\}/gi, entryCntPhrase);

        return { sysPrompt, userPrompt: sourceBlocks.join('\n\n'), selectedNotes };
    }

    async function executeAutoForge({ directCommit = false } = {}) {
        const { sysPrompt, userPrompt, selectedNotes } = buildDynamicForgePrompts();

        if (state.wizMode === 'direct_no_ai') {
            if (selectedNotes.length === 0 && state.wizUploadedDocs.length === 0) {
                state.wizStatus = 'Отметь разделы Кодекса в спойлере ниже или прикрепи файл.';
                requestRender(); return;
            }
            state.stagedEntries = [
                ...selectedNotes.map(n => ({ included: true, comment: n.title || n.section, keys: n.title || n.section, content: formatCleanParagraphs(n.content), constant: false, vectorized: false, position: 1, depth: 4, role: 0 })),
                ...state.wizUploadedDocs.map(d => ({ included: true, comment: d.name.replace(/\.[^.]+$/, ''), keys: d.name.replace(/\.[^.]+$/, ''), content: formatCleanParagraphs(d.text), constant: false, vectorized: false, position: 1, depth: 4, role: 0 })),
            ];
            state.stagedCollapsed = {};
            state.targetBookName = state.targetBookName || ('Лорбук ' + (stApi.ctx.name2 || 'Истории'));
            if (directCommit) { await commitApprovedLorebook(); return; }
            state.screen = 'approve'; state.wizStatus = ''; requestRender(); return;
        }

        if (!userPrompt.trim()) {
            state.wizStatus = 'Напиши тему/сеттинг выше или открой чат персонажа.';
            requestRender(); return;
        }

        state.wizForging = true;
        state.wizStatus = directCommit ? 'Куём и сразу сохраняем готовый Лорбук...' : 'Кузница собирает черновик страниц...';
        requestRender();
        try {
            const rawResp = await callForgeModel(sysPrompt, userPrompt, FORGE_JSON_SCHEMA, 4400);
            const obj = parseJsonObjectFromModel(rawResp);
            const parsedEntries = Array.isArray(rawResp?.entries) ? rawResp.entries : (Array.isArray(obj?.entries) ? obj.entries : null);
            if (!parsedEntries || parsedEntries.length === 0) throw new Error('Модель не вернула список страниц.');

            state.stagedEntries = parsedEntries.map(e => ({
                included: true, comment: String(e.comment || 'Статья лора').trim(),
                keys: Array.isArray(e.keys) ? e.keys.join(', ') : String(e.keys || ''),
                content: formatCleanParagraphs(e.content || ''),
                constant: Boolean(e.constant), vectorized: false,
                position: [0, 1, 4].includes(Number(e.position)) ? Number(e.position) : 1,
                depth: Math.max(0, Number(e.depth) || 4), role: 0,
            }));
            state.stagedCollapsed = {};
            state.targetBookName = state.targetBookName || ('Лорбук ' + (stApi.ctx.name2 || 'Мира'));
            state.wizStatus = '';
            if (directCommit) {
                await commitApprovedLorebook();
                return;
            }
            state.screen = 'approve';
        } catch (err) {
            state.wizStatus = 'Ошибка: ' + (err?.message || String(err));
        } finally {
            state.wizForging = false; requestRender();
        }
    }

    async function commitApprovedLorebook() {
        const chosenItems = state.stagedEntries.filter(e => e.included && e.content.trim());
        if (chosenItems.length === 0) return;

        let fileId = '', bookData = { entries: {}, extensions: {} };
        if (state.targetBookMode === 'existing' && state.targetExistingId) {
            fileId = state.targetExistingId;
            bookData = await loadBookData(fileId);
        } else {
            const rawName = (state.targetBookName || '').trim() || ('Лорбук_' + (stApi.ctx.name2 || 'Мира'));
            fileId = rawName.replace(/[<>:"/\\|?*]/g, '_');
            await fetchBooksList();
            const existsAlready = state.books.some(b => String(b.file_id).toLowerCase() === fileId.toLowerCase());
            if (existsAlready) {
                const mergeOk = window.confirm(`Лорбук «${fileId}» уже существует! Добавить новые страницы в конец существующей книги (ОК) или отменить сохранение (Отмена)?`);
                if (!mergeOk) return;
                bookData = await loadBookData(fileId);
            }
        }
        if (state.targetCover) {
            bookData.extensions = bookData.extensions || {};
            bookData.extensions.pocket_codex_cover = state.targetCover;
        }
        const uids = Object.keys(bookData.entries).map(Number).filter(n => !Number.isNaN(n));
        let nextUid = uids.length > 0 ? (Math.max(...uids) + 1) : 0;
        for (const item of chosenItems) {
            bookData.entries[String(nextUid)] = makeStandardWiEntry(nextUid, item);
            nextUid++;
        }
        await saveBookData(fileId, bookData);
        await applyBindingScope(fileId, state.bindAfterScope);

        const exportedCatIds = Object.keys(state.wizSelectedCats).filter(k => state.wizSelectedCats[k]);
        if (state.wizMuteExportedCats && exportedCatIds.length > 0) {
            const store = getActiveStore();
            for (const c of store.categories) {
                if (exportedCatIds.includes(c.id)) c.enabled = false;
            }
            if (typeof saveAllCodex === 'function') saveAllCodex();
        }

        await fetchBooksList();
        state.activeBookId = fileId; state.activeBookData = bookData; state.screen = 'book_entries';
        requestRender();
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

        if (state.screen === 'create_hub') {
            const hasBooks = state.books.length > 0;
            return `
                <div class="pcx-panel-box">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <span style="font-size:14.5px;font-weight:800;">${tUi(uiLang, 'Что создать в Кузнице?', 'What would you like to forge?')}</span>
                        <button type="button" class="pcx-mini-btn" id="pcx-fg-back-shelf">${ICONS.chevLeft}<span>${tUi(uiLang, 'К полке', 'Shelf')}</span></button>
                    </div>
                    <div class="pcx-hub-grid">
                        <button type="button" class="pcx-hub-card" id="pcx-hub-whole-ai">
                            <div class="pcx-hub-card-head">${ICONS.forge}<span>${tUi(uiLang, 'Целый Лорбук с ИИ', 'Full Lorebook with AI')}</span></div>
                            <div class="pcx-hub-card-desc">${tUi(uiLang, 'Придумать новые страницы мира с ключами по теме, сеттингу и выбранному пресету.', 'Generate world pages & keys from a theme, setting, or preset.')}</div>
                        </button>
                        <button type="button" class="pcx-hub-card" id="pcx-hub-whole-manual">
                            <div class="pcx-hub-card-head">${ICONS.book}<span>${tUi(uiLang, 'Пустой Лорбук вручную', 'Empty Lorebook Manually')}</span></div>
                            <div class="pcx-hub-card-desc">${tUi(uiLang, 'Создать чистый том с обложкой, выбрать область работы и наполнять страницами.', 'Create a blank tome with cover art and scope binding.')}</div>
                        </button>
                        <button type="button" class="pcx-hub-card" id="pcx-hub-page-ai" ${!hasBooks ? 'disabled style="opacity:0.45;cursor:not-allowed"' : ''}>
                            <div class="pcx-hub-card-head">${ICONS.spark}<span>${tUi(uiLang, 'Отдельную страницу с ИИ', 'Single Page with AI')}</span></div>
                            <div class="pcx-hub-card-desc">${hasBooks ? tUi(uiLang, 'Добавить свежую статью (локацию, NPC, реликвию, закон мира) в любой существующий Лорбук.', 'Forge a single lore page into any existing Lorebook.') : tUi(uiLang, 'Сначала создай хотя бы один Лорбук.', 'Create at least one Lorebook first.')}</div>
                        </button>
                        <button type="button" class="pcx-hub-card" id="pcx-hub-page-manual" ${!hasBooks ? 'disabled style="opacity:0.45;cursor:not-allowed"' : ''}>
                            <div class="pcx-hub-card-head">${ICONS.edit}<span>${tUi(uiLang, 'Отдельную страницу вручную', 'Single Page Manually')}</span></div>
                            <div class="pcx-hub-card-desc">${hasBooks ? tUi(uiLang, 'Написать страницу самому для любой книги (ключи можно ввести или подобрать кнопкой ИИ).', 'Write a page manually with optional AI key generation.') : tUi(uiLang, 'Сначала создай хотя бы один Лорбук.', 'Create at least one Lorebook first.')}</div>
                        </button>
                    </div>
                </div>`;
        }

        if (state.screen === 'new_book') {
            return `
                <div class="pcx-panel-box">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <span style="font-size:14.5px;font-weight:800;">${tUi(uiLang, 'Новый Лорбук', 'New Lorebook')}</span>
                        <button type="button" class="pcx-mini-btn" id="pcx-fg-back-shelf">${ICONS.chevLeft}<span>${tUi(uiLang, 'К полке', 'Shelf')}</span></button>
                    </div>
                    <div><label class="pcx-field-label">${tUi(uiLang, 'Название Лорбука', 'Lorebook Name')}</label><input id="pcx-fg-newname" class="pcx-input" placeholder="${tUi(uiLang, 'Например: Хроники Кракоа / Мир Ведьмака', 'e.g. Chronicles of Krakoa')}" value="${escapeHtml(state.newBookName)}"></div>
                    <div>
                        <label class="pcx-field-label">${tUi(uiLang, 'Куда сразу подключить?', 'Initial Binding Scope')} ${renderHelpBtn('forge_scope')}</label>
                        ${renderHelpBubble('forge_scope')}
                        <select id="pcx-fg-newscope" class="pcx-select">
                            <option value="global" ${state.newBookBindScope === 'global' ? 'selected' : ''}>${tUi(uiLang, 'Глобально (в верхнем меню Мира Таверны)', 'Global (in ST World Info menu)')}</option>
                            ${stApi.isChatOpen() ? `<option value="chat" ${state.newBookBindScope === 'chat' ? 'selected' : ''}>${tUi(uiLang, 'Только в текущий чат', 'Current Chat Only')}</option>` : ''}
                            ${isSingleCharOpen() ? `<option value="char" ${state.newBookBindScope === 'char' ? 'selected' : ''}>${tUi(uiLang, 'К карточке текущего персонажа', 'Current Character Card')}</option>` : ''}
                            <option value="none" ${state.newBookBindScope === 'none' ? 'selected' : ''}>${tUi(uiLang, 'Пока не подключать', 'Leave unbound on shelf')}</option>
                        </select>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div class="pcx-book-cover" id="pcx-fg-newcover-pick">${state.newBookCover ? `<img src="${escapeHtml(state.newBookCover)}">` : `${ICONS.image}<span class="pcx-cover-hint">ART</span>`}</div>
                        <div style="display:flex;flex-direction:column;gap:6px;">
                            <button type="button" class="pcx-mini-btn" id="pcx-fg-newcover-btn">${ICONS.clip}<span>${tUi(uiLang, 'Прикрепить Арт-обложку', 'Attach Cover Art')}</span></button>
                            <input type="file" id="pcx-fg-newcover-input" accept="image/*" style="display:none">
                        </div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;">
                        <button type="button" class="pcx-icon-btn" id="pcx-fg-back-shelf-2">${tUi(uiLang, 'Отмена', 'Cancel')}</button>
                        <button type="button" class="pcx-primary-btn" id="pcx-fg-create-manual-confirm">${ICONS.check}<span>${tUi(uiLang, 'Создать том', 'Create Tome')}</span></button>
                    </div>
                </div>`;
        }

        // FULL LOREBOOK WIZARD: With Presets, Word Count, Entry Count & Editable Prompt!
        if (state.screen === 'wizard') {
            const curBookPrompt = (s.forgeBookSystemPrompt && s.forgeBookSystemPrompt.trim()) ? s.forgeBookSystemPrompt : activePreset.bookPrompt;
            return `
                <div class="pcx-panel-box">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <span style="font-size:14.5px;font-weight:800;">${tUi(uiLang, 'Ковка Лорбука', 'Lorebook Forge Wizard')}</span>
                        <button type="button" class="pcx-mini-btn" id="pcx-fg-back-shelf">${ICONS.chevLeft}<span>${tUi(uiLang, 'К полке', 'Shelf')}</span></button>
                    </div>
                    <div class="pcx-row-2">
                        <div><label class="pcx-field-label">${tUi(uiLang, 'Куда сохранить?', 'Save Target')}</label>
                        <select id="pcx-fg-target-mode" class="pcx-select">
                            <option value="new" ${state.targetBookMode === 'new' ? 'selected' : ''}>${tUi(uiLang, 'Новый Лорбук', 'New Lorebook')}</option>
                            ${state.books.length > 0 ? `<option value="existing" ${state.targetBookMode === 'existing' ? 'selected' : ''}>${tUi(uiLang, 'Дополнить существующий', 'Append to Existing')}</option>` : ''}
                        </select></div>
                        <div>${state.targetBookMode === 'existing'
                            ? `<label class="pcx-field-label">${tUi(uiLang, 'Выбери книгу', 'Select Book')}</label><select id="pcx-fg-target-existing" class="pcx-select">${state.books.map(b => `<option value="${escapeHtml(b.file_id)}" ${b.file_id === state.targetExistingId ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}</select>`
                            : `<label class="pcx-field-label">${tUi(uiLang, 'Название книги', 'Book Name')}</label><input id="pcx-fg-target-name" class="pcx-input" placeholder="${tUi(uiLang, 'Например: Лор мира', 'e.g. World Lore')}" value="${escapeHtml(state.targetBookName)}">`}
                        </div>
                    </div>
                    <div class="pcx-row-2">
                        <div>
                            <label class="pcx-field-label">${tUi(uiLang, 'Подключение книги', 'Bind Scope')} ${renderHelpBtn('forge_scope')}</label>
                            <select id="pcx-fg-bind-scope-after" class="pcx-select">
                                <option value="global" ${state.bindAfterScope === 'global' ? 'selected' : ''}>${tUi(uiLang, 'Глобально (меню Мира Таверны)', 'Global (ST World menu)')}</option>
                                ${stApi.isChatOpen() ? `<option value="chat" ${state.bindAfterScope === 'chat' ? 'selected' : ''}>${tUi(uiLang, 'Только в этот чат', 'This Chat Only')}</option>` : ''}
                                ${isSingleCharOpen() ? `<option value="char" ${state.bindAfterScope === 'char' ? 'selected' : ''}>${tUi(uiLang, 'К карточке персонажа', 'Character Card')}</option>` : ''}
                                <option value="none" ${state.bindAfterScope === 'none' ? 'selected' : ''}>${tUi(uiLang, 'Не подключать сразу', 'Do not bind yet')}</option>
                            </select>
                        </div>
                        <div>
                            <label class="pcx-field-label">${tUi(uiLang, 'Режим сборки', 'Forge Mode')} ${renderHelpBtn('forge_mode')}</label>
                            <select id="pcx-fg-wiz-mode" class="pcx-select">
                                <option value="ai_adapt" ${state.wizMode === 'ai_adapt' ? 'selected' : ''}>${tUi(uiLang, 'Генерация Лорбука с Соавтором ИИ', 'Generate with AI Co-Author')}</option>
                                <option value="verbatim_keys" ${state.wizMode === 'verbatim_keys' ? 'selected' : ''}>${tUi(uiLang, 'Мой текст дословно + ключи от ИИ', 'Verbatim Text + AI Keys')}</option>
                                <option value="direct_no_ai" ${state.wizMode === 'direct_no_ai' ? 'selected' : ''}>${tUi(uiLang, 'Прямой перенос без ИИ', 'Direct Copy (No AI)')}</option>
                            </select>
                        </div>
                    </div>
                    ${renderHelpBubble('forge_scope')}${renderHelpBubble('forge_mode')}

                    ${state.wizMode === 'ai_adapt' ? `
                        <div class="pcx-preset-bar">
                            <div>
                                <label class="pcx-field-label">${ICONS.template}<span style="margin-left:5px">${tUi(uiLang, 'Предустановленный шаблон промпта', 'Prompt Preset')}</span></label>
                                <select id="pcx-fg-book-preset" class="pcx-select">
                                    ${FORGE_BOOK_PRESETS.map(pr => `<option value="${escapeHtml(pr.id)}" ${pr.id === activePreset.id ? 'selected' : ''}>${escapeHtml(uiLang === 'en' ? pr.nameEn : pr.name)}</option>`).join('')}
                                </select>
                            </div>
                            <button type="button" class="pcx-icon-btn ${state.showBookPromptEditor ? 'pcx-active' : ''}" style="height:38px;" id="pcx-fg-toggle-book-prompt">${ICONS.sliders}<span>${tUi(uiLang, 'Промпт', 'Prompt')}</span></button>
                        </div>

                        ${state.showBookPromptEditor ? `
                            <div style="padding:10px;border:1px solid var(--pcx-border);border-radius:var(--pcx-radius);background:var(--pcx-bg);display:flex;flex-direction:column;gap:8px;">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                                    <span style="font-size:11px;color:var(--pcx-text-muted);">Метки: <b translate="no" class="notranslate">{{lang}}</b>, <b translate="no" class="notranslate">{{entry_count}}</b>, <b translate="no" class="notranslate">{{word_limit}}</b></span>
                                    <button type="button" class="pcx-mini-btn" id="pcx-fg-reset-book-prompt">${ICONS.reset}<span>${tUi(uiLang, 'К шаблону', 'Reset to Preset')}</span></button>
                                </div>
                                <textarea id="pcx-fg-book-sysprompt" class="pcx-textarea pcx-mono-area" style="min-height:145px">${escapeHtml(curBookPrompt)}</textarea>
                            </div>` : ''}

                        <div>
                            <div class="pcx-row-3">
                                <div><label class="pcx-field-label">${tUi(uiLang, 'Страниц', 'Pages')} ${renderHelpBtn('forge_words')}</label><input id="pcx-fg-entry-cnt" type="number" min="0" max="30" class="pcx-input" value="${Math.max(0, Number(s.forgeEntryCount) ?? 5)}"></div>
                                <div><label class="pcx-field-label">${tUi(uiLang, 'Слов от', 'Min Words')}</label><input id="pcx-fg-wmin" type="number" min="0" max="3000" class="pcx-input" value="${Math.max(0, Number(s.forgeWordsMin) ?? 60)}"></div>
                                <div><label class="pcx-field-label">${tUi(uiLang, 'Слов до', 'Max Words')}</label><input id="pcx-fg-wmax" type="number" min="0" max="3000" class="pcx-input" value="${Math.max(0, Number(s.forgeWordsMax) ?? 220)}"></div>
                            </div>
                            ${renderHelpBubble('forge_words')}
                        </div>

                        <div>
                            <label class="pcx-field-label">${tUi(uiLang, 'Запрос для Кузницы (тема, сеттинг или какие страницы придумать)', 'Forge Request (theme, setting, or ideas)')}</label>
                            <textarea id="pcx-fg-wiz-task" class="pcx-textarea" style="min-height:86px" placeholder="${escapeHtml(activePreset.placeholder)}">${escapeHtml(state.wizCustomPrompt)}</textarea>
                        </div>` : ''}

                    <details class="pcx-spoiler">
                        <summary style="padding:9px 12px;font-size:12px;">
                            <span>${tUi(uiLang, 'Источники контекста, разделы Кодекса и модель', 'Context Sources, Codex Sections & Model')}</span>
                            <span style="width:14px;height:14px;display:inline-flex">${ICONS.chevDown}</span>
                        </summary>
                        <div class="pcx-spoiler-body">
                            ${state.wizMode !== 'direct_no_ai' ? `
                                <div class="pcx-row-2">
                                    <div><label class="pcx-field-label">${tUi(uiLang, 'Профиль ИИ', 'AI Profile')}</label>
                                    <select id="pcx-fg-wiz-profile" class="pcx-select">
                                        <option value="" ${!s.aiProfileId ? 'selected' : ''}>[ Текущее подключение ]</option>
                                        ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === s.aiProfileId ? 'selected' : ''}>${escapeHtml(p.name || p.id)}</option>`).join('')}
                                    </select></div>
                                    <div><label class="pcx-field-label">${tUi(uiLang, 'Язык', 'Language')}</label>
                                    <select id="pcx-fg-wiz-lang" class="pcx-select">
                                        ${LANGUAGES.map(l => `<option value="${escapeHtml(l.id)}" ${s.aiLang === l.id ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('')}
                                    </select></div>
                                </div>` : ''}
                            ${state.wizMode === 'ai_adapt' ? `
                                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-fg-src-char" ${state.wizUseChar ? 'checked' : ''}><span>Персонаж</span></label>
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-fg-src-scen" ${state.wizUseScenario ? 'checked' : ''}><span>Сценарий</span></label>
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-fg-src-pers" ${state.wizUsePersona ? 'checked' : ''}><span>Игрок</span></label>
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-fg-src-chat" ${state.wizUseChat ? 'checked' : ''}><span>Чат</span></label>
                                </div>` : ''}
                            <div>
                                <label class="pcx-field-label">${tUi(uiLang, 'Опереться на разделы Кодекса Автора', 'Include Codex Sections')}</label>
                                <div class="pcx-check-grid">
                                    ${store.categories.map(cat => {
                                        const cnt = store.notes.filter(n => n.categoryId === cat.id && n.enabled !== false).length;
                                        return `<label class="pcx-check-item"><input type="checkbox" class="pcx-fg-cat-chk" data-catid="${escapeHtml(cat.id)}" ${state.wizSelectedCats[cat.id] ? 'checked' : ''}><span><b>${escapeHtml(cat.name)}</b> (${cnt})</span></label>`;
                                    }).join('')}
                                </div>
                            </div>
                            <label style="display:inline-flex;align-items:center;gap:7px;font-size:11.5px;cursor:pointer">
                                <input type="checkbox" id="pcx-fg-mute-cats" ${state.wizMuteExportedCats ? 'checked' : ''}>
                                <span>Отключить перенесённые разделы в Кодексе (чтобы не дублировались)</span>
                            </label>
                            <div><button type="button" class="pcx-mini-btn" id="pcx-fg-wiz-doc-btn">${ICONS.clip}<span>Прикрепить текстовый файл (${state.wizUploadedDocs.length})</span></button><input type="file" id="pcx-fg-wiz-doc-in" multiple accept=".txt,.md,.json,.csv" style="display:none"></div>
                        </div>
                    </details>

                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
                        <button type="button" class="pcx-secondary-btn" id="pcx-fg-run-wiz-draft" ${state.wizForging ? 'disabled' : ''}>${ICONS.edit}<span>${tUi(uiLang, 'Сначала черновик', 'Review Draft')}</span></button>
                        <button type="button" class="pcx-primary-btn" id="pcx-fg-run-wiz-direct" ${state.wizForging ? 'disabled' : ''}>${state.wizForging ? ICONS.spinner : ICONS.forge}<span>${state.wizForging ? tUi(uiLang, 'Куём книгу...', 'Forging...') : tUi(uiLang, 'Выковать сразу', 'Forge Immediately')}</span></button>
                    </div>
                    ${state.wizStatus ? `<div style="font-size:12px;color:var(--pcx-accent);">${escapeHtml(state.wizStatus)}</div>` : ''}
                </div>`;
        }

        // APPROVE DRAFT (with collapsible draft cards!)
        if (state.screen === 'approve') {
            const allStCol = state.stagedEntries.length > 0 && state.stagedEntries.every((_, i) => state.stagedCollapsed[i]);
            return `
                <div class="pcx-panel-box">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:14.5px;font-weight:800;">Черновик страниц (${state.stagedEntries.length})</span>
                        <div style="display:flex;gap:6px;">
                            ${state.stagedEntries.length > 1 ? `<button type="button" class="pcx-mini-btn" id="pcx-st-collapse-all">${allStCol ? ICONS.chevDown : ICONS.chevUp}<span>${allStCol ? 'Развернуть все' : 'Свернуть все'}</span></button>` : ''}
                            <button type="button" class="pcx-mini-btn" id="pcx-fg-back-wiz">${ICONS.chevLeft}<span>Назад</span></button>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:10px;max-height:400px;overflow-y:auto;">
                        ${state.stagedEntries.map((st, idx) => {
                            const isCol = Boolean(state.stagedCollapsed[idx]);
                            return `
                            <div class="pcx-card ${isCol ? 'pcx-collapsed' : ''}" data-stage-idx="${idx}">
                                <div class="pcx-card-top">
                                    <div class="pcx-card-title-group">
                                        <input type="checkbox" class="pcx-st-inc" data-idx="${idx}" ${st.included ? 'checked' : ''}>
                                        <div class="pcx-card-title" data-st-col="${idx}">${escapeHtml(st.comment || ('Страница #' + (idx + 1)))}</div>
                                    </div>
                                    <button type="button" class="pcx-collapse-btn" data-st-col="${idx}">${isCol ? ICONS.chevDown : ICONS.chevUp}</button>
                                </div>
                                ${!isCol ? `
                                    <div><label class="pcx-field-label">Название страницы</label><input class="pcx-input pcx-st-comment" data-idx="${idx}" value="${escapeHtml(st.comment)}"></div>
                                    <div><label class="pcx-field-label">Ключевые слова (через запятую)</label><input class="pcx-input pcx-st-keys" data-idx="${idx}" value="${escapeHtml(st.keys)}"></div>
                                    <div class="pcx-row-3">
                                        <div><label class="pcx-field-label">Активация</label><select class="pcx-select pcx-st-trig" data-idx="${idx}"><option value="keys" ${(!st.constant && !st.vectorized) ? 'selected' : ''}>По ключам</option><option value="const" ${st.constant ? 'selected' : ''}>Постоянно</option><option value="vec" ${st.vectorized ? 'selected' : ''}>Вектор</option></select></div>
                                        <div><label class="pcx-field-label">Позиция</label><select class="pcx-select pcx-st-pos" data-idx="${idx}"><option value="0" ${Number(st.position) === 0 ? 'selected' : ''}>До чара</option><option value="1" ${Number(st.position) === 1 ? 'selected' : ''}>После чара</option><option value="4" ${Number(st.position) === 4 ? 'selected' : ''}>Глубина</option></select></div>
                                        <div><label class="pcx-field-label">${Number(st.position) === 4 ? 'Глубина' : 'Роль'}</label>${Number(st.position) === 4 ? `<input type="number" min="0" max="999" class="pcx-input pcx-st-depth" data-idx="${idx}" value="${Number(st.depth) || 4}">` : `<select class="pcx-select pcx-st-role" data-idx="${idx}"><option value="0" ${Number(st.role) === 0 ? 'selected' : ''}>System</option><option value="1" ${Number(st.role) === 1 ? 'selected' : ''}>User</option><option value="2" ${Number(st.role) === 2 ? 'selected' : ''}>Assistant</option></select>`}</div>
                                    </div>
                                    <textarea class="pcx-textarea pcx-st-content" data-idx="${idx}" style="min-height:85px">${escapeHtml(st.content)}</textarea>
                                ` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="display:flex;justify-content:flex-end;"><button type="button" class="pcx-primary-btn" id="pcx-fg-commit-btn">${ICONS.check}<span>Сохранить в Лорбук</span></button></div>
                </div>`;
        }

        // SINGLE PAGE EDITOR (Manual with paragraph align & recursion flags + AI with presets, word count & prompt editor)
        if (state.screen === 'entry_edit' && state.entryDraft) {
            const d = state.entryDraft, pos = Number(d.position);
            const trigMode = d.constant ? 'const' : (d.vectorized ? 'vec' : 'keys');
            const isNewEntry = state.editingUid === null;
            const activeCand = state.pageAiCandidates[state.pageAiCandIdx] || null;
            const curPagePrompt = (s.forgePageSystemPrompt && s.forgePageSystemPrompt.trim()) ? s.forgePageSystemPrompt : activePreset.pagePrompt;

            const studioHtml = !activeCand ? '' : `
                <div class="pcx-ai-studio">
                    <div class="pcx-ai-ver-bar">
                        <span style="font-size:12px;font-weight:800;color:var(--pcx-accent);">Вариант Соавтора (${state.pageAiCandIdx + 1} / ${state.pageAiCandidates.length})</span>
                        ${state.pageAiCandidates.length > 1 ? `<div style="display:flex;gap:5px;"><button type="button" class="pcx-mini-btn" id="pcx-fgc-prev" ${state.pageAiCandIdx <= 0 ? 'disabled' : ''}>${ICONS.chevLeft}</button><button type="button" class="pcx-mini-btn" id="pcx-fgc-next" ${state.pageAiCandIdx >= state.pageAiCandidates.length - 1 ? 'disabled' : ''}>${ICONS.chevRight}</button></div>` : ''}
                    </div>
                    <div><label class="pcx-field-label">Название страницы</label><input id="pcx-fgc-comment" class="pcx-input" value="${escapeHtml(activeCand.comment || '')}"></div>
                    <div><label class="pcx-field-label">Ключевые слова (через запятую)</label><input id="pcx-fgc-keys" class="pcx-input" value="${escapeHtml(activeCand.keys || '')}"></div>
                    <div><label class="pcx-field-label">Текст страницы</label><textarea id="pcx-fgc-content" class="pcx-textarea" style="min-height:130px">${escapeHtml(activeCand.content || '')}</textarea></div>
                    <div style="padding-top:6px;border-top:1px solid var(--pcx-border);display:flex;flex-direction:column;gap:8px;">
                        <textarea id="pcx-fgc-refine" class="pcx-textarea" style="min-height:52px" placeholder="Если нужно что-то поправить — напиши сюда и нажми «Переделать»...">${escapeHtml(state.pageAiRefineText || '')}</textarea>
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                            <button type="button" id="pcx-fgc-run-refine" class="pcx-secondary-btn" ${state.pageAiGenerating ? 'disabled' : ''}>${state.pageAiGenerating ? ICONS.spinner : ICONS.spark}<span>Переделать</span></button>
                            <button type="button" id="pcx-fgc-save-now" class="pcx-primary-btn">${ICONS.check}<span>Сохранить в Лорбук</span></button>
                        </div>
                    </div>
                </div>`;

            return `
                <div class="pcx-panel-box">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                        <span style="font-size:14.5px;font-weight:800;">${isNewEntry ? tUi(uiLang, 'Новая страница Лорбука', 'New Lorebook Page') : tUi(uiLang, 'Редактирование страницы', 'Edit Lorebook Page')}</span>
                        <button type="button" class="pcx-mini-btn" id="pcx-fge-cancel">${ICONS.chevLeft}<span>${tUi(uiLang, 'Назад', 'Back')}</span></button>
                    </div>

                    ${(isNewEntry && state.books.length > 1) ? `
                        <div>
                            <label class="pcx-field-label">${tUi(uiLang, 'Книга назначения', 'Target Lorebook')}</label>
                            <select id="pcx-fge-book-select" class="pcx-select">
                                ${state.books.map(b => `<option value="${escapeHtml(b.file_id)}" ${b.file_id === state.entryTargetBookId ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
                            </select>
                        </div>` : ''}

                    <div class="pcx-mode-tabs">
                        <button type="button" class="pcx-mode-tab ${state.entryEditTab === 'manual' ? 'pcx-active' : ''}" data-fgetab="manual">${ICONS.edit}<span>${tUi(uiLang, 'Вручную', 'Manual')}</span></button>
                        <button type="button" class="pcx-mode-tab ${state.entryEditTab === 'ai' ? 'pcx-active' : ''}" data-fgetab="ai">${ICONS.spark}<span>${tUi(uiLang, 'С Соавтором (ИИ)', 'AI Co-Author')}</span></button>
                    </div>

                    ${state.entryEditTab === 'ai' ? `
                        <div class="pcx-preset-bar">
                            <div>
                                <label class="pcx-field-label">${ICONS.template}<span style="margin-left:5px">${tUi(uiLang, 'Шаблон задачи (Пресет)', 'Prompt Preset')}</span></label>
                                <select id="pcx-fgp-preset" class="pcx-select">
                                    ${FORGE_BOOK_PRESETS.map(pr => `<option value="${escapeHtml(pr.id)}" ${pr.id === activePreset.id ? 'selected' : ''}>${escapeHtml(uiLang === 'en' ? pr.nameEn : pr.name)}</option>`).join('')}
                                </select>
                            </div>
                            <button type="button" class="pcx-icon-btn ${state.showPagePromptEditor ? 'pcx-active' : ''}" style="height:38px;" id="pcx-fgp-toggle-prompt">${ICONS.sliders}<span>${tUi(uiLang, 'Промпт', 'Prompt')}</span></button>
                        </div>

                        ${state.showPagePromptEditor ? `
                            <div style="padding:10px;border:1px solid var(--pcx-border);border-radius:var(--pcx-radius);background:var(--pcx-bg);display:flex;flex-direction:column;gap:8px;">
                                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                                    <span style="font-size:11px;color:var(--pcx-text-muted);">Метки: <b translate="no" class="notranslate">{{lang}}</b>, <b translate="no" class="notranslate">{{word_limit}}</b></span>
                                    <button type="button" class="pcx-mini-btn" id="pcx-fgp-reset-prompt">${ICONS.reset}<span>К шаблону</span></button>
                                </div>
                                <textarea id="pcx-fgp-sysprompt" class="pcx-textarea pcx-mono-area" style="min-height:140px">${escapeHtml(curPagePrompt)}</textarea>
                            </div>` : ''}

                        <div>
                            <div class="pcx-row-3">
                                <div><label class="pcx-field-label">${tUi(uiLang, 'Слов от', 'Min Words')} ${renderHelpBtn('ai_words')}</label><input id="pcx-fgp-wmin" type="number" min="0" max="4000" class="pcx-input" value="${Math.max(0, Number(s.forgeWordsMin) ?? 60)}"></div>
                                <div><label class="pcx-field-label">${tUi(uiLang, 'Слов до', 'Max Words')}</label><input id="pcx-fgp-wmax" type="number" min="0" max="4000" class="pcx-input" value="${Math.max(0, Number(s.forgeWordsMax) ?? 220)}"></div>
                                <div><label class="pcx-field-label">${tUi(uiLang, 'Чат', 'Chat')} ${renderHelpBtn('ai_radius')}</label><input id="pcx-fgp-radius" type="number" min="0" max="200" class="pcx-input" value="${Math.max(0, Number(s.aiChatRadius) ?? 10)}"></div>
                            </div>
                            ${renderHelpBubble('ai_words')}${renderHelpBubble('ai_radius')}
                        </div>

                        <div>
                            <label class="pcx-field-label">${tUi(uiLang, 'О чём придумать страницу?', 'Page Idea / Request')} ${renderHelpBtn('forge_page_ai')}</label>
                            ${renderHelpBubble('forge_page_ai')}
                            <textarea id="pcx-fgp-task" class="pcx-textarea" style="min-height:86px" placeholder="${escapeHtml(activePreset.placeholder)}">${escapeHtml(state.pageAiTask || '')}</textarea>
                        </div>

                        <details class="pcx-spoiler">
                            <summary style="padding:8px 11px;font-size:11.5px;color:var(--pcx-text-muted);">
                                <span>Контекст и модель (настроены автоматически)</span>
                                <span style="width:14px;height:14px;display:inline-flex">${ICONS.chevDown}</span>
                            </summary>
                            <div class="pcx-spoiler-body">
                                <div class="pcx-row-2">
                                    <div><label class="pcx-field-label">Профиль ИИ</label>
                                    <select id="pcx-fgp-profile" class="pcx-select">
                                        <option value="" ${!s.aiProfileId ? 'selected' : ''}>[ Текущее подключение ]</option>
                                        ${profiles.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === s.aiProfileId ? 'selected' : ''}>${escapeHtml(p.name || p.id)}</option>`).join('')}
                                    </select></div>
                                    <div><label class="pcx-field-label">Язык</label>
                                    <select id="pcx-fgp-lang" class="pcx-select">
                                        ${LANGUAGES.map(l => `<option value="${escapeHtml(l.id)}" ${s.aiLang === l.id ? 'selected' : ''}>${escapeHtml(l.label)}</option>`).join('')}
                                    </select></div>
                                </div>
                                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer" title="Смотрит только на разметку/абзацы книги без чтения знаний и текстов"><input type="checkbox" id="pcx-fgp-fmt" ${state.pageAiMatchFormat ? 'checked' : ''}><span>${tUi(uiLang, 'Сверять только формат разметки', 'Format Skeleton Only')}</span></label>
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-fgp-char" ${state.pageAiUseChar ? 'checked' : ''}><span>${tUi(uiLang, 'Персонаж', 'Character')}</span></label>
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-fgp-pers" ${state.pageAiUsePersona ? 'checked' : ''}><span>${tUi(uiLang, 'Игрок', 'Persona')}</span></label>
                                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" id="pcx-fgp-chat" ${state.pageAiUseChat ? 'checked' : ''}><span>${tUi(uiLang, 'Чат', 'Chat')}</span></label>
                                </div>
                            </div>
                        </details>
                        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
                            <button type="button" id="pcx-fgp-run-draft" class="pcx-secondary-btn" ${state.pageAiGenerating ? 'disabled' : ''}>${ICONS.edit}<span>Сначала черновик</span></button>
                            <button type="button" id="pcx-fgp-run-direct" class="pcx-primary-btn" ${state.pageAiGenerating ? 'disabled' : ''}>${state.pageAiGenerating ? ICONS.spinner : ICONS.spark}<span>${state.pageAiGenerating ? 'Создаём...' : 'Создать и сохранить'}</span></button>
                        </div>
                        ${state.pageAiStatus ? `<div style="font-size:11.5px;color:var(--pcx-accent)">${escapeHtml(state.pageAiStatus)}</div>` : ''}
                        ${studioHtml}
                    ` : `
                        <div><label class="pcx-field-label">Название страницы</label><input id="pcx-fge-comment" class="pcx-input" placeholder="Например: Таверна «Сломанный Компас»" value="${escapeHtml(d.comment)}"></div>
                        <div>
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;">
                                <label class="pcx-field-label" style="margin:0">Ключевые слова (через запятую)</label>
                                <button type="button" class="pcx-mini-btn" id="pcx-fge-genkeys" ${state.keysGenerating ? 'disabled' : ''}>
                                    ${state.keysGenerating ? ICONS.spinner : ICONS.key}<span>${state.keysGenerating ? 'Подбор...' : 'Подобрать ключи ИИ'}</span>
                                </button>
                            </div>
                            <input id="pcx-fge-keys" class="pcx-input" placeholder="компас, таверн, март, порт" value="${escapeHtml(Array.isArray(d.key) ? d.key.join(', ') : d.key)}">
                        </div>
                        <div class="pcx-row-2">
                            <div><label class="pcx-field-label">Активация ${renderHelpBtn('forge_trig')}</label><select id="pcx-fge-trig" class="pcx-select"><option value="keys" ${trigMode === 'keys' ? 'selected' : ''}>По ключам в чате</option><option value="const" ${trigMode === 'const' ? 'selected' : ''}>Постоянно</option><option value="vec" ${trigMode === 'vec' ? 'selected' : ''}>Векторизация</option></select></div>
                            <div><label class="pcx-field-label">Позиция</label><select id="pcx-fge-pos" class="pcx-select"><option value="0" ${pos === 0 ? 'selected' : ''}>До описания чара</option><option value="1" ${pos === 1 ? 'selected' : ''}>После описания чара</option><option value="4" ${pos === 4 ? 'selected' : ''}>В глубине чата</option></select></div>
                        </div>
                        ${renderHelpBubble('forge_trig')}
                        ${pos === 4 ? `<div class="pcx-row-2"><div><label class="pcx-field-label">Глубина (0 = низ)</label><input id="pcx-fge-depth" type="number" min="0" max="999" class="pcx-input" value="${Math.max(0, Number(d.depth) || 0)}"></div><div><label class="pcx-field-label">Роль</label><select id="pcx-fge-role" class="pcx-select"><option value="0" ${Number(d.role) === 0 ? 'selected' : ''}>System</option><option value="1" ${Number(d.role) === 1 ? 'selected' : ''}>User</option><option value="2" ${Number(d.role) === 2 ? 'selected' : ''}>Assistant</option></select></div></div>` : ''}
                        <div>
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px;flex-wrap:wrap;">
                                <label class="pcx-field-label" style="margin:0">Содержание страницы</label>
                                <div style="display:flex;gap:5px;">
                                    <button type="button" class="pcx-mini-btn" id="pcx-fge-format-btn" title="Разделить слипшиеся блоки и расставить чистые отступы">${ICONS.align}<span>Отступы</span></button>
                                    <button type="button" class="pcx-mini-btn" id="pcx-fge-import-txt">${ICONS.clip}<span>Из файла</span></button>
                                </div>
                                <input type="file" id="pcx-fge-file-in" accept=".txt,.md,.json,.csv" style="display:none">
                            </div>
                            <textarea id="pcx-fge-content" class="pcx-textarea" style="min-height:150px" placeholder="Текст статьи лора...">${escapeHtml(d.content)}</textarea>
                        </div>
                        <div>
                            <div style="display:flex;align-items:center;margin-bottom:5px;">
                                <span class="pcx-field-label" style="margin:0">Контроль рекурсии ${renderHelpBtn('forge_recursion')}</span>
                            </div>
                            ${renderHelpBubble('forge_recursion')}
                            <div class="pcx-check-grid">
                                <label class="pcx-check-item"><input type="checkbox" id="pcx-fge-prevrec" ${d.preventRecursion ? 'checked' : ''}><span>Не будить другие страницы текстом этой статьи</span></label>
                                <label class="pcx-check-item"><input type="checkbox" id="pcx-fge-exclrec" ${d.excludeRecursion ? 'checked' : ''}><span>Срабатывать только от чата (не от других страниц)</span></label>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="pcx-icon-btn" id="pcx-fge-cancel-2">Отмена</button><button type="button" class="pcx-primary-btn" id="pcx-fge-save">${ICONS.check}<span>Сохранить страницу</span></button></div>
                    `}
                </div>`;
        }

        // INSIDE A LOREBOOK: Collapsible pages + Recursion Checker + Scope Pills (No Search)
        if (state.screen === 'book_entries' && state.activeBookData) {
            const list = Object.values(state.activeBookData.entries || {}).sort((a, b) => Number(a.uid) - Number(b.uid));

            const isAnyBound = globalList.includes(state.activeBookId) || chatBoundList.includes(state.activeBookId) || charBound === state.activeBookId;
            const colMap = getBookCollapsedMap(state.activeBookId);
            const allCollapsed = list.length > 0 && list.every(e => Boolean(colMap[e.uid]));

            const recReport = analyzeBookRecursion(
                state.activeBookData.entries,
                [stApi.ctx?.name1, stApi.ctx?.name2].filter(Boolean),
            );
            const loopUidSet = new Set(recReport.loops.flatMap(l => l.uids.map(String)));
            const recBadgeText = recReport.loops.length > 0
                ? `${tUi(uiLang, 'Петель', 'Loops')}: ${recReport.loops.length}`
                : `${tUi(uiLang, 'Рекурсия', 'Recursion')} (${recReport.totalLinks})`;

            const recursionPanelHtml = !state.showRecursionPanel ? '' : `
                <div class="pcx-rec-panel">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:12.5px;font-weight:800;color:var(--pcx-accent);display:inline-flex;align-items:center;">${tUi(uiLang, 'Инспектор рекурсии книги', 'Book Recursion Inspector')} ${renderHelpBtn('forge_recursion')}</span>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${recReport.loops.length > 0 ? `<button type="button" class="pcx-mini-btn" style="border-color:var(--pcx-accent-2);color:var(--pcx-accent-2)" id="pcx-fg-break-loops">${ICONS.check}<span>${tUi(uiLang, 'Разорвать петли', 'Break Loops')}</span></button>` : ''}
                            ${list.length > 0 ? `<button type="button" class="pcx-mini-btn" id="pcx-fg-toggle-all-rec">${ICONS.loop}<span>${recReport.allIsolated ? tUi(uiLang, 'Разрешить цепочки', 'Allow Chains') : tUi(uiLang, 'Изолировать все страницы', 'Isolate All Pages')}</span></button>` : ''}
                        </div>
                    </div>
                    ${renderHelpBubble('forge_recursion')}
                    ${recReport.loops.length === 0 && recReport.chains.length === 0 && recReport.broadWarnings.length === 0
                        ? `<div class="pcx-rec-item">${tUi(uiLang, 'Чисто! Ни взаимных петель, ни скрытых цепных срабатываний между страницами не обнаружено.', 'Clean! No mutual loops or hidden cascade chains detected.')}</div>`
                        : ''}
                    ${recReport.loops.map(lp => `<div class="pcx-rec-item pcx-rec-danger"><b>${tUi(uiLang, 'Замкнутая петля:', 'Mutual Loop:')}</b> ${escapeHtml(lp.label)}</div>`).join('')}
                    ${recReport.broadWarnings.map(w => `<div class="pcx-rec-item pcx-rec-danger"><b>${tUi(uiLang, 'Широкий ключ', 'Broad Key')} «${escapeHtml(w.key)}»</b> (${escapeHtml(w.title)}) — ${escapeHtml(w.reason)}</div>`).join('')}
                    ${recReport.chains.slice(0, 12).map(ch => `<div class="pcx-rec-item"><b>«${escapeHtml(ch.title)}»</b> -> ${ch.targets.map(t => `«${escapeHtml(t.title)}» (${escapeHtml(t.key)})`).join(', ')}</div>`).join('')}
                </div>`;

            const subbarHtml = list.length > 0 ? `
                <div class="pcx-subbar" style="flex-wrap:wrap;">
                    <span>${pluralizePages(list.length, uiLang)}</span>
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="pcx-mini-btn ${state.showRecursionPanel ? 'pcx-active' : ''}" id="pcx-fg-rec-btn" style="${recReport.loops.length > 0 ? 'border-color:var(--pcx-accent-2);color:var(--pcx-accent-2)' : ''}">${ICONS.loop}<span>${escapeHtml(recBadgeText)}</span></button>
                        <button type="button" class="pcx-mini-btn" id="pcx-fg-collapse-all">${allCollapsed ? ICONS.chevDown : ICONS.chevUp}<span>${allCollapsed ? tUi(uiLang, 'Развернуть все', 'Expand All') : tUi(uiLang, 'Свернуть все', 'Collapse All')}</span></button>
                    </div>
                </div>` : '';

            return `
                <div class="pcx-panel-box" style="padding:11px 12px;gap:9px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                            <button type="button" class="pcx-mini-btn" id="pcx-fg-back-shelf">${ICONS.chevLeft}<span>${tUi(uiLang, 'Полка', 'Shelf')}</span></button>
                            <b style="font-size:13.5px;color:var(--pcx-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(state.activeBookId)}</b>
                        </div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            <button type="button" class="pcx-secondary-btn" style="height:30px;padding:0 10px;font-size:11.5px;" id="pcx-fge-new-ai-btn">${ICONS.spark}<span>${tUi(uiLang, '+ Страница с ИИ', '+ AI Page')}</span></button>
                            <button type="button" class="pcx-primary-btn" style="height:30px;padding:0 11px;font-size:11.5px;" id="pcx-fge-new-btn">${ICONS.plus}<span>${tUi(uiLang, 'Вручную', 'Manual')}</span></button>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:11px;color:var(--pcx-text-muted);display:inline-flex;align-items:center;">${tUi(uiLang, 'Где включена книга', 'Active Scope')} ${renderHelpBtn('forge_scope')}</span>
                        ${renderBindPills(state.activeBookId)}
                    </div>
                    ${renderHelpBubble('forge_scope')}
                    ${!isAnyBound ? `<div style="font-size:11px;color:var(--pcx-accent-2);">${tUi(uiLang, 'Книга сейчас выключена — нажми «Глобально», «В чат» или «Персонаж» выше.', 'This Lorebook is currently off — toggle Global, Chat, or Char above.')}</div>` : ''}
                </div>

                ${subbarHtml}
                ${recursionPanelHtml}

                ${list.length === 0 ? `<div class="pcx-empty">${tUi(uiLang, 'В книге пока нет страниц.<br>Нажми <b>«+ Страница с ИИ»</b> или <b>«+ Вручную»</b>!', 'No pages in this Lorebook yet.<br>Tap <b>+ AI Page</b> or <b>+ Manual</b>!')}</div>` : list.map(ent => {
                    const isOn = !ent.disable;
                    const isCol = Boolean(colMap[ent.uid]);
                    const modeTag = ent.constant ? tUi(uiLang, 'Постоянно', 'Constant') : (ent.vectorized ? tUi(uiLang, 'Вектор', 'Vector') : tUi(uiLang, 'По ключам', 'Keywords'));
                    const keysArr = Array.isArray(ent.key) ? ent.key.map(k => String(k).trim()).filter(Boolean) : [];
                    const scanInfo = scanEntryAgainstRecentChat(ent);
                    const hitSet = new Set(scanInfo.hitKeys);
                    const outLinks = recReport.outMap[ent.uid] || [];
                    const hasLoop = loopUidSet.has(String(ent.uid));

                    const safeUid = escapeHtml(String(ent.uid));
                    return `
                        <div class="pcx-card ${isOn ? '' : 'pcx-card-off'} ${isCol ? 'pcx-collapsed' : ''}">
                            <div class="pcx-card-top">
                                <div class="pcx-card-title-group">
                                    <div class="pcx-switch ${isOn ? 'pcx-on' : ''}" data-fg-toggle="${safeUid}"></div>
                                    <div class="pcx-card-title" data-fg-collapse="${safeUid}">${escapeHtml(ent.comment || (tUi(uiLang, 'Страница #', 'Page #') + String(ent.uid)))}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                                    ${hasLoop ? `<span class="pcx-prio-badge" style="color:#ff5c77">${tUi(uiLang, 'Петля', 'Loop')}</span>` : ''}
                                    ${ent.preventRecursion ? `<span class="pcx-prio-badge">${tUi(uiLang, 'Без каскада', 'Isolated')}</span>` : ''}
                                    ${isCol && keysArr.length > 0 ? `<span class="pcx-prio-badge">${keysArr.length} ${tUi(uiLang, 'кл.', 'keys')}</span>` : ''}
                                    <span class="pcx-prio-badge">${modeTag}</span>
                                    <button type="button" class="pcx-collapse-btn" data-fg-collapse="${safeUid}" title="${isCol ? tUi(uiLang, 'Развернуть запись', 'Expand entry') : tUi(uiLang, 'Свернуть запись', 'Collapse entry')}">${isCol ? ICONS.chevDown : ICONS.chevUp}</button>
                                </div>
                            </div>
                            ${!isCol ? `
                                ${keysArr.length > 0 ? `<div class="pcx-key-chips">${keysArr.map(k => `<span class="pcx-key-chip ${hitSet.has(k) ? 'pcx-key-hit' : ''}">${ICONS.key}<span>${escapeHtml(k)}</span></span>`).join('')}</div>` : ''}
                                <div class="pcx-scan-bar ${scanInfo.live && isAnyBound ? 'pcx-scan-live' : ''}">
                                    <span>${escapeHtml(scanInfo.label)}</span>
                                </div>
                                ${outLinks.length > 0 ? `<div class="pcx-rec-note">${hasLoop ? `<b>${tUi(uiLang, 'Взаимная петля рекурсии!', 'Mutual recursion loop!')}</b> ` : ''}${tUi(uiLang, 'Цепляет по рекурсии:', 'Triggers via recursion:')} ${outLinks.map(o => `«${escapeHtml(o.title)}» (${escapeHtml(o.key)})`).join(', ')}</div>` : ''}
                                <div class="pcx-card-content" style="max-height:145px">${escapeHtml(ent.content || '')}</div>
                                <div class="pcx-card-footer">
                                    <button type="button" class="pcx-mini-btn" data-fg-norec="${safeUid}" title="Запретить тексту этой страницы будить другие страницы">${ICONS.loop}<span>${ent.preventRecursion ? tUi(uiLang, 'Изолирована', 'Isolated') : tUi(uiLang, 'Рекурсия', 'Recursion')}</span></button>
                                    <button type="button" class="pcx-mini-btn" data-fg-vec="${safeUid}">${ICONS.vector}<span>${ent.vectorized ? tUi(uiLang, 'Вектор: ВКЛ', 'Vector: ON') : tUi(uiLang, 'Вектор', 'Vector')}</span></button>
                                    <button type="button" class="pcx-mini-btn" data-fg-ai-edit="${safeUid}">${ICONS.spark}<span>${tUi(uiLang, 'С ИИ', 'AI')}</span></button>
                                    <button type="button" class="pcx-mini-btn" data-fg-edit="${safeUid}">${ICONS.edit}<span>${tUi(uiLang, 'Править', 'Edit')}</span></button>
                                    <button type="button" class="pcx-mini-btn" data-fg-del="${safeUid}">${ICONS.trash}</button>
                                </div>
                            ` : ''}
                        </div>`;
                }).join('')}`;
        }

        // BOOKSHELF (No Search)
        const sortedBooks = [...state.books].sort((a, b) => {
            const aActive = globalList.includes(a.file_id) || chatBoundList.includes(a.file_id) || charBound === a.file_id ? 1 : 0;
            const bActive = globalList.includes(b.file_id) || chatBoundList.includes(b.file_id) || charBound === b.file_id ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            return String(a.name || a.file_id).localeCompare(String(b.name || b.file_id));
        });

        return `
            <div class="pcx-forge-toolbar">
                <div class="pcx-forge-toprow">
                    <span style="font-size:13.5px;font-weight:800;color:var(--pcx-text);display:inline-flex;align-items:center;">${tUi(uiLang, 'Полка Лорбуков', 'Lorebook Shelf')} (${state.books.length}) ${renderHelpBtn('forge_shelf')}</span>
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="pcx-icon-btn" id="pcx-fg-new-manual-btn">${ICONS.plus}<span>${tUi(uiLang, 'Пустой том', 'New Tome')}</span></button>
                        <button type="button" class="pcx-primary-btn" style="height:33px;padding:0 13px;font-size:12px;" id="pcx-fg-open-hub-btn">${ICONS.forge}<span>${tUi(uiLang, 'Создать / Выковать', 'Create / Forge')}</span></button>
                    </div>
                </div>
                ${renderHelpBubble('forge_shelf')}
            </div>

            ${state.loading ? `<div class="pcx-empty">${tUi(uiLang, 'Открываем архивы Лорбуков Таверны...', 'Loading Lorebooks...')}</div>` : (
                sortedBooks.length === 0
                    ? `<div class="pcx-empty">${tUi(uiLang, 'На полке пока нет Лорбуков.<br>Нажми <b>«Создать / Выковать»</b>!', 'No Lorebooks yet.<br>Tap <b>Create / Forge</b>!')}</div>`
                    : `<div class="pcx-book-grid">${sortedBooks.map(b => {
                        const isGlob = globalList.includes(b.file_id);
                        const isChat = chatBoundList.includes(b.file_id);
                        const isChar = charBound === b.file_id;
                        const isAny = isGlob || isChat || isChar;
                        const cover = b.extensions?.pocket_codex_cover || '';
                        const cnt = state.bookCounts[b.file_id];
                        const countLabel = cnt !== undefined ? pluralizePages(cnt, uiLang) : tUi(uiLang, 'Том знаний', 'Lore Tome');

                        return `
                            <div class="pcx-tome-card ${isAny ? 'pcx-book-bound' : ''}">
                                <div class="pcx-tome-main">
                                    <div class="pcx-book-cover" data-fg-cover="${escapeHtml(b.file_id)}" title="Сменить Арт-обложку">
                                        ${cover ? `<img src="${escapeHtml(cover)}">` : `${ICONS.forge}<span class="pcx-cover-hint">${tUi(uiLang, 'ОБЛОЖКА', 'COVER')}</span>`}
                                    </div>
                                    <div class="pcx-book-info">
                                        <div>
                                            <div class="pcx-book-title" data-fg-open="${escapeHtml(b.file_id)}">${escapeHtml(b.name)}</div>
                                            <div class="pcx-book-meta"><span>${escapeHtml(countLabel)}</span>${isAny ? `<span style="color:var(--pcx-accent)">• ${tUi(uiLang, 'АКТИВЕН', 'ACTIVE')}</span>` : ''}</div>
                                        </div>
                                        ${renderBindPills(b.file_id)}
                                    </div>
                                </div>
                                <div class="pcx-tome-footer">
                                    <div style="display:flex;gap:5px;flex-wrap:wrap;">
                                        <button type="button" class="pcx-mini-btn" data-fg-open="${escapeHtml(b.file_id)}">${ICONS.book}<span>${tUi(uiLang, 'Страницы', 'Pages')}</span></button>
                                        <button type="button" class="pcx-mini-btn" data-fg-quick-ai="${escapeHtml(b.file_id)}">${ICONS.spark}<span>${tUi(uiLang, '+ С ИИ', '+ AI Page')}</span></button>
                                    </div>
                                    <button type="button" class="pcx-mini-btn" data-fg-delbook="${escapeHtml(b.file_id)}" title="Удалить Лорбук">${ICONS.trash}</button>
                                </div>
                            </div>`;
                    }).join('')}</div><input type="file" id="pcx-fg-shelf-cover-in" accept="image/*" style="display:none">`
            )}`;
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
        const tEl = win.querySelector('#pcx-fge-content');
        const taskEl = win.querySelector('#pcx-fgp-task');
        const refEl = win.querySelector('#pcx-fgc-refine');
        const candC = win.querySelector('#pcx-fgc-comment');
        const candK = win.querySelector('#pcx-fgc-keys');
        const candT = win.querySelector('#pcx-fgc-content');

        if (cEl) d.comment = cEl.value;
        if (kEl) d.key = kEl.value.split(',').map(k => k.trim()).filter(Boolean);
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
        const goShelf = () => { state.screen = 'shelf'; fetchBooksList().then(() => requestRender()); };
        win.querySelector('#pcx-fg-back-shelf')?.addEventListener('click', goShelf);
        win.querySelector('#pcx-fg-back-shelf-2')?.addEventListener('click', goShelf);

        win.querySelector('#pcx-fg-open-hub-btn')?.addEventListener('click', () => { state.screen = 'create_hub'; requestRender(); });
        win.querySelector('#pcx-fg-new-manual-btn')?.addEventListener('click', () => {
            state.newBookName = ''; state.newBookCover = ''; state.newBookBindScope = 'global';
            state.screen = 'new_book'; requestRender();
        });

        win.querySelector('#pcx-hub-whole-ai')?.addEventListener('click', () => {
            state.wizMode = 'ai_adapt'; state.bindAfterScope = 'global'; state.screen = 'wizard'; requestRender();
        });
        win.querySelector('#pcx-hub-whole-manual')?.addEventListener('click', () => {
            state.newBookName = ''; state.newBookCover = ''; state.newBookBindScope = 'global';
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
            if (scope === 'global') await stApi.toggleGlobalLorebook?.(bookId);
            else if (scope === 'chat') await toggleBindBookToChat(bookId);
            else if (scope === 'char') await stApi.toggleCharLorebook?.(bookId);
            requestRender({ preserveBodyScroll: true });
        }));

        win.querySelector('#pcx-fg-newname')?.addEventListener('input', e => { state.newBookName = e.target.value; });
        win.querySelector('#pcx-fg-newscope')?.addEventListener('change', e => { state.newBookBindScope = e.target.value; });
        win.querySelector('#pcx-fg-newcover-btn')?.addEventListener('click', () => win.querySelector('#pcx-fg-newcover-input')?.click());
        win.querySelector('#pcx-fg-newcover-pick')?.addEventListener('click', () => win.querySelector('#pcx-fg-newcover-input')?.click());
        win.querySelector('#pcx-fg-newcover-input')?.addEventListener('change', async e => {
            const f = e.target.files?.[0]; if (!f) return;
            state.newBookCover = (await compressImageFile(f, 520, 0.82)).dataUrl; requestRender();
        });
        win.querySelector('#pcx-fg-create-manual-confirm')?.addEventListener('click', async () => {
            const name = (state.newBookName || '').trim(); if (!name) return;
            const fileId = name.replace(/[<>:"/\\|?*]/g, '_');
            await fetchBooksList();
            const existsAlready = state.books.some(b => String(b.file_id).toLowerCase() === fileId.toLowerCase());
            if (existsAlready) {
                const overwriteOk = window.confirm(`Лорбук «${fileId}» уже существует на полке! Открыть существующий том без стирания (ОК) или отменить (Отмена)?`);
                if (!overwriteOk) return;
                const existingData = await loadBookData(fileId);
                if (state.newBookCover) {
                    existingData.extensions = existingData.extensions || {};
                    existingData.extensions.pocket_codex_cover = state.newBookCover;
                    await saveBookData(fileId, existingData);
                }
                await applyBindingScope(fileId, state.newBookBindScope);
                state.activeBookId = fileId; state.activeBookData = existingData; state.screen = 'book_entries'; requestRender();
                return;
            }
            const data = { entries: {}, extensions: {} };
            if (state.newBookCover) data.extensions.pocket_codex_cover = state.newBookCover;
            await saveBookData(fileId, data);
            await applyBindingScope(fileId, state.newBookBindScope);
            await fetchBooksList();
            state.activeBookId = fileId; state.activeBookData = data; state.screen = 'book_entries'; requestRender();
        });

        win.querySelectorAll('[data-fg-open]').forEach(el => el.addEventListener('click', async () => {
            state.activeBookId = el.dataset.fgOpen;
            state.showRecursionPanel = false;
            state.activeBookData = await loadBookData(state.activeBookId);
            state.screen = 'book_entries'; requestRender();
        }));
        win.querySelectorAll('[data-fg-quick-ai]').forEach(btn => btn.addEventListener('click', async () => {
            const bookId = btn.dataset.fgQuickAi;
            state.activeBookId = bookId;
            state.activeBookData = await loadBookData(bookId);
            openEntryEditor({ bookId, uid: null, initialTab: 'ai' });
            requestRender();
        }));
        win.querySelectorAll('[data-fg-delbook]').forEach(btn => btn.addEventListener('click', async () => {
            const bookId = btn.dataset.fgDelbook;
            if (!bookId || !window.confirm(`Удалить Лорбук «${bookId}» целиком?`)) return;
            try {
                if (getChatBoundBooks().includes(bookId)) await toggleBindBookToChat(bookId);
                if ((stApi.getGlobalLorebooks?.() || []).includes(bookId)) await stApi.toggleGlobalLorebook?.(bookId);
                if (stApi.getCharLorebook?.() === bookId) await stApi.toggleCharLorebook?.(bookId);
                await stApi.deleteWorldInfoBook(bookId);
                delete state.bookCounts[bookId];
                await fetchBooksList();
                requestRender({ preserveBodyScroll: true });
            } catch (err) { window.alert(err?.message || String(err)); }
        }));

        let coverTargetBookId = '';
        win.querySelectorAll('[data-fg-cover]').forEach(el => el.addEventListener('click', () => {
            coverTargetBookId = el.dataset.fgCover;
            win.querySelector('#pcx-fg-shelf-cover-in')?.click();
        }));
        win.querySelector('#pcx-fg-shelf-cover-in')?.addEventListener('change', async e => {
            const f = e.target.files?.[0]; if (!f || !coverTargetBookId) return;
            const att = await compressImageFile(f, 520, 0.82);
            const data = await loadBookData(coverTargetBookId);
            data.extensions = data.extensions || {}; data.extensions.pocket_codex_cover = att.dataUrl;
            await saveBookData(coverTargetBookId, data); await fetchBooksList(); requestRender({ preserveBodyScroll: true });
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
            if (!state.activeBookData) return;
            const rep = analyzeBookRecursion(state.activeBookData.entries, [stApi.ctx?.name1, stApi.ctx?.name2].filter(Boolean));
            for (const lp of rep.loops) {
                for (const uid of lp.uids) {
                    if (state.activeBookData.entries[uid]) state.activeBookData.entries[uid].preventRecursion = true;
                }
            }
            await saveBookData(state.activeBookId, state.activeBookData);
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-toggle-all-rec')?.addEventListener('click', async () => {
            if (!state.activeBookData) return;
            const list = Object.values(state.activeBookData.entries || {});
            const allIso = list.length > 0 && list.every(e => Boolean(e.preventRecursion));
            for (const e of list) e.preventRecursion = !allIso;
            await saveBookData(state.activeBookId, state.activeBookData);
            requestRender({ preserveBodyScroll: true });
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
            const ent = state.activeBookData?.entries?.[sw.dataset.fgToggle]; if (!ent) return;
            ent.disable = !ent.disable; await saveBookData(state.activeBookId, state.activeBookData); requestRender({ preserveBodyScroll: true });
        }));
        win.querySelectorAll('[data-fg-norec]').forEach(btn => btn.addEventListener('click', async () => {
            const ent = state.activeBookData?.entries?.[btn.dataset.fgNorec]; if (!ent) return;
            ent.preventRecursion = !ent.preventRecursion;
            await saveBookData(state.activeBookId, state.activeBookData); requestRender({ preserveBodyScroll: true });
        }));
        win.querySelectorAll('[data-fg-vec]').forEach(btn => btn.addEventListener('click', async () => {
            const ent = state.activeBookData?.entries?.[btn.dataset.fgVec]; if (!ent) return;
            ent.vectorized = !ent.vectorized; if (ent.vectorized) ent.constant = false;
            await saveBookData(state.activeBookId, state.activeBookData); requestRender({ preserveBodyScroll: true });
        }));
        win.querySelectorAll('[data-fg-edit]').forEach(btn => btn.addEventListener('click', () => {
            if (!state.activeBookData?.entries?.[btn.dataset.fgEdit]) return;
            openEntryEditor({ bookId: state.activeBookId, uid: btn.dataset.fgEdit, initialTab: 'manual' });
            requestRender();
        }));
        win.querySelectorAll('[data-fg-ai-edit]').forEach(btn => btn.addEventListener('click', () => {
            if (!state.activeBookData?.entries?.[btn.dataset.fgAiEdit]) return;
            openEntryEditor({ bookId: state.activeBookId, uid: btn.dataset.fgAiEdit, initialTab: 'ai' });
            requestRender();
        }));
        win.querySelectorAll('[data-fg-del]').forEach(btn => btn.addEventListener('click', async () => {
            delete state.activeBookData.entries[btn.dataset.fgDel];
            await saveBookData(state.activeBookId, state.activeBookData); requestRender({ preserveBodyScroll: true });
        }));

        // Entry editor events
        if (state.screen === 'entry_edit' && state.entryDraft) {
            const d = state.entryDraft;
            const cancelEdit = async () => {
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
            win.querySelector('#pcx-fge-keys')?.addEventListener('input', e => { d.key = e.target.value.split(',').map(k => k.trim()).filter(Boolean); });
            win.querySelector('#pcx-fge-genkeys')?.addEventListener('click', () => { captureEntryFields(win); generateKeysForCurrentDraft(); });
            win.querySelector('#pcx-fge-trig')?.addEventListener('change', e => { d.constant = (e.target.value === 'const'); d.vectorized = (e.target.value === 'vec'); });
            win.querySelector('#pcx-fge-pos')?.addEventListener('change', e => { captureEntryFields(win); d.position = Number(e.target.value); requestRender({ preserveBodyScroll: true }); });
            win.querySelector('#pcx-fge-depth')?.addEventListener('input', e => { d.depth = Math.max(0, Number(e.target.value) || 0); });
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
                requestRender();
            });

            // Single Page AI Preset, Word Count & Prompt Editor
            win.querySelector('#pcx-fgp-preset')?.addEventListener('change', e => {
                captureEntryFields(win);
                const chosen = FORGE_BOOK_PRESETS.find(p => p.id === e.target.value) || FORGE_BOOK_PRESETS[0];
                s.forgePresetId = chosen.id;
                s.forgePageSystemPrompt = chosen.pagePrompt;
                s.forgeBookSystemPrompt = chosen.bookPrompt;
                stApi.saveSettings();
                requestRender({ preserveBodyScroll: true });
            });
            win.querySelector('#pcx-fgp-toggle-prompt')?.addEventListener('click', () => {
                captureEntryFields(win);
                state.showPagePromptEditor = !state.showPagePromptEditor;
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
                d.key = String(chosen.keys || '').split(',').map(k => k.trim()).filter(Boolean);
                d.content = formatCleanParagraphs(chosen.content);
                d.constant = Boolean(chosen.constant);
                await saveDraftToTargetBook(d);
                requestRender();
            });
        }

        // Wizard & Approve events
        win.querySelector('#pcx-fg-back-wiz')?.addEventListener('click', () => { state.screen = 'wizard'; requestRender(); });
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
            const chosen = FORGE_BOOK_PRESETS.find(p => p.id === e.target.value) || FORGE_BOOK_PRESETS[0];
            s.forgePresetId = chosen.id;
            s.forgeBookSystemPrompt = chosen.bookPrompt;
            s.forgePageSystemPrompt = chosen.pagePrompt;
            stApi.saveSettings();
            requestRender({ preserveBodyScroll: true });
        });
        win.querySelector('#pcx-fg-toggle-book-prompt')?.addEventListener('click', () => {
            captureEntryFields(win);
            state.showBookPromptEditor = !state.showBookPromptEditor;
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
        win.querySelector('#pcx-fg-mute-cats')?.addEventListener('change', e => { state.wizMuteExportedCats = e.target.checked; });
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
            win.querySelectorAll('.pcx-st-depth').forEach(el => el.addEventListener('input', () => { state.stagedEntries[Number(el.dataset.idx)].depth = Math.max(0, Number(el.value) || 0); }));
            win.querySelectorAll('.pcx-st-role').forEach(el => el.addEventListener('change', () => { state.stagedEntries[Number(el.dataset.idx)].role = Number(el.value); }));
            win.querySelectorAll('.pcx-st-content').forEach(el => el.addEventListener('input', () => { state.stagedEntries[Number(el.dataset.idx)].content = el.value; }));
            win.querySelector('#pcx-fg-commit-btn')?.addEventListener('click', commitApprovedLorebook);
        }
    }

    return {
        onEnterForge() { fetchBooksList().then(() => requestRender()); },
        renderForgeBody,
        bindForgeEvents,
        captureForgeFields: captureEntryFields,
        get isBusy() { return state.wizForging || state.pageAiGenerating || state.keysGenerating; },
    };
}
