/**
 * ============================================================================
 * JEE NATIVE LOCAL AI VISION-LANGUAGE CHAPTER CLASSIFIER (NON-ONNX)
 * File Name for GitHub: local-vlm-classifier.js
 * Version: 2.1.0 (Auto-Discovery: Native Ollama :11434 + llama-server :8080)
 * ============================================================================
 * Zero ONNX. Zero WASM 2GB OOM. Zero Adreno WebGPU crashes. Zero Gemini API.
 *
 * Automatically connects to a native 64-bit ARM64 AI engine running on the
 * tablet via Termux (started automatically by Termux:Boot + 1-tap Home Screen
 * shortcut via Termux:Widget):
 *   1. Native Ollama (http://127.0.0.1:11434) — PREFERRED:
 *      - Uses ~25 MB RAM & 0% CPU when idle
 *      - Loads the vision model ONLY when sorting a PDF
 *      - Auto-unloads from RAM 5 minutes after sorting finishes (keep_alive: 5m)
 *      - Uses Ollama's native /api/chat with strict JSON Schema + vision images
 *   2. Native llama.cpp llama-server (http://127.0.0.1:8080) — FALLBACK:
 *      - Uses /v1/chat/completions with grammar-constrained JSON Schema
 *
 * 100% drop-in compatible with existing index.html JEELocalVLMClassifier API.
 * ============================================================================
 */
(function (globalScope) {
    'use strict';

    const ENGINE_VERSION = '2.1.0';
    const SERVER_URL_STORAGE_KEY = 'jee_local_ai_url_v21';
    const USER_CORRECTIONS_KEY = 'jee_vlm_fewshot_memory_v1';

    const AUTO_ENDPOINTS = [
        { url: 'http://127.0.0.1:11434', kind: 'ollama' },
        { url: 'http://127.0.0.1:8080', kind: 'llama_cpp' }
    ];

    // Preference order when multiple models are installed in Ollama
    const VISION_MODEL_PREFERENCE = [
        'qwen3-vl:4b-instruct',
        'qwen3-vl:4b',
        'qwen2.5vl:3b',
        'qwen2.5-vl:3b',
        'qwen3-vl:2b-instruct',
        'qwen3-vl:2b',
        'qwen3.5:4b',
        'qwen3.5:2b',
        'gemma3:4b',
        'gemma4',
        'llava',
        'minicpm-v',
        'moondream'
    ];

    const MODEL_CATALOG = {
        'qwen3-vl-4b': {
            id: 'qwen3-vl:4b-instruct',
            label: 'Native Local AI (Auto: Ollama / llama-server • Qwen3-VL 4B)',
            maxImageEdge: 896
        },
        'qwen2.5-vl-3b': {
            id: 'qwen2.5vl:3b',
            label: 'Native Local AI (Qwen2.5-VL 3B Instruct)',
            maxImageEdge: 840
        },
        'qwen3-vl-2b': {
            id: 'qwen3-vl:2b-instruct',
            label: 'Native Local AI (Qwen3-VL 2B Instruct • Fastest)',
            maxImageEdge: 784
        },
        // Seamless mapping for all existing index.html dropdown values
        'qwen3.5-0.8b': { id: 'auto', label: 'Native Local AI Server (Auto-Detect)', maxImageEdge: 896 },
        'qwen3.5-2b': { id: 'auto', label: 'Native Local AI Server (Auto-Detect)', maxImageEdge: 896 },
        'fastvlm-0.5b': { id: 'auto', label: 'Native Local AI Server (Auto-Detect)', maxImageEdge: 840 },
        'gemma-4-e2b': { id: 'auto', label: 'Native Local AI Server (Auto-Detect)', maxImageEdge: 896 },
        'qwen3.5-4b': { id: 'auto', label: 'Native Local AI Server (Auto-Detect)', maxImageEdge: 960 }
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
    // 16 HIGH-CONFUSION JEE ADVANCED OVERLAP RULES (WPE vs RBD, NLM vs SHM...)
    // ========================================================================
    const DISAMBIGUATION_RULES = [
        {
            pair: ['Work, Power and Energy', 'Rigid Body Mechanics'],
            subject: 'Physics',
            rule: 'If the body has finite size/geometry (rod, disc, ring, sphere, cylinder, massive pulley) AND rotates, rolls, pivots about a hinge, or requires moment of inertia (I) or torque, the PRIMARY chapter is ALWAYS "Rigid Body Mechanics" — even if Work-Energy Theorem / energy conservation is used to solve it. Choose "Work, Power and Energy" ONLY for point-mass / purely translating block-spring problems.'
        },
        {
            pair: ['COM, Momentum and Collision', 'Rigid Body Mechanics'],
            subject: 'Physics',
            rule: 'If a collision involves an extended rigid body (rod, disc, sphere) acquiring angular velocity or angular impulse about a hinge or CM, choose "Rigid Body Mechanics". Choose "COM, Momentum and Collision" for purely translational collisions, variable mass, or CM displacement.'
        },
        {
            pair: ['Work, Power and Energy', 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'If the question asks for time period (T), angular frequency (omega), amplitude of oscillation, phase, or small oscillations about equilibrium (even with springs, collisions, or energy steps), the PRIMARY chapter is "Simple Harmonic Motion".'
        },
        {
            pair: ["Newton's Laws of Motion", 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'If springs/pulleys/blocks are oscillating or the question asks for maximum amplitude without slipping, time period, or SHM conditions, choose "Simple Harmonic Motion". Choose "Newton\'s Laws of Motion" only for non-oscillatory acceleration, tension, or static/kinetic friction.'
        },
        {
            pair: ['Rigid Body Mechanics', 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'If a hinged rod, uniform disc, or ring performs SMALL OSCILLATIONS and asks for time period T, angular frequency, or minimum period (compound/physical pendulum), choose "Simple Harmonic Motion". If it rotates through large angles (e.g. 90 deg fall) or rolls down an incline without asking for oscillation period, choose "Rigid Body Mechanics".'
        },
        {
            pair: ['Circular Kinematics', "Newton's Laws of Motion"],
            subject: 'Physics',
            rule: 'If the problem involves banking of roads, conical pendulum, vertical circular loop, centripetal/tangential acceleration, or radius of curvature, choose "Circular Kinematics".'
        },
        {
            pair: ['Thermodynamics', 'Kinetic Theory of Gases'],
            subject: 'Physics',
            rule: 'Choose "Thermodynamics" for P-V diagrams, Carnot/cyclic processes, isothermal/adiabatic/polytropic work, heat engine efficiency, or First Law (dQ = dU + dW). Choose "Kinetic Theory of Gases" for v_rms, Maxwell speed distribution, mean free path, or pure degrees of freedom.'
        },
        {
            pair: ['Thermodynamics', 'Thermodynamics'],
            subject: 'CROSS_SUBJECT',
            rule: 'Physics Thermodynamics covers P-V diagrams, piston-cylinder, heat engines, Carnot cycles, and gas work. Chemistry Thermodynamics covers enthalpy of formation/combustion/neutralization, Hess law, bond enthalpies, Gibbs free energy of chemical reactions, and kJ/mol.'
        },
        {
            pair: ['Atomic Structure', 'Modern Physics & Semiconductors'],
            subject: 'CROSS_SUBJECT',
            rule: 'Quantum numbers (n, l, m, s), radial/angular nodes, orbitals, Aufbau/Hund rules, and electronic configuration belong to Chemistry "Atomic Structure". Photoelectric effect, nuclear decay/binding energy, X-rays, and diodes/transistors/logic gates belong to Physics "Modern Physics & Semiconductors".'
        },
        {
            pair: ['GOC-I', 'Stereochemistry'],
            subject: 'Chemistry',
            rule: 'If the core question asks about cis/trans, E/Z, R/S, chiral centers, enantiomers, diastereomers, meso compounds, optical activity, geometrical isomers, or conformational isomers (Newman/chair/gauche/dipole of conformers), choose "Stereochemistry". If it asks about resonance/mesomeric/inductive effects, hyperconjugation, aromaticity/antiaromaticity, acid/base strength, tautomerism, or structural/constitutional isomers, choose "GOC-I".'
        },
        {
            pair: ['GOC-I', 'GOC-II'],
            subject: 'Chemistry',
            rule: 'Choose "GOC-I" for electronic effects (+I/-I/+M/-M), stability of intermediates, aromaticity, acidity/basicity, and tautomerism. Choose "GOC-II" for reaction mechanisms (SN1, SN2, E1, E2, carbocation rearrangements, electrophilic aromatic substitution).'
        },
        {
            pair: ['GOC-I', 'Hydrocarbons'],
            subject: 'Chemistry',
            rule: 'If the question involves reactions of alkanes/alkenes/alkynes/benzene (ozonolysis, Wurtz, Markovnikov, hydroboration, Birch, Lindlar), choose "Hydrocarbons". If it only compares stability, aromaticity, hyperconjugation, or isomer counts without a hydrocarbon reaction, choose "GOC-I" or "Stereochemistry".'
        },
        {
            pair: ['Straight Lines', 'Circles'],
            subject: 'Mathematics',
            rule: 'If the central geometric object is one or more circles (tangents to a circle, chord of contact, radical axis, orthogonal circles, director circle, family of circles, common tangents, locus w.r.t. a circle), the PRIMARY chapter is ALWAYS "Circles" — even if straight-line formulas like slope, angle bisector, or foot of perpendicular are used as intermediate tools!'
        },
        {
            pair: ['Circles', 'Parabola'],
            subject: 'Mathematics',
            rule: 'Identify which conic carries the primary theorem being tested. If a circle is auxiliary to a parabola focal chord/normal/tangent problem, choose "Parabola"; if a parabola/line intersects a circle to test circle geometry, choose "Circles".'
        },
        {
            pair: ['Quadratic Equations and Expressions', 'Quadratic Equations & Complex Numbers'],
            subject: 'Mathematics',
            rule: 'Choose "Quadratic Equations & Complex Numbers" whenever complex numbers z, Argand plane, modulus |z|, arg(z), De Moivre theorem, or cube/nth roots of unity (omega) appear. Choose "Quadratic Equations and Expressions" for real-coefficient roots, location of roots, and discriminants.'
        },
        {
            pair: ['Methods of Differentiation', 'Application of Derivatives (AOD)'],
            subject: 'Mathematics',
            rule: 'If the question asks for maxima/minima, monotonicity (increasing/decreasing), tangents/normals to curves, Rolle/LMVT, or rate of change, choose "Application of Derivatives (AOD)". Choose "Methods of Differentiation" only for direct dy/dx computation.'
        }
    ];

    // ========================================================================
    // RUNTIME STATE & CLEANUP OF OLD WASM SERVICE WORKER
    // ========================================================================
    const runtime = {
        customServerUrl: (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || '',
        detectedUrl: null,
        backendKind: null, // 'ollama' | 'llama_cpp'
        activeModelKey: 'qwen3-vl-4b',
        loadedServerModelName: null,
        serverReady: false,
        responseFormatMode: 'json_schema',
        fatalBatchError: null
    };

    // Automatically remove old coi-serviceworker.js if previously registered for browser WASM
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
        runtime.fatalBatchError = null;
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
    // SMART AUTO-DISCOVERY: OLLAMA (:11434) + LLAMA-SERVER (:8080)
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
            throw new Error(
                `Local Ollama is running at ${baseUrl}, but no vision model is downloaded yet. In Termux, run once: ollama pull qwen2.5vl:3b`
            );
        }

        const chosen = pickBestInstalledOllamaVisionModel(names, requestedKey);
        return {
            ok: true,
            kind: 'ollama',
            url: baseUrl,
            modelName: chosen,
            installedModels: names
        };
    }

    async function probeLlamaServer(baseUrl, options = {}) {
        const abortSignal = options.abortSignal || null;
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        const maxWaitLoadingMs = Number(options.maxWaitLoadingMs ?? 90000);
        const start = performance.now();

        while (true) {
            if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
            const healthRes = await loopbackFetch(`${baseUrl}/health`, { method: 'GET', signal: abortSignal }, 2500);

            if (healthRes.status === 503) {
                const elapsed = performance.now() - start;
                if (elapsed > maxWaitLoadingMs) {
                    throw new Error(`Local llama-server at ${baseUrl} is still loading after ${Math.round(maxWaitLoadingMs / 1000)}s.`);
                }
                if (onProgress) {
                    onProgress({
                        stage: 'LOAD',
                        percent: Math.min(90, 20 + Math.round((elapsed / maxWaitLoadingMs) * 70)),
                        message: `Waiting for local llama-server to finish loading model (${Math.round(elapsed / 1000)}s)...`
                    });
                }
                await new Promise(r => setTimeout(r, 1200));
                continue;
            }

            if (!healthRes.ok) return null;

            let modelName = 'local-llama-vlm';
            let visionSupported = true;
            try {
                const propsRes = await loopbackFetch(`${baseUrl}/props`, { method: 'GET', signal: abortSignal }, 2500);
                if (propsRes.ok) {
                    const props = await propsRes.json().catch(() => ({}));
                    if (props.model_alias) modelName = props.model_alias;
                    else if (props.default_generation_settings?.model) modelName = props.default_generation_settings.model;
                    if (props.modalities && props.modalities.vision === false) visionSupported = false;
                }
            } catch (_) {}

            if (!visionSupported) {
                throw new Error(`llama-server at ${baseUrl} loaded "${modelName}" without a vision projector (mmproj).`);
            }
            return { ok: true, kind: 'llama_cpp', url: baseUrl, modelName };
        }
    }

    async function checkServerHealth(options = {}) {
        const abortSignal = options.abortSignal || null;
        const requestedKey = options.modelKey || runtime.activeModelKey || 'qwen3-vl-4b';
        const customUrl = (typeof localStorage !== 'undefined' && localStorage.getItem(SERVER_URL_STORAGE_KEY)) || runtime.customServerUrl || '';

        const targets = customUrl
            ? [{ url: customUrl.replace(/\/+$/, ''), kind: 'auto' }]
            : AUTO_ENDPOINTS;

        let specificError = null;

        for (const t of targets) {
            if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

            // 1. Try Ollama
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
                    if (/no vision model is downloaded/i.test(err.message || '')) specificError = err;
                }
            }

            // 2. Try llama-server
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
                    if (/without a vision projector|still loading/i.test(err.message || '')) specificError = err;
                }
            }
        }

        if (specificError) throw specificError;

        throw new Error(
            'Local Native AI is not running yet. Tap the "JEE Vault" shortcut on your tablet home screen (it starts Ollama silently & opens this page), and tap "Allow" if Chrome asks for Local Network access.'
        );
    }

    // ========================================================================
    // HIGH-CONTRAST IMAGE PREPROCESSOR (840-896px SHARP FOR DIAGRAMS & MATH)
    // ========================================================================
    async function prepareCleanQuestionImageForVLM(imageSource, maxEdge = 896) {
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

        const pad = 16;
        const drawW = Math.max(32, Math.round(sw * scale));
        const drawH = Math.max(32, Math.round(sh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = drawW + pad * 2;
        canvas.height = drawH + pad * 2;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, pad, pad, drawW, drawH);

        return canvas.toDataURL('image/jpeg', 0.92);
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
            diagramSummary: String(diagramSummary || '').slice(0, 120),
            snippet: String(snippet || '').slice(0, 140),
            wrongChapter: String(wrongChapter || ''),
            correctSubject,
            correctChapter,
            ts: Date.now()
        });
        try { localStorage.setItem(USER_CORRECTIONS_KEY, JSON.stringify(list.slice(0, 24))); } catch (_) {}
    }

    // ========================================================================
    // KV-CACHED PROMPTS + GRAMMAR-CONSTRAINED JSON SCHEMAS
    // ========================================================================
    function buildPass1Prompts(options = {}) {
        const subjectLock = ['Physics', 'Chemistry', 'Mathematics'].includes(options.subjectHint)
            ? options.subjectHint
            : null;

        const allowedChapters = subjectLock
            ? PRIMARY_PROMPT_CHAPTERS[subjectLock]
            : [
                ...PRIMARY_PROMPT_CHAPTERS.Physics,
                ...PRIMARY_PROMPT_CHAPTERS.Chemistry,
                ...PRIMARY_PROMPT_CHAPTERS.Mathematics
            ];

        const chapterBlock = subjectLock
            ? `${subjectLock} Chapters:\n- ${PRIMARY_PROMPT_CHAPTERS[subjectLock].join('\n- ')}`
            : [
                `Physics Chapters:\n- ${PRIMARY_PROMPT_CHAPTERS.Physics.join('\n- ')}`,
                `Chemistry Chapters:\n- ${PRIMARY_PROMPT_CHAPTERS.Chemistry.join('\n- ')}`,
                `Mathematics Chapters:\n- ${PRIMARY_PROMPT_CHAPTERS.Mathematics.join('\n- ')}`
            ].join('\n\n');

        const relevantRules = DISAMBIGUATION_RULES
            .filter(r => !subjectLock || r.subject === subjectLock || r.subject === 'CROSS_SUBJECT')
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');

        const recentCorrections = loadUserCorrections()
            .filter(c => !subjectLock || c.correctSubject === subjectLock)
            .slice(0, 4);
        const feedbackSection = recentCorrections.length > 0
            ? `\nRECENT FACULTY CALIBRATION NOTES:\n${recentCorrections.map(c =>
                `- Problem resembling "${c.diagramSummary || c.snippet}": Primary chapter is "${c.correctChapter}" (${c.correctSubject})${c.wrongChapter ? `, NOT "${c.wrongChapter}"` : ''}.`
            ).join('\n')}\n`
            : '';

        const systemPrompt = `You are a senior IIT-JEE Advanced Physics, Chemistry, and Mathematics examiner.
Inspect the question image carefully — including EVERY diagram, pulley, spring, rotating rigid body, circuit, graph, organic ring, reaction arrow, matrix-match table, and equation — and identify the SINGLE PRIMARY SYLLABUS CHAPTER fundamentally being tested.

CORE RULE — PRIMARY CHAPTER VS. AUXILIARY TOOL:
JEE Advanced questions often use a formula from one chapter as an intermediate tool inside another chapter (e.g., Work-Energy Theorem inside a Rigid Body Mechanics rolling/hinged-rod problem, or straight-line slope/angle-bisector inside a Circles problem, or energy conservation inside an SHM oscillation problem).
ALWAYS classify by the PRIMARY GOVERNING SYSTEM AND CORE CONCEPT BEING TESTED — NEVER by an auxiliary tool.

DISAMBIGUATION RULES:
${relevantRules}
${feedbackSection}
ALLOWED CHAPTER NAMES (pick an EXACT string):
${chapterBlock}

Respond strictly with valid JSON matching the schema.`;

        const userLines = ['Carefully inspect this JEE question image (including all figures, symbols, and options) and output the exact Subject and PRIMARY JEE Chapter as JSON.'];
        if (subjectLock) userLines.push(`Known section subject: ${subjectLock}.`);

        const jsonSchema = {
            type: 'object',
            properties: {
                diagram_summary: { type: 'string' },
                subject: {
                    type: 'string',
                    enum: subjectLock ? [subjectLock] : ['Physics', 'Chemistry', 'Mathematics']
                },
                primary_chapter: {
                    type: 'string',
                    enum: allowedChapters
                },
                secondary_chapter: { type: 'string' },
                auxiliary_concepts: {
                    type: 'array',
                    items: { type: 'string' }
                },
                confidence: { type: 'number' },
                reasoning: { type: 'string' }
            },
            required: ['diagram_summary', 'subject', 'primary_chapter', 'secondary_chapter', 'confidence', 'reasoning'],
            additionalProperties: false
        };

        return { systemPrompt, userPrompt: userLines.join('\n'), jsonSchema };
    }

    function buildTieBreakerPrompts(pass1Result, candidateChapters, specificRuleText = '') {
        const subject = pass1Result.subject;
        const systemPrompt = `You are a senior IIT-JEE Chief Paper Setter acting as a strict referee between competing syllabus chapters.
Re-examine the question image and decide WHICH ONE candidate chapter below is the TRUE PRIMARY CHAPTER.

CANDIDATES (${subject}):
${candidateChapters.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

REFEREE RULE:
${specificRuleText || 'Distinguish the PRIMARY governing physical/chemical/mathematical topic from an auxiliary formula used mid-solution.'}

Respond strictly with valid JSON.`;

        const userPrompt = `Pass-1 observed:
- Diagram: ${pass1Result.diagramSummary || 'None'}
- Initial pick: "${pass1Result.chapter}" vs "${pass1Result.secondaryChapter || 'None'}"
- Reasoning: ${pass1Result.reasoning || ''}

Re-check the image carefully and pick the single TRUE primary chapter from the candidates.`;

        const jsonSchema = {
            type: 'object',
            properties: {
                primary_chapter: { type: 'string', enum: candidateChapters },
                confidence: { type: 'number' },
                reasoning: { type: 'string' }
            },
            required: ['primary_chapter', 'confidence', 'reasoning'],
            additionalProperties: false
        };

        return { systemPrompt, userPrompt, jsonSchema };
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

    function findMatchingDisambiguationRule(subject, chapA, chapB) {
        const nA = normalizeStr(chapA);
        const nB = normalizeStr(chapB);
        for (const r of DISAMBIGUATION_RULES) {
            const p0 = normalizeStr(r.pair[0]);
            const p1 = normalizeStr(r.pair[1]);
            const matchDirect = (nA === p0 && nB === p1) || (nA === p1 && nB === p0);
            const matchSingle = !nB && (nA === p0 || nA === p1) && (r.subject === subject || r.subject === 'CROSS_SUBJECT');
            if (matchDirect || matchSingle) return r;
        }
        return null;
    }

    // ========================================================================
    // UNIFIED NATIVE VISION REQUEST (SUPPORTS BOTH OLLAMA & LLAMA-SERVER)
    // ========================================================================
    async function callNativeVisionBackend(cleanImageDataUrl, systemPrompt, userPrompt, jsonSchema, genOptions = {}) {
        const base = runtime.detectedUrl || getServerUrl();
        const maxTokens = Number(genOptions.maxTokens) || 260;
        const timeoutMs = Number(genOptions.timeoutMs) || 75000;
        const abortSignal = genOptions.abortSignal || null;

        // 1. OLLAMA NATIVE /api/chat (Strict JSON schema + auto-unload keep_alive + vision base64)
        if (runtime.backendKind === 'ollama') {
            const rawBase64 = cleanImageDataUrl.includes(',')
                ? cleanImageDataUrl.split(',')[1]
                : cleanImageDataUrl;
            const modelName = runtime.loadedServerModelName || 'qwen2.5vl:3b';

            const body = {
                model: modelName,
                stream: false,
                keep_alive: '5m',
                format: jsonSchema || 'json',
                options: {
                    temperature: 0.1,
                    num_ctx: 4096,
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
                    const vErr = `Ollama model "${modelName}" does not support images. In Termux, run once: ollama pull qwen2.5vl:3b`;
                    runtime.fatalBatchError = vErr;
                    throw new Error(vErr);
                }
                throw new Error(`Local Ollama HTTP ${res.status}: ${errTxt || res.statusText}`);
            }

            const data = await res.json();
            return String(data?.message?.content || '');
        }

        // 2. LLAMA-SERVER OPENAI-COMPATIBLE /v1/chat/completions
        const endpoint = `${base}/v1/chat/completions`;
        const buildBody = (formatMode) => {
            const body = {
                model: runtime.loadedServerModelName || 'local-vlm',
                temperature: 0.1,
                top_p: 0.9,
                max_tokens: maxTokens,
                cache_prompt: true,
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
            if (formatMode === 'json_schema' && jsonSchema) {
                body.response_format = {
                    type: 'json_schema',
                    json_schema: { name: 'jee_chapter_result', strict: true, schema: jsonSchema }
                };
            } else if (formatMode === 'json_object') {
                body.response_format = { type: 'json_object' };
            }
            return body;
        };

        const modesToTry = runtime.responseFormatMode === 'json_schema'
            ? ['json_schema', 'json_object', 'none']
            : (runtime.responseFormatMode === 'json_object' ? ['json_object', 'none'] : ['none']);

        let lastErr = null;
        for (const mode of modesToTry) {
            const res = await loopbackFetch(
                endpoint,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildBody(mode)),
                    signal: abortSignal
                },
                timeoutMs
            );

            if (res.ok) {
                runtime.responseFormatMode = mode;
                const data = await res.json();
                return String(data?.choices?.[0]?.message?.content || '');
            }

            const errText = (await res.text().catch(() => '')).slice(0, 320);
            if (/image input is not supported|mmproj|multimodal.*not.*enabled/i.test(errText)) {
                const mmErr = 'llama-server loaded a text-only GGUF (missing mmproj).';
                runtime.fatalBatchError = mmErr;
                throw new Error(mmErr);
            }
            if (res.status === 400 && mode !== 'none') {
                lastErr = new Error(`HTTP 400 (${mode}): ${errText}`);
                continue;
            }
            throw new Error(`Local AI Server HTTP ${res.status}: ${errText || res.statusText}`);
        }
        throw lastErr || new Error('Local AI server request failed');
    }

    // ========================================================================
    // PUBLIC API (100% COMPATIBLE WITH EXISTING index.html CALLS)
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
            recommendedModel: 'qwen3-vl-4b'
        };
    }

    async function loadModel(modelKey = 'qwen3-vl-4b', options = {}) {
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        runtime.fatalBatchError = null;
        runtime.activeModelKey = MODEL_CATALOG[modelKey] ? modelKey : 'qwen3-vl-4b';

        if (onProgress) {
            onProgress({
                stage: 'INIT',
                percent: 15,
                message: 'Connecting to Local Native AI Server (Ollama / llama-server)...'
            });
        }

        try {
            const health = await checkServerHealth({
                modelKey: runtime.activeModelKey,
                onProgress,
                abortSignal: options.abortSignal,
                maxWaitLoadingMs: options.maxWaitLoadingMs ?? 90000
            });

            const label = health.kind === 'ollama' ? 'NATIVE-OLLAMA' : 'NATIVE-LLAMA';
            if (onProgress) {
                onProgress({
                    stage: 'READY',
                    percent: 100,
                    message: `Connected to ${label}: ${health.modelName} ✓`
                });
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
    }

    async function classifyQuestionImage(imageSource, options = {}) {
        const startedAt = performance.now();
        const modelKey = options.modelKey || runtime.activeModelKey || 'qwen3-vl-4b';
        const enableTieBreaker = options.enableTieBreaker ?? true;
        const reviewConfidenceThreshold = Number(options.reviewConfidenceThreshold ?? 0.80);
        const timeoutMs = Number(options.timeoutMs ?? 75000);

        if (runtime.fatalBatchError && !options.retryAfterFatal) {
            throw new Error(runtime.fatalBatchError);
        }

        if (!runtime.serverReady) {
            await loadModel(modelKey, { onProgress: options.onProgress, abortSignal: options.abortSignal });
        }

        const spec = MODEL_CATALOG[modelKey] || MODEL_CATALOG['qwen3-vl-4b'];
        const cleanImageDataUrl = await prepareCleanQuestionImageForVLM(imageSource, spec.maxImageEdge || 840);
        const deviceLabel = runtime.backendKind === 'ollama' ? 'NATIVE-OLLAMA' : 'NATIVE-LLAMA';

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

        // PASS 1: Full-Resolution Native ARM64 Multimodal Diagram + Concept ID
        updateLiveSubText(`Native AI [${runtime.loadedServerModelName || 'ARM64'}]: inspecting diagram & concepts...`);
        const { systemPrompt, userPrompt, jsonSchema } = buildPass1Prompts(options);
        const rawPass1 = await callNativeVisionBackend(cleanImageDataUrl, systemPrompt, userPrompt, jsonSchema, {
            maxTokens: 260,
            timeoutMs,
            abortSignal: options.abortSignal
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

        const diagramSummary = String(p1?.diagram_summary || '').trim() || 'None';
        const auxiliaryConcepts = Array.isArray(p1?.auxiliary_concepts) ? p1.auxiliary_concepts : [];
        let reasoning = String(p1?.reasoning || '').trim();
        let tieBreakerUsed = false;

        // PASS 2: Adversarial Tie-Breaker on Known JEE Overlaps (WPE vs RBD, NLM vs SHM...)
        const overlapRule = findMatchingDisambiguationRule(
            finalSubject,
            finalChapter,
            secondaryChapter || auxiliaryConcepts[0] || ''
        );

        const shouldRunTieBreaker = enableTieBreaker && (
            confidence < 0.86 ||
            Boolean(overlapRule) ||
            !canonPrimary.exactMatch
        );

        if (shouldRunTieBreaker) {
            const candidateSet = new Set([finalChapter]);
            if (secondaryChapter) candidateSet.add(secondaryChapter);
            if (overlapRule && overlapRule.subject === finalSubject) {
                candidateSet.add(overlapRule.pair[0]);
                candidateSet.add(overlapRule.pair[1]);
            }
            for (const aux of auxiliaryConcepts.slice(0, 2)) {
                const cAux = resolveCanonicalChapter(finalSubject, aux);
                if (cAux.subject === finalSubject && cAux.exactMatch) candidateSet.add(cAux.chapter);
            }

            const candidates = Array.from(candidateSet).filter(Boolean).slice(0, 4);
            if (candidates.length >= 2) {
                tieBreakerUsed = true;
                updateLiveSubText(`Native AI: running Pass-2 tie-breaker (${candidates.join(' vs ')})...`);
                const tb = buildTieBreakerPrompts(
                    { subject: finalSubject, chapter: finalChapter, secondaryChapter, diagramSummary, reasoning },
                    candidates,
                    overlapRule?.rule || ''
                );
                try {
                    const rawPass2 = await callNativeVisionBackend(cleanImageDataUrl, tb.systemPrompt, tb.userPrompt, tb.jsonSchema, {
                        maxTokens: 160,
                        timeoutMs: Math.round(timeoutMs * 0.8),
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
            auxiliaryConcepts,
            diagramSummary,
            reasoning: reasoning || `Classified visually by ${runtime.loadedServerModelName || 'local native AI'}.`,
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
        const modelKey = options.modelKey || runtime.activeModelKey || 'qwen3-vl-4b';
        await loadModel(modelKey, { onProgress: options.onLoadProgress, abortSignal });

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
