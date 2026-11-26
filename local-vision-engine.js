/**
 * ============================================================================
 * JEE LOCAL VISION, BORDER, CROSS-PAGE STITCH & CHAPTER CLASSIFICATION ENGINE
 * File Name for GitHub: local-vision-engine.js
 * Version: 3.0.0 (Complete Ground-Up Rewrite)
 * ============================================================================
 * 100% Offline, Zero-API Document Intelligence Engine engineered for Indian
 * IIT-JEE / NEET PDFs (Allen, Resonance, BASE, FIITJEE, Cengage, NTA Main &
 * Advanced, DPPs, Sheets, Boxed Tables, Matrix-Match, Multi-Page Splits,
 * Watermarked & Scanned PDFs).
 *
 * Key v3.0 Architectural Upgrades:
 *  1. Document-Level Layout Consensus + Table-Safe Column Split:
 *     Never slices Matrix-Match ("Column-I | Column-II" / "List-I | List-II")
 *     tables vertically into fake 2-column pages, even when tables have wide
 *     internal gaps or vertical ruling lines near x=500.
 *  2. Safe Header & Footer Stripping:
 *     Strictly anchored page-number matching (never deletes questions starting
 *     at y > 895 like "2) A particle..." or standalone "3)"). Preserves bottom-
 *     of-page section banners (e.g. "SECTION-I (ii)") across page breaks.
 *  3. Inline Tall-Object & Top-of-Page Diagram Encapsulation (CCL):
 *     Expands question top boundaries upward to capture baseline-aligned tall
 *     organic chemistry rings/reactions and top-of-page continuation diagrams.
 *     Captures 100% of ink between consecutive anchors with zero arbitrary gap cap.
 *  4. Global Monotonic Sequence Graph Solver (DP / Viterbi):
 *     Supports standalone Allen/Resonance numbers ("1)", "2)", "3)"), explicit
 *     "Q.1", "1.", "(1)", and mid-page / cross-page section resets cleanly.
 *  5. 9-Signal Cross-Column & Cross-Page Lookahead Stitcher:
 *     Detects orphaned options ((B)-(D), (b)-(d), (P)-(S)), unfinished stems,
 *     above-banner continuations, figure splits, and sequence lookahead proofs
 *     while hard-vetoing merging two already-complete MCQ questions.
 *  6. Sticky Answer Key & Solutions Page Cutoff (Optional, Zero-Render):
 *     Skips heavy 2.2x canvas rendering for trailing Answer Key / Solutions
 *     pages; can optionally parse tabular/inline answer keys & concepts.
 *  7. Per-Subject Multi-Layer JEE Chapter Classifier:
 *     Term-frequency weighted 78-chapter lexicon + formula/reagent regexes +
 *     per-subject (Physics/Chemistry/Maths) topic-test coherence prior +
 *     self-learning local Naive Bayes memory.
 *  8. Optional Local ONNX DocLayout-YOLO Adapter (onnxruntime-web).
 * ============================================================================
 */
(function (globalScope) {
    'use strict';

    const ENGINE_VERSION = '3.0.0';
    const STORAGE_FEEDBACK_KEY = 'jee_local_vision_nb_feedback_v1';

    const DEFAULT_CONFIG = {
        renderScale: 2.2,
        normMax: 1000,
        minTextTokensForDigital: 10,
        watermarkLumaCutoff: 192,
        watermarkChromaCutoff: 34,
        watermarkTextDarkCutoff: 135,
        headerBandMaxY: 105,
        footerBandMinY: 942,
        minQuestionHeightNorm: 12,
        verticalGutterMinFactor: 1.55,
        cclGridW: 400,
        deskewMaxDeg: 10,
        enableAnswerKeyCutoff: true,
        enableAnswerKeyParsing: false,
        enablePassageLinking: true,
        enableCrossColumnStitch: true,
        enableCrossPageStitch: true,
        debug: false
    };

    // ========================================================================
    // EXACT JEE CHAPTER TAXONOMY (Synchronized with index.html)
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

    // ========================================================================
    // UTILITY HELPERS
    // ========================================================================
    const Utils = {
        clamp(v, lo, hi) {
            return Math.max(lo, Math.min(hi, v));
        },
        median(arr) {
            if (!arr || arr.length === 0) return 0;
            const s = [...arr].sort((a, b) => a - b);
            const m = Math.floor(s.length / 2);
            return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
        },
        normalizeWhitespace(str) {
            return String(str || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
        },
        normalizeForMatch(str) {
            return String(str || '')
                .toLowerCase()
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/[\u2013\u2014]/g, '-')
                .replace(/\s+/g, ' ')
                .trim();
        },
        parseNumericQ(qStr) {
            const m = String(qStr || '').match(/(\d+)/);
            return m ? parseInt(m[1], 10) : NaN;
        },
        countSubstringHits(haystack, needle, maxCap = 4) {
            if (!haystack || !needle) return 0;
            let count = 0;
            let pos = 0;
            while (count < maxCap) {
                const idx = haystack.indexOf(needle, pos);
                if (idx < 0) break;
                count++;
                pos = idx + needle.length;
            }
            return count;
        },
        boxOverlap1D(a0, a1, b0, b1) {
            return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
        },
        boxIoU(a, b) {
            const ix = this.boxOverlap1D(a.xmin, a.xmax, b.xmin, b.xmax);
            const iy = this.boxOverlap1D(a.ymin, a.ymax, b.ymin, b.ymax);
            const inter = ix * iy;
            if (inter <= 0) return 0;
            const areaA = Math.max(1, (a.xmax - a.xmin) * (a.ymax - a.ymin));
            const areaB = Math.max(1, (b.xmax - b.xmin) * (b.ymax - b.ymin));
            return inter / (areaA + areaB - inter);
        },
        createCanvas(w, h) {
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w));
            c.height = Math.max(1, Math.round(h));
            return c;
        }
    };

    // ========================================================================
    // MODULE 1: WATERMARK-RESISTANT PIXEL VISION & CONNECTED COMPONENTS (CCL)
    // ========================================================================
    const PixelVision = {
        computeAdaptiveOtsuThreshold(lumaArr) {
            const hist = new Uint32Array(256);
            const total = lumaArr.length;
            if (total === 0) return 180;
            for (let i = 0; i < total; i++) hist[lumaArr[i]]++;

            let sumAll = 0;
            for (let t = 0; t < 256; t++) sumAll += t * hist[t];

            let sumB = 0, wB = 0, maxVar = -1, bestT = 180;
            for (let t = 40; t <= 235; t++) {
                wB += hist[t];
                if (wB === 0) continue;
                const wF = total - wB;
                if (wF === 0) break;
                sumB += t * hist[t];
                const mB = sumB / wB;
                const mF = (sumAll - sumB) / wF;
                const between = wB * wF * (mB - mF) * (mB - mF);
                if (between > maxVar) {
                    maxVar = between;
                    bestT = t;
                }
            }
            return Utils.clamp(bestT, 125, 210);
        },

        buildCleanForegroundMask(sourceCanvas, cfg = DEFAULT_CONFIG) {
            const sw = sourceCanvas.width;
            const sh = sourceCanvas.height;
            const scale = Math.min(1, cfg.cclGridW / Math.max(1, sw));
            const gw = Math.max(64, Math.round(sw * scale));
            const gh = Math.max(64, Math.round(sh * scale));

            const tmp = Utils.createCanvas(gw, gh);
            const tCtx = tmp.getContext('2d', { willReadFrequently: true });
            tCtx.fillStyle = '#FFFFFF';
            tCtx.fillRect(0, 0, gw, gh);
            tCtx.drawImage(sourceCanvas, 0, 0, gw, gh);

            const rgba = tCtx.getImageData(0, 0, gw, gh).data;
            const luma = new Uint8Array(gw * gh);
            const chroma = new Uint8Array(gw * gh);

            let veryDarkCount = 0;
            for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
                const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
                const y = (r * 77 + g * 150 + b * 29) >> 8;
                const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
                const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
                luma[p] = y;
                chroma[p] = mx - mn;
                if (y < cfg.watermarkTextDarkCutoff) veryDarkCount++;
            }

            const otsuT = this.computeAdaptiveOtsuThreshold(luma);
            const hasCrispDarkText = veryDarkCount > gw * gh * 0.003;
            const effectiveT = hasCrispDarkText ? Math.min(otsuT, cfg.watermarkLumaCutoff) : Math.min(otsuT + 14, 220);

            const mask = new Uint8Array(gw * gh);
            for (let p = 0; p < mask.length; p++) {
                const y = luma[p];
                const c = chroma[p];
                // Keep colored diagram strokes (e.g. red/blue phase-space axes in Allen PDFs!) while suppressing pale watermarks
                if (hasCrispDarkText && y > 185 && c > cfg.watermarkChromaCutoff) {
                    mask[p] = 0;
                    continue;
                }
                if (hasCrispDarkText && y > 182 && c < 14) {
                    mask[p] = 0;
                    continue;
                }
                mask[p] = (y < effectiveT || (c > 45 && y < 210)) ? 1 : 0;
            }

            // Suppress giant low-fill diagonal coaching watermarks without touching real diagrams or tables
            const preComps = this.extractConnectedComponents(mask, gw, gh, 3);
            for (const comp of preComps) {
                const bwNorm = (comp.maxX - comp.minX + 1) / gw;
                const bhNorm = (comp.maxY - comp.minY + 1) / gh;
                const area = Math.max(1, (comp.maxX - comp.minX + 1) * (comp.maxY - comp.minY + 1));
                const fill = comp.pixelCount / area;
                if (bwNorm > 0.48 && bhNorm > 0.38 && fill < 0.065 && !comp.isBorderFrame) {
                    this.clearComponentFromMask(mask, gw, comp, luma, 140);
                }
            }

            return { mask, luma, gw, gh, sw, sh, scale, threshold: effectiveT };
        },

        clearComponentFromMask(mask, gw, comp, luma, keepDarkerThan) {
            for (let y = comp.minY; y <= comp.maxY; y++) {
                const rowOff = y * gw;
                for (let x = comp.minX; x <= comp.maxX; x++) {
                    const idx = rowOff + x;
                    if (mask[idx] && luma[idx] >= keepDarkerThan) {
                        mask[idx] = 0;
                    }
                }
            }
        },

        extractConnectedComponents(mask, gw, gh, minPixels = 3) {
            const labels = new Int32Array(gw * gh);
            const parent = [0];
            let nextLabel = 1;

            const find = (x) => {
                while (parent[x] !== x) {
                    parent[x] = parent[parent[x]];
                    x = parent[x];
                }
                return x;
            };
            const union = (a, b) => {
                const ra = find(a), rb = find(b);
                if (ra !== rb) {
                    if (ra < rb) parent[rb] = ra;
                    else parent[ra] = rb;
                }
            };

            for (let y = 0; y < gh; y++) {
                const rowOff = y * gw;
                const prevOff = (y - 1) * gw;
                for (let x = 0; x < gw; x++) {
                    const idx = rowOff + x;
                    if (!mask[idx]) continue;

                    const nList = [];
                    if (x > 0 && labels[idx - 1]) nList.push(labels[idx - 1]);
                    if (y > 0) {
                        if (x > 0 && labels[prevOff + x - 1]) nList.push(labels[prevOff + x - 1]);
                        if (labels[prevOff + x]) nList.push(labels[prevOff + x]);
                        if (x < gw - 1 && labels[prevOff + x + 1]) nList.push(labels[prevOff + x + 1]);
                    }

                    if (nList.length === 0) {
                        labels[idx] = nextLabel;
                        parent.push(nextLabel);
                        nextLabel++;
                    } else {
                        let minN = nList[0];
                        for (let k = 1; k < nList.length; k++) if (nList[k] < minN) minN = nList[k];
                        labels[idx] = minN;
                        for (let k = 0; k < nList.length; k++) if (nList[k] !== minN) union(minN, nList[k]);
                    }
                }
            }

            const compMap = new Map();
            for (let y = 0; y < gh; y++) {
                const rowOff = y * gw;
                for (let x = 0; x < gw; x++) {
                    const l = labels[rowOff + x];
                    if (!l) continue;
                    const root = find(l);
                    let c = compMap.get(root);
                    if (!c) {
                        c = { minX: x, minY: y, maxX: x, maxY: y, pixelCount: 0 };
                        compMap.set(root, c);
                    }
                    if (x < c.minX) c.minX = x;
                    if (x > c.maxX) c.maxX = x;
                    if (y < c.minY) c.minY = y;
                    if (y > c.maxY) c.maxY = y;
                    c.pixelCount++;
                }
            }

            const out = [];
            for (const c of compMap.values()) {
                if (c.pixelCount < minPixels) continue;
                const xmin = (c.minX / gw) * 1000;
                const xmax = ((c.maxX + 1) / gw) * 1000;
                const ymin = (c.minY / gh) * 1000;
                const ymax = ((c.maxY + 1) / gh) * 1000;
                const wNorm = xmax - xmin;
                const hNorm = ymax - ymin;
                out.push({
                    ...c,
                    xmin, xmax, ymin, ymax,
                    wNorm, hNorm,
                    isBorderFrame: wNorm > 840 && hNorm > 800
                });
            }
            return out;
        },

        detectRulingLinesFromMask(maskObj) {
            const { mask, gw, gh } = maskObj;
            const hLines = [];
            const vLines = [];

            const minHRun = Math.floor(gw * 0.22);
            for (let y = Math.floor(gh * 0.02); y < Math.floor(gh * 0.98); y++) {
                const rowOff = y * gw;
                let runStart = -1, runLen = 0, gap = 0;
                for (let x = 0; x < gw; x++) {
                    const hit = mask[rowOff + x] || (y > 0 && mask[(y - 1) * gw + x]) || (y < gh - 1 && mask[(y + 1) * gw + x]);
                    if (hit) {
                        if (runStart < 0) runStart = x;
                        runLen++;
                        gap = 0;
                    } else if (runStart >= 0 && gap < 2) {
                        gap++;
                        runLen++;
                    } else {
                        if (runLen >= minHRun) {
                            const x0 = (runStart / gw) * 1000;
                            const x1 = ((x - gap) / gw) * 1000;
                            hLines.push({ y: (y / gh) * 1000, xmin: x0, xmax: x1, span: x1 - x0 });
                        }
                        runStart = -1; runLen = 0; gap = 0;
                    }
                }
                if (runLen >= minHRun) {
                    const x0 = (runStart / gw) * 1000;
                    const x1 = ((gw - gap) / gw) * 1000;
                    hLines.push({ y: (y / gh) * 1000, xmin: x0, xmax: x1, span: x1 - x0 });
                }
            }

            hLines.sort((a, b) => a.y - b.y);
            const mergedH = [];
            for (const ln of hLines) {
                const last = mergedH[mergedH.length - 1];
                if (last && Math.abs(last.y - ln.y) < 6 && Utils.boxOverlap1D(last.xmin, last.xmax, ln.xmin, ln.xmax) > 80) {
                    last.y = (last.y + ln.y) / 2;
                    last.xmin = Math.min(last.xmin, ln.xmin);
                    last.xmax = Math.max(last.xmax, ln.xmax);
                    last.span = last.xmax - last.xmin;
                } else {
                    mergedH.push({ ...ln });
                }
            }

            const minVRun = Math.floor(gh * 0.25);
            for (let x = Math.floor(gw * 0.03); x < Math.floor(gw * 0.97); x++) {
                let runStart = -1, runLen = 0, gap = 0;
                for (let y = 0; y < gh; y++) {
                    const hit = mask[y * gw + x] || (x > 0 && mask[y * gw + x - 1]) || (x < gw - 1 && mask[y * gw + x + 1]);
                    if (hit) {
                        if (runStart < 0) runStart = y;
                        runLen++;
                        gap = 0;
                    } else if (runStart >= 0 && gap < 2) {
                        gap++;
                        runLen++;
                    } else {
                        if (runLen >= minVRun) {
                            const y0 = (runStart / gh) * 1000;
                            const y1 = ((y - gap) / gh) * 1000;
                            vLines.push({ x: (x / gw) * 1000, ymin: y0, ymax: y1, span: y1 - y0 });
                        }
                        runStart = -1; runLen = 0; gap = 0;
                    }
                }
                if (runLen >= minVRun) {
                    const y0 = (runStart / gh) * 1000;
                    const y1 = ((gh - gap) / gh) * 1000;
                    vLines.push({ x: (x / gw) * 1000, ymin: y0, ymax: y1, span: y1 - y0 });
                }
            }

            vLines.sort((a, b) => a.x - b.x);
            const mergedV = [];
            for (const ln of vLines) {
                const last = mergedV[mergedV.length - 1];
                if (last && Math.abs(last.x - ln.x) < 6 && Utils.boxOverlap1D(last.ymin, last.ymax, ln.ymin, ln.ymax) > 100) {
                    last.x = (last.x + ln.x) / 2;
                    last.ymin = Math.min(last.ymin, ln.ymin);
                    last.ymax = Math.max(last.ymax, ln.ymax);
                    last.span = last.ymax - last.ymin;
                } else {
                    mergedV.push({ ...ln });
                }
            }

            return { hLines: mergedH, vLines: mergedV };
        },

        estimateSkewAngleFromMask(maskObj, maxDeg = 8) {
            const { mask, gw, gh } = maskObj;
            const cx = gw / 2, cy = gh / 2;
            let bestAngle = 0, bestVar = -1;

            for (let deg = -maxDeg; deg <= maxDeg; deg += 0.5) {
                const rad = (deg * Math.PI) / 180;
                const sinA = Math.sin(rad), cosA = Math.cos(rad);
                const rowCounts = new Int32Array(gh);
                for (let y = 10; y < gh - 10; y += 2) {
                    const rowOff = y * gw;
                    for (let x = 10; x < gw - 10; x += 2) {
                        if (mask[rowOff + x]) {
                            const py = Math.round(cy - (x - cx) * sinA + (y - cy) * cosA);
                            if (py >= 0 && py < gh) rowCounts[py]++;
                        }
                    }
                }
                let variance = 0;
                for (let r = 1; r < gh; r++) {
                    const d = rowCounts[r] - rowCounts[r - 1];
                    variance += d * d;
                }
                if (variance > bestVar) {
                    bestVar = variance;
                    bestAngle = deg;
                }
            }
            return Math.abs(bestAngle) < 0.7 ? 0 : bestAngle;
        },

        deskewCanvasIfNeeded(sourceCanvas, angleDeg) {
            if (!angleDeg || Math.abs(angleDeg) < 0.7) return sourceCanvas;
            const out = Utils.createCanvas(sourceCanvas.width, sourceCanvas.height);
            const ctx = out.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, out.width, out.height);
            ctx.translate(out.width / 2, out.height / 2);
            ctx.rotate((angleDeg * Math.PI) / 180);
            ctx.drawImage(sourceCanvas, -out.width / 2, -out.height / 2);
            return out;
        },

        computeRowInkDensity(maskObj, xminNorm, xmaxNorm) {
            const { mask, gw, gh } = maskObj;
            const x0 = Utils.clamp(Math.floor((xminNorm / 1000) * gw), 0, gw - 1);
            const x1 = Utils.clamp(Math.ceil((xmaxNorm / 1000) * gw), x0 + 1, gw);
            const span = Math.max(1, x1 - x0);
            const density = new Float32Array(gh);
            for (let y = 0; y < gh; y++) {
                let cnt = 0;
                const rowOff = y * gw;
                for (let x = x0; x < x1; x++) if (mask[rowOff + x]) cnt++;
                density[y] = cnt / span;
            }
            return density;
        },

        /**
         * Snaps targetNormY strictly into the cleanest whitespace valley inside [minAllowedNorm..maxAllowedNorm].
         */
        snapYToCleanestValley(maskObj, targetNormY, minAllowedNorm, maxAllowedNorm, xminNorm, xmaxNorm, preferDir = 'UP') {
            if (!maskObj) return Math.round(Utils.clamp(targetNormY, minAllowedNorm, maxAllowedNorm));
            const { gh } = maskObj;
            const density = this.computeRowInkDensity(maskObj, xminNorm, xmaxNorm);
            const safeY = Utils.clamp(targetNormY, minAllowedNorm, maxAllowedNorm);

            const searchUp = preferDir === 'UP' ? 32 : 12;
            const searchDown = preferDir === 'DOWN' ? 32 : 12;
            const loNorm = Math.max(minAllowedNorm, safeY - searchUp);
            const hiNorm = Math.min(maxAllowedNorm, safeY + searchDown);

            const loRow = Utils.clamp(Math.floor((loNorm / 1000) * gh), 1, gh - 2);
            const hiRow = Utils.clamp(Math.ceil((hiNorm / 1000) * gh), loRow + 1, gh - 2);
            const centerRow = Utils.clamp(Math.round((safeY / 1000) * gh), loRow, hiRow);

            const isCleanBand = (r) => density[r] <= 0.0015 && density[r - 1] <= 0.0015 && density[r + 1] <= 0.0015;

            if (preferDir === 'UP') {
                for (let r = centerRow; r >= loRow; r--) {
                    if (isCleanBand(r)) return Math.round((r / gh) * 1000);
                }
                for (let r = centerRow + 1; r <= hiRow; r++) {
                    if (isCleanBand(r)) return Math.round((r / gh) * 1000);
                }
            } else {
                for (let r = centerRow; r <= hiRow; r++) {
                    if (isCleanBand(r)) return Math.round((r / gh) * 1000);
                }
                for (let r = centerRow - 1; r >= loRow; r--) {
                    if (isCleanBand(r)) return Math.round((r / gh) * 1000);
                }
            }

            let bestRow = centerRow, bestScore = Infinity;
            for (let r = loRow; r <= hiRow; r++) {
                const distPenalty = Math.abs(r - centerRow) * 0.0004;
                const score = (density[r - 1] + density[r] * 2 + density[r + 1]) + distPenalty;
                if (score < bestScore) {
                    bestScore = score;
                    bestRow = r;
                }
            }
            return Math.round((bestRow / gh) * 1000);
        }
    };

    // ========================================================================
    // MODULE 2: PDF.JS VECTOR TEXT & SAFE HEADER/FOOTER EXTRACTOR
    // ========================================================================
    const PDFVectorExtractor = {
        async extractPageTokens(page) {
            try {
                const vp = page.getViewport({ scale: 1.0 });
                const pageW = vp.width || 1;
                const pageH = vp.height || 1;
                const textContent = await page.getTextContent();
                const styles = textContent.styles || {};
                const tokens = [];

                for (const item of (textContent.items || [])) {
                    const rawStr = String(item.str || '');
                    if (!rawStr.trim() || !item.transform) continue;
                    const t = item.transform;
                    // Reject rotated diagonal coaching watermark text (12..168 deg)
                    const angleDeg = Math.abs((Math.atan2(t[1] || 0, t[0] || 1) * 180) / Math.PI);
                    if (angleDeg > 12 && angleDeg < 168) continue;

                    const fontH = Math.max(6, Math.hypot(t[2] || 0, t[3] || 10));
                    if (fontH > 42) continue;

                    const xPt = t[4];
                    const baselineY = t[5];
                    const wPt = Math.max(3, item.width || (rawStr.length * fontH * 0.46));

                    const xmin = Utils.clamp((xPt / pageW) * 1000, 0, 1000);
                    const xmax = Utils.clamp(((xPt + wPt) / pageW) * 1000, xmin + 1, 1000);
                    const botNorm = Utils.clamp(((pageH - baselineY + fontH * 0.30) / pageH) * 1000, 0, 1000);
                    const topNorm = Utils.clamp(((pageH - (baselineY + fontH * 1.10)) / pageH) * 1000, 0, botNorm - 1);

                    const fontMeta = styles[item.fontName] || {};
                    const fontFamily = String(fontMeta.fontFamily || item.fontName || '');
                    const isBold = /bold|black|heavy|demi|medi|bx\d/i.test(fontFamily) || /bold|bd|bx/i.test(String(item.fontName || ''));

                    tokens.push({
                        str: rawStr.trim(),
                        xmin, xmax, topNorm, botNorm,
                        yMid: (topNorm + botNorm) / 2,
                        hNorm: botNorm - topNorm,
                        fontH,
                        isBold
                    });
                }
                return tokens;
            } catch (_) {
                return [];
            }
        },

        groupTokensIntoLines(tokens) {
            if (!tokens || tokens.length === 0) return [];
            const heights = tokens.map(t => t.hNorm).filter(h => h > 3 && h < 45);
            const medH = Utils.median(heights) || 12;
            const yTol = Utils.clamp(medH * 0.56, 5.2, 10.5);

            const sorted = [...tokens].sort((a, b) => (a.yMid !== b.yMid ? a.yMid - b.yMid : a.xmin - b.xmin));
            const lines = [];

            for (const tok of sorted) {
                let bestLine = null, bestDist = Infinity;
                for (let i = lines.length - 1; i >= Math.max(0, lines.length - 8); i--) {
                    const ln = lines[i];
                    const d = Math.abs(tok.yMid - ln.yMid);
                    if (d <= yTol && d < bestDist) {
                        bestDist = d;
                        bestLine = ln;
                    }
                }
                if (bestLine) {
                    bestLine.tokens.push(tok);
                    bestLine.xmin = Math.min(bestLine.xmin, tok.xmin);
                    bestLine.xmax = Math.max(bestLine.xmax, tok.xmax);
                    bestLine.topNorm = Math.min(bestLine.topNorm, tok.topNorm);
                    bestLine.botNorm = Math.max(bestLine.botNorm, tok.botNorm);
                    bestLine.yMid = (bestLine.topNorm + bestLine.botNorm) / 2;
                    bestLine.maxFontH = Math.max(bestLine.maxFontH, tok.fontH);
                    if (tok.isBold && tok.xmin < bestLine.xmin + 35) bestLine.startsBold = true;
                } else {
                    lines.push({
                        tokens: [tok],
                        xmin: tok.xmin, xmax: tok.xmax,
                        topNorm: tok.topNorm, botNorm: tok.botNorm,
                        yMid: tok.yMid,
                        maxFontH: tok.fontH,
                        startsBold: Boolean(tok.isBold)
                    });
                }
            }

            for (const ln of lines) {
                ln.tokens.sort((a, b) => a.xmin - b.xmin);
                let built = '';
                for (let i = 0; i < ln.tokens.length; i++) {
                    const cur = ln.tokens[i];
                    if (i > 0) {
                        const prev = ln.tokens[i - 1];
                        if (cur.xmin - prev.xmax > 2.0) built += ' ';
                    }
                    built += cur.str;
                }
                ln.text = Utils.normalizeWhitespace(built);
                ln.firstToken = ln.tokens[0];
                ln.startsBold = Boolean(ln.tokens[0]?.isBold);
            }
            return lines.sort((a, b) => a.topNorm - b.topNorm);
        },

        /**
         * Safe cross-page header/footer stripper.
         * NEVER strips question anchors ("1)", "2)", "3)"), MCQ options ("(A)..(D)"),
         * or PART/SECTION banners even if they sit near the bottom of the page!
         */
        detectDocumentHeaderFooterBands(allPageRawTokens, cfg = DEFAULT_CONFIG) {
            const numPages = allPageRawTokens.length;
            const headerPatterns = new Map();
            const footerPatterns = new Map();

            const canonicalKey = (str) =>
                Utils.normalizeForMatch(str)
                    .replace(/\bpage\s*\d+\s*(?:of\s*\d+)?\b/g, 'page #')
                    .replace(/\b\d+\b/g, '#')
                    .slice(0, 70);

            // Lines that MUST NEVER be deleted as headers/footers
            const PROTECTED_CONTENT_RX = /^(?:(?:Q(?:uestion|\.)?\s*)?\d{1,3}\s*[\.\)]|\([A-Da-d]\)|PART\s+\d|SECTION[\s\-]|EXERCISE|PASSAGE|COMPREHENSION)/i;

            // Strictly anchored standalone page number OR coaching legal footer boilerplate
            const STANDALONE_PAGE_NUM_RX = /^(?:page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|-\s*\d+\s*-|\[\s*\d+\s*\]|\d{1,3})$/i;
            const FOOTER_BOILERPLATE_RX = /^(?:www\.|https?:\/\/|reg\.?\s*&?\s*corp|corporate\s*office|resonance\s*eduventures|allen\s*career\s*institute|fiitjee\s*ltd|base\s*educational|sri\s*chaitanya|narayana|pw\s*vidyapeeth|copyright|all\s*rights\s*reserved|space\s*for\s*rough\s*work|rough\s*work)/i;

            const perPageLines = allPageRawTokens.map(toks => this.groupTokensIntoLines(toks));

            for (const lines of perPageLines) {
                const seenH = new Set();
                const seenF = new Set();
                for (const ln of lines) {
                    if (PROTECTED_CONTENT_RX.test(ln.text)) continue;
                    if (ln.botNorm <= cfg.headerBandMaxY) {
                        const k = canonicalKey(ln.text);
                        if (k.length >= 3 && !seenH.has(k)) {
                            seenH.add(k);
                            headerPatterns.set(k, (headerPatterns.get(k) || 0) + 1);
                        }
                    } else if (ln.topNorm >= cfg.footerBandMinY) {
                        const k = canonicalKey(ln.text);
                        if (k.length >= 2 && !seenF.has(k)) {
                            seenF.add(k);
                            footerPatterns.set(k, (footerPatterns.get(k) || 0) + 1);
                        }
                    }
                }
            }

            // Require repeating on >= 40% of pages (at least 3 pages for >= 5 page PDFs)
            const minRepeat = numPages >= 5 ? Math.max(3, Math.ceil(numPages * 0.40)) : (numPages >= 3 ? 2 : 99);
            const repeatedHeaders = new Set([...headerPatterns.entries()].filter(([, c]) => c >= minRepeat).map(([k]) => k));
            const repeatedFooters = new Set([...footerPatterns.entries()].filter(([, c]) => c >= minRepeat).map(([k]) => k));

            return perPageLines.map((lines, pIdx) => {
                let headerCutY = 0;
                let footerCutY = 1000;
                const headerTexts = [];
                const keptTokens = [];

                for (const ln of lines) {
                    const txt = ln.text.trim();
                    const k = canonicalKey(txt);
                    const isProtected = PROTECTED_CONTENT_RX.test(txt);

                    if (!isProtected && ln.botNorm <= cfg.headerBandMaxY) {
                        if (repeatedHeaders.has(k) || FOOTER_BOILERPLATE_RX.test(txt) || STANDALONE_PAGE_NUM_RX.test(txt)) {
                            headerTexts.push(txt);
                            headerCutY = Math.max(headerCutY, ln.botNorm + 2);
                            continue;
                        }
                    }

                    if (!isProtected && ln.topNorm >= cfg.footerBandMinY) {
                        if (repeatedFooters.has(k) || FOOTER_BOILERPLATE_RX.test(txt) || STANDALONE_PAGE_NUM_RX.test(txt)) {
                            footerCutY = Math.min(footerCutY, ln.topNorm - 2);
                            continue;
                        }
                    }

                    if (pIdx === 0 && ln.botNorm <= 155) {
                        headerTexts.push(txt);
                    }
                    for (const tok of ln.tokens) keptTokens.push(tok);
                }

                return {
                    pageIndex: pIdx,
                    headerCutY: Utils.clamp(headerCutY, 0, 115),
                    footerCutY: Utils.clamp(footerCutY, 938, 1000),
                    headerText: headerTexts.join(' '),
                    tokens: keptTokens
                };
            });
        }
    };

    // ========================================================================
    // MODULE 3: TABLE-SAFE RECURSIVE XY-CUT & MIXED-LAYOUT PARTITIONER
    // ========================================================================
    const LayoutPartitioner = {
        SECTION_BANNER_RX: /^(?:PART|SECTION|SUB[\-\s]?SECTION|EXERCISE|LEVEL|DPP|WORKSHEET|SHEET|MODULE|STAGE|TYPE|CATEGORY)[\s\-\:\.]*(?:[IVX\dA-Z]+)?(?:\s*[\:\-\(\[]|\s+(?:PHYSICS|CHEMISTRY|MATHEMATICS|MATHS|SINGLE|MULTIPLE|INTEGER|NUMERICAL|MATRIX|MATCH|COMPREHENSION|PARAGRAPH|SUBJECTIVE|ASSERTION)|$)/i,
        SUBJECT_ONLY_RX: /^(?:PART[\s\-]*[IVX1-3A-C][\s\:\-]*)?(PHYSICS|CHEMISTRY|MATHEMATICS|MATHS)\s*(?:\(.*?\))?$/i,
        PASSAGE_START_RX: /^(?:PASSAGE|COMPREHENSION|PARAGRAPH|LINKED\s*COMPREHENSION|DIRECTION[S]?\s*FOR)\b.*?(?:Q\.?\s*(\d+)\s*(?:to|\-|&|and)\s*Q?\.?\s*(\d+))?/i,
        ANSWER_KEY_HEADER_RX: /(?:^|\b)(?:ANSWER\s*KEY[S]?|ANSWERS?\s*(?:&|AND)?\s*HINTS?|HINTS?\s*(?:&|AND)?\s*SOLUTIONS?|DETAILED\s*SOLUTIONS?|SOLUTIONS?)\b/i,
        MATRIX_LEFT_RX: /\b(?:COLUMN|LIST)\s*[\-\s]*(?:I|1)\b/i,
        MATRIX_RIGHT_RX: /\b(?:COLUMN|LIST)\s*[\-\s]*(?:II|2)\b/i,

        /**
         * Detects Answer Key & Solutions pages (with sticky continuation across pages).
         */
        detectAnswerKeyPage(lines, fullText, alreadyInPostSection = false, parseValues = false) {
            const topLines = (lines || []).slice(0, 7);
            const hasHeaderLine = topLines.some(l => {
                const t = l.text.trim();
                return t.length <= 60 && this.ANSWER_KEY_HEADER_RX.test(t);
            });

            const solMarkers = (fullText.match(/\b(?:Explain\s*Question|Question\s*Explanation|Final\s*Answer|Concept)\s*:/gi) || []).length;
            const isSolutionBody = solMarkers >= 2;

            const pairMatches = fullText.match(/(?:^|\s)(?:Q\.?\s*)?(\d{1,3})\s*[\.\)\:\-]\s*(?:\(?[A-D](?:\s*,\s*[A-D])*\)?|\d+(?:\.\d+)?)(?=\s|$)/gi) || [];
            const isDenseKeyGrid = pairMatches.length >= 12 && fullText.length / Math.max(1, pairMatches.length) < 35;

            const hasHorizontalKeyTable = lines.some(l => /^Q\.?\s+\d+/.test(l.text)) &&
                lines.some(l => /^(?:A\.?|Ans\.?)\s+(?:\d|[A-D]\b)/i.test(l.text));

            const isPostQuestionPage = Boolean(alreadyInPostSection || hasHeaderLine || isSolutionBody || isDenseKeyGrid || hasHorizontalKeyTable);
            if (!isPostQuestionPage) {
                return { isAnswerKey: false, isSolutionPage: false, parsedAnswers: {}, parsedHints: {} };
            }

            const parsedAnswers = {};
            const parsedHints = {};

            if (parseValues) {
                // 1. Horizontal Allen tables (Q. 1 2 3 ... / A. 12.50 5.00 ...)
                for (let i = 0; i < lines.length - 1; i++) {
                    const qLine = lines[i].text.trim();
                    if (/^Q\.?\s+\d+/i.test(qLine)) {
                        const qNums = qLine.replace(/^Q\.?\s*/i, '').match(/\d{1,3}/g) || [];
                        for (let k = i + 1; k <= Math.min(lines.length - 1, i + 2); k++) {
                            const aLine = lines[k].text.trim();
                            if (/^(?:PART|SECTION|Q\.)/i.test(aLine)) break;
                            const cleanedA = aLine.replace(/^(?:A\.?|Ans\.?)\s*/i, '').trim();
                            const ansTokens = cleanedA.match(/(?:[A-D](?:\s*,\s*[A-D])+|[A-D]\b|-?\d+(?:\.\d+)?)/g) || [];
                            if (ansTokens.length >= Math.max(2, Math.floor(qNums.length * 0.7))) {
                                const count = Math.min(qNums.length, ansTokens.length);
                                for (let c = 0; c < count; c++) {
                                    const qKey = String(parseInt(qNums[c], 10));
                                    if (!parsedAnswers[qKey]) parsedAnswers[qKey] = ansTokens[c].replace(/\s+/g, '');
                                }
                                break;
                            }
                        }
                    }
                }
                // 2. Classic inline pairs
                if (!isSolutionBody) {
                    const pairRx = /(?:^|\s)(?:Q\.?\s*)?(\d{1,3})\s*[\.\)\:\-]\s*(\(?[A-D](?:\s*,\s*[A-D])*\)?|-?\d+(?:\.\d+)?)(?=\s|$)/gi;
                    let m;
                    while ((m = pairRx.exec(fullText)) !== null) {
                        const qn = String(parseInt(m[1], 10));
                        if (!parsedAnswers[qn]) parsedAnswers[qn] = m[2].trim();
                    }
                }
                // 3. Solution-page Concepts & Final Answers
                let activeSolQ = null;
                for (const ln of lines) {
                    const t = ln.text.trim();
                    const startM = t.match(/^(\d{1,3})\s*[\.\)]\s*(?:Explain\s*Question|Question\s*Explanation|Concept|Solution)/i);
                    if (startM) activeSolQ = String(parseInt(startM[1], 10));
                    if (activeSolQ) {
                        const conceptM = t.match(/Concept\s*:\s*(.+)$/i);
                        if (conceptM && !parsedHints[activeSolQ]) parsedHints[activeSolQ] = conceptM[1].trim();
                        const finalAnsM = t.match(/Final\s*Answer\s*:\s*\(?([^)\n]+)\)?/i);
                        if (finalAnsM && !parsedAnswers[activeSolQ]) parsedAnswers[activeSolQ] = finalAnsM[1].trim();
                    }
                }
            }

            return {
                isAnswerKey: true,
                isSolutionPage: isSolutionBody || /SOLUTIONS?/i.test(topLines.map(l => l.text).join(' ')),
                parsedAnswers,
                parsedHints
            };
        },

        /**
         * Computes whether the document as a whole is predominantly 1-Column or 2-Column.
         * Prevents a single Matrix-Match table page in a 1-column test paper from ever being
         * falsely sliced down the middle!
         */
        computeDocumentColumnConsensus(questionPages) {
            let fullWidthProsePages = 0;
            let clearTwoColPages = 0;

            for (const pd of questionPages) {
                const lines = PDFVectorExtractor.groupTokensIntoLines(pd.cleanTokens || pd.rawTokens || []);
                // Full-width prose lines crossing the page center
                const wideProse = lines.filter(l =>
                    l.xmin < 220 && l.xmax > 690 && l.text.length >= 38 &&
                    !this.SECTION_BANNER_RX.test(l.text)
                );
                if (wideProse.length >= 2) {
                    fullWidthProsePages++;
                } else if (lines.length >= 12) {
                    // Check for real question anchors in BOTH left (<220) and right (>490) halves
                    const hasLeftAnchor = lines.some(l => l.xmin < 200 && /^(?:Q\.?\s*\d+|\d{1,3}\s*[\.\)])/i.test(l.text));
                    const hasRightAnchor = lines.some(l => l.xmin > 480 && l.xmin < 640 && /^(?:Q\.?\s*\d+|\d{1,3}\s*[\.\)])/i.test(l.text));
                    if (hasLeftAnchor && hasRightAnchor) clearTwoColPages++;
                }
            }

            const total = Math.max(1, questionPages.length);
            return {
                isPredominantlySingleCol: fullWidthProsePages >= Math.max(1, Math.ceil(total * 0.55)) && clearTwoColPages === 0,
                isPredominantlyTwoCol: clearTwoColPages >= Math.max(1, Math.ceil(total * 0.50)),
                fullWidthProsePages,
                clearTwoColPages
            };
        },

        /**
         * Table-Safe 2-Column Zone Detector.
         * Explicitly rejects Matrix-Match tables ("Column-I | Column-II", "List-I | List-II"),
         * boxed table vertical dividers intersected by horizontal borders, and zones whose
         * right half contains only short table cells without real question anchors or prose.
         */
        detectZoneColumnSplit(tokensInZone, maskObj, rulingLines, ymin, ymax, docConsensus, cfg = DEFAULT_CONFIG) {
            const zoneH = Math.max(1, ymax - ymin);
            const zoneLines = PDFVectorExtractor.groupTokensIntoLines(tokensInZone);

            // VETO 1: Full-width prose lines crossing the center band [420..580] inside this zone
            const crossingProseCount = zoneLines.filter(l =>
                l.xmin < 360 && l.xmax > 640 && l.text.length >= 30 &&
                !this.MATRIX_LEFT_RX.test(l.text) && !this.MATRIX_RIGHT_RX.test(l.text)
            ).length;
            if (crossingProseCount >= 2) {
                return { isTwoColumn: false, gutterX: 500, reason: 'veto-full-width-prose' };
            }

            // VETO 2: Matrix-Match Table Check ("Column-I" + "Column-II" or "List-I" + "List-II" in same zone)
            const hasMatrixLeft = zoneLines.some(l => this.MATRIX_LEFT_RX.test(l.text));
            const hasMatrixRight = zoneLines.some(l => this.MATRIX_RIGHT_RX.test(l.text));
            const hasMatrixMatch = hasMatrixLeft && hasMatrixRight;

            // Helper: checks if candidate gutterX splits a genuine 2-column question zone vs a table
            const validateCandidateGutter = (gutterX) => {
                if (hasMatrixMatch) {
                    // Only allow 2-col on a page with Matrix-Match if there are genuine question anchors
                    // in the RIGHT half (x in [gutterX..gutterX+110]) AND the right half reaches the right margin (xmax > 800)!
                    const rightTokens = tokensInZone.filter(t => t.xmin >= gutterX - 2);
                    const rightLines = PDFVectorExtractor.groupTokensIntoLines(rightTokens);
                    const rightAnchors = rightLines.filter(l =>
                        l.xmin <= gutterX + 95 && /^(?:Q\.?\s*\d+|\d{1,3}\s*[\.\)])/i.test(l.text)
                    );
                    const rightWide = rightLines.filter(l => l.xmax > 820 && (l.xmax - l.xmin) > 220);
                    if (rightAnchors.length === 0 || rightWide.length < 2) return false;
                }

                if (tokensInZone.length >= cfg.minTextTokensForDigital) {
                    const leftToks = tokensInZone.filter(t => (t.xmin + t.xmax) / 2 < gutterX);
                    const rightToks = tokensInZone.filter(t => (t.xmin + t.xmax) / 2 > gutterX);
                    const leftLines = PDFVectorExtractor.groupTokensIntoLines(leftToks);
                    const rightLines = PDFVectorExtractor.groupTokensIntoLines(rightToks);

                    if (leftLines.length < 3 || rightLines.length < 3) return false;

                    // Check if right-half lines are actually wide prose or question anchors (not narrow table cells!)
                    const rightAnchors = rightLines.filter(l =>
                        l.xmin <= gutterX + 95 && /^(?:Q\.?\s*\d+|\d{1,3}\s*[\.\)])(?:\s|$)/i.test(l.text)
                    );
                    const rightProse = rightLines.filter(l => (l.xmax - l.xmin) > 200 && l.text.length >= 25);

                    // If the document is predominantly 1-column, require STRONG proof (real question anchor in right column + wide prose)
                    if (docConsensus?.isPredominantlySingleCol) {
                        if (rightAnchors.length === 0 || rightProse.length < 2) return false;
                    } else {
                        // Even on a single-page PDF, reject narrow table columns (like Column-II of Match-the-Following)
                        const maxRightX = Math.max(...rightLines.map(l => l.xmax), 0);
                        if (rightAnchors.length === 0 && (rightProse.length < 2 || maxRightX < 760)) {
                            return false;
                        }
                    }
                }
                return true;
            };

            // 1. Check explicit vertical center divider rule (ONLY if NOT crossed by horizontal table lines!)
            for (const v of (rulingLines.vLines || [])) {
                if (v.x >= 445 && v.x <= 555) {
                    const overlap = Utils.boxOverlap1D(v.ymin, v.ymax, ymin, ymax);
                    if (overlap >= zoneH * 0.42) {
                        // Reject table borders: count horizontal ruling lines crossing right through v.x
                        const crossingHRules = (rulingLines.hLines || []).filter(h =>
                            h.y >= v.ymin - 12 && h.y <= v.ymax + 12 &&
                            h.xmin < v.x - 14 && h.xmax > v.x + 14
                        ).length;
                        if (crossingHRules >= 2) continue; // It's a table divider, NOT a 2-column page divider!

                        const gx = Math.round(v.x);
                        if (validateCandidateGutter(gx)) {
                            return { isTwoColumn: true, gutterX: gx, reason: 'vertical-rule' };
                        }
                    }
                }
            }

            // 2. Token-based XY-Cut vertical whitespace gutter in [440..560]
            if (tokensInZone.length >= cfg.minTextTokensForDigital) {
                const medH = Utils.median(tokensInZone.map(t => t.hNorm)) || 12;
                const minGutterWidth = Math.max(16, medH * cfg.verticalGutterMinFactor);

                const colCounts = new Int32Array(1001);
                for (const t of tokensInZone) {
                    const x0 = Utils.clamp(Math.floor(t.xmin), 0, 1000);
                    const x1 = Utils.clamp(Math.ceil(t.xmax), 0, 1000);
                    for (let x = x0; x <= x1; x++) colCounts[x]++;
                }

                let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
                const maxCrossing = Math.max(0, Math.floor(tokensInZone.length * 0.01));
                for (let x = 440; x <= 560; x++) {
                    if (colCounts[x] <= maxCrossing) {
                        if (curStart < 0) curStart = x;
                        curLen++;
                        if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
                    } else {
                        curStart = -1; curLen = 0;
                    }
                }

                if (bestLen >= minGutterWidth) {
                    const gutterX = Math.round(bestStart + bestLen / 2);
                    if (validateCandidateGutter(gutterX)) {
                        return { isTwoColumn: true, gutterX, reason: 'xy-cut-token-gutter' };
                    }
                }
            }

            // 3. Pixel-based vertical gutter fallback (ONLY for scanned image-only PDFs with zero text layer)
            if (tokensInZone.length < cfg.minTextTokensForDigital && maskObj && !docConsensus?.isPredominantlySingleCol) {
                const { mask, gw, gh } = maskObj;
                const y0 = Utils.clamp(Math.floor((ymin / 1000) * gh), 0, gh - 1);
                const y1 = Utils.clamp(Math.ceil((ymax / 1000) * gh), y0 + 1, gh);
                const hSpan = Math.max(1, y1 - y0);

                const xStart = Math.floor(gw * 0.45);
                const xEnd = Math.ceil(gw * 0.55);
                let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
                for (let x = xStart; x <= xEnd; x++) {
                    let ink = 0;
                    for (let y = y0; y < y1; y++) if (mask[y * gw + x]) ink++;
                    if (ink / hSpan < 0.008) {
                        if (curStart < 0) curStart = x;
                        curLen++;
                        if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
                    } else {
                        curStart = -1; curLen = 0;
                    }
                }

                if (bestLen >= Math.max(5, gw * 0.02)) {
                    let leftInk = 0, rightInk = 0;
                    const gx = Math.round(bestStart + bestLen / 2);
                    for (let y = y0; y < y1; y += 2) {
                        for (let x = Math.floor(gw * 0.08); x < gx - 4; x += 2) if (mask[y * gw + x]) leftInk++;
                        for (let x = gx + 4; x < Math.floor(gw * 0.92); x += 2) if (mask[y * gw + x]) rightInk++;
                    }
                    if (leftInk > 100 && rightInk > 100) {
                        return { isTwoColumn: true, gutterX: Math.round((gx / gw) * 1000), reason: 'xy-cut-pixel-gutter' };
                    }
                }
            }

            return { isTwoColumn: false, gutterX: 500, reason: 'single-column' };
        },

        /**
         * Partitions a page into ordered reading zones around PART/SECTION banners,
         * properly carrying pending bottom-of-page banners into the next page!
         */
        partitionPageIntoReadingZones(tokens, maskObj, rulingLines, headerCutY, footerCutY, docConsensus, pageNum, carryState, cfg = DEFAULT_CONFIG) {
            const bodyTokens = tokens.filter(t => t.botNorm > headerCutY && t.topNorm < footerCutY);
            const allLines = PDFVectorExtractor.groupTokensIntoLines(bodyTokens);

            const splitBands = [];
            for (const ln of allLines) {
                const txt = ln.text.trim();
                const center = (ln.xmin + ln.xmax) / 2;
                const isCentered = Math.abs(center - 500) < 160;
                const crossesMiddle = ln.xmin < 420 && ln.xmax > 580;
                const isShortHeader = txt.length <= 48;

                if ((crossesMiddle || isCentered || isShortHeader) &&
                    (this.SECTION_BANNER_RX.test(txt) || this.SUBJECT_ONLY_RX.test(txt))) {
                    const subjMatch = txt.match(/\b(PHYSICS|CHEMISTRY|MATHEMATICS|MATHS)\b/i);
                    const detectedSubject = subjMatch
                        ? (/MATH/i.test(subjMatch[1]) ? 'Mathematics' : (subjMatch[1][0].toUpperCase() + subjMatch[1].slice(1).toLowerCase()))
                        : null;
                    splitBands.push({
                        type: 'SECTION_BANNER',
                        ymin: Math.max(headerCutY, ln.topNorm - 4),
                        ymax: Math.min(footerCutY, ln.botNorm + 4),
                        text: txt,
                        subjectOverride: detectedSubject
                    });
                }
            }

            const ySlices = [];
            let curY = headerCutY;
            let hasBannerAbove = Boolean(carryState.pendingSectionBanner);
            carryState.pendingSectionBanner = false;

            for (let bIdx = 0; bIdx < splitBands.length; bIdx++) {
                const b = splitBands[bIdx];
                if (b.ymin - curY >= 24) {
                    // On Page 1, ignore institute title/date/code header sitting above the very first PART/SECTION banner
                    const isPage1TitleHeader = (pageNum === 1 && curY === headerCutY && bIdx === 0);
                    if (!isPage1TitleHeader) {
                        ySlices.push({
                            ymin: curY,
                            ymax: b.ymin,
                            subjectOverride: carryState.runningSubject,
                            startsAfterSectionBanner: hasBannerAbove,
                            followedBySectionBanner: true
                        });
                    }
                }
                if (b.subjectOverride) carryState.runningSubject = b.subjectOverride;
                hasBannerAbove = true;
                curY = b.ymax;
            }

            // Remaining slice below the last section banner
            const remainingLines = allLines.filter(l => l.yMid >= curY && l.yMid <= footerCutY);
            if (footerCutY - curY >= 24 && (remainingLines.length > 0 || splitBands.length === 0)) {
                ySlices.push({
                    ymin: curY,
                    ymax: footerCutY,
                    subjectOverride: carryState.runningSubject,
                    startsAfterSectionBanner: hasBannerAbove,
                    followedBySectionBanner: false
                });
            } else if (splitBands.length > 0) {
                // Banner sat alone at the bottom of the page (e.g. Page 10 & Page 15 "SECTION-I (ii)")!
                carryState.pendingSectionBanner = true;
            }

            if (ySlices.length === 0 && !carryState.pendingSectionBanner) {
                ySlices.push({
                    ymin: headerCutY,
                    ymax: footerCutY,
                    subjectOverride: carryState.runningSubject,
                    startsAfterSectionBanner: false,
                    followedBySectionBanner: false
                });
            }

            const orderedZones = [];
            for (const sl of ySlices) {
                const sliceTokens = bodyTokens.filter(t => t.yMid >= sl.ymin && t.yMid <= sl.ymax);
                const colInfo = this.detectZoneColumnSplit(sliceTokens, maskObj, rulingLines, sl.ymin, sl.ymax, docConsensus, cfg);

                if (colInfo.isTwoColumn) {
                    orderedZones.push({
                        colIdx: 0, isTwoColumn: true,
                        xmin: 8, xmax: Math.max(430, colInfo.gutterX - 4),
                        ymin: sl.ymin, ymax: sl.ymax,
                        subjectOverride: sl.subjectOverride,
                        startsAfterSectionBanner: sl.startsAfterSectionBanner,
                        followedBySectionBanner: sl.followedBySectionBanner,
                        gutterX: colInfo.gutterX
                    });
                    orderedZones.push({
                        colIdx: 1, isTwoColumn: true,
                        xmin: Math.min(570, colInfo.gutterX + 4), xmax: 992,
                        ymin: sl.ymin, ymax: sl.ymax,
                        subjectOverride: sl.subjectOverride,
                        startsAfterSectionBanner: false,
                        followedBySectionBanner: sl.followedBySectionBanner,
                        gutterX: colInfo.gutterX
                    });
                } else {
                    orderedZones.push({
                        colIdx: 0, isTwoColumn: false,
                        xmin: 8, xmax: 992,
                        ymin: sl.ymin, ymax: sl.ymax,
                        subjectOverride: sl.subjectOverride,
                        startsAfterSectionBanner: sl.startsAfterSectionBanner,
                        followedBySectionBanner: sl.followedBySectionBanner,
                        gutterX: 500
                    });
                }
            }
            return { orderedZones, splitBands };
        }
    };

    // ========================================================================
    // MODULE 4: MONOTONIC SEQUENCE ANCHOR GRAPH SOLVER (VITERBI / DP)
    // ========================================================================
    const AnchorSequenceSolver = {
        REJECT_LINE_RX: [
            /^\s*\([A-Da-d]\)\s*/,
            /^\s*[A-D]\s*[\)\.]\s+/,
            /^\s*\([P-Sp-s]\)\s*/,
            /^\s*\((?:i|ii|iii|iv|v|vi)\)\s*/i,
            /^\s*(?:Statement|Assertion|Reason|Column|List)[\s\-]*(?:I|II|1|2|A|B)\b/i,
            /^\s*(?:Option|Ans|Answer|Sol|Solution|Hint|Key)[\s\.\:\-]/i,
            /^\s*\d+\s*(?:cm|mm|m|km|kg|g|mg|s|ms|Hz|N|J|W|V|A|K|mol|atm|Pa|eV|MeV|rad|deg|°|%)\b/i,
            /^\s*\d+\s*[\+\-\*\/\=\<\>×÷]/
        ],

        evaluateLineAsAnchor(line, colLeftMargin, prevLine, medLineH, colLines, lineIdx) {
            const txt = line.text.trim();
            if (!txt || txt.length < 2) return null;

            for (const rx of this.REJECT_LINE_RX) {
                if (rx.test(txt)) return null;
            }

            const relIndent = line.xmin - colLeftMargin;
            const gapAbove = prevLine ? (line.topNorm - prevLine.botNorm) : 28;

            // 1. Explicit "Q.1", "Q1.", "Question 1", "Prob. 1", "Ex. 1", "Illus. 1"
            const explicitRx = /^(?:Q(?:uestion|\.)?|Prob(?:lem|\.)?|Ex(?:ample|\.)?|Illus(?:tration|\.)?)\s*\.?\s*(\d{1,3}[a-zA-Z]?)(?:\s*\[.*?\]|\s*[\.\)\:\-\]]|\s+|$)/i;
            const mExp = txt.match(explicitRx);
            if (mExp && relIndent < 145) {
                const qStr = mExp[1];
                const qInt = Utils.parseNumericQ(qStr);
                if (qInt >= 1 && qInt <= 300) {
                    let score = 11.0;
                    if (relIndent < 32) score += 3.0;
                    if (line.startsBold) score += 2.0;
                    if (gapAbove > medLineH * 0.45) score += 1.5;
                    return { qNumStr: qStr, qNumInt: qInt, baseScore: score, style: 'EXPLICIT_Q', isExplicit: true };
                }
            }

            // 2. Numeric prefix "12." or "12)" (INCLUDING standalone "1)", "2)", "3)", "4)" at exact left margin!)
            const numDotRx = /^(\d{1,3})\s*([\.\)])(?:\s+(.*))?$/;
            const mNum = txt.match(numDotRx);
            if (mNum && relIndent < 65) {
                const qStr = mNum[1];
                const punct = mNum[2];
                const rest = (mNum[3] || '').trim();
                const qInt = Utils.parseNumericQ(qStr);

                if (qInt >= 1 && qInt <= 250) {
                    if (punct === '.' && /^\d/.test(rest)) return null;

                    if (qInt >= 1 && qInt <= 4 && this.looksLikeNumberedOptionRow(colLines, lineIdx, qInt, medLineH)) {
                        return null;
                    }

                    // Standalone "3)" is valid when aligned with column left margin and separated vertically
                    if (!rest) {
                        if (relIndent > 24) return null;
                        if (prevLine && gapAbove < medLineH * 0.35) return null;
                    }

                    let score = 6.5;
                    if (relIndent < 18) score += 3.0;
                    else if (relIndent < 40) score += 1.4;
                    if (line.startsBold) score += 2.0;
                    if (gapAbove > medLineH * 0.50) score += 2.0;
                    if (!rest && relIndent < 18) score += 1.5;
                    else if (rest.length >= 10) score += 1.4;
                    return { qNumStr: qStr, qNumInt: qInt, baseScore: score, style: 'NUMERIC_DOT', isExplicit: false };
                }
            }

            // 3. Parenthesized "(12)" at strict column left margin (not MCQ options (1)..(4))
            const parenRx = /^\((\d{1,3})\)\s+([A-Za-z\[].{5,})$/;
            const mPar = txt.match(parenRx);
            if (mPar && relIndent < 35) {
                const qStr = mPar[1];
                const qInt = Utils.parseNumericQ(qStr);
                if (qInt >= 1 && qInt <= 200) {
                    if (qInt >= 1 && qInt <= 4 && this.looksLikeNumberedOptionRow(colLines, lineIdx, qInt, medLineH)) {
                        return null;
                    }
                    let score = 5.2;
                    if (line.startsBold) score += 2.2;
                    if (gapAbove > medLineH * 0.6) score += 1.8;
                    return { qNumStr: qStr, qNumInt: qInt, baseScore: score, style: 'PAREN_NUM', isExplicit: false };
                }
            }

            return null;
        },

        looksLikeNumberedOptionRow(colLines, lineIdx, numVal, medLineH) {
            const curLine = colLines[lineIdx];
            if (/\(1\).*\(2\)|\(3\).*\(4\)|1\).*2\)|3\).*4\)/.test(curLine.text)) return true;

            let siblingHits = 0;
            for (let k = Math.max(0, lineIdx - 3); k <= Math.min(colLines.length - 1, lineIdx + 3); k++) {
                if (k === lineIdx) continue;
                const t = colLines[k].text;
                const dy = Math.abs(colLines[k].topNorm - curLine.topNorm);
                if (dy < medLineH * 5.2 && /^\s*(?:\([1-4]\)|[1-4]\))\s+/.test(t)) {
                    siblingHits++;
                }
            }
            return siblingHits >= 2;
        },

        detectPassageHeadersInColumn(colLines) {
            const passages = [];
            for (let i = 0; i < colLines.length; i++) {
                const m = colLines[i].text.match(LayoutPartitioner.PASSAGE_START_RX);
                if (m) {
                    passages.push({
                        lineIdx: i,
                        topNorm: colLines[i].topNorm,
                        text: colLines[i].text,
                        fromQ: m[1] ? parseInt(m[1], 10) : null,
                        toQ: m[2] ? parseInt(m[2], 10) : null
                    });
                }
            }
            return passages;
        },

        solveGlobalAnchorSequence(allCandidateAnchors) {
            const n = allCandidateAnchors.length;
            if (n === 0) return [];

            const styleCounts = {};
            for (const c of allCandidateAnchors) styleCounts[c.style] = (styleCounts[c.style] || 0) + 1;
            const dominantStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'EXPLICIT_Q';

            for (const c of allCandidateAnchors) {
                c.adjScore = c.style === dominantStyle ? c.baseScore + 2.2 : c.baseScore;
            }

            const dp = new Float64Array(n);
            const prevIdx = new Int32Array(n).fill(-1);

            for (let i = 0; i < n; i++) {
                const cur = allCandidateAnchors[i];
                let best = cur.adjScore + (cur.qNumInt === 1 ? 6.5 : (cur.isExplicit ? 2.0 : 0.0));
                let bestP = -1;

                const lookStart = Math.max(0, i - 18);
                for (let j = lookStart; j < i; j++) {
                    const prev = allCandidateAnchors[j];
                    let trans = -Infinity;
                    const diff = cur.qNumInt - prev.qNumInt;

                    if (diff === 1 && cur.zoneSubject === prev.zoneSubject) {
                        trans = 12.5;
                    } else if (cur.qNumInt === 1 && (cur.afterSectionBanner || (cur.zoneSubject && prev.zoneSubject && cur.zoneSubject !== prev.zoneSubject))) {
                        // Clean section or subject reset back to Q.1!
                        trans = 11.5;
                    } else if (diff === 1) {
                        trans = 11.0;
                    } else if (diff === 2) {
                        trans = 5.5;
                    } else if (diff >= 3 && diff <= 6) {
                        trans = 1.0;
                    } else if (diff === 0 && cur.qNumStr !== prev.qNumStr) {
                        trans = 6.0;
                    } else if (cur.isExplicit && diff > 0 && diff <= 15) {
                        trans = 0.5;
                    } else if (cur.qNumInt === 1 && prev.qNumInt >= 4 && cur.pageIdx > prev.pageIdx) {
                        trans = 5.0;
                    }

                    if (trans > -Infinity) {
                        const candTotal = dp[j] + trans + cur.adjScore;
                        if (candTotal > best) {
                            best = candTotal;
                            bestP = j;
                        }
                    }
                }
                dp[i] = best;
                prevIdx[i] = bestP;
            }

            let endIdx = 0;
            for (let i = 1; i < n; i++) if (dp[i] > dp[endIdx]) endIdx = i;

            const chosen = [];
            let cur = endIdx;
            while (cur >= 0) {
                chosen.push(allCandidateAnchors[cur]);
                cur = prevIdx[cur];
            }
            chosen.reverse();

            const chosenSet = new Set(chosen.map(c => c.uid));
            for (const c of allCandidateAnchors) {
                if (!chosenSet.has(c.uid) && c.isExplicit && c.baseScore >= 14.0) {
                    chosen.push(c);
                }
            }
            chosen.sort((a, b) => a.globalOrder - b.globalOrder);
            return chosen;
        }
    };

    // ========================================================================
    // MODULE 5: BOUNDARY REFINER, INLINE MOLECULE & DIAGRAM ENCAPSULATION
    // ========================================================================
    const BoundaryRefiner = {
        segmentZoneByPixels(zone, maskObj, rulingLines, cfg = DEFAULT_CONFIG) {
            if (!maskObj) return [];
            const { gh } = maskObj;
            const zW = zone.xmax - zone.xmin;
            const blocks = [];

            const zoneHRules = (rulingLines.hLines || [])
                .filter(h => h.y >= zone.ymin - 5 && h.y <= zone.ymax + 5 &&
                    Utils.boxOverlap1D(h.xmin, h.xmax, zone.xmin, zone.xmax) >= zW * 0.72)
                .map(h => h.y)
                .sort((a, b) => a - b);

            const density = PixelVision.computeRowInkDensity(maskObj, zone.xmin + 6, zone.xmax - 6);

            if (zoneHRules.length >= 3) {
                for (let i = 0; i < zoneHRules.length - 1; i++) {
                    const y0 = zoneHRules[i], y1 = zoneHRules[i + 1];
                    if (y1 - y0 < 55) continue;
                    const r0 = Utils.clamp(Math.floor((y0 / 1000) * gh) + 3, 0, gh - 1);
                    const r1 = Utils.clamp(Math.ceil((y1 / 1000) * gh) - 3, r0, gh - 1);
                    let inkRows = 0;
                    for (let r = r0; r <= r1; r++) if (density[r] > 0.01 && density[r] < 0.65) inkRows++;
                    if (inkRows >= 6) {
                        blocks.push({
                            xmin: zone.xmin, xmax: zone.xmax,
                            ymin: Math.round(y0), ymax: Math.round(y1),
                            questionNumber: String(blocks.length + 1),
                            hasExplicitAnchor: false,
                            ocrText: '', firstLineSnippet: '', lastLineSnippet: '',
                            source: 'pixel-table-rule', confidence: 0.85
                        });
                    }
                }
                if (blocks.length >= 2) return blocks;
            }

            const rStart = Utils.clamp(Math.floor((zone.ymin / 1000) * gh), 0, gh - 1);
            const rEnd = Utils.clamp(Math.ceil((zone.ymax / 1000) * gh), rStart + 1, gh - 1);

            const gaps = [];
            let whiteRun = 0, seenInk = false;
            for (let r = rStart; r <= rEnd; r++) {
                if (density[r] > 0.006) {
                    if (seenInk && whiteRun >= 2) gaps.push(whiteRun);
                    seenInk = true; whiteRun = 0;
                } else if (seenInk) whiteRun++;
            }
            const medGap = Utils.median(gaps) || 4;
            const splitGapRows = Math.max(7, Math.round(medGap * 2.15));
            const minBlockRows = Math.max(14, Math.round(gh * 0.042));

            let inBlock = false, bStart = rStart, wRun = 0;
            for (let r = rStart; r <= rEnd; r++) {
                if (density[r] > 0.006) {
                    if (!inBlock) { inBlock = true; bStart = Math.max(rStart, r - 2); }
                    wRun = 0;
                } else if (inBlock) {
                    wRun++;
                    if (wRun >= splitGapRows) {
                        const bEnd = r - wRun + 2;
                        if (bEnd - bStart >= minBlockRows) {
                            blocks.push({
                                xmin: zone.xmin, xmax: zone.xmax,
                                ymin: Math.round((bStart / gh) * 1000),
                                ymax: Math.round((bEnd / gh) * 1000),
                                questionNumber: String(blocks.length + 1),
                                hasExplicitAnchor: false,
                                ocrText: '', firstLineSnippet: '', lastLineSnippet: '',
                                source: 'pixel-rlsa', confidence: 0.72
                            });
                        }
                        inBlock = false; wRun = 0;
                    }
                }
            }
            if (inBlock && (rEnd - bStart) >= minBlockRows) {
                blocks.push({
                    xmin: zone.xmin, xmax: zone.xmax,
                    ymin: Math.round((bStart / gh) * 1000),
                    ymax: Math.round((rEnd / gh) * 1000),
                    questionNumber: String(blocks.length + 1),
                    hasExplicitAnchor: false,
                    ocrText: '', firstLineSnippet: '', lastLineSnippet: '',
                    source: 'pixel-rlsa', confidence: 0.72
                });
            }
            return blocks;
        },

        /**
         * Encapsulates:
         *  (A) Top-of-page / top-of-zone diagrams sitting ABOVE block[0]'s first text line
         *      (e.g. Page 3 Q.8 lever diagram, Page 5 Q.6 ring diagram, Page 7 row (S) diagram)
         *  (B) Baseline-aligned inline tall figures / organic chemistry rings sticking ABOVE a question's first line
         *      (e.g. Page 8 Q.1 phenol-NaOH ring, Page 8 Q.7 alkene, Page 11 Q.2 benzene-Z)
         *  (C) ALL diagrams/tables sitting strictly below block[i] and above block[i+1] (no artificial gap cap!)
         *  (D) Clean whitespace snapping so cuts NEVER pass through ink.
         */
        refineColumnBlocksWithDiagrams(blocks, zone, maskObj, components, colLines, cfg = DEFAULT_CONFIG) {
            if (!blocks || blocks.length === 0) return [];

            const zoneComps = (components || []).filter(c =>
                !c.isBorderFrame &&
                c.xmin >= zone.xmin - 12 && c.xmax <= zone.xmax + 12 &&
                c.ymin >= zone.ymin - 4 && c.ymax <= zone.ymax + 4 &&
                (c.wNorm >= 8 || c.hNorm >= 8)
            );

            // PASS A: Expand first block UPWARD to capture any diagram sitting between zone.ymin and block[0].ymin!
            const firstB = blocks[0];
            if (firstB.isOrphanLeadingSlice || !firstB.hasExplicitAnchor) {
                const topComps = zoneComps.filter(c => c.ymin >= zone.ymin && c.ymax <= firstB.ymin + 14);
                if (topComps.length > 0) {
                    const minTopY = Math.min(...topComps.map(c => c.ymin));
                    firstB.ymin = Math.min(firstB.ymin, Math.max(zone.ymin, Math.floor(minTopY - 6)));
                    if (topComps.some(c => c.wNorm >= 55 && c.hNorm >= 35)) firstB.hasDiagram = true;
                }
            }

            // PASS B: Expand ANY anchored question UPWARD if an inline tall chemical ring / formula overlaps line 1!
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const aTop = b.anchorTopNorm ?? b.ymin;
                const aBot = b.anchorBotNorm ?? (aTop + 16);
                const hardCeiling = i > 0
                    ? Math.max(zone.ymin, (blocks[i - 1].lastTextBotNorm ?? blocks[i - 1].ymin) + 4)
                    : zone.ymin;

                // Seed with components overlapping line 1 vertically and sticking above aTop
                let inlineCluster = zoneComps.filter(c =>
                    c.ymax >= aTop - 10 && c.ymin <= aBot + 10 &&
                    c.ymin < aTop - 8 && c.ymin >= hardCeiling - 2
                );

                // Iteratively attach tiny labels (like "OH", "Cl", "CH3") directly above those inline structures
                if (inlineCluster.length > 0) {
                    let grew = true;
                    let guard = 0;
                    while (grew && guard++ < 4) {
                        grew = false;
                        const cMinX = Math.min(...inlineCluster.map(c => c.xmin)) - 18;
                        const cMaxX = Math.max(...inlineCluster.map(c => c.xmax)) + 18;
                        const cMinY = Math.min(...inlineCluster.map(c => c.ymin));
                        for (const cand of zoneComps) {
                            if (inlineCluster.includes(cand)) continue;
                            if (cand.ymin >= hardCeiling && cand.ymax >= cMinY - 14 && cand.ymin <= cMinY + 6 &&
                                cand.xmax >= cMinX && cand.xmin <= cMaxX) {
                                inlineCluster.push(cand);
                                grew = true;
                            }
                        }
                    }
                    const highestInlineY = Math.min(...inlineCluster.map(c => c.ymin));
                    if (highestInlineY < b.ymin) {
                        b.ymin = Math.max(hardCeiling, Math.floor(highestInlineY - 6));
                        b.hasDiagram = true;
                        // Ensure previous block stops strictly above this inline structure
                        if (i > 0 && blocks[i - 1].ymax > b.ymin - 2) {
                            blocks[i - 1].ymax = Math.max(blocks[i - 1].ymin + cfg.minQuestionHeightNorm, b.ymin - 2);
                        }
                    }
                }
            }

            // PASS C: Expand each block DOWNWARD to capture ALL diagrams/tables strictly before the next block's ymin!
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const nextCeiling = i < blocks.length - 1 ? blocks[i + 1].ymin - 2 : zone.ymax;
                const belowComps = zoneComps.filter(c =>
                    c.ymin >= b.ymin - 4 && c.ymax <= nextCeiling + 4
                );
                if (belowComps.length > 0) {
                    const maxBotY = Math.max(...belowComps.map(c => c.ymax));
                    b.ymax = Math.max(b.ymax, Math.min(nextCeiling, Math.ceil(maxBotY + 6)));
                    if (belowComps.some(c => c.wNorm >= 60 && c.hNorm >= 40)) {
                        b.hasDiagram = true;
                    }
                }
            }

            // PASS D: Snap every boundary cleanly into an ink-free whitespace valley without colliding with neighbors
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const minAllowed = i > 0 ? Math.min(b.ymin, blocks[i - 1].ymax + 1) : Math.max(2, zone.ymin);
                const maxAllowed = i < blocks.length - 1
                    ? Math.max(b.ymin + cfg.minQuestionHeightNorm, blocks[i + 1].ymin - 1)
                    : Math.min(996, zone.ymax);

                b.ymin = PixelVision.snapYToCleanestValley(maskObj, b.ymin, minAllowed, maxAllowed - cfg.minQuestionHeightNorm, b.xmin + 4, b.xmax - 4, 'UP');
                b.ymax = PixelVision.snapYToCleanestValley(maskObj, b.ymax, b.ymin + cfg.minQuestionHeightNorm, maxAllowed, b.xmin + 4, b.xmax - 4, 'DOWN');
            }

            return blocks;
        }
    };

    // ========================================================================
    // MODULE 6: 9-SIGNAL CROSS-COLUMN & CROSS-PAGE LOOKAHEAD STITCHER
    // ========================================================================
    const StitchResolver = {
        ORPHAN_OPTION_START_RX: /^\s*(?:\([B-Db-d2-4]\)|[B-D2-4]\)|\([Q-Sq-s]\)|[Q-S]\)|\([b-e]\)\s|Statement[\s\-]*(?:II|2)|Reason\s*\(R\)|Column[\s\-]*(?:II|2)|List[\s\-]*(?:II|2))/i,
        OPTION_A_RX: /\(A\)|\(a\)|(?:^|\s)A\)/,
        OPTION_B_RX: /\(B\)|\(b\)|(?:^|\s)B\)/,
        OPTION_C_RX: /\(C\)|\(c\)|(?:^|\s)C\)/,
        OPTION_D_RX: /\(D\)|\(d\)|(?:^|\s)D\)/,
        FIGURE_REF_RX: /\b(?:shown\s+in\s+(?:the\s+)?(?:fig|figure|diagram|graph|circuit)|adjacent\s+(?:fig|figure|diagram)|following\s+(?:fig|figure|graph|table|diagram)|match\s+(?:the\s+)?(?:column|list|following)|column[\s\-]*i|list[\s\-]*i|as\s+shown)\b/i,
        INCOMPLETE_END_RX: /(?:[,;:\=\+\-\*\/×÷\(\[\{]|\b(?:is|are|was|were|be|of|to|in|on|at|by|for|from|with|then|that|which|where|when|if|and|or|the|a|an|equal\s+to|given\s+by|find|calculate|determine|between|than|as|equilibrium|right|left)\s*)$/i,
        EXPLICIT_CONT_RX: /\b(?:contd\.?|continued)\b/i,

        hasCompleteABCD(text) {
            return this.OPTION_A_RX.test(text) && this.OPTION_B_RX.test(text) &&
                   this.OPTION_C_RX.test(text) && this.OPTION_D_RX.test(text);
        },

        evaluateStitchPair(prevBlock, currBlock, nextBlock, cfg = DEFAULT_CONFIG) {
            if (!prevBlock || !currBlock) {
                return { shouldStitch: false, score: 0, reasons: [] };
            }

            const isSamePage = prevBlock.pageNum === currBlock.pageNum;
            if (isSamePage && !cfg.enableCrossColumnStitch) return { shouldStitch: false, score: 0, reasons: [] };
            if (!isSamePage && !cfg.enableCrossPageStitch) return { shouldStitch: false, score: 0, reasons: [] };
            if (currBlock.pageNum - prevBlock.pageNum > 1) return { shouldStitch: false, score: 0, reasons: [] };

            // HARD VETO 1: Verified new question anchor never stitches onto previous question
            if (currBlock.hasExplicitAnchor && !currBlock.isOrphanLeadingSlice) {
                return { shouldStitch: false, score: -100, reasons: ['new-verified-anchor'] };
            }

            const prevText = Utils.normalizeWhitespace(prevBlock.ocrText || '');
            const prevLast = Utils.normalizeWhitespace(prevBlock.lastLineSnippet || prevText.slice(-90));
            const currText = Utils.normalizeWhitespace(currBlock.ocrText || '');
            const currFirst = Utils.normalizeWhitespace(currBlock.firstLineSnippet || currText.slice(0, 90));

            // HARD VETO 2: Never stitch Passage or Section banners
            if (LayoutPartitioner.PASSAGE_START_RX.test(currFirst) || LayoutPartitioner.SECTION_BANNER_RX.test(currFirst)) {
                return { shouldStitch: false, score: -50, reasons: ['is-passage-or-section-header'] };
            }

            // HARD VETO 3: Never merge two ALREADY-COMPLETE MCQ questions (prev has A..D AND curr has A..D)!
            if (this.hasCompleteABCD(prevText) && this.hasCompleteABCD(currText)) {
                return { shouldStitch: false, score: -80, reasons: ['both-blocks-already-complete-ABCD'] };
            }

            let score = 0;
            const reasons = [];

            // Signal 1: Unanchored leading slice at top of column/page before the first anchor
            if (currBlock.isOrphanLeadingSlice) {
                score += 5.0;
                reasons.push('top-of-page-unanchored');
            }

            // Signal 2: Previous block was literally a bare bottom-of-page anchor (e.g. Page 3 "3)")!
            if (prevText.length <= 6 && /^\d{1,3}[\.\)]?$/.test(prevText)) {
                score += 10.0;
                reasons.push('prev-was-standalone-number-at-page-bottom');
            }

            // Signal 3: Global Sequence Lookahead Proof (prev=Q.7 -> [slice] -> next=Q.8)
            const prevNum = Utils.parseNumericQ(prevBlock.questionNumber);
            const nextNum = nextBlock ? Utils.parseNumericQ(nextBlock.questionNumber) : NaN;
            if (!isNaN(prevNum) && !isNaN(nextNum) && nextNum === prevNum + 1) {
                score += 6.5;
                reasons.push(`sequence-lookahead-proof(Q.${prevNum}->Q.${nextNum})`);
            }

            // Signal 4: Orphan sits ABOVE a PART/SECTION banner on the next page (cannot belong to the new section below!)
            if (currBlock.isOrphanLeadingSlice && currBlock.followedBySectionBanner) {
                score += 6.5;
                reasons.push('orphan-above-new-section-banner');
            }

            // Signal 5: Orphaned Options / Sub-part Continuation ((B)/(C)/(D), (b)-(d), (S), Column-II, Statement-II)
            if (this.ORPHAN_OPTION_START_RX.test(currFirst)) {
                score += 8.0;
                reasons.push('orphaned-options-or-subpart-continuation');
            }

            // Signal 6: Completes an incomplete (A)-(D) option set across the page break
            if (this.OPTION_A_RX.test(prevText) && !this.OPTION_D_RX.test(prevText) && this.OPTION_D_RX.test(currText)) {
                score += 7.0;
                reasons.push('completes-ABCD-option-set');
            }

            // Signal 7: Incomplete sentence / dangling math operator OR lowercase start
            if (this.INCOMPLETE_END_RX.test(prevLast)) {
                score += 4.0;
                reasons.push('prev-ends-mid-sentence');
            }
            if (/^[a-z]/.test(currFirst)) {
                score += 3.5;
                reasons.push('curr-starts-lowercase');
            }

            // Signal 8: Figure / Table reference split across break
            if (this.FIGURE_REF_RX.test(prevText) && (currBlock.hasDiagram || currText.length < 60)) {
                score += 4.5;
                reasons.push('diagram-or-table-continuation');
            }

            // Signal 9: Explicit "(contd.)" OR prev question was NOT complete yet (no (D)) while curr is unanchored
            if (this.EXPLICIT_CONT_RX.test(currFirst) || this.EXPLICIT_CONT_RX.test(prevLast)) {
                score += 6.0;
                reasons.push('explicit-continued-marker');
            } else if (currBlock.isOrphanLeadingSlice && !this.hasCompleteABCD(prevText)) {
                score += 2.0;
                reasons.push('prev-unterminated-before-orphan');
            }

            return {
                shouldStitch: score >= 5.5,
                score: Math.round(score * 10) / 10,
                reasons
            };
        },

        resolveDocumentStitches(orderedBlocks, cfg = DEFAULT_CONFIG) {
            const chainMap = new Map();
            let chainCounter = 1;

            for (let i = 1; i < orderedBlocks.length; i++) {
                const prev = orderedBlocks[i - 1];
                const curr = orderedBlocks[i];
                const next = orderedBlocks[i + 1] || null;

                const crossedBoundary = curr.pageNum !== prev.pageNum || curr.colIdx !== prev.colIdx;
                if (!crossedBoundary && !curr.isOrphanLeadingSlice) continue;

                const verdict = this.evaluateStitchPair(prev, curr, next, cfg);
                if (verdict.shouldStitch) {
                    const chainId = prev.stitchChainId || `chain_${chainCounter++}`;
                    prev.stitchChainId = chainId;
                    prev.continuesToNext = true;

                    curr.isContinuationFromPrev = true;
                    curr.stitchWithPrev = true;
                    curr.stitchTargetUid = prev.stitchRootUid || prev.uid;
                    curr.stitchRootUid = prev.stitchRootUid || prev.uid;
                    curr.stitchChainId = chainId;
                    curr.stitchScore = verdict.score;
                    curr.stitchReasons = verdict.reasons;
                    curr.questionNumber = prev.questionNumber;

                    if (!chainMap.has(chainId)) chainMap.set(chainId, [prev]);
                    chainMap.get(chainId).push(curr);
                }
            }

            for (const parts of chainMap.values()) {
                parts.forEach((p, idx) => {
                    p.stitchPartIndex = idx + 1;
                    p.stitchTotalParts = parts.length;
                });
            }

            return orderedBlocks;
        }
    };

    // ========================================================================
    // MODULE 7: PER-SUBJECT MULTI-LAYER OFFLINE JEE CHAPTER CLASSIFIER
    // (Term-Frequency Weighted Lexicon + Formula Signatures + Per-Subject
    //  Topic-Test Coherence Prior + Self-Learning Local Naive Bayes Memory)
    // ========================================================================
    const JEEChapterClassifier = {
        SYLLABUS_RULES: [
            // ======================== PHYSICS ========================
            {
                subject: 'Physics', chapter: 'Units and Measurements, Errors and Experiments',
                t1: ['dimensional formula', 'dimensional analysis', 'vernier calliper', 'vernier caliper', 'screw gauge', 'pitch of screw', 'least count', 'percentage error', 'significant figures', 'zero error', 'fractional error', 'absolute error', 'spherometer'],
                t2: ['dimension of', 'dimensions of', 'error in measurement', 'relative error', 'parallax', 'fundamental quantities', 'main scale division', 'vernier scale'],
                rx: [/\[M\^?[\-0-9]*L\^?[\-0-9]*T\^?[\-0-9]*\]/i, /\b(?:msd|vsd)\b/i]
            },
            {
                subject: 'Physics', chapter: 'Vectors',
                t1: ['unit vector', 'resultant of two vectors', 'cross product', 'dot product', 'triangle law of vector', 'parallelogram law of vector', 'orthogonal vectors', 'angle between two vectors'],
                t2: ['magnitude of vector', 'component of vector', 'resultant force', 'coplanar vectors', 'vector sum', 'null vector'],
                rx: [/\b[a-z]\s*[\u00d7x]\s*[b-z]\b/i, /\\vec\{/i]
            },
            {
                subject: 'Physics', chapter: 'Rectilinear Motion',
                t1: ['uniformly accelerated', 'retarding force', 'stopping distance', 'velocity-time graph', 'position-time graph', 'displacement-time graph', 'free fall', 'dropped from a height', 'thrown vertically upward', 'nth second'],
                t2: ['average velocity', 'average speed', 'instantaneous velocity', 'uniform acceleration', 'retardation', 'rectilinear', 'starts from rest'],
                rx: [/\bv\s*=\s*u\s*\+\s*at\b/i, /\bs\s*=\s*ut\b/i, /\bdx\s*\/\s*dt\b/i]
            },
            {
                subject: 'Physics', chapter: 'Projectile Motion',
                t1: ['projectile', 'horizontal range', 'angle of projection', 'time of flight', 'maximum height', 'equation of trajectory', 'inclined plane projectile', 'projected at an angle'],
                t2: ['trajectory', 'parabolic path', 'projected horizontally', 'hits the ground', 'fired at'],
                rx: [/\bu\^?2\s*sin\s*2/i]
            },
            {
                subject: 'Physics', chapter: 'Relative Motion',
                t1: ['river boat', 'river swimmer', 'rain umbrella', 'raindrops appear', 'shortest path across', 'shortest time across', 'relative velocity', 'relative velocities', 'drift across the river', 'minimum distance of approach', 'closest approach'],
                t2: ['still water', 'river flows', 'downstream', 'upstream', 'relative motion', 'relative acceleration', 'frame of reference'],
                rx: [/\bv_\{?[a-z]{2}\}?\b/i]
            },
            {
                subject: 'Physics', chapter: 'Circular Kinematics',
                t1: ['centripetal acceleration', 'tangential acceleration', 'banking of road', 'conical pendulum', 'death well', 'vertical circular motion', 'non-uniform circular motion'],
                t2: ['angular velocity', 'angular speed', 'angular acceleration', 'circular track', 'circular path', 'centripetal force', 'centrifugal force', 'radius of curvature'],
                rx: [/\bv\^?2\s*\/\s*r\b/i, /\b\u03c9\^?2\s*r\b/i]
            },
            {
                subject: 'Physics', chapter: "Newton's Laws of Motion",
                t1: ['coefficient of friction', 'static friction', 'kinetic friction', 'angle of repose', 'pseudo force', 'atwood machine', 'wedge and block', 'string constraint', 'spring balance', 'normal reaction', 'limiting friction'],
                t2: ['pulley', 'tension in the string', 'rough horizontal', 'inclined plane', 'free body diagram', 'connected by a light string', 'newton\'s law'],
                rx: [/\b\u03bc_?[sk]?\s*=\s*0?\.\d+/i, /\bf\s*=\s*ma\b/i]
            },
            {
                subject: 'Physics', chapter: 'Work, Power and Energy',
                t1: ['work-energy theorem', 'conservative force', 'non-conservative force', 'potential energy curve', 'stable equilibrium', 'unstable equilibrium', 'instantaneous power'],
                t2: ['work done by', 'kinetic energy', 'potential energy', 'mechanical energy', 'power delivered'],
                rx: [/\b1\/2\s*kx\^?2\b/i, /\b1\/2\s*mv\^?2\b/i, /\b-dU\s*\/\s*dx\b/i]
            },
            {
                subject: 'Physics', chapter: 'COM, Momentum and Collision',
                t1: ['centre of mass', 'center of mass', 'coefficient of restitution', 'head-on collision', 'oblique collision', 'elastic collision', 'inelastic collision', 'conservation of linear momentum', 'ballistic pendulum', 'recoil velocity', 'rocket propulsion', 'variable mass'],
                t2: ['impulse', 'collides elastically', 'collides with', 'explodes into', 'fragments', 'cavity removed'],
                rx: [/\bx_\{?cm\}?\b/i, /\bm_1v_1\s*\+\s*m_2v_2\b/i]
            },
            {
                subject: 'Physics', chapter: 'Rigid Body Mechanics',
                t1: ['moment of inertia', 'parallel axis theorem', 'perpendicular axis theorem', 'pure rolling', 'rolling without slipping', 'angular momentum', 'conservation of angular momentum', 'radius of gyration', 'instantaneous axis of rotation', 'toppling'],
                t2: ['torque', 'rigid body', 'rotational kinetic energy', 'uniform rod', 'solid sphere', 'hollow sphere', 'solid cylinder', 'thin ring', 'hinged at', 'pivoted at', 'angular impulse'],
                rx: [/\bI\s*\u03b1\b/i, /\bI\s*\u03c9\b/i, /\bmr\^?2\s*\/\s*[2345]\b/i, /\bml\^?2\s*\/\s*(?:3|12)\b/i]
            },
            {
                subject: 'Physics', chapter: 'Mechanical properties of Solids (Elasticity)',
                t1: ['young\'s modulus', 'youngs modulus', 'bulk modulus', 'shear modulus', 'modulus of rigidity', 'poisson\'s ratio', 'elastic potential energy', 'breaking stress', 'hooke\'s law', 'stress-strain'],
                t2: ['tensile stress', 'longitudinal strain', 'volumetric strain', 'compressibility', 'wire of length', 'elongated by', 'elastic limit'],
                rx: [/\bFL\s*\/\s*A\u0394L\b/i]
            },
            {
                subject: 'Physics', chapter: 'Fluid Mechanics',
                t1: ['bernoulli\'s theorem', 'bernoulli equation', 'archimedes principle', 'surface tension', 'capillary rise', 'capillary tube', 'excess pressure', 'soap bubble', 'angle of contact', 'stokes law', 'poiseuille', 'reynolds number', 'venturimeter', 'torricelli', 'efflux velocity', 'pascal\'s law', 'equation of continuity'],
                t2: ['buoyant force', 'upthrust', 'viscosity', 'coefficient of viscosity', 'viscous force', 'terminal velocity', 'submerged', 'floating', 'meniscus', 'u-tube', 'manometer', 'hydrostatic pressure', 'streamline'],
                rx: [/\b2T\s*\/\s*r\b/i, /\b4T\s*\/\s*r\b/i, /\b6\u03c0\u03b7rv\b/i, /\b\u03c1gh\b/i]
            },
            {
                subject: 'Physics', chapter: 'Thermal Expansion',
                t1: ['coefficient of linear expansion', 'coefficient of volume expansion', 'bimetallic strip', 'thermal stress', 'apparent expansion', 'pendulum clock loses', 'pendulum clock gains'],
                t2: ['linear expansion', 'superficial expansion', 'cubical expansion', 'metallic rod heated', 'brass scale'],
                rx: [/\b\u0394L\s*=\s*L\u03b1\u0394T\b/i]
            },
            {
                subject: 'Physics', chapter: 'Calorimetry',
                t1: ['latent heat of fusion', 'latent heat of vaporization', 'water equivalent', 'specific heat capacity', 'principle of calorimetry', 'ice at 0', 'steam at 100'],
                t2: ['calorimeter', 'melted', 'final temperature of mixture', 'specific heat', 'latent heat'],
                rx: [/\bmS\u0394T\b/i, /\bmL_?[fv]?\b/i]
            },
            {
                subject: 'Physics', chapter: 'Heat Transfer',
                t1: ['stefan-boltzmann', 'stefan\'s law', 'wien\'s displacement', 'newton\'s law of cooling', 'thermal conductivity', 'thermal resistance', 'kirchhoff\'s law of radiation', 'black body radiation', 'emissivity', 'absorptivity', 'steady state conduction'],
                t2: ['conduction', 'convection', 'radiation', 'temperature gradient', 'composite slab', 'rate of cooling', 'blackbody'],
                rx: [/\b\u03bb_?m\s*T\s*=/i, /\b\u03c3AT\^?4\b/i, /\bdQ\s*\/\s*dt\b/i]
            },
            {
                subject: 'Physics', chapter: 'Kinetic Theory of Gases',
                t1: ['root mean square speed', 'rms speed', 'most probable speed', 'mean free path', 'degrees of freedom', 'equipartition of energy', 'maxwell-boltzmann', 'monoatomic gas', 'diatomic gas'],
                t2: ['kinetic theory', 'average kinetic energy per molecule', 'molar specific heat', 'ideal gas molecules', 'v_rms'],
                rx: [/\b\u221a\(?3RT\s*\/\s*M\)?/i, /\bf\s*\/\s*2\s*RT\b/i]
            },
            {
                subject: 'Physics', chapter: 'Thermodynamics',
                t1: ['carnot engine', 'carnot cycle', 'p-v diagram', 'pv diagram', 'isothermal process', 'adiabatic process', 'isobaric process', 'isochoric process', 'polytropic process', 'cyclic process', 'heat engine', 'refrigerator', 'coefficient of performance', 'molar heat capacity', 'first law of thermodynamics', 'second law of thermodynamics', 'piston cylinder'],
                t2: ['internal energy', 'work done by gas', 'adiabatic expansion', 'isothermal compression', 'efficiency of engine', 'cp/cv'],
                rx: [/\bPV\^?\u03b3\b/i, /\bdQ\s*=\s*dU\s*\+\s*dW\b/i, /\bC_p\s*-\s*C_v\s*=\s*R\b/i]
            },
            {
                subject: 'Physics', chapter: 'Simple Harmonic Motion',
                t1: ['simple harmonic motion', 'simple harmonically', 's.h.m', 'shm', 'harmonic oscillator', 'harmonic oscillators', 'time period of small oscillation', 'period of small oscillation', 'time period of pendulum', 'simple pendulum', 'compound pendulum', 'physical pendulum', 'spring-block', 'restoring force', 'phase difference in shm', 'mean position', 'extreme position', 'maximum amplitude', 'damped oscillation', 'forced oscillation', 'torsional pendulum'],
                t2: ['amplitude', 'angular frequency', 'oscillate', 'oscillates', 'oscillating', 'oscillation', 'oscillations', 'time period', 'time periods', 'spring constant', 'force constant', 'stiffness constant', 'maximum compression', 'equilibrium position'],
                rx: [/\b2\u03c0\u221a\(?[lm]\s*\/\s*[gk]\)?/i, /\ba\s*=\s*-\u03c9\^?2x\b/i, /\bx\s*=\s*A\s*(?:sin|cos)\(\u03c9t/i, /\bS\.?H\.?M\.?\b/]
            },
            {
                subject: 'Physics', chapter: 'Transverse waves (String Waves)',
                t1: ['transverse wave', 'stretched string', 'standing wave on string', 'sonometer', 'fundamental frequency of string', 'overtone', 'linear mass density', 'wave velocity on string', 'melde\'s experiment'],
                t2: ['nodes and antinodes', 'stationary wave', 'progressive wave', 'wave equation', 'harmonics'],
                rx: [/\b\u221a\(?T\s*\/\s*\u03bc\)?/i, /\by\s*=\s*A\s*sin\(?kx\s*[\-\+]\s*\u03c9t/i]
            },
            {
                subject: 'Physics', chapter: 'Longitudinal Waves (Sound Waves)',
                t1: ['doppler effect', 'organ pipe', 'closed organ pipe', 'open organ pipe', 'resonance column', 'end correction', 'beat frequency', 'beats per second', 'tuning fork', 'intensity level', 'decibel', 'speed of sound', 'kundt\'s tube', 'apparent frequency'],
                t2: ['sound wave', 'longitudinal wave', 'loudness', 'echo', 'whistle', 'siren', 'observer moves', 'source moves'],
                rx: [/\b10\s*log_?\{?10\}?\(?I\s*\/\s*I_0\)?/i, /\b\u221a\(?\u03b3RT\s*\/\s*M\)?/i]
            },
            {
                subject: 'Physics', chapter: 'Gravitation',
                t1: ['escape velocity', 'orbital velocity', 'kepler\'s law', 'geostationary satellite', 'gravitational potential', 'gravitational field', 'universal gravitational constant', 'acceleration due to gravity', 'depth below earth', 'altitude above earth', 'binary star', 'binding energy of satellite'],
                t2: ['satellite', 'planet', 'orbit', 'earth\'s surface', 'gravitation', 'spherical shell'],
                rx: [/\bGMm\s*\/\s*r\^?2\b/i, /\b\u221a\(?2GM\s*\/\s*R\)?/i, /\bT\^?2\s*\u221d\s*r\^?3\b/i]
            },
            {
                subject: 'Physics', chapter: 'Electrostatics & Capacitors',
                t1: ['coulomb\'s law', 'gauss\'s law', 'electric dipole', 'electric flux', 'equipotential surface', 'parallel plate capacitor', 'dielectric slab', 'spherical capacitor', 'cylindrical capacitor', 'electrostatic potential energy', 'electric field intensity', 'line of charge', 'charged conducting sphere', 'van de graaff'],
                t2: ['point charge', 'electric field', 'electric potential', 'capacitance', 'capacitor', 'dielectric constant', 'microfarad', 'coulomb', 'dipole moment', 'surface charge density'],
                rx: [/\b1\s*\/\s*4\u03c0\u03b5_?0\b/i, /\b\u03b5_?0A\s*\/\s*d\b/i, /\b\u03bcF\b|\bpF\b|\b\u03bcC\b/i, /\bqE\b/i]
            },
            {
                subject: 'Physics', chapter: 'Current Electricity',
                t1: ['wheatstone bridge', 'meter bridge', 'metre bridge', 'potentiometer', 'kirchhoff\'s law', 'ohm\'s law', 'drift velocity', 'internal resistance', 'galvanometer', 'shunt resistance', 'rc circuit', 'time constant', 'temperature coefficient of resistance', 'color code of resistor', 'post office box'],
                t2: ['resistor', 'resistance', 'emf of cell', 'ammeter', 'voltmeter', 'current through', 'potential difference', 'joule heating', 'equivalent resistance', 'circuit shown'],
                rx: [/\b\u03a9\b|\bk\u03a9\b|\bmA\b/i, /\bV\s*=\s*IR\b/i, /\bI\^?2R\b/i]
            },
            {
                subject: 'Physics', chapter: 'Moving Charges & Magnetism',
                t1: ['biot-savart', 'ampere\'s circuital law', 'lorentz force', 'cyclotron', 'moving coil galvanometer', 'magnetic dipole moment', 'toroid', 'solenoid', 'hall effect', 'magnetic field at centre of circular loop', 'bar magnet', 'earth\'s magnetic field', 'angle of dip', 'hysteresis', 'diamagnetic', 'paramagnetic', 'ferromagnetic'],
                t2: ['magnetic field', 'charged particle enters', 'helical path', 'current carrying wire', 'magnetic force', 'tesla', 'curie\'s law', 'susceptibility', 'permeability'],
                rx: [/\b\u03bc_?0I\s*\/\s*2/i, /\bq\(?v\s*[\u00d7x]\s*B\)?/i, /\bqvB\b/i, /\bBIL\b/i]
            },
            {
                subject: 'Physics', chapter: 'EMI & Alternating Current',
                t1: ['faraday\'s law', 'lenz\'s law', 'motional emf', 'self inductance', 'mutual inductance', 'eddy current', 'lcr circuit', 'series lcr', 'power factor', 'quality factor', 'resonance frequency', 'transformer', 'reactance', 'impedance', 'rms current', 'lc oscillation', 'lr circuit', 'choke coil'],
                t2: ['magnetic flux', 'induced emf', 'induced current', 'inductor', 'alternating current', 'ac source', 'phase angle', 'henry'],
                rx: [/\b-d\u03a6\s*\/\s*dt\b/i, /\bBlv\b/i, /\b\u03c9L\b/i, /\b1\s*\/\s*\u03c9C\b/i]
            },
            {
                subject: 'Physics', chapter: 'Ray & Wave Optics',
                t1: ['snell\'s law', 'total internal reflection', 'critical angle', 'lens maker\'s formula', 'concave mirror', 'convex mirror', 'convex lens', 'concave lens', 'minimum deviation', 'prism', 'compound microscope', 'astronomical telescope', 'young\'s double slit', 'ydse', 'fringe width', 'diffraction', 'single slit', 'polarisation', 'brewster\'s angle', 'malus law', 'resolving power', 'thin film interference'],
                t2: ['refractive index', 'focal length', 'magnification', 'apparent depth', 'optical path', 'coherent sources', 'interference', 'dark fringe', 'bright fringe', 'monochromatic light', 'polaroid', 'wavelength of light'],
                rx: [/\b1\/v\s*[\+\-]\s*1\/u\s*=\s*1\/f\b/i, /\b\u03bbD\s*\/\s*d\b/i]
            },
            {
                subject: 'Physics', chapter: 'Modern Physics & Semiconductors',
                t1: ['photoelectric effect', 'stopping potential', 'work function', 'threshold frequency', 'de broglie wavelength', 'binding energy per nucleon', 'nuclear fission', 'nuclear fusion', 'radioactive decay', 'half-life', 'decay constant', 'mass defect', 'x-ray', 'moseley\'s law', 'compton', 'p-n junction', 'zener diode', 'transistor', 'logic gate', 'nand gate', 'nor gate', 'rectifier', 'forward bias', 'reverse bias', 'depletion layer', 'photodiode'],
                t2: ['photon', 'electron volt', 'alpha particle', 'beta decay', 'gamma ray', 'activity', 'nucleus', 'semiconductor', 'n-type', 'p-type', 'diode', 'truth table', 'band gap'],
                rx: [/\bh\u03bd\s*-\s*\u03c6\b/i, /\beV_0\b/i, /\bN\s*=\s*N_0e\^?-\u03bbt\b/i, /\b\u03bb\s*=\s*h\s*\/\s*p\b/i]
            },

            // ======================== CHEMISTRY ========================
            {
                subject: 'Chemistry', chapter: 'Some Basic Concepts of Chemistry (Mole Concept)',
                t1: ['avogadro\'s number', 'empirical formula', 'molecular formula', 'limiting reagent', 'percentage purity', 'percentage yield', 'molarity', 'molality', 'mole fraction', 'stoichiometry', 'vapour density', 'law of multiple proportions', 'gram molecular mass', 'oleum', 'volume strength of h2o2'],
                t2: ['moles of', 'number of atoms', 'number of molecules', 'molar mass', 'atomic mass', 'at stp', 'at ntp', 'ppm', 'mass percent'],
                rx: [/\b6\.02[23]\s*[\u00d7x]\s*10\^?23\b/i, /\b22\.4\s*L\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Atomic Structure',
                t1: ['quantum number', 'principal quantum', 'azimuthal quantum', 'magnetic quantum', 'spin quantum', 'bohr\'s model', 'bohr radius', 'lyman series', 'balmer series', 'paschen series', 'brackett series', 'pfund series', 'rydberg constant', 'radial node', 'angular node', 'nodal plane', 'aufbau principle', 'pauli exclusion', 'hund\'s rule', 'heisenberg uncertainty', 'schrodinger wave equation', 'electronic configuration', 'orbital angular momentum'],
                t2: ['hydrogen-like', 'orbital', 'subshell', 'spectral lines', 'ionization energy of h', 'he+', 'li2+'],
                rx: [/\b-13\.6\s*Z\^?2\s*\/\s*n\^?2\b/i, /\b0\.529\s*n\^?2\b/i, /\b(?:1s|2s|2p|3s|3p|3d|4s|4p)\^?\d/i]
            },
            {
                subject: 'Chemistry', chapter: 'Periodic Classification',
                t1: ['ionization enthalpy', 'ionization energy', 'electron gain enthalpy', 'electron affinity', 'electronegativity', 'pauling scale', 'mulliken scale', 'diagonal relationship', 'isoelectronic species', 'lanthanoid contraction', 'screening effect', 'shielding constant', 'slater\'s rule', 'atomic radius', 'ionic radius'],
                t2: ['periodic table', 'across a period', 'down the group', 'metallic character', 'amphoteric oxide', 'acidic oxide', 'basic oxide', 'noble gas'],
                rx: [/\bIE_?[123]\b/i, /\bZ_?eff\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Chemical Bonding',
                t1: ['hybridisation', 'hybridization', 'vsepr', 'molecular orbital theory', 'bond order', 'fajan\'s rule', 'lattice energy', 'born-haber', 'hydrogen bonding', 'back bonding', 'banana bond', 'sp3d', 'sp3d2', 'lone pair', 'bond angle', 'formal charge', 'drago\'s rule', 'bent\'s rule'],
                t2: ['covalent character', 'ionic bond', 'sigma bond', 'pi bond', 'paramagnetic', 'diamagnetic', 'trigonal bipyramidal', 'square planar', 'octahedral', 'tetrahedral', 'see-saw', 't-shaped'],
                rx: [/\bsp3d2?\b|\bsp2\b|\bsp3\b/i, /\b(?:SF6|SF4|XeF4|XeF2|IF7|ClF3|NH3|PCl5|B2H6)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Gaseous States',
                t1: ['van der waals', 'compressibility factor', 'boyle temperature', 'critical temperature', 'critical pressure', 'graham\'s law of diffusion', 'dalton\'s law of partial pressure', 'effusion', 'real gas', 'ideal gas equation', 'charles law', 'boyle\'s law', 'inversion temperature', 'joule-thomson'],
                t2: ['partial pressure', 'rate of diffusion', 'rate of effusion', 'van der waal constant', 'excluded volume'],
                rx: [/\bPV\s*=\s*nRT\b/i, /\b\(P\s*\+\s*an\^?2/i, /\bZ\s*=\s*PV\s*\/\s*nRT\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Thermodynamics',
                t1: ['enthalpy of formation', 'enthalpy of combustion', 'enthalpy of neutralization', 'hess\'s law', 'bond dissociation energy', 'bond enthalpy', 'gibbs free energy', 'spontaneity', 'standard enthalpy', 'kirchhoff\'s equation', 'bomb calorimeter', 'entropy change of reaction', 'third law of thermodynamics', 'thermochemical equation'],
                t2: ['exothermic', 'endothermic', 'enthalpy change', 'free energy', 'kj/mol', 'kcal/mol', 'heat of reaction', 'heat of solution', 'heat of hydrogenation'],
                rx: [/\b\u0394H\b|\b\u0394G\b|\b\u0394S\b|\b\u0394U\b/, /\bkJ\s*mol/i]
            },
            {
                subject: 'Chemistry', chapter: 'Chemical Equilibrium',
                t1: ['le chatelier', 'equilibrium constant', 'degree of dissociation', 'reaction quotient', 'active mass', 'law of mass action', 'van\'t hoff equation', 'homogeneous equilibrium', 'heterogeneous equilibrium'],
                t2: ['reversible reaction', 'forward reaction', 'backward reaction', 'kp and kc', 'at equilibrium'],
                rx: [/\bK_?p\s*=\s*K_?c/i, /\bK_?p\b|\bK_?c\b/, /\u21cc|\u21cb|<=>/]
            },
            {
                subject: 'Chemistry', chapter: 'Ionic Equilibrium',
                t1: ['solubility product', 'common ion effect', 'buffer solution', 'henderson-hasselbalch', 'salt hydrolysis', 'ostwald dilution law', 'conjugate acid', 'conjugate base', 'bronsted-lowry', 'lewis acid', 'lewis base', 'acid-base indicator', 'phenolphthalein', 'methyl orange', 'titration curve', 'ionic product of water'],
                t2: ['weak acid', 'weak base', 'strong acid', 'degree of ionization', 'ph of', 'poh of', 'pka', 'pkb', 'precipitation'],
                rx: [/\bK_?sp\b|\bK_?a\b|\bK_?b\b|\bK_?w\b/, /\bpH\s*=\s*/i, /\bpK_?[ab]\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Redox Reactions',
                t1: ['oxidation number', 'oxidation state', 'disproportionation', 'comproportionation', 'n-factor', 'balancing redox', 'oxidising agent', 'oxidizing agent', 'reducing agent', 'half reaction'],
                t2: ['redox', 'oxidised', 'oxidized', 'reduced', 'electron transfer'],
                rx: [/\b(?:KMnO4|K2Cr2O7|Cr2O7|MnO4\-|C2O4|S2O3)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Equivalent Concept and Volumetric Analysis',
                t1: ['normality', 'gram equivalent', 'equivalent weight', 'equivalent mass', 'iodometric titration', 'iodimetric', 'back titration', 'double titration', 'hardness of water', 'milliequivalents', 'volumetric analysis'],
                t2: ['titrated against', 'titration', 'end point', 'equivalence point', 'molarity of kmno4'],
                rx: [/\bN_1V_1\s*=\s*N_2V_2\b/i, /\bmeq\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Solutions & Colligative Properties',
                t1: ['raoult\'s law', 'henry\'s law', 'elevation in boiling point', 'depression in freezing point', 'osmotic pressure', 'van\'t hoff factor', 'colligative property', 'azeotrope', 'ideal solution', 'non-ideal solution', 'positive deviation', 'negative deviation', 'isotonic solution', 'reverse osmosis', 'ebullioscopic', 'cryoscopic'],
                t2: ['vapour pressure', 'lowering of vapour pressure', 'molal elevation', 'molal depression', 'semipermeable membrane'],
                rx: [/\b\u0394T_?[bf]\s*=\s*i?\s*K_?[bf]/i, /\b\u03c0\s*=\s*i?CRT\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Electrochemistry & Kinetics',
                t1: ['nernst equation', 'kohlrausch\'s law', 'faraday\'s law of electrolysis', 'molar conductivity', 'equivalent conductivity', 'standard electrode potential', 'galvanic cell', 'electrolytic cell', 'fuel cell', 'lead storage battery', 'first order reaction', 'second order reaction', 'zero order reaction', 'arrhenius equation', 'activation energy', 'rate constant', 'order of reaction', 'molecularity', 'half-life of reaction', 'pseudo first order'],
                t2: ['anode', 'cathode', 'salt bridge', 'cell potential', 'emf of cell', 'rate law', 'rate determining step', 'collision theory', 'catalyst'],
                rx: [/\bE\^?\u00b0_?cell\b/i, /\b0\.0591?\s*\/\s*n\b/i, /\b0\.693\s*\/\s*k\b/i, /\b\u039b_?m\b/]
            },
            {
                subject: 'Chemistry', chapter: 'IUPAC Nomenclature',
                t1: ['iupac name', 'iupac nomenclature', 'principal functional group', 'parent chain', 'lowest locant', 'bicyclo', 'spiro compound', 'homologous series', 'degree of unsaturation'],
                t2: ['nomenclature', 'correct name of', 'double bond equivalent'],
                rx: [/\b\d+,\d+-(?:di|tri)?(?:methyl|ethyl|chloro|bromo|hydroxy)/i]
            },
            {
                subject: 'Chemistry', chapter: 'GOC-I',
                t1: ['inductive effect', 'resonance effect', 'mesomeric effect', 'hyperconjugation', 'hyper conjugable', 'electromeric effect', 'aromaticity', 'huckel\'s rule', 'antiaromatic', 'non-aromatic', 'non aromatic', 'homocyclic', 'heterocyclic', 'resonating structure', 'resonating structures', 'carbocation stability', 'carbanion stability', 'free radical stability', 'acidic strength', 'basic strength', 'more acidic than', 'more basic than', 'ortho effect', 'sir effect', 'tautomerism', 'tautomer', 'keto-enol', 'triad system', 'electron density increases in benzene', 'electron density decreases in benzene', 'inductively', 'through resonance', 'react with nahco3', 'functional isomer', 'functional isomerism', 'position isomer', 'metamers', 'constitutional isomer', 'ring-chain isomerism', 'structural isomers'],
                t2: ['canonical forms', 'delocalization', 'conjugation', 'alpha hydrogen', 'naphthalene', 'mono-anion', 'aromatic', 'nucleophilicity', 'electrophile', 'unstable at room temperature'],
                rx: [/\b4n\s*\+\s*2\b/i, /(?:\+|-|\u2013)[IMR]\b/, /\bNaHCO3\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'GOC-II',
                t1: ['sn1', 'sn2', 'e1', 'e2', 'e1cb', 'nucleophilic substitution', 'elimination reaction', 'saytzeff', 'zaitsev', 'hofmann elimination', 'walden inversion', 'racemisation', 'anchimeric assistance', 'neighbouring group participation', 'electrophilic aromatic substitution', 'friedel-crafts'],
                t2: ['leaving group', 'polar aprotic', 'polar protic', 'carbocation rearrangement', 'hydride shift', 'methyl shift', 'ring expansion'],
                rx: [/\bSN[12]\b|\bE1cb\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Stereochemistry',
                t1: ['optical isomerism', 'geometrical isomerism', 'geometrical isomers', 'enantiomer', 'enantiomers', 'diastereomer', 'diastereomers', 'meso compound', 'chiral centre', 'chiral carbon', 'racemic mixture', 'optical activity', 'specific rotation', 'cip rule', 'r/s configuration', 'e/z configuration', 'cis-trans', 'stable conformers', 'conformational', 'newman projection', 'fischer projection', 'chair conformation', 'staggered', 'eclipsed', 'gauche', 'plane of symmetry', 'centre of symmetry'],
                t2: ['stereoisomers', 'optically active', 'optically inactive', 'dextrorotatory', 'laevorotatory', 'atropisomerism', 'conformer', 'cis', 'trans'],
                rx: [/\b(?:2R|2S|3R|3S)\b/, /\b(?:cis|trans)\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Hydrocarbons',
                t1: ['wurtz reaction', 'kolbe electrolysis', 'markovnikov', 'anti-markovnikov', 'peroxide effect', 'kharasch effect', 'ozonolysis', 'hydroboration-oxidation', 'oxymercuration', 'birch reduction', 'lindlar\'s catalyst', 'baeyer\'s reagent', 'corey-house', 'dehydrohalogenation', 'alkane', 'alkene', 'alkyne', 'electrophilic addition'],
                t2: ['halogenation', 'nitration', 'sulphonation', 'hydration of alkyne', 'acidic alkyne', 'polymerization', 'aromatization'],
                rx: [/\b(?:O3\s*\/\s*Zn|B2H6|BH3|HBr\s*\/\s*R2O2|alc\.?\s*KOH|NaNH2|Pd\/BaSO4)\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Carbonyl Compounds, Alcohols & Acids',
                t1: ['aldol condensation', 'cannizzaro reaction', 'perkin reaction', 'claisen condensation', 'clemmensen reduction', 'wolff-kishner', 'haloform reaction', 'iodoform test', 'tollens\' reagent', 'fehling\'s solution', 'lucas test', 'victor meyer', 'reimer-tiemann', 'kolbe\'s reaction', 'williamson synthesis', 'pinacol-pinacolone', 'hvz reaction', 'hell-volhard-zelinsky', 'esterification', 'grignard reagent', 'rosenmund', 'stephen reduction', 'etard reaction', 'gattermann-koch', 'baeyer-villiger', 'beckmann rearrangement'],
                t2: ['aldehyde', 'ketone', 'carboxylic acid', 'phenol', 'alcohol', 'ether', 'hemiacetal', 'acetal', 'cyanohydrin', 'oxime', '2,4-dnp', 'pcc', 'jones reagent'],
                rx: [/\b(?:LiAlH4|NaBH4|RMgX|CH3MgBr|CrO3|KMnO4|SOCl2|PCl5|PBr3)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Amines & Biomolecules',
                t1: ['hofmann bromamide', 'gabriel phthalimide', 'carbylamine test', 'hinsberg\'s reagent', 'diazotisation', 'sandmeyer reaction', 'gattermann reaction', 'coupling reaction', 'schmidt reaction', 'curtius rearrangement', 'zwitterion', 'isoelectric point', 'peptide bond', 'glycosidic linkage', 'mutarotation', 'anomer', 'epimer', 'reducing sugar', 'sucrose', 'maltose', 'lactose', 'starch', 'cellulose', 'nucleotide', 'nucleoside', 'denaturation of protein'],
                t2: ['aniline', 'primary amine', 'secondary amine', 'tertiary amine', 'diazonium salt', 'amino acid', 'glucose', 'fructose', 'carbohydrate', 'vitamin', 'enzyme', 'dna', 'rna'],
                rx: [/\b(?:NaNO2\s*\/\s*HCl|HNO2|C6H5N2|CHCl3\s*\/\s*KOH)\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Coordination Compounds',
                t1: ['werner\'s theory', 'crystal field theory', 'crystal field splitting', 'spectrochemical series', 'chelate effect', 'ambidentate ligand', 'effective atomic number', 'synergic bonding', 'metal carbonyl', 'spin-only magnetic moment', 'high spin complex', 'low spin complex', 'jahn-teller', 'inner orbital complex', 'outer orbital complex', 'linkage isomerism', 'ionization isomerism'],
                t2: ['coordination number', 'ligand', 'complex ion', 'octahedral complex', 'tetrahedral complex', 'square planar complex', 'edta', 't2g', 'eg orbitals', 'bohr magneton'],
                rx: [/\b\[(?:Fe|Co|Ni|Cr|Cu|Pt|Mn|Zn)\([^\]]+\)\]/, /\b\u0394_?[ot]\b/]
            },
            {
                subject: 'Chemistry', chapter: 'p, d & f-Block Elements',
                t1: ['inert pair effect', 'lanthanoid', 'actinoid', 'transition metal', 'potassium permanganate', 'potassium dichromate', 'borax bead test', 'diborane', 'borazine', 'inorganic benzene', 'silicate', 'silicone', 'allotropes of phosphorus', 'oxyacids of phosphorus', 'oxyacids of sulphur', 'interhalogen', 'xenon fluorides', 'contact process', 'ostwald process', 'haber\'s process', 'metallurgy', 'ellingham diagram', 'froth floatation', 'zone refining', 'mond process', 'van arkel'],
                t2: ['p-block', 'd-block', 'f-block', 'group 13', 'group 14', 'group 15', 'group 16', 'group 17', 'group 18', 'noble gas', 'halogen', 'chalcogen', 'pnictogen', 'white phosphorus', 'red phosphorus'],
                rx: [/\b(?:H3PO[234]|H2SO[345]|H2S2O[78]|XeO[34]|B2H6|SiO2|Al2O3)\b/]
            },
            {
                subject: 'Chemistry', chapter: 's-Block Elements',
                t1: ['solvay process', 'plaster of paris', 'portland cement', 'washing soda', 'baking soda', 'caustic soda', 'quick lime', 'slaked lime', 'bleaching powder', 'alkali metal', 'alkaline earth metal', 'liquid ammonia blue solution', 'flame colouration', 'flame test'],
                t2: ['lithium', 'beryllium', 'magnesium', 'calcium', 'sodium carbonate', 'superoxide', 'peroxide', 'hydration enthalpy'],
                rx: [/\b(?:Na2CO3|NaHCO3|CaSO4|CaOCl2|KO2)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Hydrogen',
                t1: ['heavy water', 'ortho hydrogen', 'para hydrogen', 'permanent hardness', 'temporary hardness', 'calgon', 'zeolite', 'permutit', 'ion exchange resin', 'hydrogen peroxide', 'water gas', 'syngas', 'clark\'s method'],
                t2: ['hydride', 'interstitial hydride', 'saline hydride', 'd2o', 'h2o2'],
                rx: [/\bD2O\b|\bH2O2\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Environmental Chemistry',
                t1: ['photochemical smog', 'classical smog', 'biochemical oxygen demand', 'eutrophication', 'ozone depletion', 'greenhouse effect', 'acid rain', 'tropospheric pollution', 'stratospheric pollution'],
                t2: ['pollutant', 'methemoglobinemia', 'blue baby', 'dissolved oxygen'],
                rx: [/\b(?:BOD|COD|CFC|NOx|SOx)\b/]
            },

            // ======================== MATHEMATICS ========================
            {
                subject: 'Mathematics', chapter: 'Sets',
                t1: ['venn diagram', 'power set', 'symmetric difference', 'de morgan\'s law', 'cartesian product', 'number of subsets', 'proper subsets', 'disjoint sets'],
                t2: ['subset', 'universal set', 'complement of set', 'union and intersection'],
                rx: [/\bn\(A\s*[\u222aU]\s*B\)/i, /\bA\s*[\u2229\u222a]\s*B\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Relations',
                t1: ['equivalence relation', 'reflexive', 'symmetric', 'transitive', 'anti-symmetric', 'equivalence class', 'void relation'],
                t2: ['relation r on set', 'ordered pairs'],
                rx: [/\b\(a,\s*b\)\s*\u2208\s*R\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Basic Maths',
                t1: ['wavy curve', 'logarithmic inequality', 'modulus inequality', 'base change theorem', 'characteristic and mantissa', 'irrational inequality'],
                t2: ['logarithm', 'absolute value', 'real values of x satisfying'],
                rx: [/\blog_\{?[0-9a-z]+\}?/i, /\|x\s*[\+\-]\s*\d+\|/]
            },
            {
                subject: 'Mathematics', chapter: 'Quadratic Equations and Expressions',
                t1: ['location of roots', 'common root', 'nature of roots', 'discriminant', 'sum of roots', 'product of roots', 'quadratic expression', 'quadratic equation', 'both roots are positive', 'roots lie between', 'newton\'s formula for roots'],
                t2: ['alpha and beta are roots', 'roots of the equation', 'real roots', 'distinct roots', 'equal roots', 'imaginary roots', 'ax^2 + bx + c'],
                rx: [/\bax\^?2\s*\+\s*bx\s*\+\s*c\b/i, /\bb\^?2\s*-\s*4ac\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Quadratic Equations & Complex Numbers',
                t1: ['argand plane', 'de moivre\'s theorem', 'cube roots of unity', 'nth roots of unity', 'complex conjugate', 'principal argument', 'euler\'s form', 'rotation theorem', 'complex number', 'purely imaginary', 'purely real'],
                t2: ['modulus of z', 'arg(z)', 'amp(z)', 'iota', 'omega^3 = 1'],
                rx: [/\b\|z\s*[\+\-]/i, /\b(?:Re|Im|arg)\s*\(z\)/i]
            },
            {
                subject: 'Mathematics', chapter: 'Sequence and Series',
                t1: ['arithmetic progression', 'geometric progression', 'harmonic progression', 'arithmetico-geometric', 'am-gm inequality', 'am >= gm', 'telescoping series', 'method of difference', 'sum to n terms', 'sum to infinity', 'arithmetic mean', 'geometric mean', 'harmonic mean'],
                t2: ['common difference', 'common ratio', 'nth term', 'a.p.', 'g.p.', 'h.p.', 'a.g.p.', 'sequence', 'series'],
                rx: [/\b\u03a3\b|\bsum_\{?r=1\}?/i, /\b(?:A\.P\.|G\.P\.|H\.P\.)\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Binomial Theorem for any index',
                t1: ['binomial theorem', 'binomial expansion', 'binomial coefficient', 'general term', 'term independent of x', 'greatest term', 'numerically greatest term', 'multinomial theorem', 'middle term in expansion', 'remainder when divided by'],
                t2: ['coefficient of x^', 'expansion of (', 'sum of binomial'],
                rx: [/\b\^?nC_?r\b|\bC\(n,\s*r\)/]
            },
            {
                subject: 'Mathematics', chapter: 'Permutations and Combinations',
                t1: ['number of ways', 'circular permutation', 'derangement', 'beggar\'s method', 'stars and bars', 'non-negative integral solutions', 'positive integral solutions', 'rank of the word', 'dictionary order', 'pigeonhole principle', 'divisors of', 'grid paths', 'selection of'],
                t2: ['arranged in a row', 'committee of', 'letters of the word', 'digits without repetition', 'at least one', 'identical objects', 'distinct boxes', 'factorial'],
                rx: [/\b\^?nP_?r\b|\b\d+!\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Trigonometric Ratios and Identities',
                t1: ['compound angle', 'multiple angle', 'submultiple angle', 'conditional identity', 'sum to product', 'product to sum', 'telescoping trigonometric'],
                t2: ['trigonometric'],
                rx: [/\b(?:sin|cos|tan|cot|sec|cosec)\^?[23]?\s*[\(\u03b8\u03b1\u03b2A-C]/i]
            },
            {
                subject: 'Mathematics', chapter: 'Trigonometric Equations and Inequalities',
                t1: ['general solution', 'principal solution', 'number of solutions in [0, 2', 'trigonometric equation', 'trigonometric inequality'],
                t2: ['roots in the interval', 'sin x =', 'cos x =', 'tan x ='],
                rx: [/\b(?:sin|cos|tan)\s*[0-9]*x\s*[\+\-\=]/i, /\b2n\u03c0\b|\bn\u03c0\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Properties of Triangles',
                t1: ['sine rule', 'cosine rule', 'napier\'s analogy', 'circumradius', 'inradius', 'exradius', 'hero\'s formula', 'pedal triangle', 'm-n theorem', 'solution of triangle'],
                t2: ['in a triangle abc', 'semi-perimeter', 'angle a, b, c', 'sides a, b, c'],
                rx: [/\ba\s*\/\s*sin\s*A\b/i, /\br\s*=\s*\u0394\s*\/\s*s\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Straight Lines',
                t1: ['straight line', 'orthocentre', 'orthocenter', 'circumcentre', 'circumcenter', 'incentre', 'incenter', 'excentre', 'centroid', 'angle bisector', 'family of lines', 'concurrent lines', 'foot of perpendicular', 'image of point', 'mirror image of', 'intercept form', 'normal form', 'parametric form of line', 'slope-intercept', 'distance between parallel lines', 'oblique coordinate', 'shifting of origin', 'rotation of axes'],
                t2: ['slope of', 'collinear', 'vertices of triangle', 'parallelogram', 'rhombus', 'altitude through', 'median through', 'perpendicular bisector', 'cuts the lines', 'meets the coordinate axes'],
                rx: [/\by\s*=\s*mx\s*\+\s*c\b/i, /\bx\/a\s*\+\s*y\/b\s*=\s*1\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Pair of Lines',
                t1: ['pair of straight lines', 'homogeneous equation of second degree', 'homogenisation', 'homogenization', 'angle between pair of lines', 'joint equation of lines'],
                t2: ['represents a pair of', 'two straight lines', 'ax^2 + 2hxy + by^2'],
                rx: [/\bax\^?2\s*\+\s*2hxy\s*\+\s*by\^?2\b/i, /\bh\^?2\s*-\s*ab\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Circles',
                t1: ['radical axis', 'radical centre', 'radical center', 'orthogonal circles', 'orthogonally', 'chord of contact', 'director circle', 'common tangent', 'common tangents', 'direct common tangent', 'transverse common tangent', 'internal common tangent', 'common chord', 'family of circles', 'power of a point', 'coaxial circles', 'pole and polar', 'chord with given middle point', 'chord having middle point', 'length of tangent', 'length of the chord', 'bisecting circumference', 'touch coordinate axes', 'touching each other externally', 'two-unit circles', 'circle circumscribing', 'inside the circle'],
                t2: ['circle', 'circles', 'radius', 'radii', 'diameter', 'centre of circle', 'center of circle', 'circumcircle', 'incircle', 'tangents are drawn', 'tangent to the circle', 'touch a circle', 'cut the circle'],
                rx: [/\b2?x\^?2\s*\+\s*2?y\^?2\b/i, /\(x\s*[\-\+]\s*[\d\u03b1a-z]+\)\^?2\s*\+\s*\(y\s*[\-\+]\s*[\d\u03b2a-z]+\)\^?2\s*=\s*r\^?2/i, /\bC_?[1234]\b.*\bC_?[1234]\b/, /\bS_?[123]\b.*\bS_?[123]\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Parabola',
                t1: ['parabola', 'latus rectum', 'focal chord', 'focal distance', 'co-normal points', 'normal to the parabola', 'tangent to the parabola', 'directrix of parabola', 'vertex of parabola'],
                t2: ['focus and directrix', 'parametric point (at^2', 'subtangent', 'subnormal'],
                rx: [/\by\^?2\s*=\s*4ax\b/i, /\bx\^?2\s*=\s*4ay\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Ellipse',
                t1: ['ellipse', 'auxiliary circle', 'eccentric angle', 'major axis', 'minor axis', 'foci of ellipse', 'director circle of ellipse', 'conjugate diameters'],
                t2: ['eccentricity', 'semi-major', 'semi-minor', 'directrices'],
                rx: [/\bx\^?2\/a\^?2\s*\+\s*y\^?2\/b\^?2\s*=\s*1\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Hyperbola',
                t1: ['hyperbola', 'rectangular hyperbola', 'asymptotes', 'conjugate hyperbola', 'transverse axis', 'conjugate axis', 'foci of hyperbola'],
                t2: ['eccentricity > 1', 'xy = c^2'],
                rx: [/\bx\^?2\/a\^?2\s*-\s*y\^?2\/b\^?2\s*=\s*1\b/i, /\bxy\s*=\s*c\^?2\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Functions',
                t1: ['domain of the function', 'range of the function', 'one-one', 'injective', 'surjective', 'bijective', 'onto function', 'into function', 'inverse of function', 'composite function', 'periodic function', 'fundamental period', 'even and odd function', 'functional equation', 'greatest integer function', 'fractional part function', 'signum function'],
                t2: ['f(x + y)', 'f(xy)', 'f(g(x))', 'f^-1(x)', 'codomain'],
                rx: [/\bf\s*:\s*[RNZ]\s*[\-\u2192>]+\s*[RNZ]\b/, /\bf\(f\(x\)\)/i]
            },
            {
                subject: 'Mathematics', chapter: 'Limits, Continuity & Differentiability',
                t1: ['l\'hopital', 'l\'hospital', 'sandwich theorem', 'squeeze theorem', 'removable discontinuity', 'jump discontinuity', 'left hand limit', 'right hand limit', 'differentiable at', 'non-differentiable', 'continuous at', 'intermediate value theorem'],
                t2: ['evaluate the limit', 'limit exists', 'continuity', 'differentiability', 'indeterminate form'],
                rx: [/\blim_?\{?[a-z]\s*[\-\u2192>]+\s*[^\}\s]+\}?/i]
            },
            {
                subject: 'Mathematics', chapter: 'Methods of Differentiation',
                t1: ['implicit differentiation', 'logarithmic differentiation', 'parametric differentiation', 'higher order derivative', 'chain rule', 'leibnitz rule for derivative', 'derivative of inverse'],
                t2: ['find dy/dx', 'f\'(x)', 'f\'\'(x)', 'd^2y/dx^2', 'differentiate with respect to'],
                rx: [/\bdy\s*\/\s*dx\b/i, /\bd\^?2y\s*\/\s*dx\^?2\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Application of Derivatives (AOD)',
                t1: ['rolle\'s theorem', 'lagrange\'s mean value', 'lmvt', 'monotonicity', 'strictly increasing', 'strictly decreasing', 'local maxima', 'local minima', 'global maximum', 'global minimum', 'point of inflection', 'concave upward', 'concave downward', 'angle of intersection of two curves', 'rate of change', 'tangent and normal to curve'],
                t2: ['critical point', 'stationary point', 'extreme value', 'subtangent'],
                rx: [/\bf'\(c\)\s*=\s*0\b/i, /\bf'\(x\)\s*[><]\s*0\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Indefinite & Definite Integration',
                t1: ['integration by parts', 'partial fractions', 'king\'s property', 'newton-leibnitz', 'leibnitz rule', 'wallis formula', 'gamma function', 'reduction formula', 'limit of a sum', 'definite integral', 'indefinite integral', 'antiderivative', 'primitive of'],
                t2: ['integrate', 'integral of', 'dx =', 'evaluate the integral'],
                rx: [/\u222b|\\int\b/, /\b\d+\s*dx\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Differential Equations & Area',
                t1: ['differential equation', 'integrating factor', 'linear differential equation', 'homogeneous differential equation', 'variable separable', 'bernoulli differential', 'orthogonal trajectory', 'area bounded by', 'area enclosed by', 'order and degree of'],
                t2: ['particular solution', 'general solution of differential', 'curve passes through', 'area of the region'],
                rx: [/\bdy\/dx\s*[\+\-]\s*P\(?x\)?y\b/i, /\b(?:x\s*dy\s*[\+\-]\s*y\s*dx)\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Matrices & Determinants',
                t1: ['determinant', 'adjoint of matrix', 'cofactor', 'invertible matrix', 'singular matrix', 'non-singular matrix', 'skew-symmetric', 'symmetric matrix', 'orthogonal matrix', 'idempotent', 'nilpotent', 'involutory', 'cayley-hamilton', 'characteristic equation', 'cramer\'s rule', 'system of linear equations', 'non-trivial solution', 'trace of matrix', 'transpose of'],
                t2: ['matrix a', 'matrices a and b', 'det(a)', 'adj(a)', 'a^-1', 'eigenvalue', 'consistent', 'inconsistent'],
                rx: [/\badj\s*\(A\)/i, /\bdet\s*\(A\)/i]
            },
            {
                subject: 'Mathematics', chapter: 'Vectors & 3D Geometry',
                t1: ['scalar triple product', 'vector triple product', 'skew lines', 'shortest distance between', 'direction cosines', 'direction ratios', 'equation of plane', 'family of planes', 'foot of perpendicular on plane', 'image of point in plane', 'tetrahedron', 'parallelepiped', 'coplanar vectors', 'line of intersection of two planes', 'angle between line and plane'],
                t2: ['3d geometry', 'position vector', 'unit vector perpendicular', 'projection of vector', 'collinear points in space'],
                rx: [/\[\s*[a-z]\s+[a-z]\s+[a-z]\s*\]/, /\b(?:x-x_1)\/l\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Probability PU',
                t1: ['bayes\' theorem', 'bayes theorem', 'conditional probability', 'total probability', 'bernoulli trials', 'binomial distribution', 'random variable', 'probability distribution', 'independent events', 'mutually exclusive', 'exhaustive events', 'fair die', 'fair coin', 'pack of 52 cards', 'urn contains', 'bag contains'],
                t2: ['probability that', 'drawn at random', 'tossed', 'rolled', 'expected value', 'p(a/b)', 'p(a|b)'],
                rx: [/\bP\([AB]\s*[\|\/]\s*[AB]\)/, /\bP\([AB]\s*[\u2229\u222a]\s*[AB]\)/]
            },
            {
                subject: 'Mathematics', chapter: 'Statistics',
                t1: ['standard deviation', 'variance of', 'mean deviation', 'coefficient of variation', 'frequency distribution', 'median of data', 'grouped data'],
                t2: ['observations', 'mean and variance', 'arithmetic mean of observations'],
                rx: [/\b\u03c3\^?2\s*=\s*/]
            }
        ],

        loadFeedbackMemory() {
            try {
                const raw = localStorage.getItem(STORAGE_FEEDBACK_KEY);
                return raw ? JSON.parse(raw) : { total: 0, chapters: {} };
            } catch (_) {
                return { total: 0, chapters: {} };
            }
        },

        saveFeedbackMemory(mem) {
            try { localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(mem)); } catch (_) {}
        },

        learnCorrection(text, subject, chapter) {
            if (!text || !subject || !chapter) return;
            const mem = this.loadFeedbackMemory();
            const key = `${subject}::${chapter}`;
            if (!mem.chapters[key]) mem.chapters[key] = { count: 0, tokens: {} };
            mem.chapters[key].count++;
            mem.total++;

            const toks = Utils.normalizeForMatch(text)
                .split(/[^a-z0-9]+/)
                .filter(w => w.length >= 4 && !/^(?:that|this|with|from|find|what|then|when|which|where|have|will|been|into|equal|value|given|following|question|single|correct|option|integer|match|column|list)$/.test(w));

            for (const w of Array.from(new Set(toks)).slice(0, 40)) {
                mem.chapters[key].tokens[w] = (mem.chapters[key].tokens[w] || 0) + 1;
            }
            this.saveFeedbackMemory(mem);
        },

        matchDirectChapterTitle(headerOrPaperText, subjectLock = null) {
            const norm = Utils.normalizeForMatch(headerOrPaperText);
            if (!norm) return null;
            let best = null;
            for (const subj of ['Physics', 'Chemistry', 'Mathematics']) {
                if (subjectLock && subjectLock !== 'AUTO' && subjectLock !== subj) continue;
                for (const chap of JEE_CHAPTERS[subj]) {
                    const cleanChap = Utils.normalizeForMatch(chap).replace(/\([^)]*\)/g, '').replace(/\bpu\b/g, '').trim();
                    if (cleanChap.length < 4) continue;
                    const stem = cleanChap.endsWith('s') && cleanChap.length > 5 ? cleanChap.slice(0, -1) : cleanChap;
                    if (norm.includes(cleanChap) || (stem.length >= 5 && norm.includes(stem))) {
                        const score = cleanChap.length * 1.5;
                        if (!best || score > best.score) best = { subject: subj, chapter: chap, score };
                    }
                }
            }
            return best;
        },

        classify(questionText, options = {}) {
            const {
                paperName = '',
                pageHeader = '',
                subjectOverride = null,
                defaultSubject = 'AUTO',
                documentPrior = null
            } = options;

            const qNorm = Utils.normalizeForMatch(questionText);
            const rawQ = String(questionText || '');
            const lockedSubject = (subjectOverride && ['Physics', 'Chemistry', 'Mathematics'].includes(subjectOverride))
                ? subjectOverride
                : (defaultSubject && defaultSubject !== 'AUTO' ? defaultSubject : null);

            const scores = new Map();
            const subjectTotals = { Physics: 0, Chemistry: 0, Mathematics: 0 };

            const addScore = (subj, chap, pts) => {
                const k = `${subj}::${chap}`;
                scores.set(k, (scores.get(k) || 0) + pts);
                subjectTotals[subj] = (subjectTotals[subj] || 0) + pts;
            };

            // 1. Term-Frequency Weighted Syllabus Matching (multiple mentions of "circle" beat 1 mention of "angle bisector")
            for (const rule of this.SYLLABUS_RULES) {
                if (lockedSubject && rule.subject !== lockedSubject) continue;
                let pts = 0;

                for (const p of rule.t1) {
                    const hits = Utils.countSubstringHits(qNorm, p, 3);
                    if (hits > 0) pts += 12 + (hits - 1) * 5;
                }
                for (const t of rule.t2) {
                    const hits = Utils.countSubstringHits(qNorm, t, 4);
                    if (hits > 0) pts += 5.5 + (hits - 1) * 3.5;
                }
                for (const rx of rule.rx) {
                    if (rx.test(rawQ)) pts += 8.5;
                }
                if (pts > 0) addScore(rule.subject, rule.chapter, pts);
            }

            // 2. Cross-Subject Disambiguation
            if (!lockedSubject) {
                if (/\b(?:mole|molar|enthalpy|gibbs|hess|ph\b|pka|pkb|ksp|hybridis|organic|alkane|alkene|benzene|acid|base|ligand|complex|oxidation|reduction|catalyst|reaction|reagent|compound|isomer|conformer|tautomer)\b/i.test(qNorm)) {
                    subjectTotals.Chemistry += 7;
                }
                if (/\b(?:velocity|acceleration|force|mass|kg|m\/s|newton|pulley|friction|torque|moment of inertia|capacitor|resistor|circuit|magnetic|flux|lens|mirror|prism|satellite|pendulum|oscillat|shm|wave|frequency|piston|carnot|fluid)\b/i.test(qNorm)) {
                    subjectTotals.Physics += 7;
                }
                if (/\b(?:equation|roots|polynomial|triangle|circle|parabola|ellipse|hyperbola|matrix|determinant|integral|derivative|limit|continuous|differentiable|probability|permutation|combination|locus|slope|orthocentre|centroid|sequence|series|function|domain|range|theorem|prove that|chord|tangent)\b/i.test(qNorm)) {
                    subjectTotals.Mathematics += 7;
                }
                if (scores.has('Physics::Thermodynamics') && scores.has('Chemistry::Thermodynamics')) {
                    if (/\b(?:enthalpy|combustion|formation|bond energy|hess|gibbs|kj\/mol|reaction)\b/i.test(qNorm)) {
                        addScore('Chemistry', 'Thermodynamics', 14);
                    } else if (/\b(?:carnot|piston|p-v|pv diagram|cyclic|engine|refrigerator|monoatomic|diatomic)\b/i.test(qNorm)) {
                        addScore('Physics', 'Thermodynamics', 14);
                    }
                }
            }

            // 3. Direct Header / Paper Title Prior
            const titleHit = this.matchDirectChapterTitle(`${paperName} ${pageHeader}`, lockedSubject);
            if (titleHit) addScore(titleHit.subject, titleHit.chapter, 10.0);

            // 4. Per-Subject / Document Topic Prior
            if (documentPrior && (!lockedSubject || documentPrior.subject === lockedSubject)) {
                addScore(documentPrior.subject, documentPrior.chapter, documentPrior.weight || 10.0);
            }

            // 5. Local Naive Bayes Feedback Memory
            const mem = this.loadFeedbackMemory();
            if (mem.total > 0) {
                const toks = new Set(qNorm.split(/[^a-z0-9]+/).filter(w => w.length >= 4));
                for (const [key, entry] of Object.entries(mem.chapters)) {
                    const [subj, chap] = key.split('::');
                    if (lockedSubject && subj !== lockedSubject) continue;
                    let nbHits = 0;
                    for (const w of toks) if (entry.tokens[w]) nbHits += Math.min(3, entry.tokens[w]);
                    if (nbHits >= 2) addScore(subj, chap, Math.min(18, nbHits * 3.5));
                }
            }

            let bestKey = null, bestScore = -1, secondScore = 0;
            for (const [k, sc] of scores.entries()) {
                const subj = k.split('::')[0];
                const finalSc = sc + (subjectTotals[subj] || 0) * 0.18;
                if (finalSc > bestScore) {
                    secondScore = bestScore;
                    bestScore = finalSc;
                    bestKey = k;
                } else if (finalSc > secondScore) {
                    secondScore = finalSc;
                }
            }

            if (bestKey && bestScore > 0) {
                const [subject, chapter] = bestKey.split('::');
                const margin = bestScore - Math.max(0, secondScore);
                const confidence = Utils.clamp(0.50 + (margin / (bestScore + 10)) * 0.50, 0.45, 0.99);
                return { subject, chapter, confidence: Math.round(confidence * 100) / 100, score: Math.round(bestScore * 10) / 10 };
            }

            const fallbackSubj = lockedSubject || 'Physics';
            return {
                subject: fallbackSubj,
                chapter: JEE_CHAPTERS[fallbackSubj]?.[0] || 'General',
                confidence: lockedSubject ? 0.60 : 0.30,
                score: 0
            };
        },

        /**
         * Per-Subject Topic-Test & Worksheet Coherence Pass:
         * Computes dominant chapter priors SEPARATELY for Physics, Chemistry, and Mathematics!
         * That way on a 3-subject JEE Minor/Major Test (e.g. 18 SHM + 18 GOC/Stereo + 18 Circles),
         * diagram-heavy questions inside each subject cleanly inherit their subject's dominant chapter!
         */
        classifyDocumentBlocks(blocks, paperName, defaultSubject = 'AUTO') {
            // Merge stitched continuation text onto root blocks BEFORE classifying!
            const rootTextMap = new Map();
            for (const b of blocks) {
                const rootId = b.isContinuationFromPrev && b.stitchRootUid ? b.stitchRootUid : b.uid;
                const prev = rootTextMap.get(rootId) || '';
                const piece = b.ocrText || `${b.firstLineSnippet || ''} ${b.lastLineSnippet || ''}`;
                rootTextMap.set(rootId, `${prev} ${piece}`.trim());
            }

            const rootBlocks = blocks.filter(b => !b.isContinuationFromPrev);

            // Pass 1: Independent per-question classification using full stitched text
            const initial = rootBlocks.map(b => {
                const fullText = rootTextMap.get(b.uid) || b.ocrText || '';
                const res = this.classify(fullText, {
                    paperName,
                    pageHeader: b.pageHeader || '',
                    subjectOverride: b.subjectOverride || null,
                    defaultSubject
                });
                return { block: b, fullText, res };
            });

            // Compute dominant chapter prior PER SUBJECT (Physics / Chemistry / Mathematics)
            const subjectPriors = {};
            for (const subj of ['Physics', 'Chemistry', 'Mathematics']) {
                const subjItems = initial.filter(it => it.res.subject === subj && it.res.score >= 10);
                if (subjItems.length < 3) continue;
                const counts = new Map();
                for (const it of subjItems) {
                    counts.set(it.res.chapter, (counts.get(it.res.chapter) || 0) + 1);
                }
                const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                const [topChap, topCount] = sorted[0];
                const dominance = topCount / subjItems.length;
                if (dominance >= 0.55) {
                    subjectPriors[subj] = {
                        subject: subj,
                        chapter: topChap,
                        weight: dominance >= 0.75 ? 16.0 : 10.5
                    };
                }
            }

            // Pass 2: Re-score sparse/diagram-heavy or borderline questions using their subject's topic prior
            for (const item of initial) {
                const sPrior = subjectPriors[item.block.subjectOverride || item.res.subject] || null;
                if (sPrior && item.res.score < 22) {
                    const refined = this.classify(item.fullText, {
                        paperName,
                        pageHeader: item.block.pageHeader || '',
                        subjectOverride: item.block.subjectOverride || item.res.subject,
                        defaultSubject,
                        documentPrior: sPrior
                    });
                    item.block.subject = refined.subject;
                    item.block.chapter = refined.chapter;
                    item.block.chapterConfidence = Math.max(0.75, refined.confidence);
                } else {
                    item.block.subject = item.res.subject;
                    item.block.chapter = item.res.chapter;
                    item.block.chapterConfidence = item.res.confidence;
                }
            }

            // Single-subject worksheet summary prior (if all questions belong to 1 subject)
            const priorKeys = Object.keys(subjectPriors);
            const detectedWorksheetPrior = priorKeys.length === 1 ? subjectPriors[priorKeys[0]] : null;
            return { blocks, detectedWorksheetPrior, subjectPriors };
        }
    };

    // ========================================================================
    // MODULE 8: OPTIONAL LOCAL ONNX DOCLAYOUT-YOLO ADAPTER (onnxruntime-web)
    // ========================================================================
    const OnnxDocLayoutAdapter = {
        session: null,
        ort: null,
        inputSize: 1024,
        CLASS_NAMES: [
            'title', 'plain_text', 'abandon', 'figure', 'figure_caption',
            'table', 'table_caption', 'table_footnote', 'isolate_formula', 'formula_caption'
        ],

        async registerModel(modelUrl, ortGlobal = globalScope.ort) {
            if (!ortGlobal || !ortGlobal.InferenceSession) {
                throw new Error('onnxruntime-web (window.ort) is not loaded.');
            }
            this.ort = ortGlobal;
            this.session = await ortGlobal.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
            return true;
        },

        isReady() {
            return Boolean(this.session && this.ort);
        },

        async detectLayoutRegions(sourceCanvas, confThresh = 0.25, iouThresh = 0.45) {
            if (!this.isReady()) return null;
            const S = this.inputSize;
            const tmp = Utils.createCanvas(S, S);
            const ctx = tmp.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, S, S);
            ctx.drawImage(sourceCanvas, 0, 0, S, S);

            const rgba = ctx.getImageData(0, 0, S, S).data;
            const floatData = new Float32Array(3 * S * S);
            const planeSize = S * S;
            for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
                floatData[p] = rgba[i] / 255.0;
                floatData[planeSize + p] = rgba[i + 1] / 255.0;
                floatData[2 * planeSize + p] = rgba[i + 2] / 255.0;
            }

            const inputName = this.session.inputNames[0];
            const tensor = new this.ort.Tensor('float32', floatData, [1, 3, S, S]);
            const outputs = await this.session.run({ [inputName]: tensor });
            const outTensor = outputs[this.session.outputNames[0]];
            const data = outTensor.data;
            const dims = outTensor.dims;

            const rawBoxes = [];
            if (dims.length === 3 && dims[2] === 6) {
                const count = dims[1];
                for (let i = 0; i < count; i++) {
                    const off = i * 6;
                    const conf = data[off + 4];
                    if (conf < confThresh) continue;
                    const clsId = Math.round(data[off + 5]);
                    rawBoxes.push({
                        xmin: Utils.clamp((data[off] / S) * 1000, 0, 1000),
                        ymin: Utils.clamp((data[off + 1] / S) * 1000, 0, 1000),
                        xmax: Utils.clamp((data[off + 2] / S) * 1000, 0, 1000),
                        ymax: Utils.clamp((data[off + 3] / S) * 1000, 0, 1000),
                        conf,
                        label: this.CLASS_NAMES[clsId] || `cls_${clsId}`
                    });
                }
            }

            rawBoxes.sort((a, b) => b.conf - a.conf);
            const kept = [];
            for (const b of rawBoxes) {
                let suppressed = false;
                for (const k of kept) {
                    if (k.label === b.label && Utils.boxIoU(k, b) > iouThresh) { suppressed = true; break; }
                }
                if (!suppressed) kept.push(b);
            }
            return kept;
        }
    };

    // ========================================================================
    // MASTER ORCHESTRATOR: FULL MULTI-PAGE DOCUMENT PIPELINE
    // ========================================================================
    const DocumentPipeline = {
        async analyzeDocument(pdfDoc, userOptions = {}) {
            const cfg = { ...DEFAULT_CONFIG, ...userOptions };
            const paperName = userOptions.paperName || 'Test Paper';
            const defaultSubject = userOptions.defaultSubject || 'AUTO';
            const startPage = Math.max(1, Number(userOptions.startPage) || 1);
            const endPage = Math.min(pdfDoc.numPages, Number(userOptions.endPage) || pdfDoc.numPages);
            const onProgress = typeof userOptions.onProgress === 'function' ? userOptions.onProgress : null;
            const abortSignal = userOptions.abortSignal || null;

            const totalPages = Math.max(1, endPage - startPage + 1);
            const pageDataList = [];
            const parsedAnswerKeys = {};
            const parsedSolutionHints = {};
            let inPostQuestionSection = false;

            // ----------------------------------------------------------------
            // PHASE 1: Fast Token Inspection -> Sticky Skip on Answer Keys /
            // Solutions Pages -> High-Res Render + Clean Mask on Question Pages
            // ----------------------------------------------------------------
            for (let p = startPage; p <= endPage; p++) {
                if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
                const page = await pdfDoc.getPage(p);
                const rawTokens = await PDFVectorExtractor.extractPageTokens(page);

                if (cfg.enableAnswerKeyCutoff) {
                    const quickLines = PDFVectorExtractor.groupTokensIntoLines(rawTokens);
                    const quickText = quickLines.map(l => l.text).join(' ');
                    const akCheck = LayoutPartitioner.detectAnswerKeyPage(
                        quickLines,
                        quickText,
                        inPostQuestionSection,
                        Boolean(cfg.enableAnswerKeyParsing)
                    );

                    if (akCheck.isAnswerKey) {
                        inPostQuestionSection = true;
                        if (cfg.enableAnswerKeyParsing) {
                            Object.assign(parsedAnswerKeys, akCheck.parsedAnswers);
                            Object.assign(parsedSolutionHints, akCheck.parsedHints);
                        }
                        if (onProgress) {
                            onProgress({
                                phase: 'RENDER_AND_EXTRACT',
                                pageNum: p,
                                totalPages,
                                percent: Math.round(((p - startPage) / totalPages) * 45),
                                message: `Page ${p}/${endPage}: Skipped ${akCheck.isSolutionPage ? 'Solutions' : 'Answer Key'} page`
                            });
                        }
                        pageDataList.push({
                            pageNum: p,
                            pageIdx: p - startPage,
                            canvas: null,
                            rawTokens,
                            maskObj: null,
                            rulingLines: { hLines: [], vLines: [] },
                            components: [],
                            onnxRegions: null,
                            skewAngle: 0,
                            isAnswerKeyPage: true
                        });
                        continue;
                    }
                }

                if (onProgress) {
                    onProgress({
                        phase: 'RENDER_AND_EXTRACT',
                        pageNum: p,
                        totalPages,
                        percent: Math.round(((p - startPage) / totalPages) * 45),
                        message: `Analyzing layout & geometry of Page ${p}/${endPage}...`
                    });
                }

                const vp = page.getViewport({ scale: cfg.renderScale });
                const canvas = Utils.createCanvas(vp.width, vp.height);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: ctx, viewport: vp }).promise;

                let maskObj = PixelVision.buildCleanForegroundMask(canvas, cfg);
                let finalCanvas = canvas;
                let skewAngle = 0;
                if (rawTokens.length < cfg.minTextTokensForDigital) {
                    skewAngle = PixelVision.estimateSkewAngleFromMask(maskObj, cfg.deskewMaxDeg);
                    if (skewAngle !== 0) {
                        finalCanvas = PixelVision.deskewCanvasIfNeeded(canvas, skewAngle);
                        maskObj = PixelVision.buildCleanForegroundMask(finalCanvas, cfg);
                    }
                }

                const rulingLines = PixelVision.detectRulingLinesFromMask(maskObj);
                const components = PixelVision.extractConnectedComponents(maskObj.mask, maskObj.gw, maskObj.gh, 4);

                let onnxRegions = null;
                if (OnnxDocLayoutAdapter.isReady()) {
                    try { onnxRegions = await OnnxDocLayoutAdapter.detectLayoutRegions(finalCanvas); } catch (_) {}
                }

                pageDataList.push({
                    pageNum: p,
                    pageIdx: p - startPage,
                    canvas: finalCanvas,
                    rawTokens,
                    maskObj,
                    rulingLines,
                    components,
                    onnxRegions,
                    skewAngle,
                    isAnswerKeyPage: false
                });
            }

            // ----------------------------------------------------------------
            // PHASE 2: Safe Header/Footer Stripping + Document Column Consensus
            // + Table-Safe Recursive XY-Cut Zone Partitioning
            // ----------------------------------------------------------------
            const questionPagesOnly = pageDataList.filter(d => !d.isAnswerKeyPage);
            const hfInfoByPageNum = new Map();
            const hfList = PDFVectorExtractor.detectDocumentHeaderFooterBands(
                questionPagesOnly.map(d => d.rawTokens),
                cfg
            );
            questionPagesOnly.forEach((pd, idx) => {
                hfInfoByPageNum.set(pd.pageNum, hfList[idx]);
                pd.headerCutY = hfList[idx].headerCutY;
                pd.footerCutY = hfList[idx].footerCutY;
                pd.headerText = hfList[idx].headerText;
                pd.cleanTokens = hfList[idx].tokens;
            });

            const docConsensus = LayoutPartitioner.computeDocumentColumnConsensus(questionPagesOnly);

            const allCandidateAnchors = [];
            const pageZonesMap = new Map();
            let globalAnchorOrder = 0;
            const carryState = {
                runningSubject: (defaultSubject && defaultSubject !== 'AUTO') ? defaultSubject : null,
                pendingSectionBanner: false
            };

            for (const pd of pageDataList) {
                if (pd.isAnswerKeyPage) {
                    pageZonesMap.set(pd.pageNum, []);
                    continue;
                }

                const { orderedZones } = LayoutPartitioner.partitionPageIntoReadingZones(
                    pd.cleanTokens,
                    pd.maskObj,
                    pd.rulingLines,
                    pd.headerCutY,
                    pd.footerCutY,
                    docConsensus,
                    pd.pageNum,
                    carryState,
                    cfg
                );

                const enrichedZones = [];
                for (let zIdx = 0; zIdx < orderedZones.length; zIdx++) {
                    const zone = orderedZones[zIdx];
                    const zTokens = pd.cleanTokens.filter(t => {
                        const cx = (t.xmin + t.xmax) / 2;
                        return cx >= zone.xmin && cx <= zone.xmax && t.yMid >= zone.ymin && t.yMid <= zone.ymax;
                    });
                    const colLines = PDFVectorExtractor.groupTokensIntoLines(zTokens);
                    const medLineH = Utils.median(colLines.map(l => l.botNorm - l.topNorm)) || 13;

                    // Robust column left margin (15th percentile of line xmins so indented options/tables don't skew it)
                    const sortedXmins = colLines.map(l => l.xmin).sort((a, b) => a - b);
                    const colLeftMargin = sortedXmins.length > 0
                        ? sortedXmins[Math.floor(sortedXmins.length * 0.12)]
                        : zone.xmin + 10;

                    const passages = cfg.enablePassageLinking
                        ? AnchorSequenceSolver.detectPassageHeadersInColumn(colLines)
                        : [];

                    const zoneCandidates = [];
                    for (let lIdx = 0; lIdx < colLines.length; lIdx++) {
                        const ln = colLines[lIdx];
                        const prevLn = lIdx > 0 ? colLines[lIdx - 1] : null;
                        const evalRes = AnchorSequenceSolver.evaluateLineAsAnchor(ln, colLeftMargin, prevLn, medLineH, colLines, lIdx);
                        if (evalRes) {
                            const cand = {
                                uid: `anc_${pd.pageNum}_${zIdx}_${lIdx}`,
                                globalOrder: globalAnchorOrder++,
                                pageNum: pd.pageNum,
                                pageIdx: pd.pageIdx,
                                zoneIdx: zIdx,
                                lineIdx: lIdx,
                                line: ln,
                                zoneSubject: zone.subjectOverride || null,
                                afterSectionBanner: Boolean(zone.startsAfterSectionBanner && lIdx <= 3),
                                ...evalRes
                            };
                            zoneCandidates.push(cand);
                            allCandidateAnchors.push(cand);
                        }
                    }

                    enrichedZones.push({
                        ...zone,
                        zoneIdx: zIdx,
                        colLines,
                        medLineH,
                        passages,
                        candidates: zoneCandidates
                    });
                }

                pageZonesMap.set(pd.pageNum, enrichedZones);
            }

            // ----------------------------------------------------------------
            // PHASE 3: Global Monotonic Sequence Alignment (DP / Viterbi)
            // ----------------------------------------------------------------
            if (onProgress) {
                onProgress({
                    phase: 'GLOBAL_ALIGNMENT',
                    pageNum: endPage,
                    totalPages,
                    percent: 65,
                    message: 'Solving global question sequence & encapsulating diagrams...'
                });
            }

            const chosenAnchors = AnchorSequenceSolver.solveGlobalAnchorSequence(allCandidateAnchors);
            const chosenByZoneKey = new Map();
            for (const a of chosenAnchors) {
                const k = `${a.pageNum}_${a.zoneIdx}`;
                if (!chosenByZoneKey.has(k)) chosenByZoneKey.set(k, []);
                chosenByZoneKey.get(k).push(a);
            }

            // ----------------------------------------------------------------
            // PHASE 4: Build Question Blocks per Zone + Diagram Encapsulation
            // ----------------------------------------------------------------
            const allOrderedBlocks = [];
            const detectedPassages = [];
            let blockUidCounter = 1;

            for (const pd of pageDataList) {
                if (pd.isAnswerKeyPage) continue;
                const zones = pageZonesMap.get(pd.pageNum) || [];

                for (const zone of zones) {
                    const k = `${pd.pageNum}_${zone.zoneIdx}`;
                    const anchors = (chosenByZoneKey.get(k) || []).sort((a, b) => a.lineIdx - b.lineIdx);
                    const colLines = zone.colLines;
                    let zoneBlocks = [];

                    if (anchors.length > 0) {
                        // A. Check for unanchored leading content ABOVE the first anchor
                        const firstAnchorLineIdx = anchors[0].lineIdx;
                        if (firstAnchorLineIdx > 0) {
                            const preLines = colLines.slice(0, firstAnchorLineIdx);
                            const preText = preLines.map(l => l.text).join(' ');
                            const preYMin = Math.max(zone.ymin, Math.floor(preLines[0].topNorm - 6));
                            const preYMax = Math.min(anchors[0].line.topNorm - 3, Math.ceil(preLines[preLines.length - 1].botNorm + 8));

                            if (preYMax - preYMin >= 10 && preText.length >= 2) {
                                const passMatch = preText.match(LayoutPartitioner.PASSAGE_START_RX);
                                if (passMatch && cfg.enablePassageLinking) {
                                    detectedPassages.push({
                                        pageNum: pd.pageNum, colIdx: zone.colIdx,
                                        xmin: zone.xmin, xmax: zone.xmax, ymin: preYMin, ymax: preYMax,
                                        text: preText,
                                        fromQ: passMatch[1] ? parseInt(passMatch[1], 10) : anchors[0].qNumInt,
                                        toQ: passMatch[2] ? parseInt(passMatch[2], 10) : (anchors[0].qNumInt + 2)
                                    });
                                } else {
                                    zoneBlocks.push({
                                        uid: `blk_${blockUidCounter++}`,
                                        pageNum: pd.pageNum, colIdx: zone.colIdx, zoneIdx: zone.zoneIdx,
                                        xmin: zone.xmin, xmax: zone.xmax, ymin: preYMin, ymax: preYMax,
                                        lastTextBotNorm: preLines[preLines.length - 1].botNorm,
                                        questionNumber: 'CONT',
                                        hasExplicitAnchor: false,
                                        isOrphanLeadingSlice: true,
                                        followedBySectionBanner: false,
                                        ocrText: preText,
                                        firstLineSnippet: preLines[0]?.text || '',
                                        lastLineSnippet: preLines[preLines.length - 1]?.text || '',
                                        pageHeader: pd.headerText,
                                        subjectOverride: zone.subjectOverride,
                                        source: 'vector-orphan-head',
                                        confidence: 0.92
                                    });
                                }
                            }
                        }

                        // B. Build each anchored question block
                        for (let aIdx = 0; aIdx < anchors.length; aIdx++) {
                            const curA = anchors[aIdx];
                            const nextA = anchors[aIdx + 1];
                            const startL = curA.lineIdx;
                            let endL = nextA ? nextA.lineIdx - 1 : colLines.length - 1;

                            for (const pass of (zone.passages || [])) {
                                if (pass.lineIdx > startL && pass.lineIdx <= endL) {
                                    endL = pass.lineIdx - 1;
                                    const pEndL = nextA ? nextA.lineIdx - 1 : colLines.length - 1;
                                    const pLines = colLines.slice(pass.lineIdx, pEndL + 1);
                                    if (pLines.length > 0) {
                                        detectedPassages.push({
                                            pageNum: pd.pageNum, colIdx: zone.colIdx,
                                            xmin: zone.xmin, xmax: zone.xmax,
                                            ymin: Math.floor(pLines[0].topNorm - 5),
                                            ymax: Math.ceil(pLines[pLines.length - 1].botNorm + 6),
                                            text: pLines.map(l => l.text).join(' '),
                                            fromQ: pass.fromQ || (nextA ? nextA.qNumInt : curA.qNumInt + 1),
                                            toQ: pass.toQ || ((nextA ? nextA.qNumInt : curA.qNumInt + 1) + 2)
                                        });
                                    }
                                    break;
                                }
                            }

                            const sliceLines = colLines.slice(startL, Math.max(startL, endL) + 1);
                            const rawYMin = Math.max(zone.ymin, Math.floor(curA.line.topNorm - 7));
                            const lastBot = Math.max(...sliceLines.map(l => l.botNorm));
                            const rawYMax = nextA
                                ? Math.min(nextA.line.topNorm - 3, Math.max(lastBot + 10, nextA.line.topNorm - 6))
                                : Math.min(zone.ymax, Math.max(lastBot + 12, lastBot + 6));

                            zoneBlocks.push({
                                uid: `blk_${blockUidCounter++}`,
                                pageNum: pd.pageNum, colIdx: zone.colIdx, zoneIdx: zone.zoneIdx,
                                xmin: zone.xmin, xmax: zone.xmax,
                                ymin: Math.round(rawYMin),
                                ymax: Math.round(Math.max(rawYMin + cfg.minQuestionHeightNorm, rawYMax)),
                                anchorTopNorm: curA.line.topNorm,
                                anchorBotNorm: curA.line.botNorm,
                                lastTextBotNorm: lastBot,
                                questionNumber: curA.qNumStr,
                                hasExplicitAnchor: true,
                                isOrphanLeadingSlice: false,
                                followedBySectionBanner: Boolean(!nextA && zone.followedBySectionBanner),
                                ocrText: sliceLines.map(l => l.text).join(' '),
                                firstLineSnippet: sliceLines[0]?.text || '',
                                lastLineSnippet: sliceLines[sliceLines.length - 1]?.text || '',
                                pageHeader: pd.headerText,
                                subjectOverride: zone.subjectOverride,
                                source: 'vector-dp-anchor',
                                confidence: Utils.clamp(0.78 + (curA.baseScore / 35), 0.80, 0.99)
                            });
                        }
                    } else if (colLines.length > 0 && pd.cleanTokens.length >= cfg.minTextTokensForDigital) {
                        // C. Digital zone with ZERO anchors -> almost certainly a top-of-page continuation
                        //    sitting ABOVE a PART/SECTION banner (e.g. P03 top, P05 top, P08 top, P13 top)!
                        const zoneText = colLines.map(l => l.text).join(' ');
                        zoneBlocks.push({
                            uid: `blk_${blockUidCounter++}`,
                            pageNum: pd.pageNum, colIdx: zone.colIdx, zoneIdx: zone.zoneIdx,
                            xmin: zone.xmin, xmax: zone.xmax,
                            ymin: Math.max(zone.ymin, Math.floor(colLines[0].topNorm - 6)),
                            ymax: Math.min(zone.ymax, Math.ceil(colLines[colLines.length - 1].botNorm + 8)),
                            lastTextBotNorm: colLines[colLines.length - 1].botNorm,
                            questionNumber: 'CONT',
                            hasExplicitAnchor: false,
                            isOrphanLeadingSlice: true,
                            followedBySectionBanner: Boolean(zone.followedBySectionBanner),
                            ocrText: zoneText,
                            firstLineSnippet: colLines[0]?.text || '',
                            lastLineSnippet: colLines[colLines.length - 1]?.text || '',
                            pageHeader: pd.headerText,
                            subjectOverride: zone.subjectOverride,
                            source: 'vector-orphan-zone',
                            confidence: 0.92
                        });
                    } else {
                        // D. Scanned PDF (no text layer) -> Pixel Table / RLSA Fallback
                        const pixelBlocks = BoundaryRefiner.segmentZoneByPixels(zone, pd.maskObj, pd.rulingLines, cfg);
                        for (let pbIdx = 0; pbIdx < pixelBlocks.length; pbIdx++) {
                            const pb = pixelBlocks[pbIdx];
                            const pbText = colLines
                                .filter(l => l.yMid >= pb.ymin && l.yMid <= pb.ymax)
                                .map(l => l.text)
                                .join(' ');
                            zoneBlocks.push({
                                ...pb,
                                uid: `blk_${blockUidCounter++}`,
                                pageNum: pd.pageNum, colIdx: zone.colIdx, zoneIdx: zone.zoneIdx,
                                isOrphanLeadingSlice: false,
                                followedBySectionBanner: Boolean(pbIdx === pixelBlocks.length - 1 && zone.followedBySectionBanner),
                                ocrText: pbText,
                                firstLineSnippet: pbText.slice(0, 80),
                                lastLineSnippet: pbText.slice(-80),
                                pageHeader: pd.headerText,
                                subjectOverride: zone.subjectOverride
                            });
                        }
                    }

                    let compsForRefiner = pd.components;
                    if (Array.isArray(pd.onnxRegions) && pd.onnxRegions.length > 0) {
                        const onnxAsComps = pd.onnxRegions
                            .filter(r => r.label === 'figure' || r.label === 'table' || r.label === 'isolate_formula')
                            .map(r => ({
                                xmin: r.xmin, xmax: r.xmax, ymin: r.ymin, ymax: r.ymax,
                                wNorm: r.xmax - r.xmin, hNorm: r.ymax - r.ymin, isBorderFrame: false
                            }));
                        compsForRefiner = [...pd.components, ...onnxAsComps];
                    }

                    zoneBlocks = BoundaryRefiner.refineColumnBlocksWithDiagrams(
                        zoneBlocks,
                        zone,
                        pd.maskObj,
                        compsForRefiner,
                        colLines,
                        cfg
                    );

                    for (const b of zoneBlocks) allOrderedBlocks.push(b);
                }
            }

            // ----------------------------------------------------------------
            // PHASE 5: Cross-Column & Cross-Page Lookahead Stitching + Passages
            // ----------------------------------------------------------------
            if (onProgress) {
                onProgress({
                    phase: 'STITCH_AND_CLASSIFY',
                    pageNum: endPage,
                    totalPages,
                    percent: 85,
                    message: 'Resolving cross-page stitches & classifying JEE chapters...'
                });
            }

            StitchResolver.resolveDocumentStitches(allOrderedBlocks, cfg);

            for (const pass of detectedPassages) {
                for (const b of allOrderedBlocks) {
                    const qn = Utils.parseNumericQ(b.questionNumber);
                    if (!isNaN(qn) && pass.fromQ && pass.toQ && qn >= pass.fromQ && qn <= pass.toQ) {
                        b.sharedPassage = pass;
                    }
                }
            }

            // Optional Answer Key attachment (off by default unless enableAnswerKeyParsing: true)
            if (cfg.enableAnswerKeyParsing) {
                const rootQuestions = allOrderedBlocks.filter(b => !b.isContinuationFromPrev);
                const seenQNums = new Set();
                let hasSectionResets = false;
                for (const b of rootQuestions) {
                    const qn = String(Utils.parseNumericQ(b.questionNumber));
                    if (seenQNums.has(qn)) { hasSectionResets = true; break; }
                    seenQNums.add(qn);
                }
                rootQuestions.forEach((b, seqIdx) => {
                    const lookupKey = hasSectionResets ? String(seqIdx + 1) : String(Utils.parseNumericQ(b.questionNumber));
                    if (parsedAnswerKeys[lookupKey] && !b.answerKey) b.answerKey = parsedAnswerKeys[lookupKey];
                    if (parsedSolutionHints[lookupKey] && !b.hint) b.hint = `Concept: ${parsedSolutionHints[lookupKey]}`;
                });
            }

            // ----------------------------------------------------------------
            // PHASE 6: Per-Subject Multi-Layer Offline JEE Chapter Classification
            // ----------------------------------------------------------------
            const { detectedWorksheetPrior, subjectPriors } = JEEChapterClassifier.classifyDocumentBlocks(
                allOrderedBlocks,
                paperName,
                defaultSubject
            );

            // Propagate root question's subject/chapter/qNum to all stitched continuation slices
            const byUid = new Map(allOrderedBlocks.map(b => [b.uid, b]));
            for (const b of allOrderedBlocks) {
                if (b.isContinuationFromPrev && b.stitchRootUid && byUid.has(b.stitchRootUid)) {
                    const root = byUid.get(b.stitchRootUid);
                    b.subject = root.subject;
                    b.chapter = root.chapter;
                    b.subjectOverride = root.subject;
                    b.chapterConfidence = root.chapterConfidence;
                    b.questionNumber = root.questionNumber;
                }
            }

            const pagesOutput = pageDataList.map(pd => ({
                pageNum: pd.pageNum,
                canvas: pd.canvas,
                skewAngle: pd.skewAngle,
                isAnswerKeyPage: Boolean(pd.isAnswerKeyPage),
                headerCutY: pd.headerCutY,
                footerCutY: pd.footerCutY,
                blocks: allOrderedBlocks.filter(b => b.pageNum === pd.pageNum)
            }));

            if (onProgress) {
                onProgress({
                    phase: 'COMPLETE',
                    pageNum: endPage,
                    totalPages,
                    percent: 100,
                    message: `Detected ${allOrderedBlocks.filter(b => !b.isContinuationFromPrev).length} questions locally.`
                });
            }

            return {
                version: ENGINE_VERSION,
                paperName,
                totalPages,
                docConsensus,
                detectedWorksheetPrior,
                subjectPriors,
                parsedAnswerKeys,
                passages: detectedPassages,
                allBlocks: allOrderedBlocks,
                pages: pagesOutput
            };
        },

        cropBlockFromCanvas(sourceCanvas, block, padTopNorm = 8, padBottomNorm = 10) {
            const w = sourceCanvas.width;
            const h = sourceCanvas.height;
            const xMin = Utils.clamp((block.xmin ?? 8) - 4, 0, 960);
            const xMax = Utils.clamp((block.xmax ?? 992) + 4, xMin + 40, 1000);
            const yMin = Utils.clamp((block.ymin ?? 0) - padTopNorm, 0, 990);
            const yMax = Utils.clamp((block.ymax ?? 1000) + padBottomNorm, yMin + 14, 1000);

            const cropX = Math.floor((xMin / 1000) * w);
            const cropW = Math.max(60, Math.floor(((xMax - xMin) / 1000) * w));
            const cropY = Math.floor((yMin / 1000) * h);
            const cropH = Math.max(28, Math.floor(((yMax - yMin) / 1000) * h));

            const outW = Math.min(1150, cropW);
            const outH = Math.max(28, Math.round(cropH * (outW / cropW)));

            const raw = Utils.createCanvas(outW, outH);
            const ctx = raw.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, outW, outH);
            ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

            return {
                canvas: raw,
                dataUrl: raw.toDataURL('image/jpeg', 0.90),
                aspectRatio: raw.height / raw.width
            };
        },

        async stitchImagesVertically(dataUrls, gapPx = 6) {
            const valid = (dataUrls || []).filter(Boolean);
            if (valid.length === 0) return null;
            if (valid.length === 1) {
                const img = await new Promise((res, rej) => {
                    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = valid[0];
                });
                return { dataUrl: valid[0], aspectRatio: img.height / (img.width || 1) };
            }

            const imgs = await Promise.all(valid.map(src => new Promise((res, rej) => {
                const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src;
            })));

            const targetW = Math.max(...imgs.map(im => im.width));
            const scaledHeights = imgs.map(im => Math.round(im.height * (targetW / (im.width || 1))));
            const totalH = scaledHeights.reduce((a, b) => a + b, 0) + gapPx * (imgs.length - 1);

            const out = Utils.createCanvas(targetW, totalH);
            const ctx = out.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetW, totalH);

            let yOff = 0;
            for (let i = 0; i < imgs.length; i++) {
                ctx.drawImage(imgs[i], 0, yOff, targetW, scaledHeights[i]);
                yOff += scaledHeights[i] + gapPx;
            }

            return {
                canvas: out,
                dataUrl: out.toDataURL('image/jpeg', 0.90),
                aspectRatio: out.height / out.width
            };
        }
    };

    const PublicAPI = {
        version: ENGINE_VERSION,
        DEFAULT_CONFIG,
        JEE_CHAPTERS,
        analyzeDocument: (pdfDoc, options) => DocumentPipeline.analyzeDocument(pdfDoc, options),
        cropBlockFromCanvas: (canvas, block, padTop, padBot) => DocumentPipeline.cropBlockFromCanvas(canvas, block, padTop, padBot),
        stitchImagesVertically: (dataUrls, gapPx) => DocumentPipeline.stitchImagesVertically(dataUrls, gapPx),
        classifyQuestion: (text, options) => JEEChapterClassifier.classify(text, options),
        learnCorrection: (text, subject, chapter) => JEEChapterClassifier.learnCorrection(text, subject, chapter),
        registerOnnxModel: (modelUrl, ortGlobal) => OnnxDocLayoutAdapter.registerModel(modelUrl, ortGlobal),
        modules: {
            Utils,
            PixelVision,
            PDFVectorExtractor,
            LayoutPartitioner,
            AnchorSequenceSolver,
            BoundaryRefiner,
            StitchResolver,
            JEEChapterClassifier,
            OnnxDocLayoutAdapter
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PublicAPI;
    }
    globalScope.JEELocalVisionEngine = PublicAPI;

})(typeof window !== 'undefined' ? window : globalThis);
