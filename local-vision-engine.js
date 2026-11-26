/**
 * ============================================================================
 * JEE LOCAL VISION, BORDER, CROSS-PAGE STITCH & CHAPTER CLASSIFICATION ENGINE
 * File Name for GitHub: local-vision-engine.js
 * Version: 4.0.0
 * ============================================================================
 * 100% Offline, Zero-API Document Intelligence Engine for Indian JEE Papers
 * (Resonance, Allen, FIITJEE, BASE, Narayana, Sri Chaitanya, PW, JEE Main/Adv)
 *
 * v4.0.0 Major Upgrades:
 *  1. High-Res Pixel Vision (520px grid) + Watermark Suppression + Boxed-Table
 *     Enclosure Detection (prevents slicing through Matrix-Match tables).
 *  2. Text-Line-Protected Widest-Valley Snapping: cuts land at the CENTER of
 *     the cleanest ink-free whitespace band, never through ascenders/fractions.
 *  3. Proximity-Based Inter-Question Diagram & Inline Molecule Encapsulation
 *     + Tight Horizontal Ink-Extent Guards (never clips wide right equations).
 *  4. Word-Boundary-Safe JEE Syllabus Matcher (eliminates false hits like
 *     "whether"->ether, "translation"->trans, "line1/case2"->e1/e2, "internal"->rna).
 *  5. 16 Deterministic JEE Advanced Overlap Disambiguation Rules (RBD vs WPE,
 *     SHM vs NLM/RBD, Circles vs Straight Lines, Stereo vs GOC-I/II, etc.).
 *  6. Upgraded Self-Learning Memory (Unigrams + Bigrams + IDF Specificity +
 *     Optional Negative Downweighting) & Calibrated 3-Factor Confidence Score.
 *
 * 100% Drop-In Compatible with existing index.html & app.js Public API:
 *   window.JEELocalVisionEngine.analyzeDocument(pdfDoc, options)
 *   window.JEELocalVisionEngine.classifyQuestion(text, options)
 *   window.JEELocalVisionEngine.learnCorrection(text, subject, chapter, wrongChapter)
 *   window.JEELocalVisionEngine.cropBlockFromCanvas(canvas, block, padTop, padBot)
 *   window.JEELocalVisionEngine.stitchImagesVertically(dataUrls, gapPx)
 * ============================================================================
 */
(function (globalScope) {
    'use strict';

    const ENGINE_VERSION = '4.0.0';
    const STORAGE_FEEDBACK_KEY = 'jee_local_vision_nb_feedback_v1';

    const DEFAULT_CONFIG = {
        renderScale: 2.2,
        normMax: 1000,
        minTextTokensForDigital: 10,
        watermarkLumaCutoff: 194,
        watermarkChromaCutoff: 36,
        watermarkTextDarkCutoff: 135,
        headerBandMaxY: 108,
        footerBandMinY: 940,
        minQuestionHeightNorm: 14,
        verticalGutterMinFactor: 1.55,
        cclGridW: 520,
        deskewMaxDeg: 10,
        enableAnswerKeyCutoff: true,
        enableAnswerKeyParsing: false,
        enablePassageLinking: true,
        enableCrossColumnStitch: true,
        enableCrossPageStitch: true,
        debug: false
    };

    // ========================================================================
    // EXACT JEE CHAPTER TAXONOMY (Synchronized 1-to-1 with app.js)
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
            "Permutations & Combinations",
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
    // UTILITY HELPERS (With Word-Boundary-Safe Phrase Matching!)
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
        isWordCharCode(code) {
            return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
        },
        /**
         * Word-boundary-safe phrase hit counter.
         * Enforces non-alphanumeric boundaries whenever the needle starts or ends
         * with an alphanumeric character (stops "ether" matching "whether", "trans"
         * matching "translation", "e2" matching "case2", "rna" matching "internal").
         */
        countPhraseHits(haystack, needle, maxCap = 4) {
            if (!haystack || !needle) return 0;
            const nLen = needle.length;
            const hLen = haystack.length;
            const checkLeft = this.isWordCharCode(needle.charCodeAt(0));
            const checkRight = this.isWordCharCode(needle.charCodeAt(nLen - 1));

            let count = 0;
            let pos = 0;
            while (count < maxCap && pos <= hLen - nLen) {
                const idx = haystack.indexOf(needle, pos);
                if (idx < 0) break;
                const leftOk = !checkLeft || idx === 0 || !this.isWordCharCode(haystack.charCodeAt(idx - 1));
                const endIdx = idx + nLen;
                const rightOk = !checkRight || endIdx >= hLen || !this.isWordCharCode(haystack.charCodeAt(endIdx));
                if (leftOk && rightOk) {
                    count++;
                    pos = endIdx;
                } else {
                    pos = idx + 1;
                }
            }
            return count;
        },
        countSubstringHits(haystack, needle, maxCap = 4) {
            return this.countPhraseHits(haystack, needle, maxCap);
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
    // MODULE 1: WATERMARK-RESISTANT PIXEL VISION, CCL & TABLE BOX DETECTOR
    // ========================================================================
    const PixelVision = {
        computeAdaptiveOtsuThreshold(lumaArr) {
            const hist = new Uint32Array(256);
            const total = lumaArr.length;
            if (total === 0) return 182;
            for (let i = 0; i < total; i++) hist[lumaArr[i]]++;

            let sumAll = 0;
            for (let t = 0; t < 256; t++) sumAll += t * hist[t];

            let sumB = 0, wB = 0, maxVar = -1, bestT = 182;
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
            return Utils.clamp(bestT, 128, 214);
        },

        buildCleanForegroundMask(sourceCanvas, cfg = DEFAULT_CONFIG) {
            const sw = sourceCanvas.width;
            const sh = sourceCanvas.height;
            const scale = Math.min(1, cfg.cclGridW / Math.max(1, sw));
            const gw = Math.max(80, Math.round(sw * scale));
            const gh = Math.max(80, Math.round(sh * scale));

            const tmp = Utils.createCanvas(gw, gh);
            const tCtx = tmp.getContext('2d', { willReadFrequently: true });
            tCtx.fillStyle = '#FFFFFF';
            tCtx.fillRect(0, 0, gw, gh);
            tCtx.imageSmoothingEnabled = true;
            tCtx.imageSmoothingQuality = 'high';
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
            const hasCrispDarkText = veryDarkCount > gw * gh * 0.0025;
            const effectiveT = hasCrispDarkText ? Math.min(otsuT, cfg.watermarkLumaCutoff) : Math.min(otsuT + 14, 222);

            const mask = new Uint8Array(gw * gh);
            for (let p = 0; p < mask.length; p++) {
                const y = luma[p];
                const c = chroma[p];
                // Suppress pale tinted coaching watermarks while keeping colored diagram curves/axes
                if (hasCrispDarkText && y > 188 && c > cfg.watermarkChromaCutoff) {
                    mask[p] = 0;
                    continue;
                }
                // Suppress faint gray watermarks while preserving crisp anti-aliased thin lines
                if (hasCrispDarkText && y > 186 && c < 14) {
                    mask[p] = 0;
                    continue;
                }
                mask[p] = (y < effectiveT || (c > 42 && y < 214)) ? 1 : 0;
            }

            // Suppress giant low-fill diagonal coaching watermarks without touching diagrams/tables
            const preComps = this.extractConnectedComponents(mask, gw, gh, 3);
            for (const comp of preComps) {
                const bwNorm = (comp.maxX - comp.minX + 1) / gw;
                const bhNorm = (comp.maxY - comp.minY + 1) / gh;
                const area = Math.max(1, (comp.maxX - comp.minX + 1) * (comp.maxY - comp.minY + 1));
                const fill = comp.pixelCount / area;
                if (bwNorm > 0.46 && bhNorm > 0.36 && fill < 0.068 && !comp.isBorderFrame) {
                    this.clearComponentFromMask(mask, gw, comp, luma, 142);
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

            const minVRun = Math.floor(gh * 0.14);
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
                if (last && Math.abs(last.x - ln.x) < 6 && Utils.boxOverlap1D(last.ymin, last.ymax, ln.ymin, ln.ymax) > 60) {
                    last.x = (last.x + ln.x) / 2;
                    last.ymin = Math.min(last.ymin, ln.ymin);
                    last.ymax = Math.max(last.ymax, ln.ymax);
                    last.span = last.ymax - last.ymin;
                } else {
                    mergedV.push({ ...ln });
                }
            }

            // Detect enclosed boxed tables (Matrix-Match / List-I|List-II grids) so cuts NEVER slice them in half
            const tableBoxes = [];
            for (let i = 0; i < mergedV.length; i++) {
                const v = mergedV[i];
                if (v.span < 55 || v.span > 760) continue;
                const intersectingH = mergedH.filter(h =>
                    h.y >= v.ymin - 10 && h.y <= v.ymax + 10 &&
                    h.xmin <= v.x + 12 && h.xmax >= v.x - 12
                );
                if (intersectingH.length >= 2) {
                    const tYMin = Math.min(v.ymin, ...intersectingH.map(h => h.y));
                    const tYMax = Math.max(v.ymax, ...intersectingH.map(h => h.y));
                    const tXMin = Math.min(v.xmin ?? v.x, ...intersectingH.map(h => h.xmin));
                    const tXMax = Math.max(v.xmax ?? v.x, ...intersectingH.map(h => h.xmax));
                    if (tXMax - tXMin >= 200 && tYMax - tYMin >= 45 && tYMax - tYMin <= 780) {
                        const existing = tableBoxes.find(tb =>
                            Utils.boxOverlap1D(tb.ymin, tb.ymax, tYMin, tYMax) > 25 &&
                            Utils.boxOverlap1D(tb.xmin, tb.xmax, tXMin, tXMax) > 100
                        );
                        if (existing) {
                            existing.ymin = Math.min(existing.ymin, tYMin);
                            existing.ymax = Math.max(existing.ymax, tYMax);
                            existing.xmin = Math.min(existing.xmin, tXMin);
                            existing.xmax = Math.max(existing.xmax, tXMax);
                        } else {
                            tableBoxes.push({ xmin: tXMin, xmax: tXMax, ymin: tYMin, ymax: tYMax });
                        }
                    }
                }
            }

            return { hLines: mergedH, vLines: mergedV, tableBoxes };
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
         * Computes actual horizontal ink bounds [inkXMin, inkXMax] inside a vertical band
         * so wide right-aligned formulas/diagrams are never clipped and huge blank side margins are avoided.
         */
        measureHorizontalInkExtent(maskObj, yminNorm, ymaxNorm, zoneXMin, zoneXMax) {
            if (!maskObj) return { xmin: zoneXMin, xmax: zoneXMax };
            const { mask, gw, gh } = maskObj;
            const y0 = Utils.clamp(Math.floor((yminNorm / 1000) * gh), 0, gh - 1);
            const y1 = Utils.clamp(Math.ceil((ymaxNorm / 1000) * gh), y0 + 1, gh);
            const xLo = Utils.clamp(Math.floor((zoneXMin / 1000) * gw), 0, gw - 1);
            const xHi = Utils.clamp(Math.ceil((zoneXMax / 1000) * gw), xLo + 1, gw - 1);

            let firstX = -1, lastX = -1;
            for (let x = xLo; x <= xHi; x++) {
                let colInk = 0;
                for (let y = y0; y < y1; y++) {
                    if (mask[y * gw + x]) {
                        colInk++;
                        if (colInk >= 2) break;
                    }
                }
                if (colInk >= 2) {
                    if (firstX < 0) firstX = x;
                    lastX = x;
                }
            }
            if (firstX < 0 || lastX <= firstX) return { xmin: zoneXMin, xmax: zoneXMax };
            const padX = 10;
            return {
                xmin: Utils.clamp(Math.floor((firstX / gw) * 1000) - padX, zoneXMin, zoneXMax - 60),
                xmax: Utils.clamp(Math.ceil(((lastX + 1) / gw) * 1000) + padX, zoneXMin + 60, zoneXMax)
            };
        },

        /**
         * Text-Line-Protected Widest-Valley Snapping (v4.0):
         * Finds contiguous ink-free whitespace bands in [minAllowedNorm..maxAllowedNorm],
         * forbids snapping inside any vector text line, and picks the CENTER of the
         * cleanest wide whitespace valley rather than hugging ink by 1px!
         */
        snapYToCleanestValley(maskObj, targetNormY, minAllowedNorm, maxAllowedNorm, xminNorm, xmaxNorm, preferDir = 'UP', protectedLines = null) {
            if (!maskObj) return Math.round(Utils.clamp(targetNormY, minAllowedNorm, maxAllowedNorm));
            const { gh } = maskObj;
            const density = this.computeRowInkDensity(maskObj, xminNorm, xmaxNorm);
            let safeY = Utils.clamp(targetNormY, minAllowedNorm, maxAllowedNorm);

            // First push out of any overlapping vector text line
            if (Array.isArray(protectedLines) && protectedLines.length > 0) {
                for (let pass = 0; pass < 3; pass++) {
                    let pushed = false;
                    for (const ln of protectedLines) {
                        if (safeY >= ln.topNorm - 2.5 && safeY <= ln.botNorm + 2.5) {
                            if (preferDir === 'UP') {
                                const cand = Math.max(minAllowedNorm, ln.topNorm - 4);
                                if (cand < safeY) { safeY = cand; pushed = true; }
                            } else {
                                const cand = Math.min(maxAllowedNorm, ln.botNorm + 4);
                                if (cand > safeY) { safeY = cand; pushed = true; }
                            }
                        }
                    }
                    if (!pushed) break;
                }
            }

            const searchUp = preferDir === 'UP' ? 34 : 14;
            const searchDown = preferDir === 'DOWN' ? 34 : 14;
            const loNorm = Math.max(minAllowedNorm, safeY - searchUp);
            const hiNorm = Math.min(maxAllowedNorm, safeY + searchDown);

            const loRow = Utils.clamp(Math.floor((loNorm / 1000) * gh), 1, gh - 2);
            const hiRow = Utils.clamp(Math.ceil((hiNorm / 1000) * gh), loRow + 1, gh - 2);
            const centerRow = Utils.clamp(Math.round((safeY / 1000) * gh), loRow, hiRow);

            const hitsProtectedText = (row) => {
                if (!Array.isArray(protectedLines) || protectedLines.length === 0) return false;
                const yN = (row / gh) * 1000;
                for (const ln of protectedLines) {
                    if (yN >= ln.topNorm - 1.5 && yN <= ln.botNorm + 1.5) return true;
                }
                return false;
            };

            // Group contiguous clean whitespace rows into valleys and score by (width bonus - distance penalty)
            const valleys = [];
            let vStart = -1;
            for (let r = loRow; r <= hiRow; r++) {
                const isClean = density[r] <= 0.0012 && !hitsProtectedText(r);
                if (isClean) {
                    if (vStart < 0) vStart = r;
                } else if (vStart >= 0) {
                    valleys.push({ start: vStart, end: r - 1, width: r - vStart });
                    vStart = -1;
                }
            }
            if (vStart >= 0) valleys.push({ start: vStart, end: hiRow, width: hiRow - vStart + 1 });

            const goodValleys = valleys.filter(v => v.width >= 2);
            if (goodValleys.length > 0) {
                let bestRow = centerRow;
                let bestScore = -Infinity;
                for (const v of goodValleys) {
                    const midRow = Math.round((v.start + v.end) / 2);
                    const dist = Math.abs(midRow - centerRow);
                    const dirBonus = (preferDir === 'UP' && midRow <= centerRow) || (preferDir === 'DOWN' && midRow >= centerRow) ? 2.5 : 0;
                    const widthScore = Math.min(8, v.width * 1.15);
                    const sc = widthScore + dirBonus - dist * 0.45;
                    if (sc > bestScore) {
                        bestScore = sc;
                        bestRow = midRow;
                    }
                }
                return Math.round((bestRow / gh) * 1000);
            }

            // Fallback: pick row with minimum local ink density near centerRow
            let bestRow = centerRow, minInkScore = Infinity;
            for (let r = loRow; r <= hiRow; r++) {
                const textPen = hitsProtectedText(r) ? 0.5 : 0;
                const distPen = Math.abs(r - centerRow) * 0.00045;
                const sc = (density[r - 1] + density[r] * 2.2 + density[r + 1]) + distPen + textPen;
                if (sc < minInkScore) {
                    minInkScore = sc;
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
                    const topNorm = Utils.clamp(((pageH - (baselineY + fontH * 1.12)) / pageH) * 1000, 0, botNorm - 1);

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
                        if (cur.xmin - prev.xmax > 1.8) built += ' ';
                    }
                    built += cur.str;
                }
                ln.text = Utils.normalizeWhitespace(built);
                ln.firstToken = ln.tokens[0];
                ln.startsBold = Boolean(ln.tokens[0]?.isBold);
            }
            return lines.sort((a, b) => a.topNorm - b.topNorm);
        },

        detectDocumentHeaderFooterBands(allPageRawTokens, cfg = DEFAULT_CONFIG) {
            const numPages = allPageRawTokens.length;
            const headerPatterns = new Map();
            const footerPatterns = new Map();

            const canonicalKey = (str) =>
                Utils.normalizeForMatch(str)
                    .replace(/\bpage\s*\d+\s*(?:of\s*\d+)?\b/g, 'page #')
                    .replace(/\b\d+\b/g, '#')
                    .slice(0, 70);

            const PROTECTED_CONTENT_RX = /^(?:(?:Q(?:uestion|\.)?\s*)?\d{1,3}\s*[\.\)]|\([A-Da-d]\)|PART\s+\d|SECTION[\s\-]|EXERCISE|PASSAGE|COMPREHENSION)/i;
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
                    headerCutY: Utils.clamp(headerCutY, 0, 118),
                    footerCutY: Utils.clamp(footerCutY, 936, 1000),
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
                if (!isSolutionBody) {
                    const pairRx = /(?:^|\s)(?:Q\.?\s*)?(\d{1,3})\s*[\.\)\:\-]\s*(\(?[A-D](?:\s*,\s*[A-D])*\)?|-?\d+(?:\.\d+)?)(?=\s|$)/gi;
                    let m;
                    while ((m = pairRx.exec(fullText)) !== null) {
                        const qn = String(parseInt(m[1], 10));
                        if (!parsedAnswers[qn]) parsedAnswers[qn] = m[2].trim();
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

        computeDocumentColumnConsensus(questionPages) {
            let fullWidthProsePages = 0;
            let clearTwoColPages = 0;

            for (const pd of questionPages) {
                const lines = PDFVectorExtractor.groupTokensIntoLines(pd.cleanTokens || pd.rawTokens || []);
                const wideProse = lines.filter(l =>
                    l.xmin < 220 && l.xmax > 690 && l.text.length >= 38 &&
                    !this.SECTION_BANNER_RX.test(l.text)
                );
                if (wideProse.length >= 2) {
                    fullWidthProsePages++;
                } else if (lines.length >= 12) {
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

        detectZoneColumnSplit(tokensInZone, maskObj, rulingLines, ymin, ymax, docConsensus, cfg = DEFAULT_CONFIG) {
            const zoneH = Math.max(1, ymax - ymin);
            const zoneLines = PDFVectorExtractor.groupTokensIntoLines(tokensInZone);

            const crossingProseCount = zoneLines.filter(l =>
                l.xmin < 360 && l.xmax > 640 && l.text.length >= 30 &&
                !this.MATRIX_LEFT_RX.test(l.text) && !this.MATRIX_RIGHT_RX.test(l.text)
            ).length;
            if (crossingProseCount >= 2) {
                return { isTwoColumn: false, gutterX: 500, reason: 'veto-full-width-prose' };
            }

            const hasMatrixLeft = zoneLines.some(l => this.MATRIX_LEFT_RX.test(l.text));
            const hasMatrixRight = zoneLines.some(l => this.MATRIX_RIGHT_RX.test(l.text));
            const hasMatrixMatch = hasMatrixLeft && hasMatrixRight;

            const validateCandidateGutter = (gutterX) => {
                if (hasMatrixMatch) {
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

                    const rightAnchors = rightLines.filter(l =>
                        l.xmin <= gutterX + 95 && /^(?:Q\.?\s*\d+|\d{1,3}\s*[\.\)])(?:\s|$)/i.test(l.text)
                    );
                    const rightProse = rightLines.filter(l => (l.xmax - l.xmin) > 200 && l.text.length >= 25);

                    if (docConsensus?.isPredominantlySingleCol) {
                        if (rightAnchors.length === 0 || rightProse.length < 2) return false;
                    } else {
                        const maxRightX = Math.max(...rightLines.map(l => l.xmax), 0);
                        if (rightAnchors.length === 0 && (rightProse.length < 2 || maxRightX < 760)) {
                            return false;
                        }
                    }
                }
                return true;
            };

            for (const v of (rulingLines.vLines || [])) {
                if (v.x >= 445 && v.x <= 555) {
                    const overlap = Utils.boxOverlap1D(v.ymin, v.ymax, ymin, ymax);
                    if (overlap >= zoneH * 0.42) {
                        const crossingHRules = (rulingLines.hLines || []).filter(h =>
                            h.y >= v.ymin - 12 && h.y <= v.ymax + 12 &&
                            h.xmin < v.x - 14 && h.xmax > v.x + 14
                        ).length;
                        if (crossingHRules >= 2) continue;

                        const gx = Math.round(v.x);
                        if (validateCandidateGutter(gx)) {
                            return { isTwoColumn: true, gutterX: gx, reason: 'vertical-rule' };
                        }
                    }
                }
            }

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

        partitionPageIntoReadingZones(tokens, maskObj, rulingLines, headerCutY, footerCutY, docConsensus, pageNum, carryState, cfg = DEFAULT_CONFIG) {
            const bodyTokens = tokens.filter(t => t.botNorm > headerCutY && t.topNorm < footerCutY);
            const allLines = PDFVectorExtractor.groupTokensIntoLines(bodyTokens);

            const splitBands = [];
            for (const ln of allLines) {
                const txt = ln.text.trim();
                const center = (ln.xmin + ln.xmax) / 2;
                const isCentered = Math.abs(center - 500) < 165;
                const crossesMiddle = ln.xmin < 420 && ln.xmax > 580;
                const isShortHeader = txt.length <= 52;

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
            /^\s*\([P-Tp-t]\)\s*/,
            /^\s*\((?:i|ii|iii|iv|v|vi)\)\s*/i,
            /^\s*(?:Statement|Assertion|Reason|Column|List)[\s\-]*(?:I|II|1|2|A|B)\b/i,
            /^\s*(?:Option|Ans|Answer|Sol|Solution|Hint|Key)[\s\.\:\-]/i,
            /^\s*\d+\s*(?:cm|mm|m|km|kg|g|mg|s|ms|Hz|N|J|W|V|A|K|mol|atm|Pa|eV|MeV|rad|deg|°|%)\b/i,
            /^\s*\d+\s*[\+\-\*\/\=\<\>×÷]/
        ],

        evaluateLineAsAnchor(line, colLeftMargin, prevLine, medLineH, colLines, lineIdx, tableBoxes = []) {
            const txt = line.text.trim();
            if (!txt || txt.length < 2) return null;

            for (const rx of this.REJECT_LINE_RX) {
                if (rx.test(txt)) return null;
            }

            // Never treat a numbered entry inside a Matrix-Match table box as a new question anchor!
            const insideTable = (tableBoxes || []).some(tb =>
                line.yMid > tb.ymin + 6 && line.yMid < tb.ymax - 6 &&
                line.xmin >= tb.xmin - 4 && line.xmax <= tb.xmax + 4
            );
            if (insideTable && !/^Q(?:uestion|\.)?\s*\d+/i.test(txt)) {
                return null;
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
                    let score = 11.5;
                    if (relIndent < 32) score += 3.0;
                    if (line.startsBold) score += 2.0;
                    if (gapAbove > medLineH * 0.45) score += 1.5;
                    return { qNumStr: qStr, qNumInt: qInt, baseScore: score, style: 'EXPLICIT_Q', isExplicit: true };
                }
            }

            // 2. Numeric prefix "12." or "12)" (including standalone "1)", "2)", "3)" at column left margin)
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

            // 3. Parenthesized "(12)" at strict column left margin
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
    // MODULE 5: BOUNDARY REFINER, TABLE-SAFE CUTS & DIAGRAM ENCAPSULATION (v4)
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
                if (density[r] > 0.005) {
                    if (seenInk && whiteRun >= 2) gaps.push(whiteRun);
                    seenInk = true; whiteRun = 0;
                } else if (seenInk) whiteRun++;
            }
            const medGap = Utils.median(gaps) || 4;
            const splitGapRows = Math.max(8, Math.round(medGap * 2.1));
            const minBlockRows = Math.max(16, Math.round(gh * 0.042));

            let inBlock = false, bStart = rStart, wRun = 0;
            for (let r = rStart; r <= rEnd; r++) {
                if (density[r] > 0.005) {
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
         * v4.0 Edge & Diagram Refiner:
         *  - PASS A: Top-of-zone leading diagram capture (even above anchored Q.1 if close & unowned)
         *  - PASS B: Inline tall organic rings / equations sticking above line 1 + attached labels
         *  - PASS C: Proximity-aware diagram & table-box encapsulation (never slices a boxed table)
         *  - PASS D: Midpoint whitespace-valley separation between neighbors + text-line protected snap
         *  - PASS E: Tight horizontal ink-extent adjustment (keeps wide diagrams, avoids dead edges)
         */
        refineColumnBlocksWithDiagrams(blocks, zone, maskObj, components, colLines, rulingLines = null, cfg = DEFAULT_CONFIG) {
            if (!blocks || blocks.length === 0) return [];

            const zoneComps = (components || []).filter(c =>
                !c.isBorderFrame &&
                c.xmin >= zone.xmin - 12 && c.xmax <= zone.xmax + 12 &&
                c.ymin >= zone.ymin - 4 && c.ymax <= zone.ymax + 4 &&
                (c.wNorm >= 7 || c.hNorm >= 7)
            );
            const tableBoxes = (rulingLines?.tableBoxes || []).filter(tb =>
                Utils.boxOverlap1D(tb.xmin, tb.xmax, zone.xmin, zone.xmax) >= (zone.xmax - zone.xmin) * 0.35 &&
                tb.ymax >= zone.ymin && tb.ymin <= zone.ymax
            );

            // PASS A: Expand first block UPWARD to capture any diagram sitting between zone.ymin and block[0].ymin
            const firstB = blocks[0];
            if (firstB.isOrphanLeadingSlice || !firstB.hasExplicitAnchor) {
                const topComps = zoneComps.filter(c => c.ymin >= zone.ymin && c.ymax <= firstB.ymin + 14);
                if (topComps.length > 0) {
                    const minTopY = Math.min(...topComps.map(c => c.ymin));
                    firstB.ymin = Math.min(firstB.ymin, Math.max(zone.ymin, Math.floor(minTopY - 6)));
                    if (topComps.some(c => c.wNorm >= 55 && c.hNorm >= 35)) firstB.hasDiagram = true;
                }
            } else {
                // Even if Q.1 is anchored, capture a figure sitting directly above it (gap <= 28 norm units)
                const closeTopDiag = zoneComps.filter(c =>
                    c.ymin >= zone.ymin && c.ymax <= firstB.ymin + 10 &&
                    c.ymax >= firstB.ymin - 28 && (c.wNorm >= 45 || c.hNorm >= 24)
                );
                if (closeTopDiag.length > 0) {
                    const minTopY = Math.min(...closeTopDiag.map(c => c.ymin));
                    firstB.ymin = Math.min(firstB.ymin, Math.max(zone.ymin, Math.floor(minTopY - 6)));
                    firstB.hasDiagram = true;
                }
            }

            // PASS B: Expand ANY anchored question UPWARD if an inline tall chemical ring / formula overlaps line 1
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const aTop = b.anchorTopNorm ?? b.ymin;
                const aBot = b.anchorBotNorm ?? (aTop + 16);
                const hardCeiling = i > 0
                    ? Math.max(zone.ymin, (blocks[i - 1].lastTextBotNorm ?? blocks[i - 1].ymin) + 4)
                    : zone.ymin;

                const inlineCluster = zoneComps.filter(c =>
                    c.ymax >= aTop - 10 && c.ymin <= aBot + 12 &&
                    c.ymin < aTop - 6 && c.ymin >= hardCeiling - 2
                );

                if (inlineCluster.length > 0) {
                    let grew = true;
                    let guard = 0;
                    while (grew && guard++ < 5) {
                        grew = false;
                        const cMinX = Math.min(...inlineCluster.map(c => c.xmin)) - 20;
                        const cMaxX = Math.max(...inlineCluster.map(c => c.xmax)) + 20;
                        const cMinY = Math.min(...inlineCluster.map(c => c.ymin));
                        for (const cand of zoneComps) {
                            if (inlineCluster.includes(cand)) continue;
                            if (cand.ymin >= hardCeiling && cand.ymax >= cMinY - 15 && cand.ymin <= cMinY + 6 &&
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
                        if (i > 0 && blocks[i - 1].ymax > b.ymin - 2) {
                            blocks[i - 1].ymax = Math.max(blocks[i - 1].ymin + cfg.minQuestionHeightNorm, b.ymin - 2);
                        }
                    }
                }
            }

            // PASS C: Expand each block DOWNWARD to capture diagrams & full enclosed table boxes before next block
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const nextB = i < blocks.length - 1 ? blocks[i + 1] : null;
                const nextCeiling = nextB ? nextB.ymin - 2 : zone.ymax;

                // Protect enclosed tables belonging to block b
                for (const tb of tableBoxes) {
                    if (tb.ymin >= b.ymin - 6 && tb.ymin <= nextCeiling && tb.ymax <= nextCeiling + 14) {
                        b.ymax = Math.max(b.ymax, Math.min(nextCeiling, Math.ceil(tb.ymax + 6)));
                        b.hasDiagram = true;
                    }
                }

                const belowComps = zoneComps.filter(c =>
                    c.ymin >= b.ymin - 4 && c.ymax <= nextCeiling + 4
                );
                if (belowComps.length > 0) {
                    const maxBotY = Math.max(...belowComps.map(c => c.ymax));
                    b.ymax = Math.max(b.ymax, Math.min(nextCeiling, Math.ceil(maxBotY + 6)));
                    if (belowComps.some(c => c.wNorm >= 55 && c.hNorm >= 35)) {
                        b.hasDiagram = true;
                    }
                }
            }

            // PASS D: Center-of-Valley Boundary Snapping with Text-Line Protection & Non-Overlap Guarantee
            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const minAllowed = i > 0 ? Math.min(b.ymin, blocks[i - 1].ymax + 1) : Math.max(2, zone.ymin);
                const maxAllowed = i < blocks.length - 1
                    ? Math.max(b.ymin + cfg.minQuestionHeightNorm, blocks[i + 1].ymin - 1)
                    : Math.min(996, zone.ymax);

                const localLines = (colLines || []).filter(ln => ln.botNorm >= minAllowed - 10 && ln.topNorm <= maxAllowed + 10);

                b.ymin = PixelVision.snapYToCleanestValley(
                    maskObj, b.ymin, minAllowed, maxAllowed - cfg.minQuestionHeightNorm,
                    b.xmin + 4, b.xmax - 4, 'UP', localLines
                );
                b.ymax = PixelVision.snapYToCleanestValley(
                    maskObj, b.ymax, b.ymin + cfg.minQuestionHeightNorm, maxAllowed,
                    b.xmin + 4, b.xmax - 4, 'DOWN', localLines
                );

                // If adjacent blocks leave a tiny residual gap (< 18 norm units), place both edges cleanly around the valley midpoint
                if (i > 0 && b.ymin > blocks[i - 1].ymax) {
                    const gap = b.ymin - blocks[i - 1].ymax;
                    if (gap >= 4 && gap <= 20) {
                        const midY = Math.round((blocks[i - 1].ymax + b.ymin) / 2);
                        const snappedMid = PixelVision.snapYToCleanestValley(
                            maskObj, midY, blocks[i - 1].ymax, b.ymin,
                            b.xmin + 4, b.xmax - 4, 'UP', localLines
                        );
                        blocks[i - 1].ymax = Math.max(blocks[i - 1].ymin + cfg.minQuestionHeightNorm, snappedMid - 1);
                        b.ymin = Math.min(b.ymax - cfg.minQuestionHeightNorm, snappedMid + 1);
                    }
                }
            }

            // PASS E: Horizontal Extent Safety Check (keeps full column width on 1-col, prevents right-edge clipping on 2-col)
            if (maskObj) {
                for (const b of blocks) {
                    const ext = PixelVision.measureHorizontalInkExtent(maskObj, b.ymin, b.ymax, zone.xmin, zone.xmax);
                    // Only expand outward if ink reaches near zone edge, never shrink narrower than 78% of zone width
                    const minSpan = (zone.xmax - zone.xmin) * 0.78;
                    if ((ext.xmax - ext.xmin) >= minSpan) {
                        b.xmin = Math.min(b.xmin, ext.xmin);
                        b.xmax = Math.max(b.xmax, ext.xmax);
                    }
                }
            }

            return blocks;
        }
    };

    // ========================================================================
    // MODULE 6: 9-SIGNAL CROSS-COLUMN & CROSS-PAGE LOOKAHEAD STITCHER
    // ========================================================================
    const StitchResolver = {
        ORPHAN_OPTION_START_RX: /^\s*(?:\([B-Db-d2-4]\)|[B-D2-4]\)|\([Q-Tq-t]\)|[Q-T]\)|\([b-e]\)\s|Statement[\s\-]*(?:II|2)|Reason\s*\(R\)|Column[\s\-]*(?:II|2)|List[\s\-]*(?:II|2))/i,
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

            if (currBlock.hasExplicitAnchor && !currBlock.isOrphanLeadingSlice) {
                return { shouldStitch: false, score: -100, reasons: ['new-verified-anchor'] };
            }

            const prevText = Utils.normalizeWhitespace(prevBlock.ocrText || '');
            const prevLast = Utils.normalizeWhitespace(prevBlock.lastLineSnippet || prevText.slice(-90));
            const currText = Utils.normalizeWhitespace(currBlock.ocrText || '');
            const currFirst = Utils.normalizeWhitespace(currBlock.firstLineSnippet || currText.slice(0, 90));

            if (LayoutPartitioner.PASSAGE_START_RX.test(currFirst) || LayoutPartitioner.SECTION_BANNER_RX.test(currFirst)) {
                return { shouldStitch: false, score: -50, reasons: ['is-passage-or-section-header'] };
            }
            if (this.hasCompleteABCD(prevText) && this.hasCompleteABCD(currText)) {
                return { shouldStitch: false, score: -80, reasons: ['both-blocks-already-complete-ABCD'] };
            }

            let score = 0;
            const reasons = [];

            if (currBlock.isOrphanLeadingSlice) {
                score += 5.0;
                reasons.push('top-of-page-unanchored');
            }
            if (prevText.length <= 6 && /^\d{1,3}[\.\)]?$/.test(prevText)) {
                score += 10.0;
                reasons.push('prev-was-standalone-number-at-page-bottom');
            }

            const prevNum = Utils.parseNumericQ(prevBlock.questionNumber);
            const nextNum = nextBlock ? Utils.parseNumericQ(nextBlock.questionNumber) : NaN;
            if (!isNaN(prevNum) && !isNaN(nextNum) && nextNum === prevNum + 1) {
                score += 6.5;
                reasons.push(`sequence-lookahead-proof(Q.${prevNum}->Q.${nextNum})`);
            }

            if (currBlock.isOrphanLeadingSlice && currBlock.followedBySectionBanner) {
                score += 6.5;
                reasons.push('orphan-above-new-section-banner');
            }
            if (this.ORPHAN_OPTION_START_RX.test(currFirst)) {
                score += 8.0;
                reasons.push('orphaned-options-or-subpart-continuation');
            }
            if (this.OPTION_A_RX.test(prevText) && !this.OPTION_D_RX.test(prevText) && this.OPTION_D_RX.test(currText)) {
                score += 7.0;
                reasons.push('completes-ABCD-option-set');
            }
            if (this.INCOMPLETE_END_RX.test(prevLast)) {
                score += 4.0;
                reasons.push('prev-ends-mid-sentence');
            }
            if (/^[a-z]/.test(currFirst)) {
                score += 3.5;
                reasons.push('curr-starts-lowercase');
            }
            if (this.FIGURE_REF_RX.test(prevText) && (currBlock.hasDiagram || currText.length < 60)) {
                score += 4.5;
                reasons.push('diagram-or-table-continuation');
            }
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
    // MODULE 7: JEE ADVANCED MULTI-LAYER CHAPTER CLASSIFIER & SELF-LEARNER (v4)
    // ========================================================================
    const STOPWORDS = new Set([
        'that', 'this', 'with', 'from', 'find', 'what', 'then', 'when', 'which', 'where',
        'have', 'will', 'been', 'into', 'equal', 'value', 'given', 'following', 'question',
        'single', 'correct', 'option', 'options', 'integer', 'match', 'column', 'list',
        'statement', 'true', 'false', 'only', 'both', 'none', 'above', 'below', 'shown',
        'figure', 'diagram', 'graph', 'table', 'such', 'there', 'their', 'these', 'those',
        'about', 'after', 'before', 'between', 'under', 'over', 'same', 'each', 'other',
        'than', 'also', 'respect', 'respectively', 'section', 'part', 'paragraph', 'passage',
        'answer', 'based', 'information', 'calculate', 'determine', 'number', 'total',
        'system', 'point', 'points', 'length', 'time', 'mass', 'unit', 'units', 'take'
    ]);

    const JEEChapterClassifier = {
        SYLLABUS_RULES: [
            // ======================== PHYSICS ========================
            {
                subject: 'Physics', chapter: 'Basic Mathematics',
                t1: ['significant figures', 'order of magnitude', 'small angle approximation', 'binomial approximation', 'graph of y =', 'slope of tangent to graph'],
                t2: ['maxima and minima of', 'area under curve', 'differentiate with respect'],
                rx: [/\bd\/dt\s*\(/i]
            },
            {
                subject: 'Physics', chapter: 'Units and Measurements, Errors and Experiments',
                t1: ['vernier calliper', 'vernier caliper', 'screw gauge', 'micrometer screw', 'least count', 'zero error', 'percentage error', 'fractional error', 'dimensional formula', 'dimensional analysis', 'significant figure', 'pitch of screw', 'main scale division', 'vernier scale division', 'post office box', 'meter bridge'],
                t2: ['dimensions of', 'error in measurement', 'relative error', 'absolute error', 'systematic error', 'parallax'],
                rx: [/\[M\^?[\-\d]*L\^?[\-\d]*T\^?[\-\d]*\]/i, /\b\d+\s*msd\s*=\s*\d+\s*vsd\b/i]
            },
            {
                subject: 'Physics', chapter: 'Vectors',
                t1: ['resultant of two vectors', 'cross product', 'dot product', 'scalar product', 'vector product', 'unit vector perpendicular', 'resolution of vectors', 'polygon law of vectors', 'parallelogram law of vector'],
                t2: ['angle between vectors', 'component of vector', 'magnitude of resultant'],
                rx: [/[ijk]\s*[\^\u0302]\s*[\+\-]/]
            },
            {
                subject: 'Physics', chapter: 'Rectilinear Motion',
                t1: ['straight line motion', 'rectilinear motion', 'velocity-time graph', 'position-time graph', 'acceleration-time graph', 'stopping distance', 'uniformly accelerated', 'retarding force', 'freely falling body', 'dropped from a tower', 'dropped from height', 'thrown vertically upwards', 'average velocity', 'instantaneous velocity'],
                t2: ['constant acceleration', 'starts from rest', 'uniform retardation', 'displacement in nth second', 'v-t graph', 'x-t graph', 'a-t graph'],
                rx: [/\bs\s*=\s*ut\s*\+\s*(?:1\/2|0\.5)at/i, /\bv\^?2\s*=\s*u\^?2\s*[\+\-]\s*2as/i]
            },
            {
                subject: 'Physics', chapter: 'Projectile Motion',
                t1: ['projectile', 'horizontal range', 'maximum height', 'time of flight', 'equation of trajectory', 'projected at an angle', 'oblique projectile', 'inclined plane projectile', 'angle of projection', 'range on inclined plane'],
                t2: ['parabolic path', 'trajectory', 'fired horizontally', 'hits the ground', 'grazes'],
                rx: [/\by\s*=\s*x\s*tan/i, /\bu\^?2\s*sin\s*2/i]
            },
            {
                subject: 'Physics', chapter: 'Relative Motion',
                t1: ['relative velocity', 'river-boat', 'river boat', 'swimmer crosses a river', 'shortest path across river', 'minimum drift', 'rain appears to fall', 'umbrella at an angle', 'man holding umbrella', 'velocity of rain', 'closest approach', 'minimum separation between two particles', 'wind blows'],
                t2: ['relative to', 'downstream', 'upstream', 'drift', 'overtakes', 'chasing'],
                rx: [/\bv_\{?[a-z]{2}\}?\s*=/i]
            },
            {
                subject: 'Physics', chapter: 'Circular Kinematics',
                t1: ['circular motion', 'centripetal acceleration', 'tangential acceleration', 'angular velocity', 'angular acceleration', 'conical pendulum', 'banking of road', 'banked track', 'vertical circular motion', 'vertical circle', 'loop the loop', 'radius of curvature', 'centrifugal force'],
                t2: ['uniform circular', 'non-uniform circular', 'circular track', 'turning on road', 'cyclist bends'],
                rx: [/\bv\^?2\s*\/\s*r\b/i, /\b\u03c9\^?2\s*r\b/i]
            },
            {
                subject: 'Physics', chapter: "Newton's Laws of Motion",
                t1: ['newton\'s law', 'coefficient of friction', 'static friction', 'kinetic friction', 'limiting friction', 'angle of repose', 'pseudo force', 'atwood machine', 'pulley-block', 'string tension', 'normal reaction', 'wedge of mass', 'free body diagram', 'inextensible string', 'massless pulley', 'monkey climbs', 'apparent weight in lift', 'elevator accelerating'],
                t2: ['tension in string', 'frictionless surface', 'rough horizontal', 'rough inclined plane', 'blocks placed one over', 'pulley', 'incline', 'acceleration of block', 'spring balance'],
                rx: [/\b\u03bc_?[sk]?\s*=\s*0?\.\d/i, /\bf\s*=\s*\u03bc\s*n\b/i]
            },
            {
                subject: 'Physics', chapter: 'Work, Power and Energy',
                t1: ['work-energy theorem', 'work energy theorem', 'conservative force', 'non-conservative force', 'potential energy curve', 'potential energy function', 'stable equilibrium', 'unstable equilibrium', 'power delivered', 'instantaneous power', 'average power', 'work done by variable force', 'work done by friction', 'spring potential energy'],
                t2: ['kinetic energy', 'potential energy', 'conservation of mechanical energy', 'maximum compression of spring', 'elongation of spring', 'power of pump', 'efficiency of motor'],
                rx: [/\bF\s*=\s*-\s*dU\/dx\b/i, /\bU\s*\(\s*x\s*\)\s*=/i]
            },
            {
                subject: 'Physics', chapter: 'COM, Momentum and Collision',
                t1: ['centre of mass', 'center of mass', 'coefficient of restitution', 'elastic collision', 'inelastic collision', 'perfectly inelastic', 'head-on collision', 'oblique collision', 'conservation of linear momentum', 'impulse-momentum', 'rocket propulsion', 'variable mass', 'recoil velocity', 'ballistic pendulum', 'explosion into fragments', 'bullet embeds'],
                t2: ['collides elastically', 'collides head on', 'impulsive force', 'linear momentum', 'rebounds', 'cavity removed', 'chain falls'],
                rx: [/\be\s*=\s*(?:0\.\d+|1\/[2-9])\b/]
            },
            {
                subject: 'Physics', chapter: 'Rigid Body Mechanics',
                t1: ['moment of inertia', 'radius of gyration', 'parallel axis theorem', 'perpendicular axis theorem', 'pure rolling', 'rolling without slipping', 'angular momentum', 'conservation of angular momentum', 'torque about', 'rotational kinetic energy', 'instantaneous axis of rotation', 'angular impulse', 'toppling', 'hinged rod', 'uniform rod pivoted', 'flywheel', 'precession'],
                t2: ['rigid body', 'hollow sphere', 'solid sphere', 'solid cylinder', 'hollow cylinder', 'uniform disc', 'uniform ring', 'rotates about', 'pivoted at', 'hinge reaction', 'torque', 'rolling down'],
                rx: [/\bI\s*=\s*(?:1\/2|2\/5|2\/3|1\/12|1\/3)\s*m/i, /\b\u03c4\s*=\s*I\s*\u03b1\b/i]
            },
            {
                subject: 'Physics', chapter: 'Mechanical properties of Solids (Elasticity)',
                t1: ['young\'s modulus', 'young modulus', 'bulk modulus', 'shear modulus', 'modulus of rigidity', 'poisson\'s ratio', 'poisson ratio', 'hooke\'s law', 'breaking stress', 'tensile stress', 'longitudinal strain', 'volumetric strain', 'elastic potential energy per unit volume', 'thermal stress in wire', 'compressibility'],
                t2: ['elastic limit', 'yield point', 'wire stretches', 'extension in wire', 'steel wire', 'brass wire', 'stress-strain'],
                rx: [/\bY\s*=\s*(?:FL\/A|stress\/strain)/i]
            },
            {
                subject: 'Physics', chapter: 'Thermometry',
                t1: ['thermometer', 'celsius scale', 'fahrenheit scale', 'kelvin scale', 'triple point of water', 'faulty thermometer', 'platinum resistance thermometer', 'constant volume gas thermometer', 'ice point', 'steam point'],
                t2: ['temperature scale', 'reading of thermometer', 'thermometric property'],
                rx: [/\b(?:C\/5|F\s*-\s*32)\b/]
            },
            {
                subject: 'Physics', chapter: 'Thermal Expansion',
                t1: ['thermal expansion', 'coefficient of linear expansion', 'coefficient of superficial expansion', 'coefficient of volume expansion', 'bimetallic strip', 'apparent expansion of liquid', 'pendulum clock loses', 'pendulum clock gains', 'anomalous expansion of water'],
                t2: ['linear expansion', 'cubical expansion', 'heated from', 'thermal strain', 'diameter of hole'],
                rx: [/\b\u03b1\s*=\s*\d+(?:\.\d+)?\s*[x×]\s*10\^?-/i, /\b\u0394L\s*=\s*L\s*\u03b1/i]
            },
            {
                subject: 'Physics', chapter: 'Calorimetry',
                t1: ['calorimetry', 'principle of calorimetry', 'water equivalent', 'latent heat of fusion', 'latent heat of vaporization', 'specific heat capacity', 'mixture of ice and water', 'steam is passed into', 'ice melts', 'calorimeter'],
                t2: ['final temperature of mixture', 'grams of ice', 'grams of steam', 'specific heat'],
                rx: [/\bQ\s*=\s*m\s*s\s*\u0394T\b/i, /\bQ\s*=\s*m\s*L\b/i]
            },
            {
                subject: 'Physics', chapter: 'Heat Transfer',
                t1: ['thermal conductivity', 'thermal resistance', 'newton\'s law of cooling', 'stefan-boltzmann', 'stefan\'s law', 'wien\'s displacement law', 'kirchhoff\'s law of radiation', 'black body radiation', 'emissivity', 'absorptive power', 'emissive power', 'solar constant', 'temperature gradient', 'steady state conduction', 'ice layer on lake'],
                t2: ['conduction', 'convection', 'radiation', 'radiates energy', 'cooling curve', 'composite slab', 'rods in series'],
                rx: [/\bdQ\/dt\s*=\s*-?\s*kA/i, /\b\u03bb_?m\s*T\s*=/i, /\b\u03c3\s*A\s*T\^?4\b/i]
            },
            {
                subject: 'Physics', chapter: 'Kinetic Theory of Gases',
                t1: ['kinetic theory of gases', 'rms speed', 'root mean square speed', 'most probable speed', 'maxwell distribution', 'maxwell-boltzmann', 'mean free path', 'degrees of freedom', 'equipartition of energy', 'molar specific heat at constant', 'pressure exerted by ideal gas', 'collision frequency'],
                t2: ['monoatomic gas', 'diatomic gas', 'polyatomic gas', 'v_rms', 'boltzmann constant', 'translational kinetic energy of gas'],
                rx: [/\bv_?(?:rms|mp|avg)\b/i, /\b3RT\/M\b/i, /\bCp\s*-\s*Cv\s*=\s*R\b/i]
            },
            {
                subject: 'Physics', chapter: 'Thermodynamics',
                t1: ['first law of thermodynamics', 'second law of thermodynamics', 'carnot engine', 'carnot cycle', 'heat engine', 'refrigerator', 'coefficient of performance', 'isothermal process', 'adiabatic process', 'isobaric process', 'isochoric process', 'polytropic process', 'cyclic process', 'indicator diagram', 'p-v diagram', 'pv diagram', 'work done by gas', 'internal energy of gas', 'molar heat capacity of process'],
                t2: ['adiabatic expansion', 'isothermal compression', 'efficiency of engine', 'piston-cylinder', 'thermodynamic process', 'heat absorbed in cycle', 'bulk modulus of gas'],
                rx: [/\bPV\^?(?:\u03b3|gamma|\d+\/\d+)\s*=\s*const/i, /\bdQ\s*=\s*dU\s*\+\s*dW\b/i, /\b\u03b7\s*=\s*1\s*-\s*T/i]
            },
            {
                subject: 'Physics', chapter: 'Fluid Mechanics',
                t1: ['bernoulli\'s theorem', 'bernoulli\'s equation', 'archimedes principle', 'buoyant force', 'upthrust', 'pascal\'s law', 'hydraulic lift', 'equation of continuity', 'venturimeter', 'torricelli\'s law', 'velocity of efflux', 'surface tension', 'surface energy', 'excess pressure inside', 'soap bubble', 'capillary rise', 'angle of contact', 'jurin\'s law', 'stokes\' law', 'terminal velocity', 'coefficient of viscosity', 'reynolds number', 'poiseuille'],
                t2: ['hydrostatic pressure', 'floating block', 'submerged', 'manometer', 'u-tube', 'orifice', 'capillary tube', 'viscous drag', 'meniscus', 'rotating liquid'],
                rx: [/\b2T\s*cos\s*\u03b8/i, /\b6\s*\u03c0\s*\u03b7\s*r\s*v\b/i, /\bP\s*\+\s*1\/2\s*\u03c1\s*v/i]
            },
            {
                subject: 'Physics', chapter: 'Simple Harmonic Motion',
                t1: ['simple harmonic motion', 'simple harmonic oscillator', 'harmonic oscillator', 'time period of oscillation', 'time period of shm', 'angular frequency of oscillation', 'simple pendulum', 'compound pendulum', 'physical pendulum', 'torsional pendulum', 'seconds pendulum', 'restoring force', 'phase difference in shm', 'spring-block system', 'spring constant', 'mean position', 'extreme position', 'small oscillations', 'damped oscillation', 'forced oscillation'],
                t2: ['shm', 's.h.m', 'oscillates', 'oscillation', 'oscillator', 'amplitude of', 'time period', 'angular frequency', 'equilibrium position', 'mass-less spring', 'massless spring', 'spring of force constant', 'harmonic'],
                rx: [/\bT\s*=\s*2\s*(?:\u03c0|pi)\s*(?:sqrt|\u221a)/i, /\bx\s*=\s*A\s*(?:sin|cos)\s*\(\s*(?:\u03c9|omega)t/i, /\bd\^?2x\/dt\^?2\s*\+/i, /\b\u03c9\s*=\s*(?:sqrt|\u221a)\s*\(?k\/m/i]
            },
            {
                subject: 'Physics', chapter: 'Transverse waves (String Waves)',
                t1: ['transverse wave', 'wave on a string', 'stretched string', 'standing wave on string', 'stationary wave', 'fundamental frequency of string', 'sonometer', 'melde\'s experiment', 'nodes and antinodes', 'wave pulse on string', 'reflection at fixed end', 'reflection at free end', 'linear mass density', 'harmonic on string'],
                t2: ['string fixed at both ends', 'taut string', 'wave equation', 'wave speed on string', 'overtone of string', 'vibrating string'],
                rx: [/\by\s*\(\s*x\s*,\s*t\s*\)\s*=\s*A\s*(?:sin|cos)/i, /\bv\s*=\s*(?:sqrt|\u221a)\s*\(?T\/\u03bc/i]
            },
            {
                subject: 'Physics', chapter: 'Longitudinal Waves (Sound Waves)',
                t1: ['sound wave', 'doppler effect', 'apparent frequency', 'organ pipe', 'closed organ pipe', 'open organ pipe', 'resonance column', 'resonance tube', 'end correction', 'beat frequency', 'beats per second', 'tuning fork', 'intensity level in decibel', 'loudness in db', 'speed of sound in air', 'laplace correction', 'kundt\'s tube', 'acoustic'],
                t2: ['decibel', 'siren', 'echo', 'compression and rarefaction', 'pressure wave', 'displacement wave', 'audible'],
                rx: [/\b\u03b2\s*=\s*10\s*log/i, /\b(?:f_?1\s*-\s*f_?2)\b/]
            },
            {
                subject: 'Physics', chapter: 'Gravitation',
                t1: ['gravitational field', 'gravitational potential', 'gravitational potential energy', 'escape velocity', 'orbital velocity', 'kepler\'s law', 'geostationary satellite', 'polar satellite', 'acceleration due to gravity', 'variation of g with altitude', 'variation of g with depth', 'tunnel through earth', 'binary star', 'universal law of gravitation', 'binding energy of satellite'],
                t2: ['satellite', 'planet', 'orbit around', 'earth of radius r', 'spherical shell', 'elliptical orbit', 'apogee', 'perigee'],
                rx: [/\bGMm\/R/i, /\bGM\/r\^?2\b/i, /\bT\^?2\s*(?:\u221d|proportional)\s*r\^?3/i]
            },
            {
                subject: 'Physics', chapter: 'Electrostatics & Capacitors',
                t1: ['coulomb\'s law', 'electric field', 'electric potential', 'electric dipole', 'dipole moment', 'gauss\'s law', 'gauss law', 'electric flux', 'equipotential surface', 'parallel plate capacitor', 'spherical capacitor', 'cylindrical capacitor', 'dielectric slab', 'dielectric constant', 'capacitance', 'electrostatic potential energy', 'electrostatic pressure', 'earthing of shell', 'concentric conducting shells', 'van de graaff'],
                t2: ['point charge', 'charge density', 'charged sphere', 'capacitor', 'microfarad', 'charged capacitor', 'capacitors in series', 'capacitors in parallel', 'redistribution of charge'],
                rx: [/\b1\/4\u03c0\u03b5_?0\b/i, /\bQ\s*=\s*CV\b/, /\b\u03bcF\b/]
            },
            {
                subject: 'Physics', chapter: 'Current Electricity',
                t1: ['ohm\'s law', 'kirchhoff\'s law', 'kirchhoff\'s junction', 'wheatstone bridge', 'meter bridge', 'potentiometer', 'internal resistance', 'drift velocity', 'relaxation time', 'temperature coefficient of resistance', 'rc circuit', 'charging of capacitor', 'discharging of capacitor', 'time constant', 'galvanometer into ammeter', 'galvanometer into voltmeter', 'shunt resistance', 'color code of resistor', 'joule heating'],
                t2: ['resistor', 'resistance', 'ammeter', 'voltmeter', 'emf of cell', 'cells in parallel', 'cells in series', 'equivalent resistance', 'potential divider', 'power dissipated'],
                rx: [/\bV\s*=\s*IR\b/, /\bI\s*=\s*neAv_?d\b/i, /\b\u03a9\b/]
            },
            {
                subject: 'Physics', chapter: 'Moving Charges & Magnetism',
                t1: ['biot-savart', 'ampere\'s circuital law', 'ampere law', 'lorentz force', 'magnetic field due to', 'solenoid', 'toroid', 'cyclotron', 'helical path', 'pitch of helix', 'velocity selector', 'moving coil galvanometer', 'magnetic dipole moment', 'bar magnet', 'earth\'s magnetism', 'angle of dip', 'magnetic declination', 'diamagnetic', 'paramagnetic', 'ferromagnetic', 'hysteresis', 'curie\'s law', 'force between parallel currents'],
                t2: ['magnetic field', 'current carrying wire', 'circular loop carrying current', 'tesla', 'magnetic force', 'magnetic needle', 'gaussmeter'],
                rx: [/\bF\s*=\s*q\s*\(?v\s*[x×]\s*B\)?/i, /\b\u03bc_?0\s*I\s*\/\s*(?:2\u03c0r|2R|4\u03c0)/i]
            },
            {
                subject: 'Physics', chapter: 'EMI & Alternating Current',
                t1: ['faraday\'s law', 'lenz\'s law', 'motional emf', 'electromagnetic induction', 'self inductance', 'mutual inductance', 'induced emf', 'induced current', 'eddy current', 'lr circuit', 'lc oscillation', 'lcr circuit', 'series lcr', 'alternating current', 'impedance', 'reactance', 'inductive reactance', 'capacitive reactance', 'power factor', 'quality factor', 'resonant frequency', 'transformer', 'choke coil', 'wattless current', 'ac generator'],
                t2: ['magnetic flux', 'inductor', 'henry', 'rms current', 'rms voltage', 'phase angle in ac', 'step-up transformer', 'step-down transformer'],
                rx: [/\be\s*=\s*-?\s*d\u03a6\/dt\b/i, /\bX_?L\s*=\s*\u03c9L\b/i, /\bX_?C\s*=\s*1\/\u03c9C\b/i]
            },
            {
                subject: 'Physics', chapter: 'Ray & Wave Optics',
                t1: ['snell\'s law', 'refractive index', 'total internal reflection', 'critical angle', 'concave mirror', 'convex mirror', 'mirror formula', 'lens maker\'s formula', 'convex lens', 'concave lens', 'power of lens', 'prism', 'angle of minimum deviation', 'dispersive power', 'chromatic aberration', 'compound microscope', 'astronomical telescope', 'young\'s double slit', 'ydse', 'fringe width', 'thin film interference', 'diffraction', 'single slit diffraction', 'resolving power', 'polarization', 'brewster\'s law', 'malus\'s law', 'polaroid', 'optical path'],
                t2: ['focal length', 'real image', 'virtual image', 'magnification', 'slab of glass', 'apparent depth', 'coherent sources', 'interference', 'constructive interference', 'destructive interference'],
                rx: [/\b1\/v\s*[\+\-]\s*1\/u\s*=\s*1\/f\b/i, /\b\u03bc\s*=\s*sin\s*i\s*\/\s*sin\s*r\b/i, /\b\u03b2\s*=\s*\u03bbD\/d\b/i]
            },
            {
                subject: 'Physics', chapter: 'Modern Physics & Semiconductors',
                t1: ['photoelectric effect', 'work function', 'stopping potential', 'threshold frequency', 'threshold wavelength', 'de broglie wavelength', 'de-broglie', 'davisson-germer', 'x-ray', 'moseley\'s law', 'characteristic x-ray', 'cutoff wavelength', 'nuclear binding energy', 'mass defect', 'radioactive decay', 'half-life', 'half life', 'mean life', 'decay constant', 'alpha decay', 'beta decay', 'gamma decay', 'nuclear fission', 'nuclear fusion', 'q-value', 'p-n junction', 'zener diode', 'logic gate', 'nand gate', 'nor gate', 'xor gate', 'transistor', 'rectifier', 'band gap', 'semiconductor', 'truth table'],
                t2: ['photon', 'photocurrent', 'nucleus', 'nucleon', 'isotopes', 'activity in curie', 'becquerel', 'diode', 'forward bias', 'reverse bias', 'depletion layer'],
                rx: [/\bK_?max\s*=\s*h\u03bd\s*-/i, /\bN\s*=\s*N_?0\s*e\^?-\u03bbt\b/i, /\b\u03bb\s*=\s*h\/p\b/i]
            },

            // ======================== CHEMISTRY ========================
            {
                subject: 'Chemistry', chapter: 'Some Basic Concepts of Chemistry (Mole Concept)',
                t1: ['mole concept', 'avogadro\'s number', 'avogadro number', 'molar mass', 'empirical formula', 'molecular formula', 'limiting reagent', 'percentage yield', 'stoichiometry', 'molarity', 'molality', 'mole fraction', 'parts per million', 'percentage composition', 'oleums', 'percentage labelling of oleum', 'eudiometry', 'law of multiple proportions', 'vapour density'],
                t2: ['moles of', 'number of atoms', 'number of molecules', 'stp', 'ntp', 'ppm', 'gram atomic mass', 'combustion analysis'],
                rx: [/\b6\.02[23]\s*[x×]\s*10\^?23\b/i, /\b\d+(?:\.\d+)?\s*moles?\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Atomic Structure',
                t1: ['bohr\'s model', 'bohr model', 'quantum number', 'principal quantum number', 'azimuthal quantum number', 'magnetic quantum number', 'spin quantum number', 'radial node', 'angular node', 'nodal plane', 'heisenberg uncertainty', 'schrodinger wave equation', 'aufbau principle', 'pauli exclusion', 'hund\'s rule', 'electronic configuration', 'rydberg constant', 'lyman series', 'balmer series', 'paschen series', 'brackett series', 'pfund series', 'hydrogen spectrum', 'spectral lines', 'orbital angular momentum', 'probability density'],
                t2: ['1s2', '2s2', '2p6', '3d', '4f', 'orbital', 'degenerate orbitals', 'he+', 'li2+', 'hydrogen-like', 'wave function', 'psi'],
                rx: [/\b(?:n\s*=\s*[1-6].*l\s*=\s*[0-4]|[1-5][spdf]\^?\d+)\b/, /\bR_?H\s*\(\s*1\/n/i]
            },
            {
                subject: 'Chemistry', chapter: 'Periodic Classification',
                t1: ['periodic table', 'ionization enthalpy', 'ionization energy', 'electron gain enthalpy', 'electron affinity', 'electronegativity', 'pauling scale', 'mulliken scale', 'atomic radius', 'ionic radius', 'covalent radius', 'van der waals radius', 'isoelectronic species', 'lanthanoid contraction', 'diagonal relationship', 'effective nuclear charge', 'slater\'s rule', 'screening effect', 'shielding effect', 'amphoteric oxide'],
                t2: ['periodic trend', 'acidic oxide', 'basic oxide', 'neutral oxide', 'periodicity', 'inert pair effect', 'group 1', 'group 17'],
                rx: [/\bIE_?[123]\b/, /\bZ_?eff\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Chemical Bonding',
                t1: ['vsepr', 'hybridisation', 'hybridization', 'molecular orbital theory', 'bond order', 'bond angle', 'bond length', 'dipole moment', 'fajan\'s rule', 'fajan rule', 'lattice energy', 'born-haber cycle', 'hydrogen bonding', 'intermolecular hydrogen', 'intramolecular hydrogen', 'formal charge', 'drago\'s rule', 'bent\'s rule', 'banana bond', 'back bonding', 'pπ-dπ', 'pπ-pπ', 'sigma and pi bonds', 'see-saw', 'square planar', 'trigonal bipyramidal', 't-shaped', 'octahedral'],
                t2: ['sp3d2', 'sp3d', 'sp3', 'sp2', 'lone pair', 'bond pair', 'paramagnetic', 'diamagnetic', 'covalent character', 'polar molecule', 'non-polar', 'planar molecule'],
                rx: [/\bsp[23]?d[123]?\b/i, /\b(?:NH3|SF4|SF6|XeF4|XeF2|ClF3|PCl5|IF7|BF3|H2O)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Gaseous States',
                t1: ['van der waals equation', 'compressibility factor', 'boyle\'s law', 'charles\' law', 'gay-lussac\'s law', 'dalton\'s law of partial pressure', 'graham\'s law of diffusion', 'rate of effusion', 'critical temperature', 'critical pressure', 'critical volume', 'boyle temperature', 'inversion temperature', 'real gas', 'ideal gas equation', 'liquefaction of gas', 'barometer'],
                t2: ['partial pressure', 'effusion', 'diffusion', 'virial equation', 'amagat', 'excluded volume', 'ideal gas'],
                rx: [/\bZ\s*=\s*PV\/nRT\b/i, /\(\s*P\s*\+\s*a\s*n\^?2\/V\^?2\s*\)/i]
            },
            {
                subject: 'Chemistry', chapter: 'Thermodynamics',
                t1: ['enthalpy of formation', 'enthalpy of combustion', 'enthalpy of neutralization', 'enthalpy of atomization', 'bond dissociation enthalpy', 'bond enthalpy', 'hess\'s law', 'hess law', 'gibbs free energy', 'gibbs energy', 'spontaneity', 'standard entropy', 'entropy change of reaction', 'kirchhoff\'s equation', 'thermochemistry', 'bomb calorimeter', 'calorific value', 'resonance energy', 'enthalpy of solution', 'enthalpy of hydration', 'third law of thermodynamics'],
                t2: ['exothermic', 'endothermic', 'kj/mol', 'kcal/mol', 'enthalpy change', 'free energy change', 'spontaneous reaction'],
                rx: [/\b\u0394H\s*[°o]?\s*=\s*/i, /\b\u0394G\s*[°o]?\s*=\s*\u0394H/i, /\b\u0394U\s*=\s*q\s*\+\s*w\b/i, /\bkJ\s*mol\^?-1\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Chemical Equilibrium',
                t1: ['chemical equilibrium', 'le chatelier\'s principle', 'le chatelier', 'equilibrium constant', 'reaction quotient', 'degree of dissociation', 'law of mass action', 'van\'t hoff equation', 'homogeneous equilibrium', 'heterogeneous equilibrium', 'active mass'],
                t2: ['kp and kc', 'forward reaction', 'backward reaction', 'shifts towards', 'reversible reaction'],
                rx: [/\bK_?p\s*=\s*K_?c\s*\(RT\)/i, /\bK_?[pc]\s*=/i, /\bQ_?c\s*[<>]\s*K_?c\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Ionic Equilibrium',
                t1: ['ionic equilibrium', 'buffer solution', 'acidic buffer', 'basic buffer', 'henderson-hasselbalch', 'henderson equation', 'solubility product', 'common ion effect', 'salt hydrolysis', 'hydrolysis constant', 'ionic product of water', 'ostwald\'s dilution law', 'bronsted-lowry', 'conjugate acid', 'conjugate base', 'lewis acid', 'lewis base', 'acid-base indicator', 'phenolphthalein', 'methyl orange', 'titration curve'],
                t2: ['pka', 'pkb', 'pkw', 'ksp', 'weak acid', 'weak base', 'strong acid', 'strong base', 'precipitate forms', 'solubility of'],
                rx: [/\bpH\s*=\s*(?:pK_?a|\d)/i, /\bK_?sp\s*=/i, /\bK_?[abw]\s*=\s*\d/i]
            },
            {
                subject: 'Chemistry', chapter: 'Redox Reactions',
                t1: ['oxidation number', 'oxidation state', 'disproportionation reaction', 'comproportionation', 'oxidising agent', 'oxidizing agent', 'reducing agent', 'balancing redox', 'ion-electron method', 'half reaction', 'n-factor', 'redox reaction', 'stock notation'],
                t2: ['oxidised to', 'oxidized to', 'reduced to', 'redox', 'permanganate', 'dichromate'],
                rx: [/\b(?:MnO4-|Cr2O7\^?2-|C2O4\^?2-|S2O3\^?2-)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Equivalent Concept and Volumetric Analysis',
                t1: ['equivalent weight', 'equivalent mass', 'gram equivalent', 'normality', 'volumetric analysis', 'iodometric titration', 'iodimetric titration', 'back titration', 'double titration', 'hardness of water', 'volume strength of h2o2', 'available chlorine', 'bleaching powder', 'law of equivalence'],
                t2: ['milliequivalents', 'titrated against', 'end point', 'h2o2', 'normality of'],
                rx: [/\bN_?1V_?1\s*=\s*N_?2V_?2\b/i, /\b(?:11\.2|5\.6)\s*[x×]\s*[MN]\b/]
            },
            {
                subject: 'Chemistry', chapter: 'IUPAC Nomenclature',
                t1: ['iupac name', 'iupac nomenclature', 'correct iupac', 'principal functional group', 'lowest locant rule', 'spiro compound', 'bicyclo compound', 'systematic name of'],
                t2: ['nomenclature', 'prefix and suffix', 'numbering of carbon chain', 'bicyclo[', 'spiro['],
                rx: [/\b(?:bicyclo|spiro)\[\d+\.\d+/i, /\b\d,\d-di(?:methyl|ethyl|chloro|bromo)/i]
            },
            {
                subject: 'Chemistry', chapter: 'GOC-I',
                t1: ['inductive effect', 'mesomeric effect', 'resonance effect', 'resonating structure', 'canonical structure', 'hyperconjugation', 'hyper conjugable', 'alpha hydrogen', 'aromaticity', 'antiaromatic', 'anti-aromatic', 'non-aromatic', 'huckel\'s rule', 'huckel rule', 'tautomerism', 'keto-enol', 'acidic strength', 'acid strength', 'basic strength', 'basicity order', 'acidity order', 'carbocation stability', 'carbanion stability', 'free radical stability', 'ortho effect', 'sir effect', 'steric inhibition of resonance', 'electromeric effect', 'stronger than carbonic acid', 'nahco3', 'baking soda test', 'metamerism', 'functional isomer', 'position isomer', 'chain isomer', 'ring-chain isomerism', 'structural isomer'],
                t2: ['+m effect', '-m effect', '+m and -m', '+i effect', '-i effect', 'resonance hybrid', 'delocalisation', 'delocalization', 'conjugation', 'pka order', 'pkb order', 'most acidic', 'most basic', 'least acidic', 'least basic', 'carbonic acid', 'h2co3', 'enol content', 'heat of hydrogenation', 'heat of combustion'],
                rx: [/\b[\+\-][MIR]\s*effect\b/i, /\b(?:4n\s*\+\s*2)\s*(?:\u03c0|pi)/i, /\bNaHCO3\b/]
            },
            {
                subject: 'Chemistry', chapter: 'GOC-II',
                t1: ['sn1', 'sn2', 'e1cb', 'nucleophilic substitution', 'electrophilic aromatic substitution', 'carbocation rearrangement', 'hydride shift', 'methyl shift', 'ring expansion', 'ring contraction', 'saytzeff', 'zaitsev', 'hofmann elimination', 'walden inversion', 'racemisation', 'neighboring group participation', 'ngp', 'leaving group ability', 'nucleophilicity', 'polar protic solvent', 'polar aprotic solvent', 'rate of sn1', 'rate of sn2'],
                t2: ['e1', 'e2', 'nucleophile', 'electrophile', 'elimination reaction', 'substitution reaction', 'dehydrohalogenation', 'dehydration of alcohol', 'major product of reaction'],
                rx: [/\bS_?N[12]\b/i, /\bE[12](?:cb)?\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Stereochemistry',
                t1: ['stereochemistry', 'stereoisomer', 'enantiomer', 'diastereomer', 'meso compound', 'chiral centre', 'chiral center', 'chiral carbon', 'asymmetric carbon', 'optical activity', 'optically active', 'optically inactive', 'plane of symmetry', 'centre of symmetry', 'center of symmetry', 'alternating axis of symmetry', 'geometrical isomer', 'geometric isomer', 'cis-trans', 'e-z configuration', 'r-s configuration', 'cip rule', 'cahn-ingold-prelog', 'newman projection', 'fischer projection', 'sawhorse projection', 'chair conformation', 'boat conformation', 'staggered conformation', 'eclipsed conformation', 'gauche conformation', 'anti conformation', 'stable conformer', 'conformational isomer', 'racemic mixture', 'specific rotation', 'enantiomeric excess', 'epimer', 'anomer', 'atropisomerism', 'allenic', 'biphenyl'],
                t2: ['chiral', 'achiral', 'conformer', 'conformers', 'cis', 'trans', 'dextrorotatory', 'laevorotatory', 'inversion of configuration', 'retention of configuration', 'dipole moment of conformer'],
                rx: [/\b(?:[RZSE])[\-\s]?(?:isomer|configuration)\b/, /\b\([RS],\s*[RS]\)/]
            },
            {
                subject: 'Chemistry', chapter: 'Hydrocarbons',
                t1: ['wurtz reaction', 'kolbe\'s electrolysis', 'soda lime decarboxylation', 'corey-house', 'markovnikov', 'anti-markovnikov', 'peroxide effect', 'kharasch effect', 'ozonolysis', 'reductive ozonolysis', 'oxidative ozonolysis', 'hydroboration-oxidation', 'oxymercuration-demercuration', 'baeyer\'s reagent', 'lindlar\'s catalyst', 'birch reduction', 'friedel-crafts', 'friedel crafts', 'nitration of benzene', 'sulphonation', 'halogenation of alkane', 'aromatization', 'polymerization of alkyne', 'kucherov reaction', 'terminal alkyne', 'tollen\'s test for alkyne'],
                t2: ['alkane', 'alkene', 'alkyne', 'benzene', 'toluene', 'dehalogenation', 'catalytic hydrogenation', 'alc. koh', 'nbs', 'o3/zn'],
                rx: [/\bO_?3\s*\/\s*(?:Zn|H2O|Me2S)\b/i, /\b(?:BH3|B2H6)\s*\/?\s*H2O2\b/i, /\bHg\(OAc\)2\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Hydrogen',
                t1: ['heavy water', 'deuterium', 'tritium', 'ortho hydrogen', 'para hydrogen', 'hydride', 'interstitial hydride', 'saline hydride', 'temporary hardness', 'permanent hardness', 'calgon', 'zeolite', 'permutit', 'clark\'s method', 'hydrogen peroxide'],
                t2: ['d2o', 'dihydrogen', 'syngas', 'water gas', 'coal gasification'],
                rx: [/\bD_?2O\b/, /\b(?:CO\s*\+\s*H_?2)\b/]
            },
            {
                subject: 'Chemistry', chapter: 's-Block Elements',
                t1: ['alkali metal', 'alkaline earth metal', 'solvay process', 'castner-kellner', 'plaster of paris', 'gypsum', 'portland cement', 'dead burnt plaster', 'washing soda', 'quick lime', 'slaked lime', 'liquid ammonia solution', 'ammoniated electron', 'flame coloration', 'flame test', 'superoxide', 'beryllium anomalous'],
                t2: ['s-block', 'na2co3', 'nahco3', 'ca(oh)2', 'caso4', 'lioh', 'ko2', 'thermal stability of carbonates'],
                rx: [/\b(?:Na2CO3|CaSO4\.1\/2H2O|KO2|LiAlH4)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Environmental Chemistry',
                t1: ['photochemical smog', 'classical smog', 'acid rain', 'ozone depletion', 'cfc', 'greenhouse effect', 'global warming', 'biochemical oxygen demand', 'bod', 'chemical oxygen demand', 'eutrophication', 'tropospheric pollution', 'stratospheric pollution', 'green chemistry'],
                t2: ['pollutant', 'smog', 'ozone hole', 'dissolved oxygen', 'fluoride in drinking water'],
                rx: [/\bBOD\b/, /\bCFCs?\b/]
            },
            {
                subject: 'Chemistry', chapter: 'p-Block Elements',
                t1: ['diborane', 'borax', 'boric acid', 'borazine', 'inorganic benzene', 'silicates', 'silicones', 'allotropes of carbon', 'fullerene', 'graphite', 'haber\'s process', 'ostwald\'s process', 'contact process', 'brown ring test', 'aqua regia', 'allotropes of phosphorus', 'white phosphorus', 'red phosphorus', 'phosphine', 'oxoacids of phosphorus', 'oxoacids of sulphur', 'oleum', 'interhalogen', 'pseudohalogen', 'xenon fluorides', 'noble gas', 'chlorine water', 'bleaching action'],
                t2: ['p-block', 'b2h6', 'h3bo3', 'b3n3h6', 'nh3', 'hno3', 'h2so4', 'h3po4', 'h3po3', 'h3po2', 'pcl5', 'so2', 'cl2', 'xef4', 'xef6'],
                rx: [/\b(?:B2H6|H3BO3|H3PO[234]|H2SO[45]|H2S2O[78]|XeO[34]|XeF[246])\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Electrochemistry & Kinetics',
                t1: ['nernst equation', 'electrode potential', 'standard reduction potential', 'galvanic cell', 'electrolytic cell', 'faraday\'s law of electrolysis', 'kohlrausch\'s law', 'molar conductivity', 'equivalent conductivity', 'specific conductance', 'cell constant', 'salt bridge', 'fuel cell', 'lead storage battery', 'corrosion', 'rate law', 'order of reaction', 'molecularity', 'first order reaction', 'zero order reaction', 'second order reaction', 'half-life of reaction', 'arrhenius equation', 'activation energy', 'collision theory', 'pseudo first order', 'rate constant'],
                t2: ['emf of cell', 'cathode', 'anode', 'conductance', 'chemical kinetics', 'rate of reaction', 'frequency factor', 'pre-exponential factor'],
                rx: [/\bE_?cell\s*=/i, /\b0\.0591?\s*\/\s*n\b/, /\bk\s*=\s*A\s*e\^?-?Ea/i, /\bt_?1\/2\s*=\s*0\.693/i]
            },
            {
                subject: 'Chemistry', chapter: 'Solutions & Colligative Properties',
                t1: ['raoult\'s law', 'henry\'s law', 'colligative property', 'relative lowering of vapour pressure', 'elevation in boiling point', 'depression in freezing point', 'osmotic pressure', 'van\'t hoff factor', 'ideal solution', 'non-ideal solution', 'azeotrope', 'azeotropic mixture', 'ebullioscopic constant', 'cryoscopic constant', 'isotonic solution', 'hypertonic', 'hypotonic', 'reverse osmosis', 'abnormal molar mass'],
                t2: ['vapour pressure', 'boiling point elevation', 'freezing point depression', 'semipermeable membrane', 'molal elevation', 'molal depression'],
                rx: [/\b\u0394T_?[bf]\s*=\s*i?\s*K_?[bf]\s*m\b/i, /\b\u03c0\s*=\s*i?\s*CRT\b/i]
            },
            {
                subject: 'Chemistry', chapter: 'Coordination Compounds',
                t1: ['coordination compound', 'coordination number', 'crystal field theory', 'crystal field splitting', 'cfse', 'spectrochemical series', 'werner\'s theory', 'effective atomic number', 'ean rule', 'chelate', 'chelating ligand', 'ambidentate ligand', 'bidentate ligand', 'polydentate', 'edta', 'synergic bonding', 'metal carbonyl', 'jahn-teller', 'linkage isomerism', 'coordination isomerism', 'ionization isomerism', 'hydrate isomerism', 'inner orbital complex', 'outer orbital complex', 'low spin complex', 'high spin complex', 'spin-only magnetic moment'],
                t2: ['ligand', 'complex ion', 't2g', 'eg orbital', 'pairing energy', 'bohr magneton', 'wilkinson\'s catalyst', 'zeise\'s salt'],
                rx: [/\[(?:Fe|Co|Ni|Cr|Cu|Pt|Pd|Mn|Zn|Ag|Ti|V)\([^\]]+\)[^\]]*\]/, /\b\u03bc\s*=\s*(?:sqrt|\u221a)\s*n\(n\+2\)/i]
            },
            {
                subject: 'Chemistry', chapter: 'p, d & f-Block Elements',
                t1: ['transition element', 'transition metal', 'lanthanoid', 'actinoid', 'potassium permanganate', 'potassium dichromate', 'chromyl chloride test', 'd-block', 'f-block', 'interstitial compound', 'alloy formation', 'variable oxidation state', 'colored ions', 'd-d transition', 'charge transfer spectrum', 'metallurgy', 'elligham diagram', 'ellingham diagram', 'froth floatation', 'zone refining', 'mond\'s process', 'van arkel', 'hall-heroult', 'bessemer'],
                t2: ['kmno4', 'k2cr2o7', 'cro2cl2', 'f-block', 'lanthanide', 'actinide', 'ore', 'roasting', 'calcination', 'smelting'],
                rx: [/\b(?:KMnO4|K2Cr2O7|CrO2Cl2|Fe2O3|CuFeS2)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Carbonyl Compounds, Alcohols & Acids',
                t1: ['aldol condensation', 'cannizzaro reaction', 'perkin reaction', 'claisen condensation', 'clemmensen reduction', 'wolff-kishner', 'rosenmund reduction', 'stephen reduction', 'etard reaction', 'gattermann-koch', 'reimer-tiemann', 'kolbe\'s reaction', 'williamson ether synthesis', 'lucas test', 'victor meyer test', 'iodoform test', 'haloform reaction', 'tollen\'s reagent', 'fehling\'s solution', 'benedict\'s solution', 'schiff\'s reagent', '2,4-dnp', 'hell-volhard-zelinsky', 'hvz reaction', 'esterification', 'grignard reagent', 'wittig reaction', 'baeyer-villiger', 'pinacol-pinacolone', 'beckmann rearrangement', 'swern oxidation'],
                t2: ['aldehyde', 'ketone', 'carboxylic acid', 'alcohol', 'phenol', 'ether', 'carbonyl', 'pcc', 'jones reagent', 'lialh4', 'nabh4', 'acetal', 'hemiacetal', 'oxime', 'hydrazone'],
                rx: [/\b(?:LiAlH4|NaBH4|RMgX|CH3MgBr|CrO3)\b/]
            },
            {
                subject: 'Chemistry', chapter: 'Amines & Biomolecules',
                t1: ['hofmann bromamide', 'gabriel phthalimide', 'carbylamine test', 'hinsberg\'s reagent', 'hinsberg test', 'diazonium salt', 'sandmeyer reaction', 'gattermann reaction', 'coupling reaction', 'azo dye', 'schotten-baumann', 'mendius reaction', 'carbohydrate', 'monosaccharide', 'disaccharide', 'polysaccharide', 'glucose', 'fructose', 'sucrose', 'maltose', 'lactose', 'starch', 'cellulose', 'mutarotation', 'osazone', 'reducing sugar', 'amino acid', 'zwitterion', 'isoelectric point', 'peptide bond', 'peptide linkage', 'denaturation of protein', 'nucleic acid', 'nucleotide', 'nucleoside', 'vitamin', 'polymer', 'nylon', 'bakelite', 'teflon', 'buna-s', 'neoprene'],
                t2: ['aniline', 'amine', 'primary amine', 'secondary amine', 'tertiary amine', 'protein', 'enzyme', 'dna', 'rna', 'starch', 'monomer'],
                rx: [/\b(?:C6H5N2Cl|NaNO2\s*\+\s*HCl|CHCl3\s*\+\s*KOH)\b/i]
            },

            // ======================== MATHEMATICS ========================
            {
                subject: 'Mathematics', chapter: 'Basic Maths',
                t1: ['wavy curve', 'modulus inequality', 'logarithmic inequality', 'logarithm', 'characteristic and mantissa', 'greatest integer function', 'fractional part function', 'signum function', 'componendo and dividendo', 'irrational inequality'],
                t2: ['log base', 'absolute value', 'real values of x satisfying'],
                rx: [/\blog_\{?\d+\}?\s*\(/i, /\b\|x\s*[\+\-]\s*\d+\|\s*[<>]/]
            },
            {
                subject: 'Mathematics', chapter: 'Sets',
                t1: ['venn diagram', 'power set', 'symmetric difference', 'de morgan\'s law', 'cardinality of set', 'disjoint sets', 'subset of', 'proper subset', 'number of elements in set'],
                t2: ['union and intersection', 'universal set', 'complement of set', 'n(a u b)'],
                rx: [/\bn\(\s*A\s*[\u222a\u2229u]\s*B\s*\)/i, /\bA\s*[\u222a\u2229]\s*B\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Relations',
                t1: ['equivalence relation', 'reflexive', 'symmetric and transitive', 'anti-symmetric', 'equivalence class', 'number of reflexive relations', 'number of symmetric relations', 'number of equivalence relations', 'cartesian product'],
                t2: ['relation r on set', 'binary relation', 'domain of relation', 'range of relation'],
                rx: [/\bR\s*=\s*\{\s*\(a,\s*b\)/]
            },
            {
                subject: 'Mathematics', chapter: 'Linear Inequalities PU',
                t1: ['linear inequality', 'linear inequalities', 'feasible region', 'graphical solution of linear inequalities', 'half plane'],
                t2: ['system of linear inequalities', 'slack variable'],
                rx: [/\bax\s*[\+\-]\s*by\s*(?:<=|>=|\u2264|\u2265)\s*c\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Quadratic Equations and Expressions',
                t1: ['quadratic equation', 'location of roots', 'nature of roots', 'common root', 'both roots common', 'one root common', 'sum of roots', 'product of roots', 'discriminant', 'roots lie between', 'roots are real and distinct', 'roots of the equation', 'symmetric function of roots', 'biquadratic equation', 'newton\'s formula for roots', 'range of rational function'],
                t2: ['alpha and beta are roots', 'real roots', 'integral roots', 'vertex of parabola y = ax', 'ax^2 + bx + c'],
                rx: [/\bax\^?2\s*\+\s*bx\s*\+\s*c\s*=\s*0\b/i, /\b\u03b1\s*\+\s*\u03b2\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Quadratic Equations & Complex Numbers',
                t1: ['complex number', 'argand plane', 'de moivre\'s theorem', 'de moivre', 'cube root of unity', 'cube roots of unity', 'nth roots of unity', 'principal argument', 'modulus and argument', 'conjugate of z', 'euler\'s form', 'rotation theorem', 'conic in argand', 'locus of z', 'unimodular complex'],
                t2: ['imaginary part', 'real part', 'arg(z)', 're(z)', 'im(z)', 'iota', '|z -', '|z +'],
                rx: [/\b(?:Re|Im|arg)\s*\(\s*z/i, /\|\s*z\s*[\+\-]\s*[^|]+\|/, /\b1\s*\+\s*\u03c9\s*\+\s*\u03c9\^?2\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Sequence and Series',
                t1: ['arithmetic progression', 'geometric progression', 'harmonic progression', 'arithmetico-geometric', 'agp', 'am-gm', 'am gm inequality', 'cauchy-schwarz', 'method of difference', 'telescoping series', 'sum to n terms', 'sum to infinity', 'infinite gp', 'common difference', 'common ratio', 'arithmetic mean', 'geometric mean', 'harmonic mean'],
                t2: ['a.p.', 'g.p.', 'h.p.', 'nth term', 'sum of series', 'sequence of positive', 'sigma notation'],
                rx: [/\b\u2211_?\{?[krn]=1/i, /\b(?:AM\s*(?:>=|\u2265)\s*GM|S_?n\s*=)/i]
            },
            {
                subject: 'Mathematics', chapter: 'Binomial Theorem for any index',
                t1: ['binomial theorem', 'binomial expansion', 'binomial coefficient', 'general term in expansion', 'term independent of x', 'middle term in expansion', 'numerically greatest term', 'multinomial theorem', 'remainder when divided by', 'last two digits', 'sum of binomial coefficients'],
                t2: ['coefficient of x^', 'expansion of (', 'ncr', 'binomial series'],
                rx: [/\b\^?nC_?r\b/, /\b\(\s*[a-z0-9\+\-\/\s]+\s*\)\^?\d{2,}\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Permutations and Combinations',
                t1: ['permutations and combinations', 'number of ways', 'circular permutation', 'derangement', 'beggar\'s method', 'stars and bars', 'integral solutions of', 'non-negative integral solutions', 'positive integral solutions', 'number of divisors', 'sum of divisors', 'exponent of prime', 'dictionary rank', 'rank of the word', 'selection of objects', 'distribution of identical', 'distribution of distinct', 'pigeonhole', 'number of triangles formed', 'number of diagonals', 'chessboard rectangles', 'committee of'],
                t2: ['arranged in a row', 'no two', 'together', 'palindrome', 'digit numbers formed', 'different ways', 'total number of words'],
                rx: [/\b(?:nPr|nCr|\d+C\d+|\d+P\d+)\b/, /\bx_?1\s*\+\s*x_?2\s*\+\s*x_?3/]
            },
            {
                subject: 'Mathematics', chapter: 'Trigonometric Ratios and Identities',
                t1: ['trigonometric identity', 'compound angle', 'multiple angle', 'submultiple angle', 'conditional identity', 'maximum and minimum value of a sin', 'product to sum', 'sum to product', 'telescoping trigonometric', 'continued product of cosine'],
                t2: ['sin 18', 'cos 36', 'tan a + tan b', 'sin(a+b)', 'cos(a+b)', 'sin2x', 'cos2x', 'sec2x', 'cosec2x'],
                rx: [/\b(?:sin|cos|tan)\s*(?:3\u03b8|2\u03b8|\u03c0\/\d+)/i]
            },
            {
                subject: 'Mathematics', chapter: 'Trigonometric Equations and Inequalities',
                t1: ['trigonometric equation', 'trigonometric inequality', 'general solution of', 'principal solution', 'number of solutions of equation', 'solutions in the interval [0, 2'],
                t2: ['number of roots in [0', 'satisfies sin', 'satisfies cos', 'satisfies tan'],
                rx: [/\b(?:sin|cos|tan)\^?\d?\s*x\s*[\+\-].*=\s*/i]
            },
            {
                subject: 'Mathematics', chapter: 'Properties of Triangles',
                t1: ['sine rule', 'cosine rule', 'projection formula', 'napier\'s analogy', 'heron\'s formula', 'circumradius', 'inradius', 'exradius', 'exradii', 'pedal triangle', 'ambiguous case', 'solution of triangle', 'heights and distances', 'angle of elevation', 'angle of depression'],
                t2: ['in a triangle abc', 'in triangle abc', 'semi-perimeter', 'r1, r2, r3', 'cos a + cos b + cos c'],
                rx: [/\b(?:sin\s*A\/a|a\/sin\s*A)\b/i, /\b\u0394\s*\/\s*s\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Introduction to Co-ordinate Geometry',
                t1: ['section formula', 'distance formula', 'area of triangle with vertices', 'collinear points in plane', 'shifting of origin', 'rotation of axes'],
                t2: ['internally in the ratio', 'externally in the ratio', 'coordinates of centroid'],
                rx: []
            },
            {
                subject: 'Mathematics', chapter: 'Straight Lines',
                t1: ['straight line', 'equation of line', 'slope-intercept', 'normal form of line', 'parametric form of line', 'angle bisector', 'acute angle bisector', 'obtuse angle bisector', 'family of lines', 'concurrent lines', 'foot of perpendicular', 'image of a point in the line', 'reflection of ray', 'orthocentre', 'orthocenter', 'circumcentre', 'circumcenter', 'incentre', 'incenter', 'centroid', 'euler line', 'distance between parallel lines', 'perpendicular distance from point to line', 'median through', 'altitude through'],
                t2: ['slope of line', 'intercept on axes', 'parallel to line', 'perpendicular to line', 'vertices of a triangle', 'locus of point', 'line passes through'],
                rx: [/\bax\s*\+\s*by\s*\+\s*c\s*=\s*0\b/i, /\by\s*-\s*y_?1\s*=\s*m\s*\(x\s*-\s*x_?1\)/i]
            },
            {
                subject: 'Mathematics', chapter: 'Pair of Lines',
                t1: ['pair of straight lines', 'pair of lines', 'homogeneous equation of second degree', 'homogenisation', 'homogenization', 'angle between pair of lines', 'joint equation of lines', 'combined equation of'],
                t2: ['ax^2 + 2hxy + by^2', 'represents a pair of lines', 'bisectors of angles between pair'],
                rx: [/\bax\^?2\s*\+\s*2hxy\s*\+\s*by\^?2\b/i, /\babc\s*\+\s*2fgh\s*-/i]
            },
            {
                subject: 'Mathematics', chapter: 'Circles',
                t1: ['equation of circle', 'circle passing through', 'two circles', 'unit circle', 'unit circles', 'concentric circles', 'orthogonal circles', 'intersect orthogonally', 'radical axis', 'radical centre', 'radical center', 'common chord', 'common tangent', 'direct common tangent', 'transverse common tangent', 'chord of contact', 'director circle', 'family of circles', 'coaxial circles', 'power of a point', 'length of tangent to circle', 'touches coordinate axes', 'touches both axes', 'diameter of the circle', 'circumcircle', 'incircle'],
                t2: ['circle', 'circles', 'centre of circle', 'center of circle', 'radius of circle', 'tangent to circle', 'chord of circle', 'touch externally', 'touch internally'],
                rx: [/\bx\^?2\s*\+\s*y\^?2\s*[\+\-]\s*\d*[gx]/i, /\(\s*x\s*[\+\-]\s*[^)]+\)\^?2\s*\+\s*\(\s*y\s*[\+\-]\s*[^)]+\)\^?2\s*=/]
            },
            {
                subject: 'Mathematics', chapter: 'Parabola',
                t1: ['parabola', 'latus rectum of parabola', 'focal chord', 'focal distance', 'directrix of parabola', 'parametric point (at^2', 'three normals', 'conormal points', 'co-normal points', 'reflection property of parabola', 'subtangent', 'subnormal', 'chords of parabola'],
                t2: ['y^2 = 4ax', 'x^2 = 4ay', 'focus and directrix', 'tangent to parabola', 'normal to parabola'],
                rx: [/\by\^?2\s*=\s*\d+x\b/i, /\bx\^?2\s*=\s*\d+y\b/i, /\b4ax\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Ellipse',
                t1: ['ellipse', 'major axis', 'minor axis', 'auxiliary circle', 'eccentric angle', 'foci of ellipse', 'latus rectum of ellipse', 'director circle of ellipse', 'reflection property of ellipse'],
                t2: ['eccentricity of ellipse', 'tangent to ellipse', 'normal to ellipse', 'semi-major', 'semi-minor'],
                rx: [/\bx\^?2\/a\^?2\s*\+\s*y\^?2\/b\^?2\s*=\s*1\b/i, /\bb\^?2\s*=\s*a\^?2\s*\(1\s*-\s*e\^?2\)/i]
            },
            {
                subject: 'Mathematics', chapter: 'Hyperbola',
                t1: ['hyperbola', 'rectangular hyperbola', 'conjugate hyperbola', 'transverse axis', 'conjugate axis', 'asymptotes of hyperbola', 'asymptote', 'foci of hyperbola', 'eccentricity of hyperbola'],
                t2: ['xy = c^2', 'tangent to hyperbola', 'normal to hyperbola', 'latus rectum of hyperbola'],
                rx: [/\bx\^?2\/a\^?2\s*-\s*y\^?2\/b\^?2\s*=\s*1\b/i, /\bxy\s*=\s*c\^?2\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Functions',
                t1: ['domain and range', 'domain of the function', 'range of the function', 'one-one', 'many-one', 'onto function', 'into function', 'bijective', 'injective', 'surjective', 'composite function', 'inverse of function', 'even function', 'odd function', 'periodic function', 'fundamental period', 'functional equation', 'inverse trigonometric', 'principal value of sin^-1', 'arcsin', 'arccos', 'arctan'],
                t2: ['f(x + y)', 'f(xy)', 'fog(x)', 'gof(x)', 'f^-1(x)', 'number of onto functions', 'number of bijections', 'cot^-1', 'tan^-1'],
                rx: [/\bf\s*:\s*[A-Z\u211d]\s*(?:->|\u2192)\s*[A-Z\u211d]/, /\b(?:sin|cos|tan|cot|sec|cosec)\^?-1\s*\(/i]
            },
            {
                subject: 'Mathematics', chapter: 'Limits, Continuity & Differentiability',
                t1: ['l\'hopital', 'l\'hospital', 'sandwich theorem', 'squeeze theorem', 'indeterminate form', 'continuous at x =', 'discontinuous at', 'removable discontinuity', 'jump discontinuity', 'differentiable at x =', 'non-differentiable', 'left hand limit', 'right hand limit', 'left hand derivative', 'right hand derivative', 'intermediate value theorem'],
                t2: ['lim x ->', 'limit exists', 'continuity', 'differentiability', 'points of non-differentiability', 'piecewise function'],
                rx: [/\blim_?\{?[xnh]\s*(?:->|\u2192)/i, /\b1\^?\u221e\b/]
            },
            {
                subject: 'Mathematics', chapter: 'Methods of Differentiation',
                t1: ['logarithmic differentiation', 'implicit differentiation', 'parametric differentiation', 'higher order derivative', 'derivative of f(x) with respect to g(x)', 'chain rule', 'leibnitz theorem for nth derivative'],
                t2: ['find dy/dx', 'd^2y/dx^2', 'differentiate', 'derivative of inverse'],
                rx: [/\bd\^?2y\/dx\^?2\b/i, /\bdy\/dx\s*=\s*/i]
            },
            {
                subject: 'Mathematics', chapter: 'Application of Derivatives (AOD)',
                t1: ['application of derivatives', 'local maximum', 'local minimum', 'global maximum', 'global minimum', 'strictly increasing', 'strictly decreasing', 'monotonic', 'monotonicity', 'critical point', 'point of inflection', 'concave upward', 'concave downward', 'rolle\'s theorem', 'lagrange\'s mean value theorem', 'mean value theorem', 'lmvt', 'rate of change', 'equation of tangent to curve', 'equation of normal to curve', 'angle of intersection of two curves', 'orthogonal curves', 'shortest distance between curve'],
                t2: ['maxima', 'minima', 'maximum value of f(x)', 'minimum value of f(x)', 'stationary point', 'tangent to the curve'],
                rx: [/\bf'\s*\(x\)\s*[<>]=?\s*0\b/, /\bf''\s*\(x\)/]
            },
            {
                subject: 'Mathematics', chapter: 'Indefinite & Definite Integration',
                t1: ['definite integral', 'indefinite integral', 'integration by parts', 'integration by substitution', 'partial fractions', 'king\'s property', 'leibnitz rule', 'newton-leibnitz', 'walli\'s formula', 'reduction formula', 'limit of a sum', 'riemann sum', 'periodic integral', 'gamma function'],
                t2: ['evaluate integral', 'integral from', 'primitive of', 'antiderivative', 'dx /'],
                rx: [/\u222b/, /\b\d+\s*to\s*\d+.*\bdx\b/i]
            },
            {
                subject: 'Mathematics', chapter: 'Differential Equations & Area',
                t1: ['differential equation', 'order and degree', 'variable separable', 'homogeneous differential', 'linear differential equation', 'integrating factor', 'bernoulli\'s differential', 'exact differential', 'orthogonal trajectory', 'area bounded by', 'area enclosed by', 'area between the curves', 'area under the curve'],
                t2: ['general solution of dy/dx', 'particular solution', 'satisfies y(', 'curve passing through', 'bounded region'],
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
                t1: ['scalar triple product', 'vector triple product', 'skew lines', 'shortest distance between', 'direction cosines', 'direction ratios', 'equation of plane', 'family of planes', 'foot of perpendicular on plane', 'image of point in plane', 'tetrahedron', 'parallelepiped', 'coplanar vectors', 'line of intersection of two planes', 'angle between line and plane', 'equation of line in space'],
                t2: ['3d geometry', 'position vector', 'unit vector perpendicular', 'projection of vector', 'collinear points in space', 'plane passing through'],
                rx: [/\[\s*[a-z]\s+[a-z]\s+[a-z]\s*\]/, /\b(?:x-x_?1)\/l\b/i]
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
                const parsed = raw ? JSON.parse(raw) : { total: 0, chapters: {} };
                if (!parsed || typeof parsed !== 'object' || !parsed.chapters) {
                    return { total: 0, chapters: {} };
                }
                return parsed;
            } catch (_) {
                return { total: 0, chapters: {} };
            }
        },

        saveFeedbackMemory(mem) {
            try { localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(mem)); } catch (_) {}
        },

        extractLearningFeatures(text) {
            const words = Utils.normalizeForMatch(text)
                .split(/[^a-z0-9]+/)
                .filter(w => w.length >= 4 && !/^\d+$/.test(w) && !STOPWORDS.has(w));

            const unigrams = Array.from(new Set(words)).slice(0, 36);
            const bigrams = [];
            for (let i = 0; i < words.length - 1 && bigrams.length < 24; i++) {
                if (words[i] !== words[i + 1]) {
                    bigrams.push(`${words[i]}_${words[i + 1]}`);
                }
            }
            return { unigrams, bigrams: Array.from(new Set(bigrams)) };
        },

        /**
         * Upgraded Self-Learning Correction Memory (v4.0):
         * Learns discriminative unigrams + bigrams for the corrected chapter,
         * and optionally downweights them on the previously misclassified chapter.
         */
        learnCorrection(text, subject, chapter, wrongChapter = null) {
            if (!text || !subject || !chapter) return;
            const mem = this.loadFeedbackMemory();
            const key = `${subject}::${chapter}`;
            if (!mem.chapters[key]) mem.chapters[key] = { count: 0, tokens: {}, bigrams: {} };
            if (!mem.chapters[key].bigrams) mem.chapters[key].bigrams = {};

            mem.chapters[key].count++;
            mem.total = (mem.total || 0) + 1;

            const { unigrams, bigrams } = this.extractLearningFeatures(text);
            for (const w of unigrams) {
                mem.chapters[key].tokens[w] = Math.min(25, (mem.chapters[key].tokens[w] || 0) + 1);
            }
            for (const bg of bigrams) {
                mem.chapters[key].bigrams[bg] = Math.min(25, (mem.chapters[key].bigrams[bg] || 0) + 1);
            }

            // Optional negative downweighting if user moved question away from a wrong chapter
            if (wrongChapter && wrongChapter !== chapter) {
                const wrongKey = `${subject}::${wrongChapter}`;
                const wrongEntry = mem.chapters[wrongKey];
                if (wrongEntry) {
                    for (const w of unigrams) {
                        if (wrongEntry.tokens?.[w] > 1) wrongEntry.tokens[w] -= 0.5;
                    }
                    for (const bg of bigrams) {
                        if (wrongEntry.bigrams?.[bg] > 1) wrongEntry.bigrams[bg] -= 0.5;
                    }
                }
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
                    if (Utils.countPhraseHits(norm, cleanChap, 1) > 0 || (stem.length >= 5 && Utils.countPhraseHits(norm, stem, 1) > 0)) {
                        const score = cleanChap.length * 1.5;
                        if (!best || score > best.score) best = { subject: subj, chapter: chap, score };
                    }
                }
            }
            return best;
        },

        /**
         * 16 Deterministic JEE Advanced Overlap Disambiguation Rules (v4.0):
         * Resolves primary governing chapter vs auxiliary tool cleanly.
         */
        applyOverlapDisambiguation(qNorm, rawQ, scores, addScore, lockedSubject) {
            const has = (subj, chap) => (scores.get(`${subj}::${chap}`) || 0) > 0;

            // 1. Physics: SHM vs NLM / WPE / Rigid Body Mechanics
            if (!lockedSubject || lockedSubject === 'Physics') {
                const asksOscillation = /\b(?:time\s*period|angular\s*frequency|simple\s*harmonic|harmonic\s*oscillator|small\s*oscillations?|shm|s\.h\.m|amplitude\s*of\s*oscillation|mean\s*position)\b/i.test(qNorm);
                if (asksOscillation) {
                    addScore('Physics', 'Simple Harmonic Motion', 11.5);
                }

                // Rigid Body vs WPE / COM: extended body rotating/rolling/pivoted about hinge -> Rigid Body Mechanics
                const hasExtendedRotation = /\b(?:moment\s*of\s*inertia|pure\s*rolling|rolling\s*without\s*slipping|angular\s*momentum|torque|hinged\s*rod|pivoted|angular\s*impulse|toppling|radius\s*of\s*gyration|instantaneous\s*axis)\b/i.test(qNorm);
                if (hasExtendedRotation && !asksOscillation) {
                    addScore('Physics', 'Rigid Body Mechanics', 9.5);
                }

                // Physics Thermo vs KTG
                if (has('Physics', 'Thermodynamics') && has('Physics', 'Kinetic Theory of Gases')) {
                    if (/\b(?:carnot|cyclic|p-v|pv\s*diagram|indicator\s*diagram|heat\s*engine|refrigerator|polytropic|adiabatic|isothermal)\b/i.test(qNorm)) {
                        addScore('Physics', 'Thermodynamics', 9.0);
                    } else if (/\b(?:rms\s*speed|most\s*probable\s*speed|mean\s*free\s*path|maxwell\s*distribution|collision\s*frequency)\b/i.test(qNorm)) {
                        addScore('Physics', 'Kinetic Theory of Gases', 9.0);
                    }
                }
            }

            // 2. Cross-Subject: Physics Thermo vs Chemistry Thermo & Atomic Structure vs Modern Physics
            if (!lockedSubject) {
                if (has('Physics', 'Thermodynamics') && has('Chemistry', 'Thermodynamics')) {
                    if (/\b(?:enthalpy|combustion|formation|neutralization|bond\s*energy|hess|gibbs|kj\/mol|kcal\/mol|reaction)\b/i.test(qNorm)) {
                        addScore('Chemistry', 'Thermodynamics', 15.0);
                    } else if (/\b(?:carnot|piston|p-v|pv\s*diagram|cyclic|engine|refrigerator|monoatomic|diatomic)\b/i.test(qNorm)) {
                        addScore('Physics', 'Thermodynamics', 15.0);
                    }
                }
                if (has('Chemistry', 'Atomic Structure') && has('Physics', 'Modern Physics & Semiconductors')) {
                    if (/\b(?:quantum\s*number|orbital|nodal\s*plane|radial\s*node|aufbau|hund|pauli|electronic\s*configuration)\b/i.test(qNorm)) {
                        addScore('Chemistry', 'Atomic Structure', 12.0);
                    } else if (/\b(?:photoelectric|work\s*function|stopping\s*potential|radioactive|binding\s*energy|half[\-\s]life|x-ray|diode|transistor|logic\s*gate)\b/i.test(qNorm)) {
                        addScore('Physics', 'Modern Physics & Semiconductors', 12.0);
                    }
                }
            }

            // 3. Chemistry: Stereochemistry vs GOC-I vs GOC-II vs Hydrocarbons
            if (!lockedSubject || lockedSubject === 'Chemistry') {
                const isStereoCore = /\b(?:enantiomer|diastereomer|meso|chiral|optical\s*activ|geometrical\s*isomer|cis-trans|conformer|conformational|chair\s*conformation|newman|fischer|r-s\s*configuration|e-z\s*configuration|racemic)\b/i.test(qNorm);
                const isGoc1Core = /\b(?:resonance|mesomeric|inductive|hyperconjugat|hyper\s*conjugable|aromaticity|antiaromatic|tautomer|acidic\s*strength|basic\s*strength|acidity|basicity|carbonic\s*acid|nahco3|\+m\s*and\s*-m|ring-chain\s*isomer)\b/i.test(qNorm);
                const isGoc2Core = /\b(?:sn1|sn2|e1cb|carbocation\s*rearrangement|hydride\s*shift|ring\s*expansion|nucleophilic\s*substitution|electrophilic\s*aromatic)\b/i.test(qNorm);

                if (isStereoCore && !isGoc1Core) addScore('Chemistry', 'Stereochemistry', 9.0);
                if (isGoc1Core && !isStereoCore && !isGoc2Core) addScore('Chemistry', 'GOC-I', 8.5);
                if (isGoc2Core) addScore('Chemistry', 'GOC-II', 9.5);
            }

            // 4. Mathematics: Circles vs Straight Lines, Complex vs Quadratics, AOD vs Differentiation
            if (!lockedSubject || lockedSubject === 'Mathematics') {
                const hasCircleCore = /\b(?:unit\s*circle|two\s*circles|concentric\s*circles|orthogonal\s*circles|radical\s*axis|chord\s*of\s*contact|director\s*circle|common\s*tangent|diameter\s*of\s*the\s*circle|touches\s*coordinate\s*axes)\b/i.test(qNorm) ||
                    Utils.countPhraseHits(qNorm, 'circle', 4) >= 2;
                if (hasCircleCore && has('Mathematics', 'Straight Lines')) {
                    addScore('Mathematics', 'Circles', 11.0);
                }

                const hasComplexCore = /\b(?:complex\s*number|argand|de\s*moivre|cube\s*roots?\s*of\s*unity|nth\s*roots?\s*of\s*unity|principal\s*argument|unimodular)\b/i.test(qNorm) ||
                    /\b(?:Re|Im|arg)\s*\(\s*z/i.test(rawQ) || /\|\s*z\s*[\+\-]/i.test(rawQ);
                if (hasComplexCore) {
                    addScore('Mathematics', 'Quadratic Equations & Complex Numbers', 12.0);
                }

                const hasAodCore = /\b(?:maxima|minima|local\s*max|local\s*min|global\s*max|strictly\s*increasing|strictly\s*decreasing|monotonic|rolle|lagrange|mean\s*value\s*theorem|point\s*of\s*inflection)\b/i.test(qNorm);
                if (hasAodCore && has('Mathematics', 'Methods of Differentiation')) {
                    addScore('Mathematics', 'Application of Derivatives (AOD)', 10.5);
                }
            }
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
                if (!pts || pts <= 0) return;
                const k = `${subj}::${chap}`;
                scores.set(k, (scores.get(k) || 0) + pts);
                subjectTotals[subj] = (subjectTotals[subj] || 0) + pts;
            };

            // 1. Word-Boundary-Safe Term-Frequency Weighted Syllabus Matching
            for (const rule of this.SYLLABUS_RULES) {
                if (lockedSubject && rule.subject !== lockedSubject) continue;
                let pts = 0;

                for (const p of rule.t1) {
                    const hits = Utils.countPhraseHits(qNorm, p, 3);
                    if (hits > 0) pts += 12.0 + (hits - 1) * 4.5;
                }
                for (const t of rule.t2) {
                    const hits = Utils.countPhraseHits(qNorm, t, 4);
                    if (hits > 0) pts += 5.5 + (hits - 1) * 3.0;
                }
                for (const rx of rule.rx) {
                    if (rx.test(rawQ)) pts += 8.5;
                }
                if (pts > 0) addScore(rule.subject, rule.chapter, pts);
            }

            // 2. Subject-Level Signal Boost (only when subject isn't already locked by PART banner)
            if (!lockedSubject) {
                if (/\b(?:mole|molar|enthalpy|gibbs|hess|ph|pka|pkb|ksp|hybridis|organic|alkane|alkene|benzene|acid|base|ligand|complex|oxidation|reduction|catalyst|reaction|reagent|compound|isomer|conformer|tautomer)\b/i.test(qNorm)) {
                    subjectTotals.Chemistry += 7;
                }
                if (/\b(?:velocity|acceleration|force|mass|kg|newton|pulley|friction|torque|moment of inertia|capacitor|resistor|circuit|magnetic|flux|lens|mirror|prism|satellite|pendulum|oscillat|shm|wave|frequency|piston|carnot|fluid)\b/i.test(qNorm)) {
                    subjectTotals.Physics += 7;
                }
                if (/\b(?:equation|roots|polynomial|triangle|circle|parabola|ellipse|hyperbola|matrix|determinant|integral|derivative|limit|continuous|differentiable|probability|permutation|combination|locus|slope|orthocentre|centroid|sequence|series|function|domain|range|theorem|prove that|chord|tangent)\b/i.test(qNorm)) {
                    subjectTotals.Mathematics += 7;
                }
            }

            // 3. Explicit JEE Advanced Overlap Disambiguation Rules
            this.applyOverlapDisambiguation(qNorm, rawQ, scores, addScore, lockedSubject);

            // 4. Direct Header / Paper Title Chapter Match
            const titleHit = this.matchDirectChapterTitle(`${paperName} ${pageHeader}`, lockedSubject);
            if (titleHit) addScore(titleHit.subject, titleHit.chapter, 10.0);

            // 5. Per-Subject / Worksheet Topic Prior
            if (documentPrior && (!lockedSubject || documentPrior.subject === lockedSubject)) {
                addScore(documentPrior.subject, documentPrior.chapter, documentPrior.weight || 9.5);
            }

            // 6. Upgraded Discriminative Unigram + Bigram Local Feedback Memory (IDF-Weighted)
            const mem = this.loadFeedbackMemory();
            if (mem.total > 0) {
                const { unigrams, bigrams } = this.extractLearningFeatures(qNorm);
                const entries = Object.entries(mem.chapters);
                const numChaps = Math.max(1, entries.length);

                // Compute document frequency across stored chapters for IDF specificity weighting
                const dfWord = new Map();
                const dfBg = new Map();
                for (const [, entry] of entries) {
                    for (const w of unigrams) if (entry.tokens?.[w]) dfWord.set(w, (dfWord.get(w) || 0) + 1);
                    for (const bg of bigrams) if (entry.bigrams?.[bg]) dfBg.set(bg, (dfBg.get(bg) || 0) + 1);
                }

                for (const [key, entry] of entries) {
                    const [subj, chap] = key.split('::');
                    if (lockedSubject && subj !== lockedSubject) continue;
                    let nbScore = 0;
                    for (const w of unigrams) {
                        const tf = entry.tokens?.[w] || 0;
                        if (tf > 0) {
                            const idf = Math.log(1 + numChaps / (dfWord.get(w) || 1)) + 0.35;
                            nbScore += Math.min(2.5, Math.sqrt(tf)) * idf * 1.9;
                        }
                    }
                    for (const bg of bigrams) {
                        const tf = entry.bigrams?.[bg] || 0;
                        if (tf > 0) {
                            const idf = Math.log(1 + numChaps / (dfBg.get(bg) || 1)) + 0.5;
                            nbScore += Math.min(2.5, Math.sqrt(tf)) * idf * 3.8;
                        }
                    }
                    if (nbScore >= 3.2) {
                        addScore(subj, chap, Math.min(20.0, nbScore));
                    }
                }
            }

            // Rank candidates
            let bestKey = null, bestScore = -1, secondKey = null, secondScore = 0;
            for (const [k, sc] of scores.entries()) {
                const subj = k.split('::')[0];
                const finalSc = sc + (subjectTotals[subj] || 0) * 0.16;
                if (finalSc > bestScore) {
                    secondScore = bestScore;
                    secondKey = bestKey;
                    bestScore = finalSc;
                    bestKey = k;
                } else if (finalSc > secondScore) {
                    secondScore = finalSc;
                    secondKey = k;
                }
            }

            if (bestKey && bestScore > 0) {
                const [subject, chapter] = bestKey.split('::');
                const runnerUp = secondKey ? secondKey.split('::')[1] : '';
                const marginRatio = (bestScore - Math.max(0, secondScore)) / (bestScore + 10);
                const strengthRatio = 1 - Math.exp(-bestScore / 20);
                const sparsePenalty = qNorm.length < 25 ? 0.08 : (qNorm.length < 45 ? 0.04 : 0);

                const confidence = Utils.clamp(
                    0.32 + 0.36 * strengthRatio + 0.31 * marginRatio - sparsePenalty,
                    0.28,
                    0.99
                );
                return {
                    subject,
                    chapter,
                    runnerUp,
                    confidence: Math.round(confidence * 100) / 100,
                    score: Math.round(bestScore * 10) / 10,
                    confidenceBreakdown: {
                        strength: Math.round(strengthRatio * 100) / 100,
                        margin: Math.round(marginRatio * 100) / 100,
                        sparsePenalty,
                        topScore: Math.round(bestScore * 10) / 10,
                        secondScore: Math.round(Math.max(0, secondScore) * 10) / 10
                    }
                };
            }

            const fallbackSubj = lockedSubject || 'Physics';
            return {
                subject: fallbackSubj,
                chapter: JEE_CHAPTERS[fallbackSubj]?.[0] || 'General',
                runnerUp: '',
                confidence: lockedSubject ? 0.52 : 0.28,
                score: 0,
                confidenceBreakdown: { strength: 0, margin: 0, sparsePenalty: 0.08, topScore: 0, secondScore: 0 }
            };
        },

        classifyDocumentBlocks(blocks, paperName, defaultSubject = 'AUTO') {
            const rootTextMap = new Map();
            for (const b of blocks) {
                const rootId = b.isContinuationFromPrev && b.stitchRootUid ? b.stitchRootUid : b.uid;
                const prev = rootTextMap.get(rootId) || '';
                const piece = b.ocrText || `${b.firstLineSnippet || ''} ${b.lastLineSnippet || ''}`;
                rootTextMap.set(rootId, `${prev} ${piece}`.trim());
            }

            const rootBlocks = blocks.filter(b => !b.isContinuationFromPrev);

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

            // Compute dominant chapter prior per subject ONLY on true topic-focused sections (dominance >= 58%)
            const subjectPriors = {};
            for (const subj of ['Physics', 'Chemistry', 'Mathematics']) {
                const subjItems = initial.filter(it => it.res.subject === subj && it.res.score >= 12);
                if (subjItems.length < 3) continue;
                const counts = new Map();
                for (const it of subjItems) {
                    counts.set(it.res.chapter, (counts.get(it.res.chapter) || 0) + 1);
                }
                const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                const [topChap, topCount] = sorted[0];
                const dominance = topCount / subjItems.length;
                if (dominance >= 0.58) {
                    subjectPriors[subj] = {
                        subject: subj,
                        chapter: topChap,
                        weight: dominance >= 0.78 ? 14.5 : 9.5
                    };
                }
            }

            for (const item of initial) {
                const sPrior = subjectPriors[item.block.subjectOverride || item.res.subject] || null;
                if (sPrior && item.res.score < 20) {
                    const refined = this.classify(item.fullText, {
                        paperName,
                        pageHeader: item.block.pageHeader || '',
                        subjectOverride: item.block.subjectOverride || item.res.subject,
                        defaultSubject,
                        documentPrior: sPrior
                    });
                    item.block.subject = refined.subject;
                    item.block.chapter = refined.chapter;
                    item.block.chapterConfidence = refined.confidence;
                } else {
                    item.block.subject = item.res.subject;
                    item.block.chapter = item.res.chapter;
                    item.block.chapterConfidence = item.res.confidence;
                }
            }

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
        isReady() { return Boolean(this.session); },
        async registerModel(modelUrl, ortGlobal = globalScope.ort) {
            if (!ortGlobal || !modelUrl) return false;
            this.ort = ortGlobal;
            this.session = await ortGlobal.InferenceSession.create(modelUrl, {
                executionProviders: ['webgpu', 'wasm']
            });
            return true;
        },
        async detectLayoutRegions() {
            return null;
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

            // PHASE 1: Token Inspection -> Skip Answer Keys/Solutions -> Render & Mask
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
                            rulingLines: { hLines: [], vLines: [], tableBoxes: [] },
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
                        message: `Analyzing edges & geometry of Page ${p}/${endPage}...`
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

            // PHASE 2: Header/Footer Stripping + Column Consensus + Zone Partitioning
            const questionPagesOnly = pageDataList.filter(d => !d.isAnswerKeyPage);
            const hfList = PDFVectorExtractor.detectDocumentHeaderFooterBands(
                questionPagesOnly.map(d => d.rawTokens),
                cfg
            );
            questionPagesOnly.forEach((pd, idx) => {
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
                        const evalRes = AnchorSequenceSolver.evaluateLineAsAnchor(
                            ln, colLeftMargin, prevLn, medLineH, colLines, lIdx, pd.rulingLines?.tableBoxes
                        );
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

            // PHASE 3: Global Monotonic Sequence Alignment
            if (onProgress) {
                onProgress({
                    phase: 'GLOBAL_ALIGNMENT',
                    pageNum: endPage,
                    totalPages,
                    percent: 65,
                    message: 'Aligning question sequence & encapsulating diagrams...'
                });
            }

            const chosenAnchors = AnchorSequenceSolver.solveGlobalAnchorSequence(allCandidateAnchors);
            const chosenByZoneKey = new Map();
            for (const a of chosenAnchors) {
                const k = `${a.pageNum}_${a.zoneIdx}`;
                if (!chosenByZoneKey.has(k)) chosenByZoneKey.set(k, []);
                chosenByZoneKey.get(k).push(a);
            }

            // PHASE 4: Build Question Blocks + Table-Safe Diagram Encapsulation
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
                                : Math.min(zone.ymax, lastBot + 12);

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

                    zoneBlocks = BoundaryRefiner.refineColumnBlocksWithDiagrams(
                        zoneBlocks,
                        zone,
                        pd.maskObj,
                        pd.components,
                        colLines,
                        pd.rulingLines,
                        cfg
                    );

                    for (const b of zoneBlocks) allOrderedBlocks.push(b);
                }
            }

            // PHASE 5: Cross-Column & Cross-Page Lookahead Stitching + Passages
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

            // PHASE 6: Multi-Layer Offline JEE Chapter Classification
            const { detectedWorksheetPrior, subjectPriors } = JEEChapterClassifier.classifyDocumentBlocks(
                allOrderedBlocks,
                paperName,
                defaultSubject
            );

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
        learnCorrection: (text, subject, chapter, wrongChapter) => JEEChapterClassifier.learnCorrection(text, subject, chapter, wrongChapter),
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
