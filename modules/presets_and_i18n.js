// Presets, Paragraph Formatter, Recursion Analyzer & Bilingual UI (RU / EN)
// Strictly SVG & clean typography only — zero emojis in UI or prompts.

export function formatCleanParagraphs(rawText) {
    if (!rawText) return '';
    let t = String(rawText).replace(/\r\n/g, '\n');
    if (t.indexOf('\n') === -1 && t.indexOf('\\n') !== -1) {
        t = t.replace(/\\n/g, '\n');
    }
    // Separate glued bracketed subheaders: "...текст. [ПОДЗАГОЛОВОК]" or "...текст.\n[ПОДЗАГОЛОВОК]"
    t = t.replace(/([.!?;»")\]])[ \t]*\n?(\[(?:[^\]\n]{2,95})\])/g, '$1\n\n$2');
    // Separate glued bold subheaders after sentence end: "...текст. **Подзаголовок**"
    t = t.replace(/([.!?;»")\]])[ \t]*\n?(\*\*[^*\n]{2,75}\*\*)/g, '$1\n\n$2');
    // Separate glued markdown headings "### ..."
    t = t.replace(/([^\n])[ \t]*\n?(#{2,5}\s+)/g, '$1\n\n$2');
    // Separate glued numbered items after sentence end: "...текст. 1. Пункт"
    t = t.replace(/([.!?;»")])[ \t]+(\d{1,2}[.)]\s+[А-ЯЁA-Z«"\[])/g, '$1\n\n$2');
    // Trim trailing spaces per line & normalize multiple blank lines
    t = t.split('\n').map(l => l.replace(/[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return t;
}

export function parseSmartTriggerKeys(rawInput) {
    if (Array.isArray(rawInput)) {
        return rawInput.map(k => String(k ?? '').trim()).filter(Boolean);
    }
    const str = String(rawInput ?? '');
    if (!str.trim()) return [];
    const out = [];
    let cur = '';
    let inRegex = false;
    let escaped = false;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (escaped) {
            cur += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            cur += ch;
            escaped = true;
            continue;
        }
        if (!inRegex && ch === '/' && cur.trim() === '') {
            inRegex = true;
            cur += ch;
            continue;
        }
        if (inRegex && ch === '/') {
            cur += ch;
            while (i + 1 < str.length && /[gimsuy]/.test(str[i + 1])) {
                cur += str[++i];
            }
            inRegex = false;
            continue;
        }
        if (!inRegex && ch === ',') {
            const trimmed = cur.trim();
            if (trimmed) out.push(trimmed);
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

export function isSchemaUnsupportedError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (!msg) return false;
    if (/(429|rate limit|quota|502|503|504|timeout|timed out|eof|network|fetch failed|aborted|unauthorized|401|403|unavailable)/i.test(msg)) {
        return false;
    }
    return /(json_schema|response_format|schema|structured|invalid_argument|400|unsupported|unrecognized|not supported)/i.test(msg);
}

export function unwrapAndParseModelJson(raw, expectedKind = 'any') {
    let cur = raw;
    for (let depth = 0; depth < 3; depth++) {
        if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
        const keys = Object.keys(cur);
        const isStEnvelope = ('reasoning' in cur && 'content' in cur && (
            expectedKind === 'book' ||
            expectedKind === 'keys' ||
            expectedKind === 'verbatim_keys' ||
            typeof cur.content === 'object' ||
            (expectedKind === 'page' && cur.keys === undefined) ||
            (expectedKind === 'note' && cur.title === undefined)
        )) || (keys.length > 0 && keys.every(k => k === 'content' || k === 'reasoning') && (
            typeof cur.content === 'object' ||
            (typeof cur.content === 'string' && cur.content.trim().startsWith('{')) ||
            (typeof cur.content === 'string' && cur.content.includes('```'))
        ));
        if (isStEnvelope) {
            cur = cur.content;
            continue;
        }
        if (Array.isArray(cur.choices) && cur.choices[0]?.message?.content !== undefined) {
            cur = cur.choices[0].message.content;
            continue;
        }
        break;
    }

    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        return cur;
    }

    let txt = typeof cur === 'string' ? cur : String(cur?.text || cur?.content || '');
    txt = txt
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    if (!txt) return null;
    try {
        return JSON.parse(txt);
    } catch {}
    const fb = txt.indexOf('{'), lb = txt.lastIndexOf('}');
    if (fb !== -1 && lb > fb) {
        try { return JSON.parse(txt.slice(fb, lb + 1)); } catch {}
    }
    return null;
}

export function matchTriggerKeyInText(haystackLower, rawHaystack, rawKey, wholeWords = true, caseSens = false) {
    const k = String(rawKey || '').trim();
    if (!k) return false;
    const rxMatch = k.match(/^\/(.+)\/([gimsuy]*)$/);
    if (rxMatch) {
        try { return new RegExp(rxMatch[1], rxMatch[2]).test(rawHaystack); } catch { return false; }
    }
    const hay = caseSens ? rawHaystack : haystackLower;
    const needle = caseSens ? k : k.toLowerCase();
    if (wholeWords && /^[\p{L}\p{N}_-]+$/u.test(needle)) {
        const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${esc}(?=$|[^\\p{L}\\p{N}_])`, caseSens ? 'u' : 'iu');
            return re.test(rawHaystack);
        } catch {}
    }
    return hay.includes(needle);
}

export function checkEntrySecondaryKeysInText(lowContent, rawContent, dst, wholeWords = true, caseSens = false) {
    if (dst.selective === false) return true;
    const secKeys = Array.isArray(dst.keysecondary)
        ? dst.keysecondary.map(k => String(k || '').trim()).filter(Boolean)
        : [];
    if (secKeys.length === 0) return true;
    const logic = Number(dst.selectiveLogic) || 0;
    const matches = secKeys.map(sk => matchTriggerKeyInText(lowContent, rawContent, sk, wholeWords, caseSens));
    if (logic === 0) return matches.some(Boolean);
    if (logic === 1) return !matches.every(Boolean);
    if (logic === 2) return !matches.some(Boolean);
    if (logic === 3) return matches.every(Boolean);
    return matches.some(Boolean);
}

export function analyzeBookRecursion(entriesObj, participantNames = [], wiDefaults = {}) {
    const entries = Object.values(entriesObj || {}).filter(e => e && !e.disable);
    const outMap = {};
    const inMap = {};
    const broadWarnings = [];
    const partLower = participantNames.filter(Boolean).map(s => String(s).trim().toLowerCase());
    const defWholeWords = wiDefaults.matchWholeWords !== undefined ? Boolean(wiDefaults.matchWholeWords) : true;
    const defCaseSens = Boolean(wiDefaults.caseSensitive);

    for (const e of entries) {
        outMap[e.uid] = [];
        inMap[e.uid] = [];
        if (!e.constant && Array.isArray(e.key)) {
            for (const rawK of e.key) {
                const k = String(rawK || '').trim();
                if (!k) continue;
                if (k.length <= 2 && !k.startsWith('/')) {
                    broadWarnings.push({
                        uid: e.uid,
                        title: e.comment || ('#' + e.uid),
                        key: k,
                        reason: 'короткий ключ (1–2 символа) может будить статью случайно',
                    });
                } else if (partLower.includes(k.toLowerCase())) {
                    broadWarnings.push({
                        uid: e.uid,
                        title: e.comment || ('#' + e.uid),
                        key: k,
                        reason: 'совпадает с именем участника чата (срабатывает постоянно)',
                    });
                }
            }
        }
    }

    for (const src of entries) {
        if (src.preventRecursion) continue;
        const rawContent = String(src.content || '');
        if (!rawContent.trim()) continue;
        const lowContent = rawContent.toLowerCase();

        for (const dst of entries) {
            if (dst.constant || dst.excludeRecursion) continue;
            const wholeWords = (dst.matchWholeWords !== null && dst.matchWholeWords !== undefined)
                ? Boolean(dst.matchWholeWords)
                : defWholeWords;
            const caseSens = (dst.caseSensitive !== null && dst.caseSensitive !== undefined)
                ? Boolean(dst.caseSensitive)
                : defCaseSens;
            const keys = Array.isArray(dst.key) ? dst.key : [];
            let hitKey = '';
            for (const k of keys) {
                if (matchTriggerKeyInText(lowContent, rawContent, k, wholeWords, caseSens)) { hitKey = String(k).trim(); break; }
            }
            if (hitKey && checkEntrySecondaryKeysInText(lowContent, rawContent, dst, wholeWords, caseSens)) {
                outMap[src.uid].push({ uid: dst.uid, title: dst.comment || ('#' + dst.uid), key: hitKey });
                inMap[dst.uid].push({ uid: src.uid, title: src.comment || ('#' + src.uid), key: hitKey });
            }
        }
    }

    // Detect cycles of arbitrary length (2, 3, 4+) via DFS
    const loops = [];
    const seenCycles = new Set();
    const byUid = new Map(entries.map(e => [String(e.uid), e]));

    const canonicalCycleSig = (cycleIds) => {
        const n = cycleIds.length;
        let best = '';
        for (let i = 0; i < n; i++) {
            const rot = cycleIds.slice(i).concat(cycleIds.slice(0, i)).join('->');
            if (!best || rot < best) best = rot;
        }
        return best;
    };

    for (const startEntry of entries) {
        const startId = String(startEntry.uid);
        const dfs = (currId, pathIds, visitedInPath) => {
            if (loops.length >= 24) return;
            for (const edge of (outMap[byUid.get(currId)?.uid] || [])) {
                const nextId = String(edge.uid);
                if (nextId === startId && pathIds.length >= 1) {
                    const sig = canonicalCycleSig(pathIds);
                    if (!seenCycles.has(sig)) {
                        seenCycles.add(sig);
                        const titles = pathIds.map(id => `«${byUid.get(id)?.comment || ('#' + id)}»`);
                        loops.push({
                            uids: pathIds.map(id => byUid.get(id)?.uid ?? id),
                            label: pathIds.length === 1
                                ? `${titles[0]} -> ${titles[0]}`
                                : (pathIds.length === 2
                                    ? `${titles[0]} <-> ${titles[1]}`
                                    : `${titles.join(' -> ')} -> ${titles[0]}`),
                        });
                    }
                } else if (!visitedInPath.has(nextId) && pathIds.length < 12 && byUid.has(nextId)) {
                    visitedInPath.add(nextId);
                    pathIds.push(nextId);
                    dfs(nextId, pathIds, visitedInPath);
                    pathIds.pop();
                    visitedInPath.delete(nextId);
                }
            }
        };
        dfs(startId, [startId], new Set([startId]));
    }

    const chains = [];
    for (const e of entries) {
        const outs = outMap[e.uid] || [];
        if (outs.length > 0) {
            chains.push({
                uid: e.uid,
                title: e.comment || ('#' + e.uid),
                targets: outs,
            });
        }
    }

    const totalLinks = chains.reduce((acc, c) => acc + c.targets.length, 0);
    const allIsolated = entries.length > 0 && entries.every(e => Boolean(e.preventRecursion));
    return { outMap, inMap, loops, chains, broadWarnings, totalLinks, allIsolated };
}

// ==================== CODEX AUTHOR NOTE PRESETS ====================
export const CODEX_PROMPT_PRESETS = [
    {
        id: 'universal',
        name: 'Универсальный соавтор (Гибкий)',
        nameEn: 'Universal Co-Author (Flexible)',
        placeholder: 'Зафиксировать отношения персонажей, создать биографическую деталь, задать правило игры или сюжетный план...',
        prompt: `Ты — универсальный соавтор. Твоя цель — создать Авторскую Заметку для сюжета и истории, подготовив точный, живой и готовый к работе текст по запросу автора.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. Пользователь может поручить тебе любую задачу: зафиксировать отношения персонажей, прописать деталь биографии, задать правило повествования, описать коллекцию предметов или наметить сюжетный план.
2. Опирайся на контекст, но НЕ переписывай механически уже существующие анкеты — раскрывай и углубляй именно то, о чём просит автор.
3. Структурируй текст чисто: обязательно разделяй смысловые абзацы, сцены и отдельные подпункты пустой строкой (\\n\\n). Никогда не склеивай разные мысли или подзаголовки в один сплошной блок. Без приветствий и формальностей.

Верни результат строго в JSON-формате:
{
  "title": "Короткое название записи (2-5 слов)",
  "content": "Готовый текст заметки с чистыми отступами между абзацами"
}`,
    },
    {
        id: 'fresh_ideas',
        name: 'Генератор свежих деталей (Без копирования)',
        nameEn: 'Fresh Lore & Twists (Anti-Copy)',
        placeholder: 'Придумай неочевидные привычки героя, старый секрет или колоритные детали быта, которых ещё не было в анкете...',
        prompt: `Ты — изобретательный соавтор и мастер живых деталей. Твоя задача — придумать НОВЫЕ, оригинальные и фактурные элементы для истории по запросу автора.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. Категорически запрещено пересказывать или копировать факты, которые уже прямо написаны в описании персонажа или прошлых заметках. Используй канон только как отправную точку, чтобы придумать свежие, органичные подробности.
2. Избегай штампов: давай конкретные образы, привычки, истории из прошлого, мелкие слабости или интригующие зацепки для будущих сцен.
3. Обязательно разделяй каждый смысловой блок и абзац пустой строкой (\\n\\n), чтобы текст легко читался.

Верни результат строго в JSON-формате:
{
  "title": "Короткое название записи (2-5 слов)",
  "content": "Оригинальный текст заметки с отступами между абзацами"
}`,
    },
    {
        id: 'relations_psych',
        name: 'Динамика отношений и психология',
        nameEn: 'Relationship Dynamics & Psychology',
        placeholder: 'Опиши скрытое напряжение, привязанность, границы доверия и манеру общения между персонажами на текущем этапе...',
        prompt: `Ты — тонкий психолог и драматург. Твоя цель — зафиксировать актуальную динамику отношений, чувства, скрытые мотивы и личные границы между персонажами истории.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. Покажи живую химию персонажей: что они говорят вслух и что умалчивают, какие жесты или темы вызывают доверие, ревность, раздражение или мягкость.
2. Формулируй заметку так, чтобы она давала чёткие ориентиры поведения персонажей в следующих сценах, не превращая их в плоские функции.
3. Разделяй оттенки отношений и абзацы пустой строкой (\\n\\n).

Верни результат строго в JSON-формате:
{
  "title": "Название динамики отношений (2-5 слов)",
  "content": "Структурированный текст заметки с разделением на абзацы"
}`,
    },
    {
        id: 'catalog_items',
        name: 'Коллекция предметов, черт и реликвий',
        nameEn: 'Catalog of Relics, Gear & Traits',
        placeholder: 'Создай именной набор оружия, памятных вещей, заклинаний или особых примет героя с историей каждого пункта...',
        prompt: `Ты — мастер колоритного реквизита и миростроения. Твоя цель — оформить выразительный перечень значимых предметов, оружия, реликвий, способностей или примет с характером и историей каждого элемента.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. У каждого элемента должна быть своя изюминка, история появления или бытовая деталь, раскрывающая владельца с новой стороны.
2. Каждый отдельный пункт или подзаголовок в квадратных скобках [НАЗВАНИЕ ПУНКТА] обязательно отделяй от предыдущего блока пустой строкой (\\n\\n). Никогда не лепи подпункты в одну строку.

Верни результат строго в JSON-формате:
{
  "title": "Название коллекции или списка (2-5 слов)",
  "content": "Текст с отдельными блоками, разделёнными пустой строкой"
}`,
    },
    {
        id: 'scene_director',
        name: 'Режиссёр текущей сцены и стиля',
        nameEn: 'Scene Director & Narrative Style',
        placeholder: 'Задай атмосферу сцены, темп, акценты на звуках/запахах, одежду героев и правила ведения повествования...',
        prompt: `Ты — режиссёр интерактивной сцены и литературный редактор. Твоя цель — составить чёткую режиссёрскую установку на текущую сцену или стиль повествования.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. Зафиксируй конкретику момента (обстановка, освещение, внешний вид героев, эмоциональный градус) и/или требования к подаче текста (темп, фокус на деталях, живая речь без клише).
2. Пиши ёмко, ясно и действенно, разделяя блок обстановки и блок правил пустой строкой (\\n\\n).

Верни результат строго в JSON-формате:
{
  "title": "Режиссёрская заметка (2-5 слов)",
  "content": "Готовая установка с чистыми абзацами"
}`,
    },
    {
        id: 'plot_architect',
        name: 'Сюжетный план и интриги',
        nameEn: 'Plot Architect & Intrigues',
        placeholder: 'Наметь ближайшие сюжетные повороты, скрытые ходы антагонистов и тайну, которая постепенно всплывёт...',
        prompt: `Ты — сюжетный архитектор. Твоя цель — выстроить увлекательный, логичный план развития событий, интриг и грядущих сцен по замыслу автора.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. Пропиши этапы развития ситуации, скрытые намерения вовлечённых сторон и естественные крючки, двигающие историю вперёд без искусственных роялей в кустах.
2. Каждый этап или смысловой узел плана отделяй пустой строкой (\\n\\n).

Верни результат строго в JSON-формате:
{
  "title": "Название сюжетной арки (2-5 слов)",
  "content": "План развития событий с разделением на абзацы"
}`,
    },
    {
        id: 'backstory_deep',
        name: 'Биография и шрамы прошлого',
        nameEn: 'Deep Backstory & Past Scars',
        placeholder: 'Раскрой важный эпизод юности героя, старый долг, утрату или событие, сформировавшее его характер...',
        prompt: `Ты — биограф литературных героев. Твоя цель — глубоко и живо прописать эпизод прошлого, происхождение, тайну или переломный опыт персонажа.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. Не пересказывай анкету общими словами — создай конкретную, эмоционально осязаемую историю прошлого и покажи, как она отзывается в привычках персонажа сегодня.
2. Разделяй смысловые абзацы пустой строкой (\\n\\n).

Верни результат строго в JSON-формате:
{
  "title": "Эпизод биографии (2-5 слов)",
  "content": "Текст биографической заметки с отступами"
}`,
    },
    {
        id: 'memory_summary',
        name: 'Сжатая хроника событий (Память)',
        nameEn: 'Concise Story Recap (Memory)',
        placeholder: 'Собери ключевые произошедшие события, обещания, изменения в отношениях и важные факты из последних сообщений...',
        prompt: `Ты — точный летописец истории. Твоя цель — составить ёмкую, фактическую сводку ключевых событий, решений и изменений в истории на основе контекста и указаний автора.

Целевой язык: {{lang}}
Количество слов: {{word_limit}}

Правила работы:
1. Фиксируй только значимые факты: что произошло, о чём договорились герои, какие предметы получены или утрачены, как сдвинулись отношения. Без воды и общих фраз.
2. Группируй сводку по аккуратным абзацам или пунктам через пустую строку (\\n\\n).

Верни результат строго в JSON-формате:
{
  "title": "Хроника событий (2-5 слов)",
  "content": "Чёткая сводка фактов с разделением на блоки"
}`,
    },
];

// ==================== FORGE LOREBOOK & SINGLE PAGE PRESETS ====================
export const FORGE_BOOK_PRESETS = [
    {
        id: 'world_universal',
        name: 'Универсальный кузнец мира (Гибкий)',
        nameEn: 'Universal Lorebook Crafter',
        placeholder: 'Опиши тему, сеттинг или задачу: какие стороны мира, локации, фракции, предметы или правила расписать в книге...',
        bookPrompt: `Ты — универсальный соавтор и архитектор миров. Твоя цель — создать продуманный набор страниц Лорбука для сюжета и истории точно по замыслу автора.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

Правила работы:
1. Гибко следуй запросу автора: создавай самостоятельные, содержательные страницы (места, фракции, законы мира, значимые предметы, второстепенные персонажи, легенды, обычаи).
2. НЕ переписывай и НЕ копируй механически переданные заметки или карточку героя! Опирайся на них как на канон, чтобы придумать НОВЫЕ, свежие статьи, расширяющие мир истории.
3. В поле "content" каждой страницы обязательно разделяй смысловые абзацы пустой строкой (\\n\\n), не склеивай текст в сплошную простыню.
4. Подбери 4–7 точных ключевых слов-триггеров в "keys" (имена, названия, корни терминов без общих бытовых слов). Поле "constant": false для статей по ключам и true только для главного ядра законов мира при необходимости. Поле "position": 1 (после описания чара) или 4 (глубина чата с "depth": 4).

Верни результат строго в JSON-формате:
{
  "entries": [
    {
      "comment": "Название страницы (2-5 слов)",
      "keys": ["ключ1", "ключ2"],
      "content": "Текст страницы с разделением абзацев через пустую строку",
      "constant": false,
      "position": 1,
      "depth": 4
    }
  ]
}`,
        pagePrompt: `Ты — универсальный соавтор и мастер миростроения. Твоя цель — создать ОДНУ готовую, ёмкую страницу Лорбука для сюжета и истории точно по замыслу автора.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Правила работы:
1. Пользователь может поручить любую тему: локацию, нового персонажа, организацию, предмет, историческое событие, закон магии или деталь быта.
2. НЕ дублируй и НЕ пересказывай старые заметки и анкету героя — привноси свежие, живые детали, согласованные с существующим миром.
3. Разделяй смысловые абзацы и подпункты внутри "content" пустой строкой (\\n\\n), не склеивай текст в один монолитный блок.
4. Подбери 4–7 точных ключевых слов-триггеров в "keys", по которым страница будет просыпаться в диалоге. Поле "constant": false для обычных статей, true только для постоянных мировых правил.

Верни результат строго в JSON-формате:
{
  "comment": "Короткое название страницы (2-5 слов)",
  "keys": ["ключ1", "ключ2", "ключ3"],
  "content": "Готовый текст страницы с чистыми абзацами",
  "constant": false
}`,
    },
    {
        id: 'expand_new_lore',
        name: 'Расширение сеттинга (Новые сущности)',
        nameEn: 'World Expansion (Invent New Lore)',
        placeholder: 'Дострой живой мир вокруг героев: придумай новые места, слухи, колоритных NPC, традиции и зацепки для приключений...',
        bookPrompt: `Ты — визионер миростроения. Твоя задача — изучить исходный контекст героев и ПРИДУМАТЬ СОВЕРШЕННО НОВЫЕ статьи Лорбука, которые сделают мир вокруг них живым, объёмным и полным приключений.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

Правила работы:
1. Строгий запрет на копирование анкеты персонажа и старых заметок: не создавай статьи про то, что уже известно. Придумывай новые локации поблизости, влиятельные группировки, местные легенды, колоритных второстепенных лиц и интригующие явления того же сеттинга.
2. Каждая страница должна давать богатую фактуру для будущих сцен и разделяться на чистые абзацы пустой строкой (\\n\\n).
3. Подбирай 4–7 естественных ключевых слов-триггеров в "keys", которые могут всплыть в разговоре героев.

Верни результат строго в JSON-формате:
{
  "entries": [
    {
      "comment": "Название новой сущности",
      "keys": ["ключ1", "ключ2"],
      "content": "Оригинальный текст страницы с абзацами через пустую строку",
      "constant": false,
      "position": 1,
      "depth": 4
    }
  ]
}`,
        pagePrompt: `Ты — визионер миростроения. Придумай НОВУЮ, самобытную страницу Лорбука, которая органично расширит сеттинг истории без пересказа уже известных анкет и заметок.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Наполни статью конкретными образами, историей и зацепками для игры. Разделяй абзацы пустой строкой (\\n\\n) и подбери 4–7 точных ключей-триггеров.

Верни результат строго в JSON-формате:
{
  "comment": "Название страницы",
  "keys": ["ключ1", "ключ2"],
  "content": "Оригинальный текст с отступами между абзацами",
  "constant": false
}`,
    },
    {
        id: 'locations_atlas',
        name: 'Атлас локаций и географии',
        nameEn: 'Atlas of Locations & Atmosphere',
        placeholder: 'Опиши ключевые районы, таверны, поместья, тайные убежища или земли сеттинга с их атмосферой и обитателями...',
        bookPrompt: `Ты — картограф и художник локаций. Создай серию атмосферных страниц Лорбука, посвящённых важным местам, районам, заведениям и маршрутам мира.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

Для каждой локации раскрой внешний облик, звуки/запахи, кто там бывает, какие порядки или опасности там царят. Разделяй абзацы пустой строкой (\\n\\n) и давай 4–7 точных ключей (название места, тип заведения, знаковые ориентиры).

Верни результат строго в JSON-формате:
{
  "entries": [
    { "comment": "Название локации", "keys": ["ключ1", "ключ2"], "content": "Описание локации с абзацами", "constant": false, "position": 1, "depth": 4 }
  ]
}`,
        pagePrompt: `Ты — художник локаций. Создай детальную, атмосферную страницу Лорбука про конкретное место: его устройство, обстановку, завсегдатаев, секреты и зацепки для сцен.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Разделяй абзацы пустой строкой (\\n\\n) и укажи 4–7 ключей-триггеров.
Верни строго JSON: { "comment": "...", "keys": ["..."], "content": "...", "constant": false }`,
    },
    {
        id: 'factions_politics',
        name: 'Фракции, ордена и политика',
        nameEn: 'Factions, Houses & Politics',
        placeholder: 'Пропиши гильдии, благородные дома, корпорации или тайные общества, их цели, вражду и влияние...',
        bookPrompt: `Ты — хронист интриг и фракций. Создай набор страниц Лорбука об организациях, домах, орденах, бандах или политических силах мира.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

В каждой статье раскрой идеологию, ключевых фигур, ресурсы, методы действия и конфликты с другими силами. Разделяй смысловые абзацы пустой строкой (\\n\\n) и подбирай 4–7 точных ключей.

Верни строго JSON: { "entries": [ { "comment": "...", "keys": ["..."], "content": "...", "constant": false, "position": 1, "depth": 4 } ] }`,
        pagePrompt: `Ты — хронист фракций и интриг. Создай глубокую страницу Лорбука об организации, доме или группировке: её цели, верхушка, символика, ресурсы и тайные рычаги влияния.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Разделяй абзацы пустой строкой (\\n\\n) и подбери 4–7 ключей.
Верни строго JSON: { "comment": "...", "keys": ["..."], "content": "...", "constant": false }`,
    },
    {
        id: 'magic_rules',
        name: 'Законы мира, магии и технологий',
        nameEn: 'World Laws, Magic & Tech Systems',
        placeholder: 'Опиши устройство магии, проклятий, технологий, социальных запретов, валюты или мировых законов...',
        bookPrompt: `Ты — системный демиург. Создай чёткие, продуманные страницы Лорбука о законах мироздания, механике магии или технологий, ограничениях, цене силы и устройстве общества.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

Пиши конкретно, чтобы нейросеть в ролевой игре строго соблюдала правила и ограничения сеттинга. Разделяй абзацы пустой строкой (\\n\\n).

Верни строго JSON: { "entries": [ { "comment": "...", "keys": ["..."], "content": "...", "constant": false, "position": 1, "depth": 4 } ] }`,
        pagePrompt: `Ты — системный демиург. Создай чёткую страницу Лорбука о законе мира, школе магии, технологии или социальном правиле, включая возможности, строгие ограничения и последствия нарушений.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Разделяй абзацы пустой строкой (\\n\\n) и подбери 4–7 ключей.
Верни строго JSON: { "comment": "...", "keys": ["..."], "content": "...", "constant": false }`,
    },
    {
        id: 'npc_cast',
        name: 'Галерея второстепенных персонажей (NPC)',
        nameEn: 'Cast of Supporting NPCs',
        placeholder: 'Придумай колоритных второстепенных героев: союзников, соперников, торговцев, слуг или информаторов...',
        bookPrompt: `Ты — мастер характерных персонажей. Создай серию живых досье второстепенных персонажей (NPC), которые наполнят мир яркими встречами.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

Для каждого NPC укажи роль, запоминающуюся черту внешности и речи, личный интерес/секрет и отношение к главным героям. Разделяй абзацы пустой строкой (\\n\\n).

Верни строго JSON: { "entries": [ { "comment": "...", "keys": ["..."], "content": "...", "constant": false, "position": 1, "depth": 4 } ] }`,
        pagePrompt: `Ты — мастер характерных персонажей. Создай живую страницу Лорбука для второстепенного персонажа (NPC): облик, характер, манера речи, личная выгода/тайна и связь с героями.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Разделяй абзацы пустой строкой (\\n\\n) и подбери 4–7 ключей (имя, прозвище, род занятий).
Верни строго JSON: { "comment": "...", "keys": ["..."], "content": "...", "constant": false }`,
    },
    {
        id: 'relics_bestiary',
        name: 'Арсенал реликвий, предметов и существ',
        nameEn: 'Relics, Artifacts & Bestiary',
        placeholder: 'Опиши легендарные клинки, диковинные артефакты, редкие зелья или опасных тварей этого мира...',
        bookPrompt: `Ты — хранитель кунсткамеры и бестиария. Создай страницы Лорбука о значимых артефактах, реликвиях, оружии, редких веществах или существах мира.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

Раскрывай происхождение, свойства, слабости или цену использования каждого объекта. Разделяй абзацы пустой строкой (\\n\\n) и подбирай точные ключи.

Верни строго JSON: { "entries": [ { "comment": "...", "keys": ["..."], "content": "...", "constant": false, "position": 1, "depth": 4 } ] }`,
        pagePrompt: `Ты — хранитель реликвий и бестиария. Создай выразительную страницу Лорбука о предмете, оружии, артефакте или существе: его облик, история, свойства и особенности.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Разделяй абзацы пустой строкой (\\n\\n) и подбери 4–7 ключей.
Верни строго JSON: { "comment": "...", "keys": ["..."], "content": "...", "constant": false }`,
    },
    {
        id: 'strict_archivist',
        name: 'Точный архивариус (Структуризация канона)',
        nameEn: 'Strict Canon Archivist',
        placeholder: 'Аккуратно разложи переданные материалы и факты по отдельным тематическим страницам без выдумывания отсебятины...',
        bookPrompt: `Ты — педантичный архивариус канона. Аккуратно разбей и систематизируй переданные автором материалы в чистые тематические страницы Лорбука, не выдумывая противоречащих фактов.

Целевой язык: {{lang}}
Желаемое число страниц: {{entry_count}}
Объём каждой страницы: {{word_limit}}

Оформляй каждую страницу связно, разделяй абзацы пустой строкой (\\n\\n) и подбирай 4–7 точных ключевых слов-триггеров.

Верни строго JSON: { "entries": [ { "comment": "...", "keys": ["..."], "content": "...", "constant": false, "position": 1, "depth": 4 } ] }`,
        pagePrompt: `Ты — педантичный архивариус канона. Оформи переданные автором сведения в чистую, хорошо структурированную страницу Лорбука без лишней отсебятины, с отступами между абзацами (\\n\\n) и точными ключами.

Целевой язык: {{lang}}
Объём текста страницы: {{word_limit}}

Верни строго JSON: { "comment": "...", "keys": ["..."], "content": "...", "constant": false }`,
    },
];

export function buildEntryCountPhrase(cnt, uiLang = 'ru') {
    const n = Math.max(0, Number(cnt) || 0);
    if (uiLang === 'en') return n > 0 ? `around ${n} distinct entries` : 'optimal number of entries based on scope (typically 4–8)';
    return n > 0 ? `ровно ${n} отдельных страниц` : 'оптимально по охвату темы (обычно 4–8 страниц)';
}

// Lightweight RU / EN dictionary for top-level UI & dynamic labels
export const UI_DICT = {
    en: {
        guideBtn: 'Guide',
        wingCodex: "Author's Codex",
        wingForge: 'Lorebook Forge',
        thisChat: 'This Chat',
        noChat: 'No Chat Open',
        globalScope: 'Global',
        addSection: 'Section',
        inPromptCount: 'Active notes in prompt:',
        newNote: 'New Note',
        collapseAll: 'Collapse All',
        expandAll: 'Expand All',
        uiLangLabel: 'Язык интерфейса / UI Language',
    },
    ru: {
        guideBtn: 'Гайд',
        wingCodex: 'Кодекс Автора',
        wingForge: 'Кузница Лорбуков',
        thisChat: 'Этот чат',
        noChat: 'Чат не открыт',
        globalScope: 'Общие',
        addSection: 'Раздел',
        inPromptCount: 'В промпте записей:',
        newNote: 'Новая запись',
        collapseAll: 'Свернуть все',
        expandAll: 'Развернуть все',
        uiLangLabel: 'Язык интерфейса / UI Language',
    },
};

export function tUi(uiLang, ruText, enText) {
    return uiLang === 'en' ? enText : ruText;
}

const DEFAULT_CAT_TRANSLATIONS = {
    classic_an: { ru: 'Классическая заметка Автора', en: "Author's Note" },
    relations: { ru: 'Отношения и Биография', en: 'Relationships & Bio' },
    plot: { ru: 'Сюжетный план', en: 'Plot Plan' },
    personal: { ru: 'Личные памятки', en: 'Private Memos' },
};

export function displayCategoryName(cat, uiLang = 'ru') {
    if (!cat) return '';
    const pair = DEFAULT_CAT_TRANSLATIONS[cat.id];
    if (pair && (cat.name === pair.ru || cat.name === pair.en)) {
        return uiLang === 'en' ? pair.en : pair.ru;
    }
    return cat.name || '';
}
