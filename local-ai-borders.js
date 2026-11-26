/**
 * ============================================================================
 * JEE NATIVE LOCAL AI — BORDER & CROSS-PAGE STITCH VERIFIER ONLY
 * File Name for GitHub: local-ai-borders.js
 * Version: 3.1.0 (Boot-Retry Discovery + Multi-Port + Safe JSON Fallback)
 * ============================================================================
 * Dedicated client for a native 64-bit ARM64 vision server running locally on
 * the tablet via Termux:
 *   - Prefers native llama-server (:8080 or Termux default :9931)
 *   - Falls back to Ollama (:11434)
 *
 * STRICT SCOPE:
 *   - DOES: Verify, split, merge, and refine question bounding boxes on each
 *           page using numbered colored candidate boxes + 0..1000 Y-axis ruler.
 *   - DOES: Visually verify ambiguous cross-page / cross-column stitches.
 *   - DOES NOT: Classify chapters (local-vision-engine.js handles chapters).
 *   - DOES NOT: Generate answer keys or hints (Gemini handles those).
 * ============================================================================
 */
(function (globalScope) {
    'use strict';

    const ENGINE_VERSION = '3.1.0';
    const SERVER_URL_STORAGE_KEY = 'jee_local_ai_borders_url_v3';

    // Prefer native llama-server (:8080, :9931) first, then Ollama (:11434)
    const AUTO_ENDPOINTS = [
        { url: 'http://127.0.0.1:8080', kind: 'llama_cpp' },
        { url: 'http://localhost:8080', kind: 'llama_cpp' },
        { url: 'http://127.0.0.1:9931', kind: 'llama_cpp' },
        { url: 'http://127.0.0.1:11434', kind: 'ollama' },
        { url: 'http://localhost:11434', kind: 'ollama' }
    ];

    const OLLAMA_VISION_PREFERENCE = [
        'qwen2.5vl:3b',
        'qwen2.5-vl:3b',
        'qwen3-vl:4b-instruct',
        'qwen3-vl:2b-instruct',
        'qwen3-vl:4b',
        'qwen3-vl:2b',
        'gemma3:4b',
        'llava',
        'minicpm-v'
    ];

    const runtime = {
        customServerUrl: (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || '',
        detectedUrl: null,
        backendKind: null, // 'llama_cpp' | 'ollama'
        loadedModelName: null,
        serverReady: false,
        llamaJsonMode: 'json_object', // auto-degrades to 'none' on HTTP 400
        fatalBatchError: null,
        lastError: ''
    };

    // Unregister obsolete WASM service worker if still present
    (function cleanupObsoleteCoiServiceWorker() {
        try {
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                    for (const reg of regs) {
                        const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
                        if (url.includes('coi-serviceworker.js')) reg.unregister().catch(() => {});
                    }
                }).catch(() => {});
            }
        } catch (_) {}
    })();

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function getServerUrl() {
        const custom = (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || runtime.customServerUrl || '';
        return String(custom || runtime.detectedUrl || AUTO_ENDPOINTS[0].url).trim().replace(/\/+$/, '');
    }

    function setServerUrl(url) {
        const clean = String(url || '').trim().replace(/\/+$/, '');
        runtime.customServerUrl = clean;
        runtime.detectedUrl = null;
        runtime.backendKind = null;
        runtime.loadedModelName = null;
        runtime.serverReady = false;
        runtime.fatalBatchError = null;
        runtime.lastError = '';
        try {
            if (clean) localStorage.setItem(SERVER_URL_STORAGE_KEY, clean);
            else localStorage.removeItem(SERVER_URL_STORAGE_KEY);
        } catch (_) {}
        return clean || AUTO_ENDPOINTS[0].url;
    }

    // ========================================================================
    // CHROME LOCAL NETWORK ACCESS SAFE LOOPBACK FETCH
    // ========================================================================
    async function loopbackFetch(url, options = {}, timeoutMs = 15000) {
        const externalSignal = options.signal || null;
        const controller = new AbortController();
        let timedOut = false;

        const onExtAbort = () => controller.abort();
        if (externalSignal) {
            if (externalSignal.aborted) throw new DOMException('Aborted', 'AbortError');
            externalSignal.addEventListener('abort', onExtAbort, { once: true });
        }

        const timer = timeoutMs > 0 ? setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs) : null;

        const cleanOpts = { ...options, signal: controller.signal, mode: 'cors' };
        const isLoopback = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\b/i.test(url);

        try {
            if (isLoopback) {
                try {
                    return await fetch(url, { ...cleanOpts, targetAddressSpace: 'loopback' });
                } catch (err) {
                    if (err instanceof TypeError && /targetAddressSpace/i.test(err.message || '')) {
                        return await fetch(url, cleanOpts);
                    }
                    throw err;
                }
            }
            return await fetch(url, cleanOpts);
        } catch (err) {
            if (timedOut) throw new Error(`Local AI server timed out after ${Math.round(timeoutMs / 1000)}s.`);
            throw err;
        } finally {
            if (timer) clearTimeout(timer);
            if (externalSignal) externalSignal.removeEventListener('abort', onExtAbort);
        }
    }

    // ========================================================================
    // SERVER AUTO-DISCOVERY WITH BOOT-RETRY GRACE PERIOD
    // ========================================================================
    async function probeLlamaOnce(baseUrl, options = {}) {
        const abortSignal = options.abortSignal || null;
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        const maxWaitLoadingMs = Number(options.maxWaitLoadingMs ?? 45000);
        const start = performance.now();

        while (true) {
            if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
            let res;
            try {
                res = await loopbackFetch(`${baseUrl}/health`, { method: 'GET', signal: abortSignal }, 2200);
            } catch (err) {
                if (err.name === 'AbortError') throw err;
                return null;
            }

            if (res.status === 503) {
                const elapsed = performance.now() - start;
                if (elapsed > maxWaitLoadingMs) {
                    throw new Error(`llama-server at ${baseUrl} is still loading after ${Math.round(maxWaitLoadingMs / 1000)}s.`);
                }
                if (onProgress) {
                    onProgress({
                        stage: 'LOAD',
                        percent: Math.min(90, 20 + Math.round((elapsed / maxWaitLoadingMs) * 70)),
                        message: `Waiting for Termux llama-server to finish loading model (${Math.round(elapsed / 1000)}s)...`
                    });
                }
                await new Promise(r => setTimeout(r, 1100));
                continue;
            }

            if (res.status === 404) {
                // Some servers expose /v1/models instead of /health
                try {
                    const mRes = await loopbackFetch(`${baseUrl}/v1/models`, { method: 'GET', signal: abortSignal }, 2200);
                    if (mRes.ok) {
                        const mData = await mRes.json().catch(() => ({}));
                        return { ok: true, kind: 'llama_cpp', url: baseUrl, modelName: mData?.data?.[0]?.id || 'llama-server' };
                    }
                } catch (_) {}
                return null;
            }

            if (!res.ok) return null;

            let modelName = 'llama-server';
            let visionSupported = true;
            try {
                const propsRes = await loopbackFetch(`${baseUrl}/props`, { method: 'GET', signal: abortSignal }, 2200);
                if (propsRes.ok) {
                    const props = await propsRes.json().catch(() => ({}));
                    if (props.model_alias) modelName = props.model_alias;
                    else if (props.default_generation_settings?.model) modelName = props.default_generation_settings.model;
                    if (props.modalities && props.modalities.vision === false) visionSupported = false;
                }
            } catch (_) {}

            if (!visionSupported) {
                throw new Error(`llama-server at ${baseUrl} loaded "${modelName}" WITHOUT a vision projector (mmproj).`);
            }
            return { ok: true, kind: 'llama_cpp', url: baseUrl, modelName };
        }
    }

    async function probeOllamaOnce(baseUrl, abortSignal) {
        let res;
        try {
            res = await loopbackFetch(`${baseUrl}/api/tags`, { method: 'GET', signal: abortSignal }, 2000);
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            return null;
        }
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        if (!data || !Array.isArray(data.models) || data.models.length === 0) return null;

        const names = data.models.map(m => m.name || m.model).filter(Boolean);
        let chosen = names[0];
        for (const pref of OLLAMA_VISION_PREFERENCE) {
            const hit = names.find(n => n.toLowerCase().includes(pref));
            if (hit) { chosen = hit; break; }
        }
        return { ok: true, kind: 'ollama', url: baseUrl, modelName: chosen };
    }

    async function connect(options = {}) {
        const abortSignal = options.abortSignal || null;
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        const waitForBootMs = Number(options.waitForBootMs ?? 0);
        runtime.fatalBatchError = null;
        runtime.lastError = '';

        if (onProgress) {
            onProgress({ stage: 'INIT', percent: 12, message: 'Probing Local Native AI Server (Termux :8080 / :9931 / :11434)...' });
        }

        const customUrl = (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || runtime.customServerUrl || '';
        const targets = customUrl ? [{ url: customUrl.replace(/\/+$/, ''), kind: 'auto' }] : AUTO_ENDPOINTS;

        const startedAt = performance.now();
        let attempt = 0;

        while (true) {
            attempt++;
            let specificErr = null;

            for (const t of targets) {
                if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
                if (t.kind === 'llama_cpp' || t.kind === 'auto') {
                    try {
                        const hit = await probeLlamaOnce(t.url, options);
                        if (hit && hit.ok) {
                            runtime.detectedUrl = hit.url;
                            runtime.backendKind = 'llama_cpp';
                            runtime.loadedModelName = hit.modelName;
                            runtime.serverReady = true;
                            runtime.lastError = '';
                            if (onProgress) onProgress({ stage: 'READY', percent: 100, message: `Connected to llama-server (${hit.modelName}) at ${hit.url} ✓` });
                            return hit;
                        }
                    } catch (err) {
                        if (err.name === 'AbortError') throw err;
                        if (/without a vision projector|still loading/i.test(err.message || '')) specificErr = err;
                    }
                }
                if (t.kind === 'ollama' || t.kind === 'auto') {
                    try {
                        const hit = await probeOllamaOnce(t.url, abortSignal);
                        if (hit && hit.ok) {
                            runtime.detectedUrl = hit.url;
                            runtime.backendKind = 'ollama';
                            runtime.loadedModelName = hit.modelName;
                            runtime.serverReady = true;
                            runtime.lastError = '';
                            if (onProgress) onProgress({ stage: 'READY', percent: 100, message: `Connected to Ollama (${hit.modelName}) at ${hit.url} ✓` });
                            return hit;
                        }
                    } catch (err) {
                        if (err.name === 'AbortError') throw err;
                    }
                }
            }

            if (specificErr) {
                runtime.serverReady = false;
                runtime.fatalBatchError = specificErr.message;
                runtime.lastError = specificErr.message;
                throw specificErr;
            }

            // If server was just launched by JEE-Vault.sh, retry cleanly during boot grace period!
            const elapsed = performance.now() - startedAt;
            if (waitForBootMs > 0 && elapsed < waitForBootMs) {
                if (onProgress) {
                    onProgress({
                        stage: 'WAIT',
                        percent: Math.min(40, 14 + attempt * 6),
                        message: `Waiting for Termux AI server to bind port (${Math.round(elapsed / 1000)}s)...`
                    });
                }
                await new Promise(r => setTimeout(r, 1200));
                continue;
            }

            const targetHint = customUrl || '127.0.0.1:8080 / :9931 / :11434';
            const errMsg = `No local AI server responding on ${targetHint}. Start llama-server in Termux (or tap Allow on Chrome's Local Network prompt).`;
            runtime.serverReady = false;
            runtime.fatalBatchError = errMsg;
            runtime.lastError = errMsg;
            throw new Error(errMsg);
        }
    }

    async function testConnection() {
        try {
            const hit = await connect({ waitForBootMs: 0, maxWaitLoadingMs: 3000 });
            return { ok: true, ...hit };
        } catch (err) {
            return { ok: false, error: err?.message || String(err) };
        }
    }

    // ========================================================================
    // VISUAL OVERLAY RENDERER: DRAWS CANDIDATE BOXES + 0..1000 Y-RULER STRIP
    // ========================================================================
    function renderAnnotatedPagePreview(sourceCanvas, candidates, maxEdge = 616) {
        const sw = sourceCanvas.width || 1;
        const sh = sourceCanvas.height || 1;
        const longest = Math.max(sw, sh);
        const scale = longest > maxEdge ? (maxEdge / longest) : 1.0;

        const rulerW = 34;
        const drawW = Math.max(120, Math.round(sw * scale));
        const drawH = Math.max(120, Math.round(sh * scale));

        const out = document.createElement('canvas');
        out.width = rulerW + drawW;
        out.height = drawH;
        const ctx = out.getContext('2d');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(0, 0, rulerW, drawH);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, rulerW, 0, drawW, drawH);

        ctx.strokeStyle = '#64748B';
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let yNorm = 0; yNorm <= 1000; yNorm += 50) {
            const py = Math.round((yNorm / 1000) * drawH);
            ctx.beginPath();
            ctx.moveTo(rulerW - 6, py);
            ctx.lineTo(rulerW, py);
            ctx.stroke();
            if (yNorm % 100 === 0 && yNorm > 0 && yNorm < 1000) {
                ctx.fillText(String(yNorm), rulerW - 8, py);
            }
        }

        const palette = ['#2563EB', '#D97706', '#059669', '#DC2626', '#7C3AED', '#0891B2'];
        (candidates || []).forEach((b, idx) => {
            const col = palette[idx % palette.length];
            const x0 = rulerW + Math.round(((b.xmin ?? 10) / 1000) * drawW);
            const x1 = rulerW + Math.round(((b.xmax ?? 990) / 1000) * drawW);
            const y0 = Math.round(((b.ymin ?? 0) / 1000) * drawH);
            const y1 = Math.round(((b.ymax ?? 1000) / 1000) * drawH);

            ctx.strokeStyle = col;
            ctx.lineWidth = 2;
            ctx.strokeRect(x0, y0, Math.max(10, x1 - x0), Math.max(10, y1 - y0));

            const tag = `#${idx + 1} Q.${b.questionNumber || (idx + 1)}${b.isContinuationFromPrevPage ? ' [CONT]' : ''}`;
            ctx.font = 'bold 10px sans-serif';
            const tw = ctx.measureText(tag).width + 8;
            ctx.fillStyle = col;
            ctx.fillRect(x0, Math.max(0, y0), tw, 14);
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(tag, x0 + 4, Math.max(0, y0) + 2);
        });

        return out.toDataURL('image/jpeg', 0.88);
    }

    async function renderStitchPairPreview(prevDataUrl, currDataUrl, maxWidth = 448) {
        const loadImg = (src) => new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = src;
        });
        const [pImg, cImg] = await Promise.all([loadImg(prevDataUrl), loadImg(currDataUrl)]);

        const pCropY = Math.floor(pImg.height * 0.52);
        const pCropH = Math.max(40, pImg.height - pCropY);
        const cCropH = Math.max(40, Math.min(cImg.height, Math.ceil(cImg.height * 0.65)));

        const pScale = Math.min(1, maxWidth / Math.max(1, pImg.width));
        const cScale = Math.min(1, maxWidth / Math.max(1, cImg.width));
        const pDrawW = Math.round(pImg.width * pScale);
        const pDrawH = Math.min(220, Math.round(pCropH * pScale));
        const cDrawW = Math.round(cImg.width * cScale);
        const cDrawH = Math.min(220, Math.round(cCropH * cScale));

        const headerH = 20;
        const outW = Math.max(pDrawW, cDrawW) + 16;
        const outH = headerH + pDrawH + headerH + cDrawH + 16;

        const out = document.createElement('canvas');
        out.width = outW;
        out.height = outH;
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outW, outH);

        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 0, outW, headerH);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('PART A — BOTTOM OF PREVIOUS QUESTION', 8, 14);
        ctx.drawImage(pImg, 0, pCropY, pImg.width, pCropH, 8, headerH + 4, pDrawW, pDrawH);

        const midY = headerH + pDrawH + 8;
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(0, midY, outW, headerH);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('PART B — TOP OF NEXT PAGE / COLUMN', 8, midY + 14);
        ctx.drawImage(cImg, 0, 0, cImg.width, cCropH, 8, midY + headerH + 4, cDrawW, cDrawH);

        return out.toDataURL('image/jpeg', 0.88);
    }

    // ========================================================================
    // NATIVE SERVER VISION CALL WITH GRACEFUL JSON_OBJECT FALLBACK
    // ========================================================================
    async function callVisionServer(imageDataUrl, systemPrompt, userPrompt, options = {}) {
        const base = runtime.detectedUrl || getServerUrl();
        const maxTokens = Number(options.maxTokens) || 480;
        const timeoutMs = Number(options.timeoutMs) || 180000;
        const abortSignal = options.abortSignal || null;

        if (runtime.backendKind === 'ollama') {
            const rawB64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;
            const res = await loopbackFetch(
                `${base}/api/chat`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: runtime.loadedModelName || 'qwen2.5vl:3b',
                        stream: false,
                        keep_alive: '5m',
                        format: 'json',
                        options: {
                            temperature: 0.0,
                            num_ctx: 2048,
                            num_thread: 4,
                            num_predict: maxTokens
                        },
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt, images: [rawB64] }
                        ]
                    }),
                    signal: abortSignal
                },
                timeoutMs
            );
            if (!res.ok) {
                const txt = (await res.text().catch(() => '')).slice(0, 240);
                throw new Error(`Ollama HTTP ${res.status}: ${txt}`);
            }
            const data = await res.json();
            return String(data?.message?.content || '');
        }

        // Default: native llama-server (/v1/chat/completions) with graceful response_format fallback
        const endpoint = `${base}/v1/chat/completions`;
        const modes = runtime.llamaJsonMode === 'json_object' ? ['json_object', 'none'] : ['none'];
        let lastErr = null;

        for (const mode of modes) {
            const body = {
                model: runtime.loadedModelName || 'llama-server',
                temperature: 0.0,
                max_tokens: maxTokens,
                cache_prompt: true,
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'image_url', image_url: { url: imageDataUrl } },
                            { type: 'text', text: userPrompt }
                        ]
                    }
                ]
            };
            if (mode === 'json_object') {
                body.response_format = { type: 'json_object' };
            }

            const res = await loopbackFetch(
                endpoint,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: abortSignal
                },
                timeoutMs
            );

            if (res.ok) {
                runtime.llamaJsonMode = mode;
                const data = await res.json();
                return String(data?.choices?.[0]?.message?.content || '');
            }

            const txt = (await res.text().catch(() => '')).slice(0, 240);
            if (/image input is not supported|mmproj|multimodal.*not.*enabled/i.test(txt)) {
                const mmErr = 'llama-server is running a text-only model without mmproj vision support.';
                runtime.fatalBatchError = mmErr;
                throw new Error(mmErr);
            }
            if (res.status === 400 && mode === 'json_object') {
                lastErr = new Error(`llama-server HTTP 400: ${txt}`);
                continue;
            }
            throw new Error(`llama-server HTTP ${res.status}: ${txt || res.statusText}`);
        }
        throw lastErr || new Error('llama-server vision call failed');
    }

    function extractJson(rawText) {
        let cleaned = String(rawText || '').trim();
        cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const a = cleaned.indexOf('{');
        const b = cleaned.lastIndexOf('}');
        if (a >= 0 && b > a) {
            const slice = cleaned.slice(a, b + 1);
            try { return JSON.parse(slice); } catch (_) {
                try { return JSON.parse(slice.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')); } catch (_) {}
            }
        }
        return null;
    }

    // ========================================================================
    // PUBLIC 1: VERIFY & CORRECT PAGE BORDERS + STITCH FLAGS ONLY
    // ========================================================================
    async function verifyPageBorders(pageCanvas, pageNum, localCandidates, options = {}) {
        const startedAt = performance.now();
        if (!Array.isArray(localCandidates) || localCandidates.length === 0) {
            return { blocks: localCandidates || [], changed: false, verified: false, elapsedMs: 0, note: 'No local blocks' };
        }
        if (runtime.fatalBatchError && !options.retryAfterFatal) {
            throw new Error(runtime.fatalBatchError);
        }
        if (!runtime.serverReady) {
            await connect({ onProgress: options.onProgress, abortSignal: options.abortSignal });
        }

        const annotatedUrl = renderAnnotatedPagePreview(pageCanvas, localCandidates, options.maxEdge || 616);
        const compactList = localCandidates.map((b, i) => ({
            id: i + 1,
            q: String(b.questionNumber || (i + 1)),
            xmin: Math.round(b.xmin ?? 10),
            ymin: Math.round(b.ymin ?? 0),
            xmax: Math.round(b.xmax ?? 990),
            ymax: Math.round(b.ymax ?? 1000),
            stitchPrev: Boolean(b.isContinuationFromPrevPage || b.stitchWithPrev || b.isContinuationFromPrev)
        }));

        const systemPrompt = `You are a JEE Exam Page Border & Stitching Inspector.
You see a PDF page with numbered colored boxes (#1, #2, ...) already detected locally, plus a 0..1000 Y-axis ruler on the left margin.
Your ONLY job is to verify borders and page-break stitching. Do NOT classify subjects or chapters!

Check ONLY for these 4 concrete defects:
1. MERGED: Two distinct questions inside one box -> SPLIT into 2 boxes using the left Y-ruler.
2. CLIPPED: A box cuts off a diagram, table row, organic ring, fraction, or option (A)-(D) -> EXPAND ymin/ymax using the left Y-ruler.
3. FALSE BOX: A box contains ONLY a header, footer, or PART/SECTION banner -> DROP it.
4. STITCH: Top-of-page unanchored continuation (orphaned options (B)-(D), continued table/diagram, or sentence fragment) -> set "stitchPrev": true; if the last box cuts off at page bottom -> set "continuesNext": true.

If ALL local boxes look clean and complete, reply ONLY JSON: {"ok":true,"checked":<box_count>}
Otherwise reply ONLY compact JSON:
{"ok":false,"note":"brief 4-8 word fix summary","boxes":[{"q":"1","xmin":10,"ymin":210,"xmax":990,"ymax":390,"stitchPrev":false,"continuesNext":false}]}`;

        const userPrompt = `Page ${pageNum} local boxes (${compactList.length}):\n${JSON.stringify(compactList)}\nInspect every colored box against the page image & left Y-ruler. Output ONLY JSON.`;

        const raw = await callVisionServer(annotatedUrl, systemPrompt, userPrompt, {
            maxTokens: 512,
            timeoutMs: Number(options.timeoutMs) || 180000,
            abortSignal: options.abortSignal
        });

        const parsed = extractJson(raw);
        const elapsedMs = Math.round(performance.now() - startedAt);

        if (!parsed) {
            return {
                blocks: localCandidates,
                changed: false,
                verified: false,
                elapsedMs,
                backend: runtime.backendKind,
                modelName: runtime.loadedModelName,
                note: `AI returned unparsed text (${raw.slice(0, 45)}) — kept local v3.0 borders`
            };
        }

        if (parsed.ok === true || !Array.isArray(parsed.boxes) || parsed.boxes.length === 0) {
            const verifiedBlocks = localCandidates.map(b => ({
                ...b,
                aiBorderVerified: true,
                aiBorderNote: `Verified clean by ${runtime.loadedModelName || runtime.backendKind}`
            }));
            return {
                blocks: verifiedBlocks,
                changed: false,
                verified: true,
                elapsedMs,
                backend: runtime.backendKind,
                modelName: runtime.loadedModelName,
                note: `Verified clean (${verifiedBlocks.length} boxes)`
            };
        }

        // Validate & sanitize AI-adjusted boxes while keeping local chapter/text metadata untouched
        const sanitized = [];
        for (const nb of parsed.boxes) {
            const xmin = clamp(Math.round(Number(nb.xmin ?? 10)), 0, 940);
            const xmax = clamp(Math.round(Number(nb.xmax ?? 990)), xmin + 80, 1000);
            const ymin = clamp(Math.round(Number(nb.ymin ?? 0)), 0, 985);
            const ymax = clamp(Math.round(Number(nb.ymax ?? 1000)), ymin + 18, 1000);
            if (ymax - ymin < 18 || xmax - xmin < 80) continue;

            let bestLocal = null;
            let bestOverlap = 0;
            for (const lc of localCandidates) {
                const oy = Math.max(0, Math.min(ymax, lc.ymax) - Math.max(ymin, lc.ymin));
                const ox = Math.max(0, Math.min(xmax, lc.xmax) - Math.max(xmin, lc.xmin));
                const inter = ox * oy;
                if (inter > bestOverlap) {
                    bestOverlap = inter;
                    bestLocal = lc;
                }
            }

            const stitchPrev = Boolean(nb.stitchPrev);
            const continuesNext = Boolean(nb.continuesNext);
            sanitized.push({
                ...(bestLocal || {}),
                xmin,
                xmax,
                ymin,
                ymax,
                questionNumber: String(nb.q || bestLocal?.questionNumber || (sanitized.length + 1)),
                isContinuationFromPrevPage: stitchPrev,
                isContinuationFromPrev: stitchPrev,
                stitchWithPrev: stitchPrev,
                continuesToNextPage: continuesNext,
                continuesToNext: continuesNext,
                aiBorderVerified: true,
                aiBorderNote: String(parsed.note || 'Refined by Local AI')
            });
        }

        if (sanitized.length === 0 || (localCandidates.length >= 3 && sanitized.length < Math.floor(localCandidates.length * 0.4))) {
            return {
                blocks: localCandidates,
                changed: false,
                verified: false,
                elapsedMs,
                backend: runtime.backendKind,
                modelName: runtime.loadedModelName,
                note: 'Kept local v3.0 borders (AI box count failed sanity check)'
            };
        }

        return {
            blocks: sanitized,
            changed: true,
            verified: true,
            elapsedMs,
            backend: runtime.backendKind,
            modelName: runtime.loadedModelName,
            note: String(parsed.note || `Refined ${sanitized.length} borders`)
        };
    }

    // ========================================================================
    // PUBLIC 2: VERIFY A CROSS-PAGE / CROSS-COLUMN STITCH PAIR VISUALLY
    // ========================================================================
    async function verifyCrossPageStitch(prevDataUrl, currDataUrl, options = {}) {
        const startedAt = performance.now();
        if (!prevDataUrl || !currDataUrl) return { shouldStitch: false, confidence: 0, reason: 'Missing image' };
        if (!runtime.serverReady) {
            await connect({ abortSignal: options.abortSignal });
        }

        const pairImg = await renderStitchPairPreview(prevDataUrl, currDataUrl, 448);
        const systemPrompt = `You inspect a stacked image showing PART A (bottom of previous JEE question) above a red bar and PART B (top of next page/column).
Decide ONLY whether PART B is a continuation of PART A (remaining options (B)/(C)/(D), continued sentence, table, or diagram for PART A) OR starts a brand-new separate question.
Reply ONLY JSON: {"shouldStitch":true|false,"confidence":0.95,"reason":"short 4-10 word reason"}`;

        const userPrompt = `Is PART B a continuation of PART A (Q.${options.prevQNum || 'prev'})? Output ONLY JSON.`;

        const raw = await callVisionServer(pairImg, systemPrompt, userPrompt, {
            maxTokens: 80,
            timeoutMs: Number(options.timeoutMs) || 90000,
            abortSignal: options.abortSignal
        });

        const parsed = extractJson(raw);
        const elapsedMs = Math.round(performance.now() - startedAt);
        if (!parsed || typeof parsed.shouldStitch !== 'boolean') {
            return { shouldStitch: null, confidence: 0, reason: 'Unparsed AI stitch verdict', elapsedMs };
        }
        return {
            shouldStitch: parsed.shouldStitch,
            confidence: typeof parsed.confidence === 'number' ? clamp(parsed.confidence > 1 ? parsed.confidence / 100 : parsed.confidence, 0.1, 0.99) : 0.8,
            reason: String(parsed.reason || '').trim(),
            elapsedMs
        };
    }

    const PublicAPI = {
        version: ENGINE_VERSION,
        getServerUrl,
        setServerUrl,
        connect,
        testConnection,
        isReady: () => Boolean(runtime.serverReady),
        getServerInfo: () => ({
            url: runtime.detectedUrl || getServerUrl(),
            backend: runtime.backendKind || 'disconnected',
            modelName: runtime.loadedModelName || null,
            lastError: runtime.lastError || ''
        }),
        verifyPageBorders,
        verifyCrossPageStitch
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PublicAPI;
    }
    globalScope.JEELocalAIBorders = PublicAPI;

})(typeof window !== 'undefined' ? window : globalThis);
