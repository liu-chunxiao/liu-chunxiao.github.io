// ============================================================
// Radial KPZ / Eden Growth toy
// Simplified UI version for metaphysics.html
// ============================================================

(function () {
  "use strict";

  // -------------------------------
  // Canvas / lattice setup
  // -------------------------------
  const NX = 1024;
  const NY = 1024;
  const CELL = 1;
  const MAX_SITES = NX * NY;

  const canvas = document.getElementById("kpzCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = NX * CELL;
  canvas.height = NY * CELL;

  // -------------------------------
  // State
  // -------------------------------
  let occupied = new Uint8Array(MAX_SITES);
  let bornStep = new Int32Array(MAX_SITES);
  let frontier = new Set();

  let running = false;
  let timer = null;
  let stepCount = 0;

  let seedCenterX = NX / 2;
  let seedCenterY = NY / 2;

  // -------------------------------
  // Controls
  // -------------------------------
  const seedShapeEl = document.getElementById("kpzSeedShape");
  const seedRadiusEl = document.getElementById("kpzSeedRadius");
  const growthRuleEl = document.getElementById("kpzGrowthRule");
  const ruleStrengthEl = document.getElementById("kpzRuleStrength");
  const ruleStrengthValueEl = document.getElementById("kpzRuleStrengthValue");
  const ruleStrengthLabelEl = document.getElementById("kpzRuleStrengthLabel");
  const growthPerFrameEl = document.getElementById("kpzGrowthPerFrame");

  const pauseBtn = document.getElementById("kpzPauseBtn");
  const stepBtn = document.getElementById("kpzStepBtn");
  const resetBtn = document.getElementById("kpzResetBtn");
  const infoEl = document.getElementById("kpzInfo");

  // -------------------------------
  // RNG
  // -------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let rng = Math.random;

  function reseedRandom() {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    rng = mulberry32(seed);
  }

  function randRange(a, b) {
    return a + (b - a) * rng();
  }

  // -------------------------------
  // Helpers
  // -------------------------------
  function idx(x, y) {
    return y * NX + x;
  }

  function inBounds(x, y) {
    return x >= 0 && x < NX && y >= 0 && y < NY;
  }

  function xyFromIndex(i) {
    return [i % NX, Math.floor(i / NX)];
  }

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function neighbors4(x, y) {
    return [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];
  }

  function countOccupiedNeighbors4(x, y) {
    let c = 0;
    if (x + 1 < NX && occupied[idx(x + 1, y)]) c++;
    if (x - 1 >= 0 && occupied[idx(x - 1, y)]) c++;
    if (y + 1 < NY && occupied[idx(x, y + 1)]) c++;
    if (y - 1 >= 0 && occupied[idx(x, y - 1)]) c++;
    return c;
  }

  function countOccupiedNeighbors8(x, y) {
    let c = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (inBounds(xx, yy) && occupied[idx(xx, yy)]) c++;
      }
    }
    return c;
  }

  // -------------------------------
  // Geometry
  // -------------------------------
  function makeRegularPolygon(cx, cy, r, n) {
    const pts = [];
    const rot = -Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const t = rot + (2 * Math.PI * k) / n;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    return pts;
  }

  function makeRandomClosedCurve(cx, cy, r0) {
    const pts = [];
    const mMax = 6;
    const amps = [];
    const phases = [];

    for (let m = 2; m <= mMax; m++) {
      amps.push(randRange(0.03, 0.12) * r0 / Math.sqrt(m));
      phases.push(randRange(0, 2 * Math.PI));
    }

    const nPts = 180;
    for (let j = 0; j < nPts; j++) {
      const t = (2 * Math.PI * j) / nPts;
      let r = r0;
      for (let m = 2; m <= mMax; m++) {
        r += amps[m - 2] * Math.cos(m * t + phases[m - 2]);
      }
      r = Math.max(8, r);
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
    return pts;
  }

  function pointInPolygon(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      const intersect =
        ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function fillPolygon(pts) {
    let minX = NX - 1, maxX = 0, minY = NY - 1, maxY = 0;
    for (const [x, y] of pts) {
      minX = Math.min(minX, Math.floor(x));
      maxX = Math.max(maxX, Math.ceil(x));
      minY = Math.min(minY, Math.floor(y));
      maxY = Math.max(maxY, Math.ceil(y));
    }

    minX = clamp(minX, 0, NX - 1);
    maxX = clamp(maxX, 0, NX - 1);
    minY = clamp(minY, 0, NY - 1);
    maxY = clamp(maxY, 0, NY - 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPolygon(x + 0.5, y + 0.5, pts)) {
          const i = idx(x, y);
          occupied[i] = 1;
          bornStep[i] = 0;
        }
      }
    }
  }

  function buildSeedPolygon() {
    const radius = clamp(parseInt(seedRadiusEl.value, 10) || 28, 8, 120);
    const shape = seedShapeEl.value;

    if (shape === "random") {
      reseedRandom();
      return makeRandomClosedCurve(seedCenterX, seedCenterY, radius);
    }

    const nMap = {
      tri: 3,
      sq: 4,
      pent: 5,
      hex: 6,
      oct: 8
    };

    return makeRegularPolygon(seedCenterX, seedCenterY, radius, nMap[shape] || 6);
  }

  // -------------------------------
  // Frontier / occupancy
  // -------------------------------
  function resetArrays() {
    occupied = new Uint8Array(MAX_SITES);
    bornStep = new Int32Array(MAX_SITES);
    frontier.clear();
    stepCount = 0;
  }

  function rebuildFrontier() {
    frontier.clear();
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const i = idx(x, y);
        if (occupied[i]) continue;
        if (countOccupiedNeighbors4(x, y) > 0) frontier.add(i);
      }
    }
  }

  function occupySite(i) {
    if (occupied[i]) return;

    occupied[i] = 1;
    bornStep[i] = stepCount;
    frontier.delete(i);

    const [x, y] = xyFromIndex(i);
    for (const [nx, ny] of neighbors4(x, y)) {
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (!occupied[ni] && countOccupiedNeighbors4(nx, ny) > 0) {
        frontier.add(ni);
      }
    }
  }

  // -------------------------------
  // Growth rules
  // -------------------------------
  function siteAngle(x, y) {
    return Math.atan2(y - seedCenterY, x - seedCenterX);
  }

  function anisWeight(theta, fold, strength) {
    return Math.max(0.03, 1 + strength * Math.cos(fold * theta));
  }

  function ruleStrength() {
    return parseFloat(ruleStrengthEl.value);
  }

  function growthWeight(i) {
    const [x, y] = xyFromIndex(i);
    const theta = siteAngle(x, y);
    const n4 = countOccupiedNeighbors4(x, y);
    const n8 = countOccupiedNeighbors8(x, y);
    const rule = growthRuleEl.value;
    const s = ruleStrength();

    // Isotropic Eden
    if (rule === "isotropic") {
      return 1.0;
    }

    // 4-fold anisotropic
    if (rule === "anis4") {
      return anisWeight(theta, 4, s);
    }

    // 6-fold anisotropic
    if (rule === "anis6") {
      return anisWeight(theta, 6, s);
    }

    // Surface-tension biased:
    // favor filling places with many occupied neighbors
    if (rule === "surface") {
      return 1.0 + s * (0.75 * n4 + 0.25 * n8);
    }

    // LPP-like corner growth:
    // strongly favor sites with >= 2 occupied nearest neighbors
    if (rule === "lpp") {
      if (n4 >= 2) return 2.5 + 2.2 * s + 0.45 * n4;
      return Math.max(0.03, 0.25 - 0.18 * s);
    }

    return 1.0;
  }

  function chooseWeightedFrontierSite() {
    if (frontier.size === 0) return null;

    let total = 0;
    const items = [];

    for (const i of frontier) {
      const w = growthWeight(i);
      if (w <= 0) continue;
      items.push([i, w]);
      total += w;
    }

    if (items.length === 0 || total <= 0) return null;

    let r = rng() * total;
    for (const [i, w] of items) {
      r -= w;
      if (r <= 0) return i;
    }
    return items[items.length - 1][0];
  }

  // -------------------------------
  // Drawing
  // -------------------------------
  function drawBackground() {
    ctx.fillStyle = "#fafaf7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

function colorForCell(i) {
  const t = bornStep[i];
  if (t === 0) return "#1f2937";

  const u = (stepCount <= 1) ? 0 : t / stepCount;

  // Stronger emphasis on recent growth
  const v = Math.pow(u, 0.35);

  const r = Math.round(40 + 90 * v);
  const g = Math.round(62 + 110 * v);
  const b = Math.round(86 + 145 * v);

  return `rgb(${r},${g},${b})`;
}

  function draw() {
    drawBackground();

    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const i = idx(x, y);
        if (!occupied[i]) continue;
        ctx.fillStyle = colorForCell(i);
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  // -------------------------------
  // UI text
  // -------------------------------
  function updateRuleStrengthUI() {
    const rule = growthRuleEl.value;
    const s = parseFloat(ruleStrengthEl.value);

    if (rule === "isotropic") {
      ruleStrengthLabelEl.textContent = "Rule strength";
      ruleStrengthEl.disabled = true;
      ruleStrengthValueEl.textContent = "—";
      return;
    }

    ruleStrengthEl.disabled = false;

    if (rule === "anis4" || rule === "anis6") {
      ruleStrengthLabelEl.textContent = "Anisotropy";
    } else if (rule === "surface") {
      ruleStrengthLabelEl.textContent = "Smoothing";
    } else if (rule === "lpp") {
      ruleStrengthLabelEl.textContent = "Corner bias";
    } else {
      ruleStrengthLabelEl.textContent = "Rule strength";
    }

    ruleStrengthValueEl.textContent = s.toFixed(2);
  }

  function updateInfo() {
    let occCount = 0;
    for (let i = 0; i < MAX_SITES; i++) occCount += occupied[i];

    infoEl.textContent =
      `occupied = ${occCount}, frontier = ${frontier.size}, steps = ${stepCount}`;
  }

  // -------------------------------
  // Simulation control
  // -------------------------------
  function stepSimulation(nSteps) {
    for (let k = 0; k < nSteps; k++) {
      if (frontier.size === 0) {
        pauseSimulation();
        break;
      }
      stepCount++;
      const i = chooseWeightedFrontierSite();
      if (i === null) {
        pauseSimulation();
        break;
      }
      occupySite(i);
    }
    draw();
    updateInfo();
  }

  function startSimulation() {
    if (running) return;
    running = true;
    pauseBtn.textContent = "Pause";

    timer = setInterval(() => {
      const n = clamp(parseInt(growthPerFrameEl.value, 10) || 40, 1, 1200);
      stepSimulation(n);
    }, 30);
  }

  function pauseSimulation() {
    if (!running) return;
    clearInterval(timer);
    timer = null;
    running = false;
    pauseBtn.textContent = "Resume";
  }

  function togglePause() {
    if (running) {
      pauseSimulation();
    } else {
      startSimulation();
    }
  }

  // -------------------------------
  // Seed rebuild
  // -------------------------------
  function buildSeedAndRestart() {
    pauseSimulation();
    resetArrays();

    seedCenterX = NX / 2;
    seedCenterY = NY / 2;

    const pts = buildSeedPolygon();
    fillPolygon(pts);
    rebuildFrontier();
    draw();
    updateInfo();
    updateRuleStrengthUI();
    startSimulation();
  }

  // -------------------------------
  // Events
  // -------------------------------
  pauseBtn.addEventListener("click", togglePause);

  stepBtn.addEventListener("click", () => {
    if (running) pauseSimulation();
    const n = clamp(parseInt(growthPerFrameEl.value, 10) || 40, 1, 1200);
    stepSimulation(n);
  });

  resetBtn.addEventListener("click", () => {
    buildSeedAndRestart();
  });

  seedShapeEl.addEventListener("change", buildSeedAndRestart);
  seedRadiusEl.addEventListener("change", buildSeedAndRestart);
  growthRuleEl.addEventListener("change", buildSeedAndRestart);

  ruleStrengthEl.addEventListener("input", () => {
    updateRuleStrengthUI();
  });

  growthPerFrameEl.addEventListener("change", () => {
    updateInfo();
  });

  // -------------------------------
  // Initial launch
  // -------------------------------
  updateRuleStrengthUI();
  buildSeedAndRestart();
})();
