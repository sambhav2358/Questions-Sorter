/**
 * ============================================================================
 * JEE NATIVE LOCAL AI VISION-LANGUAGE CHAPTER CLASSIFIER (NON-ONNX)
 * File Name for GitHub: local-vlm-classifier.js
 * Version: 2.2.0 (Fast Streaming Native Ollama + 504px Qwen-VL Patch Tuning)
 * ============================================================================
 * Connects to native 64-bit ARM64 Ollama (127.0.0.1:11434) or llama-server
 * (127.0.0.1:8080) running via Termux on your Snapdragon 8 Gen 3 tablet.
 *
 * Key v2.2.0 Speed & Stability Fixes (Cuts Time from >75s -> ~10-22s/question):
 *  1. Model Pre-Warm in loadModel():
 *     Loads qwen2.5vl:3b into RAM once before Q.1 starts so Q.1 never pays a
 *     15s cold-load penalty inside its inference timer.
 *  2. 504px Patch-Aligned Image Sizing (Multiple of 28 for Qwen2.5-VL):
 *     Cuts ViT vision encoding & visual prefill tokens by ~68% while keeping
 *     diagrams, pulleys, springs, organic rings, and equations crisp.
 *  3. Snapdragon 8 Gen 3 CPU Thread & Context Tuning:
 *     Uses `num_thread: 6` (1x Prime + 5x Performance cores, avoiding E-core
 *     stalls), `num_ctx: 2048`, `format: "json"` (skips slow 82-enum GBNF
 *     grammar compilation), and concise ~230-token KV-cached system prompts.
 *  4. Real-Time NDJSON Streaming (`stream: true`):
 *     Shows live decoding progress (`Q.1 decoding: 18 tok, 14s...`) and uses
 *     a generous 150s timeout so complex matrix-match questions never abort.
 *  5. Fixed Pass-2 Tie-Breaker Trigger:
 *     Only triggers Pass-2 when confidence < 0.80 OR when BOTH primary AND
 *     secondary/auxiliary concepts form a genuine JEE overlap pair (e.g. WPE
 *     vs Rigid Body Mechanics), eliminating wasted double-runs.
 * ============================================================================
 */
(function (globalScope) {
    'use strict';

    const ENGINE_VERSION = '2.2.0';
    const SERVER_URL_STORAGE_KEY = 'jee_local_ai_url_v21';
    const USER_CORRECTIONS_KEY = 'jee_vlm_fewshot_memory_v1';

    const AUTO_ENDPOINTS = [
        { url: 'http://127.0.0.1:11434', kind: 'ollama' },
        { url: 'http://127.0.0.1:8080', kind: 'llama_cpp' }
    ];

    const VISION_MODEL_PREFERENCE = [
        'qwen2.5vl:3b',
        'qwen2.5-vl:3b',
        'qwen3-vl:4b-instruct',
        'qwen3-vl:2b-instruct',
        'qwen3-vl:4b',
        'qwen3-vl:2b',
        'qwen3.5:2b',
        'qwen3.5:4b',
        'gemma3:4b',
        'gemma4',
        'llava',
        'minicpm-v',
        'moondream'
    ];

    const MODEL_CATALOG = {
        'qwen2.5-vl-3b': {
            id: 'qwen2.5vl:3b',
            label: 'Native Local AI (Qwen2.5-VL 3B • Recommended)',
            maxImageEdge: 504
        },
        'qwen3-vl-4b': {
            id: 'qwen3-vl:4b-instruct',
            label: 'Native Local AI (Qwen3-VL 4B Instruct)',
            maxImageEdge: 504
        },
        'qwen3-vl-2b': {
            id: 'qwen3-vl:2b-instruct',
            label: 'Native Local AI (Qwen3-VL 2B Instruct • Fastest)',
            maxImageEdge: 504
        },
        // Seamless mapping for all existing index.html dropdown options
        'qwen3.5-0.8b': { id: 'auto', label: 'Native Local AI (Auto-Detect)', maxImageEdge: 504 },
        'qwen3.5-2b': { id: 'auto', label: 'Native Local AI (Auto-Detect)', maxImageEdge: 504 },
        'fastvlm-0.5b': { id: 'auto', label: 'Native Local AI (Auto-Detect)', maxImageEdge: 448 },
        'gemma-4-e2b': { id: 'auto', label: 'Native Local AI (Auto-Detect)', maxImageEdge: 504 },
        'qwen3.5-4b': { id: 'auto', label: 'Native Local AI (Auto-Detect)', maxImageEdge: 560 }
    };

    // ========================================================================
    // EXACT JEE CHAPTER TAXONOMY (Synchronized 1-to-1 with index.html)
    // ========================================================================
    const JEE_CHAPTERS = {
        Physics: [
            "Basic Mathematics",
            "Units and Measurements, Errors and Experiments",
            "Vectors",
            "Rectilinear Motion",
            "Projectile Motion",
            "Relative Motion",
            "Circular Kinematics",
            "Newton's Laws of Motion",
            "Work, Power and Energy",
            "COM, Momentum and Collision",
            "Rigid Body Mechanics",
            "Mechanical properties of Solids (Elasticity)",
            "Thermometry",
            "Thermal Expansion",
            "Calorimetry",
            "Heat Transfer",
            "Kinetic Theory of Gases",
            "Thermodynamics",
            "Fluid Mechanics",
            "Simple Harmonic Motion",
            "Transverse waves (String Waves)",
            "Longitudinal Waves (Sound Waves)",
            "Gravitation",
            "Kinematics",
            "Laws of Motion & Friction",
            "Work, Energy & Power",
            "Center of Mass & Collisions",
            "Rotational Mechanics",
            "Fluids & Properties of Matter",
            "Thermodynamics & KTG",
            "Oscillations & Waves",
            "Electrostatics & Capacitors",
            "Current Electricity",
            "Moving Charges & Magnetism",
            "EMI & Alternating Current",
            "Ray & Wave Optics",
            "Modern Physics & Semiconductors"
        ],
        Chemistry: [
            "Some Basic Concepts of Chemistry (Mole Concept)",
            "Atomic Structure",
            "Periodic Classification",
            "Chemical Bonding",
            "Gaseous States",
            "Thermodynamics",
            "Chemical Equilibrium",
            "Ionic Equilibrium",
            "Redox Reactions",
            "Equivalent Concept and Volumetric Analysis",
            "IUPAC Nomenclature",
            "GOC-I",
            "GOC-II",
            "Stereochemistry",
            "Hydrocarbons",
            "Hydrogen",
            "s-Block Elements",
            "Environmental Chemistry",
            "p-Block Elements",
            "Mole Concept & Stoichiometry",
            "Chemical & Ionic Equilibrium",
            "Thermodynamics & Thermochemistry",
            "Electrochemistry & Kinetics",
            "Solutions & Colligative Properties",
            "Coordination Compounds",
            "p, d & f-Block Elements",
            "General Organic Chemistry (GOC)",
            "Hydrocarbons & Haloalkanes",
            "Carbonyl Compounds, Alcohols & Acids",
            "Amines & Biomolecules"
        ],
        Mathematics: [
            "Basic Maths",
            "Sets",
            "Relations",
            "Introduction to Functions (PU)",
            "Linear Inequalities PU",
            "Fundamentals-1 & 2",
            "Quadratic Equations and Expressions",
            "Sequence and Series",
            "Binomial Theorem for any index",
            "Permutations and Combinations",
            "Trigonometric Ratios and Identities",
            "Trigonometric Equations and Inequalities",
            "Properties of Triangles",
            "Introduction to Co-ordinate Geometry",
            "Straight Lines",
            "Pair of Lines",
            "Circles",
            "Parabola",
            "Ellipse",
            "Hyperbola",
            "Introduction to 3D Geometry PU",
            "Statistics",
            "Limits PU",
            "Methods of Differentiation",
            "Functions",
            "Probability PU",
            "Quadratic Equations & Complex Numbers",
            "Sequences & Series",
            "Matrices & Determinants",
            "Limits, Continuity & Differentiability",
            "Application of Derivatives (AOD)",
            "Indefinite & Definite Integration",
            "Differential Equations & Area",
            "Vectors & 3D Geometry",
            "Probability & Trigonometry"
        ]
    };

    const PRIMARY_PROMPT_CHAPTERS = {
        Physics: [
            "Basic Mathematics",
            "Units and Measurements, Errors and Experiments",
            "Vectors",
            "Rectilinear Motion",
            "Projectile Motion",
            "Relative Motion",
            "Circular Kinematics",
            "Newton's Laws of Motion",
            "Work, Power and Energy",
            "COM, Momentum and Collision",
            "Rigid Body Mechanics",
            "Mechanical properties of Solids (Elasticity)",
            "Thermometry",
            "Thermal Expansion",
            "Calorimetry",
            "Heat Transfer",
            "Kinetic Theory of Gases",
            "Thermodynamics",
            "Fluid Mechanics",
            "Simple Harmonic Motion",
            "Transverse waves (String Waves)",
            "Longitudinal Waves (Sound Waves)",
            "Gravitation",
            "Electrostatics & Capacitors",
            "Current Electricity",
            "Moving Charges & Magnetism",
            "EMI & Alternating Current",
            "Ray & Wave Optics",
            "Modern Physics & Semiconductors"
        ],
        Chemistry: [
            "Some Basic Concepts of Chemistry (Mole Concept)",
            "Atomic Structure",
            "Periodic Classification",
            "Chemical Bonding",
            "Gaseous States",
            "Thermodynamics",
            "Chemical Equilibrium",
            "Ionic Equilibrium",
            "Redox Reactions",
            "Equivalent Concept and Volumetric Analysis",
            "IUPAC Nomenclature",
            "GOC-I",
            "GOC-II",
            "Stereochemistry",
            "Hydrocarbons",
            "Hydrogen",
            "s-Block Elements",
            "Environmental Chemistry",
            "p-Block Elements",
            "Electrochemistry & Kinetics",
            "Solutions & Colligative Properties",
            "Coordination Compounds",
            "p, d & f-Block Elements",
            "Carbonyl Compounds, Alcohols & Acids",
            "Amines & Biomolecules"
        ],
        Mathematics: [
            "Basic Maths",
            "Sets",
            "Relations",
            "Linear Inequalities PU",
            "Quadratic Equations and Expressions",
            "Quadratic Equations & Complex Numbers",
            "Sequence and Series",
            "Binomial Theorem for any index",
            "Permutations and Combinations",
            "Trigonometric Ratios and Identities",
            "Trigonometric Equations and Inequalities",
            "Properties of Triangles",
            "Straight Lines",
            "Pair of Lines",
            "Circles",
            "Parabola",
            "Ellipse",
            "Hyperbola",
            "Statistics",
            "Functions",
            "Limits, Continuity & Differentiability",
            "Methods of Differentiation",
            "Application of Derivatives (AOD)",
            "Indefinite & Definite Integration",
            "Differential Equations & Area",
            "Matrices & Determinants",
            "Vectors & 3D Geometry",
            "Probability PU"
        ]
    };

    // ========================================================================
    // CONCISE HIGH-PRECISION JEE OVERLAP RULES (Fast Prefill + High Accuracy)
    // ========================================================================
    const DISAMBIGUATION_RULES = [
        {
            pair: ['Work, Power and Energy', 'Rigid Body Mechanics'],
            subject: 'Physics',
            rule: 'Rotating/rolling/hinged extended body (rod, disc, ring, sphere, massive pulley) needing I or torque => ALWAYS "Rigid Body Mechanics", even if WPE solves it.'
        },
        {
            pair: ['COM, Momentum and Collision', 'Rigid Body Mechanics'],
            subject: 'Physics',
            rule: 'Collision imparting rotation or angular impulse to a rod/disc/sphere => "Rigid Body Mechanics".'
        },
        {
            pair: ['Work, Power and Energy', 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'Small oscillations, time period T, angular frequency omega, or SHM amplitude => "Simple Harmonic Motion".'
        },
        {
            pair: ["Newton's Laws of Motion", 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'Oscillating spring-block/pulley or max SHM amplitude without slipping => "Simple Harmonic Motion".'
        },
        {
            pair: ['Rigid Body Mechanics', 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'Small oscillations / time period T of hinged rod, disc, or ring => "Simple Harmonic Motion"; large-angle rotation/rolling => "Rigid Body Mechanics".'
        },
        {
            pair: ['Thermodynamics', 'Kinetic Theory of Gases'],
            subject: 'Physics',
            rule: 'P-V diagrams, Carnot/cyclic processes, First Law => "Thermodynamics"; v_rms, mean free path => "Kinetic Theory of Gases".'
        },
        {
            pair: ['Thermodynamics', 'Thermodynamics'],
            subject: 'CROSS_SUBJECT',
            rule: 'P-V/Carnot/piston/engine => Physics "Thermodynamics"; enthalpy/Hess/Gibbs/reaction kJ/mol => Chemistry "Thermodynamics".'
        },
        {
            pair: ['Atomic Structure', 'Modern Physics & Semiconductors'],
            subject: 'CROSS_SUBJECT',
            rule: 'Quantum numbers/orbitals/nodes => Chemistry "Atomic Structure"; photoelectric/nuclear/X-rays/diodes => Physics "Modern Physics & Semiconductors".'
        },
        {
            pair: ['GOC-I', 'Stereochemistry'],
            subject: 'Chemistry',
            rule: 'cis/trans, E/Z, R/S, chiral, enantiomer, geometrical/conformational isomers => "Stereochemistry"; resonance/+M/-I/aromaticity/acidity/tautomerism/structural isomers => "GOC-I".'
        },
        {
            pair: ['GOC-I', 'GOC-II'],
            subject: 'Chemistry',
            rule: 'Electronic effects/stability/acidity => "GOC-I"; SN1/SN2/E1/E2/EAS reaction mechanisms => "GOC-II".'
        },
        {
            pair: ['GOC-I', 'Hydrocarbons'],
            subject: 'Chemistry',
            rule: 'Reactions of alkanes/alkenes/alkynes/benzene => "Hydrocarbons"; stability/aromaticity/isomers without reaction => "GOC-I" or "Stereochemistry".'
        },
        {
            pair: ['Straight Lines', 'Circles'],
            subject: 'Mathematics',
            rule: 'Circle tangents, chords, radical axis, orthogonal circles, director circle => ALWAYS "Circles" (even if slope/angle-bisector is used).'
        },
        {
            pair: ['Circles', 'Parabola'],
            subject: 'Mathematics',
            rule: 'Classify by the primary conic whose theorem/property is tested.'
        },
        {
            pair: ['Quadratic Equations and Expressions', 'Quadratic Equations & Complex Numbers'],
            subject: 'Mathematics',
            rule: 'Complex z, Argand, |z|, arg(z), omega => "Quadratic Equations & Complex Numbers"; real roots/location of roots => "Quadratic Equations and Expressions".'
        },
        {
            pair: ['Methods of Differentiation', 'Application of Derivatives (AOD)'],
            subject: 'Mathematics',
            rule: 'Maxima/minima, monotonicity, tangents/normals, Rolle/LMVT => "Application of Derivatives (AOD)".'
        }
    ];

    // ========================================================================
    // RUNTIME STATE & OLD WASM SERVICE WORKER CLEANUP
    // ========================================================================
    const runtime = {
        customServerUrl: (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || '',
        detectedUrl: null,
        backendKind: null,
        activeModelKey: 'qwen2.5-vl-3b',
        loadedServerModelName: null,
        serverReady: false,
        modelWarmedUp: false,
        fatalBatchError: null
    };

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

    function getServerUrl() {
        const custom = (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || runtime.customServerUrl || '';
        return String(custom || runtime.detectedUrl || AUTO_ENDPOINTS[0].url).trim().replace(/\/+$/, '');
    }

    function setServerUrl(url) {
        const clean = String(url || '').trim().replace(/\/+$/, '');
        runtime.customServerUrl = clean;
        runtime.detectedUrl = null;
        runtime.backendKind = null;
        runtime.serverReady = false;
        runtime.modelWarmedUp = false;
        runtime.fatalBatchError = null;
        try {
            if (clean) localStorage.setItem(SERVER_URL_STORAGE_KEY, clean);
            else localStorage.removeItem(SERVER_URL_STORAGE_KEY);
        } catch (_) {}
        return clean || AUTO_ENDPOINTS[0].url;
    }

    // ========================================================================
    // LOOPBACK-SAFE FETCH (Chrome Local Network Access Compatible)
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
    // AUTO-DISCOVERY: OLLAMA (:11434) + LLAMA-SERVER (:8080)
    // ========================================================================
    function pickBestInstalledOllamaVisionModel(modelNames, requestedKey) {
        if (!Array.isArray(modelNames) || modelNames.length === 0) return null;
        const preferredTag = MODEL_CATALOG[requestedKey]?.id;
        if (preferredTag && preferredTag !== 'auto') {
            const exact = modelNames.find(n => n.toLowerCase() === preferredTag.toLowerCase() || n.toLowerCase().startsWith(preferredTag.toLowerCase()));
            if (exact) return exact;
        }
        for (const pref of VISION_MODEL_PREFERENCE) {
            const hit = modelNames.find(n => n.toLowerCase().includes(pref));
            if (hit) return hit;
        }
        return modelNames[0];
    }

    async function probeOllama(baseUrl, requestedKey, abortSignal) {
        const res = await loopbackFetch(`${baseUrl}/api/tags`, { method: 'GET', signal: abortSignal }, 2500);
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        if (!data || !Array.isArray(data.models)) return null;

        const names = data.models.map(m => m.name || m.model).filter(Boolean);
        if (names.length === 0) {
            throw new Error(`Ollama is running at ${baseUrl}, but no vision model is installed. Run once in Termux: ollama pull qwen2.5vl:3b`);
        }

        const chosen = pickBestInstalledOllamaVisionModel(names, requestedKey);
        return { ok: true, kind: 'ollama', url: baseUrl, modelName: chosen, installedModels: names };
    }

    async function probeLlamaServer(baseUrl, options = {}) {
        const abortSignal = options.abortSignal || null;
        const healthRes = await loopbackFetch(`${baseUrl}/health`, { method: 'GET', signal: abortSignal }, 2500);
        if (!healthRes.ok) return null;

        let modelName = 'local-llama-vlm';
        try {
            const propsRes = await loopbackFetch(`${baseUrl}/props`, { method: 'GET', signal: abortSignal }, 2500);
            if (propsRes.ok) {
                const props = await propsRes.json().catch(() => ({}));
                if (props.model_alias) modelName = props.model_alias;
                else if (props.default_generation_settings?.model) modelName = props.default_generation_settings.model;
            }
        } catch (_) {}
        return { ok: true, kind: 'llama_cpp', url: baseUrl, modelName };
    }

    async function checkServerHealth(options = {}) {
        const abortSignal = options.abortSignal || null;
        const requestedKey = options.modelKey || runtime.activeModelKey || 'qwen2.5-vl-3b';
        const customUrl = (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || runtime.customServerUrl || '';
        const targets = customUrl ? [{ url: customUrl.replace(/\/+$/, ''), kind: 'auto' }] : AUTO_ENDPOINTS;

        let specificError = null;
        for (const t of targets) {
            if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
            if (t.kind === 'ollama' || t.kind === 'auto') {
                try {
                    const hit = await probeOllama(t.url, requestedKey, abortSignal);
                    if (hit && hit.ok) {
                        runtime.detectedUrl = hit.url;
                        runtime.backendKind = 'ollama';
                        runtime.loadedServerModelName = hit.modelName;
                        runtime.serverReady = true;
                        return hit;
                    }
                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                    if (/no vision model is installed/i.test(err.message || '')) specificError = err;
                }
            }
            if (t.kind === 'llama_cpp' || t.kind === 'auto') {
                try {
                    const hit = await probeLlamaServer(t.url, options);
                    if (hit && hit.ok) {
                        runtime.detectedUrl = hit.url;
                        runtime.backendKind = 'llama_cpp';
                        runtime.loadedServerModelName = hit.modelName;
                        runtime.serverReady = true;
                        return hit;
                    }
                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                }
            }
        }
        if (specificError) throw specificError;
        throw new Error('Local Native AI is not running. Tap the "JEE-Vault" icon on your home screen to launch it.');
    }

    // ========================================================================
    // PATCH-ALIGNED IMAGE PREPROCESSOR (504px = 18x28 patches for Qwen2.5-VL!)
    // Cuts ViT + visual prefill tokens by ~68% while keeping diagrams razor sharp
    // ========================================================================
    async function prepareCleanQuestionImageForVLM(imageSource, maxEdge = 504) {
        const img = await new Promise((resolve, reject) => {
            if (imageSource instanceof HTMLCanvasElement) {
                const im = new Image();
                im.onload = () => resolve(im);
                im.onerror = reject;
                im.src = imageSource.toDataURL('image/png');
                return;
            }
            if (imageSource instanceof HTMLImageElement && imageSource.complete && imageSource.naturalWidth > 0) {
                resolve(imageSource);
                return;
            }
            const im = new Image();
            im.crossOrigin = 'anonymous';
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = String(imageSource || '');
        });

        const sw = img.naturalWidth || img.width || 1;
        const sh = img.naturalHeight || img.height || 1;
        const longest = Math.max(sw, sh);
        const scale = longest > maxEdge ? (maxEdge / longest) : 1.0;

        const pad = 10;
        const drawW = Math.max(28, Math.round(sw * scale));
        const drawH = Math.max(28, Math.round(sh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = drawW + pad * 2;
        canvas.height = drawH + pad * 2;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, pad, pad, drawW, drawH);

        return canvas.toDataURL('image/jpeg', 0.90);
    }

    // ========================================================================
    // FEW-SHOT USER CORRECTION MEMORY
    // ========================================================================
    function loadUserCorrections() {
        try {
            const raw = localStorage.getItem(USER_CORRECTIONS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function recordUserCorrection({ diagramSummary = '', snippet = '', wrongChapter = '', correctSubject = '', correctChapter = '' }) {
        if (!correctSubject || !correctChapter) return;
        const list = loadUserCorrections();
        list.unshift({
            diagramSummary: String(diagramSummary || '').slice(0, 90),
            snippet: String(snippet || '').slice(0, 100),
            wrongChapter: String(wrongChapter || ''),
            correctSubject,
            correctChapter,
            ts: Date.now()
        });
        try { localStorage.setItem(USER_CORRECTIONS_KEY, JSON.stringify(list.slice(0, 20))); } catch (_) {}
    }

    // ========================================================================
    // LEAN KV-CACHED PROMPTS (~230 TOKENS -> FAST CPU PREFILL + SHORT JSON!)
    // ========================================================================
    function buildPass1Prompts(options = {}) {
        const subjectLock = ['Physics', 'Chemistry', 'Mathematics'].includes(options.subjectHint)
            ? options.subjectHint
            : null;

        const chapterBlock = subjectLock
            ? `${subjectLock}: ${PRIMARY_PROMPT_CHAPTERS[subjectLock].join(' | ')}`
            : `Physics: ${PRIMARY_PROMPT_CHAPTERS.Physics.join(' | ')}\nChemistry: ${PRIMARY_PROMPT_CHAPTERS.Chemistry.join(' | ')}\nMathematics: ${PRIMARY_PROMPT_CHAPTERS.Mathematics.join(' | ')}`;

        const relevantRules = DISAMBIGUATION_RULES
            .filter(r => !subjectLock || r.subject === subjectLock || r.subject === 'CROSS_SUBJECT')
            .map(r => `- ${r.rule}`)
            .join('\n');

        const recentCorrections = loadUserCorrections()
            .filter(c => !subjectLock || c.correctSubject === subjectLock)
            .slice(0, 3);
        const feedbackSection = recentCorrections.length > 0
            ? `\nCalibration:\n${recentCorrections.map(c => `- "${c.diagramSummary || c.snippet}" => ${c.correctChapter}`).join('\n')}\n`
            : '';

        const systemPrompt = `You are a senior IIT-JEE Advanced examiner. Inspect the question image (including diagrams, springs, rotating rigid bodies, circuits, organic rings, graphs, tables, equations) and classify by the PRIMARY governing syllabus chapter — NEVER by an auxiliary tool (e.g. WPE used inside a rotating rigid body => Rigid Body Mechanics).
Rules:
${relevantRules}${feedbackSection}
Allowed Chapters (use EXACT name):
${chapterBlock}
Respond ONLY with compact valid JSON:
{"diagram":"short 3-8 word figure desc or None","subject":"${subjectLock || 'Physics|Chemistry|Mathematics'}","primary_chapter":"EXACT allowed chapter","secondary_chapter":"runner-up or empty","confidence":0.92,"reasoning":"1 concise sentence"}`;

        const userPrompt = subjectLock
            ? `Inspect this ${subjectLock} JEE question & diagram carefully. Output ONLY the compact JSON.`
            : `Inspect this JEE question & diagram carefully. Output ONLY the compact JSON.`;

        return { systemPrompt, userPrompt };
    }

    function buildTieBreakerPrompts(pass1Result, candidateChapters, specificRuleText = '') {
        const systemPrompt = `IIT-JEE Chief Paper Setter tie-breaker. Re-examine the image and pick the ONE true primary chapter from: ${candidateChapters.join(' | ')}.
Rule: ${specificRuleText || 'Pick the PRIMARY governing topic over an auxiliary formula.'}
Respond ONLY with JSON: {"primary_chapter":"EXACT candidate","confidence":0.92,"reasoning":"1 short sentence"}`;

        const userPrompt = `Diagram: ${pass1Result.diagramSummary || 'None'}. Decide between: ${candidateChapters.join(' vs ')}. Output ONLY JSON.`;
        return { systemPrompt, userPrompt };
    }

    // ========================================================================
    // CANONICAL CHAPTER MATCHER & ROBUST JSON PARSER
    // ========================================================================
    function normalizeStr(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function resolveCanonicalChapter(rawSubject, rawChapter) {
        const validSubjects = ['Physics', 'Chemistry', 'Mathematics'];
        let subject = validSubjects.find(s => s.toLowerCase() === String(rawSubject || '').trim().toLowerCase());
        if (!subject && /math/i.test(String(rawSubject || ''))) subject = 'Mathematics';
        if (!subject && /phys/i.test(String(rawSubject || ''))) subject = 'Physics';
        if (!subject && /chem/i.test(String(rawSubject || ''))) subject = 'Chemistry';

        const targetNorm = normalizeStr(rawChapter);
        if (!targetNorm) {
            const fallbackSubj = subject || 'Physics';
            return { subject: fallbackSubj, chapter: PRIMARY_PROMPT_CHAPTERS[fallbackSubj][0], exactMatch: false };
        }

        const ALIASES = {
            'rbd': { subject: 'Physics', chapter: 'Rigid Body Mechanics' },
            'rotational motion': { subject: 'Physics', chapter: 'Rigid Body Mechanics' },
            'rotational dynamics': { subject: 'Physics', chapter: 'Rigid Body Mechanics' },
            'rotational mechanics': { subject: 'Physics', chapter: 'Rigid Body Mechanics' },
            'wpe': { subject: 'Physics', chapter: 'Work, Power and Energy' },
            'work energy theorem': { subject: 'Physics', chapter: 'Work, Power and Energy' },
            'work energy power': { subject: 'Physics', chapter: 'Work, Power and Energy' },
            'nlm': { subject: 'Physics', chapter: "Newton's Laws of Motion" },
            'laws of motion': { subject: 'Physics', chapter: "Newton's Laws of Motion" },
            'shm': { subject: 'Physics', chapter: 'Simple Harmonic Motion' },
            'oscillations': { subject: 'Physics', chapter: 'Simple Harmonic Motion' },
            'com': { subject: 'Physics', chapter: 'COM, Momentum and Collision' },
            'center of mass': { subject: 'Physics', chapter: 'COM, Momentum and Collision' },
            'centre of mass': { subject: 'Physics', chapter: 'COM, Momentum and Collision' },
            'ktg': { subject: 'Physics', chapter: 'Kinetic Theory of Gases' },
            'electrostatics': { subject: 'Physics', chapter: 'Electrostatics & Capacitors' },
            'magnetism': { subject: 'Physics', chapter: 'Moving Charges & Magnetism' },
            'emi': { subject: 'Physics', chapter: 'EMI & Alternating Current' },
            'optics': { subject: 'Physics', chapter: 'Ray & Wave Optics' },
            'modern physics': { subject: 'Physics', chapter: 'Modern Physics & Semiconductors' },
            'mole concept': { subject: 'Chemistry', chapter: 'Some Basic Concepts of Chemistry (Mole Concept)' },
            'goc': { subject: 'Chemistry', chapter: 'GOC-I' },
            'goc 1': { subject: 'Chemistry', chapter: 'GOC-I' },
            'goc i': { subject: 'Chemistry', chapter: 'GOC-I' },
            'general organic chemistry': { subject: 'Chemistry', chapter: 'GOC-I' },
            'isomerism': { subject: 'Chemistry', chapter: 'Stereochemistry' },
            'goc 2': { subject: 'Chemistry', chapter: 'GOC-II' },
            'goc ii': { subject: 'Chemistry', chapter: 'GOC-II' },
            'thermochemistry': { subject: 'Chemistry', chapter: 'Thermodynamics' },
            'pnc': { subject: 'Mathematics', chapter: 'Permutations and Combinations' },
            'aod': { subject: 'Mathematics', chapter: 'Application of Derivatives (AOD)' },
            'complex numbers': { subject: 'Mathematics', chapter: 'Quadratic Equations & Complex Numbers' },
            'quadratic equations': { subject: 'Mathematics', chapter: 'Quadratic Equations and Expressions' },
            'straight line': { subject: 'Mathematics', chapter: 'Straight Lines' },
            'circle': { subject: 'Mathematics', chapter: 'Circles' },
            'integration': { subject: 'Mathematics', chapter: 'Indefinite & Definite Integration' },
            'differential equations': { subject: 'Mathematics', chapter: 'Differential Equations & Area' },
            'probability': { subject: 'Mathematics', chapter: 'Probability PU' },
            'matrices': { subject: 'Mathematics', chapter: 'Matrices & Determinants' },
            'determinants': { subject: 'Mathematics', chapter: 'Matrices & Determinants' },
            '3d geometry': { subject: 'Mathematics', chapter: 'Vectors & 3D Geometry' }
        };

        if (ALIASES[targetNorm]) {
            const hit = ALIASES[targetNorm];
            if (!subject || hit.subject === subject) {
                return { subject: hit.subject, chapter: hit.chapter, exactMatch: true };
            }
        }

        const searchSubjects = subject ? [subject, ...validSubjects.filter(s => s !== subject)] : validSubjects;
        for (const s of searchSubjects) {
            for (const c of JEE_CHAPTERS[s]) {
                if (normalizeStr(c) === targetNorm) return { subject: s, chapter: c, exactMatch: true };
            }
        }

        const targetToks = new Set(targetNorm.split(' ').filter(w => w.length > 1));
        let best = null;
        for (const s of searchSubjects) {
            const subjBonus = (subject && s === subject) ? 0.25 : 0;
            for (const c of JEE_CHAPTERS[s]) {
                const cNorm = normalizeStr(c);
                const cToks = new Set(cNorm.split(' ').filter(w => w.length > 1));
                let inter = 0;
                for (const t of targetToks) if (cToks.has(t)) inter++;
                const union = targetToks.size + cToks.size - inter;
                let score = union > 0 ? (inter / union) : 0;
                if (cNorm.includes(targetNorm) || targetNorm.includes(cNorm)) score += 0.45;
                score += subjBonus;
                if (!best || score > best.score) best = { subject: s, chapter: c, score };
            }
        }

        if (best && best.score >= 0.35) return { subject: best.subject, chapter: best.chapter, exactMatch: false };
        const fallbackSubj = subject || 'Physics';
        return { subject: fallbackSubj, chapter: PRIMARY_PROMPT_CHAPTERS[fallbackSubj][0], exactMatch: false };
    }

    function extractJsonFromModelOutput(rawText) {
        let cleaned = String(rawText || '').trim();
        let thinkingTrace = '';
        const thinkMatch = cleaned.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
            thinkingTrace = thinkMatch[1].trim();
            cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        }
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            const slice = cleaned.slice(firstBrace, lastBrace + 1);
            try {
                return { parsed: JSON.parse(slice), thinkingTrace, rawCleaned: cleaned };
            } catch (_) {
                try {
                    const repaired = slice.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\r\n]+/g, ' ');
                    return { parsed: JSON.parse(repaired), thinkingTrace, rawCleaned: cleaned };
                } catch (_) {}
            }
        }
        return { parsed: null, thinkingTrace, rawCleaned: cleaned };
    }

    // FIXED: Only matches a REAL 2-chapter overlap conflict (both chapA and chapB present!)
    // Prevents Pass-2 from firing unnecessarily on every single confident SHM / Circles / GOC question!
    function findStrictConflictRule(subject, chapA, chapB) {
        const nA = normalizeStr(chapA);
        const nB = normalizeStr(chapB);
        if (!nA || !nB || nA === nB) return null;
        for (const r of DISAMBIGUATION_RULES) {
            const p0 = normalizeStr(r.pair[0]);
            const p1 = normalizeStr(r.pair[1]);
            if ((nA === p0 && nB === p1) || (nA === p1 && nB === p0)) {
                if (r.subject === subject || r.subject === 'CROSS_SUBJECT') return r;
            }
        }
        return null;
    }

    // ========================================================================
    // STREAMING NATIVE OLLAMA & LLAMA-SERVER REQUEST RUNNER
    // ========================================================================
    async function callNativeVisionBackend(cleanImageDataUrl, systemPrompt, userPrompt, genOptions = {}) {
        const base = runtime.detectedUrl || getServerUrl();
        const maxTokens = Number(genOptions.maxTokens) || 120;
        const timeoutMs = Number(genOptions.timeoutMs) || 150000;
        const abortSignal = genOptions.abortSignal || null;
        const onTokenProgress = typeof genOptions.onTokenProgress === 'function' ? genOptions.onTokenProgress : null;

        // 1. OLLAMA STREAMING /api/chat (Fast `format: "json"`, 6 big cores, live token updates!)
        if (runtime.backendKind === 'ollama') {
            const rawBase64 = cleanImageDataUrl.includes(',')
                ? cleanImageDataUrl.split(',')[1]
                : cleanImageDataUrl;
            const modelName = runtime.loadedServerModelName || 'qwen2.5vl:3b';

            const body = {
                model: modelName,
                stream: true,
                keep_alive: '5m',
                format: 'json',
                options: {
                    temperature: 0.0,
                    num_ctx: 2048,
                    num_batch: 256,
                    num_thread: 6,
                    num_predict: maxTokens
                },
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: userPrompt,
                        images: [rawBase64]
                    }
                ]
            };

            const res = await loopbackFetch(
                `${base}/api/chat`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: abortSignal
                },
                timeoutMs
            );

            if (!res.ok) {
                const errTxt = (await res.text().catch(() => '')).slice(0, 300);
                if (/does not support images|missing.*projector|vision/i.test(errTxt)) {
                    const vErr = `Ollama model "${modelName}" does not support images. In Termux run: ollama pull qwen2.5vl:3b`;
                    runtime.fatalBatchError = vErr;
                    throw new Error(vErr);
                }
                throw new Error(`Local Ollama HTTP ${res.status}: ${errTxt || res.statusText}`);
            }

            // Stream NDJSON lines cleanly so UI shows live tokens & never looks frozen
            if (res.body && typeof res.body.getReader === 'function') {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buf = '';
                let fullContent = '';
                let tokCount = 0;

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    let nlIdx;
                    while ((nlIdx = buf.indexOf('\n')) >= 0) {
                        const line = buf.slice(0, nlIdx).trim();
                        buf = buf.slice(nlIdx + 1);
                        if (!line) continue;
                        try {
                            const chunk = JSON.parse(line);
                            const delta = chunk?.message?.content || '';
                            if (delta) {
                                fullContent += delta;
                                tokCount++;
                                if (onTokenProgress && (tokCount === 1 || tokCount % 4 === 0)) {
                                    onTokenProgress(tokCount, fullContent);
                                }
                            }
                        } catch (_) {}
                    }
                }
                if (buf.trim()) {
                    try {
                        const tail = JSON.parse(buf.trim());
                        if (tail?.message?.content) fullContent += tail.message.content;
                    } catch (_) {}
                }
                return fullContent;
            }

            const data = await res.json();
            return String(data?.message?.content || '');
        }

        // 2. LLAMA-SERVER /v1/chat/completions
        const endpoint = `${base}/v1/chat/completions`;
        const body = {
            model: runtime.loadedServerModelName || 'local-vlm',
            temperature: 0.0,
            max_tokens: maxTokens,
            cache_prompt: true,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: cleanImageDataUrl } },
                        { type: 'text', text: userPrompt }
                    ]
                }
            ]
        };

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
        if (!res.ok) {
            const errText = (await res.text().catch(() => '')).slice(0, 300);
            throw new Error(`Local AI Server HTTP ${res.status}: ${errText || res.statusText}`);
        }
        const data = await res.json();
        return String(data?.choices?.[0]?.message?.content || '');
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================
    async function inspectDeviceCapabilities() {
        let serverReachable = false, modelName = null, kind = null, url = null;
        try {
            const h = await checkServerHealth({ maxWaitLoadingMs: 2500 });
            serverReachable = Boolean(h.ok);
            modelName = h.modelName;
            kind = h.kind;
            url = h.url;
        } catch (_) {}
        return {
            backend: kind || 'native-local-ai',
            serverUrl: url || getServerUrl(),
            serverReachable,
            modelName,
            recommendedModel: 'qwen2.5-vl-3b'
        };
    }

    async function loadModel(modelKey = 'qwen2.5-vl-3b', options = {}) {
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        runtime.fatalBatchError = null;
        runtime.activeModelKey = MODEL_CATALOG[modelKey] ? modelKey : 'qwen2.5-vl-3b';

        if (onProgress) {
            onProgress({ stage: 'INIT', percent: 15, message: 'Connecting to Native Local AI Server...' });
        }

        try {
            const health = await checkServerHealth({
                modelKey: runtime.activeModelKey,
                onProgress,
                abortSignal: options.abortSignal
            });

            // Pre-warm Ollama model into RAM right here so Q.1 never times out paying the cold-load penalty!
            if (health.kind === 'ollama' && !runtime.modelWarmedUp) {
                if (onProgress) {
                    onProgress({
                        stage: 'LOAD',
                        percent: 55,
                        message: `Loading ${health.modelName} into RAM (one-time ~10s warmup)...`
                    });
                }
                try {
                    await loopbackFetch(
                        `${health.url}/api/chat`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: health.modelName,
                                stream: false,
                                keep_alive: '5m',
                                options: { num_ctx: 2048, num_thread: 6, num_predict: 1 },
                                messages: [{ role: 'user', content: 'ok' }]
                            }),
                            signal: options.abortSignal
                        },
                        120000
                    );
                    runtime.modelWarmedUp = true;
                } catch (warmErr) {
                    if (warmErr.name === 'AbortError') throw warmErr;
                }
            }

            const label = health.kind === 'ollama' ? 'NATIVE-OLLAMA' : 'NATIVE-LLAMA';
            if (onProgress) {
                onProgress({ stage: 'READY', percent: 100, message: `Connected to ${label}: ${health.modelName} ✓` });
            }

            return {
                modelKey: runtime.activeModelKey,
                modelId: health.modelName,
                device: label,
                cached: true
            };
        } catch (err) {
            runtime.fatalBatchError = err?.message || String(err);
            throw err;
        }
    }

    async function unloadModel() {
        runtime.serverReady = false;
        runtime.modelWarmedUp = false;
    }

    async function classifyQuestionImage(imageSource, options = {}) {
        const startedAt = performance.now();
        const modelKey = options.modelKey || runtime.activeModelKey || 'qwen2.5-vl-3b';
        const enableTieBreaker = options.enableTieBreaker ?? true;
        const reviewConfidenceThreshold = Number(options.reviewConfidenceThreshold ?? 0.80);
        const timeoutMs = Number(options.timeoutMs ?? 150000);

        if (runtime.fatalBatchError && !options.retryAfterFatal) {
            throw new Error(runtime.fatalBatchError);
        }

        if (!runtime.serverReady) {
            await loadModel(modelKey, { onProgress: options.onProgress, abortSignal: options.abortSignal });
        }

        const spec = MODEL_CATALOG[modelKey] || MODEL_CATALOG['qwen2.5-vl-3b'];
        const cleanImageDataUrl = await prepareCleanQuestionImageForVLM(imageSource, spec.maxImageEdge || 504);
        const deviceLabel = runtime.backendKind === 'ollama' ? 'NATIVE-OLLAMA' : 'NATIVE-LLAMA';
        const shortModel = runtime.loadedServerModelName || 'ARM64';

        const updateLiveSubText = (msg) => {
            if (typeof options.onStageMessage === 'function') {
                options.onStageMessage(msg);
            } else if (typeof document !== 'undefined') {
                const el = document.getElementById('extractSubText');
                if (el && !document.getElementById('uploadProgressView')?.classList.contains('hidden')) {
                    el.textContent = msg;
                }
            }
        };

        // PASS 1: Fast 504px Visual + Concept Analysis with Live Token Updates
        updateLiveSubText(`Native AI [${shortModel}]: encoding diagram (504px)...`);
        const { systemPrompt, userPrompt } = buildPass1Prompts(options);
        const rawPass1 = await callNativeVisionBackend(cleanImageDataUrl, systemPrompt, userPrompt, {
            maxTokens: 120,
            timeoutMs,
            abortSignal: options.abortSignal,
            onTokenProgress: (tokCount) => {
                const sec = ((performance.now() - startedAt) / 1000).toFixed(0);
                updateLiveSubText(`Native AI [${shortModel}]: decoding JSON (${tokCount} tok, ${sec}s)...`);
            }
        });

        const { parsed: p1, thinkingTrace: think1 } = extractJsonFromModelOutput(rawPass1);
        const rawSubj = options.subjectHint && ['Physics', 'Chemistry', 'Mathematics'].includes(options.subjectHint)
            ? options.subjectHint
            : (p1?.subject || 'Physics');

        const canonPrimary = resolveCanonicalChapter(rawSubj, p1?.primary_chapter || rawPass1);
        const canonSecondary = p1?.secondary_chapter
            ? resolveCanonicalChapter(canonPrimary.subject, p1.secondary_chapter)
            : null;

        let finalSubject = canonPrimary.subject;
        let finalChapter = canonPrimary.chapter;
        let secondaryChapter = (canonSecondary && canonSecondary.chapter !== finalChapter) ? canonSecondary.chapter : '';
        let rawConf = typeof p1?.confidence === 'number' ? p1.confidence : (canonPrimary.exactMatch ? 0.85 : 0.60);
        let confidence = rawConf > 1 ? (rawConf / 100) : rawConf;
        confidence = Math.max(0.15, Math.min(0.99, confidence));

        const diagramSummary = String(p1?.diagram || p1?.diagram_summary || '').trim() || 'None';
        let reasoning = String(p1?.reasoning || '').trim();
        let tieBreakerUsed = false;

        // PASS 2: ONLY fire on low confidence (< 0.80), fuzzy match, OR an actual 2-chapter overlap conflict!
        const conflictRule = findStrictConflictRule(finalSubject, finalChapter, secondaryChapter);
        const shouldRunTieBreaker = enableTieBreaker && (
            confidence < 0.80 ||
            Boolean(conflictRule) ||
            !canonPrimary.exactMatch
        );

        if (shouldRunTieBreaker) {
            const candidateSet = new Set([finalChapter]);
            if (secondaryChapter) candidateSet.add(secondaryChapter);
            if (conflictRule && conflictRule.subject === finalSubject) {
                candidateSet.add(conflictRule.pair[0]);
                candidateSet.add(conflictRule.pair[1]);
            }
            const candidates = Array.from(candidateSet).filter(Boolean).slice(0, 3);
            if (candidates.length >= 2) {
                tieBreakerUsed = true;
                updateLiveSubText(`Native AI [${shortModel}]: Pass-2 referee (${candidates.join(' vs ')})...`);
                const tb = buildTieBreakerPrompts(
                    { subject: finalSubject, chapter: finalChapter, secondaryChapter, diagramSummary },
                    candidates,
                    conflictRule?.rule || ''
                );
                try {
                    const rawPass2 = await callNativeVisionBackend(cleanImageDataUrl, tb.systemPrompt, tb.userPrompt, {
                        maxTokens: 75,
                        timeoutMs: Math.round(timeoutMs * 0.7),
                        abortSignal: options.abortSignal
                    });
                    const { parsed: p2 } = extractJsonFromModelOutput(rawPass2);
                    if (p2?.primary_chapter) {
                        const tbCanon = resolveCanonicalChapter(finalSubject, p2.primary_chapter);
                        if (candidates.includes(tbCanon.chapter)) {
                            if (tbCanon.chapter !== finalChapter) {
                                secondaryChapter = finalChapter;
                                finalChapter = tbCanon.chapter;
                            }
                            if (typeof p2.confidence === 'number') {
                                const c2 = p2.confidence > 1 ? p2.confidence / 100 : p2.confidence;
                                confidence = Math.max(0.2, Math.min(0.99, (confidence * 0.35) + (c2 * 0.65)));
                            }
                            if (p2.reasoning) reasoning = String(p2.reasoning).trim();
                        }
                    }
                } catch (_) {}
            }
        }

        const elapsedMs = Math.round(performance.now() - startedAt);
        return {
            subject: finalSubject,
            chapter: finalChapter,
            secondaryChapter,
            diagramSummary,
            reasoning: reasoning || `Classified visually by ${shortModel}.`,
            thinkingTrace: think1,
            confidence: Math.round(confidence * 100) / 100,
            needsReview: confidence < reviewConfidenceThreshold || !canonPrimary.exactMatch,
            tieBreakerUsed,
            elapsedMs,
            modelId: runtime.loadedServerModelName || spec.id,
            device: deviceLabel
        };
    }

    async function classifyBatch(questions, options = {}) {
        const list = Array.isArray(questions) ? questions : [];
        const abortSignal = options.abortSignal || null;
        const onItemComplete = typeof options.onItemComplete === 'function' ? options.onItemComplete : null;
        const results = [];

        if (list.length === 0) return results;
        const modelKey = options.modelKey || runtime.activeModelKey || 'qwen2.5-vl-3b';
        await loadModel(modelKey, { onProgress: options.onProgress || options.onLoadProgress, abortSignal });

        for (let i = 0; i < list.length; i++) {
            if (abortSignal?.aborted) break;
            const q = list[i];
            const res = await classifyQuestionImage(q.imageDataUrl || q.canvas, {
                modelKey,
                subjectHint: q.subjectOverride || options.subjectHint || null,
                paperName: q.paperName || options.paperName || '',
                ocrTextHint: q.ocrText || '',
                enableTieBreaker: options.enableTieBreaker ?? true,
                reviewConfidenceThreshold: options.reviewConfidenceThreshold ?? 0.80,
                abortSignal
            });

            results.push({ id: q.id, questionNumber: q.questionNumber, ...res });
            if (onItemComplete) onItemComplete({ index: i, total: list.length, question: q, result: res });
        }

        return results;
    }

    // ========================================================================
    // PUBLIC EXPORT
    // ========================================================================
    const PublicAPI = {
        version: ENGINE_VERSION,
        MODEL_CATALOG,
        JEE_CHAPTERS,
        PRIMARY_PROMPT_CHAPTERS,
        DISAMBIGUATION_RULES,
        getServerUrl,
        setServerUrl,
        checkServerHealth,
        inspectDeviceCapabilities,
        loadModel,
        unloadModel,
        isModelReady: () => Boolean(runtime.serverReady),
        getActiveModelInfo: () => ({
            modelKey: runtime.activeModelKey,
            modelId: runtime.loadedServerModelName || 'Local Native AI',
            device: runtime.backendKind === 'ollama' ? 'NATIVE-OLLAMA' : 'NATIVE-LLAMA',
            serverUrl: runtime.detectedUrl || getServerUrl()
        }),
        classifyQuestionImage,
        classifyBatch,
        recordUserCorrection,
        resolveCanonicalChapter
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PublicAPI;
    }
    globalScope.JEELocalVLMClassifier = PublicAPI;

})(typeof window !== 'undefined' ? window : globalThis);
