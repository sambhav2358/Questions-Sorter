/**
 * ============================================================================
 * JEE ON-DEVICE VISION-LANGUAGE MODEL (VLM) CHAPTER CLASSIFIER
 * File Name for GitHub: local-vlm-classifier.js
 * Version: 1.3.0 (Full Adreno 750 Subgroups Hide + Plain WASM GatherBlockQuantized Fix + OOM Circuit-Breaker)
 * ============================================================================
 * Runs a REAL multimodal Vision-Language AI Model (Qwen 3.5 VL / Gemma 4 E2B)
 * 100% locally on your tablet's GPU via WebGPU (Snapdragon 8 Gen 3 Adreno 750)
 * using Hugging Face Transformers.js v4 (@huggingface/transformers).
 *
 * ZERO Gemini API calls. ZERO keyword/OCR heuristics.
 * The neural vision encoder directly inspects the question image (diagrams,
 * pulleys, rolling bodies, organic rings, coordinate axes, equations, tables)
 * and reasons step-by-step about the PRIMARY governing JEE chapter vs.
 * auxiliary mathematical/physical tools (e.g., WPE used inside a Rigid Body
 * Mechanics problem -> classified as Rigid Body Mechanics).
 *
 * First run downloads quantized ONNX weights into the browser's permanent
 * Cache API / IndexedDB; every subsequent session runs 100% offline.
 *
 * Public Global API: window.JEELocalVLMClassifier
 *   await JEELocalVLMClassifier.loadModel('qwen3.5-2b', { onProgress })
 *   const res = await JEELocalVLMClassifier.classifyQuestionImage(dataUrl, {
 *       subjectHint: 'Physics', // optional lock if section banner known
 *       enableThinking: true,
 *       enableTieBreaker: true
 *   });
 *   // res => { subject, chapter, secondaryChapter, confidence, needsReview,
 *   //          diagramSummary, reasoning, elapsedMs, modelId, tieBreakerUsed }
 * ============================================================================
 */
(function (globalScope) {
    'use strict';

    const ENGINE_VERSION = '1.3.0';
    const TRANSFORMERS_CDN_CANDIDATES = [
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js',
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/+esm',
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4/dist/transformers.min.js'
    ];
    const USER_CORRECTIONS_KEY = 'jee_vlm_fewshot_memory_v1';
    const FORCE_WASM_STORAGE_KEY = 'jee_vlm_force_wasm_v1';

    // ========================================================================
    // VERIFIED ON-DEVICE MULTIMODAL MODELS (Transformers.js v4 + WebGPU)
    // ========================================================================
    const MODEL_CATALOG = {
        'qwen3.5-2b': {
            id: 'onnx-community/Qwen3.5-2B-ONNX',
            family: 'qwen3_5',
            label: 'Qwen 3.5 2B Vision (Recommended • Best Speed/Accuracy for 8 Gen 3)',
            approxDownloadMB: 1550,
            defaultDtype: {
                embed_tokens: 'q4',
                vision_encoder: 'q4',
                decoder_model_merged: 'q4'
            },
            supportsThinking: true,
            maxImageEdge: 896
        },
        'gemma-4-e2b': {
            id: 'onnx-community/gemma-4-E2B-it-ONNX',
            family: 'gemma4',
            label: 'Google Gemma 4 E2B Multimodal (Strong Diagram & Thinking)',
            approxDownloadMB: 2100,
            defaultDtype: 'q4f16',
            supportsThinking: true,
            maxImageEdge: 768
        },
        'qwen3.5-4b': {
            id: 'onnx-community/Qwen3.5-4B-ONNX',
            family: 'qwen3_5',
            label: 'Qwen 3.5 4B Vision (Max STEM Accuracy • Needs 12GB+ RAM)',
            approxDownloadMB: 3150,
            defaultDtype: {
                embed_tokens: 'q4',
                vision_encoder: 'q4',
                decoder_model_merged: 'q4'
            },
            supportsThinking: true,
            maxImageEdge: 960
        },
        'qwen3.5-0.8b': {
            id: 'onnx-community/Qwen3.5-0.8B-ONNX',
            family: 'qwen3_5',
            label: 'Qwen 3.5 0.8B Vision (Ultra-Fast Lightweight • ~800 MB)',
            approxDownloadMB: 810,
            defaultDtype: {
                embed_tokens: 'q4',
                vision_encoder: 'q4',
                decoder_model_merged: 'q4'
            },
            supportsThinking: true,
            maxImageEdge: 768
        }
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

    // Preferred canonical list presented to the VLM (avoids confusing duplicate names like
    // "Rigid Body Mechanics" vs "Rotational Mechanics", while preserving full compatibility)
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
    // HIGH-CONFUSION JEE OVERLAP BOUNDARY RULES (Used in Both Pass 1 & Pass 2)
    // Solves multi-concept questions like "uses WPE, actually Rigid Body Mechanics"
    // ========================================================================
    const DISAMBIGUATION_RULES = [
        {
            pair: ['Work, Power and Energy', 'Rigid Body Mechanics'],
            subject: 'Physics',
            rule: 'If the body has finite size/geometry (rod, disc, ring, sphere, cylinder, pulley with mass) AND rotates, rolls, pivots about a hinge, or requires moment of inertia (I) or torque, the PRIMARY chapter is ALWAYS "Rigid Body Mechanics" — even if energy conservation (WPE) is used as a tool to solve it. Choose "Work, Power and Energy" ONLY for point-mass / translating block-spring problems without rotational inertia.'
        },
        {
            pair: ['COM, Momentum and Collision', 'Rigid Body Mechanics'],
            subject: 'Physics',
            rule: 'If a collision involves an extended rigid body (rod, disc, sphere) rotating or acquiring angular velocity/angular impulse about a pivot or CM, choose "Rigid Body Mechanics". Choose "COM, Momentum and Collision" for translational collisions, variable mass, or pure center-of-mass motion.'
        },
        {
            pair: ['Work, Power and Energy', 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'If the question asks for time period (T), angular frequency (omega), amplitude of oscillation, phase, or small oscillations about equilibrium (even with springs, collisions, or energy calculations), the PRIMARY chapter is "Simple Harmonic Motion".'
        },
        {
            pair: ["Newton's Laws of Motion", 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'If springs/pulleys/blocks are oscillating or the question asks for maximum amplitude without slipping, time period, or SHM conditions, choose "Simple Harmonic Motion". Choose "Newton\'s Laws of Motion" for non-oscillatory acceleration, tension, or static/kinetic friction equilibrium.'
        },
        {
            pair: ['Rigid Body Mechanics', 'Simple Harmonic Motion'],
            subject: 'Physics',
            rule: 'If a hinged rod, uniform disc, or ring performs SMALL OSCILLATIONS and the question asks for its time period T, angular frequency, or SHM energy/minimum period (compound/physical pendulum), choose "Simple Harmonic Motion". If it rotates through large angles (e.g. 90 deg fall) or rolls down an incline without asking for oscillation period, choose "Rigid Body Mechanics".'
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
            rule: 'Physics Thermodynamics focuses on P-V diagrams, piston-cylinder, heat engines, Carnot cycles, and gas work. Chemistry Thermodynamics focuses on enthalpy of formation/combustion/neutralization, Hess law, bond enthalpies, Gibbs free energy of chemical reactions, and kJ/mol.'
        },
        {
            pair: ['Atomic Structure', 'Modern Physics & Semiconductors'],
            subject: 'CROSS_SUBJECT',
            rule: 'Quantum numbers (n, l, m, s), radial/angular nodes, wavefunctions psi, orbitals, Aufbau/Hund rules, and electronic configuration belong to Chemistry "Atomic Structure". Photoelectric effect, nuclear decay/binding energy, X-rays, and diodes/transistors/logic gates belong to Physics "Modern Physics & Semiconductors".'
        },
        {
            pair: ['GOC-I', 'Stereochemistry'],
            subject: 'Chemistry',
            rule: 'If the core task asks about cis/trans, E/Z, R/S, chiral centers, enantiomers, diastereomers, meso compounds, optical activity, geometrical isomers, or conformational isomers (Newman/chair/gauche/dipole of conformers), choose "Stereochemistry". If it asks about resonance/mesomeric/inductive effects, hyperconjugation, aromaticity/antiaromaticity, acid/base strength, tautomerism, or structural/constitutional isomers, choose "GOC-I".'
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
            rule: 'If the central object is one or more circles (tangents to a circle, chord of contact, radical axis, orthogonal circles, director circle, family of circles, common tangents, locus w.r.t. a circle), the PRIMARY chapter is ALWAYS "Circles" — even if straight-line formulas like slope, angle bisector, or foot of perpendicular are used as tools inside the solution!'
        },
        {
            pair: ['Circles', 'Parabola'],
            subject: 'Mathematics',
            rule: 'Identify which conic carries the primary theorem/property being tested. If a circle is auxiliary to a parabola focal chord/normal/tangent problem, choose "Parabola"; if parabola/line intersects a circle to test circle geometry, choose "Circles".'
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
    // RUNTIME STATE
    // ========================================================================
    const runtime = {
        tf: null,
        activeModelKey: null,
        activeModelSpec: null,
        processor: null,
        model: null,
        deviceUsed: null,
        ortWasmFlavor: null, // 'asyncify' (WebGPU) | 'plain' (CPU WASM w/ GatherBlockQuantized)
        isLoading: false,
        isBusy: false,
        webgpuFailed: (typeof localStorage !== 'undefined' && localStorage.getItem(FORCE_WASM_STORAGE_KEY) === '1'),
        fatalLoadError: null,
        loadPromise: null
    };

    // ========================================================================
    // ADRENO 7xx (SNAPDRAGON 8 GEN 3) WEBGPU SUBGROUPS CRASH PATCH
    // ========================================================================
    // On Snapdragon 8 Gen 3 (Adreno 750), ONNX Runtime Web's 4-bit MatMulNBits
    // kernel emits `subgroupShuffle(...)` when the WebGPU device has `subgroups`
    // enabled, triggering a SIGSEGV in Qualcomm's shader compiler (libllvm-qgl.so)
    // that kills Chrome's GPU process with:
    //   "Failed to create a WebGPU compute pipeline: A valid external Instance
    //    reference no longer exists."
    // Stripping `subgroups` from GPUAdapter.prototype.requestDevice forces ORT
    // Web onto its stable shared-memory WebGPU compute shader path!
    let adrenoSubgroupsPatchInstalled = false;
    function isAdrenoOrAndroidAdapter(adapterObj) {
        const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
        const vendor = String(adapterObj?.info?.vendor || '').toLowerCase();
        const arch = String(adapterObj?.info?.architecture || '').toLowerCase();
        return isAndroid || vendor.includes('qualcomm') || arch.includes('adreno');
    }

    function filterSubgroupFeaturesSet(origFeatures) {
        const clean = new Set();
        try {
            for (const f of origFeatures) {
                if (f !== 'subgroups' && f !== 'subgroups-f16') clean.add(f);
            }
        } catch (_) {}
        return clean;
    }

    function installAdrenoWebGpuSubgroupsPatch() {
        if (adrenoSubgroupsPatchInstalled) return;
        if (typeof globalScope === 'undefined' || !globalScope.GPUAdapter || !globalScope.GPUAdapter.prototype) return;

        // 1. Hide `subgroups` from GPUAdapter.prototype.features so ONNX Runtime Web never requests or compiles subgroupShuffle
        try {
            const featDesc = Object.getOwnPropertyDescriptor(globalScope.GPUAdapter.prototype, 'features');
            if (featDesc && typeof featDesc.get === 'function' && featDesc.configurable) {
                const origFeaturesGetter = featDesc.get;
                Object.defineProperty(globalScope.GPUAdapter.prototype, 'features', {
                    configurable: true,
                    enumerable: featDesc.enumerable,
                    get() {
                        const raw = origFeaturesGetter.call(this);
                        if (isAdrenoOrAndroidAdapter(this)) {
                            return filterSubgroupFeaturesSet(raw);
                        }
                        return raw;
                    }
                });
            }
        } catch (_) {}

        // 2. Also hide `subgroups` from GPUDevice.prototype.features as belt-and-suspenders
        try {
            if (globalScope.GPUDevice && globalScope.GPUDevice.prototype) {
                const devFeatDesc = Object.getOwnPropertyDescriptor(globalScope.GPUDevice.prototype, 'features');
                if (devFeatDesc && typeof devFeatDesc.get === 'function' && devFeatDesc.configurable) {
                    const origDevFeatGetter = devFeatDesc.get;
                    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
                    Object.defineProperty(globalScope.GPUDevice.prototype, 'features', {
                        configurable: true,
                        enumerable: devFeatDesc.enumerable,
                        get() {
                            const raw = origDevFeatGetter.call(this);
                            return isAndroid ? filterSubgroupFeaturesSet(raw) : raw;
                        }
                    });
                }
            }
        } catch (_) {}

        // 3. Strip `subgroups` from GPUAdapter.prototype.requestDevice requiredFeatures
        const origRequestDevice = globalScope.GPUAdapter.prototype.requestDevice;
        if (typeof origRequestDevice === 'function') {
            globalScope.GPUAdapter.prototype.requestDevice = function patchedRequestDevice(descriptor) {
                if (isAdrenoOrAndroidAdapter(this) && descriptor && descriptor.requiredFeatures) {
                    const filtered = Array.from(descriptor.requiredFeatures).filter(
                        f => f !== 'subgroups' && f !== 'subgroups-f16'
                    );
                    return origRequestDevice.call(this, { ...descriptor, requiredFeatures: filtered });
                }
                return origRequestDevice.call(this, descriptor);
            };
        }

        adrenoSubgroupsPatchInstalled = true;
    }
    // Install immediately before Transformers.js / ONNX Runtime Web touches WebGPU
    installAdrenoWebGpuSubgroupsPatch();

    // ========================================================================
    // HARDWARE CAPABILITY & WEBGPU CHECK
    // ========================================================================
    async function inspectDeviceCapabilities() {
        const hasWebGPU = typeof navigator !== 'undefined' && Boolean(navigator.gpu);
        let gpuAdapterInfo = null;
        let webgpuAvailable = false;
        let supportsFp16 = false;

        if (hasWebGPU) {
            try {
                const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
                if (adapter) {
                    webgpuAvailable = true;
                    supportsFp16 = Boolean(adapter.features && adapter.features.has('shader-f16'));
                    gpuAdapterInfo = adapter.info || (typeof adapter.requestAdapterInfo === 'function' ? await adapter.requestAdapterInfo().catch(() => null) : null);
                }
            } catch (_) {
                webgpuAvailable = false;
            }
        }

        const deviceMemoryGB = (typeof navigator !== 'undefined' && navigator.deviceMemory) ? navigator.deviceMemory : null;
        const isSecureContext = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : true;

        return {
            webgpuAvailable,
            supportsFp16,
            isSecureContext,
            deviceMemoryGB,
            gpuVendor: gpuAdapterInfo?.vendor || 'Unknown',
            gpuArchitecture: gpuAdapterInfo?.architecture || 'Unknown',
            recommendedModel: ((deviceMemoryGB && deviceMemoryGB < 6) || runtime.webgpuFailed) ? 'qwen3.5-0.8b' : 'qwen3.5-2b'
        };
    }

    // ========================================================================
    // HIGH-CONTRAST IMAGE PREPROCESSOR FOR VISION ENCODER
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

        // Add slight white padding around cropped edges so diagrams/text at borders are cleanly seen by ViT patches
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

        return canvas.toDataURL('image/png');
    }

    // ========================================================================
    // FEW-SHOT USER CORRECTION MEMORY (Adaptive On-Device Alignment)
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
        try {
            localStorage.setItem(USER_CORRECTIONS_KEY, JSON.stringify(list.slice(0, 24)));
        } catch (_) {}
    }

    // ========================================================================
    // PROMPT BUILDERS (PASS 1: DEEP VISUAL ANALYSIS, PASS 2: TIE-BREAKER)
    // ========================================================================
    function buildPass1Prompts(options = {}) {
        const subjectLock = ['Physics', 'Chemistry', 'Mathematics'].includes(options.subjectHint)
            ? options.subjectHint
            : null;

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

        const systemPrompt = `You are a senior IIT-JEE Advanced Physics, Chemistry, and Mathematics faculty examiner.
Your ONLY job is to inspect the question image (including EVERY diagram, circuit, pulley, rolling rigid body, spring, organic molecule, reaction arrow, graph, table, and equation) and identify the SINGLE PRIMARY SYLLABUS CHAPTER that the question fundamentally tests.

CRITICAL PRINCIPLE — PRIMARY CHAPTER VS. AUXILIARY TOOL:
JEE Advanced questions frequently use concepts from one chapter as a mathematical/physical tool inside another chapter (for example, using Work-Energy Theorem inside a Rigid Body Mechanics rolling/hinged-rod problem, or using straight-line slope/angle-bisector inside a Circles problem, or using energy conservation inside an SHM oscillation problem).
You MUST classify by the PRIMARY GOVERNING SYSTEM AND CORE CONCEPT BEING TESTED — NEVER by an auxiliary tool!

KEY JEE DISAMBIGUATION RULES:
${relevantRules}
${feedbackSection}
ALLOWED CHAPTER NAMES (You MUST pick an EXACT string from this list):
${chapterBlock}

OUTPUT FORMAT:
Return ONLY valid JSON with these exact keys (no markdown fences, no extra text outside JSON):
{
  "diagram_summary": "concise description of any figure/graph/molecule/table in the image, or 'None'",
  "governing_system": "what physical/chemical/math system is being analyzed",
  "primary_concept": "the core law or theorem being tested",
  "auxiliary_concepts": ["any secondary tools used, e.g. Work, Power and Energy"],
  "subject": "Physics" | "Chemistry" | "Mathematics",
  "primary_chapter": "EXACT chapter name from the allowed list",
  "secondary_chapter": "second most plausible chapter from the allowed list, or empty string",
  "confidence": 0.0 to 1.0,
  "reasoning": "1-2 sentences explaining why primary_chapter beats secondary_chapter"
}`;

        const contextHints = [];
        if (subjectLock) contextHints.push(`Known paper section subject: ${subjectLock}.`);
        if (options.paperName) contextHints.push(`Paper/Sheet name (context only, do not blindly trust on mixed tests): "${options.paperName}".`);
        if (options.ocrTextHint && options.ocrTextHint.length > 12) {
            contextHints.push(`Auxiliary extracted text (trust the IMAGE first if any equation/diagram differs): "${options.ocrTextHint.slice(0, 420)}"`);
        }

        const userPrompt = `Carefully examine the entire question image, including all diagrams, symbols, structures, and options.
${contextHints.join('\n')}
Determine the exact Subject and PRIMARY JEE Chapter. Output strictly valid JSON.`;

        return { systemPrompt, userPrompt };
    }

    function buildTieBreakerPrompts(pass1Result, candidateChapters, specificRuleText = '') {
        const subject = pass1Result.subject;
        const candList = candidateChapters.map((c, i) => `${i + 1}. "${c}"`).join('\n');

        const systemPrompt = `You are a senior IIT-JEE Chief Paper Setter acting as a strict referee between competing syllabus chapters.
Your task is to re-examine the question image carefully and decide WHICH ONE of the candidate chapters below is the TRUE PRIMARY CHAPTER.

CANDIDATE CHAPTERS (${subject}):
${candList}

REFEREE DISAMBIGUATION RULE:
${specificRuleText || 'Distinguish carefully between the PRIMARY governing physical/chemical/mathematical topic vs. an auxiliary formula or technique used mid-calculation.'}

Return ONLY valid JSON:
{
  "primary_chapter": "EXACT winning chapter name from the candidate list above",
  "confidence": 0.0 to 1.0,
  "reasoning": "1-2 crisp sentences explaining the decisive visual/conceptual proof"
}`;

        const userPrompt = `Initial analysis observed:
- Diagram: ${pass1Result.diagramSummary || 'None'}
- Initial pick: "${pass1Result.chapter}" vs alternative: "${pass1Result.secondaryChapter || 'None'}"
- Initial reasoning: ${pass1Result.reasoning || ''}

Re-inspect the question image closely and pick the single TRUE primary chapter from the candidates. Output strictly valid JSON.`;

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

        // Alias normalization for common JEE abbreviations
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
            'friction': { subject: 'Physics', chapter: "Newton's Laws of Motion" },
            'shm': { subject: 'Physics', chapter: 'Simple Harmonic Motion' },
            'oscillations': { subject: 'Physics', chapter: 'Simple Harmonic Motion' },
            'com': { subject: 'Physics', chapter: 'COM, Momentum and Collision' },
            'center of mass': { subject: 'Physics', chapter: 'COM, Momentum and Collision' },
            'centre of mass': { subject: 'Physics', chapter: 'COM, Momentum and Collision' },
            'collisions': { subject: 'Physics', chapter: 'COM, Momentum and Collision' },
            'ktg': { subject: 'Physics', chapter: 'Kinetic Theory of Gases' },
            'electrostatics': { subject: 'Physics', chapter: 'Electrostatics & Capacitors' },
            'capacitors': { subject: 'Physics', chapter: 'Electrostatics & Capacitors' },
            'magnetism': { subject: 'Physics', chapter: 'Moving Charges & Magnetism' },
            'emi': { subject: 'Physics', chapter: 'EMI & Alternating Current' },
            'ac': { subject: 'Physics', chapter: 'EMI & Alternating Current' },
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
            'chemical kinetics': { subject: 'Chemistry', chapter: 'Electrochemistry & Kinetics' },
            'electrochemistry': { subject: 'Chemistry', chapter: 'Electrochemistry & Kinetics' },
            'solutions': { subject: 'Chemistry', chapter: 'Solutions & Colligative Properties' },
            'pnc': { subject: 'Mathematics', chapter: 'Permutations and Combinations' },
            'p c': { subject: 'Mathematics', chapter: 'Permutations and Combinations' },
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

        // 1. Exact case-insensitive match
        for (const s of searchSubjects) {
            for (const c of JEE_CHAPTERS[s]) {
                if (normalizeStr(c) === targetNorm) {
                    return { subject: s, chapter: c, exactMatch: true };
                }
            }
        }

        // 2. Token-overlap fuzzy match (strongly preferring the predicted subject)
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
                if (!best || score > best.score) {
                    best = { subject: s, chapter: c, score };
                }
            }
        }

        if (best && best.score >= 0.35) {
            return { subject: best.subject, chapter: best.chapter, exactMatch: false };
        }
        const fallbackSubj = subject || 'Physics';
        return { subject: fallbackSubj, chapter: PRIMARY_PROMPT_CHAPTERS[fallbackSubj][0], exactMatch: false };
    }

    function extractJsonFromModelOutput(rawText) {
        let cleaned = String(rawText || '').trim();
        // Strip <think>...</think> or Gemma thought blocks while keeping them for diagnostics
        let thinkingTrace = '';
        const thinkMatch = cleaned.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
            thinkingTrace = thinkMatch[1].trim();
            cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        }
        // Strip Gemma 4 thought tokens if present
        const gemmaThought = cleaned.match(/<\|thought\|>([\s\S]*?)<\|\/thought\|>/i);
        if (gemmaThought) {
            thinkingTrace = gemmaThought[1].trim();
            cleaned = cleaned.replace(/<\|thought\|>[\s\S]*?<\|\/thought\|>/gi, '').trim();
        }

        // Strip markdown ```json fences
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        // Extract outermost JSON object
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            const slice = cleaned.slice(firstBrace, lastBrace + 1);
            try {
                return { parsed: JSON.parse(slice), thinkingTrace, rawCleaned: cleaned };
            } catch (_) {
                // Attempt minor trailing-comma / newline repair
                try {
                    const repaired = slice
                        .replace(/,\s*}/g, '}')
                        .replace(/,\s*]/g, ']')
                        .replace(/[\r\n]+/g, ' ');
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
    // MODEL LOADER & RAW MULTIMODAL INFERENCE RUNNER (Transformers.js v4)
    // ========================================================================
    async function ensureTransformersLoaded() {
        if (runtime.tf) return runtime.tf;
        let lastErr = null;
        for (const url of TRANSFORMERS_CDN_CANDIDATES) {
            try {
                const mod = await import(url);
                if (mod && (mod.AutoProcessor || mod.AutoModelForImageTextToText)) {
                    runtime.tf = mod;
                    if (runtime.tf.env) {
                        runtime.tf.env.allowLocalModels = false;
                        runtime.tf.env.useBrowserCache = true;
                    }
                    return runtime.tf;
                }
            } catch (e) {
                lastErr = e;
            }
        }
        throw new Error(`Could not load Transformers.js v4 browser bundle (${lastErr?.message || 'network/module error'})`);
    }

    async function loadModel(modelKey = 'qwen3.5-2b', options = {}) {
        const spec = MODEL_CATALOG[modelKey] || MODEL_CATALOG['qwen3.5-2b'];
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

        installAdrenoWebGpuSubgroupsPatch();
        const wantWasm = Boolean(options.forceWasm || runtime.webgpuFailed);
        if (runtime.model && runtime.processor && runtime.activeModelKey === modelKey && (!wantWasm || runtime.deviceUsed === 'wasm')) {
            return {
                modelKey,
                modelId: spec.id,
                device: runtime.deviceUsed,
                cached: true
            };
        }

        if (runtime.isLoading && runtime.loadPromise) {
            return runtime.loadPromise;
        }

        runtime.fatalLoadError = null;
        runtime.isLoading = true;
        runtime.loadPromise = (async () => {
            try {
                await unloadModel();

                if (onProgress) onProgress({ stage: 'INIT', percent: 2, message: 'Checking Snapdragon WebGPU support...' });
                const caps = await inspectDeviceCapabilities();
                const device = (options.forceWasm || runtime.webgpuFailed || !caps.webgpuAvailable) ? 'wasm' : 'webgpu';

                if (onProgress) {
                    onProgress({
                        stage: 'RUNTIME',
                        percent: 5,
                        message: `Loading Transformers.js v4 (${device.toUpperCase()} backend)...`
                    });
                }
                const tf = await ensureTransformersLoaded();

                // CRITICAL: Configure ONNX Runtime WebAssembly binary BEFORE first session creation!
                // Transformers.js 4.3.x defaults to `ort-wasm-simd-threaded.asyncify.wasm` (for WebGPU),
                // which OMITS the CPU kernel for `GatherBlockQuantized(1)`.
                // When running on CPU WASM, we MUST point wasmPaths to the plain `ort-wasm-simd-threaded.{mjs,wasm}` build!
                if (device === 'wasm') {
                    if (runtime.ortWasmFlavor === 'asyncify') {
                        throw new Error(
                            'WebGPU crashed on Adreno GPU. Saved Stable CPU WASM mode for this tablet — please refresh the page once and re-run!'
                        );
                    }
                    const ortBackend = tf.env?.backends?.onnx;
                    const ortVer = ortBackend?.versions?.web;
                    if (ortBackend && ortBackend.wasm && ortVer) {
                        const dist = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVer}/dist/`;
                        ortBackend.wasm.wasmPaths = {
                            mjs: `${dist}ort-wasm-simd-threaded.mjs`,
                            wasm: `${dist}ort-wasm-simd-threaded.wasm`
                        };
                    }
                    runtime.ortWasmFlavor = 'plain';
                } else {
                    if (runtime.ortWasmFlavor === null) {
                        runtime.ortWasmFlavor = 'asyncify';
                    }
                }

                const fileProgressMap = new Map();
                const emitDownloadProgress = (info) => {
                    if (!onProgress || !info) return;
                    if (info.file && typeof info.loaded === 'number' && typeof info.total === 'number' && info.total > 0) {
                        fileProgressMap.set(info.file, { loaded: info.loaded, total: info.total });
                        let sumL = 0, sumT = 0;
                        for (const v of fileProgressMap.values()) { sumL += v.loaded; sumT += v.total; }
                        const pct = Math.min(96, Math.max(8, Math.round((sumL / Math.max(1, sumT)) * 90) + 6));
                        const mbL = (sumL / (1024 * 1024)).toFixed(0);
                        const mbT = (sumT / (1024 * 1024)).toFixed(0);
                        onProgress({
                            stage: 'DOWNLOAD',
                            percent: pct,
                            file: info.file,
                            message: `Loading ${spec.id.split('/')[1]}: ${mbL} MB / ${mbT} MB (${pct}%)`
                        });
                    } else if (info.status) {
                        onProgress({
                            stage: 'LOAD',
                            percent: Math.min(98, typeof info.progress === 'number' ? Math.round(info.progress) : 10),
                            file: info.file || '',
                            message: `${info.status}${info.file ? `: ${info.file}` : ''}`
                        });
                    }
                };

                if (onProgress) onProgress({ stage: 'PROCESSOR', percent: 8, message: `Loading multimodal processor for ${spec.id}...` });
                const processor = await tf.AutoProcessor.from_pretrained(spec.id, {
                    progress_callback: emitDownloadProgress
                });

                // Pick dedicated architecture class when available, falling back cleanly to AutoModelForImageTextToText
                let ModelClass = tf.AutoModelForImageTextToText;
                if (spec.family === 'gemma4' && tf.Gemma4ForConditionalGeneration) {
                    ModelClass = tf.Gemma4ForConditionalGeneration;
                } else if (spec.family === 'qwen3_5' && tf.Qwen3_5ForConditionalGeneration) {
                    ModelClass = tf.Qwen3_5ForConditionalGeneration;
                }

                const isAndroidDevice = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
                let dtype = options.dtype || (device === 'wasm' ? 'q4' : spec.defaultDtype);
                if (device === 'webgpu' && (!caps.supportsFp16 || isAndroidDevice)) {
                    dtype = spec.family === 'qwen3_5'
                        ? { embed_tokens: 'q4', vision_encoder: 'q4', decoder_model_merged: 'q4' }
                        : 'q4';
                }
                const model = await ModelClass.from_pretrained(spec.id, {
                    dtype,
                    device,
                    progress_callback: emitDownloadProgress
                });

                runtime.activeModelKey = modelKey;
                runtime.activeModelSpec = spec;
                runtime.processor = processor;
                runtime.model = model;
                runtime.deviceUsed = device;

                if (onProgress) {
                    onProgress({
                        stage: 'READY',
                        percent: 100,
                        message: `${spec.id.split('/')[1]} ready on ${device.toUpperCase()}!`
                    });
                }

                runtime.fatalLoadError = null;
                return { modelKey, modelId: spec.id, device, cached: false };
            } catch (loadErr) {
                const rawMsg = String(loadErr?.message || loadErr || 'Model load failed');
                const friendlyMsg = /Array buffer allocation failed|out of memory|OOM/i.test(rawMsg)
                    ? `Out of browser memory loading ${spec.id.split('/')[1]} (${rawMsg}). Switch model dropdown to "Qwen 3.5 0.8B Vision" or refresh the tab to free RAM.`
                    : rawMsg;
                runtime.fatalLoadError = friendlyMsg;
                throw new Error(friendlyMsg);
            } finally {
                runtime.isLoading = false;
                runtime.loadPromise = null;
            }
        })();

        return runtime.loadPromise;
    }

    async function unloadModel() {
        try {
            if (runtime.model && typeof runtime.model.dispose === 'function') {
                await runtime.model.dispose();
            }
        } catch (_) {}
        runtime.model = null;
        runtime.processor = null;
        runtime.activeModelKey = null;
        runtime.activeModelSpec = null;
        runtime.deviceUsed = null;
    }

    async function runSingleVLMCall(cleanImageDataUrl, systemPrompt, userPrompt, genOptions = {}) {
        const tf = runtime.tf;
        const processor = runtime.processor;
        const model = runtime.model;
        const spec = runtime.activeModelSpec;
        if (!tf || !processor || !model || !spec) {
            throw new Error('Local VLM is not loaded. Call loadModel() first.');
        }

        const enableThinking = Boolean(genOptions.enableThinking && spec.supportsThinking);
        const maxNewTokens = Number(genOptions.maxNewTokens) || (enableThinking ? 420 : 220);
        const onToken = typeof genOptions.onToken === 'function' ? genOptions.onToken : null;

        const image = typeof tf.load_image === 'function'
            ? await tf.load_image(cleanImageDataUrl)
            : await tf.RawImage.fromURL(cleanImageDataUrl);

        const messages = [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    { type: 'image' },
                    { type: 'text', text: userPrompt }
                ]
            }
        ];

        const templateOpts = {
            tokenize: false,
            add_generation_prompt: true
        };
        if (spec.supportsThinking) {
            templateOpts.enable_thinking = enableThinking;
        }

        const promptText = processor.apply_chat_template(messages, templateOpts);

        // Prepare multimodal tensor inputs (handles both Gemma 4 and Qwen 3.5 processor signatures)
        let inputs;
        if (spec.family === 'gemma4') {
            inputs = await processor(promptText, image, null, { add_special_tokens: false });
        } else {
            inputs = await processor(promptText, image, { add_special_tokens: false });
        }

        let streamed = '';
        const streamer = tf.TextStreamer
            ? new tf.TextStreamer(processor.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (tok) => {
                    streamed += tok;
                    if (onToken) onToken(tok, streamed);
                }
            })
            : undefined;

        const generateArgs = {
            ...inputs,
            max_new_tokens: maxNewTokens,
            do_sample: enableThinking,
            ...(enableThinking ? { temperature: 0.45, top_p: 0.9 } : {}),
            ...(streamer ? { streamer } : {})
        };

        let outputs;
        try {
            outputs = await model.generate(generateArgs);
            const promptLen = inputs.input_ids?.dims?.[1] || 0;
            const trimmed = outputs.slice(null, [promptLen, null]);
            const decodedArr = processor.batch_decode(trimmed, { skip_special_tokens: true });
            const rawOutput = (decodedArr && decodedArr[0]) ? decodedArr[0] : streamed;
            return rawOutput;
        } finally {
            // Aggressively free WebGPU input/output tensors between questions so tablet VRAM never leaks
            try {
                for (const val of Object.values(inputs || {})) {
                    if (val && typeof val.dispose === 'function') val.dispose();
                }
                if (outputs && typeof outputs.dispose === 'function') outputs.dispose();
            } catch (_) {}
        }
    }

    // ========================================================================
    // PUBLIC SINGLE-QUESTION & BATCH VISUAL CLASSIFICATION PIPELINE
    // ========================================================================
    async function classifyQuestionImage(imageSource, options = {}) {
        const startedAt = performance.now();
        const modelKey = options.modelKey || runtime.activeModelKey || 'qwen3.5-2b';
        const enableThinking = options.enableThinking ?? true;
        const enableTieBreaker = options.enableTieBreaker ?? true;
        const reviewConfidenceThreshold = Number(options.reviewConfidenceThreshold ?? 0.80);

        // Circuit-breaker: if model loading already hit a fatal OOM or GPU-lost error in this batch,
        // do NOT re-allocate 1.5GB ArrayBuffers on Q.4, Q.5, Q.6...
        if (!runtime.model && runtime.fatalLoadError && !options.retryAfterFatal) {
            throw new Error(runtime.fatalLoadError);
        }

        if (!runtime.model || runtime.activeModelKey !== modelKey) {
            await loadModel(modelKey, { onProgress: options.onProgress });
        }

        const spec = runtime.activeModelSpec;
        const isAndroidDevice = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
        const safeEdge = isAndroidDevice ? Math.min(672, spec.maxImageEdge || 672) : (spec.maxImageEdge || 896);
        const cleanImageDataUrl = await prepareCleanQuestionImageForVLM(imageSource, safeEdge);

        // --------------------------------------------------------------------
        // PASS 1: Full Multimodal Diagram + Concept Analysis (with GPU-Lost Auto-Recovery)
        // --------------------------------------------------------------------
        const { systemPrompt, userPrompt } = buildPass1Prompts(options);
        let rawPass1;
        try {
            rawPass1 = await runSingleVLMCall(cleanImageDataUrl, systemPrompt, userPrompt, {
                enableThinking,
                maxNewTokens: enableThinking ? 460 : 240,
                onToken: options.onToken
            });
        } catch (gpuErr) {
            const msg = String(gpuErr?.message || gpuErr || '');
            const isWebGpuFatal = runtime.deviceUsed === 'webgpu' && (
                /external Instance reference no longer exists|WebGPU|GPUBuffer|device lost|OrtRun/i.test(msg)
            );
            if (isWebGpuFatal) {
                console.warn('[LocalVLM] WebGPU pipeline crashed on device; latching Stable CPU WASM mode:', msg);
                runtime.webgpuFailed = true;
                try { localStorage.setItem(FORCE_WASM_STORAGE_KEY, '1'); } catch (_) {}
                await unloadModel();
                const hint = 'Adreno WebGPU crashed — switched this tablet to Stable CPU WASM mode automatically. Please reload the page once (so Chrome boots the CPU GatherBlockQuantized runtime) and run again!';
                runtime.fatalLoadError = hint;
                throw new Error(hint);
            }
            throw gpuErr;
        }

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
        let secondaryChapter = (canonSecondary && canonSecondary.chapter !== finalChapter)
            ? canonSecondary.chapter
            : '';
        let confidence = typeof p1?.confidence === 'number'
            ? Math.max(0.1, Math.min(0.99, p1.confidence))
            : (canonPrimary.exactMatch ? 0.78 : 0.55);
        let reasoning = String(p1?.reasoning || '').trim();
        const diagramSummary = String(p1?.diagram_summary || '').trim();
        const auxiliaryConcepts = Array.isArray(p1?.auxiliary_concepts) ? p1.auxiliary_concepts : [];
        let tieBreakerUsed = false;

        // --------------------------------------------------------------------
        // PASS 2: Targeted Adversarial Tie-Breaker for Multi-Concept Overlaps
        // (e.g., WPE vs Rigid Body Mechanics, NLM vs SHM, GOC-I vs Stereo,
        //  Straight Lines vs Circles, OR any low-confidence Pass 1 prediction)
        // --------------------------------------------------------------------
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
                const tbPrompts = buildTieBreakerPrompts(
                    {
                        subject: finalSubject,
                        chapter: finalChapter,
                        secondaryChapter,
                        diagramSummary,
                        reasoning
                    },
                    candidates,
                    overlapRule?.rule || ''
                );

                const rawPass2 = await runSingleVLMCall(cleanImageDataUrl, tbPrompts.systemPrompt, tbPrompts.userPrompt, {
                    enableThinking: false,
                    maxNewTokens: 160
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
                            confidence = Math.max(0.2, Math.min(0.99, (confidence * 0.35) + (p2.confidence * 0.65)));
                        }
                        if (p2.reasoning) {
                            reasoning = String(p2.reasoning).trim();
                        }
                    }
                }
            }
        }

        const elapsedMs = Math.round(performance.now() - startedAt);
        return {
            subject: finalSubject,
            chapter: finalChapter,
            secondaryChapter,
            auxiliaryConcepts,
            diagramSummary,
            reasoning,
            thinkingTrace: think1,
            confidence: Math.round(confidence * 100) / 100,
            needsReview: confidence < reviewConfidenceThreshold || !canonPrimary.exactMatch,
            tieBreakerUsed,
            elapsedMs,
            modelId: spec.id,
            device: runtime.deviceUsed
        };
    }

    /**
     * Classifies a batch of questions sequentially (VRAM-safe for Android tablets)
     * with abort support, live per-question progress callbacks, and manual-review flags.
     */
    async function classifyBatch(questions, options = {}) {
        const list = Array.isArray(questions) ? questions : [];
        const abortSignal = options.abortSignal || null;
        const onItemComplete = typeof options.onItemComplete === 'function' ? options.onItemComplete : null;
        const results = [];

        if (list.length === 0) return results;
        const modelKey = options.modelKey || runtime.activeModelKey || 'qwen3.5-2b';
        await loadModel(modelKey, { onProgress: options.onLoadProgress });

        for (let i = 0; i < list.length; i++) {
            if (abortSignal?.aborted) break;
            const q = list[i];
            const res = await classifyQuestionImage(q.imageDataUrl || q.canvas, {
                modelKey,
                subjectHint: q.subjectOverride || options.subjectHint || null,
                paperName: q.paperName || options.paperName || '',
                ocrTextHint: q.ocrText || '',
                enableThinking: options.enableThinking ?? true,
                enableTieBreaker: options.enableTieBreaker ?? true,
                reviewConfidenceThreshold: options.reviewConfidenceThreshold ?? 0.80
            });

            results.push({ id: q.id, questionNumber: q.questionNumber, ...res });
            if (onItemComplete) {
                onItemComplete({
                    index: i,
                    total: list.length,
                    question: q,
                    result: res
                });
            }

            // Yield a brief frame to keep tablet UI 100% responsive between questions
            await new Promise(r => setTimeout(r, 40));
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
        inspectDeviceCapabilities,
        installAdrenoWebGpuSubgroupsPatch,
        setBackendMode: (mode) => {
            const useWasm = String(mode || '').toLowerCase() === 'wasm';
            runtime.webgpuFailed = useWasm;
            runtime.fatalLoadError = null;
            try {
                if (useWasm) localStorage.setItem(FORCE_WASM_STORAGE_KEY, '1');
                else localStorage.removeItem(FORCE_WASM_STORAGE_KEY);
            } catch (_) {}
        },
        resetWebGpuFallback: () => {
            runtime.webgpuFailed = false;
            runtime.fatalLoadError = null;
            try { localStorage.removeItem(FORCE_WASM_STORAGE_KEY); } catch (_) {}
        },
        loadModel,
        unloadModel,
        isModelReady: () => Boolean(runtime.model && runtime.processor),
        getActiveModelInfo: () => ({
            modelKey: runtime.activeModelKey,
            modelId: runtime.activeModelSpec?.id || null,
            device: runtime.deviceUsed
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
