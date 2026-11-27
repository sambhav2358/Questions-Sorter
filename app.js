/**
 * ============================================================================
 * Material 3 Expressive Question Vault — Core Application Logic (app.js)
 * Version: 3.0.0 (Segregated Architecture)
 * ============================================================================
 * - Borders & Cross-Page Stitching: local-vision-engine.js (v3.0) +
 *   optional local-ai-borders.js (Native Termux llama-server / Ollama)
 * - Chapter Classification: 100% Local Engine (78 JEE chapters + per-subject
 *   coherence + Naive Bayes self-learning from manual corrections)
 * - Answer Keys & 1-Line Hints: Gemini 3.8 Flash / 3.8 Flash Lite (user API)
 * ============================================================================
 */
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

try { indexedDB.deleteDatabase('JEEQuestionVaultDB'); } catch (_) {}

const DEFAULT_GIST_ID = '9259f71c65f635b809f348a7216b6e53';

//Strictly GEMINI 3.8 FLASH (Default) & GEMINI 3.8 FLASH LITE
const GEMINI_MODELS = [
    { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash (Default • High Precision)' },
    { value: 'gemini-3.8-flash-lite', label: 'gemini-3.8-flash-lite (Fast & Lightweight)' }
];

// Force-migrate any old cached model (like hydrogen or 3.5-flash-lite) to gemini-3.8-flash
(function sanitizeStoredModelSelection() {
    const saved = localStorage.getItem('jee_gemini_model');
    if (saved !== 'gemini-3.8-flash' && saved !== 'gemini-3.8-flash-lite') {
        localStorage.setItem('jee_gemini_model', 'gemini-3.8-flash');
    }
})();

function initM3ExpressiveShapes() {
    const makeSoftStarburst = (lobes, innerR, outerR) => {
        const pts = 180;
        let d = '';
        const mid = (outerR + innerR) / 2;
        const amp = (outerR - innerR) / 2;
        for (let i = 0; i <= pts; i++) {
            const a = (i / pts) * Math.PI * 2;
            const r = mid + amp * Math.cos(lobes * a);
            const x = (0.5 + r * Math.cos(a)).toFixed(4);
            const y = (0.5 + r * Math.sin(a)).toFixed(4);
            d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        }
        return d + ' Z';
    };
    const p12 = document.getElementById('m3Cookie12Path');
    const p8 = document.getElementById('m3Clover8Path');
    if (p12) p12.setAttribute('d', makeSoftStarburst(12, 0.448, 0.495));
    if (p8) p8.setAttribute('d', makeSoftStarburst(8, 0.445, 0.495));
}

const M3_MORPH_SHAPES = [
    (a) => 0.84 + 0.11 * Math.cos(5 * a) - 0.02 * Math.cos(10 * a),
    (a) => 0.87 + 0.068 * Math.cos(9 * a),
    (a) => 0.92 - 0.24 * Math.pow(Math.abs(Math.cos(2 * a)), 2.8),
    (a) => 0.83 + 0.13 * Math.cos(12 * a),
    (a) => 0.86 + 0.078 * Math.cos(8 * a),
    () => 0.89
];

let m3MorphAnimId = null;
let m3MorphActive = false;

function computeMorphPathD(shapeIdxA, shapeIdxB, morphT, rotRad) {
    const fnA = M3_MORPH_SHAPES[shapeIdxA];
    const fnB = M3_MORPH_SHAPES[shapeIdxB];
    const steps = 96;
    const maxR = 10.6;
    let d = '';
    for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const localA = theta - rotRad;
        const rNorm = fnA(localA) * (1 - morphT) + fnB(localA) * morphT;
        const r = maxR * rNorm;
        const x = (12 + r * Math.cos(theta)).toFixed(2);
        const y = (12 + r * Math.sin(theta)).toFixed(2);
        d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    return d + ' Z';
}

function stepM3MorphLoader(now) {
    const isWbLoading = !document.getElementById('wbLoadingBadge')?.classList.contains('hidden');
    const isMinUpload = !document.getElementById('minimizedUploadBar')?.classList.contains('hidden');
    const isMinSolver = !document.getElementById('minimizedSolverBar')?.classList.contains('hidden');
    const isUpProg = !document.getElementById('uploadProgressView')?.classList.contains('hidden');
    const isSolvSpin = !document.getElementById('solverModalSpinner')?.classList.contains('hidden');

    if (!m3MorphActive && !isWbLoading && !isMinUpload && !isMinSolver && !isUpProg && !isSolvSpin) {
        m3MorphAnimId = null;
        return;
    }

    const beatDuration = 720;
    const totalBeats = now / beatDuration;
    const beatIndex = Math.floor(totalBeats);
    const rawFrac = totalBeats - beatIndex;

    const u = Math.min(1, rawFrac / 0.65);
    const easeMorph = 1 - Math.pow(1 - u, 3);

    const rotDeg = (now * 0.22) + (beatIndex + easeMorph) * 105;
    const rotRad = (rotDeg * Math.PI) / 180;

    const idxA = beatIndex % M3_MORPH_SHAPES.length;
    const idxB = (beatIndex + 1) % M3_MORPH_SHAPES.length;
    const pathD = computeMorphPathD(idxA, idxB, easeMorph, rotRad);

    document.querySelectorAll('.m3-morph-loader-path').forEach(p => {
        p.setAttribute('d', pathD);
    });

    m3MorphAnimId = requestAnimationFrame(stepM3MorphLoader);
}

function ensureM3MorphLoopRunning() {
    if (!m3MorphAnimId) {
        m3MorphAnimId = requestAnimationFrame(stepM3MorphLoader);
    }
}

function setSyncButtonExpressiveProgress(active) {
    const syncBtn = document.getElementById('syncHeaderBtn');
    const icon = document.getElementById('cloudStatusIcon');
    const svg = document.getElementById('syncMorphSvg');
    if (!syncBtn || !icon || !svg) return;

    m3MorphActive = active;
    if (!active) {
        syncBtn.classList.remove('active-state');
        svg.classList.add('hidden');
        icon.classList.remove('hidden');
        return;
    }

    syncBtn.classList.add('active-state');
    icon.classList.add('hidden');
    svg.classList.remove('hidden');
    ensureM3MorphLoopRunning();
}

// Sine Wave Progress Bar
const waveInstances = new Map();
let waveAnimFrame = null;

function renderM3WavyProgress(targetElOrId, targetPct = 50) {
    const el = typeof targetElOrId === 'string' ? document.getElementById(targetElOrId) : targetElOrId;
    if (!el) return;
    const clamped = Math.max(6, Math.min(100, Number(targetPct) || 6));

    let inst = waveInstances.get(el);
    if (!inst || !el.contains(inst.canvas)) {
        el.innerHTML = `<canvas class="w-full h-4 block"></canvas>`;
        const canvas = el.querySelector('canvas');
        inst = { canvas, currentPct: Math.min(clamped, 8), targetPct: clamped, phase: 0 };
        waveInstances.set(el, inst);
    } else {
        inst.targetPct = clamped;
    }

    if (!waveAnimFrame) {
        waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
    }
}

function stepAllWavyBars() {
    const rootStyle = getComputedStyle(document.documentElement);
    const primaryColor = rootStyle.getPropertyValue('--md-primary').trim() || '#a78bfa';
    const trackColor = rootStyle.getPropertyValue('--md-secondary-container').trim() || '#312e52';
    let anyVisible = false;

    for (const [el, inst] of waveInstances.entries()) {
        if (!document.body.contains(el)) {
            waveInstances.delete(el);
            continue;
        }
        if (el.offsetParent === null) continue;
        anyVisible = true;

        const diff = inst.targetPct - inst.currentPct;
        if (Math.abs(diff) > 0.04) {
            inst.currentPct += diff * 0.038;
        } else {
            inst.currentPct = inst.targetPct;
        }

        inst.phase += 0.055;

        const canvas = inst.canvas;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth || 240;
        const h = canvas.clientHeight || 16;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const cy = h / 2;
        const strokeW = 4.2;
        const r = strokeW / 2;
        const usableW = Math.max(24, w - strokeW * 2);
        const waveEndX = r + (usableW * (inst.currentPct / 100));

        ctx.beginPath();
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const wavelength = 34;
        const k = (Math.PI * 2) / wavelength;
        const amp = 3.3;
        const taperLen = Math.min(14, (waveEndX - r) * 0.45);

        const smoothstep = (edge, dist) => {
            if (edge <= 0) return 0;
            const t = Math.max(0, Math.min(1, dist / edge));
            return t * t * (3 - 2 * t);
        };

        for (let x = r; x <= waveEndX; x += 1) {
            const envLeft = smoothstep(taperLen, x - r);
            const envRight = smoothstep(taperLen, waveEndX - x);
            const y = cy + amp * envLeft * envRight * Math.sin(k * (x - r) - inst.phase);
            if (x === r) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(waveEndX, cy);
        ctx.stroke();

        const trackStartX = waveEndX + strokeW + 3;
        const trackEndX = w - r;

        if (trackEndX > trackStartX + 2) {
            ctx.beginPath();
            ctx.strokeStyle = trackColor;
            ctx.lineWidth = strokeW;
            ctx.lineCap = 'round';
            ctx.moveTo(trackStartX, cy);
            ctx.lineTo(trackEndX, cy);
            ctx.stroke();

            ctx.beginPath();
            ctx.fillStyle = primaryColor;
            ctx.arc(trackEndX, cy, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    if (anyVisible) {
        waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
    } else {
        waveAnimFrame = null;
    }
}

const JEE_CHAPTERS = {
    Physics: [
        "Basic Mathematics", "Units and Measurements, Errors and Experiments", "Vectors", "Rectilinear Motion", "Projectile Motion", "Relative Motion", "Circular Kinematics", "Newton's Laws of Motion", "Work, Power and Energy", "COM, Momentum and Collision", "Rigid Body Mechanics", "Mechanical properties of Solids (Elasticity)", "Thermometry", "Thermal Expansion", "Calorimetry", "Heat Transfer", "Kinetic Theory of Gases", "Thermodynamics", "Fluid Mechanics", "Simple Harmonic Motion", "Transverse waves (String Waves)", "Longitudinal Waves (Sound Waves)", "Gravitation",
        "Kinematics", "Laws of Motion & Friction", "Work, Energy & Power", "Center of Mass & Collisions", "Rotational Mechanics", "Fluids & Properties of Matter", "Thermodynamics & KTG", "Oscillations & Waves", "Electrostatics & Capacitors", "Current Electricity", "Moving Charges & Magnetism", "EMI & Alternating Current", "Ray & Wave Optics", "Modern Physics & Semiconductors"
    ],
    Chemistry: [
        "Some Basic Concepts of Chemistry (Mole Concept)", "Atomic Structure", "Periodic Classification", "Chemical Bonding", "Gaseous States", "Thermodynamics", "Chemical Equilibrium", "Ionic Equilibrium", "Redox Reactions", "Equivalent Concept and Volumetric Analysis", "IUPAC Nomenclature", "GOC-I", "GOC-II", "Stereochemistry", "Hydrocarbons", "Hydrogen", "s-Block Elements", "Environmental Chemistry", "p-Block Elements",
        "Mole Concept & Stoichiometry", "Chemical & Ionic Equilibrium", "Thermodynamics & Thermochemistry", "Electrochemistry & Kinetics", "Solutions & Colligative Properties", "Coordination Compounds", "p, d & f-Block Elements", "General Organic Chemistry (GOC)", "Hydrocarbons & Haloalkanes", "Carbonyl Compounds, Alcohols & Acids", "Amines & Biomolecules"
    ],
    Mathematics: [
        "Basic Maths", "Sets", "Relations", "Introduction to Functions (PU)", "Linear Inequalities PU", "Fundamentals-1 & 2", "Quadratic Equations and Expressions", "Sequence and Series", "Binomial Theorem for any index", "Permutations and Combinations", "Trigonometric Ratios and Identities", "Trigonometric Equations and Inequalities", "Properties of Triangles", "Introduction to Co-ordinate Geometry", "Straight Lines", "Pair of Lines", "Circles", "Parabola", "Ellipse", "Hyperbola", "Introduction to 3D Geometry PU", "Statistics", "Limits PU", "Methods of Differentiation", "Functions", "Probability PU",
        "Quadratic Equations & Complex Numbers", "Sequences & Series", "Permutations & Combinations", "Matrices & Determinants", "Limits, Continuity & Differentiability", "Application of Derivatives (AOD)", "Indefinite & Definite Integration", "Differential Equations & Area", "Vectors & 3D Geometry", "Probability & Trigonometry"
    ]
};

const SORT_MODES = [
    { value: 'Q_NUM', short: 'Q.#', label: 'Question Number' },
    { value: 'TIME_DESC', short: 'Time', label: 'Time Spent (High → Low)' },
    { value: 'NEWEST', short: 'New', label: 'Newest Added' }
];

const WHITEBOARD_COLORS = [
    { value: '#0f172a', label: 'Ink Black' },
    { value: '#2563eb', label: 'Cobalt Blue' },
    { value: '#e11d48', label: 'Crimson Red' },
    { value: '#059669', label: 'Emerald Green' },
    { value: '#7c3aed', label: 'Royal Violet' },
    { value: '#d97706', label: 'Deep Amber' }
];

const STROKE_WIDTHS = [
    { value: 2.2, short: 'Fine', label: 'Fine Pen (2.2px)' },
    { value: 3.5, short: 'Med', label: 'Medium Pen (3.5px)' },
    { value: 6.0, short: 'Bold', label: 'Bold Marker (6.0px)' }
];

const PRESET_SHAPES = [
    { value: 'RECT', label: '⬛ Rectangle / Square' },
    { value: 'CIRCLE', label: '⚪ Circle' },
    { value: 'TRIANGLE', label: '🔺 Equilateral Triangle' },
    { value: 'RIGHT_TRIANGLE', label: '📐 Right Triangle' },
    { value: 'LINE', label: '📏 Straight Line' },
    { value: 'AXES', label: '➕ X-Y Coordinate Axes' }
];

const QUESTION_TAGS = [
    { value: '', label: 'None (Clear Tag)' },
    { value: 'Concept', label: 'Concept' },
    { value: 'Formula', label: 'Formula' },
    { value: 'Calc', label: 'Calculation' },
    { value: 'Trap', label: 'Trap' },
    { value: 'Redo', label: 'Redo' }
];

// ===================================================================
// MARKDOWN & KATEX MATH PARSER HELPER
// ===================================================================
const markdownParser = {
    render(rawText) {
        if (!rawText) return '';
        let text = String(rawText);

        // 1. Render Block Math ($$...$$)
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
            try {
                return typeof katex !== 'undefined' ? katex.renderToString(math.trim(), { displayMode: true, throwOnError: false }) : match;
            } catch (e) { return match; }
        });

        // 2. Render Inline Math ($...$)
        text = text.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
            try {
                return typeof katex !== 'undefined' ? katex.renderToString(math.trim(), { displayMode: false, throwOnError: false }) : match;
            } catch (e) { return match; }
        });

        // 3. Parse Markdown via Marked.js if present
        let html = typeof marked !== 'undefined' ? marked.parse(text) : text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        return html;
    }
};


const state = {
    questions: [],
    nextId: 1,
    subject: 'ALL',
    chapter: 'ALL',
    status: 'ALL',
    paper: 'ALL',
    tagFilter: 'ALL',
    sortBy: 'Q_NUM',
    search: '',
    activePopupId: null,
    isPopupAnimating: false,
    activeSettingsPage: 'HOME',
    selectedModel: localStorage.getItem('jee_gemini_model') || 'gemini-3.8-flash',
    resolvedBackendModelCache: {},
    rateLimit: {
        dateIST: '',
        dailyCount: 0,
        recentTimestamps: []
    },
    importMode: null,
    pdfDefaultSubject: 'AUTO',
    pdfDoc: null,
    isExtracting: false,
    isUploadMinimized: false,
    cancelExtractionRequested: false,
    extractionAbortController: null,
    currentUploadBatchIds: [],
    importRawImg: null,
    importDeskewAngle: 0,
    isImportingImage: false,
    activeSplitId: null,
    splitMode: 'SPLIT',
    activePadId: null,
    padContextIds: [],
    wbIsLoading: false,
    wbLoadToken: 0,
    wbTool: 'PEN',
    wbStylusOnly: localStorage.getItem('jee_wb_stylus_only') === 'true',
    wbDarkCanvas: localStorage.getItem('jee_wb_dark_canvas') === 'true',
    wbAutoShape: true,
    wbGridMode: 'DOTS',
    laserPoints: [],
    inkColor: '#0f172a',
    strokeWidth: 3.5,
    wbScale: 1.0,
    wbPanX: 0,
    wbPanY: 0,
    wbBoards: {},
    wbSelectedIds: [],
    padShowHint: false,
    padShowAns: false,
    blindModeActive: false,
    timerInterval: null,
    timerPaused: true,
    mockTest: {
        active: false,
        questionIds: [],
        remainingSec: 0,
        totalSec: 0,
        intervalId: null,
        startedAt: 0
    },
    isHandlingHash: false,
    isSyncingCloud: true,
    hasPendingCloudPush: false,
    ocrWorker: null,
    isRunningBackgroundOcr: false,
    isRunningBackgroundSolver: false,
    isSolverMinimized: false,
    stopSolverRequested: false,
    solverAbortController: null,
    lastScrollTop: 0
};

const generateUniqueId = () => Date.now() * 1000 + (state.nextId++ % 1000);
const generateQuestionUid = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 10; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
};

function isVerticalScreen() {
    return window.innerHeight > window.innerWidth;
}

function checkWhiteboardOrientationLock() {
    const wbModal = document.getElementById('scratchpadModal');
    const lockOverlay = document.getElementById('wbPortraitBlockOverlay');
    if (!wbModal || wbModal.classList.contains('hidden') || !lockOverlay) return;
    const vertical = isVerticalScreen();
    lockOverlay.classList.toggle('hidden', !vertical);
    lockOverlay.classList.toggle('flex', vertical);
}

function slugifyRoutePart(str, fallback = 'general') {
    const s = String(str || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return s || fallback;
}

function buildQuestionSubLinkHash(q) {
    if (!q) return '';
    if (!q.uid) q.uid = generateQuestionUid();
    const paperSlug = slugifyRoutePart(q.paperName, 'paper');
    const subjSlug = slugifyRoutePart(q.subject, 'subject');
    const chapSlug = slugifyRoutePart(q.chapter, 'chapter');
    return `#/${paperSlug}/${subjSlug}/${chapSlug}/${q.uid}`;
}

function syncUrlHashWithActiveQuestion(q) {
    if (state.isHandlingHash || !q) return;
    const targetHash = buildQuestionSubLinkHash(q);
    if (window.location.hash !== targetHash) {
        history.replaceState(null, '', targetHash);
    }
}

function clearQuestionUrlHash() {
    if (state.isHandlingHash) return;
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
}

function checkAndOpenQuestionFromUrlHash() {
    const rawHash = window.location.hash || '';
    if (!rawHash.startsWith('#/')) return;
    const parts = rawHash.slice(2).split('/').filter(Boolean);
    if (parts.length < 4) return;
    const uid = parts[parts.length - 1];
    const targetQ = state.questions.find(q => q.uid === uid);
    if (!targetQ) return;

    // Prevent redundant reload if this exact question is already open
    const isWbOpen = !document.getElementById('scratchpadModal')?.classList.contains('hidden');
    const isPopupOpen = !document.getElementById('imagePopupModal')?.classList.contains('hidden');
    if ((isWbOpen && state.activePadId === targetQ.id) || (isPopupOpen && state.activePopupId === targetQ.id)) {
        return;
    }

    state.isHandlingHash = true;
    try {
        if (isVerticalScreen()) {
            window.app.openImagePopup(targetQ.id, false);
        } else {
            window.app.openScratchpad(targetQ.id, isWbOpen);
        }
    } finally {
        state.isHandlingHash = false;
    }
}


const getApiKey = () => (localStorage.getItem('jee_gemini_api_key') || '').trim();
const getSelectedModel = () => {
    const m = state.selectedModel || localStorage.getItem('jee_gemini_model');
    return (m === 'gemini-3.8-flash' || m === 'gemini-3.8-flash-lite') ? m : 'gemini-3.8-flash';
};
const getVerticalPads = () => ({
    padTop: Number(localStorage.getItem('jee_pad_top') ?? 10),
    padBottom: Number(localStorage.getItem('jee_pad_bottom') ?? 10)
});
const getGithubToken = () => (localStorage.getItem('jee_github_pat') || '').trim();
const getGithubGistId = () => DEFAULT_GIST_ID;
const isCloudAutoSyncEnabled = () => localStorage.getItem('jee_cloud_autosync') !== 'false';
const isAutoSolveHintsEnabled = () => localStorage.getItem('jee_auto_solve_hints') !== 'false';
const getThemeMode = () => localStorage.getItem('jee_m3_theme_mode') || 'dark';

// ===================================================================
// STRICT IST RATE LIMITER (MAX 19/DAY IST & MAX 4/MIN, GIST-SYNCED)
// + TRANSPARENT ENDPOINT ROUTER SO GEMINI 3.8 FLASH ALWAYS EXECUTES
// ===================================================================
const MAX_DAILY_REQ_IST = 19;
const MAX_RPM_REQ = 4;

function getCurrentISTDateString() {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (5.5 * 3600000));
    return istDate.toISOString().slice(0, 10);
}

function normalizeRateLimitObj(raw) {
    const todayIST = getCurrentISTDateString();
    const nowMs = Date.now();
    if (!raw || raw.dateIST !== todayIST) {
        return { dateIST: todayIST, dailyCount: 0, recentTimestamps: [] };
    }
    const recent = Array.isArray(raw.recentTimestamps)
        ? raw.recentTimestamps.map(Number).filter(ts => nowMs - ts < 60000)
        : [];
    return {
        dateIST: todayIST,
        dailyCount: Math.max(0, Number(raw.dailyCount) || 0),
        recentTimestamps: recent
    };
}

function updateQuotaBadgesEverywhere() {
    const rl = normalizeRateLimitObj(state.rateLimit);
    const qBadge = document.getElementById('solverQuotaBadge');
    if (qBadge) {
        qBadge.textContent = `Quota: ${rl.dailyCount}/${MAX_DAILY_REQ_IST} IST (${rl.recentTimestamps.length}/${MAX_RPM_REQ} min)`;
    }
    const infoEl = document.getElementById('settingsSolverStatusInfo');
    if (infoEl && !state.isRunningBackgroundSolver) {
        const withHints = state.questions.filter(q => q.hint && q.answerKey).length;
        infoEl.textContent = `Solved: ${withHints} / ${state.questions.length} • Quota Today: ${rl.dailyCount}/${MAX_DAILY_REQ_IST} req (IST).`;
    }
}

async function fetchRateLimitFromGist() {
    const gistId = getGithubGistId();
    const token = getGithubToken();
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
            headers,
            cache: 'no-store'
        });
        if (res.ok) {
            const data = await res.json();
            const manifestStr = data.files?.['jee_vault_manifest.json']?.content;
            if (manifestStr) {
                const manifest = JSON.parse(manifestStr);
                if (manifest.rateLimit) {
                    const remoteRL = normalizeRateLimitObj(manifest.rateLimit);
                    const localRL = normalizeRateLimitObj(state.rateLimit);
                    state.rateLimit = {
                        dateIST: remoteRL.dateIST,
                        dailyCount: Math.max(remoteRL.dailyCount, localRL.dailyCount),
                        recentTimestamps: Array.from(new Set([...remoteRL.recentTimestamps, ...localRL.recentTimestamps])).sort()
                    };
                    localStorage.setItem('jee_rate_limit_cache', JSON.stringify(state.rateLimit));
                    updateQuotaBadgesEverywhere();
                    return state.rateLimit;
                }
            }
        }
    } catch (e) {
        console.warn('Rate limit check fallback to local cache:', e);
    }
    const cached = JSON.parse(localStorage.getItem('jee_rate_limit_cache') || 'null');
    state.rateLimit = normalizeRateLimitObj(cached || state.rateLimit);
    updateQuotaBadgesEverywhere();
    return state.rateLimit;
}

async function saveRateLimitToGist() {
    localStorage.setItem('jee_rate_limit_cache', JSON.stringify(state.rateLimit));
    updateQuotaBadgesEverywhere();
    const token = getGithubToken();
    if (!token || state.isSyncingCloud) {
        if (state.isSyncingCloud) state.hasPendingCloudPush = true;
        return;
    }

    try {
        const gistId = getGithubGistId();
        const paperGroups = {};
        state.questions.forEach(q => {
            const pName = q.paperName || 'Default Paper';
            (paperGroups[pName] = paperGroups[pName] || []).push(q);
        });

        const manifestPayload = {
            app: 'JEE Sorter Cloud Vault',
            updatedAt: new Date().toISOString(),
            totalQuestions: state.questions.length,
            rateLimit: state.rateLimit,
            papers: Object.keys(paperGroups).map(p => ({
                paperName: p,
                fileName: sanitizePaperFilename(p),
                count: paperGroups[p].length
            }))
        };

        await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'jee_vault_manifest.json': {
                        content: JSON.stringify(manifestPayload, null, 2)
                    }
                }
            })
        });
    } catch (e) {
        console.warn('Failed to push rateLimit to Gist:', e);
    }
}

// Discovers the active generateContent Flash endpoint on your API key if Google's router returns 404 for gemini-3.8-flash
async function resolveActiveBackendEndpointForModel(preferredModelName, apiKey) {
    if (state.resolvedBackendModelCache[preferredModelName]) {
        return state.resolvedBackendModelCache[preferredModelName];
    }
    const isLite = preferredModelName.includes('lite');
    try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (listRes.ok) {
            const listData = await listRes.json();
            const available = (listData.models || [])
                .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                .map(m => String(m.name || '').replace(/^models\//, ''));

            if (available.includes(preferredModelName)) {
                state.resolvedBackendModelCache[preferredModelName] = preferredModelName;
                return preferredModelName;
            }

            const flashCandidates = available.filter(name => /flash/i.test(name) && !/8b|tts|audio|image/i.test(name));
            if (isLite) {
                const liteMatch = flashCandidates.find(name => /lite/i.test(name));
                if (liteMatch) {
                    state.resolvedBackendModelCache[preferredModelName] = liteMatch;
                    return liteMatch;
                }
            }
            // Pick highest version flash model available on this API key
            flashCandidates.sort((a, b) => b.localeCompare(a));
            if (flashCandidates.length > 0) {
                state.resolvedBackendModelCache[preferredModelName] = flashCandidates[0];
                return flashCandidates[0];
            }
        }
    } catch (_) {}
    return preferredModelName;
}

        async function executeRateLimitedGeminiFetch(preferredModel, payload, abortSignal = null, onLog = null, maxRetries = 3) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Missing Gemini API Key in Settings.');

    let attempt = 0;
    let lastErrMsg = 'Unknown Gemini error';

    while (attempt <= maxRetries) {
        if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // 1. Verify latest rate limit counters from GitHub Gist before sending
        await fetchRateLimitFromGist();

        const isAnyProgressDialogOpen = () => {
            const solverOpen = !document.getElementById('solverModal')?.classList.contains('hidden');
            const uploadOpen = !document.getElementById('uploadModal')?.classList.contains('hidden');
            return solverOpen || uploadOpen;
        };

        const sleepOneSecAbortable = () => new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 1000);
            if (abortSignal) {
                if (abortSignal.aborted) {
                    clearTimeout(t);
                    reject(new DOMException('Aborted', 'AbortError'));
                    return;
                }
                abortSignal.addEventListener('abort', () => {
                    clearTimeout(t);
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            }
        });

        // 2. Enforce 19 requests/day (IST)
        if (state.rateLimit.dailyCount >= MAX_DAILY_REQ_IST) {
            const msg = `Daily limit reached (${state.rateLimit.dailyCount}/${MAX_DAILY_REQ_IST} requests for ${state.rateLimit.dateIST} IST). Paused until midnight IST.`;
            if (onLog) onLog(`⛔ ${msg}`, 'error');
            if (!isAnyProgressDialogOpen()) {
                toast(msg, 'warn');
            }
            throw new Error(msg);
        }

        // 3. Enforce 4 requests/minute (Wait until the 60s window clears — live 1s dynamic log countdown!)
        const nowMs = Date.now();
        state.rateLimit.recentTimestamps = state.rateLimit.recentTimestamps.filter(ts => nowMs - ts < 60000);

        if (state.rateLimit.recentTimestamps.length >= MAX_RPM_REQ) {
            const oldestInWindow = state.rateLimit.recentTimestamps[0];
            const waitMs = Math.max(1000, 60500 - (nowMs - oldestInWindow));
            const waitSec = Math.ceil(waitMs / 1000);
            const waitMsg = `Rate limit guard (4 req/min): waiting ${waitSec}s for minute window to clear...`;
            const logLineEl = onLog ? onLog(`⏳ ${waitMsg}`, 'stitch') : null;

            // Suppress toast whenever the Solver or Upload dialog is currently open
            if (!isAnyProgressDialogOpen()) {
                toast(waitMsg, 'info');
            }

            for (let rem = waitSec; rem > 0; rem--) {
                if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
                if (logLineEl) {
                    logLineEl.textContent = `• ⏳ Rate limit guard (4 req/min): waiting ${rem}s for minute window to clear...`;
                }
                const subEl = document.getElementById('solverModalSubText');
                if (subEl && state.isRunningBackgroundSolver) {
                    subEl.textContent = `Cooling down rate limit (4 req/min): resuming in ${rem}s...`;
                }
                const minTxt = document.getElementById('minSolverStatusText');
                if (minTxt && state.isRunningBackgroundSolver) {
                    minTxt.textContent = `Cooling down rate limit: resuming in ${rem}s...`;
                }
                const extSubEl = document.getElementById('extractSubText');
                if (extSubEl && state.isExtracting) {
                    extSubEl.textContent = `Cooling down rate limit (4 req/min): resuming in ${rem}s...`;
                }
                updateQuotaBadgesEverywhere();
                await sleepOneSecAbortable();
            }

            if (logLineEl) {
                logLineEl.className = 'font-bold text-emerald-500 dark:text-emerald-400';
                logLineEl.textContent = '• ✓ Rate limit cooldown complete — resuming...';
            }
            updateQuotaBadgesEverywhere();
            continue;
        }

        // 4. Dispatch request to preferred model (with 404 endpoint auto-discovery)
        let targetModel = state.resolvedBackendModelCache[preferredModel] || preferredModel;
        let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

        try {
            let res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortSignal
            });

            if (res.status === 404) {
                const resolved = await resolveActiveBackendEndpointForModel(preferredModel, apiKey);
                if (resolved && resolved !== targetModel) {
                    targetModel = resolved;
                    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
                    res = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: abortSignal
                    });
                }
            }

            // 5. ONLY count quota when the request SUCCEEDS (res.ok === true)!
            if (res.ok) {
                state.rateLimit.dailyCount += 1;
                state.rateLimit.recentTimestamps.push(Date.now());
                await saveRateLimitToGist();
                if (onLog) {
                    onLog(`📡 Request ${state.rateLimit.dailyCount}/${MAX_DAILY_REQ_IST} (IST) succeeded via ${preferredModel} [HTTP 200]`, 'info');
                }
                return res;
            }

            // Non-OK response (e.g. 503 High Demand, 429, 500) -> DO NOT increment quota!
            const errSnippet = (await res.text().catch(() => '')).slice(0, 130);
            lastErrMsg = `HTTP ${res.status}: ${errSnippet || res.statusText}`;

            const isRetryable = [429, 500, 502, 503, 504].includes(res.status);
            if (isRetryable && attempt < maxRetries) {
                attempt++;
                const backoffSec = Math.min(12, attempt * 3);
                const retryLogEl = onLog
                    ? onLog(`⚠️ Gemini busy/failed (${res.status}) — Quota NOT charged. Retrying (${attempt}/${maxRetries}) in ${backoffSec}s...`, 'stitch')
                    : null;
                for (let rem = backoffSec; rem > 0; rem--) {
                    if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
                    if (retryLogEl) {
                        retryLogEl.textContent = `• ⚠️ Gemini busy/failed (${res.status}) — Quota NOT charged. Retrying (${attempt}/${maxRetries}) in ${rem}s...`;
                    }
                    await sleepOneSecAbortable();
                }
                if (retryLogEl) {
                    retryLogEl.textContent = `• ↻ Retrying request (${attempt}/${maxRetries}) now...`;
                }
                continue;
            }

            const failErr = new Error(lastErrMsg);
            failErr.code = 'GEMINI_FAILED';
            failErr.attempts = attempt + 1;
            throw failErr;
        } catch (netErr) {
            if (netErr.name === 'AbortError' || netErr.code === 'GEMINI_FAILED') throw netErr;
            lastErrMsg = netErr.message || 'Network failure';
            if (attempt < maxRetries) {
                attempt++;
                const backoffSec = attempt * 3;
                if (onLog) {
                    onLog(`⚠️ Network error (${lastErrMsg}) — Quota NOT charged. Retrying (${attempt}/${maxRetries}) in ${backoffSec}s...`, 'stitch');
                }
                await new Promise(r => setTimeout(r, backoffSec * 1000));
                continue;
            }
            const failErr = new Error(lastErrMsg);
            failErr.code = 'GEMINI_FAILED';
            failErr.attempts = attempt + 1;
            throw failErr;
        }
    }

    const finalErr = new Error(lastErrMsg);
    finalErr.code = 'GEMINI_FAILED';
    throw finalErr;
}


// ===================================================================
// 2-STAGE HYBRID PDF SLICER:
// Stage 1: Foolproof Local 2D Vector + Pixel-Ink Projection Slicer
// Stage 2: Sends Local Candidate Borders to Gemini 3.8 Flash to Verify & Refine
// ===================================================================
function inferSubjectAndChapterFromText(text, fallbackSubject = 'AUTO') {
    if (window.JEELocalVisionEngine?.classifyQuestion) {
        const res = window.JEELocalVisionEngine.classifyQuestion(text, {
            defaultSubject: fallbackSubject
        });
        return { subject: res.subject, chapter: res.chapter };
    }
    const hay = String(text || '').toLowerCase();

    const keywordRules = [
        { rx: /straight\s*line|slope|orthocentre|incentre|circumcentre|centroid|angle\s*bisector|median\s*through|altitude\s*through/i, subj: 'Mathematics', chap: 'Straight Lines' },
        { rx: /pair\s*of\s*line|homogen/i, subj: 'Mathematics', chap: 'Pair of Lines' },
        { rx: /circle|radical\s*axis|chord\s*of\s*contact/i, subj: 'Mathematics', chap: 'Circles' },
        { rx: /parabola|latus\s*rectum|focal\s*chord/i, subj: 'Mathematics', chap: 'Parabola' },
        { rx: /ellipse|eccentricity.*foci/i, subj: 'Mathematics', chap: 'Ellipse' },
        { rx: /hyperbola|asymptote/i, subj: 'Mathematics', chap: 'Hyperbola' },
        { rx: /quadratic|roots\s*of.*equation|discriminant/i, subj: 'Mathematics', chap: 'Quadratic Equations and Expressions' },
        { rx: /sequence|series|arithmetic\s*progression|geometric\s*progression/i, subj: 'Mathematics', chap: 'Sequence and Series' },
        { rx: /binomial|coefficient/i, subj: 'Mathematics', chap: 'Binomial Theorem for any index' },
        { rx: /permutation|combination|arrangement|ways/i, subj: 'Mathematics', chap: 'Permutations and Combinations' },
        { rx: /probability|dice|coins|bayes/i, subj: 'Mathematics', chap: 'Probability PU' },
        { rx: /matrix|matrices|determinant/i, subj: 'Mathematics', chap: 'Matrices & Determinants' },
        { rx: /limit|continuity|differentiability/i, subj: 'Mathematics', chap: 'Limits, Continuity & Differentiability' },
        { rx: /integral|integration|\bdx\b/i, subj: 'Mathematics', chap: 'Indefinite & Definite Integration' },
        { rx: /gravitation|hollow\s*sphere|gravitational\s*potential|escape\s*velocity|kepler/i, subj: 'Physics', chap: 'Gravitation' },
        { rx: /moment\s*of\s*inertia|rigid\s*body|angular\s*momentum|torque|rolling/i, subj: 'Physics', chap: 'Rigid Body Mechanics' },
        { rx: /center\s*of\s*mass|collision|impulse|restitution/i, subj: 'Physics', chap: 'COM, Momentum and Collision' },
        { rx: /work|kinetic\s*energy|potential\s*energy|spring/i, subj: 'Physics', chap: 'Work, Power and Energy' },
        { rx: /friction|pulley|tension|newton|block|incline| wedge/i, subj: 'Physics', chap: "Newton's Laws of Motion" },
        { rx: /projectile|trajectory|range/i, subj: 'Physics', chap: 'Projectile Motion' },
        { rx: /thermodynamics|adiabatic|isothermal|carnot|entropy/i, subj: 'Physics', chap: 'Thermodynamics' },
        { rx: /simple\s*harmonic|shm|oscillation|pendulum/i, subj: 'Physics', chap: 'Simple Harmonic Motion' },
        { rx: /electrostatic|coulomb|gauss|capacitor|electric\s*field/i, subj: 'Physics', chap: 'Electrostatics & Capacitors' },
        { rx: /acidity|basicity|goc|resonance|inductive|tautomer|iupac|alkane|alkene/i, subj: 'Chemistry', chap: 'GOC-I' },
        { rx: /mole\s*concept|molarity|stoichiometry|equivalent/i, subj: 'Chemistry', chap: 'Some Basic Concepts of Chemistry (Mole Concept)' },
        { rx: /atomic\s*structure|bohr|quantum\s*number|orbital/i, subj: 'Chemistry', chap: 'Atomic Structure' },
        { rx: /chemical\s*bonding|hybridisation|vsepr|mot/i, subj: 'Chemistry', chap: 'Chemical Bonding' },
        { rx: /equilibrium|kp|kc|ph\b|buffer|solubility/i, subj: 'Chemistry', chap: 'Ionic Equilibrium' }
    ];

    for (const rule of keywordRules) {
        if (rule.rx.test(hay)) {
            const finalSubj = (fallbackSubject && fallbackSubject !== 'AUTO') ? fallbackSubject : rule.subj;
            return { subject: finalSubj, chapter: rule.chap };
        }
    }

    const subj = (fallbackSubject && fallbackSubject !== 'AUTO') ? fallbackSubject : 'Physics';
    return { subject: subj, chapter: JEE_CHAPTERS[subj]?.[0] || 'General' };
}

async function extractPage2DTextTokens(page) {
    try {
        const vp = page.getViewport({ scale: 1.0 });
        const pageW = vp.width || 1;
        const pageH = vp.height || 1;
        const textContent = await page.getTextContent();
        const tokens = [];

        for (const item of (textContent.items || [])) {
            const rawStr = String(item.str || '');
            if (!rawStr.trim() || !item.transform) continue;
            const fontH = Math.max(7, Math.hypot(item.transform[2] || 0, item.transform[3] || 10));
            const xPt = item.transform[4];
            const baselineY = item.transform[5];
            const wPt = Math.max(4, item.width || (rawStr.length * fontH * 0.48));

            const xmin = Math.max(0, Math.min(1000, (xPt / pageW) * 1000));
            const xmax = Math.max(xmin + 2, Math.min(1000, ((xPt + wPt) / pageW) * 1000));
            const botNorm = Math.min(1000, ((pageH - baselineY + fontH * 0.38) / pageH) * 1000);
            const topNorm = Math.max(0, ((pageH - (baselineY + fontH * 1.18)) / pageH) * 1000);

            tokens.push({
                str: rawStr.trim(),
                xmin,
                xmax,
                topNorm,
                botNorm,
                yMid: (topNorm + botNorm) / 2,
                fontH
            });
        }
        return tokens;
    } catch (_) {
        return [];
    }
}

function detectPageColumnStructure(tokens, sourceCanvas) {
    const bodyTokens = tokens.filter(t => t.topNorm > 95 && t.botNorm < 935);
    let leftStarts = 0, rightStarts = 0, crossingMid = 0;

    for (const t of bodyTokens) {
        if (t.xmin >= 35 && t.xmin <= 165) leftStarts++;
        if (t.xmin >= 485 && t.xmin <= 585) rightStarts++;
        if (t.xmin < 455 && t.xmax > 545 && (t.xmax - t.xmin) > 130) crossingMid++;
    }

    // Only treat as 2-column if there are genuine question anchors or text starts in both halves
    // AND not a full-width table (where horizontal lines cross the middle)
    if (leftStarts >= 4 && rightStarts >= 4 && crossingMid <= Math.max(2, (leftStarts + rightStarts) * 0.08)) {
        return { isTwoColumn: true, gutterNormX: 500 };
    }
    return { isTwoColumn: false, gutterNormX: 500 };
}

function groupTokensIntoColumnLines(colTokens) {
    const sorted = [...colTokens].sort((a, b) => a.topNorm !== b.topNorm ? a.topNorm - b.topNorm : a.xmin - b.xmin);
    const lines = [];

    for (const tok of sorted) {
        let matchedLine = null;
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
            const ln = lines[i];
            if (Math.abs(tok.yMid - ln.yMid) <= 6.5) {
                matchedLine = ln;
                break;
            }
        }
        if (matchedLine) {
            matchedLine.tokens.push(tok);
            matchedLine.xmin = Math.min(matchedLine.xmin, tok.xmin);
            matchedLine.xmax = Math.max(matchedLine.xmax, tok.xmax);
            matchedLine.topNorm = Math.min(matchedLine.topNorm, tok.topNorm);
            matchedLine.botNorm = Math.max(matchedLine.botNorm, tok.botNorm);
            matchedLine.yMid = (matchedLine.topNorm + matchedLine.botNorm) / 2;
        } else {
            lines.push({
                tokens: [tok],
                xmin: tok.xmin,
                xmax: tok.xmax,
                topNorm: tok.topNorm,
                botNorm: tok.botNorm,
                yMid: tok.yMid
            });
        }
    }

    lines.forEach(ln => {
        ln.tokens.sort((a, b) => a.xmin - b.xmin);
        ln.text = ln.tokens.map(t => t.str).join(' ').replace(/\s+/g, ' ').trim();
    });
    return lines.sort((a, b) => a.topNorm - b.topNorm);
}

function matchQuestionStartAnchor(lineText, relIndentNorm) {
    const txt = String(lineText || '').trim();
    if (!txt) return null;
    if (/^\([A-D1-4]\)/i.test(txt)) return null;

    const explicitMatch = txt.match(/^(?:Q(?:uestion|\.)?\s*|Prob(?:lem|\.)?\s*)(\d{1,3}[a-zA-Z]?)(?:\s*\[.*?\]|\s*[\.\)\:\-]|\s+)/i);
    if (explicitMatch && relIndentNorm < 140) {
        return explicitMatch[1];
    }

    const tightQMatch = txt.match(/^Q\.?\s*(\d{1,3}[a-zA-Z]?)\b/i);
    if (tightQMatch && relIndentNorm < 140) {
        return tightQMatch[1];
    }

    if (relIndentNorm < 75) {
        const numMatch = txt.match(/^(\d{1,3})\s*[\.\)]\s*(?:[A-Za-z\(\$\[]|$)/);
        if (numMatch) {
            return numMatch[1];
        }
    }
    return null;
}

// Pixel-Ink Horizontal Table / Row Divider Detector (Handles boxed table sheets like Page 6 in your screenshot!)
function detectPixelInkQuestionBands(sourceCanvas, defaultSubj, paperTitle) {
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, w, h).data;

    // Detect full-width horizontal table borders or deep whitespace bands
    const rowDarkRatio = new Float32Array(h);
    const xStart = Math.floor(w * 0.06), xEnd = Math.floor(w * 0.94);
    const spanW = Math.max(1, xEnd - xStart);

    for (let y = 0; y < h; y++) {
        let dark = 0;
        for (let x = xStart; x < xEnd; x += 2) {
            const idx = (y * w + x) * 4;
            if (imgData[idx] < 225 || imgData[idx + 1] < 225 || imgData[idx + 2] < 225) dark++;
        }
        rowDarkRatio[y] = dark / (spanW / 2);
    }

    // 1. Check for horizontal table rules (rows where >55% of width is continuous dark line)
    const hRules = [];
    for (let y = Math.floor(h * 0.04); y < Math.floor(h * 0.96); y++) {
        if (rowDarkRatio[y] > 0.52) {
            if (hRules.length === 0 || y - hRules[hRules.length - 1] > Math.floor(h * 0.06)) {
                hRules.push(y);
            }
        }
    }

    const blocks = [];
    if (hRules.length >= 3) {
        for (let i = 0; i < hRules.length - 1; i++) {
            const y0 = hRules[i], y1 = hRules[i + 1];
            if ((y1 - y0) < h * 0.07) continue;
            // Check if band actually contains ink inside
            let inkRows = 0;
            for (let r = y0 + 8; r < y1 - 8; r++) {
                if (rowDarkRatio[r] > 0.012 && rowDarkRatio[r] < 0.45) inkRows++;
            }
            if (inkRows > 12) {
                const { subject, chapter } = inferSubjectAndChapterFromText(paperTitle, defaultSubj);
                blocks.push({
                    questionNumber: `${blocks.length + 1}`,
                    subject,
                    chapter,
                    xmin: 12,
                    xmax: 988,
                    ymin: Math.round((y0 / h) * 1000),
                    ymax: Math.round((y1 / h) * 1000),
                    ocrText: '',
                    firstLineSnippet: '',
                    lastLineSnippet: '',
                    isContinuationFromPrevPage: false,
                    continuesToNextPage: false,
                    colLines: []
                });
            }
        }
        if (blocks.length >= 2) return blocks;
    }

    // 2. Otherwise segment by vertical whitespace gaps (> 1.8% of page height)
    const minGapPx = Math.max(18, Math.floor(h * 0.018));
    const minBlockPx = Math.max(55, Math.floor(h * 0.065));
    let inContent = false, blockStart = 0, whiteRun = 0;

    for (let y = Math.floor(h * 0.05); y < Math.floor(h * 0.95); y++) {
        const hasInk = rowDarkRatio[y] > 0.008;
        if (hasInk) {
            if (!inContent) {
                inContent = true;
                blockStart = Math.max(0, y - 10);
            }
            whiteRun = 0;
        } else if (inContent) {
            whiteRun++;
            if (whiteRun >= minGapPx) {
                const blockEnd = y - whiteRun + 10;
                if (blockEnd - blockStart >= minBlockPx) {
                    const { subject, chapter } = inferSubjectAndChapterFromText(paperTitle, defaultSubj);
                    blocks.push({
                        questionNumber: `${blocks.length + 1}`,
                        subject,
                        chapter,
                        xmin: 12,
                        xmax: 988,
                        ymin: Math.round((blockStart / h) * 1000),
                        ymax: Math.round((blockEnd / h) * 1000),
                        ocrText: '',
                        firstLineSnippet: '',
                        lastLineSnippet: '',
                        isContinuationFromPrevPage: false,
                        continuesToNextPage: false,
                        colLines: []
                    });
                }
                inContent = false;
                whiteRun = 0;
            }
        }
    }
    if (inContent && (h * 0.95 - blockStart) >= minBlockPx) {
        const { subject, chapter } = inferSubjectAndChapterFromText(paperTitle, defaultSubj);
        blocks.push({
            questionNumber: `${blocks.length + 1}`,
            subject,
            chapter,
            xmin: 12,
            xmax: 988,
            ymin: Math.round((blockStart / h) * 1000),
            ymax: 955,
            ocrText: '',
            firstLineSnippet: '',
            lastLineSnippet: '',
            isContinuationFromPrevPage: false,
            continuesToNextPage: false,
            colLines: []
        });
    }
    return blocks;
}

// Stage 1 Local Candidate Generator (Combines Native Vector Anchors + Pixel Table/Band Detector)
function generateLocal2DCandidateBlocks(tokens, sourceCanvas, paperTitle, defaultSubj) {
    if (tokens && tokens.length >= 10) {
        const { isTwoColumn, gutterNormX } = detectPageColumnStructure(tokens, sourceCanvas);
        const columns = isTwoColumn
            ? [
                { colIdx: 0, xmin: 12, xmax: Math.max(450, gutterNormX - 6) },
                { colIdx: 1, xmin: Math.min(550, gutterNormX + 6), xmax: 988 }
            ]
            : [{ colIdx: 0, xmin: 10, xmax: 990 }];

        const pageHeaderText = tokens.filter(t => t.topNorm < 130).map(t => t.str).join(' ');
        const detectedBlocks = [];

        for (const col of columns) {
            const colTokens = tokens.filter(t => {
                const cx = (t.xmin + t.xmax) / 2;
                return cx >= col.xmin && cx <= col.xmax && t.botNorm <= 958;
            });
            const colLines = groupTokensIntoColumnLines(colTokens);
            if (colLines.length === 0) continue;

            const colLeftMargin = Math.min(...colLines.map(l => l.xmin));
            const anchors = [];

            for (let i = 0; i < colLines.length; i++) {
                const ln = colLines[i];
                if (ln.topNorm > 925 && /^\d{1,3}$/.test(ln.text)) continue;
                const relIndent = ln.xmin - colLeftMargin;
                const qNum = matchQuestionStartAnchor(ln.text, relIndent);
                if (qNum) {
                    anchors.push({ lineIdx: i, qNum, line: ln });
                }
            }

            for (let aIdx = 0; aIdx < anchors.length; aIdx++) {
                const currA = anchors[aIdx];
                const nextA = anchors[aIdx + 1];
                const startLineIdx = currA.lineIdx;
                const endLineIdx = nextA ? nextA.lineIdx - 1 : colLines.length - 1;

                const sliceLines = colLines.slice(startLineIdx, endLineIdx + 1).filter(l => {
                    if (l.topNorm > 925 && /^\d{1,3}$/.test(l.text)) return false;
                    return true;
                });
                if (sliceLines.length === 0) continue;

                const rawYMin = Math.max(8, currA.line.topNorm - 10);
                const lastLineBot = Math.max(...sliceLines.map(l => l.botNorm));
                const nextAnchorTop = nextA ? nextA.line.topNorm : 950;
                const rawYMax = nextA
                    ? Math.max(lastLineBot + 10, nextAnchorTop - 6)
                    : Math.min(960, Math.max(lastLineBot + 22, 945));

                const fullQText = sliceLines.map(l => l.text).join(' ');
                const { subject, chapter } = inferSubjectAndChapterFromText(`${paperTitle} ${pageHeaderText} ${fullQText}`, defaultSubj);

                detectedBlocks.push({
                    questionNumber: currA.qNum,
                    subject,
                    chapter,
                    xmin: Math.round(col.xmin),
                    xmax: Math.round(col.xmax),
                    ymin: Math.round(rawYMin),
                    ymax: Math.round(rawYMax),
                    ocrText: cleanQuestionTextOnly(fullQText),
                    firstLineSnippet: sliceLines[0]?.text || '',
                    lastLineSnippet: sliceLines[sliceLines.length - 1]?.text || '',
                    isContinuationFromPrevPage: false,
                    continuesToNextPage: false,
                    colLines
                });
            }
        }

        // If vector anchor detector found at least 2 questions, return them;
        // if it only found 0 or 1 on a multi-row table page, check pixel bands too!
        if (detectedBlocks.length >= 2) return detectedBlocks;
        const pixelBlocks = detectPixelInkQuestionBands(sourceCanvas, defaultSubj, paperTitle);
        if (pixelBlocks.length > detectedBlocks.length) return pixelBlocks;
        if (detectedBlocks.length > 0) return detectedBlocks;
    }

    return detectPixelInkQuestionBands(sourceCanvas, defaultSubj, paperTitle);
}

// Stage 2: Sends Local Candidate Borders to Gemini 3.8 Flash so Gemini Verifies, Splits, or Corrects them!
async function verifyAndRefineBordersWithGemini(base64Jpeg, pageNum, localCandidates, abortSignal, onLog, ) {
    const selectedModel = getSelectedModel();
    const candidateSummary = (localCandidates || []).map((c, idx) => ({
        index: idx + 1,
        questionNumber: c.questionNumber,
        xmin: c.xmin,
        ymin: c.ymin,
        xmax: c.xmax,
        ymax: c.ymax,
        firstLineSnippet: (c.firstLineSnippet || '').slice(0, 60)
    }));

    const systemPrompt = `You are a precision 2D JEE Question Paper Border Verifier & Corrector.
We ran our local algorithm on Page ${pageNum} and proposed these candidate 2D bounding boxes (normalized 0 to 1000):
${JSON.stringify(candidateSummary)}

YOUR TASK:
1. Inspect the page image carefully (it may be 1-column, 2-column, boxed table rows, matrix-match, or integer/single-choice problems).
2. Verify each proposed box (\`xmin\`, \`ymin\`, \`xmax\`, \`ymax\` in 0..1000).
3. If our local algorithm merged 2 questions into 1 box, SPLIT them into separate entries!
4. If our local algorithm missed any question or cut off a diagram/option/fraction, ADJUST \`xmin\`, \`ymin\`, \`xmax\`, \`ymax\` so every single question on the page is 100% complete with 8-12 units of clean padding.
5. Classify \`subject\` ("Physics", "Chemistry", or "Mathematics") and \`chapter\`.`;

    const payload = {
        contents: [{
            role: "user",
            parts: [
                { text: `Verify and correct these ${candidateSummary.length} proposed 2D question borders on Page ${pageNum}. Output the final corrected list of all questions on this page.` },
                { inlineData: { mimeType: "image/jpeg", data: base64Jpeg } }
            ]
        }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            temperature: 0.0,
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    questions: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                questionNumber: { type: "STRING" },
                                firstLineSnippet: { type: "STRING" },
                                lastLineSnippet: { type: "STRING" },
                                subject: { type: "STRING", enum: ["Physics", "Chemistry", "Mathematics"] },
                                chapter: { type: "STRING" },
                                xmin: { type: "INTEGER" },
                                ymin: { type: "INTEGER" },
                                xmax: { type: "INTEGER" },
                                ymax: { type: "INTEGER" },
                                isContinuationFromPrevPage: { type: "BOOLEAN" },
                                continuesToNextPage: { type: "BOOLEAN" }
                            },
                            required: ["questionNumber", "subject", "chapter", "xmin", "ymin", "xmax", "ymax"]
                        }
                    }
                },
                required: ["questions"]
            }
        }
    };

    const res = await executeRateLimitedGeminiFetch(selectedModel, payload, abortSignal, onLog,2);
    if (!res.ok) {
        const errTxt = (await res.text()).slice(0, 140);
        throw new Error(`HTTP ${res.status}: ${errTxt}`);
    }
    const data = await res.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = txt ? JSON.parse(txt) : { questions: [] };
    return parsed.questions || [];
}

function snap2DBoundaryToWhitespace(sourceCanvas, colLines, targetNormY, minAllowedNorm, maxAllowedNorm, xminNorm, xmaxNorm, preferDirection = 'UP') {
    let yNorm = Math.max(minAllowedNorm, Math.min(maxAllowedNorm, targetNormY));

    if (Array.isArray(colLines) && colLines.length > 0) {
        for (let pass = 0; pass < 3; pass++) {
            let adjusted = false;
            for (const line of colLines) {
                if (yNorm >= line.topNorm - 4 && yNorm <= line.botNorm + 4) {
                    if (preferDirection === 'UP') {
                        const candidate = Math.max(minAllowedNorm, line.topNorm - 6);
                        if (candidate < yNorm) { yNorm = candidate; adjusted = true; }
                    } else {
                        const candidate = Math.min(maxAllowedNorm, line.botNorm + 6);
                        if (candidate > yNorm) { yNorm = candidate; adjusted = true; }
                    }
                }
            }
            if (!adjusted) break;
        }
    }

    const w = sourceCanvas.width, h = sourceCanvas.height;
    const x0 = Math.max(4, Math.floor((xminNorm / 1000) * w) + 6);
    const x1 = Math.min(w - 4, Math.floor((xmaxNorm / 1000) * w) - 6);
    const colW = Math.max(20, x1 - x0);

    const searchUpNorm = preferDirection === 'UP' ? 36 : 14;
    const searchDownNorm = preferDirection === 'DOWN' ? 36 : 14;
    const startMinNorm = Math.max(minAllowedNorm, yNorm - searchUpNorm);
    const endMaxNorm = Math.min(maxAllowedNorm, yNorm + searchDownNorm);

    const minPx = Math.max(4, Math.floor((startMinNorm / 1000) * h));
    const maxPx = Math.min(h - 4, Math.floor((endMaxNorm / 1000) * h));
    const centerPx = Math.max(minPx, Math.min(maxPx, Math.floor((yNorm / 1000) * h)));
    if (maxPx <= minPx + 4) return Math.round(yNorm);

    const sliceH = maxPx - minPx + 1;
    const imgData = sourceCanvas.getContext('2d').getImageData(x0, minPx, colW, sliceH).data;
    const isRowWhite = new Array(sliceH).fill(true);

    for (let r = 0; r < sliceH; r++) {
        let darkPixels = 0;
        for (let x = 0; x < colW; x += 2) {
            const idx = (r * colW + x) * 4;
            if (imgData[idx] < 236 || imgData[idx + 1] < 236 || imgData[idx + 2] < 236) {
                if (++darkPixels > 1) { isRowWhite[r] = false; break; }
            }
        }
    }

    const startIdx = centerPx - minPx;
    if (preferDirection === 'UP') {
        for (let r = startIdx; r >= 2; r--) {
            if (isRowWhite[r] && isRowWhite[r - 1] && isRowWhite[r - 2]) {
                return Math.round(((minPx + r - 1) / h) * 1000);
            }
        }
    } else {
        for (let r = startIdx; r < sliceH - 2; r++) {
            if (isRowWhite[r] && isRowWhite[r + 1] && isRowWhite[r + 2]) {
                return Math.round(((minPx + r + 1) / h) * 1000);
            }
        }
    }
    return Math.round(yNorm);
}

function autoTrim2DWhitespace(canvas) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    if (h < 50 || w < 50) return canvas;
    const imgData = ctx.getImageData(0, 0, w, h).data;
    let topRow = 0, botRow = h - 1;

    for (let y = 0; y < h; y++) {
        let hasInk = false;
        for (let x = 8; x < w - 8; x += 2) {
            const idx = (y * w + x) * 4;
            if (imgData[idx] < 240 || imgData[idx + 1] < 240 || imgData[idx + 2] < 240) { hasInk = true; break; }
        }
        if (hasInk) { topRow = Math.max(0, y - 20); break; }
    }
    for (let y = h - 1; y >= topRow; y--) {
        let hasInk = false;
        for (let x = 8; x < w - 8; x += 2) {
            const idx = (y * w + x) * 4;
            if (imgData[idx] < 240 || imgData[idx + 1] < 240 || imgData[idx + 2] < 240) { hasInk = true; break; }
        }
        if (hasInk) { botRow = Math.min(h - 1, y + 20); break; }
    }

    const trimmedH = Math.max(44, botRow - topRow + 1);
    if (trimmedH >= h - 6) return canvas;
    const trimmed = document.createElement('canvas');
    trimmed.width = w; trimmed.height = trimmedH;
    const tCtx = trimmed.getContext('2d');
    tCtx.fillStyle = '#FFFFFF';
    tCtx.fillRect(0, 0, w, trimmedH);
    tCtx.drawImage(canvas, 0, topRow, w, trimmedH, 0, 0, w, trimmedH);
    return trimmed;
}

function crop2DSliceFromPage(sourceCanvas, xminNorm, xmaxNorm, yminNorm, ymaxNorm, padTop = 8, padBottom = 8) {
    const w = sourceCanvas.width, h = sourceCanvas.height;
    const safeXMin = Math.max(0, xminNorm - 6);
    const safeXMax = Math.min(1000, xmaxNorm + 6);
    const safeYMin = Math.max(0, yminNorm - padTop);
    const safeYMax = Math.min(1000, ymaxNorm + padBottom);

    const cropX = Math.floor((safeXMin / 1000) * w);
    const cropW = Math.max(60, Math.floor(((safeXMax - safeXMin) / 1000) * w));
    const cropY = Math.floor((safeYMin / 1000) * h);
    const cropH = Math.max(44, Math.floor(((safeYMax - safeYMin) / 1000) * h));

    const outW = Math.min(1100, cropW);
    const outH = Math.floor(cropH * (outW / cropW));

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = outW; rawCanvas.height = outH;
    const ctx = rawCanvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    const finalCanvas = autoTrim2DWhitespace(rawCanvas);
    return {
        canvas: finalCanvas,
        dataUrl: finalCanvas.toDataURL('image/jpeg', 0.89),
        aspectRatio: finalCanvas.height / finalCanvas.width
    };
}

// ===================================================================
// LIVE AI ANSWER KEY & HINT SOLVER ENGINE + REAL-TIME LOGS CONSOLE
// ===================================================================
function appendSolverLog(msg, tone = 'info') {
    const box = document.getElementById('solverLiveLog');
    if (!box) return null;
    const d = document.createElement('div');
    if (tone === 'success') d.className = 'font-bold text-emerald-500 dark:text-emerald-400';
    else if (tone === 'stitch') d.className = 'font-extrabold text-amber-500 dark:text-amber-300';
    else if (tone === 'error') d.className = 'font-extrabold text-rose-500 dark:text-rose-400';
    else { d.className = 'font-semibold'; d.style.color = 'var(--md-primary)'; }
    d.textContent = `• ${msg}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
}

function updateSolverProgressEverywhere(pct, countBadgeText, subStatusText) {
    const cBadge = document.getElementById('solverModalCountBadge');
    const sText = document.getElementById('solverModalSubText');
    if (cBadge) cBadge.textContent = countBadgeText;
    if (sText) sText.textContent = subStatusText;
    renderM3WavyProgress('solverModalWavyBarWrap', pct);

    const minBadge = document.getElementById('minSolverCountBadge');
    const minTxt = document.getElementById('minSolverStatusText');
    if (minBadge) minBadge.textContent = countBadgeText;
    if (minTxt) minTxt.textContent = subStatusText;
    renderM3WavyProgress('minSolverWaveWrap', pct);

    const topBadgeTxt = document.getElementById('solverStatusText');
    if (topBadgeTxt) topBadgeTxt.textContent = countBadgeText;
    updateQuotaBadgesEverywhere();
    ensureM3MorphLoopRunning();
}

async function fetchSingleQuestionAnswerAndHint(q, abortSignal = null, onLog = null) {
    const apiKey = getApiKey();
    if (!apiKey || !q || !q.imageDataUrl) return null;
    const selectedModel = getSelectedModel();
    const base64Jpeg = q.imageDataUrl.split(',')[1];

    const promptText = `You are an expert IIT-JEE Advanced faculty solver.
Analyze this JEE question image (${q.subject} - ${q.chapter}).
1. Determine the exact final \`answerKey\` (e.g., "(B)", "(A, C)", "4", "18", or concise final expression).
2. Write a sharp, high-yield \`hint\` in strictly 1 single sentence that gives the core physical/chemical/mathematical principle or setup without giving away the full step-by-step algebra.`;

    const payload = {
        contents: [{
            role: "user",
            parts: [
                { text: promptText },
                { inlineData: { mimeType: "image/jpeg", data: base64Jpeg } }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    answerKey: { type: "STRING" },
                    hint: { type: "STRING" }
                },
                required: ["answerKey", "hint"]
            }
        }
    };

    const res = await executeRateLimitedGeminiFetch(selectedModel, payload, abortSignal, onLog);
    if (!res.ok) {
        const errBody = (await res.text()).slice(0, 140);
        throw new Error(`HTTP ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) throw new Error('Empty response from Gemini');
    const parsed = JSON.parse(txt);
    return {
        answerKey: String(parsed.answerKey || '').trim(),
        hint: String(parsed.hint || '').trim()
    };
}

async function runBackgroundAnswerAndHintGenerator(openModal = true, forceAll = false) {
    if (state.isRunningBackgroundSolver) {
        if (openModal) window.app.openSolverModal();
        return;
    }
    if (!getApiKey()) {
        window.app.openSettingsModal(true, 'KEYS');
        toast('Please save your Gemini API Key first!', 'warn');
        return;
    }

    const targets = forceAll
        ? [...state.questions]
        : state.questions.filter(q => !q.hint || !q.answerKey || q.answerKey === 'Not solved yet' || String(q.hint).trim().length < 5);

    if (openModal) window.app.openSolverModal();

    if (targets.length === 0) {
        appendSolverLog('✓ All questions in your vault already have Answer Keys & 1-Line Hints!', 'success');
        toast('All questions already have Answer Keys & 1-Line Hints ✓', 'success');
        return;
    }

    state.isRunningBackgroundSolver = true;
    state.stopSolverRequested = false;
    state.solverAbortController = new AbortController();

    const badge = document.getElementById('solverStatusBadge');
    const spinner = document.getElementById('solverModalSpinner');
    const titleTxt = document.getElementById('solverStepTitleText');
    const stopBtn = document.getElementById('stopSolverBtn');
    const startBtn = document.getElementById('startSolverMissingBtn');
    const forceBtn = document.getElementById('startSolverForceAllBtn');
    const prevImg = document.getElementById('solverPreviewImg');
    const prevPh = document.getElementById('solverPreviewPlaceholder');

    if (badge) { badge.classList.remove('hidden'); badge.classList.add('inline-flex'); }
    if (spinner) spinner.classList.remove('hidden');
    if (titleTxt) titleTxt.textContent = `Solving ${targets.length} Questions with ${getSelectedModel()}...`;
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('inline-flex'); }
    if (startBtn) startBtn.disabled = true;
    if (forceBtn) forceBtn.disabled = true;

    document.getElementById('solverLiveLog').innerHTML = '';
    appendSolverLog(`Starting batch solver for ${targets.length} questions using ${getSelectedModel()}...`, 'info');
    updateSolverProgressEverywhere(6, `Solved 0/${targets.length}`, `Initializing ${getSelectedModel()}...`);

    let solvedSuccessCount = 0;

    try {
        for (let idx = 0; idx < targets.length; idx++) {
            if (state.stopSolverRequested) break;
            const q = targets[idx];
            const liveQ = state.questions.find(item => item.id === q.id);
            if (!liveQ) continue;

            if (prevImg && prevPh) {
                prevImg.src = liveQ.imageDataUrl;
                prevImg.classList.remove('hidden');
                prevPh.classList.add('hidden');
            }

            const pct = Math.max(8, Math.round(((idx + 1) / targets.length) * 100));
            updateSolverProgressEverywhere(
                pct,
                `Solved ${solvedSuccessCount}/${targets.length}`,
                `Solving Q.${liveQ.questionNumber} (${liveQ.subject} • ${liveQ.chapter})...`
            );

            try {
                const res = await fetchSingleQuestionAnswerAndHint(
                    liveQ,
                    state.solverAbortController.signal,
                    (logMsg, tone) => appendSolverLog(logMsg, tone)
                );
                if (res && res.answerKey) {
                    liveQ.answerKey = res.answerKey;
                    liveQ.hint = res.hint || 'Apply fundamental chapter conservation/equilibrium equations.';
                    solvedSuccessCount++;
                    appendSolverLog(`✓ Q.${liveQ.questionNumber} (${liveQ.subject}): Ans = ${liveQ.answerKey} | Hint = ${liveQ.hint.slice(0, 68)}...`, 'success');
                    updateSolverProgressEverywhere(
                        pct,
                        `Solved ${solvedSuccessCount}/${targets.length}`,
                        `✓ Solved Q.${liveQ.questionNumber} → Ans: ${liveQ.answerKey}`
                    );
                    if (state.activePadId === liveQ.id) refreshScratchpadTopBarAndHints();
                }
            } catch (err) {
                if (err.name === 'AbortError' || state.stopSolverRequested) break;
                appendSolverLog(`⚠ Q.${liveQ.questionNumber} failed: ${err.message}`, 'error');
                if (String(err.message).includes('Daily limit reached')) {
                    break;
                }
            }
        }

        if (solvedSuccessCount > 0) {
            scheduleCloudAutoSync(true);
            toast(`Successfully solved ${solvedSuccessCount} questions & synced to Cloud!`, 'success');
        }
    } finally {
        state.isRunningBackgroundSolver = false;
        state.isSolverMinimized = false;
        if (badge) { badge.classList.add('hidden'); badge.classList.remove('inline-flex'); }
        if (spinner) spinner.classList.add('hidden');
        if (titleTxt) titleTxt.textContent = `Solver Finished (${solvedSuccessCount}/${targets.length} Solved)`;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('inline-flex'); }
        if (startBtn) startBtn.disabled = false;
        if (forceBtn) forceBtn.disabled = false;
        document.getElementById('minimizedSolverBar')?.classList.add('hidden');
        document.getElementById('minimizedSolverBar')?.classList.remove('flex');
        updateQuotaBadgesEverywhere();
    }
}
// ===================================================================
// MANUAL PER-QUESTION SOLVE TIMER & THEME ENGINE
// ===================================================================
function formatTimeSeconds(sec) {
    const total = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function initQuestionTimerIdle() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timerPaused = true;
    updateTimerUI();
}

function ensureTimerTicking() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        if (state.timerPaused) return;
        const activeId = state.activePadId || state.activePopupId;
        if (!activeId) return;
        const q = state.questions.find(i => i.id === Number(activeId));
        if (!q) return;
        if (state.blindModeActive) {
            q.reattemptTime = (Number(q.reattemptTime) || 0) + 1;
        } else {
            q.timeSpent = (Number(q.timeSpent) || 0) + 1;
        }
        updateTimerUI();
    }, 1000);
}

function stopQuestionTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timerPaused = true;
}

function updateTimerUI() {
    const activeId = state.activePadId || state.activePopupId;
    const q = state.questions.find(i => i.id === Number(activeId));
    const rawSec = state.blindModeActive ? (q?.reattemptTime || 0) : (q?.timeSpent || 0);
    const formatted = (state.blindModeActive ? 'R ' : '') + formatTimeSeconds(rawSec);

    const padTxt = document.getElementById('padTimerText');
    const padIcon = document.getElementById('padTimerIcon');
    if (padTxt) padTxt.textContent = formatted;
    if (padIcon) {
        padIcon.className = state.timerPaused
            ? 'ph-fill ph-play text-emerald-500 text-[10px]'
            : 'ph-fill ph-pause text-amber-500 text-[10px]';
    }

    document.querySelectorAll('.popup-timer-text').forEach(el => {
        el.textContent = formatted;
    });
    document.querySelectorAll('.popup-timer-icon').forEach(el => {
        el.className = state.timerPaused
            ? 'popup-timer-icon ph-fill ph-play text-emerald-500 text-xs'
            : 'popup-timer-icon ph-fill ph-pause text-amber-500 text-xs';
    });
}

function openCustomDropdown(anchorEl, options, currentVal, onSelectCallback) {
    const menu = document.getElementById('customDropdownMenu');
    const backdrop = document.getElementById('customDropdownBackdrop');
    if (!menu || !backdrop || !anchorEl) return;

    menu.innerHTML = options.map((opt, idx) => {
        const isSel = String(opt.value) === String(currentVal);
        return `
            <button type="button" data-idx="${idx}" class="m3-custom-menu-item ${isSel ? 'selected' : ''}">
                <span class="truncate flex items-center gap-2">
                    ${opt.colorDot ? `<span class="w-3.5 h-3.5 rounded-full inline-block shrink-0 border border-black/20" style="background:${opt.colorDot}"></span>` : ''}
                    ${opt.label}
                </span>
                ${isSel ? `<i class="ph-bold ph-check text-xs shrink-0"></i>` : ''}
            </button>
        `;
    }).join('');

    menu.querySelectorAll('.m3-custom-menu-item').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const picked = options[Number(btn.getAttribute('data-idx'))];
            closeCustomDropdown();
            if (picked && onSelectCallback) onSelectCallback(picked.value, picked.label, picked);
        };
    });

    backdrop.classList.remove('hidden');
    menu.classList.remove('hidden');

    const rect = anchorEl.getBoundingClientRect();
    const menuW = Math.max(rect.width, 195);
    menu.style.width = `${Math.min(320, menuW)}px`;

    let left = rect.left;
    if (left + menu.offsetWidth > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - menu.offsetWidth - 10);
    }
    let top = rect.bottom + 6;
    if (top + menu.offsetHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - menu.offsetHeight - 6);
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    const selItem = menu.querySelector('.m3-custom-menu-item.selected');
    if (selItem) {
        requestAnimationFrame(() => selItem.scrollIntoView({ block: 'nearest' }));
    }
}

function closeCustomDropdown() {
    document.getElementById('customDropdownMenu')?.classList.add('hidden');
    document.getElementById('customDropdownBackdrop')?.classList.add('hidden');
}

function hexToHsl(hex) {
    hex = String(hex || '#7c3aed').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyMaterialThemeFromSeed(hexSeed, modeOverride = null) {
    const cleanHex = /^#[0-9A-Fa-f]{6}$/.test(hexSeed) ? hexSeed : (localStorage.getItem('jee_m3_seed_color') || '#7c3aed');
    const mode = modeOverride || getThemeMode();
    const { h, s } = hexToHsl(cleanHex);
    const root = document.documentElement;
    const sat = Math.max(68, s);
    const hSec = (h + 20) % 360;
    const hTer = (h + 55) % 360;

    root.classList.toggle('dark', mode === 'dark');
    localStorage.setItem('jee_m3_theme_mode', mode);
    localStorage.setItem('jee_m3_seed_color', cleanHex);

    if (mode === 'light') {
        root.style.setProperty('--md-primary', `hsl(${h}, ${Math.min(85, sat)}%, 44%)`);
        root.style.setProperty('--md-on-primary', `#ffffff`);
        root.style.setProperty('--md-primary-container', `hsl(${h}, 78%, 91%)`);
        root.style.setProperty('--md-on-primary-container', `hsl(${h}, 85%, 18%)`);
        root.style.setProperty('--md-secondary-container', `hsl(${hSec}, 28%, 89%)`);
        root.style.setProperty('--md-on-secondary-container', `hsl(${hSec}, 40%, 16%)`);
        root.style.setProperty('--md-tertiary-container', `hsl(${hTer}, 72%, 91%)`);
        root.style.setProperty('--md-on-tertiary-container', `hsl(${hTer}, 78%, 18%)`);
        root.style.setProperty('--md-surface', `hsl(${h}, 20%, 95%)`);
        root.style.setProperty('--md-surface-low', `hsl(${h}, 24%, 98%)`);
        root.style.setProperty('--md-surface-container', `#ffffff`);
        root.style.setProperty('--md-surface-high', `hsl(${h}, 18%, 93%)`);
        root.style.setProperty('--md-surface-highest', `hsl(${h}, 18%, 88%)`);
        root.style.setProperty('--md-on-surface', `hsl(${h}, 24%, 11%)`);
        root.style.setProperty('--md-on-surface-variant', `hsl(${h}, 14%, 38%)`);
        root.style.setProperty('--md-outline', `hsl(${h}, 14%, 56%)`);
        root.style.setProperty('--md-outline-variant', `hsl(${h}, 16%, 84%)`);
        // Light semantic + inverse roles
        root.style.setProperty('--md-error', `hsl(354, 78%, 46%)`);
        root.style.setProperty('--md-on-error', `#ffffff`);
        root.style.setProperty('--md-error-container', `hsl(354, 92%, 93%)`);
        root.style.setProperty('--md-on-error-container', `hsl(354, 78%, 22%)`);
        root.style.setProperty('--md-success', `hsl(154, 72%, 34%)`);
        root.style.setProperty('--md-on-success', `#ffffff`);
        root.style.setProperty('--md-success-container', `hsl(154, 72%, 90%)`);
        root.style.setProperty('--md-on-success-container', `hsl(154, 78%, 16%)`);
        root.style.setProperty('--md-warning', `hsl(36, 86%, 40%)`);
        root.style.setProperty('--md-on-warning', `#ffffff`);
        root.style.setProperty('--md-warning-container', `hsl(40, 94%, 90%)`);
        root.style.setProperty('--md-on-warning-container', `hsl(36, 84%, 18%)`);
        root.style.setProperty('--md-inverse-surface', `hsl(${h}, 22%, 17%)`);
        root.style.setProperty('--md-inverse-on-surface', `hsl(${h}, 20%, 95%)`);
        root.style.setProperty('--md-inverse-primary', `hsl(${h}, ${sat}%, 78%)`);
        root.style.setProperty('--md-scrim', `rgba(12, 10, 24, 0.48)`);
        root.style.setProperty('--md-elevation-1', `0 1px 3px rgba(15, 23, 42, 0.10), 0 1px 2px rgba(15, 23, 42, 0.06)`);
        root.style.setProperty('--md-elevation-2', `0 4px 14px -2px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.08)`);
        root.style.setProperty('--md-elevation-3', `0 12px 28px -4px rgba(15, 23, 42, 0.20), 0 4px 10px -2px rgba(15, 23, 42, 0.10)`);
    } else {
        root.style.setProperty('--md-primary', `hsl(${h}, ${sat}%, 78%)`);
        root.style.setProperty('--md-on-primary', `hsl(${h}, 82%, 14%)`);
        root.style.setProperty('--md-primary-container', `hsl(${h}, 68%, 28%)`);
        root.style.setProperty('--md-on-primary-container', `hsl(${h}, 98%, 92%)`);
        root.style.setProperty('--md-secondary-container', `hsl(${hSec}, 42%, 22%)`);
        root.style.setProperty('--md-on-secondary-container', `hsl(${hSec}, 88%, 91%)`);
        root.style.setProperty('--md-tertiary-container', `hsl(${hTer}, 50%, 25%)`);
        root.style.setProperty('--md-on-tertiary-container', `hsl(${hTer}, 95%, 92%)`);
        root.style.setProperty('--md-surface', `hsl(${h}, 24%, 7%)`);
        root.style.setProperty('--md-surface-low', `hsl(${h}, 24%, 10%)`);
        root.style.setProperty('--md-surface-container', `hsl(${h}, 24%, 13%)`);
        root.style.setProperty('--md-surface-high', `hsl(${h}, 24%, 17%)`);
        root.style.setProperty('--md-surface-highest', `hsl(${h}, 24%, 22%)`);
        root.style.setProperty('--md-on-surface', `hsl(${h}, 20%, 96%)`);
        root.style.setProperty('--md-on-surface-variant', `hsl(${h}, 15%, 72%)`);
        root.style.setProperty('--md-outline', `hsl(${h}, 18%, 36%)`);
        root.style.setProperty('--md-outline-variant', `hsl(${h}, 18%, 20%)`);
        // Dark semantic + inverse roles
        root.style.setProperty('--md-error', `hsl(354, 92%, 75%)`);
        root.style.setProperty('--md-on-error', `hsl(354, 72%, 14%)`);
        root.style.setProperty('--md-error-container', `hsl(354, 58%, 26%)`);
        root.style.setProperty('--md-on-error-container', `hsl(354, 100%, 92%)`);
        root.style.setProperty('--md-success', `hsl(154, 68%, 62%)`);
        root.style.setProperty('--md-on-success', `hsl(154, 80%, 10%)`);
        root.style.setProperty('--md-success-container', `hsl(154, 50%, 20%)`);
        root.style.setProperty('--md-on-success-container', `hsl(154, 90%, 88%)`);
        root.style.setProperty('--md-warning', `hsl(38, 92%, 68%)`);
        root.style.setProperty('--md-on-warning', `hsl(38, 82%, 12%)`);
        root.style.setProperty('--md-warning-container', `hsl(38, 56%, 22%)`);
        root.style.setProperty('--md-on-warning-container', `hsl(38, 96%, 90%)`);
        root.style.setProperty('--md-inverse-surface', `hsl(${h}, 22%, 92%)`);
        root.style.setProperty('--md-inverse-on-surface', `hsl(${h}, 24%, 12%)`);
        root.style.setProperty('--md-inverse-primary', `hsl(${h}, 74%, 46%)`);
        root.style.setProperty('--md-scrim', `rgba(6, 5, 14, 0.72)`);
        root.style.setProperty('--md-elevation-1', `0 1px 3px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.18)`);
        root.style.setProperty('--md-elevation-2', `0 4px 12px -2px rgba(0, 0, 0, 0.36), 0 2px 4px rgba(0, 0, 0, 0.22)`);
        root.style.setProperty('--md-elevation-3', `0 12px 28px -4px rgba(0, 0, 0, 0.48), 0 4px 10px -2px rgba(0, 0, 0, 0.28)`);
    }

    document.getElementById('themeModeDarkBtn')?.classList.toggle('active', mode === 'dark');
    document.getElementById('themeModeLightBtn')?.classList.toggle('active', mode === 'light');
    requestAnimationFrame(() => updateAllSegmentedGliders());

    const picker = document.getElementById('customThemeColorPicker');
    if (picker) picker.value = cleanHex;
    const customPreview = document.getElementById('customColorSwatchPreview');
    if (customPreview) customPreview.style.background = cleanHex;
    const customHexLbl = document.getElementById('customColorHexLabel');
    if (customHexLbl) customHexLbl.textContent = cleanHex.toUpperCase();

    document.querySelectorAll('.m3-swatch-btn[data-seed-hex]').forEach(btn => {
        const isMatch = (btn.getAttribute('data-seed-hex') || '').toLowerCase() === cleanHex.toLowerCase();
        btn.classList.toggle('active-swatch', isMatch);
    });

    renderDrawerChapters();
    if (!waveAnimFrame && waveInstances.size > 0) {
        waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
    }
}

function initSwipeableStatusSegmentedBar() {
    const bar = document.getElementById('statusSegmentedBar');
    if (!bar) return;
    let isPointerDown = false;
    let startX = 0;

    const pickStatusAtPoint = (clientX, clientY) => {
        const el = document.elementFromPoint(clientX, clientY);
        const btn = el?.closest?.('.status-btn');
        if (btn) {
            const st = btn.getAttribute('data-status');
            if (st && st !== state.status) window.app.setStatus(st);
        }
    };

    bar.addEventListener('pointerdown', (e) => {
        isPointerDown = true;
        startX = e.clientX;
    });
    bar.addEventListener('pointermove', (e) => {
        if (!isPointerDown || Math.abs(e.clientX - startX) < 8) return;
        pickStatusAtPoint(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', () => { isPointerDown = false; });
    window.addEventListener('pointercancel', () => { isPointerDown = false; });
}

function toast(msg, type = 'info') {
    const box = document.getElementById('toastBox');
    if (!box) return;
    const isWarn = type === 'warn';
    const isSuccess = type === 'success';
    const el = document.createElement('div');
    el.className = `m3-snackbar ${isWarn ? 'is-warn' : ''}`;
    const iconName = isWarn ? 'ph-warning-circle' : (isSuccess ? 'ph-check-circle' : 'ph-info');
    const iconColor = isWarn ? 'var(--md-error)' : 'var(--md-inverse-primary)';
    el.innerHTML = `<i class="ph-fill ${iconName} text-base shrink-0" style="color: ${iconColor}"></i><span class="leading-snug">${msg}</span>`;

    const dismiss = () => {
        if (el._dismissed) return;
        el._dismissed = true;
        el.classList.add('is-exiting');
        setTimeout(() => el.remove(), 210);
    };
    el.onclick = dismiss;
    box.appendChild(el);
    // Keep snackbar stack tidy (max 3 visible)
    while (box.children.length > 3) {
        box.firstElementChild?.remove();
    }
    setTimeout(dismiss, isWarn ? 3600 : 2900);
}

// ===================================================================
// MATERIAL 3 EXPRESSIVE INTERACTION SYSTEMS (v4.0):
// 1. Delegated Tactile Ripple Wave
// 2. Inverse-Surface Rich Tooltip Controller
// 3. Dynamic Active-Track Slider Synchronizer (Standard & Centered)
// ===================================================================
function initM3Ripples() {
    if (document._m3RippleBound) return;
    document._m3RippleBound = true;
    const RIPPLE_SELECTOR = '.m3-btn-filled, .m3-btn-tonal, .m3-btn-error, .m3-btn-error-tonal, .m3-btn-success, .m3-seg-btn, .m3-icon-group-btn, .m3-group-item, .m3-custom-menu-item, .m3-extended-fab, .m3-dropdown-trigger, .m3-dropdown-field, .m3-swatch-btn, .m3-filter-chip, .m3-stepper-btn';

    document.addEventListener('pointerdown', (e) => {
        const target = e.target?.closest?.(RIPPLE_SELECTOR);
        if (!target || target.disabled || target.tagName === 'INPUT') return;
        // Avoid double ripple when clicking an interactive control nested inside an .m3-group-item
        if (target.classList.contains('m3-group-item') && e.target.closest('button, input, a')) return;

        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const size = Math.max(rect.width, rect.height);
        const wave = document.createElement('span');
        wave.className = 'm3-ripple-wave';
        wave.style.width = `${size}px`;
        wave.style.height = `${size}px`;
        wave.style.left = `${e.clientX - rect.left - size / 2}px`;
        wave.style.top = `${e.clientY - rect.top - size / 2}px`;
        target.appendChild(wave);
        wave.addEventListener('animationend', () => wave.remove(), { once: true });
    }, { passive: true });
}

function initM3Tooltips() {
    if (document._m3TooltipBound) return;
    document._m3TooltipBound = true;
    const tipEl = document.getElementById('m3Tooltip');
    if (!tipEl) return;

    let showTimer = null;
    let activeTarget = null;

    const hideTip = () => {
        clearTimeout(showTimer);
        activeTarget = null;
        tipEl.classList.remove('visible');
    };

    const showTipFor = (el) => {
        const text = el.getAttribute('data-m3-tip') || el.getAttribute('title');
        if (!text || !text.trim()) return;
        if (el.hasAttribute('title')) {
            el.setAttribute('data-m3-tip', text);
            el.removeAttribute('title');
        }
        activeTarget = el;
        tipEl.textContent = text;
        tipEl.classList.remove('visible');
        tipEl.style.left = '-9999px';
        tipEl.style.top = '-9999px';

        requestAnimationFrame(() => {
            if (activeTarget !== el || !document.body.contains(el)) return;
            const r = el.getBoundingClientRect();
            const tw = tipEl.offsetWidth || 120;
            const th = tipEl.offsetHeight || 28;

            let left = r.left + (r.width - tw) / 2;
            left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
            let top = r.bottom + 8;
            if (top + th > window.innerHeight - 10) {
                top = Math.max(8, r.top - th - 8);
            }
            tipEl.style.left = `${Math.round(left)}px`;
            tipEl.style.top = `${Math.round(top)}px`;
            tipEl.classList.add('visible');
        });
    };

    document.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const el = e.target?.closest?.('[title], [data-m3-tip]');
        if (!el) return;
        if (el === activeTarget) return;
        clearTimeout(showTimer);
        showTimer = setTimeout(() => showTipFor(el), 380);
    });

    document.addEventListener('pointerout', (e) => {
        if (!activeTarget) { clearTimeout(showTimer); return; }
        const related = e.relatedTarget;
        if (!related || !activeTarget.contains(related)) hideTip();
    });

    document.addEventListener('pointerdown', hideTip, { passive: true });
    window.addEventListener('scroll', hideTip, true);
    window.addEventListener('blur', hideTip);
}

function updateM3SliderTrack(sliderEl) {
    if (!sliderEl) return;
    const min = Number(sliderEl.min ?? 0);
    const max = Number(sliderEl.max ?? 100);
    const val = Number(sliderEl.value ?? 0);
    const span = Math.max(0.0001, max - min);
    const pct = Math.max(0, Math.min(100, ((val - min) / span) * 100));

    // Centered slider detection (e.g. angle slider -15..+15 fills outward from 50%)
    if (min < 0 && max > 0) {
        const zeroPct = ((0 - min) / span) * 100;
        sliderEl.style.setProperty('--slider-start', `${Math.min(zeroPct, pct).toFixed(2)}%`);
        sliderEl.style.setProperty('--slider-end', `${Math.max(zeroPct, pct).toFixed(2)}%`);
    } else {
        sliderEl.style.setProperty('--slider-start', '0%');
        sliderEl.style.setProperty('--slider-end', `${pct.toFixed(2)}%`);
    }
    sliderEl.style.setProperty('--slider-pct', `${pct.toFixed(2)}%`);
}

function initM3Sliders() {
    document.querySelectorAll('input[type="range"].split-slider').forEach(updateM3SliderTrack);
    if (document._m3SliderBound) return;
    document._m3SliderBound = true;
    document.addEventListener('input', (e) => {
        if (e.target && e.target.matches('input[type="range"].split-slider')) {
            updateM3SliderTrack(e.target);
        }
    });
}

// Image Import & Auto-Deskew
function estimateImageSkewAngle(img) {
    const w = 360;
    const h = Math.max(80, Math.round((img.height / (img.width || 1)) * w));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const ink = new Uint8Array(w * h);
    let sumLuma = 0;
    for (let i = 0; i < w * h; i++) {
        sumLuma += (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
    }
    const thresh = (sumLuma / (w * h)) * 0.82;
    for (let i = 0; i < w * h; i++) {
        const luma = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
        ink[i] = luma < thresh ? 1 : 0;
    }

    let bestAngle = 0, maxVariance = -1;
    const cx = w / 2, cy = h / 2;

    for (let deg = -12; deg <= 12; deg += 0.4) {
        const rad = (deg * Math.PI) / 180;
        const sinA = Math.sin(rad), cosA = Math.cos(rad);
        const rowCounts = new Int32Array(h);

        for (let y = 6; y < h - 6; y += 2) {
            for (let x = 10; x < w - 10; x += 2) {
                if (ink[y * w + x]) {
                    const projY = Math.round(cy - (x - cx) * sinA + (y - cy) * cosA);
                    if (projY >= 0 && projY < h) rowCounts[projY]++;
                }
            }
        }

        let variance = 0;
        for (let r = 1; r < h; r++) {
            const diff = rowCounts[r] - rowCounts[r - 1];
            variance += diff * diff;
        }
        if (variance > maxVariance) {
            maxVariance = variance;
            bestAngle = deg;
        }
    }
    return Math.abs(bestAngle) < 0.45 ? 0 : +bestAngle.toFixed(1);
}

function renderDeskewedAndCleanedImage(img, angleDeg, cleanContrast = true) {
    const canvas = document.getElementById('imageImportCanvas');
    if (!canvas || !img) return null;

    const scale = Math.min(1, 1200 / Math.max(img.width, 1));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((Number(angleDeg) * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    if (cleanContrast) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            if (luma > 205) {
                d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
            } else {
                const darkened = Math.max(0, Math.round((luma - 30) * 0.85));
                d[i] = darkened; d[i + 1] = darkened; d[i + 2] = darkened;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
    return canvas;
}

async function loadSingleImageForImport(fileOrBlob, labelName = 'Image') {
    if (!fileOrBlob) return;
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url);
        state.importMode = 'IMAGE';
        state.importRawImg = img;
        state.pdfDoc = null;

        document.getElementById('selectedFileLabel').textContent = labelName;
        document.getElementById('selectedFileTypeBadge').textContent = 'Detected: Question Photo / Screenshot • Auto-Deskew Active';
        document.getElementById('unifiedFileIcon').className = 'ph-duotone ph-image text-2xl';
        document.getElementById('pdfSetupSubView').classList.add('hidden');
        document.getElementById('pdfSetupSubView').classList.remove('grid');
        document.getElementById('imageSetupSubView').classList.remove('hidden');

        const startBtn = document.getElementById('startExtractBtn');
        const startLbl = document.getElementById('startExtractBtnLbl');
        if (startBtn) startBtn.disabled = false;
        if (startLbl) startLbl.textContent = 'Add Question Image';

        const detectedAngle = estimateImageSkewAngle(img);
        state.importDeskewAngle = detectedAngle;
        document.getElementById('imageDeskewSlider').value = detectedAngle;
        updateM3SliderTrack(document.getElementById('imageDeskewSlider'));
        document.getElementById('imageDeskewVal').textContent = `${detectedAngle}°`;
        renderDeskewedAndCleanedImage(img, detectedAngle, document.getElementById('imageCleanContrastChk').checked);
    };
    img.src = url;
}

async function onUnifiedFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

    if (isPdf) {
        state.importMode = 'PDF';
        state.importRawImg = null;
        document.getElementById('selectedFileLabel').textContent = file.name;
        document.getElementById('selectedFileTypeBadge').textContent = 'Detected: PDF Test Paper • Local Slicer + Gemini 3.8 Flash Border Verifier Ready';
        document.getElementById('unifiedFileIcon').className = 'ph-duotone ph-file-pdf text-2xl';
        document.getElementById('imageSetupSubView').classList.add('hidden');
        document.getElementById('pdfSetupSubView').classList.remove('hidden');
        document.getElementById('pdfSetupSubView').classList.add('grid');

        const titleEl = document.getElementById('paperTitleInput');
        if (!titleEl.value.trim()) titleEl.value = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');

        try {
            const buf = await file.arrayBuffer();
            state.pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
            document.getElementById('startPageInput').value = 1;
            document.getElementById('endPageInput').value = state.pdfDoc.numPages;
            document.getElementById('startExtractBtn').disabled = false;
            document.getElementById('startExtractBtnLbl').textContent = 'Extract Questions';
            toast(`Loaded PDF (${state.pdfDoc.numPages} pages)`, 'success');
            if (document.getElementById('pdfUseLocalAiBordersChk')?.checked) {
                window.app.refreshLocalAiBorderStatus(false);
            }
        } catch (_) {
            toast('Could not read PDF file', 'warn');
        }
    } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name || '')) {
        await loadSingleImageForImport(file, file.name);
    } else {
        toast('Unsupported file format. Select a PDF or Image.', 'warn');
    }
    e.target.value = '';
}

async function classifyAndSolveImportedImageWithGemini(base64Jpeg) {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    const selectedModel = getSelectedModel();

    const allChaps = [...JEE_CHAPTERS.Physics, ...JEE_CHAPTERS.Chemistry, ...JEE_CHAPTERS.Mathematics];
    const payload = {
        contents: [{
            role: "user",
            parts: [
                { text: "Classify this question into Physics, Chemistry, or Mathematics, pick its chapter, extract the question number if visible, and provide a 1-sentence hint and final answerKey." },
                { inlineData: { mimeType: "image/jpeg", data: base64Jpeg } }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    questionNumber: { type: "STRING" },
                    subject: { type: "STRING", enum: ["Physics", "Chemistry", "Mathematics"] },
                    chapter: { type: "STRING", enum: allChaps },
                    answerKey: { type: "STRING" },
                    hint: { type: "STRING" }
                },
                required: ["subject", "chapter", "answerKey", "hint"]
            }
        }
    };

    try {
        const res = await executeRateLimitedGeminiFetch(selectedModel, payload);
        if (!res.ok) return null;
        const data = await res.json();
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return txt ? JSON.parse(txt) : null;
    } catch (_) {
        return null;
    }
}

function cleanQuestionTextOnly(rawText) {
    if (!rawText) return '';
    const lines = String(rawText).split(/\r?\n/);
    const cleanLines = [];

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const tokens = line.split(/\s+/);
        const proseWords = tokens.filter(t => /[a-zA-Z]{3,}/.test(t)).length;
        const isOptionLine = /^\(?[A-D1-4]\)?[\.\)]/i.test(line);
        const isQuestionStart = /^(?:Q\.?\s*)?\d+/i.test(line);

        if (proseWords >= 2 || isOptionLine || isQuestionStart) {
            cleanLines.push(line);
        }
    }
    return (cleanLines.length > 0 ? cleanLines.join(' ') : String(rawText))
        .replace(/\s+/g, ' ')
        .trim();
}

async function getLocalTesseractWorker() {
    if (!state.ocrWorker) state.ocrWorker = await Tesseract.createWorker('eng');
    return state.ocrWorker;
}

async function recognizeImageTextWithTesseract(imageSource) {
    try {
        const worker = await getLocalTesseractWorker();
        const ret = await worker.recognize(imageSource);
        return cleanQuestionTextOnly(ret?.data?.text || '');
    } catch (_) {
        return '';
    }
}

async function runBackgroundLocalOcrForExistingQuestions(manualNotify = false) {
    if (state.isRunningBackgroundOcr) {
        if (manualNotify) toast('Local OCR indexing is already running!', 'info');
        return;
    }
    const targets = manualNotify
        ? state.questions
        : state.questions.filter(q => !q.ocrText || String(q.ocrText).trim().length < 15);

    if (targets.length === 0) {
        if (manualNotify) toast('All questions already have clean OCR text indexed ✓', 'success');
        return;
    }

    state.isRunningBackgroundOcr = true;
    const badge = document.getElementById('ocrStatusBadge');
    const badgeTxt = document.getElementById('ocrStatusText');
    const settingsBtnLbl = document.getElementById('settingsOcrBtnLabel');
    const settingsOcrWave = document.getElementById('settingsOcrWavyBar');
    if (badge) { badge.classList.remove('hidden'); badge.classList.add('inline-flex'); }
    if (settingsOcrWave) settingsOcrWave.classList.remove('hidden');

    let completed = 0, updatedAny = false;
    try {
        for (const q of targets) {
            if (!state.questions.some(item => item.id === q.id)) continue;
            completed++;
            const pct = Math.round((completed / targets.length) * 100);
            if (badgeTxt) badgeTxt.textContent = `${completed}/${targets.length}`;
            if (settingsBtnLbl) settingsBtnLbl.textContent = `Indexing Question ${completed} of ${targets.length} (${pct}%)...`;
            if (settingsOcrWave) renderM3WavyProgress(settingsOcrWave, pct);

            const extracted = await recognizeImageTextWithTesseract(q.imageDataUrl);
            const fallback = `${q.firstLineSnippet || ''} ${q.lastLineSnippet || ''}`.trim();
            q.ocrText = cleanQuestionTextOnly(`${extracted} ${fallback}`) || `Q.${q.questionNumber}`;
            updatedAny = true;
            if (state.search) renderFeed();
        }
        if (updatedAny) {
            scheduleCloudAutoSync(true);
            if (manualNotify) toast(`Indexed clean question text for ${completed} questions!`, 'success');
        }
    } finally {
        state.isRunningBackgroundOcr = false;
        if (badge) { badge.classList.add('hidden'); badge.classList.remove('inline-flex'); }
        if (settingsOcrWave) settingsOcrWave.classList.add('hidden');
        if (settingsBtnLbl) settingsBtnLbl.textContent = 'Re-Index Clean Question Text OCR';
    }
}

function updateApiKeyIndicator() {
    const dot = document.getElementById('apiKeyDot');
    if (!dot) return;
    if (getApiKey()) {
        dot.className = 'w-2 h-2 rounded-full absolute top-1 right-1';
        dot.style.background = 'var(--md-primary)';
    } else {
        dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping absolute top-1 right-1';
        dot.style.background = '';
    }
}

function updateCloudStatusUI(status = 'idle', detail = '') {
    const syncBtn = document.getElementById('syncHeaderBtn');
    const icon = document.getElementById('cloudStatusIcon');
    const txt = document.getElementById('cloudStatusText');
    const infoEl = document.getElementById('cloudLastSyncInfo');
    const settingsCloudWave = document.getElementById('settingsCloudWavyBar');
    if (!syncBtn || !icon || !txt) return;

    const lastSync = localStorage.getItem('jee_cloud_last_sync') || '';

    if (status === 'syncing') {
        setSyncButtonExpressiveProgress(true);
        if (settingsCloudWave) {
            settingsCloudWave.classList.remove('hidden');
            renderM3WavyProgress(settingsCloudWave, 75);
        }
        txt.textContent = detail || 'Sync';
    } else if (status === 'error') {
        setSyncButtonExpressiveProgress(false);
        if (settingsCloudWave) settingsCloudWave.classList.add('hidden');
        syncBtn.classList.remove('active-state');
        icon.className = 'ph-bold ph-cloud-warning text-rose-400 text-xs';
        txt.textContent = 'Err';
        if (infoEl && detail) infoEl.textContent = `Last Cloud Error: ${detail}`;
    } else {
        setSyncButtonExpressiveProgress(false);
        if (settingsCloudWave) settingsCloudWave.classList.add('hidden');
        syncBtn.classList.remove('active-state');
        icon.className = 'ph-bold ph-cloud-check text-xs';
        icon.style.color = 'var(--md-primary)';
        txt.textContent = `${state.questions.length}`;
        if (infoEl) {
            infoEl.textContent = lastSync
                ? `Last Cloud Sync: ${lastSync} • Gist ID: ${DEFAULT_GIST_ID}`
                : `Linked Gist ID: ${DEFAULT_GIST_ID}`;
        }
    }
}

let aspectUpdateTimer = null;
function ensureQuestionAspectRatio(q) {
    if (typeof q.aspectRatio === 'number' && q.aspectRatio > 0) return;
    q.aspectRatio = 0.42;
    const img = new Image();
    img.onload = () => {
        if (img.width > 0) {
            q.aspectRatio = img.height / img.width;
            const plane = document.getElementById('mainFeedContainer')?.firstElementChild;
            const isAnimatingPlane = plane && (
                plane.classList.contains('m3-feed-portal-reveal') ||
                plane.classList.contains('m3-plane-glide-right') ||
                plane.classList.contains('m3-plane-glide-left') ||
                plane.classList.contains('m3-plane-elevate')
            );
            if (!state.isExtracting && !isAnimatingPlane) {
                clearTimeout(aspectUpdateTimer);
                aspectUpdateTimer = setTimeout(() => renderFeed(), 120);
            }
        }
    };
    img.src = q.imageDataUrl; // MUST be outside img.onload!
}



function sortAndRefreshQuestions(skipRender = false) {
    state.questions.forEach(q => {
        if (q.id === undefined || q.id === null) q.id = generateUniqueId();
        if (!q.uid) q.uid = generateQuestionUid();
        if (q.hint === undefined) q.hint = '';
        if (q.answerKey === undefined) q.answerKey = '';
        if (q.whiteboardData === undefined) q.whiteboardData = null;
        if (q.timeSpent === undefined) q.timeSpent = 0;
        if (q.reattemptTime === undefined) q.reattemptTime = 0;
        if (q.noteTag === undefined) q.noteTag = '';
        if (!Array.isArray(q.eliminatedOptions)) q.eliminatedOptions = [];
        ensureQuestionAspectRatio(q);
    });
    state.questions.sort((a, b) => {
        if (state.sortBy === 'TIME_DESC') {
            const tDiff = (Number(b.timeSpent) || 0) - (Number(a.timeSpent) || 0);
            if (tDiff !== 0) return tDiff;
        } else if (state.sortBy === 'NEWEST') {
            const cDiff = (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
            if (cDiff !== 0) return cDiff;
        }
        const nA = parseFloat(String(a.questionNumber).replace(/[^\d.]/g, '')) || 9999;
        const nB = parseFloat(String(b.questionNumber).replace(/[^\d.]/g, '')) || 9999;
        return nA !== nB ? nA - nB : String(a.questionNumber).localeCompare(String(b.questionNumber));
    });
    updateCloudStatusUI(state.isSyncingCloud ? 'syncing' : 'idle');
    updateQuotaBadgesEverywhere();
    if (!skipRender && !state.isExtracting) {
        renderAll();
    }
}

let cloudSyncTimer = null;
function scheduleCloudAutoSync(skipFullRender = false, allowEmptyPush = false) {
    if (!skipFullRender) {
        sortAndRefreshQuestions();
    } else {
        refreshCountsAndDrawerOnly();
    }
    if (!getGithubToken() || !isCloudAutoSyncEnabled() || state.isExtracting) return;
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => pushToCloudGist(false, allowEmptyPush), 1200);
}

const sanitizePaperFilename = (p) => `jee_vault_paper_${String(p || 'Default_Paper').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45) || 'Default'}.json`;

async function pushToCloudGist(manualNotify = false, allowEmptyPush = false) {
    const tokenInp = document.getElementById('githubTokenInput');
    if (tokenInp?.value.trim()) localStorage.setItem('jee_github_pat', tokenInp.value.trim());

    const token = getGithubToken();
    if (!token) {
        if (manualNotify) {
            window.app.openSettingsModal(false, 'KEYS');
            toast('Paste your GitHub Personal Access Token (gist scope) first!', 'warn');
        }
        return;
    }

    if (state.questions.length === 0 && !allowEmptyPush) {
        if (manualNotify) toast('Vault is empty — pulling from Cloud instead to protect your backup!', 'info');
        await pullFromCloudGist(manualNotify);
        return;
    }

    if (state.isSyncingCloud) { state.hasPendingCloudPush = true; return; }
    state.isSyncingCloud = true;
    state.hasPendingCloudPush = false;
    updateCloudStatusUI('syncing', 'Push');

    try {
        const paperGroups = {};
        state.questions.forEach(q => {
            if (!q.uid) q.uid = generateQuestionUid();
            const pName = q.paperName || 'Default Paper';
            (paperGroups[pName] = paperGroups[pName] || []).push(q);
        });

        const filesPayload = {
            'jee_vault_manifest.json': {
                content: JSON.stringify({
                    app: 'JEE Sorter Cloud Vault',
                    updatedAt: new Date().toISOString(),
                    totalQuestions: state.questions.length,
                    rateLimit: normalizeRateLimitObj(state.rateLimit),
                    papers: Object.keys(paperGroups).map(p => ({
                        paperName: p,
                        fileName: sanitizePaperFilename(p),
                        count: paperGroups[p].length
                    }))
                }, null, 2)
            }
        };

        for (const [pName, qList] of Object.entries(paperGroups)) {
            filesPayload[sanitizePaperFilename(pName)] = { content: JSON.stringify(qList) };
        }

        const gistId = getGithubGistId();
        const checkRes = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
        });
        if (checkRes.ok) {
            const existingGist = await checkRes.json();
            Object.keys(existingGist.files || {}).forEach(oldFile => {
                if (oldFile.startsWith('jee_vault_paper_') && !filesPayload[oldFile]) filesPayload[oldFile] = null;
            });
        }

        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'JEE Sorter Question Vault Cloud Backup (Auto-Synced)',
                files: filesPayload
            })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        localStorage.setItem('jee_cloud_last_sync', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        updateCloudStatusUI('idle');
        if (manualNotify) toast(`Synced ${state.questions.length} questions & rough work to GitHub Secret Gist!`, 'success');
    } catch (err) {
        updateCloudStatusUI('error', err.message);
        if (manualNotify) toast(`Cloud Push failed: ${err.message}`, 'warn');
    } finally {
        state.isSyncingCloud = false;
        if (state.hasPendingCloudPush) {
            state.hasPendingCloudPush = false;
            pushToCloudGist(false);
        }
    }
}

async function pullFromCloudGist(manualNotify = false) {
    const tokenInp = document.getElementById('githubTokenInput');
    if (tokenInp?.value.trim()) localStorage.setItem('jee_github_pat', tokenInp.value.trim());

    const token = getGithubToken();
    state.isSyncingCloud = true;
    updateCloudStatusUI('syncing', 'Pull');
    if (state.questions.length === 0) renderFeed();

    try {
        const gistId = getGithubGistId();
        const headers = { 'Accept': 'application/vnd.github+json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
            headers,
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const gistData = await res.json();
        const manifestContent = gistData.files?.['jee_vault_manifest.json']?.content;
        if (manifestContent) {
            try {
                const parsedManifest = JSON.parse(manifestContent);
                if (parsedManifest.rateLimit) {
                    state.rateLimit = normalizeRateLimitObj(parsedManifest.rateLimit);
                    localStorage.setItem('jee_rate_limit_cache', JSON.stringify(state.rateLimit));
                }
            } catch (_) {}
        }

        const restoredQuestions = [];
        let anyMissingUid = false;

        for (const [fName, fileObj] of Object.entries(gistData.files || {})) {
            if (!fName.startsWith('jee_vault_paper_')) continue;
            let rawJson = fileObj.content;
            if (fileObj.truncated && fileObj.raw_url) {
                rawJson = await (await fetch(fileObj.raw_url, { cache: 'no-store' })).text();
            }
            if (rawJson) {
                const parsed = JSON.parse(rawJson);
                if (Array.isArray(parsed)) restoredQuestions.push(...parsed);
            }
        }

        state.wbBoards = {};
        state.questions = restoredQuestions.map(r => {
            if (!r.uid) anyMissingUid = true;
            return {
                ...r,
                id: r.id || generateUniqueId(),
                uid: r.uid || generateQuestionUid(),
                hint: r.hint || '',
                answerKey: r.answerKey || '',
                whiteboardData: r.whiteboardData || null,
                timeSpent: Number(r.timeSpent) || 0,
                reattemptTime: Number(r.reattemptTime) || 0,
                noteTag: r.noteTag || '',
                eliminatedOptions: Array.isArray(r.eliminatedOptions) ? r.eliminatedOptions : []
            };
        });                
        localStorage.setItem('jee_cloud_last_sync', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        await runSynchronizedCloudPortalReveal();

        if (manualNotify) toast(`Pulled ${state.questions.length} questions from GitHub Cloud!`, 'success');
        if (anyMissingUid && token) scheduleCloudAutoSync(true);
        checkAndOpenQuestionFromUrlHash();
        runBackgroundLocalOcrForExistingQuestions(false);
    } catch (err) {
        state.isSyncingCloud = false;
        updateCloudStatusUI('error', err.message);
        renderFeed();
        if (manualNotify) toast(`Cloud Pull failed: ${err.message}`, 'warn');
    }
}

function exportBackupJson() {
    if (state.questions.length === 0) return toast('No questions in Cloud Vault to export yet!', 'warn');
    const blob = new Blob([JSON.stringify({
        app: 'Material 3 Question Vault',
        exportedAt: new Date().toISOString(),
        count: state.questions.length,
        questions: state.questions
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jee-questions-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${state.questions.length} questions to JSON backup!`, 'success');
}

async function importBackupJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        const records = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        if (!records.length) return toast('Invalid or empty backup JSON file', 'warn');
        state.questions.push(...records.map(r => ({
            ...r,
            id: generateUniqueId(),
            uid: r.uid || generateQuestionUid(),
            hint: r.hint || '',
            answerKey: r.answerKey || '',
            whiteboardData: r.whiteboardData || null,
            timeSpent: Number(r.timeSpent) || 0,
            reattemptTime: Number(r.reattemptTime) || 0,
            noteTag: r.noteTag || '',
            eliminatedOptions: Array.isArray(r.eliminatedOptions) ? r.eliminatedOptions : []
        })));
        scheduleCloudAutoSync();
        toast(`Imported ${records.length} questions & syncing to Cloud!`, 'success');
        runBackgroundLocalOcrForExistingQuestions(false);
    } catch (err) {
        toast('Failed to import JSON: ' + err.message, 'warn');
    } finally {
        event.target.value = '';
    }
}

async function stitchCanvasesVertically(topDataUrl, botDataUrl) {
    const loadImg = (src) => new Promise((res, rej) => {
        const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
    });
    const [topImg, botImg] = await Promise.all([loadImg(topDataUrl), loadImg(botDataUrl)]);
    const targetW = Math.max(topImg.width, botImg.width);
    const topH = Math.round(topImg.height * (targetW / topImg.width));
    const botH = Math.round(botImg.height * (targetW / botImg.width));

    const c = document.createElement('canvas');
    c.width = targetW; c.height = topH + botH + 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(topImg, 0, 0, targetW, topH);
    ctx.drawImage(botImg, 0, topH + 4, targetW, botH);
    return { dataUrl: c.toDataURL('image/jpeg', 0.88), aspectRatio: c.height / c.width };
}

function appendExtractLog(msg, tone = 'info') {
    const box = document.getElementById('extractLiveLog');
    if (!box) return null;
    const d = document.createElement('div');
    if (tone === 'success') d.className = 'font-bold text-emerald-500 dark:text-emerald-400';
    else if (tone === 'stitch') d.className = 'font-extrabold text-amber-500 dark:text-amber-300';
    else if (tone === 'error') d.className = 'font-extrabold text-rose-500 dark:text-rose-400';
    else { d.className = 'font-semibold'; d.style.color = 'var(--md-primary)'; }
    d.textContent = `• ${msg}`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
}

function setUploadButtonsLock(isUploading) {
    const topClose = document.getElementById('uploadTopCloseBtn');
    const minBtn = document.getElementById('minimizeUploadBtn');
    const cancelBtn = document.getElementById('cancelExtractBtn');
    const startBtn = document.getElementById('startExtractBtn');
    if (topClose) topClose.disabled = isUploading;
    if (startBtn) startBtn.disabled = isUploading;
    if (minBtn) {
        minBtn.classList.toggle('hidden', !isUploading);
        minBtn.classList.toggle('flex', isUploading);
    }
    if (cancelBtn) {
        cancelBtn.classList.toggle('hidden', !isUploading);
        cancelBtn.classList.toggle('inline-flex', isUploading);
    }
    if (isUploading) ensureM3MorphLoopRunning();
}

function updateUploadProgressEverywhere(pct, pageBadgeText, subStatusText) {
    document.getElementById('extractPageBadge').textContent = pageBadgeText;
    document.getElementById('extractSubText').textContent = subStatusText;
    renderM3WavyProgress('extractWavyBarWrap', pct);

    const minBadge = document.getElementById('minBarPageBadge');
    const minTxt = document.getElementById('minBarStatusText');
    if (minBadge) minBadge.textContent = pageBadgeText;
    if (minTxt) minTxt.textContent = subStatusText;
    renderM3WavyProgress('minBarWaveWrap', pct);
    ensureM3MorphLoopRunning();
}

function cancelPdfExtraction() {
    if (!state.isExtracting) return;
    state.cancelExtractionRequested = true;
    try { state.extractionAbortController?.abort(); } catch (_) {}

    const cancelSet = new Set(state.currentUploadBatchIds);
    state.questions = state.questions.filter(q => !cancelSet.has(q.id));
    state.currentUploadBatchIds = [];
    state.isExtracting = false;
    state.isUploadMinimized = false;

    document.getElementById('minimizedUploadBar')?.classList.add('hidden');
    document.getElementById('minimizedUploadBar')?.classList.remove('flex');
    setUploadButtonsLock(false);
    setUploadStudioExpanded(false);
    document.getElementById('uploadModal').classList.add('hidden');
    toast('Upload cancelled & all questions from that PDF were rolled back.', 'warn');
}

        // Full-Document Local Vision Engine Pipeline (Optional Manual Cropper & Optional Gemini Verifier)
// ===================================================================
// LIVE EXTRACTION VISUALIZER STUDIO HELPERS (ZERO-SCROLL + REAL-TIME)
// ===================================================================
let extractResizeObserver = null;

function setUploadStudioExpanded(expanded) {
    const dialog = document.getElementById('uploadModalDialog');
    const body = document.getElementById('uploadModalBody');
    const delayWrap = document.getElementById('extractVisualDelayHeaderWrap');
    const setupView = document.getElementById('uploadSetupView');
    const progView = document.getElementById('uploadProgressView');

    if (dialog) dialog.classList.toggle('upload-studio-expanded', Boolean(expanded));
    if (body) {
        if (expanded) {
            body.className = 'p-0 overflow-hidden flex-1 min-h-0 flex flex-col';
        } else {
            body.className = 'p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0';
        }
    }
    if (delayWrap) {
        delayWrap.classList.toggle('hidden', !expanded);
        delayWrap.classList.toggle('inline-flex', Boolean(expanded));
    }
    if (setupView) setupView.classList.toggle('hidden', Boolean(expanded));
    if (progView) progView.classList.toggle('hidden', !expanded);

    if (expanded) {
        ensureExtractViewportObserver();
        requestAnimationFrame(() => {
            fitExtractPageFrame(true);
            if (!waveAnimFrame) waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
        });
    }
}

let lastFittedExtractSize = { w: 0, h: 0 };

function fitExtractPageFrame(force = false) {
    const viewport = document.getElementById('extractPdfViewport');
    const frame = document.getElementById('extractPageFrame');
    const canvas = document.getElementById('pdfWorkCanvas');
    if (!viewport || !frame || !canvas) return;
    if (viewport.offsetParent === null) return;

    const cw = canvas.width || 600;
    const ch = canvas.height || 840;
    const availW = Math.max(120, viewport.clientWidth - 24);
    const availH = Math.max(160, viewport.clientHeight - 24);
    const scale = Math.min(availW / cw, availH / ch);

    const targetW = Math.max(100, Math.floor(cw * scale));
    const targetH = Math.max(120, Math.floor(ch * scale));
    if (!force && Math.abs(targetW - lastFittedExtractSize.w) < 2 && Math.abs(targetH - lastFittedExtractSize.h) < 2) {
        return;
    }
    lastFittedExtractSize = { w: targetW, h: targetH };
    frame.style.width = `${targetW}px`;
    frame.style.height = `${targetH}px`;
}

function ensureExtractViewportObserver() {
    const viewport = document.getElementById('extractPdfViewport');
    if (!viewport || extractResizeObserver || typeof ResizeObserver === 'undefined') return;
    extractResizeObserver = new ResizeObserver(() => {
        if (state.isExtracting && !state.isUploadMinimized) {
            fitExtractPageFrame();
        }
    });
    extractResizeObserver.observe(viewport);
}

function isExtractVisualPacingEnabled() {
    const chk = document.getElementById('extractVisualDelayChk');
    return chk ? Boolean(chk.checked) : true;
}

function abortablePacingSleep(ms, signal, allowSkipWhenPacingOff = true) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const start = performance.now();
        const checkTick = () => {
            if (signal?.aborted || state.cancelExtractionRequested) {
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            if (allowSkipWhenPacingOff && !isExtractVisualPacingEnabled()) {
                resolve();
                return;
            }
            const elapsed = performance.now() - start;
            if (elapsed >= ms) {
                resolve();
                return;
            }
            setTimeout(checkTick, Math.min(65, ms - elapsed));
        };
        checkTick();
    });
}

function updateExtractActiveTelemetry({ pageNum = null, stagePill = null, stageTone = 'warn', qBadge = null, phaseText = null, chapterText = null, doneCount = null }) {
    if (pageNum !== null) {
        const pEl = document.getElementById('extractPreviewPagePill');
        if (pEl) pEl.textContent = `Page ${pageNum}`;
    }
    if (stagePill !== null) {
        const stEl = document.getElementById('extractLiveStagePill');
        if (stEl) {
            stEl.textContent = stagePill;
            const toneCls = stageTone === 'success' ? 'm3-badge-success' : (stageTone === 'primary' ? 'm3-primary-pill' : 'm3-badge-warn');
            stEl.className = `px-2.5 py-0.5 rounded-full ${toneCls} text-[10.5px] font-extrabold truncate`;
        }
    }
    if (qBadge !== null) {
        const qb = document.getElementById('extractActiveQBadge');
        if (qb) qb.textContent = qBadge;
    }
    if (phaseText !== null) {
        const pt = document.getElementById('extractActivePhaseText');
        if (pt) pt.textContent = phaseText;
    }
    if (chapterText !== null) {
        const ct = document.getElementById('extractActiveChapterText');
        if (ct) ct.textContent = chapterText;
    }
    if (doneCount !== null) {
        const dc = document.getElementById('extractDoneCountPill');
        if (dc) dc.textContent = `${doneCount} done`;
    }
}

let extractStaticSignature = '';

function showExtractPageSweepOverlay(message = 'Scanning layout...') {
    const layer = document.getElementById('extractOverlayLayer');
    if (!layer) return;
    extractStaticSignature = '';
    layer.innerHTML = `<div class="ex-page-sweep-track"><div class="ex-page-sweep-line"></div></div>`;
    updateExtractActiveTelemetry({ stagePill: message, stageTone: 'primary' });
}

function ensureExtractPersistentLayers() {
    const layer = document.getElementById('extractOverlayLayer');
    if (!layer) return null;
    if (!layer.querySelector('#exStaticLayer')) {
        layer.innerHTML = `
            <div id="exStaticLayer"></div>
            <div id="exScrimLayer">
                <div id="exScrimTop" class="ex-scrim-pane"></div>
                <div id="exScrimBot" class="ex-scrim-pane"></div>
                <div id="exScrimLeft" class="ex-scrim-pane"></div>
                <div id="exScrimRight" class="ex-scrim-pane"></div>
            </div>
            <div id="exActiveBox" class="ex-active-box">
                <span class="ex-corner tl"></span>
                <span class="ex-corner tr"></span>
                <span class="ex-corner bl"></span>
                <span class="ex-corner br"></span>
                <div class="ex-scan-beam-track"><div class="ex-scan-beam"></div></div>
                <span class="ex-active-badge"></span>
            </div>
        `;
    }
    return {
        staticLayer: layer.querySelector('#exStaticLayer'),
        scrimTop: layer.querySelector('#exScrimTop'),
        scrimBot: layer.querySelector('#exScrimBot'),
        scrimLeft: layer.querySelector('#exScrimLeft'),
        scrimRight: layer.querySelector('#exScrimRight'),
        boxEl: layer.querySelector('#exActiveBox')
    };
}

function renderExtractPageBoxes({ doneBoxes = [], pendingBoxes = [], activeBox = null }) {
    const dom = ensureExtractPersistentLayers();
    if (!dom) return;

    // Only rebuild static done/ghost boxes when they actually change (prevents 4x/question DOM churn!)
    const sig = `${doneBoxes.length}|${pendingBoxes.length}|${doneBoxes.map(d => d.qNum).join(',')}`;
    if (sig !== extractStaticSignature) {
        extractStaticSignature = sig;
        const frag = document.createDocumentFragment();
        for (const pb of pendingBoxes) {
            const d = document.createElement('div');
            d.className = 'ex-ghost-box';
            d.style.left = `${(pb.xmin / 10).toFixed(2)}%`;
            d.style.top = `${(pb.ymin / 10).toFixed(2)}%`;
            d.style.width = `${Math.max(2, (pb.xmax - pb.xmin) / 10).toFixed(2)}%`;
            d.style.height = `${Math.max(1.5, (pb.ymax - pb.ymin) / 10).toFixed(2)}%`;
            frag.appendChild(d);
        }
        for (const db of doneBoxes) {
            const d = document.createElement('div');
            d.className = 'ex-done-box';
            d.style.left = `${(db.xmin / 10).toFixed(2)}%`;
            d.style.top = `${(db.ymin / 10).toFixed(2)}%`;
            d.style.width = `${Math.max(2, (db.xmax - db.xmin) / 10).toFixed(2)}%`;
            d.style.height = `${Math.max(1.5, (db.ymax - db.ymin) / 10).toFixed(2)}%`;
            const tag = db.isStitched ? `🔗 Q.${db.qNum}` : `✓ Q.${db.qNum}${db.chapter ? ' • ' + db.chapter : ''}`;
            d.innerHTML = `<span class="ex-done-pill">${tag}</span>`;
            frag.appendChild(d);
        }
        dom.staticLayer.replaceChildren(frag);
    }

    if (!activeBox) {
        dom.boxEl.style.display = 'none';
        dom.scrimTop.style.opacity = '0';
        dom.scrimBot.style.opacity = '0';
        dom.scrimLeft.style.opacity = '0';
        dom.scrimRight.style.opacity = '0';
        return;
    }

    dom.boxEl.style.display = '';
    const leftPct = Math.max(0, Math.min(98, activeBox.xmin / 10));
    const topPct = Math.max(0, Math.min(98.5, activeBox.ymin / 10));
    const widthPct = Math.max(2, Math.min(100 - leftPct, (activeBox.xmax - activeBox.xmin) / 10));
    const heightPct = Math.max(1.5, Math.min(100 - topPct, (activeBox.ymax - activeBox.ymin) / 10));
    const rightStartPct = Math.min(100, leftPct + widthPct);
    const botStartPct = Math.min(100, topPct + heightPct);

    // Update 4 lightweight GPU scrim panes around the active question (ZERO 9999px shadow flicker!)
    dom.scrimTop.style.opacity = '1';
    dom.scrimTop.style.left = '0%';
    dom.scrimTop.style.top = '0%';
    dom.scrimTop.style.width = '100%';
    dom.scrimTop.style.height = `${topPct.toFixed(2)}%`;

    dom.scrimBot.style.opacity = '1';
    dom.scrimBot.style.left = '0%';
    dom.scrimBot.style.top = `${botStartPct.toFixed(2)}%`;
    dom.scrimBot.style.width = '100%';
    dom.scrimBot.style.height = `${Math.max(0, 100 - botStartPct).toFixed(2)}%`;

    dom.scrimLeft.style.opacity = '1';
    dom.scrimLeft.style.left = '0%';
    dom.scrimLeft.style.top = `${topPct.toFixed(2)}%`;
    dom.scrimLeft.style.width = `${leftPct.toFixed(2)}%`;
    dom.scrimLeft.style.height = `${heightPct.toFixed(2)}%`;

    dom.scrimRight.style.opacity = '1';
    dom.scrimRight.style.left = `${rightStartPct.toFixed(2)}%`;
    dom.scrimRight.style.top = `${topPct.toFixed(2)}%`;
    dom.scrimRight.style.width = `${Math.max(0, 100 - rightStartPct).toFixed(2)}%`;
    dom.scrimRight.style.height = `${heightPct.toFixed(2)}%`;

    dom.boxEl.classList.remove('is-adjusting', 'is-ocr', 'is-locked');
    if (activeBox.mode === 'adjusting') dom.boxEl.classList.add('is-adjusting');
    else if (activeBox.mode === 'ocr') dom.boxEl.classList.add('is-ocr');
    else if (activeBox.mode === 'locked') dom.boxEl.classList.add('is-locked');

    dom.boxEl.style.left = `${leftPct.toFixed(2)}%`;
    dom.boxEl.style.top = `${topPct.toFixed(2)}%`;
    dom.boxEl.style.width = `${widthPct.toFixed(2)}%`;
    dom.boxEl.style.height = `${heightPct.toFixed(2)}%`;

    const badgeEl = dom.boxEl.querySelector('.ex-active-badge');
    if (badgeEl) badgeEl.textContent = activeBox.label || '';
}

async function startPdfExtraction() {
    if (!state.pdfDoc || state.isExtracting) return;

    state.isExtracting = true;
    state.isUploadMinimized = false;
    state.cancelExtractionRequested = false;
    state.extractionAbortController = new AbortController();
    state.currentUploadBatchIds = [];
    setUploadButtonsLock(true);

    const paperName = document.getElementById('paperTitleInput').value.trim() || 'Test Paper';
    const defaultSubj = state.pdfDefaultSubject || 'AUTO';
    const useLocalAiBorders = Boolean(document.getElementById('pdfUseLocalAiBordersChk')?.checked);
    const reviewBeforeSaving = Boolean(document.getElementById('pdfReviewAfterExtractChk')?.checked);
    const useGeminiVerifier = Boolean(document.getElementById('pdfGeminiVerifyBordersChk')?.checked);
    let manualModeForRemaining = Boolean(document.getElementById('pdfManualCropModeChk')?.checked);
    const startP = Math.max(1, parseInt(document.getElementById('startPageInput').value, 10) || 1);
    const endP = Math.min(state.pdfDoc.numPages, parseInt(document.getElementById('endPageInput').value, 10) || state.pdfDoc.numPages);
    const { padTop, padBottom } = getVerticalPads();

    setUploadStudioExpanded(true);
    document.getElementById('extractLiveLog').innerHTML = '';
    updateUploadProgressEverywhere(6, `Page ${startP}/${endP}`, `Initializing Local Vision Engine...`);
    updateExtractActiveTelemetry({
        pageNum: `${startP}/${endP}`,
        stagePill: 'Rendering Pages...',
        stageTone: 'primary',
        qBadge: 'PDF',
        phaseText: 'Analyzing document geometry...',
        chapterText: `Pages ${startP}–${endP}`,
        doneCount: 0
    });
    showExtractPageSweepOverlay('Scanning Layout...');

    const previewCanvas = document.getElementById('pdfWorkCanvas');
    const previewCtx = previewCanvas.getContext('2d');

    const batchQuestions = [];
    const pageCanvasMap = new Map();
    let prevQuestion = null;
    let extractedCount = 0;

    try {
        const countPages = Math.max(1, endP - startP + 1);
        const engine = window.JEELocalVisionEngine;

        if (!engine || typeof engine.analyzeDocument !== 'function') {
            throw new Error('local-vision-engine.js failed to load. Check that local-vision-engine.js is in the same folder as index.html.');
        }

        // =============================================================
        // STAGE 1: Whole-Document Offline Analysis (Borders, Stitching,
        // Answer Key Page Skipping & Local 78-Chapter Classifier)
        // =============================================================
        appendExtractLog(`Running Local Vision Engine v${engine.version} across Pages ${startP}–${endP}...`, 'info');
        const docAnalysis = await engine.analyzeDocument(state.pdfDoc, {
            paperName,
            defaultSubject: defaultSubj,
            startPage: startP,
            endPage: endP,
            renderScale: 2.2,
            enableAnswerKeyCutoff: true,
            enableAnswerKeyParsing: false,
            abortSignal: state.extractionAbortController.signal,
            onProgress: (info) => {
                const mappedPct = Math.max(6, Math.min(48, Math.round((info.percent || 0) * 0.48)));
                updateUploadProgressEverywhere(
                    mappedPct,
                    `Page ${info.pageNum || startP}/${endP}`,
                    info.message || 'Analyzing layout locally...'
                );
            }
        });

        if (state.cancelExtractionRequested) return;

        if (docAnalysis.detectedWorksheetPrior) {
            const wp = docAnalysis.detectedWorksheetPrior;
            appendExtractLog(`📘 Detected single-chapter worksheet prior: ${wp.subject} • ${wp.chapter}`, 'success');
        }

        // =============================================================
        // OPTIONAL PRE-CHECK: Connect to Native Local AI for Borders &
        // Stitching ONLY (Fails fast in ~2.5s if Termux isn't running)
        // =============================================================
        let localAiBordersReady = false;
        const aiBatchSummary = {
            requested: Boolean(useLocalAiBorders && !manualModeForRemaining),
            connected: false,
            backend: '',
            modelName: '',
            pagesChecked: 0,
            pagesRefined: 0,
            pagesFailed: 0,
            totalMs: 0,
            offlineReason: ''
        };
        const aiBorders = window.JEELocalAIBorders;
        if (useLocalAiBorders && aiBorders && !manualModeForRemaining) {
            try {
                const conn = await aiBorders.connect({
                    waitForBootMs: 9000,
                    abortSignal: state.extractionAbortController.signal,
                    onProgress: (info) => {
                        updateUploadProgressEverywhere(50, 'Local AI', info.message || 'Connecting to Termux AI...');
                    }
                });
                localAiBordersReady = Boolean(conn && conn.ok);
                aiBatchSummary.connected = localAiBordersReady;
                aiBatchSummary.backend = conn.kind || 'llama_cpp';
                aiBatchSummary.modelName = conn.modelName || 'local-ai';
                appendExtractLog(`🤖 Local AI connected (${conn.kind}: ${conn.modelName} @ ${conn.url}) ✓`, 'success');
            } catch (aiConnErr) {
                if (aiConnErr.name === 'AbortError' || state.cancelExtractionRequested) throw aiConnErr;
                aiBatchSummary.offlineReason = aiConnErr.message;
                appendExtractLog(`⚠ LOCAL AI OFFLINE: ${aiConnErr.message}`, 'error');
                toast('Local AI server is OFFLINE — fell back to Local v3.0 borders!', 'warn');
            }
        }

        // =============================================================
        // STAGE 2: Per-Page Border/Stitch Verification + High-Res Crop
        // + Cross-Page Stitching + Local Chapter Assignment
        // =============================================================
        for (let pIdx = 0; pIdx < docAnalysis.pages.length; pIdx++) {
            if (state.cancelExtractionRequested) return;
            const pageInfo = docAnalysis.pages[pIdx];
            const pageNum = pageInfo.pageNum;
            const canvas = pageInfo.canvas;

            if (pageInfo.isAnswerKeyPage || !canvas) {
                appendExtractLog(`Page ${pageNum}: Skipped Answer Key / Solutions page`, 'stitch');
                continue;
            }

            pageCanvasMap.set(pageNum, canvas);
            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
            previewCtx.drawImage(canvas, 0, 0);
            fitExtractPageFrame();
            updateExtractActiveTelemetry({
                pageNum: `${pageNum} / ${endP}`,
                stagePill: 'Inspecting Page...',
                stageTone: 'primary'
            });
            showExtractPageSweepOverlay(`Page ${pageNum}: Detecting Borders...`);

            const localCandidates = (pageInfo.blocks || []).map(b => ({
                ...b,
                isContinuationFromPrevPage: Boolean(b.isContinuationFromPrev || b.stitchWithPrev),
                continuesToNextPage: Boolean(b.continuesToNext)
            }));

            const isTwoCol = localCandidates.some(b => b.xmin > 400);
            const skewNote = pageInfo.skewAngle ? ` (auto-deskewed ${pageInfo.skewAngle}°)` : '';
            appendExtractLog(`Page ${pageNum}: Local Engine found ${localCandidates.length} ${isTwoCol ? '2-Col' : '1-Col'} regions${skewNote}`, 'info');

            let blocks = localCandidates;
            let usedManualThisPage = false;
            let usedAiBorderAdjustment = false;
            let pageBorderNote = 'Local v3.0 geometry & stitch engine';

            let pageDone = false;
            while (!pageDone) {
                if (manualModeForRemaining) {
                    appendExtractLog(`Page ${pageNum}: Opening Manual Cropper (${localCandidates.length} lines)...`, 'info');
                    const mcRes = await openManualPageCropper(
                        canvas,
                        pageNum,
                        endP,
                        localCandidates,
                        defaultSubj,
                        paperName,
                        Boolean(prevQuestion),
                        extractedCount + 1,
                        {
                            reasonText: 'Manual Crop Mode: Local Engine pre-placed lines, chapters & stitch flags. Adjust anything needed.',
                            allowRetryGemini: Boolean(getApiKey()),
                            manualAllChecked: true
                        }
                    );
                    if (mcRes.action === 'CANCEL') { cancelPdfExtraction(); return; }
                    if (mcRes.action === 'RETRY_GEMINI') { manualModeForRemaining = false; continue; }
                    manualModeForRemaining = mcRes.switchToManualAll;
                    blocks = mcRes.blocks;
                    usedManualThisPage = true;
                    pageBorderNote = 'Manually reviewed separator lines';
                    pageDone = true;
                } else if (localAiBordersReady && aiBorders && localCandidates.length > 0) {
                    try {
                        const verifyPct = 52 + Math.round((pIdx / countPages) * 44);
                        updateUploadProgressEverywhere(
                            verifyPct,
                            `AI P.${pageNum}/${endP}`,
                            `Local AI (${aiBatchSummary.modelName}) inspecting Page ${pageNum} borders...`
                        );
                        const vRes = await aiBorders.verifyPageBorders(
                            canvas,
                            pageNum,
                            localCandidates,
                            { abortSignal: state.extractionAbortController.signal }
                        );
                        blocks = vRes.blocks;
                        usedAiBorderAdjustment = Boolean(vRes.changed);
                        aiBatchSummary.totalMs += Number(vRes.elapsedMs) || 0;
                        if (vRes.verified) {
                            aiBatchSummary.pagesChecked++;
                            if (vRes.changed) aiBatchSummary.pagesRefined++;
                        } else {
                            aiBatchSummary.pagesFailed++;
                        }
                        pageBorderNote = `${vRes.note} (${(vRes.elapsedMs / 1000).toFixed(1)}s)`;
                        appendExtractLog(
                            `Page ${pageNum}: ${vRes.verified ? (vRes.changed ? '✂️ AI refined borders' : '✓ AI verified borders') : '⚠ AI unverified'} — ${vRes.note} (${(vRes.elapsedMs / 1000).toFixed(1)}s)`,
                            vRes.verified ? (vRes.changed ? 'stitch' : 'success') : 'error'
                        );
                    } catch (aiPageErr) {
                        if (aiPageErr.name === 'AbortError' || state.cancelExtractionRequested) throw aiPageErr;
                        aiBatchSummary.pagesFailed++;
                        pageBorderNote = `Local AI error: ${aiPageErr.message.slice(0, 70)} — kept v3.0 borders`;
                        appendExtractLog(`Page ${pageNum}: ⚠ Local AI failed (${aiPageErr.message}) — keeping local v3.0 borders.`, 'error');
                    }
                    pageDone = true;
                } else if (useGeminiVerifier && getApiKey()) {
                    try {
                        const base64Jpeg = canvas.toDataURL('image/jpeg', 0.84).split(',')[1];
                        appendExtractLog(`Page ${pageNum}: Verifying ${localCandidates.length} borders with ${getSelectedModel()}...`, 'info');
                        const verified = await verifyAndRefineBordersWithGemini(
                            base64Jpeg,
                            pageNum,
                            localCandidates,
                            state.extractionAbortController.signal,
                            (m, t) => appendExtractLog(m, t)
                        );
                        if (Array.isArray(verified) && verified.length > 0) {
                            blocks = verified.map(v => ({
                                ...v,
                                xmin: Number(v.xmin) ?? 12,
                                xmax: Number(v.xmax) ?? 988,
                                ymin: Number(v.ymin) ?? 0,
                                ymax: Number(v.ymax) ?? 1000,
                                ocrText: '',
                                colLines: []
                            }));
                            usedAiBorderAdjustment = true;
                            pageBorderNote = `Gemini verified ${blocks.length} borders`;
                            appendExtractLog(`Page ${pageNum}: ${getSelectedModel()} verified ${blocks.length} boxes ✓`, 'success');
                        }
                        pageDone = true;
                    } catch (verErr) {
                        if (verErr.name === 'AbortError' || state.cancelExtractionRequested) throw verErr;
                        appendExtractLog(`Page ${pageNum}: Gemini failed (${verErr.message}). Opening Manual Cropper...`, 'error');
                        const mcRes = await openManualPageCropper(
                            canvas,
                            pageNum,
                            endP,
                            localCandidates,
                            defaultSubj,
                            paperName,
                            Boolean(prevQuestion),
                            extractedCount + 1,
                            {
                                reasonText: `Gemini failed: ${verErr.message.slice(0, 75)}. Local Engine lines are ready.`,
                                allowRetryGemini: true,
                                manualAllChecked: false
                            }
                        );
                        if (mcRes.action === 'CANCEL') { cancelPdfExtraction(); return; }
                        if (mcRes.action === 'RETRY_GEMINI') continue;
                        manualModeForRemaining = mcRes.switchToManualAll;
                        blocks = mcRes.blocks;
                        usedManualThisPage = true;
                        pageDone = true;
                    }
                } else {
                    pageDone = true;
                }
            }

            if (state.cancelExtractionRequested) return;

            // Re-snap any AI-modified borders strictly into clean ink-free whitespace
            if (usedAiBorderAdjustment && !usedManualThisPage) {
                for (let i = 0; i < blocks.length; i++) {
                    const b = blocks[i];
                    const sameColPrev = i > 0 && Math.abs(blocks[i - 1].xmin - b.xmin) < 120 ? blocks[i - 1] : null;
                    const sameColNext = i < blocks.length - 1 && Math.abs(blocks[i + 1].xmin - b.xmin) < 120 ? blocks[i + 1] : null;

                    const minAllowed = sameColPrev ? Math.min(b.ymin, sameColPrev.ymax + 2) : 2;
                    b.ymin = snap2DBoundaryToWhitespace(canvas, b.colLines, Number(b.ymin) || 0, minAllowed, 985, b.xmin, b.xmax, 'UP');

                    const maxAllowed = sameColNext ? Math.max(b.ymin + 25, sameColNext.ymin - 2) : 996;
                    const rawYMax = Math.min(maxAllowed, Number(b.ymax) || maxAllowed);
                    b.ymax = snap2DBoundaryToWhitespace(canvas, b.colLines, rawYMax, b.ymin + 25, maxAllowed, b.xmin, b.xmax, 'DOWN');
                }
            }

            const pageDoneBoxes = [];
            for (let i = 0; i < blocks.length; i++) {
                if (state.cancelExtractionRequested) return;
                const qVisualStartedAt = performance.now();
                const b = blocks[i];
                const slicePct = 52 + Math.round(((pIdx + (i + 1) / Math.max(1, blocks.length)) / countPages) * 46);

                const xmin = Math.max(0, Math.min(950, Number(b.xmin) ?? 12));
                const xmax = Math.max(xmin + 80, Math.min(1000, Number(b.xmax) ?? 988));
                const ymin = Math.max(0, Math.min(990, Number(b.ymin) || 0));
                const ymax = Math.max(ymin + 20, Math.min(1000, Number(b.ymax) || 1000));
                const pendingBoxes = blocks.slice(i + 1).map(pb => ({
                    xmin: Math.max(0, Math.min(950, Number(pb.xmin) ?? 12)),
                    xmax: Math.max(80, Math.min(1000, Number(pb.xmax) ?? 988)),
                    ymin: Math.max(0, Math.min(990, Number(pb.ymin) || 0)),
                    ymax: Math.max(20, Math.min(1000, Number(pb.ymax) || 1000))
                }));
                const previewQNum = String(b.questionNumber || '').replace(/[^0-9a-zA-Z]/g, '') || `${extractedCount + 1}`;
                const displayQTag = previewQNum.toUpperCase() === 'CONT' ? 'CONT' : `Q.${previewQNum}`;

                // -------------------------------------------------------------
                // VISUAL STEP 1: Real-Time Animated Border Detection & Snapping
                // -------------------------------------------------------------
                const coarseBox = {
                    xmin: Math.max(2, xmin - 16),
                    xmax: Math.min(998, xmax + 16),
                    ymin: Math.max(2, ymin - 28),
                    ymax: Math.min(998, ymax + 30)
                };
                const midSnappedBox = {
                    xmin: Math.max(2, xmin - 10),
                    xmax: Math.min(998, xmax + 10),
                    ymin,
                    ymax
                };
                const finalBox = { xmin, xmax, ymin, ymax };

                // Keep persistent #exActiveBox & 4 scrim curtains mounted so it glides smoothly with zero flash!
                renderExtractPageBoxes({
                    doneBoxes: pageDoneBoxes,
                    pendingBoxes,
                    activeBox: { ...coarseBox, mode: 'adjusting', label: `${displayQTag} • Detecting Borders...` }
                });
                updateUploadProgressEverywhere(
                    slicePct,
                    `Page ${pageNum}/${endP}`,
                    `${displayQTag}: Detecting & adjusting 2D borders...`
                );
                updateExtractActiveTelemetry({
                    pageNum: `${pageNum} / ${endP}`,
                    stagePill: '1/3 Adjusting Borders',
                    stageTone: 'warn',
                    qBadge: displayQTag,
                    phaseText: 'Locating ink bounds & diagrams...',
                    chapterText: 'Snapping top/bottom edges to whitespace',
                    doneCount: extractedCount
                });
                appendExtractLog(`📐 ${displayQTag} (Page ${pageNum}): Detecting & adjusting borders...`, 'info');

                if (isExtractVisualPacingEnabled()) {
                    await abortablePacingSleep(380, state.extractionAbortController.signal);
                    // Animate vertical edges snapping cleanly to whitespace valleys
                    renderExtractPageBoxes({
                        doneBoxes: pageDoneBoxes,
                        pendingBoxes,
                        activeBox: { ...midSnappedBox, mode: 'adjusting', label: `${displayQTag} • Snapping Top & Bottom Edges...` }
                    });
                    updateExtractActiveTelemetry({ phaseText: 'Snapping top & bottom whitespace valleys...' });
                    await abortablePacingSleep(420, state.extractionAbortController.signal);
                }

                // Animate final tight 2D lock on all 4 sides
                renderExtractPageBoxes({
                    doneBoxes: pageDoneBoxes,
                    pendingBoxes,
                    activeBox: { ...finalBox, mode: 'adjusting', label: `${displayQTag} • Locking Tight Borders ✓` }
                });
                if (isExtractVisualPacingEnabled()) {
                    await abortablePacingSleep(300, state.extractionAbortController.signal);
                }

                // -------------------------------------------------------------
                // VISUAL STEP 2: One-Question-At-A-Time Crop + OCR Laser Scan
                // -------------------------------------------------------------
                const cropRes = crop2DSliceFromPage(canvas, xmin, xmax, ymin, ymax, padTop, padBottom);
                renderExtractPageBoxes({
                    doneBoxes: pageDoneBoxes,
                    pendingBoxes,
                    activeBox: { ...finalBox, mode: 'ocr', label: `${displayQTag} • Running OCR & Reading Text...` }
                });
                updateUploadProgressEverywhere(
                    slicePct,
                    `Page ${pageNum}/${endP}`,
                    `${displayQTag}: Running OCR & extracting math text...`
                );
                updateExtractActiveTelemetry({
                    stagePill: '2/3 Running OCR',
                    stageTone: 'primary',
                    phaseText: 'Reading text & mathematical symbols...',
                    chapterText: 'One-by-one OCR & syllabus matching'
                });

                const ocrStepStart = performance.now();
                let fullQuestionText = b.ocrText || '';
                if (fullQuestionText.length < 18) {
                    const tessText = await recognizeImageTextWithTesseract(cropRes.canvas);
                    if (tessText.length > fullQuestionText.length) fullQuestionText = tessText;
                    appendExtractLog(`🔤 ${displayQTag}: Tesseract OCR extracted ${fullQuestionText.length} chars`, 'info');
                } else {
                    appendExtractLog(`🔤 ${displayQTag}: Vector OCR read ${fullQuestionText.length} chars`, 'info');
                }
                if (state.cancelExtractionRequested) return;

                if (isExtractVisualPacingEnabled()) {
                    const ocrSpent = performance.now() - ocrStepStart;
                    const ocrPad = Math.max(0, 1050 - ocrSpent);
                    if (ocrPad > 0) await abortablePacingSleep(ocrPad, state.extractionAbortController.signal);
                }

                const passagePrefix = b.sharedPassage?.text ? `${b.sharedPassage.text} ` : '';
                const combinedOcrText = cleanQuestionTextOnly(`${passagePrefix}${fullQuestionText} ${b.firstLineSnippet || ''} ${b.lastLineSnippet || ''}`);

                // 100% LOCAL CHAPTER CLASSIFICATION (never overridden by VLM!)
                let finalSubject = ['Physics', 'Chemistry', 'Mathematics'].includes(b.subject) ? b.subject : null;
                let finalChapter = b.chapter || null;
                let chapterConfidence = typeof b.chapterConfidence === 'number' ? b.chapterConfidence : 0.78;
                const lockedSubj = b.subjectOverride || finalSubject || (defaultSubj !== 'AUTO' ? defaultSubj : null);
                const subjectPrior = (lockedSubj && docAnalysis.subjectPriors?.[lockedSubj])
                    ? docAnalysis.subjectPriors[lockedSubj]
                    : (docAnalysis.detectedWorksheetPrior || null);

                if (!usedManualThisPage && (!finalSubject || !finalChapter || usedAiBorderAdjustment || (chapterConfidence < 0.58 && fullQuestionText.length >= 22))) {
                    const reClass = engine.classifyQuestion(combinedOcrText, {
                        paperName,
                        pageHeader: b.pageHeader || '',
                        subjectOverride: lockedSubj,
                        defaultSubject: defaultSubj,
                        documentPrior: subjectPrior
                    });
                    finalSubject = reClass.subject;
                    finalChapter = reClass.chapter;
                    chapterConfidence = reClass.confidence;
                }
                if (!finalSubject || !finalChapter) {
                    const inferred = inferSubjectAndChapterFromText(`${paperName} ${combinedOcrText}`, defaultSubj);
                    finalSubject = finalSubject || inferred.subject;
                    finalChapter = finalChapter || inferred.chapter;
                }

                const rawQNum = String(b.questionNumber || '').replace(/[^0-9a-zA-Z]/g, '') || `${extractedCount + 1}`;
                const isEngineStitch = Boolean(b.stitchWithPrev || b.isContinuationFromPrev);
                const isExplicitCont = rawQNum.toUpperCase() === 'CONT' || b.isContinuationFromPrevPage === true;
                const startsWithNewNum = /^\s*(?:Q\.?\s*)?\d+/i.test(String(b.firstLineSnippet || '')) && !isExplicitCont && !isEngineStitch;

                let isStitch = prevQuestion && (
                    b.manualStitchWithPrev === true ||
                    isEngineStitch ||
                    (i === 0 && prevQuestion.page === pageNum - 1 && !startsWithNewNum &&
                        (isExplicitCont || prevQuestion.continuesToNextPage === true))
                );

                // Optional Native Local AI visual stitch verification for ambiguous top-of-page slices
                let aiStitchNote = '';
                if (prevQuestion && i === 0 && !usedManualThisPage && localAiBordersReady && aiBorders &&
                    prevQuestion.page === pageNum - 1 && (!startsWithNewNum || isStitch)) {
                    try {
                        const stVerdict = await aiBorders.verifyCrossPageStitch(
                            prevQuestion.imageDataUrl,
                            cropRes.dataUrl,
                            { prevQNum: prevQuestion.questionNumber, abortSignal: state.extractionAbortController.signal }
                        );
                        if (typeof stVerdict.shouldStitch === 'boolean' && stVerdict.confidence >= 0.72) {
                            isStitch = stVerdict.shouldStitch;
                            aiStitchNote = ` [AI Stitch: ${stVerdict.reason || (isStitch ? 'continued' : 'separate')}]`;
                        }
                    } catch (_) {}
                }

                if (isStitch) {
                    const reasonTag = aiStitchNote || (Array.isArray(b.stitchReasons) && b.stitchReasons.length ? ` [${b.stitchReasons[0]}]` : '');
                    appendExtractLog(`🔗 Stitched Q.${prevQuestion.questionNumber} (Page ${prevQuestion.page} → Page ${pageNum})${reasonTag}`, 'stitch');
                    const stitchRes = await stitchCanvasesVertically(prevQuestion.imageDataUrl, cropRes.dataUrl);
                    prevQuestion.imageDataUrl = stitchRes.dataUrl;
                    prevQuestion.aspectRatio = stitchRes.aspectRatio;
                    prevQuestion.isStitched = true;
                    prevQuestion.continuesToNextPage = Boolean(b.continuesToNextPage || b.continuesToNext);
                    prevQuestion.ocrText = cleanQuestionTextOnly(`${prevQuestion.ocrText || ''} ${combinedOcrText}`);
                    if (!Array.isArray(prevQuestion._sourceSlices)) prevQuestion._sourceSlices = [];
                    prevQuestion._sourceSlices.push({ pageNum, xmin, xmax, ymin, ymax, padTop, padBottom });
                    if (prevQuestion._reviewMeta) {
                        prevQuestion._reviewMeta.borderNote = `Stitched Pages ${prevQuestion.page}→${pageNum}${reasonTag}`;
                    }
                    // Re-classify locally now that full stitched question text is available!
                    const postStitchClass = engine.classifyQuestion(prevQuestion.ocrText, {
                        paperName,
                        pageHeader: b.pageHeader || '',
                        subjectOverride: prevQuestion._subjectOverride || prevQuestion.subject,
                        defaultSubject: defaultSubj,
                        documentPrior: subjectPrior
                    });
                    prevQuestion.subject = postStitchClass.subject;
                    prevQuestion.chapter = postStitchClass.chapter;
                    if (prevQuestion._reviewMeta) {
                        prevQuestion._reviewMeta.confidence = postStitchClass.confidence;
                        prevQuestion._reviewMeta.needsReview = postStitchClass.confidence < 0.75;
                    }
                    renderExtractPageBoxes({
                        doneBoxes: pageDoneBoxes,
                        pendingBoxes,
                        activeBox: { ...finalBox, mode: 'locked', label: `🔗 Stitched into Q.${prevQuestion.questionNumber}` }
                    });
                    updateExtractActiveTelemetry({
                        stagePill: '3/3 Stitched ✓',
                        stageTone: 'success',
                        phaseText: `Stitched onto Q.${prevQuestion.questionNumber}`,
                        chapterText: `${prevQuestion.subject} • ${prevQuestion.chapter}`,
                        doneCount: extractedCount
                    });
                    if (isExtractVisualPacingEnabled()) {
                        const remMs = Math.max(0, 3000 - (performance.now() - qVisualStartedAt));
                        if (remMs > 0) await abortablePacingSleep(remMs, state.extractionAbortController.signal);
                    }
                    pageDoneBoxes.push({ xmin, xmax, ymin, ymax, qNum: prevQuestion.questionNumber, isStitched: true });
                    continue;
                }

                const cleanNum = rawQNum.replace(/\D/g, '') || `${extractedCount + 1}`;
                const sliceSpec = { pageNum, xmin, xmax, ymin, ymax, padTop, padBottom };
                const qObj = {
                    id: generateUniqueId(),
                    uid: generateQuestionUid(),
                    questionNumber: rawQNum.toUpperCase() === 'CONT' ? cleanNum : rawQNum,
                    subject: finalSubject,
                    chapter: finalChapter,
                    paperName,
                    page: pageNum,
                    imageDataUrl: cropRes.dataUrl,
                    aspectRatio: cropRes.aspectRatio,
                    ocrText: combinedOcrText,
                    firstLineSnippet: b.firstLineSnippet || '',
                    lastLineSnippet: b.lastLineSnippet || '',
                    hint: '',
                    answerKey: '',
                    whiteboardData: null,
                    timeSpent: 0,
                    reattemptTime: 0,
                    noteTag: '',
                    eliminatedOptions: [],
                    solved: false,
                    starred: false,
                    isStitched: false,
                    continuesToNextPage: Boolean(b.continuesToNextPage || b.continuesToNext),
                    createdAt: Date.now() + i,
                    _subjectOverride: lockedSubj,
                    _sourceSlices: [sliceSpec],
                    _origSourceSlices: [{ ...sliceSpec }],
                    _reviewMeta: {
                        confidence: chapterConfidence,
                        needsReview: chapterConfidence < 0.75,
                        aiBorderVerified: Boolean(b.aiBorderVerified),
                        borderNote: b.aiBorderNote || (aiBatchSummary.offlineReason ? `Local v3.0 (AI offline: ${aiBatchSummary.offlineReason.slice(0, 65)})` : pageBorderNote),
                        subjectPrior
                    }
                };

                batchQuestions.push(qObj);
                state.currentUploadBatchIds.push(qObj.id);
                extractedCount++;
                prevQuestion = qObj;

                const confPctLog = Math.round((chapterConfidence || 0.78) * 100);
                renderExtractPageBoxes({
                    doneBoxes: pageDoneBoxes,
                    pendingBoxes,
                    activeBox: { ...finalBox, mode: 'locked', label: `✓ Q.${qObj.questionNumber} • ${qObj.chapter}` }
                });
                updateExtractActiveTelemetry({
                    stagePill: '3/3 Locked ✓',
                    stageTone: 'success',
                    qBadge: `Q.${qObj.questionNumber}`,
                    phaseText: `${qObj.subject} (${confPctLog}% match)`,
                    chapterText: qObj.chapter,
                    doneCount: extractedCount
                });
                appendExtractLog(`✓ Q.${qObj.questionNumber} (${qObj.subject} • ${qObj.chapter} • ${confPctLog}%)`, 'success');

                if (isExtractVisualPacingEnabled()) {
                    const remMs = Math.max(0, 3000 - (performance.now() - qVisualStartedAt));
                    if (remMs > 0) await abortablePacingSleep(remMs, state.extractionAbortController.signal);
                }
                pageDoneBoxes.push({ xmin, xmax, ymin, ymax, qNum: qObj.questionNumber, chapter: qObj.chapter, isStitched: false });
            }
        }

        if (state.cancelExtractionRequested) return;

        // =============================================================
        // STAGE 3: Optional Post-Extraction Border & Chapter Review Studio
        // =============================================================
        let finalBatchToSave = batchQuestions;
        if (reviewBeforeSaving && batchQuestions.length > 0) {
            const reviewRes = await openBatchReviewModal(batchQuestions, pageCanvasMap, aiBatchSummary);
            if (reviewRes.action === 'CANCEL') {
                cancelPdfExtraction();
                return;
            }
            finalBatchToSave = reviewRes.questions;
        }

        // Strip transient helper fields before saving & syncing to Cloud Gist
        const cleanBatch = finalBatchToSave.map(q => {
            const { _sourceSlices, _origSourceSlices, _subjectOverride, _reviewMeta, _skipInReview, _origChapter, ...cleanQ } = q;
            return cleanQ;
        });

        document.getElementById('minimizedUploadBar')?.classList.add('hidden');
        document.getElementById('minimizedUploadBar')?.classList.remove('flex');
        state.isUploadMinimized = false;

        state.questions.push(...cleanBatch);
        state.currentUploadBatchIds = [];
        state.isExtracting = false;
        setUploadButtonsLock(false);
        updateUploadProgressEverywhere(100, `Done`, `Saved ${cleanBatch.length} questions!`);
        sortAndRefreshQuestions(false);

        toast(`Saved ${cleanBatch.length} questions! Syncing to Cloud...`, 'success');
        window.app.closeUploadModal();
        await pushToCloudGist(false);

        if (isAutoSolveHintsEnabled() && getApiKey()) {
            runBackgroundAnswerAndHintGenerator(false, false);
        }
    } catch (err) {
        if (err.name === 'AbortError' || state.cancelExtractionRequested) return;
        state.isExtracting = false;
        state.isUploadMinimized = false;
        document.getElementById('minimizedUploadBar')?.classList.add('hidden');
        document.getElementById('minimizedUploadBar')?.classList.remove('flex');
        setUploadButtonsLock(false);
        appendExtractLog(`⚠ Error: ${err.message}`, 'error');
        toast('Extraction error: ' + err.message, 'warn');
    }
}

const normalizeForSearch = (str) => String(str || '').toLowerCase().replace(/[^\w\s.]/g, ' ').replace(/\s+/g, ' ').trim();

function getFiltered() {
    if (state.mockTest.active && state.mockTest.questionIds.length > 0) {
        return state.mockTest.questionIds
            .map(id => state.questions.find(q => q.id === id))
            .filter(Boolean);
    }
    const queryTokens = normalizeForSearch(state.search).split(' ').filter(Boolean);
    return state.questions.filter(q => {
        if (state.subject !== 'ALL' && q.subject !== state.subject) return false;
        if (state.chapter !== 'ALL' && q.chapter !== state.chapter) return false;
        if (state.paper !== 'ALL' && q.paperName !== state.paper) return false;
        if (state.tagFilter !== 'ALL' && q.noteTag !== state.tagFilter) return false;
        if (state.status === 'UNSOLVED' && q.solved) return false;
        if (state.status === 'SOLVED' && !q.solved) return false;
        if (state.status === 'STARRED' && !q.starred) return false;
        if (queryTokens.length > 0) {
            const haystack = normalizeForSearch(
                `q.${q.questionNumber} ${q.questionNumber} ${q.subject || ''} ${q.chapter || ''} ${q.paperName || ''} ${q.noteTag || ''} ${q.ocrText || ''} ${q.hint || ''} ${q.firstLineSnippet || ''} ${q.lastLineSnippet || ''}`
            );
            for (const token of queryTokens) if (!haystack.includes(token)) return false;
        }
        return true;
    });
}

function renderMockTestActiveBar() {
    const bar = document.getElementById('mockTestActiveBar');
    const cdEl = document.getElementById('mockTestCountdownText');
    const paletteEl = document.getElementById('mockTestPaletteStrip');
    if (!bar || !cdEl || !paletteEl) return;

    bar.classList.toggle('hidden', !state.mockTest.active);
    bar.classList.toggle('flex', state.mockTest.active);
    if (!state.mockTest.active) return;

    cdEl.textContent = formatTimeSeconds(state.mockTest.remainingSec);
    const currOpenId = state.activePadId || state.activePopupId;

    paletteEl.innerHTML = state.mockTest.questionIds.map((qId, idx) => {
        const q = state.questions.find(item => item.id === qId);
        if (!q) return '';
        const isCurr = Number(currOpenId) === qId;
        let bgClass = 'm3-surface-low m3-text-muted';
        if (q.solved) bgClass = 'bg-emerald-600 text-white';
        else if (q.starred) bgClass = 'bg-amber-500 text-slate-950';
        const ringClass = isCurr ? 'ring-2 ring-[var(--md-primary)] scale-105' : '';
        return `
            <button type="button" onclick="window.app.jumpToMockQuestion(${qId})" class="h-6 min-w-[26px] px-1.5 rounded-full text-[10px] font-extrabold transition shrink-0 ${bgClass} ${ringClass}">
                ${idx + 1}
            </button>
        `;
    }).join('');
}

function refreshCountsAndDrawerOnly() {
    const all = state.questions;
    const scoped = all.filter(q => (state.subject === 'ALL' || q.subject === state.subject) && (state.chapter === 'ALL' || q.chapter === state.chapter));
    document.getElementById('status-count-UNSOLVED').textContent = scoped.filter(q => !q.solved).length;
    document.getElementById('status-count-SOLVED').textContent = scoped.filter(q => q.solved).length;
    document.getElementById('status-count-STARRED').textContent = scoped.filter(q => q.starred).length;

    document.querySelectorAll('.status-btn').forEach(btn => {
        const st = btn.getAttribute('data-status');
        btn.classList.toggle('active', st === state.status);
    });
    requestAnimationFrame(() => updateAllSegmentedGliders());


    document.querySelectorAll('.drawer-tag-chip').forEach(chip => {
        const t = chip.getAttribute('data-tag-chip');
        chip.classList.toggle('selected', t === state.tagFilter);
    });

    document.getElementById('activeChapterIndicator').textContent =
        state.chapter !== 'ALL' ? state.chapter : (state.subject !== 'ALL' ? state.subject : 'All');

    const papers = Array.from(new Set(all.map(q => q.paperName).filter(Boolean)));
    const paperLbl = document.getElementById('paperDropdownLabel');
    if (paperLbl) {
        paperLbl.textContent = state.paper === 'ALL' ? `All Papers (${papers.length})` : state.paper;
    }
    renderMockTestActiveBar();
    renderDrawerChapters();
}

function renderAll() {
    refreshCountsAndDrawerOnly();
    renderFeed();
}

function renderDrawerChapters() {
    const list = document.getElementById('drawerChapterList');
    const qFilter = (document.getElementById('drawerChapterSearch')?.value || '').toLowerCase();
    const all = state.questions;

    const subjectsMeta = [
        { name: 'Physics', dot: 'bg-sky-400' },
        { name: 'Chemistry', dot: 'bg-amber-400' },
        { name: 'Mathematics', dot: 'bg-rose-400' }
    ];

    const isAllSelected = state.subject === 'ALL' && state.chapter === 'ALL';
    let html = `
        <button onclick="window.app.selectSubjectChapter('ALL', 'ALL')" class="w-full px-4 py-2.5 rounded-full flex items-center justify-between text-xs font-extrabold transition ${isAllSelected ? 'm3-btn-filled' : 'm3-surface-high hover:brightness-105'}">
            <span>All Subjects & Chapters</span>
            <span class="px-2 py-0.5 rounded-full bg-black/15 text-[11px]">${all.length}</span>
        </button>
    `;

    subjectsMeta.forEach(sMeta => {
        const subjQuestions = all.filter(q => q.subject === sMeta.name);
        const chapMap = new Map();
        subjQuestions.forEach(q => {
            const c = q.chapter || 'General';
            if (!chapMap.has(c)) chapMap.set(c, { total: 0, solved: 0, starred: 0 });
            const item = chapMap.get(c);
            item.total++;
            if (q.solved) item.solved++;
            if (q.starred) item.starred++;
        });

        const rows = Array.from(chapMap.entries())
            .filter(([cName]) => cName.toLowerCase().includes(qFilter))
            .sort((a, b) => b[1].total - a[1].total);

        if (qFilter && rows.length === 0) return;
        const isSubjAllActive = state.subject === sMeta.name && state.chapter === 'ALL';

        html += `
            <div class="pt-1">
                <button onclick="window.app.selectSubjectChapter('${sMeta.name}', 'ALL')" class="w-full px-3.5 py-2 mb-1.5 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider transition ${isSubjAllActive ? 'm3-btn-filled' : 'm3-surface-low rounded-2xl hover:brightness-105'}">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 m3-cookie-12 ${sMeta.dot}"></span>
                        <span>${sMeta.name}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full bg-black/15 text-[11px] font-bold">${subjQuestions.length}</span>
                </button>
                <div class="m3-group-list">
        `;

        if (rows.length === 0) {
            html += `<div class="px-3.5 py-2 m3-group-item text-[11px] m3-text-muted italic">No questions yet</div>`;
        } else {
            rows.forEach(([cName, st]) => {
                const active = state.subject === sMeta.name && state.chapter === cName;
                const safeName = cName.replace(/'/g, "\\'");
                html += `
                    <button onclick="window.app.selectSubjectChapter('${sMeta.name}', '${safeName}')" class="w-full px-3.5 py-2 m3-group-item flex items-center justify-between text-xs font-semibold ${active ? 'font-extrabold' : ''}" style="${active ? 'background: var(--md-primary); color: var(--md-on-primary); border-radius: 9999px;' : ''}">
                        <span class="truncate pr-2">${cName}</span>
                        <div class="flex items-center gap-1 shrink-0 text-[11px]">
                            ${st.starred > 0 ? `<span class="text-amber-400 font-extrabold">★${st.starred}</span>` : ''}
                            <span class="px-2 py-0.2 rounded-full bg-black/15">${st.solved}/${st.total}</span>
                        </div>
                    </button>
                `;
            });
        }
        html += `</div></div>`;
    });

    list.innerHTML = html;

    const solvedTotal = all.filter(q => q.solved).length;
    document.getElementById('drawerProgressText').textContent = `Solved: ${solvedTotal} / ${all.length}`;
}

function questionHasSavedWork(q) {
    if (!q || !q.whiteboardData) return false;
    if (Array.isArray(q.whiteboardData.pages)) {
        return q.whiteboardData.pages.length > 1 || q.whiteboardData.pages.some(p => Array.isArray(p.items) && p.items.length > 1);
    }
    return Array.isArray(q.whiteboardData.items) && q.whiteboardData.items.length > 1;
}

function buildCardHtml(q) {
    const borderStyle = q.starred ? 'border-color: var(--md-primary);' : (q.solved ? 'border-color: #10b981;' : '');
    const shortSubj = q.subject === 'Mathematics' ? 'Maths' : q.subject;
    const hasTime = (Number(q.timeSpent) || 0) > 0;
    const hasRough = questionHasSavedWork(q);

    return `
    <article data-card-id="${q.id}" class="m3-card min-w-0" style="${borderStyle}">
        <div class="px-2.5 py-1.5 m3-card-top-segment flex items-center justify-between gap-1.5 flex-nowrap overflow-hidden">
            <div class="flex items-center gap-1.5 min-w-0 flex-nowrap overflow-hidden">
                <span class="w-6 h-6 m3-cookie-12 font-extrabold text-[10px] flex items-center justify-center shrink-0" style="background: var(--md-primary); color: var(--md-on-primary);">Q.${q.questionNumber}</span>

                <div class="m3-card-dropdown-group shrink-0 min-w-0">
                    <button type="button" onclick="window.app.openCardSubjMenu(${q.id}, this)" class="m3-card-dropdown-btn">
                        <span class="card-subj-label">${shortSubj}</span>
                        <i class="ph-bold ph-caret-down text-[9px] opacity-75"></i>
                    </button>
                    <button type="button" onclick="window.app.openCardChapMenu(${q.id}, this)" class="m3-card-dropdown-btn max-w-[125px] sm:max-w-[175px]">
                        <span class="card-chap-label truncate">${q.chapter}</span>
                        <i class="ph-bold ph-caret-down text-[9px] opacity-75 shrink-0"></i>
                    </button>
                </div>

                ${q.noteTag ? `<button type="button" onclick="window.app.openQuestionTagMenu(${q.id}, this)" class="card-tag-badge px-2 py-0.5 rounded-full m3-primary-pill text-[9px] font-extrabold shrink-0">${q.noteTag}</button>` : ''}
                ${hasTime ? `<span class="px-2 py-0.5 rounded-full m3-surface-low text-[9px] font-mono font-bold m3-text-muted shrink-0">${formatTimeSeconds(q.timeSpent)}</span>` : ''}
                ${hasRough ? `<span class="px-1.5 py-0.5 rounded-full m3-surface-low text-[9px] font-bold m3-text-muted shrink-0" title="Saved whiteboard notes"><i class="ph-fill ph-pencil-line"></i></span>` : ''}
            </div>

            <div class="m3-icon-group m3-icon-group-card shrink-0 ml-auto">
                <button onclick="window.app.toggleQBool(${q.id}, 'starred')" class="card-star-btn m3-icon-group-btn ${q.starred ? 'active-state' : ''}" title="Star">
                    <i class="${q.starred ? 'ph-fill ph-star' : 'ph-bold ph-star'}"></i>
                </button>

                <button onclick="window.app.toggleQBool(${q.id}, 'solved')" class="card-solved-btn m3-icon-group-btn ${q.solved ? 'active-state' : ''}" title="${q.solved ? 'Solved' : 'Unsolved'}">
                    <i class="${q.solved ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'}"></i>
                </button>

                <button onclick="window.app.openQuestionTagMenu(${q.id}, this)" class="m3-icon-group-btn" title="Tag">
                    <i class="ph-bold ph-tag"></i>
                </button>

                <button onclick="window.app.openSplitModal(${q.id})" class="m3-icon-group-btn" title="Split or Trim">
                    <i class="ph-bold ph-scissors"></i>
                </button>

                <button onclick="window.app.deleteQ(${q.id})" class="m3-icon-group-btn hover:!bg-rose-600 hover:!text-white" title="Delete">
                    <i class="ph-bold ph-trash"></i>
                </button>
            </div>
        </div>

        <div class="p-2.5 m3-card-img-segment flex items-center justify-center min-w-0">
            <img src="${q.imageDataUrl}" onclick="event.stopPropagation(); window.app.openImagePopup(${q.id})" alt="Q.${q.questionNumber}" class="question-slice-img rounded-xl w-full h-auto object-contain cursor-zoom-in" decoding="async">
        </div>
    </article>
    `;
}

function renderFeed() {
    const container = document.getElementById('mainFeedContainer');
    const list = getFiltered();

    if (list.length === 0) {
        container.innerHTML = `
            <div class="max-w-lg w-full m-auto m3-dialog p-8 text-center space-y-4">
                <div class="w-16 h-16 m3-cookie-12 flex items-center justify-center mx-auto" style="background: var(--md-primary-container); color: var(--md-primary);">
                    ${state.isSyncingCloud
                        ? `<svg class="w-9 h-9" viewBox="0 0 24 24"><path class="m3-morph-loader-path" fill="currentColor" d=""></path></svg>`
                        : `<i class="ph-bold ph-scissors text-3xl"></i>`
                    }
                </div>
                <h2 class="text-lg font-extrabold">
                    ${state.isSyncingCloud
                        ? 'Syncing Questions from GitHub Cloud...'
                        : state.questions.length === 0
                        ? 'Material 3 Expressive Vault Ready!'
                        : 'No Questions Match Current Search / Filter'}
                </h2>
                <div id="emptyStateWaveWrap" class="${state.isSyncingCloud ? 'py-1' : 'hidden'}"></div>
                <p class="text-xs sm:text-sm m3-text-muted leading-relaxed">
                    ${state.isSyncingCloud
                        ? 'Fetching your latest question bank from your GitHub Secret Gist...'
                        : state.questions.length === 0
                        ? 'Tap the floating "+ Add Questions" button to extract any 1-column or 2-column JEE PDF with automatic Gemini 3.8 Flash border verification & AI Hints!'
                        : 'Try clearing the search box, swiping the Status pill to "All", or selecting "All Subjects & Chapters" inside the Chapters drawer.'}
                </p>
                ${!state.isSyncingCloud ? `
                <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
                    ${state.search || state.tagFilter !== 'ALL' ? `
                        <button onclick="window.app.clearSearch(); window.app.setTagFilter('ALL');" class="h-10 px-5 m3-btn-tonal text-xs sm:text-sm flex items-center gap-2">
                            <i class="ph-bold ph-x"></i> Clear Search Filter
                        </button>
                    ` : ''}
                    <button onclick="window.app.openUploadModal()" class="h-10 px-5 m3-btn-filled text-xs sm:text-sm flex items-center gap-2 shadow-lg">
                        <i class="ph-bold ph-file-pdf"></i> Add Questions
                    </button>
                    <button onclick="window.app.pullFromCloudGist(true)" class="h-10 px-5 m3-btn-tonal text-xs sm:text-sm flex items-center gap-2">
                        <i class="ph-bold ph-cloud-arrow-down"></i> Pull from Cloud
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        if (state.isSyncingCloud) {
            renderM3WavyProgress('emptyStateWaveWrap', 72);
            ensureM3MorphLoopRunning();
        }
        return;
    }

    const isTwoCol = window.innerWidth >= 1024 && !isVerticalScreen();
    if (!isTwoCol) {
        container.innerHTML = `<div class="flex flex-col gap-4 pb-24 max-w-3xl mx-auto w-full">${list.map(buildCardHtml).join('')}</div>`;
    } else {
        const colLeft = [], colRight = [];
        let leftHeight = 0, rightHeight = 0;
        list.forEach(q => {
            const estH = 0.11 + (typeof q.aspectRatio === 'number' ? q.aspectRatio : 0.42);
            if (leftHeight <= rightHeight) { colLeft.push(buildCardHtml(q)); leftHeight += estH; }
            else { colRight.push(buildCardHtml(q)); rightHeight += estH; }
        });
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4 items-start pb-24 w-full">
                <div class="flex flex-col gap-4 min-w-0">${colLeft.join('')}</div>
                <div class="flex flex-col gap-4 min-w-0">${colRight.join('')}</div>
            </div>
        `;
    }
}

function capturePadNavigationContext(currentQId) {
    if (state.mockTest.active && state.mockTest.questionIds.length > 0) {
        state.padContextIds = [...state.mockTest.questionIds];
        return;
    }
    const filtered = getFiltered();
    const list = filtered.some(item => item.id === Number(currentQId)) ? filtered : state.questions;
    state.padContextIds = list.map(item => item.id);
}

function getLockedPadContextList(currentQId) {
    if (state.mockTest.active && state.mockTest.questionIds.length > 0) {
        return state.mockTest.questionIds.map(id => state.questions.find(q => q.id === id)).filter(Boolean);
    }
    if (Array.isArray(state.padContextIds) && state.padContextIds.includes(Number(currentQId))) {
        const resolved = state.padContextIds
            .map(id => state.questions.find(q => q.id === id))
            .filter(Boolean);
        if (resolved.length > 0) return resolved;
    }
    capturePadNavigationContext(currentQId);
    return state.padContextIds
        .map(id => state.questions.find(q => q.id === id))
        .filter(Boolean);
}

function buildPopupCardHtml(q, idx, total) {
    if (!q) return '';
    const hasPrev = idx > 0;
    const hasNext = idx < total - 1;
    const rawSec = state.blindModeActive ? (q.reattemptTime || 0) : (q.timeSpent || 0);
    const timerText = (state.blindModeActive ? 'R ' : '') + formatTimeSeconds(rawSec);
    const timerIconClass = state.timerPaused
        ? 'popup-timer-icon ph-fill ph-play text-emerald-500 text-xs'
        : 'popup-timer-icon ph-fill ph-pause text-amber-500 text-xs';
    const elimList = state.blindModeActive ? [] : (q.eliminatedOptions || []);

    return `
    <div class="popup-carousel-card" onclick="event.stopPropagation()">
        <div class="px-3 py-2 m3-surface-low border-b border-[var(--md-outline-variant)] flex items-center justify-between gap-1.5 shrink-0 overflow-hidden">
            <div class="flex items-center gap-1.5 min-w-0">
                <div class="m3-icon-group m3-icon-group-wb shrink-0">
                    <button type="button" ${!hasPrev ? 'disabled' : ''} onclick="window.app.navigatePopupQuestion(-1)" class="m3-icon-group-btn" title="Previous (Left Arrow / Swipe Right)">
                        <i class="ph-bold ph-caret-left"></i>
                    </button>
                    <span class="px-2 text-[11px] font-extrabold flex items-center justify-center shrink-0" style="color: var(--md-primary);">Q.${q.questionNumber} (${idx + 1}/${total})</span>
                    <button type="button" ${!hasNext ? 'disabled' : ''} onclick="window.app.navigatePopupQuestion(1)" class="m3-icon-group-btn" title="Next (Right Arrow / Swipe Left)">
                        <i class="ph-bold ph-caret-right"></i>
                    </button>
                </div>
                <span class="text-xs font-bold truncate hidden sm:inline">${q.subject} • ${q.chapter}</span>
            </div>

            <div class="flex items-center gap-1 shrink-0 ml-auto">
                <div class="m3-icon-group m3-icon-group-wb shrink-0 px-1 gap-1" title="Cross out ruled-out options">
                    ${['A', 'B', 'C', 'D'].map(opt => `
                        <button type="button" onclick="window.app.toggleEliminateOption('${opt}', ${q.id})" class="opt-elim-btn ${elimList.includes(opt) ? 'eliminated' : ''}">${opt}</button>
                    `).join('')}
                </div>

                <button type="button" onclick="window.app.toggleQuestionTimer()" ondblclick="window.app.resetQuestionTimer()" class="h-8 px-2.5 rounded-full m3-surface-high border border-[var(--md-outline-variant)] text-[11px] font-mono font-extrabold flex items-center gap-1 shrink-0" title="Click: Start/Pause (T) • Double-Click: Reset">
                    <i class="${timerIconClass}"></i>
                    <span class="popup-timer-text">${timerText}</span>
                </button>

                <div class="m3-icon-group m3-icon-group-wb shrink-0">
                    <button type="button" onclick="window.app.togglePopupQuestionBool('starred', ${q.id})" class="m3-icon-group-btn ${q.starred ? 'active-state' : ''}" title="Star (F)">
                        <i class="${q.starred ? 'ph-fill ph-star' : 'ph-bold ph-star'}"></i>
                    </button>
                    <button type="button" onclick="window.app.togglePopupQuestionBool('solved', ${q.id})" class="m3-icon-group-btn ${q.solved ? 'active-state' : ''}" title="Solved (S)">
                        <i class="${q.solved ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'}"></i>
                    </button>
                    <button type="button" onclick="window.app.openQuestionTagMenu(${q.id}, this)" class="m3-icon-group-btn ${q.noteTag ? 'active-state' : ''}" title="Tag">
                        <i class="ph-bold ph-tag"></i>
                    </button>
                </div>

                <div class="m3-icon-group m3-icon-group-wb shrink-0">
                    <button type="button" onclick="window.app.closeImagePopup(); window.app.openSplitModal(${q.id});" class="m3-icon-group-btn" title="Split or Trim">
                        <i class="ph-bold ph-scissors"></i>
                    </button>
                    <button type="button" onclick="window.app.openScratchpadFromPopup(${q.id})" class="m3-icon-group-btn gap-1 text-[11px] font-bold" title="Open Whiteboard (Horizontal Screen Only)">
                        <i class="ph-bold ph-pencil-line"></i>
                        <span class="hidden md:inline">Whiteboard</span>
                    </button>
                    <button type="button" onclick="window.app.closeImagePopup()" class="m3-icon-group-btn active-state" title="Close (Esc)">
                        <i class="ph-bold ph-x"></i>
                    </button>
                </div>
            </div>
        </div>

        <div class="w-full flex-1 min-h-0 overflow-y-auto bg-white flex p-3 sm:p-5 select-none">
            <img src="${q.imageDataUrl}" draggable="false" alt="Q.${q.questionNumber}" class="m-auto max-w-full max-h-[calc(82dvh-74px)] w-auto h-auto object-contain rounded-xl select-none pointer-events-none">
        </div>
    </div>
    `;
}

function renderPopupCarouselSlots() {
    const q = state.questions.find(i => i.id === Number(state.activePopupId));
    if (!q) return;

    const activeList = getLockedPadContextList(q.id);
    const idx = activeList.findIndex(item => item.id === q.id);
    const total = activeList.length;

    const prevQ = idx > 0 ? activeList[idx - 1] : null;
    const nextQ = idx >= 0 && idx < total - 1 ? activeList[idx + 1] : null;

    const slidePrev = document.getElementById('popupSlidePrev');
    const slideCurr = document.getElementById('popupSlideCurr');
    const slideNext = document.getElementById('popupSlideNext');
    const track = document.getElementById('popupCarouselTrack');

    if (slidePrev) slidePrev.innerHTML = prevQ ? buildPopupCardHtml(prevQ, idx - 1, total) : '';
    if (slideCurr) slideCurr.innerHTML = buildPopupCardHtml(q, idx, total);
    if (slideNext) slideNext.innerHTML = nextQ ? buildPopupCardHtml(nextQ, idx + 1, total) : '';

    if (track) {
        track.style.transition = 'none';
        track.style.transform = 'translate3d(-100vw, 0, 0)';
    }
    renderMockTestActiveBar();
}

function animatePopupCarouselToNeighbor(dir) {
    if (state.isPopupAnimating) return;
    const q = state.questions.find(i => i.id === Number(state.activePopupId));
    if (!q) return;

    const activeList = getLockedPadContextList(q.id);
    const idx = activeList.findIndex(item => item.id === q.id);
    const targetQ = activeList[idx + dir];
    const track = document.getElementById('popupCarouselTrack');

    if (!targetQ || !track) return;

    state.isPopupAnimating = true;
    initQuestionTimerIdle();
    track.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)';
    track.style.transform = dir > 0 ? 'translate3d(-200vw, 0, 0)' : 'translate3d(0vw, 0, 0)';

    setTimeout(() => {
        state.activePopupId = targetQ.id;
        syncUrlHashWithActiveQuestion(targetQ);
        renderPopupCarouselSlots();
        state.isPopupAnimating = false;
    }, 255);
}

function initPopupSwipeNavigation() {
    const viewport = document.getElementById('popupCarouselViewport');
    const track = document.getElementById('popupCarouselTrack');
    if (!viewport || !track) return;

    let startX = 0, startY = 0, currentDX = 0, isDragging = false, lockAxis = null;

    const getNavBounds = () => {
        const q = state.questions.find(i => i.id === Number(state.activePopupId));
        if (!q) return { canPrev: false, canNext: false };
        const activeList = getLockedPadContextList(q.id);
        const idx = activeList.findIndex(item => item.id === q.id);
        return {
            canPrev: idx > 0,
            canNext: idx >= 0 && idx < activeList.length - 1
        };
    };

    const onDragStart = (clientX, clientY, target) => {
        if (state.isPopupAnimating) return;
        if (target && target.closest && target.closest('button')) return;
        isDragging = true;
        lockAxis = null;
        startX = clientX;
        startY = clientY;
        currentDX = 0;
        track.style.transition = 'none';
    };

    const onDragMove = (clientX, clientY, rawEvent) => {
        if (!isDragging || state.isPopupAnimating) return;
        const dx = clientX - startX;
        const dy = clientY - startY;

        if (!lockAxis) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
                lockAxis = 'X';
            } else if (Math.abs(dy) > 12) {
                lockAxis = 'Y';
                isDragging = false;
                return;
            }
        }

        if (lockAxis === 'X') {
            if (rawEvent && rawEvent.cancelable) rawEvent.preventDefault();
            const { canPrev, canNext } = getNavBounds();
            let effectiveDX = dx;
            if ((dx > 0 && !canPrev) || (dx < 0 && !canNext)) {
                effectiveDX = dx * 0.22;
            }
            currentDX = dx;
            track.style.transform = `translate3d(calc(-100vw + ${effectiveDX.toFixed(1)}px), 0, 0)`;
        }
    };

    const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        if (lockAxis !== 'X') {
            lockAxis = null;
            return;
        }
        lockAxis = null;

        const { canPrev, canNext } = getNavBounds();
        const threshold = Math.min(80, window.innerWidth * 0.12);

        if (currentDX < -threshold && canNext) {
            animatePopupCarouselToNeighbor(1);
        } else if (currentDX > threshold && canPrev) {
            animatePopupCarouselToNeighbor(-1);
        } else {
            track.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
            track.style.transform = 'translate3d(-100vw, 0, 0)';
        }
        currentDX = 0;
    };

    viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        onDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        onDragMove(e.touches[0].clientX, e.touches[0].clientY, e);
    }, { passive: false });

    viewport.addEventListener('touchend', onDragEnd);
    viewport.addEventListener('touchcancel', onDragEnd);

    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        onDragStart(e.clientX, e.clientY, e.target);
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        onDragMove(e.clientX, e.clientY, e);
    });
    window.addEventListener('mouseup', onDragEnd);
}

function getActiveBoardContainer() {
    const id = state.activePadId || 'default';
    if (!state.wbBoards[id]) {
        state.wbBoards[id] = {
            currentPage: 0,
            pages: [{ items: [], undoStack: [], redoStack: [], scale: 1.0, panX: 0, panY: 0 }],
            blindPage: { items: [], undoStack: [], redoStack: [], scale: 1.0, panX: 0, panY: 0 },
            initialized: false
        };
    }
    return state.wbBoards[id];
}

function getActiveBoard() {
    const container = getActiveBoardContainer();
    if (state.blindModeActive) {
        return container.blindPage;
    }
    const idx = Math.max(0, Math.min(container.pages.length - 1, container.currentPage || 0));
    return container.pages[idx];
}

function refreshWhiteboardPageIndicator() {
    const container = getActiveBoardContainer();
    const ind = document.getElementById('wbPageIndicator');
    const prevBtn = document.getElementById('wbPrevPageBtn');
    const nextIcon = document.getElementById('wbNextOrAddPageIcon');
    if (!ind) return;

    if (state.blindModeActive) {
        ind.textContent = 'Blind';
        if (prevBtn) prevBtn.disabled = true;
        return;
    }

    const total = container.pages.length;
    const curr = (container.currentPage || 0) + 1;
    ind.textContent = `P.${curr}/${total}`;
    if (prevBtn) prevBtn.disabled = curr <= 1;
    if (nextIcon) {
        nextIcon.className = curr < total ? 'ph-bold ph-caret-right text-[10px]' : 'ph-bold ph-plus text-[10px]';
    }
}

function setWhiteboardLoadingLock(isLoading) {
    state.wbIsLoading = Boolean(isLoading);
    const badge = document.getElementById('wbLoadingBadge');
    if (badge) {
        badge.classList.toggle('hidden', !state.wbIsLoading);
        badge.classList.toggle('inline-flex', state.wbIsLoading);
    }
    document.querySelectorAll('.wb-mod-btn').forEach(btn => {
        btn.disabled = state.wbIsLoading;
    });
    if (state.wbIsLoading) ensureM3MorphLoopRunning();
}

function pageHasRoughWork(items) {
    if (!Array.isArray(items)) return false;
    return items.some(it =>
        it.type === 'STROKE' ||
        (it.type === 'IMAGE' && !it.isOriginalQ) ||
        (it.type === 'IMAGE' && it.isOriginalQ && Math.abs(Number(it.rotation) || 0) > 0.1)
    );
}

function serializeBoardItemsList(items) {
    return (items || []).map(it => {
        if (it.type === 'IMAGE') {
            return {
                id: it.id,
                type: 'IMAGE',
                isOriginalQ: Boolean(it.isOriginalQ),
                groupId: it.groupId || null,
                x: Math.round(it.x * 10) / 10,
                y: Math.round(it.y * 10) / 10,
                w: Math.round(it.w * 10) / 10,
                h: Math.round(it.h * 10) / 10,
                rotation: Math.round((Number(it.rotation) || 0) * 10) / 10,
                src: it.isOriginalQ ? null : it.src
            };
        }
        return {
            id: it.id,
            type: 'STROKE',
            groupId: it.groupId || null,
            color: it.color,
            width: it.width,
            rotation: Math.round((Number(it.rotation) || 0) * 10) / 10,
            points: (it.points || []).map(p => ({
                x: Math.round(p.x * 10) / 10,
                y: Math.round(p.y * 10) / 10
            }))
        };
    });
}

let wbSaveTimer = null;
function syncActiveBoardToQuestionGist(immediate = false) {
    if (state.blindModeActive) return;
    const q = state.questions.find(i => i.id === Number(state.activePadId));
    if (!q || state.wbIsLoading) return;
    const container = getActiveBoardContainer();
    const currPage = getActiveBoard();
    currPage.scale = state.wbScale;
    currPage.panX = Math.round(state.wbPanX);
    currPage.panY = Math.round(state.wbPanY);

    const anyRoughAcrossPages = container.pages.length > 1 || container.pages.some(p => pageHasRoughWork(p.items));
    if (!anyRoughAcrossPages) {
        if (q.whiteboardData !== null) {
            q.whiteboardData = null;
            scheduleCloudAutoSync(true);
        }
        return;
    }

    const serializedPages = container.pages.map(p => ({
        scale: p.scale || 1.0,
        panX: Math.round(p.panX || 0),
        panY: Math.round(p.panY || 0),
        items: serializeBoardItemsList(p.items)
    }));

    q.whiteboardData = {
        v: 2,
        currentPage: container.currentPage || 0,
        scale: serializedPages[0].scale,
        panX: serializedPages[0].panX,
        panY: serializedPages[0].panY,
        items: serializedPages[0].items,
        pages: serializedPages
    };

    clearTimeout(wbSaveTimer);
    if (immediate) {
        scheduleCloudAutoSync(true);
    } else {
        wbSaveTimer = setTimeout(() => scheduleCloudAutoSync(true), 800);
    }
}

function createDefaultQuestionImageItem(q, imgEl) {
    const targetW = Math.min(680, Math.max(400, Math.round(window.innerWidth * 0.45)));
    const ratio = imgEl.height / (imgEl.width || 1);
    const targetH = Math.round(targetW * ratio);
    return {
        id: generateUniqueId(),
        type: 'IMAGE',
        isOriginalQ: true,
        groupId: null,
        x: 36,
        y: 44,
        w: targetW,
        h: targetH,
        rotation: 0,
        src: q.imageDataUrl,
        imgEl
    };
}

const loadImageElementAsync = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
});

async function hydrateSerializedItems(rawItems, q, baseQImg, defaultQItem, token, ensureBaseImage = false) {
    const hydrated = [];
    for (const rawIt of (rawItems || [])) {
        if (rawIt.type === 'IMAGE') {
            const srcToLoad = rawIt.isOriginalQ ? q.imageDataUrl : (rawIt.src || q.imageDataUrl);
            const loadedImg = rawIt.isOriginalQ ? baseQImg : await loadImageElementAsync(srcToLoad);
            if (token !== state.wbLoadToken) return null;
            if (loadedImg) {
                hydrated.push({
                    id: rawIt.id || generateUniqueId(),
                    type: 'IMAGE',
                    isOriginalQ: Boolean(rawIt.isOriginalQ),
                    groupId: rawIt.groupId || null,
                    x: Number(rawIt.x) ?? 36,
                    y: Number(rawIt.y) ?? 44,
                    w: Number(rawIt.w) || (defaultQItem ? defaultQItem.w : 500),
                    h: Number(rawIt.h) || (defaultQItem ? defaultQItem.h : 250),
                    rotation: Number(rawIt.rotation) || 0,
                    src: srcToLoad,
                    imgEl: loadedImg
                });
            }
        } else if (rawIt.type === 'STROKE' && Array.isArray(rawIt.points) && rawIt.points.length > 0) {
            hydrated.push({
                id: rawIt.id || generateUniqueId(),
                type: 'STROKE',
                groupId: rawIt.groupId || null,
                color: rawIt.color || '#0f172a',
                width: Number(rawIt.width) || 3.5,
                rotation: Number(rawIt.rotation) || 0,
                points: rawIt.points.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }))
            });
        }
    }
    if (ensureBaseImage && !hydrated.some(it => it.isOriginalQ) && defaultQItem) {
        hydrated.unshift({ ...defaultQItem, id: generateUniqueId() });
    }
    return hydrated;
}

async function loadQuestionBoardInBackground(q) {
    const token = ++state.wbLoadToken;
    const container = getActiveBoardContainer();

    setWhiteboardLoadingLock(true);

    const baseQImg = await loadImageElementAsync(q.imageDataUrl);
    if (token !== state.wbLoadToken) return;

    const defaultQItem = baseQImg ? createDefaultQuestionImageItem(q, baseQImg) : null;
    container.blindPage = {
        items: defaultQItem ? [{ ...defaultQItem, id: generateUniqueId() }] : [],
        undoStack: [],
        redoStack: [],
        scale: 1.0,
        panX: 0,
        panY: 0
    };

    const saved = q.whiteboardData;
    const rawPages = saved?.pages && Array.isArray(saved.pages) && saved.pages.length > 0
        ? saved.pages
        : (saved && Array.isArray(saved.items) ? [{ scale: saved.scale, panX: saved.panX, panY: saved.panY, items: saved.items }] : []);

    const hasSavedRoughWork = rawPages.length > 1 || rawPages.some(p => pageHasRoughWork(p.items));

    if (!hasSavedRoughWork) {
        q.whiteboardData = null;
        container.currentPage = 0;
        container.pages = [{
            items: defaultQItem ? [defaultQItem] : [],
            undoStack: [],
            redoStack: [],
            scale: 1.0,
            panX: 0,
            panY: 0
        }];
        container.initialized = true;
        state.wbScale = 1.0;
        state.wbPanX = 0;
        state.wbPanY = 0;
        setWhiteboardLoadingLock(false);
        refreshWhiteboardPageIndicator();
        initStylusCanvas();
        return;
    }

    if (!container.initialized && defaultQItem) {
        container.pages = [{
            items: [defaultQItem],
            undoStack: [],
            redoStack: [],
            scale: Number(rawPages[0]?.scale) || 1.0,
            panX: Number(rawPages[0]?.panX) || 0,
            panY: Number(rawPages[0]?.panY) || 0
        }];
    }
    state.wbScale = Number(rawPages[0]?.scale) || 1.0;
    state.wbPanX = Number(rawPages[0]?.panX) || 0;
    state.wbPanY = Number(rawPages[0]?.panY) || 0;
    initStylusCanvas();

    await new Promise(r => setTimeout(r, 35));
    if (token !== state.wbLoadToken) return;

    const hydratedPages = [];
    for (let pIdx = 0; pIdx < rawPages.length; pIdx++) {
        const rawP = rawPages[pIdx];
        const items = await hydrateSerializedItems(rawP.items, q, baseQImg, defaultQItem, token, pIdx === 0);
        if (token !== state.wbLoadToken || !items) return;
        hydratedPages.push({
            items,
            undoStack: [],
            redoStack: [],
            scale: Number(rawP.scale) || 1.0,
            panX: Number(rawP.panX) || 0,
            panY: Number(rawP.panY) || 0
        });
    }

    container.pages = hydratedPages;
    container.currentPage = Math.max(0, Math.min(hydratedPages.length - 1, Number(saved?.currentPage) || 0));
    container.initialized = true;

    const activePage = getActiveBoard();
    state.wbScale = activePage.scale || 1.0;
    state.wbPanX = activePage.panX || 0;
    state.wbPanY = activePage.panY || 0;

    setWhiteboardLoadingLock(false);
    refreshWhiteboardPageIndicator();
    renderWhiteboardCanvas();
}

function cloneBoardItems(items) {
    return items.map(it => {
        if (it.type === 'IMAGE') return { ...it, rotation: Number(it.rotation) || 0 };
        return {
            ...it,
            rotation: Number(it.rotation) || 0,
            points: (it.points || []).map(p => ({ x: p.x, y: p.y }))
        };
    });
}

function pushBoardUndoState() {
    const board = getActiveBoard();
    board.undoStack.push(cloneBoardItems(board.items));
    if (board.undoStack.length > 40) board.undoStack.shift();
    board.redoStack = [];
}

function rotatePointAround(px, py, cx, cy, angleDeg) {
    const rad = (Number(angleDeg) * Math.PI) / 180;
    const cosA = Math.cos(rad), sinA = Math.sin(rad);
    const dx = px - cx, dy = py - cy;
    return {
        x: cx + dx * cosA - dy * sinA,
        y: cy + dx * sinA + dy * cosA
    };
}

function applyRotationDeltaToItems(itemsToRotate, pivotX, pivotY, deltaDeg) {
    if (!itemsToRotate || itemsToRotate.length === 0 || Math.abs(deltaDeg) < 0.001) return;
    for (const it of itemsToRotate) {
        if (it.type === 'IMAGE') {
            const icx = it.x + it.w / 2;
            const icy = it.y + it.h / 2;
            const newCenter = rotatePointAround(icx, icy, pivotX, pivotY, deltaDeg);
            it.x = newCenter.x - it.w / 2;
            it.y = newCenter.y - it.h / 2;
            it.rotation = ((Number(it.rotation) || 0) + deltaDeg) % 360;
        } else if (it.type === 'STROKE' && Array.isArray(it.points)) {
            it.points = it.points.map(p => rotatePointAround(p.x, p.y, pivotX, pivotY, deltaDeg));
            it.rotation = ((Number(it.rotation) || 0) + deltaDeg) % 360;
        }
    }
}

function getItemBounds(item) {
    if (!item) return null;
    if (item.type === 'IMAGE') {
        const rot = Number(item.rotation) || 0;
        if (Math.abs(rot) < 0.1) {
            return { minX: item.x, minY: item.y, maxX: item.x + item.w, maxY: item.y + item.h };
        }
        const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
        const corners = [
            rotatePointAround(item.x, item.y, cx, cy, rot),
            rotatePointAround(item.x + item.w, item.y, cx, cy, rot),
            rotatePointAround(item.x + item.w, item.y + item.h, cx, cy, rot),
            rotatePointAround(item.x, item.y + item.h, cx, cy, rot)
        ];
        return {
            minX: Math.min(...corners.map(c => c.x)),
            minY: Math.min(...corners.map(c => c.y)),
            maxX: Math.max(...corners.map(c => c.x)),
            maxY: Math.max(...corners.map(c => c.y))
        };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of (item.points || [])) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    const pad = Math.max(6, (item.width || 3.5));
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function getCombinedSelectedBounds() {
    const board = getActiveBoard();
    if (!state.wbSelectedIds || state.wbSelectedIds.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;

    for (const id of state.wbSelectedIds) {
        const it = board.items.find(i => i.id === id);
        if (!it) continue;
        const b = getItemBounds(it);
        if (!b) continue;
        found = true;
        if (b.minX < minX) minX = b.minX;
        if (b.minY < minY) minY = b.minY;
        if (b.maxX > maxX) maxX = b.maxX;
        if (b.maxY > maxY) maxY = b.maxY;
    }
    return found ? { minX, minY, maxX, maxY } : null;
}

function expandSelectionWithGroups(ids) {
    const board = getActiveBoard();
    const groupSet = new Set();
    for (const id of ids) {
        const it = board.items.find(i => i.id === id);
        if (it && it.groupId) groupSet.add(it.groupId);
    }
    if (groupSet.size === 0) return Array.from(new Set(ids));
    const finalIds = new Set(ids);
    for (const it of board.items) {
        if (it.groupId && groupSet.has(it.groupId)) finalIds.add(it.id);
    }
    return Array.from(finalIds);
}

function updateSelectionHudVisibility() {
    const hud = document.getElementById('wbSelectionHud');
    const grpBtn = document.getElementById('wbGroupBtn');
    const ungrpBtn = document.getElementById('wbUngroupBtn');
    if (!hud) return;

    const board = getActiveBoard();
    const selectedItems = board.items.filter(it => state.wbSelectedIds.includes(it.id));
    const hasSel = selectedItems.length > 0 && !state.wbIsLoading;

    hud.classList.toggle('hidden', !hasSel);
    hud.classList.toggle('inline-flex', hasSel);

    if (grpBtn) {
        const canGroup = selectedItems.length >= 2;
        grpBtn.classList.toggle('hidden', !canGroup);
        grpBtn.classList.toggle('inline-flex', canGroup);
    }
    if (ungrpBtn) {
        const hasGrouped = selectedItems.some(it => Boolean(it.groupId));
        ungrpBtn.classList.toggle('hidden', !hasGrouped);
        ungrpBtn.classList.toggle('inline-flex', hasGrouped);
    }
}
function renderMarkdownAndLatex(rawStr) {
    if (!rawStr) return '';
    let text = String(rawStr);

    // 1. Extract and render LaTeX math blocks first so Marked.js doesn't mangle underscores (e.g. $B_1$)
    const mathPlaceholders = [];
    const storeMath = (mathExpr, displayMode) => {
        const token = `@@MATH_TOKEN_${mathPlaceholders.length}@@`;
        let rendered = mathExpr;
        try {
            if (typeof window.katex !== 'undefined') {
                rendered = window.katex.renderToString(mathExpr.trim(), {
                    displayMode,
                    throwOnError: false
                });
            }
        } catch (_) {}
        mathPlaceholders.push({ token, html: rendered });
        return token;
    };

    // Match $$...$$ and \[...\] (Block Math)
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => storeMath(m, true));
    text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => storeMath(m, true));

    // Match $...$ and \(...\) (Inline Math)
    text = text.replace(/\$([^\$\n]+?)\$/g, (_, m) => storeMath(m, false));
    text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => storeMath(m, false));

    // 2. Render Markdown inline (bold, italics, code) via Marked.js if loaded
    let html = text;
    try {
        if (typeof window.marked !== 'undefined') {
            html = typeof window.marked.parseInline === 'function'
                ? window.marked.parseInline(text)
                : window.marked.parse(text).replace(/^<p>|<\/p>\n?$/g, '');
        }
    } catch (_) {}

    // 3. Restore rendered KaTeX HTML spans
    for (const item of mathPlaceholders) {
        html = html.split(item.token).join(item.html);
    }
    return html;
}

function refreshScratchpadTopBarAndHints() {
    const q = state.questions.find(i => i.id === Number(state.activePadId));
    if (!q) return;

    const activeList = getLockedPadContextList(q.id);
    const idx = activeList.findIndex(item => item.id === q.id);

    const titleEl = document.getElementById('padQTitle');
    if (titleEl) {
        const shortSubj = q.subject === 'Mathematics' ? 'Maths' : q.subject;
        titleEl.textContent = `Q.${q.questionNumber} (${idx + 1}/${activeList.length}) • ${shortSubj}`;
    }

    const prevBtn = document.getElementById('padPrevBtn');
    const nextBtn = document.getElementById('padNextBtn');
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx < 0 || idx >= activeList.length - 1;

    const starBtn = document.getElementById('padStarBtn');
    const starIcon = document.getElementById('padStarIcon');
    const solvedBtn = document.getElementById('padSolvedBtn');
    const solvedIcon = document.getElementById('padSolvedIcon');
    const tagBtn = document.getElementById('padTagBtn');

    if (starBtn && starIcon) {
        starBtn.classList.toggle('active-state', Boolean(q.starred));
        starIcon.className = q.starred ? 'ph-fill ph-star' : 'ph-bold ph-star';
    }
    if (solvedBtn && solvedIcon) {
        solvedBtn.classList.toggle('active-state', Boolean(q.solved));
        solvedIcon.className = q.solved ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle';
    }
    if (tagBtn) {
        tagBtn.classList.toggle('active-state', Boolean(q.noteTag));
    }

    const elimList = state.blindModeActive ? [] : (q.eliminatedOptions || []);
    document.querySelectorAll('.wb-opt-elim').forEach(btn => {
        const opt = btn.getAttribute('data-opt-btn');
        btn.classList.toggle('eliminated', elimList.includes(opt));
    });

    document.getElementById('wbStylusOnlyBtn')?.classList.toggle('active-state', state.wbStylusOnly);
    document.getElementById('wbDarkCanvasBtn')?.classList.toggle('active-state', state.wbDarkCanvas);
    document.getElementById('padBlindModeBtn')?.classList.toggle('active-state', state.blindModeActive);

    updateTimerUI();
    refreshWhiteboardPageIndicator();
    renderMockTestActiveBar();

    const drawer = document.getElementById('padHintAnswerDrawer');
    const blindBanner = document.getElementById('padBlindBanner');
    const hintBox = document.getElementById('padHintBox');
    const ansBox = document.getElementById('padAnsBox');
    const hintTxt = document.getElementById('padHintText');
    const ansTxt = document.getElementById('padAnsText');
    const hintBtn = document.getElementById('padHintToggleBtn');
    const ansBtn = document.getElementById('padAnsToggleBtn');
    const solveBtn = document.getElementById('padSolveNowBtn');

    hintBtn?.classList.toggle('active-state', state.padShowHint);
    ansBtn?.classList.toggle('active-state', state.padShowAns);

    const showAny = state.padShowHint || state.padShowAns || state.blindModeActive;
    if (drawer) {
        drawer.classList.toggle('hidden', !showAny);
        drawer.classList.toggle('flex', showAny);
    }
    if (blindBanner) {
        blindBanner.classList.toggle('hidden', !state.blindModeActive);
        blindBanner.classList.toggle('inline-flex', state.blindModeActive);
    }
    if (hintBox) {
        hintBox.classList.toggle('hidden', !state.padShowHint);
        hintBox.classList.toggle('inline-flex', state.padShowHint);
    }
    if (ansBox) {
        ansBox.classList.toggle('hidden', !state.padShowAns);
        ansBox.classList.toggle('inline-flex', state.padShowAns);
    }

    if (hintTxt) {
        hintTxt.innerHTML = renderMarkdownAndLatex(
            q.hint || 'Click "Generate with Gemini 3.8" to get a 1-line hint →'
        );
    }
    if (ansTxt) {
        ansTxt.innerHTML = renderMarkdownAndLatex(
            q.answerKey || 'Not solved yet'
        );
    }

    if (solveBtn) solveBtn.classList.toggle('hidden', Boolean(q.hint && q.answerKey));
}


function rdpSimplify(points, epsilon) {
    if (points.length < 3) return points;
    let dmax = 0, index = 0;
    const end = points.length - 1;
    const p1 = points[0], p2 = points[end];
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    for (let i = 1; i < end; i++) {
        let d = 0;
        if (lenSq === 0) {
            d = Math.hypot(points[i].x - p1.x, points[i].y - p1.y);
        } else {
            const t = Math.max(0, Math.min(1, ((points[i].x - p1.x) * dx + (points[i].y - p1.y) * dy) / lenSq));
            d = Math.hypot(points[i].x - (p1.x + t * dx), points[i].y - (p1.y + t * dy));
        }
        if (d > dmax) { index = i; dmax = d; }
    }

    if (dmax > epsilon) {
        const rec1 = rdpSimplify(points.slice(0, index + 1), epsilon);
        const rec2 = rdpSimplify(points.slice(index), epsilon);
        return rec1.slice(0, rec1.length - 1).concat(rec2);
    }
    return [p1, p2];
}
// ===================================================================
// UPGRADED SHAPE DETECTOR (ShortStraw Corner Finder + PaleoSketch Geometry)
// Supports: Snapped Lines, Arrows, Circles, Ellipses, Rectangles, Squares,
// Right/Equilateral/General Triangles, Parallelograms & L-Axes
// ===================================================================
function resamplePointsByArcLength(pts, numTarget = 64) {
    if (!pts || pts.length < 2) return pts || [];
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
        totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    if (totalLen < 1e-3) return [pts[0]];

    const step = totalLen / (numTarget - 1);
    const resampled = [{ x: pts[0].x, y: pts[0].y }];
    let accDist = 0;
    let prev = { x: pts[0].x, y: pts[0].y };

    for (let i = 1; i < pts.length; i++) {
        const curr = pts[i];
        let segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        while (accDist + segLen >= step && resampled.length < numTarget) {
            const remain = step - accDist;
            const t = segLen > 0 ? remain / segLen : 0;
            const nx = prev.x + t * (curr.x - prev.x);
            const ny = prev.y + t * (curr.y - prev.y);
            resampled.push({ x: nx, y: ny });
            prev = { x: nx, y: ny };
            segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
            accDist = 0;
        }
        accDist += segLen;
        prev = curr;
    }
    if (resampled.length < numTarget) {
        resampled.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    }
    return resampled;
}

function shortStrawFindCorners(resampled, isClosedShape = false) {
    const n = resampled.length;
    if (n < 7) return [0, n - 1];
    const W = 3;
    const straws = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        if (!isClosedShape && (i < W || i >= n - W)) {
            straws[i] = 1e6;
        } else {
            const idxA = (i - W + n) % n;
            const idxB = (i + W) % n;
            straws[i] = Math.hypot(
                resampled[idxB].x - resampled[idxA].x,
                resampled[idxB].y - resampled[idxA].y
            );
        }
    }

    const validStraws = Array.from(straws).filter(v => v < 1e5).sort((a, b) => a - b);
    const medianStraw = validStraws[Math.floor(validStraws.length / 2)] || 1;
    const threshold = medianStraw * 0.93;

    const cornerIndices = isClosedShape ? [] : [0];
    const startIdx = isClosedShape ? 0 : W;
    const endIdx = isClosedShape ? n - 1 : n - W - 1;

    for (let i = startIdx; i <= endIdx; i++) {
        if (straws[i] < threshold) {
            let localMin = straws[i];
            let localMinIdx = i;
            while (i < endIdx && straws[i + 1] < threshold) {
                i++;
                if (straws[i] < localMin) {
                    localMin = straws[i];
                    localMinIdx = i;
                }
            }
            cornerIndices.push(localMinIdx);
        }
    }
    if (!isClosedShape) cornerIndices.push(n - 1);

    // Post-process: remove false corners where segments between c[i-1] and c[i+1] are nearly straight
    const isLineBetween = (idx1, idx2) => {
        const pA = resampled[idx1], pB = resampled[idx2];
        const directDist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
        let pathDist = 0;
        let k = idx1;
        while (k !== idx2) {
            const nextK = (k + 1) % n;
            pathDist += Math.hypot(resampled[nextK].x - resampled[k].x, resampled[nextK].y - resampled[k].y);
            k = nextK;
            if (!isClosedShape && k >= idx2) break;
        }
        return pathDist > 0 && (directDist / pathDist) > 0.955;
    };

    let changed = true;
    while (changed && cornerIndices.length > (isClosedShape ? 3 : 2)) {
        changed = false;
        for (let i = 1; i < cornerIndices.length - 1; i++) {
            if (isLineBetween(cornerIndices[i - 1], cornerIndices[i + 1])) {
                cornerIndices.splice(i, 1);
                changed = true;
                break;
            }
        }
    }
    return cornerIndices;
}

function snapSegmentEndpointAngle(p1, p2, snapTolDeg = 5.5) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return { x: p2.x, y: p2.y };
    const deg = Math.atan2(dy, dx) * (180 / Math.PI);
    const snapTargets = [-180, -150, -135, -120, -90, -60, -45, -30, 0, 30, 45, 60, 90, 120, 135, 150, 180];
    for (const target of snapTargets) {
        if (Math.abs(deg - target) <= snapTolDeg) {
            const rad = (target * Math.PI) / 180;
            return {
                x: p1.x + len * Math.cos(rad),
                y: p1.y + len * Math.sin(rad)
            };
        }
    }
    return { x: p2.x, y: p2.y };
}

function recognizeAndConvertStrokeToShape(rawPts) {
    if (!state.wbAutoShape || !rawPts || rawPts.length < 6) return null;

    let pathLen = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < rawPts.length; i++) {
        const p = rawPts[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (i > 0) pathLen += Math.hypot(p.x - rawPts[i - 1].x, p.y - rawPts[i - 1].y);
    }

    const w = maxX - minX, h = maxY - minY;
    const diag = Math.hypot(w, h);
    const minSize = 20 / state.wbScale;
    if (diag < minSize || pathLen < minSize) return null;

    const startPt = rawPts[0];
    const endPt = rawPts[rawPts.length - 1];
    const endDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);

    // 1. STRAIGHT LINE DETECTION (Path-to-Chord Ratio + Max Perpendicular Deviation)
    if (endDist > minSize && (pathLen / endDist) < 1.085) {
        const vx = (endPt.x - startPt.x) / endDist;
        const vy = (endPt.y - startPt.y) / endDist;
        let maxPerpDev = 0;
        for (const p of rawPts) {
            const perp = Math.abs((p.x - startPt.x) * (-vy) + (p.y - startPt.y) * vx);
            if (perp > maxPerpDev) maxPerpDev = perp;
        }
        if (maxPerpDev < Math.max(12 / state.wbScale, endDist * 0.065)) {
            const snappedEnd = snapSegmentEndpointAngle(startPt, endPt, 5.5);
            return [{ x: startPt.x, y: startPt.y }, snappedEnd];
        }
    }

    // Trim tail overshoot if the user closed a loop and slightly overlapped the start point
    let workingPts = rawPts;
    let minCloseDist = endDist;
    if (rawPts.length > 16) {
        const startSearch = Math.floor(rawPts.length * 0.68);
        let bestIdx = rawPts.length - 1;
        for (let i = startSearch; i < rawPts.length; i++) {
            const d = Math.hypot(rawPts[i].x - startPt.x, rawPts[i].y - startPt.y);
            if (d < minCloseDist) {
                minCloseDist = d;
                bestIdx = i;
            }
        }
        if (minCloseDist < Math.max(42 / state.wbScale, pathLen * 0.22)) {
            workingPts = rawPts.slice(0, bestIdx + 1);
        }
    }

    const isClosed = minCloseDist < Math.max(44 / state.wbScale, pathLen * 0.24) &&
                     w > minSize * 0.32 && h > minSize * 0.32;

    const resampled = resamplePointsByArcLength(workingPts, 64);

    // 2. OPEN POLYLINE / L-AXES / OPEN TRIANGLE DETECTION (2 or 3 straight segments)
    if (!isClosed) {
        const openCorners = shortStrawFindCorners(resampled, false);
        if (openCorners.length === 3) {
            // 2-segment L-axis or V-angle: check if both legs are straight
            const p0 = resampled[openCorners[0]];
            const p1 = resampled[openCorners[1]];
            const p2 = resampled[openCorners[2]];
            const seg1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            const seg2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (seg1 > minSize * 0.5 && seg2 > minSize * 0.5 && (seg1 + seg2) / pathLen > 0.91) {
                const s0 = snapSegmentEndpointAngle(p1, p0, 6);
                const s2 = snapSegmentEndpointAngle(p1, p2, 6);
                return [s0, { x: p1.x, y: p1.y }, s2];
            }
        }
        return null;
    }

    // 3. CLOSED SHAPE CLASSIFICATION (PaleoSketch Circularity + ShortStraw Corners)
    const closedSample = [...resampled, resampled[0]];
    let area2 = 0, perim = 0;
    for (let i = 0; i < closedSample.length - 1; i++) {
        area2 += (closedSample[i].x * closedSample[i + 1].y - closedSample[i + 1].x * closedSample[i].y);
        perim += Math.hypot(
            closedSample[i + 1].x - closedSample[i].x,
            closedSample[i + 1].y - closedSample[i].y
        );
    }
    const polyArea = Math.abs(area2) / 2;
    const bboxArea = Math.max(1, w * h);
    const areaFillRatio = polyArea / bboxArea;
    // Isoperimetric Quotient: 1.0 for ideal circle, ~0.785 for square, ~0.60 for equilateral triangle
    const circularity = (4 * Math.PI * polyArea) / Math.max(1, perim * perim);

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    let rx = w / 2, ry = h / 2;
    let radialErrSum = 0;
    for (const p of resampled) {
        const normDist = Math.hypot((p.x - cx) / Math.max(1, rx), (p.y - cy) / Math.max(1, ry));
        radialErrSum += Math.abs(normDist - 1);
    }
    const meanRadialErr = radialErrSum / resampled.length;

    const rdpCorners = rdpSimplify(closedSample, diag * 0.062);
    const filteredVerts = [rdpCorners[0]];
    for (let i = 1; i < rdpCorners.length - 1; i++) {
        const prev = filteredVerts[filteredVerts.length - 1];
        const curr = rdpCorners[i];
        const next = rdpCorners[i + 1];
        if (Math.hypot(curr.x - prev.x, curr.y - prev.y) < diag * 0.12) continue;
        const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
        let diff = Math.abs(a2 - a1) * (180 / Math.PI);
        if (diff > 180) diff = 360 - diff;
        if (diff > 26) filteredVerts.push({ x: curr.x, y: curr.y });
    }
    if (filteredVerts.length > 2 &&
        Math.hypot(filteredVerts[filteredVerts.length - 1].x - filteredVerts[0].x,
                   filteredVerts[filteredVerts.length - 1].y - filteredVerts[0].y) < diag * 0.14) {
        filteredVerts.pop();
    }

    // A. TRIANGLE (3 distinct corners or triangular area fill ~0.42..0.64)
    if (filteredVerts.length === 3 || (filteredVerts.length === 4 && areaFillRatio < 0.61 && meanRadialErr > 0.125)) {
        const tri = filteredVerts.slice(0, 3).map(v => ({ x: v.x, y: v.y }));
        // Snap nearly horizontal/vertical triangle edges (e.g., right-angled triangle on incline/axes)
        for (let i = 0; i < 3; i++) {
            const pA = tri[i], pB = tri[(i + 1) % 3];
            const deg = Math.abs(Math.atan2(pB.y - pA.y, pB.x - pA.x) * (180 / Math.PI));
            if (deg < 5.5 || deg > 174.5) {
                const avgY = (pA.y + pB.y) / 2;
                pA.y = avgY; pB.y = avgY;
            } else if (Math.abs(deg - 90) < 5.5) {
                const avgX = (pA.x + pB.x) / 2;
                pA.x = avgX; pB.x = avgX;
            }
        }
        return [{ ...tri[0] }, { ...tri[1] }, { ...tri[2] }, { ...tri[0] }];
    }

    // B. CIRCLE / ELLIPSE (Low radial error & high circularity, no sharp 90° box corners)
    if (meanRadialErr < 0.118 && circularity > 0.79 && filteredVerts.length !== 4) {
        if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.22) {
            rx = ry = (rx + ry) / 2;
        }
        const circlePts = [];
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            circlePts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
        }
        return circlePts;
    }

    // C. RECTANGLE / SQUARE / PARALLELOGRAM (4 corners or high bounding-box fill)
    if (filteredVerts.length === 4 || (areaFillRatio >= 0.76 && meanRadialErr >= 0.11)) {
        // Check if the 4 vertices form a tilted parallelogram vs axis-aligned rectangle
        if (filteredVerts.length === 4) {
            const v = filteredVerts;
            const edgeAngles = [0, 1, 2, 3].map(i => {
                const next = v[(i + 1) % 4];
                return Math.atan2(next.y - v[i].y, next.x - v[i].x) * (180 / Math.PI);
            });
            const isAxisAligned = edgeAngles.every(ang => {
                const a = Math.abs(ang);
                return a < 12 || a > 168 || Math.abs(a - 90) < 12;
            });
            if (!isAxisAligned) {
                // Rectify into a clean parallelogram by making v[3] = v[0] + (v[2] - v[1])
                const p0 = v[0], p1 = v[1], p2 = v[2];
                const p3 = { x: p0.x + (p2.x - p1.x), y: p0.y + (p2.y - p1.y) };
                return [{ ...p0 }, { ...p1 }, { ...p2 }, p3, { ...p0 }];
            }
        }

        let halfW = w / 2, halfH = h / 2;
        if (Math.abs(w - h) / Math.max(w, h) < 0.17) {
            halfW = halfH = (halfW + halfH) / 2;
        }
        return [
            { x: cx - halfW, y: cy - halfH },
            { x: cx + halfW, y: cy - halfH },
            { x: cx + halfW, y: cy + halfH },
            { x: cx - halfW, y: cy + halfH },
            { x: cx - halfW, y: cy - halfH }
        ];
    }

    // Fallback: if circularity is still high, snap to circle/ellipse
    if (meanRadialErr < 0.132 && circularity > 0.75) {
        if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.22) rx = ry = (rx + ry) / 2;
        const circlePts = [];
        for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            circlePts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
        }
        return circlePts;
    }

    return null;
}


function createPresetShapePoints(shapeType, cx, cy) {
    const r = 85 / state.wbScale;
    if (shapeType === 'RECT') {
        return [
            { x: cx - r * 1.2, y: cy - r * 0.85 },
            { x: cx + r * 1.2, y: cy - r * 0.85 },
            { x: cx + r * 1.2, y: cy + r * 0.85 },
            { x: cx - r * 1.2, y: cy + r * 0.85 },
            { x: cx - r * 1.2, y: cy - r * 0.85 }
        ];
    }
    if (shapeType === 'CIRCLE') {
        const pts = [];
        for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        return pts;
    }
    if (shapeType === 'TRIANGLE') {
        return [
            { x: cx, y: cy - r },
            { x: cx + r * 0.95, y: cy + r * 0.8 },
            { x: cx - r * 0.95, y: cy + r * 0.8 },
            { x: cx, y: cy - r }
        ];
    }
    if (shapeType === 'RIGHT_TRIANGLE') {
        return [
            { x: cx - r, y: cy - r },
            { x: cx - r, y: cy + r },
            { x: cx + r * 1.1, y: cy + r },
            { x: cx - r, y: cy - r }
        ];
    }
    if (shapeType === 'LINE') {
        return [
            { x: cx - r * 1.3, y: cy },
            { x: cx + r * 1.3, y: cy }
        ];
    }
    if (shapeType === 'AXES') {
        return [
            { x: cx - r * 1.3, y: cy },
            { x: cx + r * 1.3, y: cy },
            { x: cx, y: cy },
            { x: cx, y: cy - r * 1.3 },
            { x: cx, y: cy + r * 1.3 }
        ];
    }
    return null;
}

function drawBoardItemsToContext(ctx, items) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const item of items) {
        if (item.type === 'IMAGE' && item.imgEl) {
            ctx.save();
            const cx = item.x + item.w / 2;
            const cy = item.y + item.h / 2;
            const rotRad = ((Number(item.rotation) || 0) * Math.PI) / 180;
            ctx.translate(cx, cy);
            if (rotRad !== 0) ctx.rotate(rotRad);
            ctx.shadowColor = 'rgba(15, 23, 42, 0.1)';
            ctx.shadowBlur = 14 / state.wbScale;
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
            ctx.lineWidth = 1.2 / state.wbScale;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
            ctx.strokeRect(-item.w / 2, -item.h / 2, item.w, item.h);
            ctx.drawImage(item.imgEl, -item.w / 2, -item.h / 2, item.w, item.h);
            ctx.restore();
        } else if (item.type === 'STROKE' && item.points && item.points.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = item.color === '#f8fafc' ? '#0f172a' : item.color;
            ctx.lineWidth = item.width;
            ctx.moveTo(item.points[0].x, item.points[0].y);
            for (let i = 1; i < item.points.length; i++) {
                ctx.lineTo(item.points[i].x, item.points[i].y);
            }
            ctx.stroke();
        }
    }
}

let activeOverlayRect = null;
let laserAnimId = null;

function stepLaserFade() {
    const now = performance.now();
    state.laserPoints = state.laserPoints.filter(p => now - p.t < 550);
    renderWhiteboardCanvas();
    if (state.laserPoints.length > 0) {
        laserAnimId = requestAnimationFrame(stepLaserFade);
    } else {
        laserAnimId = null;
    }
}

function renderWhiteboardCanvas() {
    const wrap = document.getElementById('padCanvasWrap');
    const canvas = document.getElementById('stylusCanvas');
    if (!wrap || !canvas) return;

    canvas.style.filter = state.wbDarkCanvas ? 'invert(0.92) hue-rotate(180deg)' : 'none';
    wrap.style.backgroundColor = state.wbDarkCanvas ? '#11131a' : '#ffffff';

    const dpr = window.devicePixelRatio || 1;
    const cw = wrap.clientWidth || 800;
    const ch = wrap.clientHeight || 600;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    const baseStep = 34;
    const screenStep = baseStep * state.wbScale;
    if (screenStep >= 11 && state.wbGridMode !== 'BLANK') {
        const offsetX = ((state.wbPanX % screenStep) + screenStep) % screenStep;
        const offsetY = ((state.wbPanY % screenStep) + screenStep) % screenStep;
        if (state.wbGridMode === 'DOTS') {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
            const dotR = Math.max(0.9, Math.min(1.8, 1.15 * state.wbScale));
            for (let x = offsetX; x < cw; x += screenStep) {
                for (let y = offsetY; y < ch; y += screenStep) {
                    ctx.beginPath();
                    ctx.arc(x, y, dotR, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (state.wbGridMode === 'GRID') {
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.075)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = offsetX; x < cw; x += screenStep) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, ch);
            }
            for (let y = offsetY; y < ch; y += screenStep) {
                ctx.moveTo(0, y);
                ctx.lineTo(cw, y);
            }
            ctx.stroke();
        }
    }

    ctx.translate(state.wbPanX, state.wbPanY);
    ctx.scale(state.wbScale, state.wbScale);

    const board = getActiveBoard();
    drawBoardItemsToContext(ctx, board.items);

    if (state.laserPoints.length > 1) {
        const now = performance.now();
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < state.laserPoints.length; i++) {
            const p0 = state.laserPoints[i - 1], p1 = state.laserPoints[i];
            const age = (now - p1.t) / 550;
            const alpha = Math.max(0, 1 - age);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(244, 63, 94, ${alpha.toFixed(2)})`;
            ctx.lineWidth = (5.5 * (1 - age * 0.5)) / state.wbScale;
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    const selBounds = getCombinedSelectedBounds();
    if (selBounds && !state.wbIsLoading) {
        const bw = selBounds.maxX - selBounds.minX;
        const bh = selBounds.maxY - selBounds.minY;
        const handleSize = 9 / state.wbScale;
        const rotStalkLen = 26 / state.wbScale;
        const topMidX = (selBounds.minX + selBounds.maxX) / 2;
        const rotHandleY = selBounds.minY - rotStalkLen;

        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.8 / state.wbScale;
        ctx.setLineDash([6 / state.wbScale, 4 / state.wbScale]);
        ctx.strokeRect(selBounds.minX, selBounds.minY, bw, bh);
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(topMidX, selBounds.minY);
        ctx.lineTo(topMidX, rotHandleY);
        ctx.stroke();

        ctx.fillStyle = '#dbeafe';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2 / state.wbScale;
        ctx.beginPath();
        ctx.arc(topMidX, rotHandleY, handleSize * 0.78, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const corners = [
            { x: selBounds.minX, y: selBounds.minY },
            { x: selBounds.maxX, y: selBounds.minY },
            { x: selBounds.maxX, y: selBounds.maxY },
            { x: selBounds.minX, y: selBounds.maxY }
        ];
        ctx.fillStyle = '#ffffff';
        for (const c of corners) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, handleSize * 0.65, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    if (activeOverlayRect) {
        const rw = activeOverlayRect.maxX - activeOverlayRect.minX;
        const rh = activeOverlayRect.maxY - activeOverlayRect.minY;
        ctx.save();
        const isCrop = activeOverlayRect.mode === 'CROP_DUP';
        ctx.fillStyle = isCrop ? 'rgba(16, 185, 129, 0.12)' : 'rgba(37, 99, 235, 0.08)';
        ctx.strokeStyle = isCrop ? '#059669' : '#2563eb';
        ctx.lineWidth = 2 / state.wbScale;
        ctx.setLineDash([5 / state.wbScale, 4 / state.wbScale]);
        ctx.fillRect(activeOverlayRect.minX, activeOverlayRect.minY, rw, rh);
        ctx.strokeRect(activeOverlayRect.minX, activeOverlayRect.minY, rw, rh);
        ctx.restore();
    }

    ctx.restore();

    const zoomBadge = document.getElementById('wbZoomBadge');
    if (zoomBadge) zoomBadge.textContent = `${Math.round(state.wbScale * 100)}%`;
    updateSelectionHudVisibility();
}

let isSpacePressedGlobal = false;

function initStylusCanvas() {
    const wrap = document.getElementById('padCanvasWrap');
    const canvas = document.getElementById('stylusCanvas');
    if (!wrap || !canvas) return;

    renderWhiteboardCanvas();
    if (canvas._listenersBound) return;
    canvas._listenersBound = true;

    const activePointers = new Map();
    let currentStroke = null;
    let lastPanMid = null;
    let lastPinchDist = null;
    let dragAction = null;

    const screenToWorld = (sx, sy) => ({
        x: (sx - state.wbPanX) / state.wbScale,
        y: (sy - state.wbPanY) / state.wbScale
    });

    const distToSegment = (p, v, wPt) => {
        const l2 = (wPt.x - v.x) ** 2 + (wPt.y - v.y) ** 2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        const t = Math.max(0, Math.min(1, ((p.x - v.x) * (wPt.x - v.x) + (p.y - v.y) * (wPt.y - v.y)) / l2));
        return Math.hypot(p.x - (v.x + t * (wPt.x - v.x)), p.y - (v.y + t * (wPt.y - v.y)));
    };

    const hitTestCornerOrRotateHandle = (wx, wy, bounds) => {
        if (!bounds) return null;
        const tol = 15 / state.wbScale;
        const topMidX = (bounds.minX + bounds.maxX) / 2;
        const rotHandleY = bounds.minY - (26 / state.wbScale);
        if (Math.hypot(wx - topMidX, wy - rotHandleY) <= tol * 1.15) return 'ROTATE';

        const handles = {
            NW: { x: bounds.minX, y: bounds.minY },
            NE: { x: bounds.maxX, y: bounds.minY },
            SE: { x: bounds.maxX, y: bounds.maxY },
            SW: { x: bounds.minX, y: bounds.maxY }
        };
        for (const [k, pt] of Object.entries(handles)) {
            if (Math.hypot(wx - pt.x, wy - pt.y) <= tol) return k;
        }
        return null;
    };

    const hitTestWhiteboardItem = (wx, wy) => {
        const board = getActiveBoard();
        const hitTol = 12 / state.wbScale;

        for (let i = board.items.length - 1; i >= 0; i--) {
            const it = board.items[i];
            if (it.type === 'STROKE') {
                const pts = it.points || [];
                for (let j = 0; j < pts.length; j++) {
                    if (j > 0 && distToSegment({ x: wx, y: wy }, pts[j - 1], pts[j]) <= hitTol + it.width / 2) {
                        return it;
                    } else if (Math.hypot(wx - pts[j].x, wy - pts[j].y) <= hitTol) {
                        return it;
                    }
                }
                const b = getItemBounds(it);
                if (pts.length >= 4 && wx >= b.minX && wx <= b.maxX && wy >= b.minY && wy <= b.maxY) {
                    return it;
                }
            } else if (it.type === 'IMAGE') {
                const icx = it.x + it.w / 2, icy = it.y + it.h / 2;
                const localPt = rotatePointAround(wx, wy, icx, icy, -(Number(it.rotation) || 0));
                if (localPt.x >= it.x && localPt.x <= it.x + it.w && localPt.y >= it.y && localPt.y <= it.y + it.h) {
                    return it;
                }
            }
        }
        return null;
    };

    const eraseStrokesNearWorldPt = (wx, wy) => {
        const board = getActiveBoard();
        const hitRadius = 15 / state.wbScale;
        const hitStroke = board.items.find(it => {
            if (it.type !== 'STROKE') return false;
            return it.points.some((p, idx) => {
                if (idx > 0) return distToSegment({ x: wx, y: wy }, it.points[idx - 1], p) <= hitRadius;
                return Math.hypot(p.x - wx, p.y - wy) <= hitRadius;
            });
        });
        if (hitStroke) {
            pushBoardUndoState();
            board.items = board.items.filter(it => it.id !== hitStroke.id);
            state.wbSelectedIds = [];
            renderWhiteboardCanvas();
            syncActiveBoardToQuestionGist();
        }
    };

    canvas.onpointerdown = (e) => {
        closeCustomDropdown();
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const r = canvas.getBoundingClientRect();
        const sx = e.clientX - r.left, sy = e.clientY - r.top;
        activePointers.set(e.pointerId, { x: sx, y: sy, pointerType: e.pointerType });

        if (activePointers.size === 2) {
            currentStroke = null;
            dragAction = null;
            activeOverlayRect = null;
            const pts = Array.from(activePointers.values());
            lastPanMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            return;
        }

        const isRejectedTouch = state.wbStylusOnly && e.pointerType === 'touch';
        if (state.wbIsLoading || state.wbTool === 'PAN' || isSpacePressedGlobal || e.button === 1 || isRejectedTouch) {
            lastPanMid = { x: sx, y: sy };
            return;
        }

        const wPt = screenToWorld(sx, sy);

        if (state.wbTool === 'LASER') {
            state.laserPoints.push({ x: wPt.x, y: wPt.y, t: performance.now() });
            if (!laserAnimId) laserAnimId = requestAnimationFrame(stepLaserFade);
            return;
        }

        if (state.wbTool === 'CROP_DUP') {
            state.wbSelectedIds = [];
            dragAction = { mode: 'CROP_DUP', startWorld: wPt };
            activeOverlayRect = { minX: wPt.x, minY: wPt.y, maxX: wPt.x, maxY: wPt.y, mode: 'CROP_DUP' };
            renderWhiteboardCanvas();
            return;
        }

        if (state.wbTool === 'SELECT') {
            const board = getActiveBoard();
            const currBounds = getCombinedSelectedBounds();
            const handle = hitTestCornerOrRotateHandle(wPt.x, wPt.y, currBounds);

            if (handle === 'ROTATE' && state.wbSelectedIds.length > 0) {
                pushBoardUndoState();
                const pivotX = (currBounds.minX + currBounds.maxX) / 2;
                const pivotY = (currBounds.minY + currBounds.maxY) / 2;
                const startAngleDeg = Math.atan2(wPt.y - pivotY, wPt.x - pivotX) * (180 / Math.PI);
                dragAction = {
                    mode: 'ROTATE',
                    pivotX,
                    pivotY,
                    startAngleDeg,
                    origItems: cloneBoardItems(board.items.filter(it => state.wbSelectedIds.includes(it.id)))
                };
                return;
            }

            if (handle && state.wbSelectedIds.length > 0) {
                pushBoardUndoState();
                dragAction = {
                    mode: 'RESIZE',
                    handle,
                    origBounds: { ...currBounds },
                    origItems: cloneBoardItems(board.items.filter(it => state.wbSelectedIds.includes(it.id)))
                };
                return;
            }

            const clickedInsideExistingSelection = currBounds &&
                wPt.x >= currBounds.minX && wPt.x <= currBounds.maxX &&
                wPt.y >= currBounds.minY && wPt.y <= currBounds.maxY &&
                state.wbSelectedIds.length > 1;

            if (!clickedInsideExistingSelection) {
                const hit = hitTestWhiteboardItem(wPt.x, wPt.y);
                if (hit) {
                    if (e.shiftKey) {
                        const exists = state.wbSelectedIds.includes(hit.id);
                        const rawIds = exists
                            ? state.wbSelectedIds.filter(id => id !== hit.id)
                            : [...state.wbSelectedIds, hit.id];
                        state.wbSelectedIds = expandSelectionWithGroups(rawIds);
                    } else if (!state.wbSelectedIds.includes(hit.id)) {
                        state.wbSelectedIds = expandSelectionWithGroups([hit.id]);
                    }
                } else {
                    state.wbSelectedIds = [];
                    dragAction = { mode: 'MARQUEE', startWorld: wPt };
                    activeOverlayRect = { minX: wPt.x, minY: wPt.y, maxX: wPt.x, maxY: wPt.y, mode: 'MARQUEE' };
                    renderWhiteboardCanvas();
                    return;
                }
            }

            renderWhiteboardCanvas();
            if (state.wbSelectedIds.length > 0) {
                pushBoardUndoState();
                const newBounds = getCombinedSelectedBounds();
                dragAction = {
                    mode: 'MOVE',
                    startWorld: wPt,
                    origBounds: { ...newBounds },
                    origItems: cloneBoardItems(board.items.filter(it => state.wbSelectedIds.includes(it.id)))
                };
            }
            return;
        }

        state.wbSelectedIds = [];

        if (state.wbTool === 'ERASER') {
            eraseStrokesNearWorldPt(wPt.x, wPt.y);
            return;
        }

        pushBoardUndoState();
        const board = getActiveBoard();
        currentStroke = {
            id: generateUniqueId(),
            type: 'STROKE',
            groupId: null,
            color: state.inkColor,
            width: state.strokeWidth,
            rotation: 0,
            points: [wPt]
        };
        board.items.push(currentStroke);
        renderWhiteboardCanvas();
    };

    canvas.onpointermove = (e) => {
        if (!activePointers.has(e.pointerId)) return;
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const sx = e.clientX - r.left, sy = e.clientY - r.top;
        activePointers.set(e.pointerId, { x: sx, y: sy, pointerType: e.pointerType });

        if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
            const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);

            if (lastPanMid && lastPinchDist > 10) {
                const zoomFactor = dist / lastPinchDist;
                const newScale = Math.max(0.2, Math.min(5.0, state.wbScale * zoomFactor));
                const worldMid = screenToWorld(lastPanMid.x, lastPanMid.y);
                state.wbScale = newScale;
                state.wbPanX = mid.x - worldMid.x * state.wbScale;
                state.wbPanY = mid.y - worldMid.y * state.wbScale;
            }
            lastPanMid = mid;
            lastPinchDist = dist;
            renderWhiteboardCanvas();
            return;
        }

        const isRejectedTouch = state.wbStylusOnly && e.pointerType === 'touch';
        if (state.wbIsLoading || state.wbTool === 'PAN' || isSpacePressedGlobal || (e.buttons & 4) || isRejectedTouch) {
            if (lastPanMid) {
                state.wbPanX += sx - lastPanMid.x;
                state.wbPanY += sy - lastPanMid.y;
                renderWhiteboardCanvas();
            }
            lastPanMid = { x: sx, y: sy };
            return;
        }

        const wPt = screenToWorld(sx, sy);

        if (state.wbTool === 'LASER') {
            state.laserPoints.push({ x: wPt.x, y: wPt.y, t: performance.now() });
            if (!laserAnimId) laserAnimId = requestAnimationFrame(stepLaserFade);
            return;
        }

        if (dragAction && (dragAction.mode === 'MARQUEE' || dragAction.mode === 'CROP_DUP')) {
            activeOverlayRect = {
                minX: Math.min(dragAction.startWorld.x, wPt.x),
                minY: Math.min(dragAction.startWorld.y, wPt.y),
                maxX: Math.max(dragAction.startWorld.x, wPt.x),
                maxY: Math.max(dragAction.startWorld.y, wPt.y),
                mode: dragAction.mode
            };
            renderWhiteboardCanvas();
            return;
        }

        if (state.wbTool === 'SELECT' && dragAction && state.wbSelectedIds.length > 0) {
            const board = getActiveBoard();

            if (dragAction.mode === 'ROTATE') {
                const currAngleDeg = Math.atan2(wPt.y - dragAction.pivotY, wPt.x - dragAction.pivotX) * (180 / Math.PI);
                let deltaDeg = currAngleDeg - dragAction.startAngleDeg;
                if (e.shiftKey) deltaDeg = Math.round(deltaDeg / 15) * 15;

                for (const orig of dragAction.origItems) {
                    const live = board.items.find(it => it.id === orig.id);
                    if (!live) continue;
                    if (live.type === 'IMAGE') {
                        const icx = orig.x + orig.w / 2;
                        const icy = orig.y + orig.h / 2;
                        const rotC = rotatePointAround(icx, icy, dragAction.pivotX, dragAction.pivotY, deltaDeg);
                        live.x = rotC.x - orig.w / 2;
                        live.y = rotC.y - orig.h / 2;
                        live.rotation = ((Number(orig.rotation) || 0) + deltaDeg) % 360;
                    } else if (live.type === 'STROKE') {
                        live.points = orig.points.map(p => rotatePointAround(p.x, p.y, dragAction.pivotX, dragAction.pivotY, deltaDeg));
                        live.rotation = ((Number(orig.rotation) || 0) + deltaDeg) % 360;
                    }
                }
                renderWhiteboardCanvas();
                return;
            }

            if (dragAction.mode === 'MOVE') {
                const dx = wPt.x - dragAction.startWorld.x;
                const dy = wPt.y - dragAction.startWorld.y;
                for (const orig of dragAction.origItems) {
                    const live = board.items.find(it => it.id === orig.id);
                    if (!live) continue;
                    if (live.type === 'IMAGE') {
                        live.x = orig.x + dx;
                        live.y = orig.y + dy;
                    } else if (live.type === 'STROKE') {
                        live.points = orig.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    }
                }
                renderWhiteboardCanvas();
                return;
            }

            if (dragAction.mode === 'RESIZE') {
                const ob = dragAction.origBounds;
                const oldW = Math.max(1, ob.maxX - ob.minX);
                const oldH = Math.max(1, ob.maxY - ob.minY);

                let newMinX = ob.minX, newMinY = ob.minY, newMaxX = ob.maxX, newMaxY = ob.maxY;
                if (dragAction.handle.includes('W')) newMinX = Math.min(wPt.x, ob.maxX - 24);
                if (dragAction.handle.includes('E')) newMaxX = Math.max(wPt.x, ob.minX + 24);
                if (dragAction.handle.includes('N')) newMinY = Math.min(wPt.y, ob.maxY - 24);
                if (dragAction.handle.includes('S')) newMaxY = Math.max(wPt.y, ob.minY + 24);

                let newW = Math.max(24, newMaxX - newMinX);
                let newH = Math.max(24, newMaxY - newMinY);

                const hasAnyImage = dragAction.origItems.some(it => it.type === 'IMAGE');
                if (hasAnyImage) {
                    const scaleX = newW / oldW;
                    const scaleY = newH / oldH;
                    const lockedScale = Math.max(24 / Math.min(oldW, oldH), (scaleX + scaleY) / 2);
                    newW = oldW * lockedScale;
                    newH = oldH * lockedScale;

                    if (dragAction.handle.includes('W')) newMinX = ob.maxX - newW;
                    else newMaxX = ob.minX + newW;

                    if (dragAction.handle.includes('N')) newMinY = ob.maxY - newH;
                    else newMaxY = ob.minY + newH;
                }

                for (const orig of dragAction.origItems) {
                    const live = board.items.find(it => it.id === orig.id);
                    if (!live) continue;
                    if (live.type === 'IMAGE') {
                        live.x = newMinX + ((orig.x - ob.minX) / oldW) * newW;
                        live.y = newMinY + ((orig.y - ob.minY) / oldH) * newH;
                        live.w = (orig.w / oldW) * newW;
                        live.h = (orig.h / oldH) * newH;
                    } else if (live.type === 'STROKE') {
                        live.points = orig.points.map(p => ({
                            x: newMinX + ((p.x - ob.minX) / oldW) * newW,
                            y: newMinY + ((p.y - ob.minY) / oldH) * newH
                        }));
                    }
                }
                renderWhiteboardCanvas();
                return;
            }
        }

        if (state.wbTool === 'ERASER') {
            eraseStrokesNearWorldPt(wPt.x, wPt.y);
            return;
        }

        if (currentStroke) {
            currentStroke.points.push(wPt);
            renderWhiteboardCanvas();
        }
    };

    const stopPointer = (e) => {
        activePointers.delete(e.pointerId);
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

        if (activePointers.size < 2) {
            lastPinchDist = null;
            lastPanMid = null;
        }

        if (dragAction && dragAction.mode === 'MARQUEE' && activeOverlayRect) {
            const box = activeOverlayRect;
            activeOverlayRect = null;
            dragAction = null;
            const board = getActiveBoard();
            const hitIds = [];
            for (const it of board.items) {
                if (it.isOriginalQ) continue;
                const b = getItemBounds(it);
                if (b && b.maxX >= box.minX && b.minX <= box.maxX && b.maxY >= box.minY && b.minY <= box.maxY) {
                    hitIds.push(it.id);
                }
            }
            state.wbSelectedIds = expandSelectionWithGroups(hitIds);
            renderWhiteboardCanvas();
            return;
        }

        if (dragAction && dragAction.mode === 'CROP_DUP' && activeOverlayRect) {
            const box = activeOverlayRect;
            activeOverlayRect = null;
            dragAction = null;
            const cw = box.maxX - box.minX, ch = box.maxY - box.minY;
            if (cw > 18 && ch > 18) {
                const board = getActiveBoard();
                const offScale = 2;
                const offCanvas = document.createElement('canvas');
                offCanvas.width = Math.round(cw * offScale);
                offCanvas.height = Math.round(ch * offScale);
                const oCtx = offCanvas.getContext('2d');
                oCtx.fillStyle = '#ffffff';
                oCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
                oCtx.scale(offScale, offScale);
                oCtx.translate(-box.minX, -box.minY);
                drawBoardItemsToContext(oCtx, board.items);

                const dataUrl = offCanvas.toDataURL('image/png');
                const croppedImg = new Image();
                croppedImg.onload = () => {
                    pushBoardUndoState();
                    const newItem = {
                        id: generateUniqueId(),
                        type: 'IMAGE',
                        isOriginalQ: false,
                        groupId: null,
                        x: box.minX + 28,
                        y: box.minY + 28,
                        w: cw,
                        h: ch,
                        rotation: 0,
                        src: dataUrl,
                        imgEl: croppedImg
                    };
                    board.items.push(newItem);
                    state.wbSelectedIds = [newItem.id];
                    window.app.setWhiteboardTool('SELECT');
                    syncActiveBoardToQuestionGist();
                    toast('Cropped & duplicated region! Drag to move or resize.', 'success');
                };
                croppedImg.src = dataUrl;
            } else {
                renderWhiteboardCanvas();
            }
            return;
        }

        if (dragAction && (dragAction.mode === 'MOVE' || dragAction.mode === 'RESIZE' || dragAction.mode === 'ROTATE')) {
            dragAction = null;
            syncActiveBoardToQuestionGist();
            return;
        }

        dragAction = null;

        if (currentStroke) {
            const snappedShapePts = recognizeAndConvertStrokeToShape(currentStroke.points);
            if (snappedShapePts) {
                currentStroke.points = snappedShapePts;
            }
            currentStroke = null;
            renderWhiteboardCanvas();
            syncActiveBoardToQuestionGist();
        }
    };

    canvas.onpointerup = stopPointer;
    canvas.onpointercancel = stopPointer;

    canvas.onwheel = (e) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const sx = e.clientX - r.left, sy = e.clientY - r.top;
        const worldBefore = screenToWorld(sx, sy);
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        state.wbScale = Math.max(0.2, Math.min(5.0, state.wbScale * factor));
        state.wbPanX = sx - worldBefore.x * state.wbScale;
        state.wbPanY = sy - worldBefore.y * state.wbScale;
        renderWhiteboardCanvas();
    };
}

// ===================================================================
// UI ANIMATION HELPERS: DIALOGS, SLIDING PILLS & 3-FINGER WB SWIPE
// ===================================================================
function animateModalOpen(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    if (el._closeTimer) {
        clearTimeout(el._closeTimer);
        el._closeTimer = null;
    }
    if (el._openTimer) {
        clearTimeout(el._openTimer);
        el._openTimer = null;
    }
    el.classList.remove('hidden', 'modal-anim-out');
    el.classList.add('modal-anim-in');
    el._openTimer = setTimeout(() => {
        el.classList.remove('modal-anim-in');
        el._openTimer = null;
    }, 250);
    requestAnimationFrame(() => updateAllSegmentedGliders());
}


function animateModalClose(modalId, onAfterClose = null) {
    const el = document.getElementById(modalId);
    if (!el || el.classList.contains('hidden')) {
        if (onAfterClose) onAfterClose();
        return;
    }
    el.classList.remove('modal-anim-in');
    el.classList.add('modal-anim-out');
    if (el._closeTimer) clearTimeout(el._closeTimer);
    el._closeTimer = setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('modal-anim-out');
        el._closeTimer = null;
        if (onAfterClose) onAfterClose();
    }, 195);
}

// Updates the sliding pill glider on every .m3-segmented-group (All/Unsolved/Solved/Starred, Dark/Light, Split/Trim)
function updateSegmentedGlider(groupEl) {
    if (!groupEl) return;
    const activeBtn = groupEl.querySelector('.m3-seg-btn.active');
    if (!activeBtn) return;

    let glider = groupEl.querySelector('.m3-seg-glider');
    if (!glider) {
        glider = document.createElement('span');
        glider.className = 'm3-seg-glider';
        groupEl.prepend(glider);
        groupEl.classList.add('has-glider');
    }

    if (activeBtn.offsetWidth > 0) {
        glider.style.width = `${activeBtn.offsetWidth}px`;
        glider.style.transform = `translate3d(${activeBtn.offsetLeft}px, 0, 0)`;
    }
}

function updateAllSegmentedGliders() {
    document.querySelectorAll('.m3-segmented-group').forEach(updateSegmentedGlider);
}

// 3-Finger Horizontal Swipe Gesture ONLY inside the Whiteboard (Respects locked filter context)
function initWhiteboardThreeFingerSwipe() {
    const wbModal = document.getElementById('scratchpadModal');
    if (!wbModal || wbModal._has3FingerSwipe) return;
    wbModal._has3FingerSwipe = true;

    let tracking3F = false;
    let startAvgX = 0;
    let startAvgY = 0;
    let lastTriggeredAt = 0;

    wbModal.addEventListener('touchstart', (e) => {
        if (e.touches.length === 3) {
            tracking3F = true;
            startAvgX = (e.touches[0].clientX + e.touches[1].clientX + e.touches[2].clientX) / 3;
            startAvgY = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
        } else if (e.touches.length > 3) {
            tracking3F = false;
        }
    }, { passive: true });

    wbModal.addEventListener('touchmove', (e) => {
        if (!tracking3F || e.touches.length !== 3) return;
        const now = performance.now();
        if (now - lastTriggeredAt < 420) return;

        const currAvgX = (e.touches[0].clientX + e.touches[1].clientX + e.touches[2].clientX) / 3;
        const currAvgY = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
        const dx = currAvgX - startAvgX;
        const dy = currAvgY - startAvgY;

        if (Math.abs(dx) > 68 && Math.abs(dx) > Math.abs(dy) * 1.35) {
            tracking3F = false;
            lastTriggeredAt = now;
            if (dx < 0) {
                // 3-Finger Swipe Left -> Next Question in Locked Filter Context
                window.app.navigatePadQuestion(1);
            } else {
                // 3-Finger Swipe Right -> Previous Question in Locked Filter Context
                window.app.navigatePadQuestion(-1);
            }
        }
    }, { passive: true });

    wbModal.addEventListener('touchend', (e) => {
        if (e.touches.length < 3) tracking3F = false;
    }, { passive: true });
}

        // ===================================================================
// UNIFIED WORKSPACE PLANE & GITHUB PORTAL REVEAL ORCHESTRATOR
// ===================================================================
const STATUS_ORDER_INDEX = { 'ALL': 0, 'UNSOLVED': 1, 'SOLVED': 2, 'STARRED': 3 };
let feedPlaneAnimTimer = null;
function triggerWorkspacePlaneTransition(mode = 'ELEVATE') {
    const container = document.getElementById('mainFeedContainer');
    const plane = container?.firstElementChild;
    if (!container || !plane) return;

    container.scrollTop = 0;
    plane.classList.remove('m3-plane-glide-right', 'm3-plane-glide-left', 'm3-plane-elevate', 'm3-feed-portal-reveal');
    void plane.offsetWidth;

    const cls = mode === 'RIGHT'
        ? 'm3-plane-glide-right'
        : mode === 'LEFT'
        ? 'm3-plane-glide-left'
        : mode === 'PORTAL'
        ? 'm3-feed-portal-reveal'
        : 'm3-plane-elevate';

    plane.classList.add(cls);
    clearTimeout(feedPlaneAnimTimer);
    feedPlaneAnimTimer = setTimeout(() => {
        plane.classList.remove(cls);
    }, 720);
}
async function runSynchronizedCloudPortalReveal() {
    const container = document.getElementById('mainFeedContainer');
    const oldLoadingDialog = container?.querySelector('.m3-dialog');

    let floatingOverlay = null;
    if (oldLoadingDialog && state.questions.length > 0) {
        const rect = oldLoadingDialog.getBoundingClientRect();
        floatingOverlay = oldLoadingDialog.cloneNode(true);
        floatingOverlay.style.position = 'fixed';
        floatingOverlay.style.top = `${rect.top}px`;
        floatingOverlay.style.left = `${rect.left}px`;
        floatingOverlay.style.width = `${rect.width}px`;
        floatingOverlay.style.height = `${rect.height}px`;
        floatingOverlay.style.margin = '0';
        floatingOverlay.style.zIndex = '45';
        floatingOverlay.style.overflow = 'visible';
        document.body.appendChild(floatingOverlay);
    }

    // 1. Build the question DOM underneath the still-visible loading overlay
    state.isSyncingCloud = false;
    sortAndRefreshQuestions(true);
    clearTimeout(aspectUpdateTimer);
    refreshCountsAndDrawerOnly();
    renderFeed();

    if (!floatingOverlay) return;

    const plane = container?.firstElementChild;
    if (plane) plane.style.opacity = '0';

    // 2. Force-decode the top 8 visible question images into GPU textures BEFORE starting the animation
    const visibleImgs = Array.from(container.querySelectorAll('img.question-slice-img')).slice(0, 8);
    await Promise.allSettled(
        visibleImgs.map(img => (typeof img.decode === 'function' ? img.decode() : Promise.resolve()))
    );

    // 3. Now that all visible question bitmaps are decoded in GPU memory, fire Star Burst + Portal Reveal on the exact same frame!
    requestAnimationFrame(() => {
        if (plane) {
            plane.style.opacity = '';
            triggerWorkspacePlaneTransition('PORTAL');
        }
        const starBox = floatingOverlay.querySelector('.m3-cookie-12');
        if (starBox) starBox.classList.add('m3-portal-star-burst');
        floatingOverlay.classList.add('m3-portal-card-dissolve');

        setTimeout(() => {
            floatingOverlay.remove();
        }, 580);
    });
}

        // ===================================================================
// INTERACTIVE MANUAL CROP, SEPARATOR LINES & STITCHER ENGINE
// Pre-populated by Local Intelligence (1-Col & 2-Col + Chapter Picker)
// ===================================================================
const mcState = {
    resolver: null,
    sourceCanvas: null,
    isTwoCol: false,
    gutterNormX: 500,
    // Each column holds sorted boundary Y values (0..1000): [top0, sep1, sep2, ..., bottom]
    colBounds: [[40, 950], [40, 950]],
    // Metadata keyed by `${colIdx}_${segIdx}`: { qNum, subject, chapter, stitchPrev, excluded }
    regionMeta: {},
    defaultSubj: 'Mathematics',
    defaultChap: 'Straight Lines',
    hasPrevQuestion: false,
    baseQStartNum: 1
};

function mcInitFromLocalCandidates(canvas, localCandidates, defaultSubj, paperTitle, hasPrevQuestion, baseQStartNum) {
    mcState.sourceCanvas = canvas;
    mcState.hasPrevQuestion = hasPrevQuestion;
    mcState.baseQStartNum = baseQStartNum;

    const inferred = inferSubjectAndChapterFromText(paperTitle, defaultSubj);
    mcState.defaultSubj = inferred.subject;
    mcState.defaultChap = inferred.chapter;

    const cands = Array.isArray(localCandidates) ? localCandidates : [];
    const hasRightCol = cands.some(c => Number(c.xmin) >= 420);
    mcState.isTwoCol = hasRightCol;
    mcState.gutterNormX = 500;
    mcState.regionMeta = {};

    const buildColBounds = (colCands) => {
        if (!colCands.length) return [50, 940];
        const sorted = [...colCands].sort((a, b) => a.ymin - b.ymin);
        const ys = [Math.max(10, Math.round(sorted[0].ymin))];
        for (let i = 0; i < sorted.length - 1; i++) {
            const mid = Math.round((sorted[i].ymax + sorted[i + 1].ymin) / 2);
            ys.push(Math.max(ys[ys.length - 1] + 25, Math.min(975, mid)));
        }
        ys.push(Math.min(990, Math.max(ys[ys.length - 1] + 30, Math.round(sorted[sorted.length - 1].ymax))));
        return ys;
    };

            if (mcState.isTwoCol) {
        const leftC = cands.filter(c => Number(c.xmin) < 420);
        const rightC = cands.filter(c => Number(c.xmin) >= 420);
        if (leftC.length && rightC.length) {
            const maxL = Math.max(...leftC.map(c => Number(c.xmax) || 496));
            const minR = Math.min(...rightC.map(c => Number(c.xmin) || 504));
            mcState.gutterNormX = Math.max(300, Math.min(700, Math.round((maxL + minR) / 2)));
        }
        mcState.colBounds = [buildColBounds(leftC), buildColBounds(rightC)];
        leftC.forEach((c, idx) => {
            mcState.regionMeta[`0_${idx}`] = {
                qNum: String(c.questionNumber || (baseQStartNum + idx)),
                subject: c.subject || mcState.defaultSubj,
                chapter: c.chapter || mcState.defaultChap,
                stitchPrev: Boolean(c.isContinuationFromPrevPage || c.isContinuationFromPrev || c.stitchWithPrev),
                excluded: false
            };
        });
        rightC.forEach((c, idx) => {
            mcState.regionMeta[`1_${idx}`] = {
                qNum: String(c.questionNumber || (baseQStartNum + leftC.length + idx)),
                subject: c.subject || mcState.defaultSubj,
                chapter: c.chapter || mcState.defaultChap,
                stitchPrev: Boolean(c.isContinuationFromPrevPage || c.isContinuationFromPrev || c.stitchWithPrev),
                excluded: false
            };
        });
    } else {
        mcState.colBounds = [buildColBounds(cands), [50, 940]];
        cands.forEach((c, idx) => {
            mcState.regionMeta[`0_${idx}`] = {
                qNum: String(c.questionNumber || (baseQStartNum + idx)),
                subject: c.subject || mcState.defaultSubj,
                chapter: c.chapter || mcState.defaultChap,
                stitchPrev: Boolean(c.isContinuationFromPrevPage || c.isContinuationFromPrev || c.stitchWithPrev),
                excluded: false
            };
        });
    }


    // Update themed Bulk Subject & Chapter dropdown labels
    mcSyncBulkDropdownLabels();
}

function mcSyncBulkDropdownLabels() {
    const subjLbl = document.getElementById('mcBulkSubjectLabel');
    const chapLbl = document.getElementById('mcBulkChapterLabel');
    if (subjLbl) subjLbl.textContent = mcState.defaultSubj;
    if (chapLbl) chapLbl.textContent = mcState.defaultChap;
}

function mcGetAllRegions() {
    const cols = mcState.isTwoCol ? [0, 1] : [0];
    const regions = [];
    let runningNum = mcState.baseQStartNum;

    for (const colIdx of cols) {
        const ys = mcState.colBounds[colIdx];
        const xmin = mcState.isTwoCol ? (colIdx === 0 ? 10 : mcState.gutterNormX + 4) : 10;
        const xmax = mcState.isTwoCol ? (colIdx === 0 ? mcState.gutterNormX - 4 : 990) : 990;

        for (let segIdx = 0; segIdx < ys.length - 1; segIdx++) {
            const key = `${colIdx}_${segIdx}`;
            if (!mcState.regionMeta[key]) {
                mcState.regionMeta[key] = {
                    qNum: String(runningNum),
                    subject: mcState.defaultSubj,
                    chapter: mcState.defaultChap,
                    stitchPrev: false,
                    excluded: false
                };
            }
            runningNum++;
            regions.push({
                key,
                colIdx,
                segIdx,
                xmin,
                xmax,
                ymin: ys[segIdx],
                ymax: ys[segIdx + 1],
                meta: mcState.regionMeta[key]
            });
        }
    }
    return regions;
}

function mcRenderOverlayAndSidebar() {
    const overlay = document.getElementById('mcOverlayLayer');
    const listEl = document.getElementById('mcRegionsList');
    const colsLbl = document.getElementById('mcColsLabel');
    const addCol0Lbl = document.getElementById('mcAddLineCol0Lbl');
    const addCol1Btn = document.getElementById('mcAddLineCol1Btn');
    if (!overlay || !listEl) return;

    if (colsLbl) colsLbl.textContent = mcState.isTwoCol ? '2-Columns' : '1-Column';
    if (addCol0Lbl) addCol0Lbl.textContent = mcState.isTwoCol ? 'Add Left-Col Line' : 'Add Separator Line';
    if (addCol1Btn) {
        addCol1Btn.classList.toggle('hidden', !mcState.isTwoCol);
        addCol1Btn.classList.toggle('inline-flex', mcState.isTwoCol);
    }

    const regions = mcGetAllRegions();
    overlay.innerHTML = '';

    // 1. Draw tinted region boxes
    regions.forEach((reg, idx) => {
        const box = document.createElement('div');
        box.className = `mc-region-tint ${reg.meta.excluded ? 'excluded' : ''}`;
        box.style.left = `${reg.xmin / 10}%`;
        box.style.width = `${(reg.xmax - reg.xmin) / 10}%`;
        box.style.top = `${reg.ymin / 10}%`;
        box.style.height = `${Math.max(1, (reg.ymax - reg.ymin) / 10)}%`;
        box.style.background = idx % 2 === 0 ? 'rgba(99, 102, 241, 0.08)' : 'rgba(16, 185, 129, 0.08)';
        const badgeText = reg.meta.excluded ? 'SKIPPED' : (reg.meta.stitchPrev ? `🔗 Stitch ←` : `Q.${reg.meta.qNum}`);
        box.innerHTML = `<span class="mc-region-badge">${badgeText}</span>`;
        overlay.appendChild(box);
    });

    // 2. Draw draggable center gutter if 2-column
    if (mcState.isTwoCol) {
        const gutter = document.createElement('div');
        gutter.className = 'mc-gutter-line';
        gutter.style.left = `${mcState.gutterNormX / 10}%`;
        gutter.title = 'Drag to adjust center column divider';
        gutter.onpointerdown = (e) => {
            e.preventDefault();
            gutter.setPointerCapture(e.pointerId);
            const rect = overlay.getBoundingClientRect();
            const onMove = (ev) => {
                const pct = Math.max(25, Math.min(75, ((ev.clientX - rect.left) / rect.width) * 100));
                mcState.gutterNormX = Math.round(pct * 10);
                mcRenderOverlayAndSidebar();
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        };
        overlay.appendChild(gutter);
    }

    // 3. Draw draggable horizontal separator lines per column
    const cols = mcState.isTwoCol ? [0, 1] : [0];
    cols.forEach(colIdx => {
        const ys = mcState.colBounds[colIdx];
        const leftPct = mcState.isTwoCol ? (colIdx === 0 ? 1 : (mcState.gutterNormX / 10) + 0.5) : 1;
        const widthPct = mcState.isTwoCol ? (colIdx === 0 ? (mcState.gutterNormX / 10) - 1.5 : 98.5 - (mcState.gutterNormX / 10)) : 98;

        ys.forEach((yVal, lineIdx) => {
            const isEdge = lineIdx === 0 || lineIdx === ys.length - 1;
            const lineEl = document.createElement('div');
            lineEl.className = `mc-sep-line ${isEdge ? 'mc-top-edge' : ''}`;
            lineEl.style.top = `${yVal / 10}%`;
            lineEl.style.left = `${leftPct}%`;
            lineEl.style.width = `${widthPct}%`;

            const labelText = lineIdx === 0 ? 'TOP' : (lineIdx === ys.length - 1 ? 'BOTTOM' : `CUT #${lineIdx}`);
            const delBtnHtml = !isEdge
                ? `<button type="button" data-del-col="${colIdx}" data-del-idx="${lineIdx}" class="ml-1 px-1 rounded-full bg-black/25 hover:bg-rose-600 hover:text-white text-[9px] leading-tight">✕</button>`
                : '';
            lineEl.innerHTML = `<span class="mc-sep-pill">☰ ${labelText}${delBtnHtml}</span>`;

            lineEl.onpointerdown = (e) => {
                const delBtn = e.target.closest('button[data-del-idx]');
                if (delBtn) {
                    e.stopPropagation();
                    const cI = Number(delBtn.getAttribute('data-del-col'));
                    const lI = Number(delBtn.getAttribute('data-del-idx'));
                    mcState.colBounds[cI].splice(lI, 1);
                    mcRenderOverlayAndSidebar();
                    return;
                }
                e.preventDefault();
                const rect = overlay.getBoundingClientRect();
                const minY = lineIdx === 0 ? 5 : ys[lineIdx - 1] + 22;
                const maxY = lineIdx === ys.length - 1 ? 995 : ys[lineIdx + 1] - 22;

                const onMove = (ev) => {
                    const normY = Math.round(Math.max(minY, Math.min(maxY, ((ev.clientY - rect.top) / rect.height) * 1000)));
                    mcState.colBounds[colIdx][lineIdx] = normY;
                    mcRenderOverlayAndSidebar();
                };
                const onUp = () => {
                    window.removeEventListener('pointermove', onMove);
                    window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
            };

            overlay.appendChild(lineEl);
        });
    });

    // 4. Render right-hand sidebar controls for each question region
    const activeCount = regions.filter(r => !r.meta.excluded).length;
    const confirmLbl = document.getElementById('mcConfirmBtnLabel');
    if (confirmLbl) confirmLbl.textContent = `Crop ${activeCount} Question${activeCount === 1 ? '' : 's'} & Continue`;

    listEl.innerHTML = regions.map((reg, idx) => {
        const m = reg.meta;
        const chaps = JEE_CHAPTERS[m.subject] || JEE_CHAPTERS.Physics;
        const canStitch = idx > 0 || mcState.hasPrevQuestion;
        return `
        <div class="p-2.5 rounded-2xl m3-surface-high border border-[var(--md-outline-variant)] space-y-2 ${m.excluded ? 'opacity-50' : ''}">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full m3-primary-pill">${mcState.isTwoCol ? (reg.colIdx === 0 ? 'L' : 'R') : '#'}${reg.segIdx + 1}</span>
                    <input type="text" value="${m.qNum}" onchange="window.app.mcUpdateRegion('${reg.key}', 'qNum', this.value)" class="w-16 h-7 m3-input m3-surface-low px-2 text-[11px] font-extrabold text-center" placeholder="Q.#">
                </div>
                <div class="flex items-center gap-2">
                    ${canStitch ? `
                    <label class="flex items-center gap-1.5 text-[10.5px] font-bold text-amber-400 cursor-pointer" title="Stitch this slice onto the bottom of the previous question">
                        <input type="checkbox" ${m.stitchPrev ? 'checked' : ''} onchange="window.app.mcUpdateRegion('${reg.key}', 'stitchPrev', this.checked)" class="m3-switch m3-switch-sm m3-switch-warn">
                        <span>Stitch</span>
                    </label>` : ''}
                    <label class="flex items-center gap-1.5 text-[10.5px] font-bold text-rose-400 cursor-pointer">
                        <input type="checkbox" ${m.excluded ? 'checked' : ''} onchange="window.app.mcUpdateRegion('${reg.key}', 'excluded', this.checked)" class="m3-switch m3-switch-sm m3-switch-danger">
                        <span>Skip</span>
                    </label>
                </div>
            </div>

            ${!m.excluded && !m.stitchPrev ? `
            <div class="grid grid-cols-2 gap-1.5">
                <button type="button" onclick="window.app.openMcRegionSubjMenu('${reg.key}', this)" class="h-8 m3-dropdown-field text-[10.5px] !px-2.5">
                    <span class="truncate">${m.subject === 'Mathematics' ? 'Maths' : m.subject}</span>
                    <i class="ph-bold ph-caret-down text-[9px] m3-text-muted shrink-0"></i>
                </button>
                <button type="button" onclick="window.app.openMcRegionChapMenu('${reg.key}', this)" class="h-8 m3-dropdown-field text-[10.5px] !px-2.5">
                    <span class="truncate">${m.chapter}</span>
                    <i class="ph-bold ph-caret-down text-[9px] m3-text-muted shrink-0"></i>
                </button>
            </div>` : ''}
        </div>
        `;
    }).join('');
}

function openManualPageCropper(sourceCanvas, pageNum, totalPages, localCandidates, defaultSubj, paperTitle, hasPrevQuestion, baseQStartNum, options = {}) {
    return new Promise((resolve) => {
        mcState.resolver = resolve;
        mcInitFromLocalCandidates(sourceCanvas, localCandidates, defaultSubj, paperTitle, hasPrevQuestion, baseQStartNum);

        const previewCanvas = document.getElementById('mcPageCanvas');
        const scale = Math.min(1, 760 / Math.max(1, sourceCanvas.width));
        previewCanvas.width = Math.round(sourceCanvas.width * scale);
        previewCanvas.height = Math.round(sourceCanvas.height * scale);
        previewCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

        document.getElementById('mcModalTitle').textContent = `Manual Separator Lines & Stitcher — Page ${pageNum}/${totalPages}`;
        document.getElementById('mcReasonBanner').textContent = options.reasonText || 'Drag orange lines to adjust boundaries. Local intelligence pre-placed initial lines.';

        const retryBtn = document.getElementById('mcRetryGeminiBtn');
        if (retryBtn) {
            const showRetry = Boolean(options.allowRetryGemini);
            retryBtn.classList.toggle('hidden', !showRetry);
            retryBtn.classList.toggle('inline-flex', showRetry);
        }
        const switchAllChk = document.getElementById('mcSwitchManualAllChk');
        if (switchAllChk) switchAllChk.checked = Boolean(options.manualAllChecked);

        mcRenderOverlayAndSidebar();
        animateModalOpen('manualCropModal');
    });
}


// ===================================================================
// GLOBAL APP CONTROLLER
// ===================================================================
// ===================================================================
// POST-EXTRACTION BORDER & CHAPTER REVIEW STUDIO ENGINE
// ===================================================================
const brState = {
    resolver: null,
    questions: [],
    pageCanvasMap: new Map(),
    aiSummary: null,
    filter: 'ALL',
    editMode: 'BOUNDS', // 'BOUNDS' | 'SPLIT' | 'TRIM'
    currentIdx: 0,
    isReClassifying: false,
    isReCheckingBorders: false
};

function initBrSplitLineDragging() {
    const line = document.getElementById('brSplitDividerLine');
    const stage = document.getElementById('brImgStage');
    const slider = document.getElementById('brSplitCutSlider');
    if (!line || !stage || !slider || line._dragBound) return;
    line._dragBound = true;

    line.onpointerdown = (e) => {
        e.preventDefault();
        line.setPointerCapture(e.pointerId);
        const rect = stage.getBoundingClientRect();
        const updateFromY = (clientY) => {
            if (!rect.height) return;
            const pct = Math.round(Math.max(10, Math.min(90, ((clientY - rect.top) / rect.height) * 100)));
            slider.value = pct;
            window.app.brUpdateSplitTrimPreview();
        };
        const onMove = (ev) => updateFromY(ev.clientY);
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };
}

function brGetVisibleIndices() {
    const out = [];
    for (let i = 0; i < brState.questions.length; i++) {
        const q = brState.questions[i];
        if (brState.filter === 'FLAGGED' && !q._reviewMeta?.needsReview) continue;
        out.push(i);
    }
    return out;
}

function openBatchReviewModal(batchQuestions, pageCanvasMap, aiSummary = null) {
    return new Promise((resolve) => {
        brState.resolver = resolve;
        brState.questions = batchQuestions.map(q => ({
            ...q,
            _skipInReview: false,
            _origChapter: q.chapter,
            _origSourceSlices: (q._sourceSlices || []).map(s => ({ ...s }))
        }));
        brState.pageCanvasMap = pageCanvasMap || new Map();
        brState.aiSummary = aiSummary;
        brState.filter = 'ALL';
        brState.editMode = 'BOUNDS';
        brState.currentIdx = 0;
        brState.isReClassifying = false;
        brState.isReCheckingBorders = false;
        initBrSplitLineDragging();

        const subBanner = document.getElementById('brSubBanner');
        if (subBanner && aiSummary) {
            if (aiSummary.connected && aiSummary.pagesChecked > 0) {
                subBanner.className = 'text-[11px] font-bold text-emerald-400 truncate';
                subBanner.textContent = `Local AI (${aiSummary.backend}: ${aiSummary.modelName}): verified ${aiSummary.pagesChecked} pages (${aiSummary.pagesRefined} refined • ${(aiSummary.totalMs / 1000).toFixed(1)}s)`;
            } else if (aiSummary.requested && aiSummary.offlineReason) {
                subBanner.className = 'text-[11px] font-bold text-rose-400 truncate';
                subBanner.textContent = `⚠ Local AI was OFFLINE — used Local v3.0 borders only (${aiSummary.offlineReason.slice(0, 75)})`;
            } else if (aiSummary.connected && aiSummary.pagesChecked === 0) {
                subBanner.className = 'text-[11px] font-bold text-amber-400 truncate';
                subBanner.textContent = `⚠ Local AI connected (${aiSummary.modelName}) but failed to verify ${aiSummary.pagesFailed} pages — kept Local v3.0 borders`;
            } else {
                subBanner.className = 'text-[11px] m3-text-muted truncate';
                subBanner.textContent = 'Extracted with Local v3.0 geometry & chapters. Fine-tune any border or chapter before saving.';
            }
        }

        brRenderCurrent();
        animateModalOpen('batchReviewModal');
    });
}

async function brRecropQuestionFromSlices(q) {
    if (!q || !Array.isArray(q._sourceSlices) || q._sourceSlices.length === 0) return;
    const croppedUrls = [];
    let lastAspect = q.aspectRatio;

    for (const sl of q._sourceSlices) {
        const srcCanvas = brState.pageCanvasMap.get(sl.pageNum);
        if (!srcCanvas) continue;
        const res = crop2DSliceFromPage(
            srcCanvas,
            sl.xmin,
            sl.xmax,
            sl.ymin,
            sl.ymax,
            sl.padTop ?? 8,
            sl.padBottom ?? 8
        );
        croppedUrls.push(res.dataUrl);
        lastAspect = res.aspectRatio;
    }

    if (croppedUrls.length === 1) {
        q.imageDataUrl = croppedUrls[0];
        q.aspectRatio = lastAspect;
    } else if (croppedUrls.length > 1) {
        let acc = croppedUrls[0];
        let ratio = lastAspect;
        for (let i = 1; i < croppedUrls.length; i++) {
            const st = await stitchCanvasesVertically(acc, croppedUrls[i]);
            acc = st.dataUrl;
            ratio = st.aspectRatio;
        }
        q.imageDataUrl = acc;
        q.aspectRatio = ratio;
    }
}

function brRenderCurrent() {
    const allCount = brState.questions.length;
    const flaggedCount = brState.questions.filter(q => q._reviewMeta?.needsReview && !q._skipInReview).length;
    const keptCount = brState.questions.filter(q => !q._skipInReview).length;

    document.getElementById('brCountAll').textContent = allCount;
    document.getElementById('brCountFlagged').textContent = flaggedCount;
    document.getElementById('brFilterAllBtn')?.classList.toggle('active', brState.filter === 'ALL');
    document.getElementById('brFilterFlagBtn')?.classList.toggle('active', brState.filter === 'FLAGGED');
    document.getElementById('brSaveBtnLabel').textContent = `Save ${keptCount} Question${keptCount === 1 ? '' : 's'} to Vault & Sync`;
    requestAnimationFrame(() => updateAllSegmentedGliders());

    let visible = brGetVisibleIndices();
    if (visible.length === 0 && brState.filter === 'FLAGGED') {
        brState.filter = 'ALL';
        visible = brGetVisibleIndices();
    }
    if (visible.length === 0) return;

    if (!visible.includes(brState.currentIdx)) {
        brState.currentIdx = visible[0];
    }
    const posInVis = visible.indexOf(brState.currentIdx);
    const q = brState.questions[brState.currentIdx];
    const meta = q._reviewMeta || {};

    document.getElementById('brModalTitle').textContent = `Review Question ${posInVis + 1} / ${visible.length} (Q.${q.questionNumber})`;
    document.getElementById('brPrevBtn').disabled = posInVis <= 0;
    document.getElementById('brNextBtn').disabled = posInVis >= visible.length - 1;

    document.getElementById('brQuestionImg').src = q.imageDataUrl;
    document.getElementById('brPagePill').textContent = q.isStitched ? `Page ${q.page} (Stitched)` : `Page ${q.page}`;

    const confPct = Math.round((Number(meta.confidence) || 0.78) * 100);
    const confBadge = document.getElementById('brConfBadge');
    confBadge.textContent = meta.needsReview ? `Check Chapter • ${confPct}%` : `Local Match • ${confPct}%`;
    confBadge.className = `px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold ${
        meta.needsReview ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-400'
    }`;

    const aiBorderBadge = document.getElementById('brBorderAiBadge');
    if (aiBorderBadge) aiBorderBadge.classList.toggle('hidden', !meta.aiBorderVerified);

    document.getElementById('brSkipChk').checked = Boolean(q._skipInReview);
    document.getElementById('brQNumInput').value = q.questionNumber;
    const brSubjLbl = document.getElementById('brSubjectLabel');
    const brChapLbl = document.getElementById('brChapterLabel');
    if (brSubjLbl) brSubjLbl.textContent = q.subject;
    if (brChapLbl) brChapLbl.textContent = q.chapter;

    document.getElementById('brBorderNoteText').textContent = meta.borderNote || 'Local v3.0 geometry & stitch engine';
    document.getElementById('brChapterNoteText').textContent = `Local 78-chapter classifier (${confPct}% confidence). Manual chapter edits automatically train local memory.`;

    // Sync Edit Mode toolbars & overlays (Borders / Split / Trim)
    const mode = brState.editMode || 'BOUNDS';
    document.getElementById('brModeBoundsBtn')?.classList.toggle('active', mode === 'BOUNDS');
    document.getElementById('brModeSplitBtn')?.classList.toggle('active', mode === 'SPLIT');
    document.getElementById('brModeTrimBtn')?.classList.toggle('active', mode === 'TRIM');

    const boundsBar = document.getElementById('brBoundsToolbar');
    const splitBar = document.getElementById('brSplitToolbar');
    const trimBar = document.getElementById('brTrimToolbar');
    if (boundsBar) { boundsBar.classList.toggle('hidden', mode !== 'BOUNDS'); boundsBar.classList.toggle('flex', mode === 'BOUNDS'); }
    if (splitBar) { splitBar.classList.toggle('hidden', mode !== 'SPLIT'); splitBar.classList.toggle('flex', mode === 'SPLIT'); }
    if (trimBar) { trimBar.classList.toggle('hidden', mode !== 'TRIM'); trimBar.classList.toggle('flex', mode === 'TRIM'); }

    document.getElementById('brSplitDividerLine')?.classList.toggle('hidden', mode !== 'SPLIT');
    document.getElementById('brTrimTopMask')?.classList.toggle('hidden', mode !== 'TRIM');
    document.getElementById('brTrimBotMask')?.classList.toggle('hidden', mode !== 'TRIM');

    // Sync Merge Prev / Merge Next availability
    const mergePrevBtn = document.getElementById('brMergePrevBtn');
    const mergeNextBtn = document.getElementById('brMergeNextBtn');
    if (mergePrevBtn) mergePrevBtn.disabled = brState.currentIdx <= 0;
    if (mergeNextBtn) mergeNextBtn.disabled = brState.currentIdx >= brState.questions.length - 1;

    if (mode !== 'BOUNDS') {
        window.app.brUpdateSplitTrimPreview();
    }

    const palette = document.getElementById('brPaletteStrip');
    palette.innerHTML = visible.map((origIdx) => {
        const item = brState.questions[origIdx];
        const isCurr = origIdx === brState.currentIdx;
        let cls = 'bg-emerald-600/80 text-white';
        if (item._skipInReview) cls = 'bg-rose-600/70 text-white line-through opacity-60';
        else if (item._reviewMeta?.needsReview) cls = 'bg-amber-500 text-slate-950';
        const ring = isCurr ? 'ring-2 ring-[var(--md-primary)] scale-110' : '';
        return `<button type="button" onclick="window.app.brJumpTo(${origIdx})" class="h-6 min-w-[28px] px-1.5 rounded-full text-[10px] font-extrabold shrink-0 transition ${cls} ${ring}">Q.${item.questionNumber}</button>`;
    }).join('');
}

window.app = {
    isExtracting: () => state.isExtracting,
    closeCustomDropdown,
    brSetFilter(mode) {
        brState.filter = mode;
        brRenderCurrent();
    },
    onToggleLocalAiBorderChk(isChecked) {
        const pill = document.getElementById('localAiBorderStatusPill');
        const dot = document.getElementById('localAiBorderStatusDot');
        const txt = document.getElementById('localAiBorderStatusText');
        if (isChecked) {
            this.refreshLocalAiBorderStatus(false);
        } else if (pill && dot && txt) {
            pill.className = 'm3-ai-status-pill';
            dot.className = 'w-2 h-2 rounded-full bg-slate-400';
            txt.textContent = 'Off (Using Local v3.0 Engine)';
        }
    },
    brSetEditMode(mode) {
        brState.editMode = mode || 'BOUNDS';
        if (mode === 'SPLIT') {
            const s = document.getElementById('brSplitCutSlider');
            if (s) { s.value = 50; updateM3SliderTrack(s); }
        } else if (mode === 'TRIM') {
            const t = document.getElementById('brTrimTopSlider');
            const b = document.getElementById('brTrimBotSlider');
            if (t) t.value = 0;
            if (b) { b.value = 100; updateM3SliderTrack(t); updateM3SliderTrack(b); }
        }
        brRenderCurrent();
    },
    brUpdateSplitTrimPreview() {
        if (brState.editMode === 'SPLIT') {
            const v = Number(document.getElementById('brSplitCutSlider')?.value || 50);
            const valEl = document.getElementById('brSplitCutVal');
            const lineEl = document.getElementById('brSplitDividerLine');
            if (valEl) valEl.textContent = `${v}%`;
            if (lineEl) lineEl.style.top = `${v}%`; updateM3SliderTrack(document.getElementById('brSplitCutSlider'));
        } else if (brState.editMode === 'TRIM') {
            const t = Number(document.getElementById('brTrimTopSlider')?.value || 0);
            const b = Number(document.getElementById('brTrimBotSlider')?.value || 100);
            const tVal = document.getElementById('brTrimTopVal');
            const bVal = document.getElementById('brTrimBotVal');
            const tMask = document.getElementById('brTrimTopMask');
            const bMask = document.getElementById('brTrimBotMask');
            if (tVal) tVal.textContent = `${t}%`;
            if (bVal) bVal.textContent = `${b}%`;
            if (tMask) tMask.style.height = `${t}%`;
            if (bMask) bMask.style.height = `${100 - b}%`;
        }
    },
    brJumpTo(origIdx) {
        brState.currentIdx = origIdx;
        brState.editMode = 'BOUNDS';
        brRenderCurrent();
    },
    brNavigate(dir) {
        const visible = brGetVisibleIndices();
        const pos = visible.indexOf(brState.currentIdx);
        const nextPos = pos + dir;
        if (nextPos >= 0 && nextPos < visible.length) {
            brState.currentIdx = visible[nextPos];
            brState.editMode = 'BOUNDS';
            brRenderCurrent();
        }
    },
    brToggleSkipCurrent(checked) {
        const q = brState.questions[brState.currentIdx];
        if (!q) return;
        q._skipInReview = Boolean(checked);
        brRenderCurrent();
    },
    brUpdateField(field, val) {
        const q = brState.questions[brState.currentIdx];
        if (!q) return;
        q[field] = val;
        if (field === 'subject') {
            q.chapter = (JEE_CHAPTERS[val] || JEE_CHAPTERS.Physics)[0];
        }
        if (field === 'chapter' || field === 'subject') {
            if (q._reviewMeta) q._reviewMeta.needsReview = false;
        }
        brRenderCurrent();
    },
    async brNudgeBorder(edge, deltaNorm) {
        const q = brState.questions[brState.currentIdx];
        if (!q || !Array.isArray(q._sourceSlices) || q._sourceSlices.length === 0) {
            return toast('Original PDF slice bounds unavailable — use Trim mode instead.', 'info');
        }
        if (edge === 'top') {
            const firstSl = q._sourceSlices[0];
            firstSl.ymin = Math.max(0, Math.min(firstSl.ymax - 24, firstSl.ymin + deltaNorm));
        } else if (edge === 'bottom') {
            const lastSl = q._sourceSlices[q._sourceSlices.length - 1];
            lastSl.ymax = Math.min(1000, Math.max(lastSl.ymin + 24, lastSl.ymax + deltaNorm));
        } else if (edge === 'left') {
            for (const sl of q._sourceSlices) {
                sl.xmin = Math.max(0, Math.min(sl.xmax - 80, sl.xmin + deltaNorm));
            }
        } else if (edge === 'right') {
            for (const sl of q._sourceSlices) {
                sl.xmax = Math.min(1000, Math.max(sl.xmin + 80, sl.xmax + deltaNorm));
            }
        }
        await brRecropQuestionFromSlices(q);
        brRenderCurrent();
    },
    async brConfirmSplitCurrent() {
        const idx = brState.currentIdx;
        const q = brState.questions[idx];
        if (!q || !q.imageDataUrl) return;

        const pct = Math.max(10, Math.min(90, Number(document.getElementById('brSplitCutSlider')?.value || 50)));
        const ratio = pct / 100;

        let topDataUrl, topAspect, botDataUrl, botAspect;
        let topSlices = null, botSlices = null;

        // If single PDF slice exists & page canvas is available, split directly in PDF coordinates (lossless & still nudgeable!)
        const canSplitNative = Array.isArray(q._sourceSlices) && q._sourceSlices.length === 1 && brState.pageCanvasMap.has(q._sourceSlices[0].pageNum);
        if (canSplitNative) {
            const sl = q._sourceSlices[0];
            const srcCanvas = brState.pageCanvasMap.get(sl.pageNum);
            const cutNormY = Math.round(sl.ymin + (sl.ymax - sl.ymin) * ratio);
            const topSl = { ...sl, ymax: Math.max(sl.ymin + 20, cutNormY) };
            const botSl = { ...sl, ymin: Math.min(sl.ymax - 20, cutNormY) };

            const topCrop = crop2DSliceFromPage(srcCanvas, topSl.xmin, topSl.xmax, topSl.ymin, topSl.ymax, topSl.padTop ?? 8, 4);
            const botCrop = crop2DSliceFromPage(srcCanvas, botSl.xmin, botSl.xmax, botSl.ymin, botSl.ymax, 4, botSl.padBottom ?? 8);

            topDataUrl = topCrop.dataUrl; topAspect = topCrop.aspectRatio;
            botDataUrl = botCrop.dataUrl; botAspect = botCrop.aspectRatio;
            topSlices = [topSl];
            botSlices = [botSl];
        } else {
            // Direct image split (supports already-stitched multi-page cards too!)
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = q.imageDataUrl; });
            const cutY = Math.floor(img.height * ratio);

            const c1Raw = document.createElement('canvas');
            c1Raw.width = img.width; c1Raw.height = Math.max(20, cutY);
            c1Raw.getContext('2d').drawImage(img, 0, 0, img.width, c1Raw.height, 0, 0, img.width, c1Raw.height);
            const c1 = autoTrim2DWhitespace(c1Raw);

            const c2Raw = document.createElement('canvas');
            c2Raw.width = img.width; c2Raw.height = Math.max(20, img.height - cutY);
            c2Raw.getContext('2d').drawImage(img, 0, cutY, img.width, c2Raw.height, 0, 0, img.width, c2Raw.height);
            const c2 = autoTrim2DWhitespace(c2Raw);

            topDataUrl = c1.toDataURL('image/jpeg', 0.89); topAspect = c1.height / (c1.width || 1);
            botDataUrl = c2.toDataURL('image/jpeg', 0.89); botAspect = c2.height / (c2.width || 1);
        }

        const baseNum = String(q.questionNumber || '1').replace(/[ab]$/i, '');
        q.questionNumber = `${baseNum}a`;
        q.imageDataUrl = topDataUrl;
        q.aspectRatio = topAspect;
        q.isStitched = false;
        if (topSlices) {
            q._sourceSlices = topSlices;
            q._origSourceSlices = topSlices.map(s => ({ ...s }));
        } else {
            q._sourceSlices = [];
        }
        if (q._reviewMeta) {
            q._reviewMeta.borderNote = `Split manually into Q.${baseNum}a & Q.${baseNum}b`;
        }

        const newQ2 = {
            ...q,
            id: generateUniqueId(),
            uid: generateQuestionUid(),
            questionNumber: `${baseNum}b`,
            imageDataUrl: botDataUrl,
            aspectRatio: botAspect,
            ocrText: '',
            firstLineSnippet: '',
            lastLineSnippet: '',
            isStitched: false,
            createdAt: (q.createdAt || Date.now()) + 1,
            _skipInReview: false,
            _origChapter: q.chapter,
            _sourceSlices: botSlices ? botSlices : [],
            _origSourceSlices: botSlices ? botSlices.map(s => ({ ...s })) : [],
            _reviewMeta: {
                ...(q._reviewMeta || {}),
                borderNote: `Split manually from Q.${baseNum}`
            }
        };

        brState.questions.splice(idx + 1, 0, newQ2);
        brState.editMode = 'BOUNDS';
        brRenderCurrent();
        toast(`Split into Q.${baseNum}a & Q.${baseNum}b!`, 'success');

        // Re-index OCR & local chapter for the newly split halves in background
        const engine = window.JEELocalVisionEngine;
        if (engine?.classifyQuestion) {
            try {
                const [t1, t2] = await Promise.all([
                    recognizeImageTextWithTesseract(q.imageDataUrl),
                    recognizeImageTextWithTesseract(newQ2.imageDataUrl)
                ]);
                if (t1) {
                    q.ocrText = cleanQuestionTextOnly(t1);
                    const r1 = engine.classifyQuestion(q.ocrText, {
                        paperName: q.paperName || '',
                        subjectOverride: q._subjectOverride || q.subject,
                        documentPrior: q._reviewMeta?.subjectPrior || null
                    });
                    q.subject = r1.subject; q.chapter = r1.chapter;
                    if (q._reviewMeta) { q._reviewMeta.confidence = r1.confidence; q._reviewMeta.needsReview = r1.confidence < 0.75; }
                }
                if (t2) {
                    newQ2.ocrText = cleanQuestionTextOnly(t2);
                    const r2 = engine.classifyQuestion(newQ2.ocrText, {
                        paperName: newQ2.paperName || '',
                        subjectOverride: newQ2._subjectOverride || newQ2.subject,
                        documentPrior: newQ2._reviewMeta?.subjectPrior || null
                    });
                    newQ2.subject = r2.subject; newQ2.chapter = r2.chapter;
                    if (newQ2._reviewMeta) { newQ2._reviewMeta.confidence = r2.confidence; newQ2._reviewMeta.needsReview = r2.confidence < 0.75; }
                }
                brRenderCurrent();
            } catch (_) {}
        }
    },
    async brConfirmTrimCurrent() {
        const q = brState.questions[brState.currentIdx];
        if (!q || !q.imageDataUrl) return;

        const tFrac = Math.max(0, Math.min(0.45, Number(document.getElementById('brTrimTopSlider')?.value || 0) / 100));
        const bFrac = Math.max(0.55, Math.min(1.0, Number(document.getElementById('brTrimBotSlider')?.value || 100) / 100));
        if (tFrac <= 0.001 && bFrac >= 0.999) {
            brState.editMode = 'BOUNDS';
            brRenderCurrent();
            return;
        }

        const canTrimNative = Array.isArray(q._sourceSlices) && q._sourceSlices.length === 1 && brState.pageCanvasMap.has(q._sourceSlices[0].pageNum);
        if (canTrimNative) {
            const sl = q._sourceSlices[0];
            const hSpan = sl.ymax - sl.ymin;
            const newYMin = Math.round(sl.ymin + hSpan * tFrac);
            const newYMax = Math.round(sl.ymin + hSpan * bFrac);
            sl.ymin = Math.max(0, Math.min(newYMax - 20, newYMin));
            sl.ymax = Math.min(1000, Math.max(sl.ymin + 20, newYMax));
            await brRecropQuestionFromSlices(q);
        } else {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = q.imageDataUrl; });
            const sy = Math.floor(img.height * tFrac);
            const sh = Math.max(30, Math.floor(img.height * (bFrac - tFrac)));
            const c = document.createElement('canvas');
            c.width = img.width; c.height = sh;
            c.getContext('2d').drawImage(img, 0, sy, img.width, sh, 0, 0, img.width, sh);
            q.imageDataUrl = c.toDataURL('image/jpeg', 0.89);
            q.aspectRatio = c.height / (c.width || 1);
            q._sourceSlices = [];
        }

        if (q._reviewMeta) q._reviewMeta.borderNote = 'Trimmed manually in Review Studio';
        brState.editMode = 'BOUNDS';
        brRenderCurrent();
        toast('Applied vertical trim!', 'success');
    },
    async brMergeWithNeighbor(dir) {
        const currIdx = brState.currentIdx;
        const targetIdx = currIdx + dir;
        if (targetIdx < 0 || targetIdx >= brState.questions.length) return;

        const topIdx = dir < 0 ? targetIdx : currIdx;
        const botIdx = dir < 0 ? currIdx : targetIdx;
        const topQ = brState.questions[topIdx];
        const botQ = brState.questions[botIdx];
        if (!topQ || !botQ) return;

        const stitched = await stitchCanvasesVertically(topQ.imageDataUrl, botQ.imageDataUrl);
        topQ.imageDataUrl = stitched.dataUrl;
        topQ.aspectRatio = stitched.aspectRatio;
        topQ.isStitched = true;
        topQ.ocrText = cleanQuestionTextOnly(`${topQ.ocrText || ''} ${botQ.ocrText || ''}`);
        topQ._sourceSlices = [...(topQ._sourceSlices || []), ...(botQ._sourceSlices || [])];
        topQ._origSourceSlices = [...(topQ._origSourceSlices || []), ...(botQ._origSourceSlices || [])];
        if (topQ._reviewMeta) {
            topQ._reviewMeta.borderNote = `Merged Q.${topQ.questionNumber} + Q.${botQ.questionNumber} manually`;
        }

        // Re-classify merged question locally
        const engine = window.JEELocalVisionEngine;
        if (engine?.classifyQuestion && topQ.ocrText) {
            const r = engine.classifyQuestion(topQ.ocrText, {
                paperName: topQ.paperName || '',
                subjectOverride: topQ._subjectOverride || topQ.subject,
                documentPrior: topQ._reviewMeta?.subjectPrior || null
            });
            topQ.subject = r.subject;
            topQ.chapter = r.chapter;
            if (topQ._reviewMeta) {
                topQ._reviewMeta.confidence = r.confidence;
                topQ._reviewMeta.needsReview = r.confidence < 0.75;
            }
        }

        brState.questions.splice(botIdx, 1);
        brState.currentIdx = Math.min(topIdx, brState.questions.length - 1);
        brState.editMode = 'BOUNDS';
        brRenderCurrent();
        toast(`Merged into Q.${topQ.questionNumber}!`, 'success');
    },
    async brResetCurrentBorder() {
        const q = brState.questions[brState.currentIdx];
        if (!q || !Array.isArray(q._origSourceSlices)) return;
        q._sourceSlices = q._origSourceSlices.map(s => ({ ...s }));
        await brRecropQuestionFromSlices(q);
        brRenderCurrent();
        toast('Reset crop border to detected bounds', 'info');
    },
    async brReClassifyLocalCurrent() {
        if (brState.isReClassifying) return;
        const q = brState.questions[brState.currentIdx];
        const engine = window.JEELocalVisionEngine;
        if (!q || !engine) return;

        const btn = document.getElementById('brReClassifyLocalBtn');
        brState.isReClassifying = true;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i><span>Re-Classifying Locally...</span>'; }

        try {
            const tessText = await recognizeImageTextWithTesseract(q.imageDataUrl);
            const combined = cleanQuestionTextOnly(`${tessText} ${q.ocrText || ''}`);
            if (combined.length > (q.ocrText || '').length) q.ocrText = combined;

            const res = engine.classifyQuestion(q.ocrText || '', {
                paperName: q.paperName || '',
                subjectOverride: q.subject,
                documentPrior: q._reviewMeta?.subjectPrior || null
            });
            q.subject = res.subject;
            q.chapter = res.chapter;
            if (q._reviewMeta) {
                q._reviewMeta.confidence = res.confidence;
                q._reviewMeta.needsReview = res.confidence < 0.75;
            }
            brRenderCurrent();
            toast(`Local match: ${res.subject} • ${res.chapter} (${Math.round(res.confidence * 100)}%)`, 'success');
        } finally {
            brState.isReClassifying = false;
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-arrows-clockwise"></i><span>Re-Run Local Chapter Match on Crop</span>'; }
        }
    },
    brResolve(action) {
        const resolver = brState.resolver;
        brState.resolver = null;
        const kept = brState.questions.filter(q => !q._skipInReview);

        if (action === 'CONFIRM' && window.JEELocalVisionEngine?.learnCorrection) {
            for (const q of kept) {
                if (q._origChapter && q._origChapter !== q.chapter) {
                    const txt = `${q.ocrText || ''} ${q.firstLineSnippet || ''}`.trim();
                    if (txt) window.JEELocalVisionEngine.learnCorrection(txt, q.subject, q.chapter);
                }
            }
        }

        animateModalClose('batchReviewModal', () => {
            if (resolver) resolver({ action, questions: kept });
        });
    },
                mcToggleColumns() {
        mcState.isTwoCol = !mcState.isTwoCol;
        mcRenderOverlayAndSidebar();
    },
    mcAddSeparatorLine(colIdx = 0) {
        const ys = mcState.colBounds[colIdx];
        // Split the tallest existing gap in this column
        let bestIdx = 0, maxGap = -1;
        for (let i = 0; i < ys.length - 1; i++) {
            const gap = ys[i + 1] - ys[i];
            if (gap > maxGap) { maxGap = gap; bestIdx = i; }
        }
        if (maxGap < 44) return toast('No room left to add another separator line.', 'warn');
        const mid = Math.round((ys[bestIdx] + ys[bestIdx + 1]) / 2);
        ys.splice(bestIdx + 1, 0, mid);
        mcRenderOverlayAndSidebar();
    },
    openPdfDefaultSubjectMenu(anchorEl) {
        const opts = [
            { value: 'AUTO', label: 'Auto-Detect Subject' },
            { value: 'Mathematics', label: 'Mathematics' },
            { value: 'Physics', label: 'Physics' },
            { value: 'Chemistry', label: 'Chemistry' }
        ];
        openCustomDropdown(anchorEl, opts, state.pdfDefaultSubject || 'AUTO', (val, lbl) => {
            state.pdfDefaultSubject = val;
            const el = document.getElementById('pdfDefaultSubjectLabel');
            if (el) el.textContent = lbl;
        });
    },
    async refreshLocalAiBorderStatus(notify = false) {
        const pill = document.getElementById('localAiBorderStatusPill');
        const dot = document.getElementById('localAiBorderStatusDot');
        const txt = document.getElementById('localAiBorderStatusText');
        const aiBorders = window.JEELocalAIBorders;
        if (!pill || !dot || !txt || !aiBorders) return;

        pill.className = 'm3-ai-status-pill is-checking';
        dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
        txt.textContent = 'Checking Termux AI server...';

        const res = await aiBorders.testConnection();
        if (res.ok) {
            pill.className = 'm3-ai-status-pill is-online';
            dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
            txt.textContent = `Connected: ${res.kind === 'ollama' ? 'Ollama' : 'llama-server'} (${res.modelName})`;
            if (notify) toast(`Connected to Local AI at ${res.url} (${res.modelName}) ✓`, 'success');
        } else {
            pill.className = 'm3-ai-status-pill is-offline';
            dot.className = 'w-2 h-2 rounded-full bg-rose-400';
            txt.textContent = 'Offline — Start llama-server in Termux';
            if (notify) toast(res.error || 'Local AI server offline', 'warn');
        }
    },
    async testLocalAiServerFromSettings() {
        const aiBorders = window.JEELocalAIBorders;
        const inp = document.getElementById('localAiServerUrlInput');
        const info = document.getElementById('settingsLocalAiStatusText');
        if (!aiBorders) return;
        if (inp) aiBorders.setServerUrl(inp.value.trim());
        if (info) info.textContent = 'Testing connection...';
        const res = await aiBorders.testConnection();
        if (res.ok) {
            if (info) info.textContent = `✓ Connected to ${res.kind} (${res.modelName}) at ${res.url}`;
            toast(`Local AI Connected (${res.modelName}) ✓`, 'success');
        } else {
            if (info) info.textContent = `⚠ Offline: ${res.error}`;
            toast(res.error || 'Could not reach Local AI server', 'warn');
        }
    },
    openMcBulkSubjectMenu(anchorEl) {
        const opts = [
            { value: 'Physics', label: 'Physics' },
            { value: 'Chemistry', label: 'Chemistry' },
            { value: 'Mathematics', label: 'Mathematics' }
        ];
        openCustomDropdown(anchorEl, opts, mcState.defaultSubj, (subj) => {
            mcState.defaultSubj = subj;
            mcState.defaultChap = (JEE_CHAPTERS[subj] || JEE_CHAPTERS.Physics)[0];
            mcSyncBulkDropdownLabels();
            this.mcApplyBulkChapterToAll();
        });
    },
    openMcBulkChapterMenu(anchorEl) {
        const list = JEE_CHAPTERS[mcState.defaultSubj] || JEE_CHAPTERS.Physics;
        const opts = list.map(c => ({ value: c, label: c }));
        openCustomDropdown(anchorEl, opts, mcState.defaultChap, (chap) => {
            mcState.defaultChap = chap;
            mcSyncBulkDropdownLabels();
            this.mcApplyBulkChapterToAll();
        });
    },
    openMcRegionSubjMenu(key, anchorEl) {
        const m = mcState.regionMeta[key];
        if (!m) return;
        const opts = [
            { value: 'Physics', label: 'Physics' },
            { value: 'Chemistry', label: 'Chemistry' },
            { value: 'Mathematics', label: 'Mathematics' }
        ];
        openCustomDropdown(anchorEl, opts, m.subject, (val) => this.mcUpdateRegion(key, 'subject', val));
    },
    openMcRegionChapMenu(key, anchorEl) {
        const m = mcState.regionMeta[key];
        if (!m) return;
        const list = JEE_CHAPTERS[m.subject] || JEE_CHAPTERS.Physics;
        const opts = list.map(c => ({ value: c, label: c }));
        openCustomDropdown(anchorEl, opts, m.chapter, (val) => this.mcUpdateRegion(key, 'chapter', val));
    },
    openBrSubjectMenu(anchorEl) {
        const q = brState.questions[brState.currentIdx];
        if (!q) return;
        const opts = [
            { value: 'Physics', label: 'Physics' },
            { value: 'Chemistry', label: 'Chemistry' },
            { value: 'Mathematics', label: 'Mathematics' }
        ];
        openCustomDropdown(anchorEl, opts, q.subject, (val) => this.brUpdateField('subject', val));
    },
    openBrChapterMenu(anchorEl) {
        const q = brState.questions[brState.currentIdx];
        if (!q) return;
        const list = JEE_CHAPTERS[q.subject] || JEE_CHAPTERS.Physics;
        const opts = list.map(c => ({ value: c, label: c }));
        openCustomDropdown(anchorEl, opts, q.chapter, (val) => this.brUpdateField('chapter', val));
    },
    async brReCheckCurrentPageBordersAI() {
        if (brState.isReCheckingBorders) return;
        const q = brState.questions[brState.currentIdx];
        const aiBorders = window.JEELocalAIBorders;
        if (!q || !aiBorders) return toast('local-ai-borders.js not loaded', 'warn');

        const srcCanvas = brState.pageCanvasMap.get(q.page);
        if (!srcCanvas) return toast('Original page canvas unavailable for this question', 'warn');

        const btn = document.getElementById('brReCheckAiBorderBtn');
        brState.isReCheckingBorders = true;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i><span>Testing Local AI...</span>'; }

        try {
            const pageBlocks = brState.questions
                .filter(item => item.page === q.page && Array.isArray(item._sourceSlices) && item._sourceSlices[0])
                .map(item => ({
                    ...item._sourceSlices[0],
                    questionNumber: item.questionNumber
                }));
            const res = await aiBorders.verifyPageBorders(srcCanvas, q.page, pageBlocks, { retryAfterFatal: true });
            if (q._reviewMeta) {
                q._reviewMeta.aiBorderVerified = Boolean(res.verified);
                q._reviewMeta.borderNote = `${res.note} (${(res.elapsedMs / 1000).toFixed(1)}s • ${res.modelName || res.backend})`;
            }
            brRenderCurrent();
            toast(`Page ${q.page} Local AI: ${res.note} (${(res.elapsedMs / 1000).toFixed(1)}s)`, res.verified ? 'success' : 'warn');
        } catch (err) {
            if (q._reviewMeta) q._reviewMeta.borderNote = `Local AI offline/error: ${err.message}`;
            brRenderCurrent();
            toast(`Local AI check failed: ${err.message}`, 'warn');
        } finally {
            brState.isReCheckingBorders = false;
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-bounding-box"></i><span>Test Local AI on This Page</span>'; }
        }
    },
    mcApplyBulkChapterToAll() {
        const subj = mcState.defaultSubj;
        const chap = mcState.defaultChap;
        Object.values(mcState.regionMeta).forEach(m => {
            m.subject = subj;
            m.chapter = chap;
        });
        mcRenderOverlayAndSidebar();
    },
    mcUpdateRegion(key, field, val) {
        const m = mcState.regionMeta[key];
        if (!m) return;
        m[field] = val;
        if (field === 'subject') {
            m.chapter = (JEE_CHAPTERS[val] || JEE_CHAPTERS.Physics)[0];
        }
        mcRenderOverlayAndSidebar();
    },
    mcResolve(action) {
        const resolver = mcState.resolver;
        mcState.resolver = null;
        const switchToManualAll = Boolean(document.getElementById('mcSwitchManualAllChk')?.checked);
        const blocks = action === 'CONFIRM'
            ? mcGetAllRegions()
                .filter(r => !r.meta.excluded)
                .map(r => ({
                    questionNumber: r.meta.qNum,
                    subject: r.meta.subject,
                    chapter: r.meta.chapter,
                    xmin: r.xmin,
                    xmax: r.xmax,
                    ymin: r.ymin,
                    ymax: r.ymax,
                    ocrText: '',
                    firstLineSnippet: '',
                    lastLineSnippet: '',
                    isContinuationFromPrevPage: Boolean(r.meta.stitchPrev),
                    manualStitchWithPrev: Boolean(r.meta.stitchPrev),
                    continuesToNextPage: false,
                    colLines: []
                }))
            : [];

        animateModalClose('manualCropModal', () => {
            if (resolver) resolver({ action, switchToManualAll, blocks });
        });
    },
                // --- Animated Solver Modal ---
    openSolverModal() {
        closeCustomDropdown();
        state.isSolverMinimized = false;
        document.getElementById('minimizedSolverBar')?.classList.add('hidden');
        document.getElementById('minimizedSolverBar')?.classList.remove('flex');
        const subHdr = document.getElementById('solverModalSubHeader');
        if (subHdr) {
            subHdr.textContent = `Model: ${getSelectedModel()} • Rate Limit Guard: Max 19/day (IST), Max 4/min`;
        }
        const solvedCount = state.questions.filter(q => q.hint && q.answerKey && q.answerKey !== 'Not solved yet').length;
        if (!state.isRunningBackgroundSolver) {
            const badgeEl = document.getElementById('solverModalCountBadge');
            if (badgeEl) badgeEl.textContent = `Solved ${solvedCount}/${state.questions.length}`;
            renderM3WavyProgress('solverModalWavyBarWrap', state.questions.length ? Math.round((solvedCount / state.questions.length) * 100) : 6);
        }
        updateQuotaBadgesEverywhere();
        animateModalOpen('solverModal');
        if (!waveAnimFrame) waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
        ensureM3MorphLoopRunning();
    },
    minimizeSolverModal() {
        closeCustomDropdown();
        animateModalClose('solverModal', () => {
            if (state.isRunningBackgroundSolver) {
                state.isSolverMinimized = true;
                const minBar = document.getElementById('minimizedSolverBar');
                if (minBar) {
                    minBar.classList.remove('hidden');
                    minBar.classList.add('flex');
                }
                if (!waveAnimFrame) waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
                ensureM3MorphLoopRunning();
            }
        });
    },
    closeSolverModal() {
        if (state.isRunningBackgroundSolver) {
            this.minimizeSolverModal();
            return;
        }
        closeCustomDropdown();
        animateModalClose('solverModal');
    },

    // --- Animated Mock Test Modals ---
    openMockTestSetupModal() {
        closeCustomDropdown();
        if (state.mockTest.active) {
            return toast('Mock test is already running! Click Submit Test to finish.', 'info');
        }
        animateModalOpen('mockTestSetupModal');
    },
    closeMockTestSetupModal() {
        animateModalClose('mockTestSetupModal');
    },
    closeMockTestSummaryModal() {
        animateModalClose('mockTestSummaryModal');
    },

    // --- Animated Upload Modal ---
    openUploadModal(initialImageBlob = null) {
        closeCustomDropdown();
        if (state.isExtracting && state.isUploadMinimized) {
            this.restoreUploadModal();
            return;
        }
        setUploadButtonsLock(false);
        setUploadStudioExpanded(false);

        if (initialImageBlob) {
            animateModalOpen('uploadModal');
            loadSingleImageForImport(initialImageBlob, initialImageBlob.name || 'Pasted Image');
            return;
        }

        state.importMode = null;
        state.pdfDoc = null;
        state.importRawImg = null;
        document.getElementById('selectedFileLabel').textContent = 'Tap to Select Any 1-Column / 2-Column JEE PDF or Photo (or press Ctrl+V)';
        document.getElementById('selectedFileTypeBadge').textContent = 'Computes local 2D candidate borders & verifies them with Gemini 3.8 Flash';
        document.getElementById('unifiedFileIcon').className = 'ph-duotone ph-cloud-arrow-up text-2xl';
        document.getElementById('pdfSetupSubView').classList.add('hidden');
        document.getElementById('pdfSetupSubView').classList.remove('grid');
        document.getElementById('imageSetupSubView').classList.add('hidden');
        document.getElementById('startExtractBtn').disabled = true;
        document.getElementById('startExtractBtnLbl').textContent = 'Extract Questions';
        animateModalOpen('uploadModal');
    },
    minimizeUploadModal() {
        if (!state.isExtracting) return;
        closeCustomDropdown();
        state.isUploadMinimized = true;
        animateModalClose('uploadModal', () => {
            const minBar = document.getElementById('minimizedUploadBar');
            if (minBar) {
                minBar.classList.remove('hidden');
                minBar.classList.add('flex');
            }
            if (!waveAnimFrame) waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
            ensureM3MorphLoopRunning();
        });
    },
    restoreUploadModal() {
        closeCustomDropdown();
        state.isUploadMinimized = false;
        const minBar = document.getElementById('minimizedUploadBar');
        if (minBar) {
            minBar.classList.add('hidden');
            minBar.classList.remove('flex');
        }
        setUploadStudioExpanded(true);
        animateModalOpen('uploadModal');
        requestAnimationFrame(() => fitExtractPageFrame());
        if (!waveAnimFrame) waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
        ensureM3MorphLoopRunning();
    },
    closeUploadModal() {
        closeCustomDropdown();
        if (!state.isExtracting && !state.isImportingImage) {
            animateModalClose('uploadModal', () => {
                setUploadStudioExpanded(false);
                state.importRawImg = null;
            });
        }
    },

    // --- Animated Image Preview & Smooth Morph into Whiteboard ---
    getActivePopupId: () => state.activePopupId,
    openImagePopup(id, keepContext = false) {
        closeCustomDropdown();
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        if (!keepContext || !Array.isArray(state.padContextIds) || !state.padContextIds.includes(q.id)) {
            capturePadNavigationContext(q.id);
        }
        state.activePopupId = q.id;
        state.isPopupAnimating = false;
        initQuestionTimerIdle();
        syncUrlHashWithActiveQuestion(q);
        renderPopupCarouselSlots();
        animateModalOpen('imagePopupModal');
    },
    openScratchpadFromPopup(id) {
        if (isVerticalScreen()) {
            toast('Whiteboard is only allowed on horizontal screens.', 'warn');
            return;
        }
        // Smoothly animate the preview card out while morphing the Whiteboard in
        this.closeImagePopup(true);
        setTimeout(() => {
            this.openScratchpad(id, true);
        }, 110);
    },
    closeImagePopup(keepHash = false) {
        closeCustomDropdown();
        stopQuestionTimer();
        state.isPopupAnimating = false;
        animateModalClose('imagePopupModal', () => {
            state.activePopupId = null;
            if (!keepHash) clearQuestionUrlHash();
            renderAll();
            scheduleCloudAutoSync(true);
        });
    },
    openSettingsModal(showMissingAlert = false, initialPage = 'HOME') {
        closeCustomDropdown();
        document.getElementById('apiKeyInput').value = getApiKey();
        const currentMod = GEMINI_MODELS.find(m => m.value === getSelectedModel()) || GEMINI_MODELS[0];
        const modLbl = document.getElementById('geminiModelDropdownLabel');
        if (modLbl) modLbl.textContent = currentMod.label;

        const pads = getVerticalPads();
        document.getElementById('padTopInput').value = pads.padTop;
        document.getElementById('padBottomInput').value = pads.padBottom;
        const localUrlInp = document.getElementById('localAiServerUrlInput');
        if (localUrlInp) localUrlInp.value = localStorage.getItem('jee_local_ai_borders_url_v3') || '';
        document.getElementById('githubTokenInput').value = getGithubToken();
        document.getElementById('cloudAutoSyncCheckbox').checked = isCloudAutoSyncEnabled();
        const autoSolveChk = document.getElementById('autoSolveHintsCheckbox');
        if (autoSolveChk) autoSolveChk.checked = isAutoSolveHintsEnabled();

        updateQuotaBadgesEverywhere();

        document.getElementById('apiKeyMissingAlert').classList.toggle('hidden', !showMissingAlert);
        updateCloudStatusUI(state.isSyncingCloud ? 'syncing' : 'idle');
        this.openSettingsPage(showMissingAlert ? 'KEYS' : initialPage, true);
        animateModalOpen('settingsModal');
    },
    closeSettingsModal() {
        closeCustomDropdown();
        animateModalClose('settingsModal');
    },

    // --- Animated Clear Vault & Split Modals ---
    confirmClearVault() {
        closeCustomDropdown();
        if (state.questions.length === 0) return toast('Question vault is already empty!', 'info');
        document.getElementById('clearConfirmCount').textContent = state.questions.length;
        const chk = document.getElementById('clearVaultDoubleCheck');
        const btn = document.getElementById('finalClearVaultBtn');
        if (chk) chk.checked = false;
        if (btn) btn.disabled = true;
        animateModalOpen('clearConfirmModal');
    },
    closeClearConfirmModal() {
        animateModalClose('clearConfirmModal');
    },
    openSplitModal(id) {
        closeCustomDropdown();
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        state.activeSplitId = Number(id);
        document.getElementById('splitPreviewImg').src = q.imageDataUrl;
        document.getElementById('splitCutSlider').value = 50;
        ['splitCutSlider','trimTopSlider','trimBotSlider'].forEach(id => updateM3SliderTrack(document.getElementById(id)));
        document.getElementById('trimTopSlider').value = 0;
        document.getElementById('trimBotSlider').value = 100;
        this.setSplitMode('SPLIT');
        animateModalOpen('splitModal');
    },
    closeSplitModal() {
        closeCustomDropdown();
        animateModalClose('splitModal', () => {
            state.activeSplitId = null;
        });
    },
    openSettingsPage(pageKey = 'HOME', skipAnim = false) {
        closeCustomDropdown();
        const prevKey = state.activeSettingsPage || 'HOME';
        state.activeSettingsPage = pageKey;
        const allKeys = ['HOME', 'KEYS', 'THEME', 'BACKUP', 'SCANNER'];

        const modalEl = document.getElementById('settingsModal');
        const dialogEl = modalEl?.querySelector('.m3-dialog');
        const stageEl = modalEl?.querySelector('.settings-pages-stage');

        if (this._settingsAnimTimer) {
            clearTimeout(this._settingsAnimTimer);
            this._settingsAnimTimer = null;
        }
        if (this._dialogHeightAnim) {
            this._dialogHeightAnim.cancel();
            this._dialogHeightAnim = null;
        }
        if (stageEl) stageEl.scrollTop = 0;

        // Update header first so its height is consistent
        const backBtn = document.getElementById('settingsBackBtn');
        const headerIcon = document.getElementById('settingsHeaderIcon');
        const titleEl = document.getElementById('settingsHeaderTitle');
        if (pageKey === 'HOME') {
            backBtn.classList.add('hidden'); backBtn.classList.remove('flex');
            headerIcon.classList.remove('hidden');
            titleEl.textContent = 'Settings';
        } else {
            backBtn.classList.remove('hidden'); backBtn.classList.add('flex');
            headerIcon.classList.add('hidden');
            const titles = {
                KEYS: 'API Keys & Cloud Credentials',
                THEME: 'Appearance & Material You Theme',
                BACKUP: 'Cloud Sync, Export & Vault Tools',
                SCANNER: 'Gemini 3.8 Flash Solver & Scanner'
            };
            titleEl.textContent = titles[pageKey] || 'Settings';
        }

        if (skipAnim || prevKey === pageKey || !dialogEl || !stageEl) {
            if (dialogEl) dialogEl.style.height = '';
            allKeys.forEach(p => {
                const el = document.getElementById(`settingsPage_${p}`);
                if (!el) return;
                el.classList.remove('tg-page-push-in', 'tg-page-push-out', 'tg-page-pop-in', 'tg-page-pop-out', 'tg-outgoing-abs');
                el.classList.toggle('hidden', p !== pageKey);
            });
            requestAnimationFrame(() => updateAllSegmentedGliders());
            return;
        }

        const isPushingSubpage = prevKey === 'HOME' && pageKey !== 'HOME';
        const outEl = document.getElementById(`settingsPage_${prevKey}`);
        const inEl = document.getElementById(`settingsPage_${pageKey}`);

        allKeys.forEach(p => {
            if (p !== prevKey && p !== pageKey) {
                const other = document.getElementById(`settingsPage_${p}`);
                if (other) {
                    other.classList.add('hidden');
                    other.classList.remove('tg-page-push-in', 'tg-page-push-out', 'tg-page-pop-in', 'tg-page-pop-out', 'tg-outgoing-abs');
                }
            }
        });

        if (outEl && inEl) {
            // 1. Measure current outer dialog height with outgoing page active
            dialogEl.style.height = '';
            outEl.classList.remove('hidden', 'tg-outgoing-abs', 'tg-page-push-in', 'tg-page-push-out', 'tg-page-pop-in', 'tg-page-pop-out');
            inEl.classList.add('hidden');
            const startDialogH = dialogEl.getBoundingClientRect().height;

            // 2. Detach outgoing page (position: absolute) and unhide incoming page to measure target outer dialog height
            outEl.classList.add('tg-outgoing-abs');
            inEl.classList.remove('hidden', 'tg-outgoing-abs', 'tg-page-push-in', 'tg-page-push-out', 'tg-page-pop-in', 'tg-page-pop-out');
            const endDialogH = dialogEl.getBoundingClientRect().height;

            // 3. Animate outer dialog height + horizontal page slide simultaneously on the GPU
            if (Math.abs(startDialogH - endDialogH) > 1) {
                this._dialogHeightAnim = dialogEl.animate(
                    [
                        { height: `${startDialogH}px` },
                        { height: `${endDialogH}px` }
                    ],
                    {
                        duration: 240,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        fill: 'forwards'
                    }
                );
            }

            outEl.classList.add(isPushingSubpage ? 'tg-page-push-out' : 'tg-page-pop-out');
            inEl.classList.add(isPushingSubpage ? 'tg-page-push-in' : 'tg-page-pop-in');
            requestAnimationFrame(() => updateAllSegmentedGliders());

            this._settingsAnimTimer = setTimeout(() => {
                outEl.classList.add('hidden');
                outEl.classList.remove('tg-page-push-out', 'tg-page-pop-out', 'tg-outgoing-abs');
                inEl.classList.remove('tg-page-push-in', 'tg-page-pop-in');
                if (this._dialogHeightAnim) {
                    this._dialogHeightAnim.cancel();
                    this._dialogHeightAnim = null;
                }
                dialogEl.style.height = '';
                this._settingsAnimTimer = null;
                updateAllSegmentedGliders();
            }, 245);
        }
    },
    getActivePadId: () => state.activePadId,
    openScratchpad(id, keepContext = false, slideDir = 0) {
        closeCustomDropdown();
        if (isVerticalScreen()) {
            toast('Whiteboard is only allowed on horizontal screens.', 'warn');
            return;
        }
        if (state.activePadId && !state.wbIsLoading) {
            syncActiveBoardToQuestionGist(true);
        }
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        if (!keepContext || !Array.isArray(state.padContextIds) || !state.padContextIds.includes(q.id)) {
            capturePadNavigationContext(q.id);
        }
        state.activePadId = Number(id);
        state.padShowHint = false;
        state.padShowAns = false;
        if (!state.mockTest.active) state.blindModeActive = false;
        state.wbSelectedIds = [];
        state.wbScale = 1.0;
        state.wbPanX = 0;
        state.wbPanY = 0;

        initQuestionTimerIdle();
        syncUrlHashWithActiveQuestion(q);
        refreshScratchpadTopBarAndHints();

        const wbModal = document.getElementById('scratchpadModal');
        const wrap = document.getElementById('padCanvasWrap');
        const wasHidden = wbModal.classList.contains('hidden');

        if (wbModal._closeTimer) {
            clearTimeout(wbModal._closeTimer);
            wbModal._closeTimer = null;
        }

        wbModal.classList.remove('hidden', 'wb-exit-anim');
        checkWhiteboardOrientationLock();

        if (wasHidden) {
            wbModal.classList.remove('wb-enter-anim');
            void wbModal.offsetWidth;
            wbModal.classList.add('wb-enter-anim');
            // Let the GPU start the 60fps open animation first before heavy canvas allocation
            setTimeout(() => {
                wbModal.classList.remove('wb-enter-anim');
            }, 250);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    loadQuestionBoardInBackground(q);
                });
            });
        } else {
            if (slideDir !== 0 && wrap) {
                wrap.classList.remove('wb-question-slide-next', 'wb-question-slide-prev');
                void wrap.offsetWidth;
                wrap.classList.add(slideDir > 0 ? 'wb-question-slide-next' : 'wb-question-slide-prev');
            }
            loadQuestionBoardInBackground(q);
        }
    },
    closeScratchpad() {
        closeCustomDropdown();
        stopQuestionTimer();
        if (state.activePadId && !state.wbIsLoading && !state.blindModeActive) {
            syncActiveBoardToQuestionGist(true);
        }
        state.wbLoadToken++;
        setWhiteboardLoadingLock(false);
        state.wbSelectedIds = [];
        state.activePadId = null;
        if (!state.mockTest.active) state.blindModeActive = false;
        clearQuestionUrlHash();

        // Update lightweight counters only; individual cards are already updated in-place via toggleQBool!
        refreshCountsAndDrawerOnly();

        const wbModal = document.getElementById('scratchpadModal');
        if (wbModal && !wbModal.classList.contains('hidden')) {
            wbModal.classList.remove('wb-enter-anim');
            wbModal.classList.add('wb-exit-anim');
            if (wbModal._closeTimer) clearTimeout(wbModal._closeTimer);
            wbModal._closeTimer = setTimeout(() => {
                wbModal.classList.add('hidden');
                wbModal.classList.remove('wb-exit-anim');
                wbModal._closeTimer = null;
                // Only rebuild feed if status/tag filter requires hiding solved/unsolved cards
                if (state.status !== 'ALL' || state.tagFilter !== 'ALL') {
                    requestAnimationFrame(() => renderFeed());
                }
            }, 185);
        }
    },

    // --- Animated Whiteboard Open, Close & 3-Finger Slide Navigation ---
    getActivePadId: () => state.activePadId,
    navigatePadQuestion(dir) {
        closeCustomDropdown();
        const q = state.questions.find(i => i.id === Number(state.activePadId));
        if (!q) return;
        const activeList = getLockedPadContextList(q.id);
        const idx = activeList.findIndex(item => item.id === q.id);
        const nextQ = activeList[idx + dir];
        if (!nextQ) {
            return toast(dir > 0 ? 'Reached last question in current filter' : 'At first question in current filter', 'info');
        }
        this.openScratchpad(nextQ.id, true, dir);
    },

    stopBackgroundSolver() {
        if (!state.isRunningBackgroundSolver) return;
        state.stopSolverRequested = true;
        try { state.solverAbortController?.abort(); } catch (_) {}
        appendSolverLog('🛑 Solver stopped by user.', 'error');
        toast('Stopped AI Solver.', 'warn');
    },

    openPaperMenu(anchorEl) {
        const papers = Array.from(new Set(state.questions.map(q => q.paperName).filter(Boolean)));
        const opts = [
            { value: 'ALL', label: `All Papers (${papers.length})` },
            ...papers.map(p => ({ value: p, label: p }))
        ];
        openCustomDropdown(anchorEl, opts, state.paper, (val) => this.setPaper(val));
    },
    openSortMenu(anchorEl) {
        openCustomDropdown(anchorEl, SORT_MODES, state.sortBy, (val, _lbl, picked) => {
            state.sortBy = val;
            const el = document.getElementById('sortDropdownLabel');
            if (el && picked) el.textContent = picked.short;
            sortAndRefreshQuestions(false);
        });
    },
    openCardSubjMenu(id, anchorEl) {
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        const opts = [
            { value: 'Physics', label: 'Physics' },
            { value: 'Chemistry', label: 'Chemistry' },
            { value: 'Mathematics', label: 'Mathematics' }
        ];
        openCustomDropdown(anchorEl, opts, q.subject, (val) => this.updateQField(id, 'subject', val));
    },
    openCardChapMenu(id, anchorEl) {
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        const chaps = JEE_CHAPTERS[q.subject] || JEE_CHAPTERS.Physics;
        const opts = chaps.map(c => ({ value: c, label: c }));
        openCustomDropdown(anchorEl, opts, q.chapter, (val) => this.updateQField(id, 'chapter', val));
    },
    openQuestionTagMenu(id, anchorEl) {
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        openCustomDropdown(anchorEl, QUESTION_TAGS, q.noteTag || '', (val) => {
            q.noteTag = val || '';
            if (!document.getElementById('scratchpadModal')?.classList.contains('hidden')) {
                refreshScratchpadTopBarAndHints();
            }
            if (!document.getElementById('imagePopupModal')?.classList.contains('hidden')) {
                renderPopupCarouselSlots();
            }
            // Update the feed card badge in-place if it still matches the filter
            if (state.tagFilter === 'ALL' || state.tagFilter === q.noteTag) {
                const cardEl = document.querySelector(`article[data-card-id="${q.id}"]`);
                if (cardEl) {
                    const existingBadge = cardEl.querySelector('.card-tag-badge');
                    if (q.noteTag) {
                        if (existingBadge) {
                            existingBadge.textContent = q.noteTag;
                        } else {
                            const dropGroup = cardEl.querySelector('.m3-card-dropdown-group');
                            if (dropGroup) {
                                dropGroup.insertAdjacentHTML(
                                    'afterend',
                                    `<button type="button" onclick="window.app.openQuestionTagMenu(${q.id}, this)" class="card-tag-badge px-2 py-0.5 rounded-full m3-primary-pill text-[9px] font-extrabold shrink-0">${q.noteTag}</button>`
                                );
                            }
                        }
                    } else if (existingBadge) {
                        existingBadge.remove();
                    }
                }
            } else {
                renderFeed();
            }
            scheduleCloudAutoSync(true);
        });
    },
    openGeminiModelMenu(anchorEl) {
        openCustomDropdown(anchorEl, GEMINI_MODELS, getSelectedModel(), (val, lbl) => {
            state.selectedModel = val;
            localStorage.setItem('jee_gemini_model', val);
            const labelEl = document.getElementById('geminiModelDropdownLabel');
            if (labelEl) labelEl.textContent = lbl;
            const subHdr = document.getElementById('solverModalSubHeader');
            if (subHdr) subHdr.textContent = `Model: ${val} • Rate Limit Guard: Max 19/day (IST), Max 4/min`;
            toast(`Switched active model to ${val}`, 'success');
        });
    },
    openInsertShapeMenu(anchorEl) {
        if (state.wbIsLoading) return;
        openCustomDropdown(anchorEl, PRESET_SHAPES, '', (shapeType) => {
            this.insertPresetShape(shapeType);
        });
    },
    openInkStyleMenu(anchorEl) {
        if (state.wbIsLoading) return;
        const opts = [
            ...WHITEBOARD_COLORS.map(c => ({ value: `COLOR:${c.value}`, label: c.label, colorDot: c.value })),
            ...STROKE_WIDTHS.map(w => ({ value: `WIDTH:${w.value}`, label: `Thickness: ${w.label}` }))
        ];
        const currKey = `COLOR:${state.inkColor}`;
        openCustomDropdown(anchorEl, opts, currKey, (val) => {
            if (String(val).startsWith('COLOR:')) {
                const col = val.replace('COLOR:', '');
                this.setInk(col);
            } else if (String(val).startsWith('WIDTH:')) {
                const w = Number(val.replace('WIDTH:', ''));
                this.setStrokeWidth(w);
            }
        });
    },
    openWhiteboardMoreMenu(anchorEl) {
        const container = getActiveBoardContainer();
        const opts = [
            { value: 'GRID', label: `Switch Grid (${state.wbGridMode})` },
            { value: 'EXPORT_PNG', label: 'Download Board as PNG' },
            { value: 'ADD_PAGE', label: `Add Blank Page (Total: ${container.pages.length})` },
            ...(container.pages.length > 1 ? [{ value: 'DEL_PAGE', label: `Delete Current Page (P.${container.currentPage + 1})` }] : []),
            { value: 'CLEAR_PAGE', label: 'Clear Current Page Ink' }
        ];
        openCustomDropdown(anchorEl, opts, '', (action) => {
            if (action === 'GRID') this.cycleWhiteboardGrid();
            else if (action === 'EXPORT_PNG') this.exportWhiteboardPng();
            else if (action === 'ADD_PAGE') this.addWhiteboardPage();
            else if (action === 'DEL_PAGE') this.deleteCurrentWhiteboardPage();
            else if (action === 'CLEAR_PAGE') this.clearInk();
        });
    },

    toggleEliminateOption(optLetter, explicitQId = null) {
        const targetId = explicitQId || state.activePadId || state.activePopupId;
        const q = state.questions.find(i => i.id === Number(targetId));
        if (!q) return;
        if (!Array.isArray(q.eliminatedOptions)) q.eliminatedOptions = [];
        if (q.eliminatedOptions.includes(optLetter)) {
            q.eliminatedOptions = q.eliminatedOptions.filter(o => o !== optLetter);
        } else {
            q.eliminatedOptions.push(optLetter);
        }
        if (!document.getElementById('scratchpadModal')?.classList.contains('hidden')) {
            refreshScratchpadTopBarAndHints();
        }
        if (!document.getElementById('imagePopupModal')?.classList.contains('hidden')) {
            renderPopupCarouselSlots();
        }
        scheduleCloudAutoSync(true);
    },
    startMockTestSession() {
        const count = Math.max(1, Math.min(60, parseInt(document.getElementById('mockQCountInput').value, 10) || 10));
        const mins = Math.max(1, Math.min(240, parseInt(document.getElementById('mockTimeMinsInput').value, 10) || 30));
        const unsolvedOnly = document.getElementById('mockUnsolvedOnlyChk').checked;
        const blindOn = document.getElementById('mockBlindModeChk').checked;

        let pool = getFiltered();
        if (unsolvedOnly) {
            const unsolvedPool = pool.filter(q => !q.solved);
            if (unsolvedPool.length > 0) pool = unsolvedPool;
        }
        if (pool.length === 0) {
            return toast('No questions available in current filter for a mock set!', 'warn');
        }

        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const picked = shuffled.slice(0, Math.min(count, shuffled.length));

        clearInterval(state.mockTest.intervalId);
        state.mockTest.active = true;
        state.mockTest.questionIds = picked.map(q => q.id);
        state.mockTest.totalSec = mins * 60;
        state.mockTest.remainingSec = mins * 60;
        state.mockTest.startedAt = Date.now();
        state.blindModeActive = Boolean(blindOn);
        state.padContextIds = [...state.mockTest.questionIds];

        state.mockTest.intervalId = setInterval(() => {
            if (!state.mockTest.active) return;
            state.mockTest.remainingSec--;
            renderMockTestActiveBar();
            if (state.mockTest.remainingSec <= 0) {
                this.finishMockTest(true);
            }
        }, 1000);

        this.closeMockTestSetupModal();
        renderAll();
        toast(`Launched Mock Set (${picked.length} questions, ${mins} mins)!`, 'success');
        if (!isVerticalScreen()) {
            this.openScratchpad(picked[0].id, true);
        } else {
            this.openImagePopup(picked[0].id, true);
        }
    },
    jumpToMockQuestion(qId) {
        const isWbOpen = !document.getElementById('scratchpadModal')?.classList.contains('hidden');
        const isPopupOpen = !document.getElementById('imagePopupModal')?.classList.contains('hidden');
        if (isWbOpen) this.openScratchpad(qId, true);
        else if (isPopupOpen) this.openImagePopup(qId, true);
        else if (!isVerticalScreen()) this.openScratchpad(qId, true);
        else this.openImagePopup(qId, true);
    },
    finishMockTest(timeUp = false) {
        if (!state.mockTest.active) return;
        clearInterval(state.mockTest.intervalId);
        const qList = state.mockTest.questionIds.map(id => state.questions.find(q => q.id === id)).filter(Boolean);
        const solvedCount = qList.filter(q => q.solved).length;
        const elapsedSec = Math.max(1, state.mockTest.totalSec - Math.max(0, state.mockTest.remainingSec));

        state.mockTest.active = false;
        state.mockTest.questionIds = [];
        state.blindModeActive = false;

        this.closeScratchpad();
        this.closeImagePopup();
        renderAll();

        document.getElementById('mockSummarySubtext').textContent = timeUp ? 'Time Up! Here is your test summary:' : 'Test submitted! Here is your summary:';
        document.getElementById('mockSummaryStatsGrid').innerHTML = `
            <div class="p-3 rounded-2xl m3-surface-high">
                <div class="text-lg font-extrabold" style="color: var(--md-primary)">${solvedCount}/${qList.length}</div>
                <div class="text-[10px] font-bold m3-text-muted uppercase">Marked Solved</div>
            </div>
            <div class="p-3 rounded-2xl m3-surface-high">
                <div class="text-lg font-extrabold font-mono">${formatTimeSeconds(elapsedSec)}</div>
                <div class="text-[10px] font-bold m3-text-muted uppercase">Total Time</div>
            </div>
            <div class="p-3 rounded-2xl m3-surface-high">
                <div class="text-lg font-extrabold font-mono">${formatTimeSeconds(Math.round(elapsedSec / Math.max(1, qList.length)))}</div>
                <div class="text-[10px] font-bold m3-text-muted uppercase">Avg / Question</div>
            </div>
        `;
        document.getElementById('mockTestSummaryModal').classList.remove('hidden');
    },

    pickRandomQuestion() {
        const list = getFiltered();
        if (list.length === 0) return toast('No questions in the current filter.', 'warn');
        const pick = list[Math.floor(Math.random() * list.length)];
        this.openImagePopup(pick.id);
    },

    toggleQuestionTimer() {
        state.timerPaused = !state.timerPaused;
        if (!state.timerPaused && !state.timerInterval) {
            ensureTimerTicking();
        }
        updateTimerUI();
    },
    resetQuestionTimer() {
        const activeId = state.activePadId || state.activePopupId;
        const q = state.questions.find(i => i.id === Number(activeId));
        if (!q) return;
        if (state.blindModeActive) q.reattemptTime = 0;
        else q.timeSpent = 0;
        state.timerPaused = true;
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        updateTimerUI();
        scheduleCloudAutoSync(true);
    },

    stepNumericInput(inputId, delta) {
        const el = document.getElementById(inputId);
        if (!el) return;
        const min = el.min !== '' ? Number(el.min) : -Infinity;
        const max = el.max !== '' ? Number(el.max) : Infinity;
        const curr = Number(el.value) || 0;
        const next = Math.max(min, Math.min(max, curr + Number(delta)));
        el.value = String(next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    handleFeedScroll(el) {
        closeCustomDropdown();
        const fab = document.getElementById('extendedAddPdfFab');
        if (!fab || !el) return;
        const st = el.scrollTop;
        if (st > state.lastScrollTop + 10 && st > 45) {
            fab.classList.add('fab-collapsed');
        } else if (st < state.lastScrollTop - 6 || st < 35) {
            fab.classList.remove('fab-collapsed');
        }
        state.lastScrollTop = Math.max(0, st);
    },

    toggleDrawer(force) {
        closeCustomDropdown();
        const d = document.getElementById('chaptersDrawer');
        const b = document.getElementById('drawerBackdrop');
        const open = typeof force === 'boolean' ? force : d.classList.contains('-translate-x-full');
        d.classList.toggle('-translate-x-full', !open);
        b.classList.toggle('hidden', !open);
    },
    selectSubjectChapter(subj, chap) {
        const changed = state.subject !== subj || state.chapter !== chap;
        state.subject = subj;
        state.chapter = chap;
        this.toggleDrawer(false);
        renderAll();
        if (changed) triggerWorkspacePlaneTransition('ELEVATE');
    },
    setTagFilter(tag) {
        const nextTag = tag || 'ALL';
        const changed = state.tagFilter !== nextTag;
        state.tagFilter = nextTag;
        renderAll();
        if (changed) triggerWorkspacePlaneTransition('ELEVATE');
    },
    setStatus(st) {
        if (state.status === st) return;
        const oldIdx = STATUS_ORDER_INDEX[state.status] ?? 0;
        const newIdx = STATUS_ORDER_INDEX[st] ?? 0;
        const dirMode = newIdx >= oldIdx ? 'RIGHT' : 'LEFT';
        state.status = st;
        renderAll();
        triggerWorkspacePlaneTransition(dirMode);
    },
    setPaper(p) {
        const changed = state.paper !== p;
        state.paper = p;
        renderAll();
        if (changed) triggerWorkspacePlaneTransition('ELEVATE');
    },
    setSearch(v) {
        state.search = v || '';
        document.getElementById('clearSearchBtn')?.classList.toggle('hidden', !state.search.trim());
        renderFeed();
    },
    clearSearch() {
        state.search = '';
        const inp = document.getElementById('searchBox');
        if (inp) inp.value = '';
        document.getElementById('clearSearchBtn')?.classList.add('hidden');
        renderFeed();
    },
    renderDrawerChapters,
    runBackgroundLocalOcrForExistingQuestions,
    runBackgroundAnswerAndHintGenerator,

    setMaterialTheme(hexColor) {
        applyMaterialThemeFromSeed(hexColor, getThemeMode());
        toast(`Applied Material 3 Expressive Theme (${hexColor})`, 'success');
    },
    setThemeMode(mode) {
        applyMaterialThemeFromSeed(localStorage.getItem('jee_m3_seed_color') || '#7c3aed', mode);
        toast(`Switched to Material 3 Expressive ${mode === 'light' ? 'Light' : 'Dark'} Mode`, 'success');
    },

    toggleFullscreen() {
        const icon1 = document.getElementById('fullscreenIcon');
        const icon2 = document.getElementById('wbFullscreenIcon');
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => toast(`Fullscreen error: ${err.message}`, 'warn'));
            if (icon1) icon1.className = 'ph-bold ph-corners-in text-xs';
            if (icon2) icon2.className = 'ph-bold ph-corners-in';
        } else {
            document.exitFullscreen().catch(() => {});
            if (icon1) icon1.className = 'ph-bold ph-corners-out text-xs';
            if (icon2) icon2.className = 'ph-bold ph-corners-out';
        }
    },

    pushToCloudGist,
    pullFromCloudGist,
    handleCloudBadgeClick() {
        if (!getGithubToken()) pullFromCloudGist(true);
        else pushToCloudGist(true);
    },
    toggleVisibility(inputId, iconId) {
        const inp = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (!inp || !icon) return;
        const isPwd = inp.type === 'password';
        inp.type = isPwd ? 'text' : 'password';
        icon.className = isPwd ? 'ph-bold ph-eye-slash text-base' : 'ph-bold ph-eye text-base';
    },
    minimizeUploadModal() {
        if (!state.isExtracting) return;
        closeCustomDropdown();
        state.isUploadMinimized = true;
        document.getElementById('uploadModal').classList.add('hidden');
        const minBar = document.getElementById('minimizedUploadBar');
        if (minBar) {
            minBar.classList.remove('hidden');
            minBar.classList.add('flex');
        }
        if (!waveAnimFrame) waveAnimFrame = requestAnimationFrame(stepAllWavyBars);
        ensureM3MorphLoopRunning();
    },
    onUnifiedFileSelected,
    startUnifiedImportAction() {
        if (state.importMode === 'PDF') {
            startPdfExtraction();
        } else if (state.importMode === 'IMAGE') {
            this.saveImportedImageQuestion();
        }
    },
    cancelPdfExtraction,
    autoDetectImageAngle() {
        if (!state.importRawImg) return;
        const angle = estimateImageSkewAngle(state.importRawImg);
        state.importDeskewAngle = angle;
        document.getElementById('imageDeskewSlider').value = angle;
        updateM3SliderTrack(document.getElementById('imageDeskewSlider'));
        document.getElementById('imageDeskewVal').textContent = `${angle}°`;
        renderDeskewedAndCleanedImage(state.importRawImg, angle, document.getElementById('imageCleanContrastChk').checked);
    },
    updateImageDeskewPreview(val) {
        if (!state.importRawImg) return;
        const angle = val !== undefined ? Number(val) : Number(document.getElementById('imageDeskewSlider').value);
        state.importDeskewAngle = angle;
        document.getElementById('imageDeskewVal').textContent = `${angle.toFixed(1)}°`;
        renderDeskewedAndCleanedImage(state.importRawImg, angle, document.getElementById('imageCleanContrastChk').checked);
    },
    async saveImportedImageQuestion() {
        if (!state.importRawImg || state.isImportingImage) return;
        state.isImportingImage = true;
        const btn = document.getElementById('startExtractBtn');
        const lbl = document.getElementById('startExtractBtnLbl');
        if (btn) btn.disabled = true;
        if (lbl) lbl.textContent = 'Processing...';

        try {
            const workCanvas = renderDeskewedAndCleanedImage(
                state.importRawImg,
                state.importDeskewAngle,
                document.getElementById('imageCleanContrastChk').checked
            );
            const trimmed = autoTrim2DWhitespace(workCanvas);
            const dataUrl = trimmed.toDataURL('image/jpeg', 0.88);
            const base64Jpeg = dataUrl.split(',')[1];

            const paperName = document.getElementById('imgImportPaperInput').value.trim() || 'Imported Images';
            let qNum = document.getElementById('imgImportQNumInput').value.trim();
            let subj = state.subject !== 'ALL' ? state.subject : 'Physics';
            let chap = state.chapter !== 'ALL' ? state.chapter : (JEE_CHAPTERS[subj]?.[0] || 'General');
            let ansKey = '', hintTxt = '';

            if (document.getElementById('imgImportAiClassifyChk').checked && getApiKey()) {
                const aiInfo = await classifyAndSolveImportedImageWithGemini(base64Jpeg);
                if (aiInfo) {
                    if (!qNum && aiInfo.questionNumber) qNum = String(aiInfo.questionNumber).replace(/[^0-9a-zA-Z]/g, '');
                    if (['Physics', 'Chemistry', 'Mathematics'].includes(aiInfo.subject)) subj = aiInfo.subject;
                    if (aiInfo.chapter) chap = aiInfo.chapter;
                    ansKey = aiInfo.answerKey || '';
                    hintTxt = aiInfo.hint || '';
                }
            }

            const ocrTxt = await recognizeImageTextWithTesseract(trimmed);
            const finalQNum = qNum || `${state.questions.length + 1}`;

            state.questions.push({
                id: generateUniqueId(),
                uid: generateQuestionUid(),
                questionNumber: finalQNum,
                subject: subj,
                chapter: chap,
                paperName,
                page: 1,
                imageDataUrl: dataUrl,
                aspectRatio: trimmed.height / (trimmed.width || 1),
                ocrText: ocrTxt || `Q.${finalQNum}`,
                firstLineSnippet: '',
                lastLineSnippet: '',
                hint: hintTxt,
                answerKey: ansKey,
                whiteboardData: null,
                timeSpent: 0,
                reattemptTime: 0,
                noteTag: '',
                eliminatedOptions: [],
                solved: false,
                starred: false,
                isStitched: false,
                continuesToNextPage: false,
                createdAt: Date.now()
            });

            state.isImportingImage = false;
            this.closeUploadModal();
            scheduleCloudAutoSync(false);
            toast(`Added Q.${finalQNum} (${subj} • ${chap})!`, 'success');
        } catch (err) {
            toast('Failed to import image: ' + err.message, 'warn');
        } finally {
            state.isImportingImage = false;
            if (btn) btn.disabled = false;
            if (lbl) lbl.textContent = 'Add Question Image';
        }
    },

    getActivePopupId: () => state.activePopupId,
    navigatePopupQuestion(dir) {
        closeCustomDropdown();
        animatePopupCarouselToNeighbor(dir);
    },
    togglePopupQuestionBool(field, qId = null) {
        const targetId = qId || state.activePopupId;
        const q = state.questions.find(i => i.id === Number(targetId));
        if (!q) return;
        this.toggleQBool(q.id, field);
        renderPopupCarouselSlots();
    },
    async saveSettings(closeModalAfter = true) {
        closeCustomDropdown();
        const key = document.getElementById('apiKeyInput').value.trim();
        const model = getSelectedModel();
        const padTop = Math.max(0, Number(document.getElementById('padTopInput').value) ?? 10);
        const padBottom = Math.max(0, Number(document.getElementById('padBottomInput').value) ?? 10);
        const ghToken = document.getElementById('githubTokenInput').value.trim();
        const autoSync = document.getElementById('cloudAutoSyncCheckbox').checked;
        const autoSolve = document.getElementById('autoSolveHintsCheckbox')?.checked ?? true;

        localStorage.setItem('jee_gemini_api_key', key);
        localStorage.setItem('jee_gemini_model', model);
        localStorage.setItem('jee_pad_top', String(padTop));
        localStorage.setItem('jee_pad_bottom', String(padBottom));
        const localUrlVal = document.getElementById('localAiServerUrlInput')?.value.trim() || '';
        if (window.JEELocalAIBorders?.setServerUrl) window.JEELocalAIBorders.setServerUrl(localUrlVal);
        localStorage.setItem('jee_github_pat', ghToken);
        localStorage.setItem('jee_cloud_autosync', String(autoSync));
        localStorage.setItem('jee_auto_solve_hints', String(autoSolve));

        updateApiKeyIndicator();
        updateCloudStatusUI('idle');
        if (closeModalAfter) this.closeSettingsModal();
        toast('Settings Saved!', 'success');

        if (ghToken) {
            if (state.questions.length === 0) await pullFromCloudGist(true);
            else if (autoSync) scheduleCloudAutoSync();
        }
    },

    toggleQBool(id, field) {
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        q[field] = !q[field];

        const isOverlayOpen = !document.getElementById('scratchpadModal')?.classList.contains('hidden') ||
                              !document.getElementById('imagePopupModal')?.classList.contains('hidden');
        const stillMatches = getFiltered().some(item => item.id === q.id);
        const cardEl = document.querySelector(`article[data-card-id="${q.id}"]`);

        if ((stillMatches || isOverlayOpen) && cardEl) {
            cardEl.style.borderColor = q.starred ? 'var(--md-primary)' : (q.solved ? '#10b981' : 'var(--md-outline-variant)');
            const starBtn = cardEl.querySelector('.card-star-btn');
            const solvedBtn = cardEl.querySelector('.card-solved-btn');
            if (starBtn) {
                starBtn.classList.toggle('active-state', Boolean(q.starred));
                starBtn.innerHTML = `<i class="${q.starred ? 'ph-fill ph-star' : 'ph-bold ph-star'}"></i>`;
            }
            if (solvedBtn) {
                solvedBtn.classList.toggle('active-state', Boolean(q.solved));
                solvedBtn.innerHTML = `<i class="${q.solved ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'}"></i>`;
            }
            scheduleCloudAutoSync(true);
        } else {
            scheduleCloudAutoSync(false);
        }
    },
    updateQField(id, field, val) {
        const q = state.questions.find(i => i.id === Number(id));
        if (!q) return;
        q[field] = val;
        if (field === 'subject') q.chapter = JEE_CHAPTERS[val]?.[0] || 'General';
        if ((field === 'chapter' || field === 'subject') && window.JEELocalVisionEngine?.learnCorrection) {
            const sampleText = `${q.ocrText || ''} ${q.firstLineSnippet || ''} ${q.lastLineSnippet || ''}`.trim();
            if (sampleText) window.JEELocalVisionEngine.learnCorrection(sampleText, q.subject, q.chapter);
        }

        const stillMatches = getFiltered().some(item => item.id === q.id);
        const cardEl = document.querySelector(`article[data-card-id="${q.id}"]`);
        if (stillMatches && cardEl) {
            const subjLbl = cardEl.querySelector('.card-subj-label');
            const chapLbl = cardEl.querySelector('.card-chap-label');
            if (subjLbl) subjLbl.textContent = q.subject === 'Mathematics' ? 'Maths' : q.subject;
            if (chapLbl) chapLbl.textContent = q.chapter;
            scheduleCloudAutoSync(true);
        } else {
            scheduleCloudAutoSync(false);
        }
    },
    deleteQ(id) {
        const numId = Number(id);
        state.questions = state.questions.filter(i => i.id !== numId);
        state.padContextIds = (state.padContextIds || []).filter(cid => cid !== numId);
        delete state.wbBoards[numId];
        scheduleCloudAutoSync();
        toast('Question deleted & syncing to Cloud');
    },
    executeClearVault() {
        const chk = document.getElementById('clearVaultDoubleCheck');
        if (!chk || !chk.checked) return;
        state.questions = [];
        state.wbBoards = {};
        state.padContextIds = [];
        this.closeClearConfirmModal();
        this.toggleDrawer(false);
        scheduleCloudAutoSync(false, true);
        toast('Permanently deleted all questions & synced to Cloud', 'warn');
    },

    runDeduplication(notify = false) {
        const seen = new Set();
        const unique = [];
        let removed = 0;
        for (const q of state.questions) {
            const key = `${(q.paperName || '').toLowerCase()}::${q.subject}::${String(q.questionNumber).trim()}`;
            if (seen.has(key)) removed++;
            else { seen.add(key); unique.push(q); }
        }
        if (removed > 0) { state.questions = unique; scheduleCloudAutoSync(); }
        if (notify) toast(removed > 0 ? `Removed ${removed} duplicate questions!` : 'No duplicate questions found ✓', 'success');
    },

    exportBackupJson,
    importBackupJson,
    
    setSplitMode(m) {
        state.splitMode = m;
        const isSplit = m === 'SPLIT';
        document.getElementById('modeSplitBtn').classList.toggle('active', isSplit);
        document.getElementById('modeTrimBtn').classList.toggle('active', !isSplit);
        document.getElementById('splitRangeWrap').classList.toggle('hidden', !isSplit);
        document.getElementById('trimRangeWrap').classList.toggle('hidden', isSplit);
        document.getElementById('trimRangeWrap').classList.toggle('flex', !isSplit);
        document.getElementById('splitDividerLine').classList.toggle('hidden', !isSplit);
        document.getElementById('trimTopMask').classList.toggle('hidden', isSplit);
        document.getElementById('trimBotMask').classList.toggle('hidden', isSplit);
        document.getElementById('splitConfirmLabel').textContent = isSplit ? 'Split into 2 Questions Now' : 'Save Trimmed Crop';
        this.updateSplitPreview();
        requestAnimationFrame(() => updateAllSegmentedGliders());
    },
    updateSplitPreview() {
        if (state.splitMode === 'SPLIT') {
            const v = document.getElementById('splitCutSlider').value;
            document.getElementById('splitCutVal').textContent = `${v}%`;
            document.getElementById('splitDividerLine').style.top = `${v}%`;
        } else {
            const t = document.getElementById('trimTopSlider').value;
            const b = document.getElementById('trimBotSlider').value;
            document.getElementById('trimTopMask').style.height = `${t}%`;
            document.getElementById('trimBotMask').style.height = `${100 - b}%`;
        }
    },
    async confirmSplitOrTrim() {
        const q = state.questions.find(i => i.id === state.activeSplitId);
        if (!q) return;
        const img = new Image();
        await new Promise(r => { img.onload = r; img.src = q.imageDataUrl; });

        if (state.splitMode === 'SPLIT') {
            const cutY = Math.floor(img.height * (Number(document.getElementById('splitCutSlider').value) / 100));

            const c1Raw = document.createElement('canvas');
            c1Raw.width = img.width; c1Raw.height = cutY;
            c1Raw.getContext('2d').drawImage(img, 0, 0, img.width, cutY, 0, 0, img.width, cutY);
            const c1 = autoTrim2DWhitespace(c1Raw);

            const c2Raw = document.createElement('canvas');
            c2Raw.width = img.width; c2Raw.height = Math.max(20, img.height - cutY);
            c2Raw.getContext('2d').drawImage(img, 0, cutY, img.width, img.height - cutY, 0, 0, img.width, img.height - cutY);
            const c2 = autoTrim2DWhitespace(c2Raw);

            const baseNum = String(q.questionNumber).replace(/[ab]$/i, '');
            q.questionNumber = `${baseNum}a`;
            q.imageDataUrl = c1.toDataURL('image/jpeg', 0.88);
            q.aspectRatio = c1.height / c1.width;
            q.ocrText = '';
            q.hint = '';
            q.answerKey = '';
            q.whiteboardData = null;
            delete state.wbBoards[q.id];

            state.questions.push({
                ...q,
                id: generateUniqueId(),
                uid: generateQuestionUid(),
                questionNumber: `${baseNum}b`,
                imageDataUrl: c2.toDataURL('image/jpeg', 0.88),
                aspectRatio: c2.height / c2.width,
                ocrText: '',
                hint: '',
                answerKey: '',
                whiteboardData: null,
                timeSpent: 0,
                reattemptTime: 0,
                noteTag: '',
                eliminatedOptions: [],
                solved: false,
                createdAt: (q.createdAt || Date.now()) + 1
            });
            scheduleCloudAutoSync();
            toast(`Split into Q.${baseNum}a & Q.${baseNum}b!`, 'success');
            runBackgroundLocalOcrForExistingQuestions(false);
            if (isAutoSolveHintsEnabled() && getApiKey()) runBackgroundAnswerAndHintGenerator(false, false);
        } else {
            const t = Number(document.getElementById('trimTopSlider').value) / 100;
            const b = Number(document.getElementById('trimBotSlider').value) / 100;
            const sy = Math.floor(img.height * t);
            const sh = Math.max(30, Math.floor(img.height * (b - t)));
            const c = document.createElement('canvas');
            c.width = img.width; c.height = sh;
            c.getContext('2d').drawImage(img, 0, sy, img.width, sh, 0, 0, img.width, sh);
            q.imageDataUrl = c.toDataURL('image/jpeg', 0.88);
            q.aspectRatio = c.height / c.width;
            delete state.wbBoards[q.id];
            scheduleCloudAutoSync();
            toast('Saved trimmed vertical crop!', 'success');
        }
        this.closeSplitModal();
    },

    getActivePadId: () => state.activePadId,
    
    togglePadQuestionBool(field) {
        const q = state.questions.find(i => i.id === Number(state.activePadId));
        if (!q) return;
        this.toggleQBool(q.id, field);
        refreshScratchpadTopBarAndHints();
    },
    togglePadHint() {
        state.padShowHint = !state.padShowHint;
        refreshScratchpadTopBarAndHints();
    },
    togglePadAnswer() {
        state.padShowAns = !state.padShowAns;
        refreshScratchpadTopBarAndHints();
    },

    toggleStylusOnlyMode() {
        state.wbStylusOnly = !state.wbStylusOnly;
        localStorage.setItem('jee_wb_stylus_only', String(state.wbStylusOnly));
        document.getElementById('wbStylusOnlyBtn')?.classList.toggle('active-state', state.wbStylusOnly);
        toast(`Stylus-Only Palm Rejection ${state.wbStylusOnly ? 'ON (Finger touches pan only)' : 'OFF'}`, 'info');
    },

    switchWhiteboardPage(delta) {
        if (state.wbIsLoading || state.blindModeActive) return;
        const container = getActiveBoardContainer();
        const currPage = getActiveBoard();
        currPage.scale = state.wbScale;
        currPage.panX = Math.round(state.wbPanX);
        currPage.panY = Math.round(state.wbPanY);

        const targetIdx = (container.currentPage || 0) + delta;
        if (targetIdx < 0 || targetIdx >= container.pages.length) return;
        container.currentPage = targetIdx;
        const nextPage = getActiveBoard();
        state.wbSelectedIds = [];
        state.wbScale = nextPage.scale || 1.0;
        state.wbPanX = nextPage.panX || 0;
        state.wbPanY = nextPage.panY || 0;
        refreshWhiteboardPageIndicator();
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
    },
    addWhiteboardPage() {
        if (state.wbIsLoading || state.blindModeActive) return;
        const container = getActiveBoardContainer();
        const currPage = getActiveBoard();
        currPage.scale = state.wbScale;
        currPage.panX = Math.round(state.wbPanX);
        currPage.panY = Math.round(state.wbPanY);

        container.pages.push({
            items: [],
            undoStack: [],
            redoStack: [],
            scale: 1.0,
            panX: 0,
            panY: 0
        });
        container.currentPage = container.pages.length - 1;
        state.wbSelectedIds = [];
        state.wbScale = 1.0;
        state.wbPanX = 0;
        state.wbPanY = 0;
        refreshWhiteboardPageIndicator();
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
        toast(`Added Whiteboard Page ${container.currentPage + 1}!`, 'success');
    },
    nextOrAddWhiteboardPage() {
        if (state.wbIsLoading || state.blindModeActive) return;
        const container = getActiveBoardContainer();
        if ((container.currentPage || 0) < container.pages.length - 1) {
            this.switchWhiteboardPage(1);
        } else {
            this.addWhiteboardPage();
        }
    },
    deleteCurrentWhiteboardPage() {
        if (state.wbIsLoading || state.blindModeActive) return;
        const container = getActiveBoardContainer();
        if (container.pages.length <= 1) return;
        const delIdx = container.currentPage || 0;
        if (delIdx === 0) {
            return toast('Page 1 holds the base question (use Clear Ink instead).', 'warn');
        }
        container.pages.splice(delIdx, 1);
        container.currentPage = Math.max(0, delIdx - 1);
        const activePage = getActiveBoard();
        state.wbSelectedIds = [];
        state.wbScale = activePage.scale || 1.0;
        state.wbPanX = activePage.panX || 0;
        state.wbPanY = activePage.panY || 0;
        refreshWhiteboardPageIndicator();
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
        toast('Deleted Whiteboard page.', 'info');
    },

    toggleWhiteboardDarkCanvas() {
        state.wbDarkCanvas = !state.wbDarkCanvas;
        localStorage.setItem('jee_wb_dark_canvas', String(state.wbDarkCanvas));
        document.getElementById('wbDarkCanvasBtn')?.classList.toggle('active-state', state.wbDarkCanvas);
        renderWhiteboardCanvas();
        toast(`Whiteboard Night Mode ${state.wbDarkCanvas ? 'ON' : 'OFF'}`, 'info');
    },

    toggleFormulaDrawer(force) {
        const drawer = document.getElementById('wbFormulaDrawer');
        const btn = document.getElementById('wbFormulaDrawerBtn');
        if (!drawer) return;
        const open = typeof force === 'boolean' ? force : drawer.classList.contains('hidden');
        drawer.classList.toggle('hidden', !open);
        drawer.classList.toggle('flex', open);
        btn?.classList.toggle('active-state', open);
    },

    toggleBlindReattemptMode() {
        if (state.wbIsLoading) return;
        if (!state.blindModeActive) {
            syncActiveBoardToQuestionGist(true);
            state.blindModeActive = true;
            state.padShowHint = false;
            state.padShowAns = false;
            state.wbSelectedIds = [];
            state.wbScale = 1.0;
            state.wbPanX = 0;
            state.wbPanY = 0;
            initQuestionTimerIdle();
            toast('Blind Re-Attempt Mode ON: Previous work hidden & fresh timer ready!', 'info');
        } else {
            state.blindModeActive = false;
            const activePage = getActiveBoard();
            state.wbSelectedIds = [];
            state.wbScale = activePage.scale || 1.0;
            state.wbPanX = activePage.panX || 0;
            state.wbPanY = activePage.panY || 0;
            initQuestionTimerIdle();
            toast('Exited Blind Mode: Original rough work restored.', 'info');
        }
        refreshScratchpadTopBarAndHints();
        renderWhiteboardCanvas();
    },
    commitBlindWorkToMainBoard() {
        if (!state.blindModeActive) return;
        const container = getActiveBoardContainer();
        container.pages = [{
            items: cloneBoardItems(container.blindPage.items),
            undoStack: [],
            redoStack: [],
            scale: state.wbScale,
            panX: Math.round(state.wbPanX),
            panY: Math.round(state.wbPanY)
        }];
        container.currentPage = 0;
        state.blindModeActive = false;
        refreshScratchpadTopBarAndHints();
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist(true);
        toast('Saved re-attempt rough work as your main board!', 'success');
    },

    async solveActivePadQuestionNow() {
        const q = state.questions.find(i => i.id === Number(state.activePadId));
        if (!q) return;
        if (!getApiKey()) {
            this.openSettingsModal(true, 'KEYS');
            return toast('Please save your Gemini API Key first!', 'warn');
        }
        const btnLbl = document.getElementById('padSolveNowBtnLabel');
        if (btnLbl) btnLbl.textContent = `Solving with ${getSelectedModel()}...`;
        try {
            const res = await fetchSingleQuestionAnswerAndHint(
                q,
                null,
                (m, t) => appendSolverLog(m, t)
            );
            if (res && res.answerKey) {
                q.answerKey = res.answerKey;
                q.hint = res.hint || 'Use core conservation laws.';
                state.padShowHint = true;
                state.padShowAns = true;
                refreshScratchpadTopBarAndHints();
                scheduleCloudAutoSync(true);
                toast(`Solved Q.${q.questionNumber}: Ans = ${q.answerKey}`, 'success');
            }
        } catch (err) {
            toast(`Failed to generate hint: ${err.message}`, 'warn');
        } finally {
            if (btnLbl) btnLbl.textContent = 'Generate with Gemini 3.8';
        }
    },
        exportWhiteboardPng() {
        const q = state.questions.find(i => i.id === Number(state.activePadId));
        const canvas = document.getElementById('stylusCanvas');
        if (!canvas || !q) return;

        const outCanvas = document.createElement('canvas');
        outCanvas.width = canvas.width;
        outCanvas.height = canvas.height;
        const oCtx = outCanvas.getContext('2d');
        if (state.wbDarkCanvas) {
            oCtx.filter = 'invert(0.92) hue-rotate(180deg)';
        }
        oCtx.drawImage(canvas, 0, 0);

        const a = document.createElement('a');
        a.href = outCanvas.toDataURL('image/png');
        a.download = `Q${q.questionNumber}-${slugifyRoutePart(q.subject)}-solution.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('Exported Whiteboard PNG!', 'success');
    },
    setWhiteboardTool(tool) {
        if (state.wbIsLoading && tool !== 'PAN') return;
        state.wbTool = tool;
        if (tool !== 'SELECT') state.wbSelectedIds = [];
        document.getElementById('wbToolSelectBtn')?.classList.toggle('active-state', tool === 'SELECT');
        document.getElementById('wbToolCropDupBtn')?.classList.toggle('active-state', tool === 'CROP_DUP');
        document.getElementById('wbToolPenBtn')?.classList.toggle('active-state', tool === 'PEN');
        document.getElementById('wbToolLaserBtn')?.classList.toggle('active-state', tool === 'LASER');
        document.getElementById('wbToolPanBtn')?.classList.toggle('active-state', tool === 'PAN');
        document.getElementById('eraserBtn')?.classList.toggle('active-state', tool === 'ERASER');
        const canvas = document.getElementById('stylusCanvas');
        if (canvas) {
            canvas.style.cursor = tool === 'PAN' ? 'grab' : (tool === 'ERASER' ? 'cell' : (tool === 'SELECT' ? 'default' : 'crosshair'));
        }
        renderWhiteboardCanvas();
    },
    cycleWhiteboardGrid() {
        const modes = ['DOTS', 'GRID', 'BLANK'];
        const nextIdx = (modes.indexOf(state.wbGridMode) + 1) % modes.length;
        state.wbGridMode = modes[nextIdx];
        renderWhiteboardCanvas();
    },
    insertPresetShape(shapeType) {
        if (state.wbIsLoading) return;
        const wrap = document.getElementById('padCanvasWrap');
        if (!wrap) return;
        const cx = (wrap.clientWidth * 0.65 - state.wbPanX) / state.wbScale;
        const cy = (wrap.clientHeight * 0.45 - state.wbPanY) / state.wbScale;
        const pts = createPresetShapePoints(shapeType, cx, cy);
        if (!pts) return;

        pushBoardUndoState();
        const board = getActiveBoard();
        const newItem = {
            id: generateUniqueId(),
            type: 'STROKE',
            groupId: null,
            color: state.inkColor,
            width: state.strokeWidth,
            rotation: 0,
            points: pts
        };
        board.items.push(newItem);
        state.wbSelectedIds = [newItem.id];
        this.setWhiteboardTool('SELECT');
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
    },
    rotateSelectedWhiteboardItems(deltaDeg) {
        if (state.wbIsLoading || state.wbSelectedIds.length === 0) return;
        const bounds = getCombinedSelectedBounds();
        if (!bounds) return;
        pushBoardUndoState();
        const board = getActiveBoard();
        const selectedItems = board.items.filter(it => state.wbSelectedIds.includes(it.id));
        const pivotX = (bounds.minX + bounds.maxX) / 2;
        const pivotY = (bounds.minY + bounds.maxY) / 2;
        applyRotationDeltaToItems(selectedItems, pivotX, pivotY, Number(deltaDeg) || 0);
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
    },
    resetSelectedWhiteboardRotation() {
        if (state.wbIsLoading || state.wbSelectedIds.length === 0) return;
        const board = getActiveBoard();
        const selectedItems = board.items.filter(it => state.wbSelectedIds.includes(it.id));
        if (!selectedItems.some(it => Math.abs(Number(it.rotation) || 0) > 0.05)) return;

        pushBoardUndoState();
        const bounds = getCombinedSelectedBounds();
        const pivotX = bounds ? (bounds.minX + bounds.maxX) / 2 : 0;
        const pivotY = bounds ? (bounds.minY + bounds.maxY) / 2 : 0;

        for (const it of selectedItems) {
            const currRot = Number(it.rotation) || 0;
            if (Math.abs(currRot) <= 0.05) continue;
            if (it.type === 'IMAGE') {
                if (selectedItems.length > 1 && bounds) {
                    const icx = it.x + it.w / 2, icy = it.y + it.h / 2;
                    const unrotC = rotatePointAround(icx, icy, pivotX, pivotY, -currRot);
                    it.x = unrotC.x - it.w / 2;
                    it.y = unrotC.y - it.h / 2;
                }
                it.rotation = 0;
            } else if (it.type === 'STROKE' && Array.isArray(it.points)) {
                const b = getItemBounds(it);
                const scx = selectedItems.length > 1 && bounds ? pivotX : ((b.minX + b.maxX) / 2);
                const scy = selectedItems.length > 1 && bounds ? pivotY : ((b.minY + b.maxY) / 2);
                it.points = it.points.map(p => rotatePointAround(p.x, p.y, scx, scy, -currRot));
                it.rotation = 0;
            }
        }
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
    },
    groupSelectedWhiteboardItems() {
        if (state.wbIsLoading) return;
        const board = getActiveBoard();
        if (state.wbSelectedIds.length < 2) return;
        pushBoardUndoState();
        const newGroupId = 'grp_' + generateUniqueId();
        for (const it of board.items) {
            if (state.wbSelectedIds.includes(it.id)) {
                it.groupId = newGroupId;
            }
        }
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
        toast(`Grouped ${state.wbSelectedIds.length} objects together!`, 'success');
    },
    ungroupSelectedWhiteboardItems() {
        if (state.wbIsLoading) return;
        const board = getActiveBoard();
        pushBoardUndoState();
        for (const it of board.items) {
            if (state.wbSelectedIds.includes(it.id)) {
                it.groupId = null;
            }
        }
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
        toast('Ungrouped selected objects', 'info');
    },
    duplicateSelectedWhiteboardItem() {
        if (state.wbIsLoading) return;
        const board = getActiveBoard();
        if (state.wbSelectedIds.length === 0) return;
        pushBoardUndoState();
        const offset = 28 / state.wbScale;
        const newGroupMap = new Map();
        const newSelectedIds = [];

        for (const id of state.wbSelectedIds) {
            const orig = board.items.find(it => it.id === id);
            if (!orig) continue;
            let newGroupId = null;
            if (orig.groupId) {
                if (!newGroupMap.has(orig.groupId)) newGroupMap.set(orig.groupId, 'grp_' + generateUniqueId());
                newGroupId = newGroupMap.get(orig.groupId);
            }
            const newId = generateUniqueId();
            newSelectedIds.push(newId);

            if (orig.type === 'IMAGE') {
                board.items.push({
                    ...orig,
                    id: newId,
                    isOriginalQ: false,
                    groupId: newGroupId,
                    rotation: Number(orig.rotation) || 0,
                    x: orig.x + offset,
                    y: orig.y + offset
                });
            } else if (orig.type === 'STROKE') {
                board.items.push({
                    ...orig,
                    id: newId,
                    groupId: newGroupId,
                    rotation: Number(orig.rotation) || 0,
                    points: orig.points.map(p => ({ x: p.x + offset, y: p.y + offset }))
                });
            }
        }
        state.wbSelectedIds = newSelectedIds;
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
        toast('Duplicated selection!', 'success');
    },
    deleteSelectedWhiteboardItem() {
        if (state.wbIsLoading) return;
        const board = getActiveBoard();
        if (state.wbSelectedIds.length === 0) return;
        const deletableIds = state.wbSelectedIds.filter(id => {
            const it = board.items.find(i => i.id === id);
            if (it && it.isOriginalQ && board.items.filter(x => x.type === 'IMAGE').length <= 1) {
                toast('Original question stays on board (duplicate it first if you want copies!)', 'info');
                return false;
            }
            return true;
        });
        if (deletableIds.length === 0) return;
        pushBoardUndoState();
        board.items = board.items.filter(it => !deletableIds.includes(it.id));
        state.wbSelectedIds = [];
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
    },
    toggleAutoShape() {
        if (state.wbIsLoading) return;
        state.wbAutoShape = !state.wbAutoShape;
        document.getElementById('wbAutoShapeBtn')?.classList.toggle('active-state', state.wbAutoShape);
        toast(`Auto-Shape Recognition ${state.wbAutoShape ? 'ON' : 'OFF'}`, 'info');
    },
    setInk(color) {
        if (state.wbIsLoading) return;
        state.inkColor = color;
        const dot = document.getElementById('activeInkColorDot');
        if (dot) dot.style.background = color;
        if (state.wbSelectedIds.length > 0) {
            const board = getActiveBoard();
            let changed = false;
            for (const id of state.wbSelectedIds) {
                const st = board.items.find(i => i.id === id && i.type === 'STROKE');
                if (st) { st.color = color; changed = true; }
            }
            if (changed) {
                renderWhiteboardCanvas();
                syncActiveBoardToQuestionGist();
                return;
            }
        }
        if (state.wbTool === 'ERASER' || state.wbTool === 'PAN' || state.wbTool === 'LASER') {
            this.setWhiteboardTool('PEN');
        }
    },
    setStrokeWidth(w) {
        if (state.wbIsLoading) return;
        state.strokeWidth = Number(w) || 3.5;
        if (state.wbSelectedIds.length > 0) {
            const board = getActiveBoard();
            for (const id of state.wbSelectedIds) {
                const st = board.items.find(i => i.id === id && i.type === 'STROKE');
                if (st) st.width = state.strokeWidth;
            }
            renderWhiteboardCanvas();
            syncActiveBoardToQuestionGist();
        }
    },
    whiteboardUndo() {
        if (state.wbIsLoading) return;
        const board = getActiveBoard();
        if (board.undoStack.length === 0) return;
        board.redoStack.push(cloneBoardItems(board.items));
        board.items = board.undoStack.pop();
        state.wbSelectedIds = [];
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
    },
    whiteboardRedo() {
        if (state.wbIsLoading) return;
        const board = getActiveBoard();
        if (board.redoStack.length === 0) return;
        board.undoStack.push(cloneBoardItems(board.items));
        board.items = board.redoStack.pop();
        state.wbSelectedIds = [];
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist();
    },
    clearInk() {
        if (state.wbIsLoading) return;
        const q = state.questions.find(i => i.id === Number(state.activePadId));
        const board = getActiveBoard();
        pushBoardUndoState();
        const origQ = board.items.find(it => it.isOriginalQ);
        if (origQ && origQ.imgEl && q) {
            const defItem = createDefaultQuestionImageItem(q, origQ.imgEl);
            origQ.x = defItem.x;
            origQ.y = defItem.y;
            origQ.w = defItem.w;
            origQ.h = defItem.h;
            origQ.rotation = 0;
        }
        board.items = origQ ? [origQ] : [];
        state.wbSelectedIds = [];
        state.wbScale = 1.0;
        state.wbPanX = 0;
        state.wbPanY = 0;
        renderWhiteboardCanvas();
        syncActiveBoardToQuestionGist(true);
    },
    zoomWhiteboard(delta) {
        const wrap = document.getElementById('padCanvasWrap');
        if (!wrap) return;
        const cx = wrap.clientWidth / 2, cy = wrap.clientHeight / 2;
        const wx = (cx - state.wbPanX) / state.wbScale;
        const wy = (cy - state.wbPanY) / state.wbScale;
        state.wbScale = Math.max(0.2, Math.min(5.0, +(state.wbScale + delta).toFixed(2)));
        state.wbPanX = cx - wx * state.wbScale;
        state.wbPanY = cy - wy * state.wbScale;
        renderWhiteboardCanvas();
    },
    resetWhiteboardView() {
        state.wbScale = 1.0;
        state.wbPanX = 0;
        state.wbPanY = 0;
        renderWhiteboardCanvas();
    }
};
window.addEventListener('paste', (e) => {
    const tag = (e.target?.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;

    const items = e.clipboardData?.items || [];
    for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (!blob) continue;
            e.preventDefault();

            // If Whiteboard is open, paste image directly onto the active Whiteboard page!
            const isWbOpen = !document.getElementById('scratchpadModal')?.classList.contains('hidden');
            if (isWbOpen && !state.wbIsLoading) {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result;
                    const img = new Image();
                    img.onload = () => {
                        pushBoardUndoState();
                        const board = getActiveBoard();
                        const w = Math.min(360, img.width);
                        const h = Math.round(w * (img.height / (img.width || 1)));
                        const newItem = {
                            id: generateUniqueId(),
                            type: 'IMAGE',
                            isOriginalQ: false,
                            groupId: null,
                            x: (180 - state.wbPanX) / state.wbScale,
                            y: (120 - state.wbPanY) / state.wbScale,
                            w,
                            h,
                            rotation: 0,
                            src: dataUrl,
                            imgEl: img
                        };
                        board.items.push(newItem);
                        state.wbSelectedIds = [newItem.id];
                        window.app.setWhiteboardTool('SELECT');
                        renderWhiteboardCanvas();
                        syncActiveBoardToQuestionGist();
                        toast('Pasted image onto Whiteboard!', 'success');
                    };
                    img.src = dataUrl;
                };
                reader.readAsDataURL(blob);
                return;
            }

            // Otherwise open the Image Import modal
            window.app.openUploadModal(blob);
            break;
        }
    }
});


window.addEventListener('hashchange', () => {
    checkAndOpenQuestionFromUrlHash();
});

window.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toUpperCase();
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

    if (e.key === 'Escape') {
        window.app.closeCustomDropdown();
        window.app.closeClearConfirmModal();
        window.app.closeMockTestSetupModal();
        window.app.closeMockTestSummaryModal();
        window.app.closeSolverModal();
        window.app.toggleFormulaDrawer(false);
        window.app.closeImagePopup();
        window.app.closeSettingsModal();
        if (!state.isExtracting) window.app.closeUploadModal();
        window.app.closeSplitModal();
        return;
    }

    if (isTyping) return;

    const isScratchpadOpen = !document.getElementById('scratchpadModal')?.classList.contains('hidden');
    const isImagePopupOpen = !document.getElementById('imagePopupModal')?.classList.contains('hidden');

    if (e.key === 'ArrowLeft') {
        if (isScratchpadOpen) {
            e.preventDefault();
            window.app.navigatePadQuestion(-1);
            return;
        }
        if (isImagePopupOpen) {
            e.preventDefault();
            window.app.navigatePopupQuestion(-1);
            return;
        }
    }
    if (e.key === 'ArrowRight') {
        if (isScratchpadOpen) {
            e.preventDefault();
            window.app.navigatePadQuestion(1);
            return;
        }
        if (isImagePopupOpen) {
            e.preventDefault();
            window.app.navigatePopupQuestion(1);
            return;
        }
    }

    if ((isScratchpadOpen || isImagePopupOpen) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 's') {
            e.preventDefault();
            if (isScratchpadOpen) window.app.togglePadQuestionBool('solved');
            else window.app.togglePopupQuestionBool('solved');
            return;
        }
        if (k === 'f') {
            e.preventDefault();
            if (isScratchpadOpen) window.app.togglePadQuestionBool('starred');
            else window.app.togglePopupQuestionBool('starred');
            return;
        }
        if (k === 't') {
            e.preventDefault();
            window.app.toggleQuestionTimer();
            return;
        }
        if (isScratchpadOpen && k === 'h') {
            e.preventDefault();
            window.app.togglePadHint();
            return;
        }
        if (isScratchpadOpen && k === 'a') {
            e.preventDefault();
            window.app.togglePadAnswer();
            return;
        }
    }

    if (isScratchpadOpen) {
        if (e.code === 'Space') isSpacePressedGlobal = true;
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.wbSelectedIds.length > 0 && !state.wbIsLoading) {
            e.preventDefault();
            window.app.deleteSelectedWhiteboardItem();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !state.wbIsLoading) {
            e.preventDefault();
            window.app.whiteboardUndo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !state.wbIsLoading) {
            e.preventDefault();
            window.app.whiteboardRedo();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') isSpacePressedGlobal = false;
});

let resizeTimer = null;
window.addEventListener('resize', () => {
    window.app.closeCustomDropdown();
    checkWhiteboardOrientationLock();
    if (!document.getElementById('scratchpadModal').classList.contains('hidden')) {
        renderWhiteboardCanvas();
    }
    if (state.isExtracting && !state.isUploadMinimized) {
        fitExtractPageFrame();
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (!state.isExtracting) renderFeed();
    }, 150);
    updateAllSegmentedGliders();
});
        window.addEventListener('DOMContentLoaded', async () => {
    initM3ExpressiveShapes();
    initM3Ripples();
    initM3Tooltips();
    initM3Sliders();
    initSwipeableStatusSegmentedBar();
    initPopupSwipeNavigation();
    initWhiteboardThreeFingerSwipe();
    applyMaterialThemeFromSeed(
        localStorage.getItem('jee_m3_seed_color') || '#7c3aed',
        localStorage.getItem('jee_m3_theme_mode') || 'dark'
    );
    updateApiKeyIndicator();
    renderAll();
    updateAllSegmentedGliders();
    await pullFromCloudGist(false);
    checkAndOpenQuestionFromUrlHash();
});
