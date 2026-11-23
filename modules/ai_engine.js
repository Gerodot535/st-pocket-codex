import { isSchemaUnsupportedError } from './presets_and_i18n.js';

// Lossless in-memory Blob URL cache so multi-hundred-KB Base64 covers & attachments
// are NEVER re-parsed by innerHTML on re-renders (eliminates browser lag & click-jank).
const dataUrlToBlobUrlCache = new Map();

export function toBlobDisplayUrl(src) {
    if (!src || typeof src !== 'string') return '';
    const trimmed = src.trim();
    if (!trimmed) return '';
    if (!trimmed.startsWith('data:image/')) return trimmed;
    const cached = dataUrlToBlobUrlCache.get(trimmed);
    if (cached) return cached;
    try {
        const commaIdx = trimmed.indexOf(',');
        if (commaIdx === -1) return trimmed;
        const meta = trimmed.slice(5, commaIdx);
        const isBase64 = meta.includes(';base64');
        const mime = meta.split(';')[0] || 'image/png';
        const rawData = trimmed.slice(commaIdx + 1);
        let bytes;
        if (isBase64) {
            const bin = atob(rawData);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
            const decoded = decodeURIComponent(rawData);
            bytes = new TextEncoder().encode(decoded);
        }
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        if (dataUrlToBlobUrlCache.size > 240) {
            const oldestKey = dataUrlToBlobUrlCache.keys().next().value;
            const oldestUrl = dataUrlToBlobUrlCache.get(oldestKey);
            if (oldestUrl) {
                try { URL.revokeObjectURL(oldestUrl); } catch {}
            }
            dataUrlToBlobUrlCache.delete(oldestKey);
        }
        dataUrlToBlobUrlCache.set(trimmed, blobUrl);
        return blobUrl;
    } catch {
        return trimmed;
    }
}

// Lossless file -> DataURL reader (zero recompression / zero quality loss for covers & photos)
export function readImageFileLossless(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('Файл изображения не выбран.'));
            return;
        }
        if (file.size > 18 * 1024 * 1024) {
            reject(new Error('Изображение слишком велико (максимум 18 МБ).'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
        reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (!dataUrl.startsWith('data:image/')) {
                reject(new Error('Неподдерживаемый формат изображения.'));
                return;
            }
            resolve({
                id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                kind: 'image',
                name: file.name || 'image.png',
                mime: file.type || 'image/png',
                dataUrl,
                includeInPrompt: false,
            });
        };
        reader.readAsDataURL(file);
    });
}

// Active-chat macro leak regex — strips ONLY active-chat character/world/persona macros from preset wrappers
// while preserving 100% of intentional '\n' empty toggles (e.g. GEMINI ENGINE) and ALL assistant prefill blocks!
const CHAT_LEAK_MACRO_RE = /\{\{\s*(?:description|charDescription|personality|charPersonality|scenario|persona|personaDescription|mesExamples|mesExamplesRaw|worldInfoBefore|worldInfoAfter|wiBefore|wiAfter|anchorBefore|anchorAfter|systemNote|authorsNote|charPrompt|charInstruction|charJailbreak|lastMessage|lastUserMessage|lastCharMessage|chatStart|notebook|outlet::[^}]+)\s*\}\}/gi;

function stripActiveChatMacrosFromPresetBlock(rawContent) {
    if (typeof rawContent !== 'string' || rawContent.length === 0) return '';
    return rawContent.replace(CHAT_LEAK_MACRO_RE, '');
}

// 1:1 faithful to SillyTavern PromptManager & NexusMatch v2.0.1:
// Preserves ALL assistant role blocks (before chatHistory, @ Depth, after chatHistory, enhanceDefinitions, Sugar Rush, assistant_prefill)
// AND preserves ALL whitespace/empty newline toggles ("\n") verbatim!
export function buildPresetAlignedMessages(
    ctx,
    userTaskContent,
    systemPrompt = '',
    presetCorrectionPrompt = '',
    { stripActiveCharFromPreset = true, outTrace = null } = {},
) {
    const oai = ctx?.chatCompletionSettings || {};
    const prompts = Array.isArray(oai.prompts) ? oai.prompts : [];
    const byId = new Map(prompts.map((p) => [p?.identifier, p]));
    const orderEntry = Array.isArray(oai.prompt_order)
        ? (oai.prompt_order.find((o) => o?.character_id === 100001)
            || oai.prompt_order.find((o) => o?.character_id === 100000)
            || oai.prompt_order[0])
        : null;
    const orderList = Array.isArray(orderEntry?.order) ? orderEntry.order.filter((x) => x?.enabled) : [];

    const chatIdx = orderList.findIndex((x) => x.identifier === 'chatHistory');
    const messages = [];

    // ONLY true character/world/chat markers — NEVER skip 'enhanceDefinitions', 'nsfw', 'jailbreak', or 'main'!
    const TRUE_MARKER_SLOTS = new Set([
        'worldInfoBefore', 'worldInfoAfter', 'charDescription', 'charPersonality',
        'scenario', 'personaDescription', 'dialogueExamples', 'chatHistory',
    ]);

    const pushTrace = (zone, role, label, contentStr) => {
        if (!Array.isArray(outTrace)) return;
        const isWhitespaceToggle = contentStr.length > 0 && contentStr.trim().length === 0;
        outTrace.push({
            zone,
            role,
            label,
            chars: contentStr.length,
            isWhitespaceToggle,
            preview: isWhitespaceToggle
                ? `[Пустой/пробельный тогл сохранён: ${JSON.stringify(contentStr)}]`
                : contentStr.replace(/\s+/g, ' ').trim().slice(0, 110),
        });
    };

    const resolveBlockMessage = (id, defaultRole = 'system') => {
        if (id === 'chatHistory') return null;
        if (stripActiveCharFromPreset && TRUE_MARKER_SLOTS.has(id)) return null;
        const p = byId.get(id);
        if (!p || p.marker === true) return null;
        if (typeof p.content !== 'string' || p.content.length === 0) return null;

        CHAT_LEAK_MACRO_RE.lastIndex = 0;
        const hadLeakMacro = stripActiveCharFromPreset && CHAT_LEAK_MACRO_RE.test(p.content);
        const finalContent = stripActiveCharFromPreset
            ? stripActiveChatMacrosFromPresetBlock(p.content)
            : p.content;

        // Only skip if the block originally held an active-chat macro and became empty after removing that macro.
        // Intentional '\n' / ' ' empty toggles and ALL assistant/user/system blocks are preserved 100% verbatim!
        if (hadLeakMacro && finalContent.trim().length === 0) {
            return null;
        }
        if (finalContent.length === 0) return null;

        return {
            role: p.role || defaultRole,
            content: finalContent,
            _label: p.name || id,
            _injPos: Number(p.injection_position) === 1 ? 1 : 0,
            _injDepth: Number.isFinite(Number(p.injection_depth)) ? Number(p.injection_depth) : 4,
            _injOrder: Number.isFinite(Number(p.injection_order)) ? Number(p.injection_order) : 100,
        };
    };

    const correctionClean = String(presetCorrectionPrompt || '').trim();
    const finalUserTask = correctionClean
        ? `${userTaskContent}\n\n${correctionClean}`
        : userTaskContent;

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
        pushTrace('PCX_SYS', 'system', 'Pocket Codex System Prompt', systemPrompt);
    }

    const depthBeforeTask = [];
    const depthZeroAfterTask = [];
    for (const item of orderList) {
        const p = byId.get(item.identifier);
        if (p && Number(p.injection_position) === 1) {
            const built = resolveBlockMessage(item.identifier, p.role || 'system');
            if (!built) continue;
            if (built._injDepth <= 0) depthZeroAfterTask.push(built);
            else depthBeforeTask.push(built);
        }
    }
    depthBeforeTask.sort((a, b) => (b._injDepth - a._injDepth) || (a._injOrder - b._injOrder));
    depthZeroAfterTask.sort((a, b) => a._injOrder - b._injOrder);

    const pushResolved = (zone, built) => {
        messages.push({ role: built.role, content: built.content });
        pushTrace(zone, built.role, built._label, built.content);
    };

    if (chatIdx === -1) {
        for (const item of orderList) {
            if (item.identifier === 'chatHistory') continue;
            const p = byId.get(item.identifier);
            if (p && Number(p.injection_position) === 1) continue;
            const built = resolveBlockMessage(item.identifier, 'system');
            if (built) pushResolved('BEFORE_CHAT', built);
        }
        for (const b of depthBeforeTask) pushResolved('DEPTH_BEFORE', b);
        messages.push({ role: 'user', content: finalUserTask });
        pushTrace('CHAT_TASK', 'user', 'Задание Pocket Codex (на месте Chat History)', finalUserTask);
        for (const b of depthZeroAfterTask) pushResolved('DEPTH_0_AFTER', b);
    } else {
        for (let i = 0; i < chatIdx; i++) {
            const id = orderList[i].identifier;
            const p = byId.get(id);
            if (p && Number(p.injection_position) === 1) continue;
            const built = resolveBlockMessage(id, 'system');
            if (built) pushResolved('BEFORE_CHAT', built);
        }
        for (const b of depthBeforeTask) pushResolved('DEPTH_BEFORE', b);

        messages.push({ role: 'user', content: finalUserTask });
        pushTrace('CHAT_TASK', 'user', 'Задание Pocket Codex (на месте Chat History)', finalUserTask);

        for (const b of depthZeroAfterTask) pushResolved('DEPTH_0_AFTER', b);

        for (let i = chatIdx + 1; i < orderList.length; i++) {
            const id = orderList[i].identifier;
            const p = byId.get(id);
            if (p && Number(p.injection_position) === 1) continue;
            const built = resolveBlockMessage(id, 'user');
            if (built) pushResolved('AFTER_CHAT', built);
        }
    }

    if (oai.assistant_prefill && String(oai.assistant_prefill).length > 0) {
        const prefillStr = stripActiveCharFromPreset
            ? stripActiveChatMacrosFromPresetBlock(oai.assistant_prefill)
            : String(oai.assistant_prefill);
        if (prefillStr.length > 0) {
            const alreadyHasSameAssistant = messages.some((m) => m.role === 'assistant' && m.content === prefillStr);
            if (!alreadyHasSameAssistant) {
                messages.push({ role: 'assistant', content: prefillStr });
                pushTrace('PREFILL_SETTING', 'assistant', 'oai_settings.assistant_prefill', prefillStr);
            }
        }
    }

    return messages;
}

export const lastPcxAiDiagnostics = {
    startedAt: 0,
    finishedAt: 0,
    ok: null,
    status: 'Запросов к ИИ в этой сессии ещё не было.',
    transportMode: 'preset',
    profileLabel: '[ Текущее подключение SillyTavern ]',
    presetTrace: [],
    assistantBlocksCount: 0,
    whitespaceTogglesCount: 0,
    systemPrompt: '',
    userPrompt: '',
    presetCorrection: '',
    responsePreview: '',
};

function extractResponseString(ctx, raw) {
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
        if (typeof ctx?.extractMessageFromData === 'function') {
            try {
                const extracted = ctx.extractMessageFromData(raw);
                if (typeof extracted === 'string' && extracted.length > 0) return extracted;
            } catch {}
        }
        if (typeof raw?.choices?.[0]?.message?.content === 'string') return raw.choices[0].message.content;
        if (typeof raw?.content === 'string') return raw.content;
        if (typeof raw?.text === 'string') return raw.text;
        return JSON.stringify(raw);
    }
    return String(raw ?? '');
}

export async function executePcxAiRequest({
    stApi,
    settings,
    profileId = '',
    profileLabel = '',
    systemPrompt = '',
    userPrompt = '',
    jsonSchema = null,
}) {
    const ctx = stApi?.ctx || {};
    const transportMode = settings?.aiTransportMode === 'direct' ? 'direct' : 'preset';
    const presetCorrection = String(settings?.presetCorrectionPrompt || '').trim();
    const maxTokens = Math.max(800, Number(settings?.aiMaxTokens) || 3400);
    const cleanProfileId = String(profileId || '').trim();
    const activeApi = ctx.mainApi || 'openai';
    const isChatCompletion = activeApi === 'openai';

    const presetTrace = [];
    let messagesArray = null;
    if (transportMode === 'preset') {
        messagesArray = buildPresetAlignedMessages(ctx, userPrompt, systemPrompt, presetCorrection, {
            stripActiveCharFromPreset: true,
            outTrace: presetTrace,
        });
    }

    lastPcxAiDiagnostics.startedAt = Date.now();
    lastPcxAiDiagnostics.finishedAt = 0;
    lastPcxAiDiagnostics.ok = null;
    lastPcxAiDiagnostics.status = 'Выполняется запрос к модели...';
    lastPcxAiDiagnostics.transportMode = transportMode;
    lastPcxAiDiagnostics.profileLabel = profileLabel || (cleanProfileId ? cleanProfileId : '[ Текущее подключение SillyTavern ]');
    lastPcxAiDiagnostics.presetTrace = presetTrace;
    lastPcxAiDiagnostics.assistantBlocksCount = presetTrace.filter((t) => t.role === 'assistant').length;
    lastPcxAiDiagnostics.whitespaceTogglesCount = presetTrace.filter((t) => t.isWhitespaceToggle).length;
    lastPcxAiDiagnostics.systemPrompt = systemPrompt;
    lastPcxAiDiagnostics.userPrompt = userPrompt;
    lastPcxAiDiagnostics.presetCorrection = transportMode === 'preset' ? presetCorrection : '';
    lastPcxAiDiagnostics.responsePreview = 'Ожидание ответа...';

    try {
        let rawResult;
        if (cleanProfileId) {
            const service = stApi.connectionService;
            if (!service || typeof service.sendRequest !== 'function') {
                throw new Error('Сервис профилей подключения SillyTavern недоступен. Выберите «[ Текущее подключение ]».');
            }
            if (transportMode === 'preset' && Array.isArray(messagesArray) && messagesArray.length > 0) {
                // Send full preset-aligned array (preserving assistant roles & '\n' toggles!)
                rawResult = await service.sendRequest(
                    cleanProfileId,
                    messagesArray,
                    maxTokens,
                    { stream: false, extractData: true, includePreset: false, includeInstruct: false },
                );
            } else {
                const payload = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
                if (jsonSchema) {
                    try {
                        rawResult = await service.sendRequest(
                            cleanProfileId,
                            payload,
                            maxTokens,
                            { stream: false, extractData: true, includePreset: false, includeInstruct: false },
                            { json_schema: jsonSchema },
                        );
                    } catch (err) {
                        if (!isSchemaUnsupportedError(err)) throw err;
                        rawResult = await service.sendRequest(
                            cleanProfileId,
                            payload,
                            maxTokens,
                            { stream: false, extractData: true, includePreset: false, includeInstruct: false },
                        );
                    }
                } else {
                    rawResult = await service.sendRequest(
                        cleanProfileId,
                        payload,
                        maxTokens,
                        { stream: false, extractData: true, includePreset: false, includeInstruct: false },
                    );
                }
            }
        } else if (transportMode === 'preset') {
            const rawDataFn = ctx.generateRawData;
            const rawFn = ctx.generateRaw;
            if (isChatCompletion && Array.isArray(messagesArray) && messagesArray.length > 0) {
                if (typeof rawDataFn === 'function') {
                    const data = await rawDataFn({
                        prompt: messagesArray,
                        api: activeApi,
                        systemPrompt: '',
                        prefill: '',
                        instructOverride: false,
                        quietToLoud: false,
                    });
                    rawResult = extractResponseString(ctx, data);
                } else if (typeof rawFn === 'function') {
                    rawResult = await rawFn({
                        prompt: messagesArray,
                        api: activeApi,
                        systemPrompt: '',
                        prefill: '',
                        instructOverride: false,
                        quietToLoud: false,
                    });
                } else {
                    rawResult = await stApi.generateWithSchemaFallback(systemPrompt, userPrompt, null);
                }
            } else {
                // Text Completion API: pass combined user + start_reply_with prefill
                const combinedUser = presetCorrection ? `${userPrompt}\n\n${presetCorrection}` : userPrompt;
                const tcPrefill = String(ctx?.textCompletionSettings?.start_reply_with || '');
                if (typeof rawFn === 'function') {
                    rawResult = await rawFn({
                        prompt: combinedUser,
                        api: activeApi,
                        systemPrompt,
                        prefill: tcPrefill,
                        instructOverride: false,
                        quietToLoud: false,
                    });
                } else {
                    rawResult = await stApi.generateWithSchemaFallback(systemPrompt, combinedUser, null);
                }
            }
        } else {
            rawResult = await stApi.generateWithSchemaFallback(systemPrompt, userPrompt, jsonSchema);
        }

        lastPcxAiDiagnostics.finishedAt = Date.now();
        lastPcxAiDiagnostics.ok = true;
        lastPcxAiDiagnostics.status = 'Ответ успешно получен.';
        lastPcxAiDiagnostics.responsePreview = extractResponseString(ctx, rawResult).slice(0, 6000);
        return rawResult;
    } catch (err) {
        lastPcxAiDiagnostics.finishedAt = Date.now();
        lastPcxAiDiagnostics.ok = false;
        lastPcxAiDiagnostics.status = 'Ошибка: ' + (err?.message || String(err));
        lastPcxAiDiagnostics.responsePreview = String(err?.stack || err?.message || err);
        throw err;
    }
}
