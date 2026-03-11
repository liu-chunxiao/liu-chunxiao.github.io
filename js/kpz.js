// ============================================================
// Arbitrary-seed Eden / radial KPZ growth toy
// For liu-chunxiao.github.io / metaphysics.html
// ============================================================

(function () {
  "use strict";

// -------------------------------
// Canvas / lattice setup
// -------------------------------
const NX = 320;
const NY = 320;
const CELL = 2;   // internal drawing scale
const MAX_SITES = NX * NY;

const canvas = document.getElementById("kpzCanvas");
const ctx = canvas.getContext("2d");
canvas.width = NX * CELL;
canvas.height = NY * CELL;

  // -------------------------------
  // State
  // -------------------------------
  let occupied = new Uint8Array(MAX_SITES);     // 0 or 1
  let bornStep = new Int32Array(MAX_SITES);     // growth time
  let growthType = new Uint8Array(MAX_SITES); // occupied-neighbor count at birth
  let frontier = new Set();                     // candidate empty boundary sites
  let running = false;
  let timer = null;
  let stepCount = 0;
  let seedCenterX = NX / 2;
  let seedCenterY = NY / 2;

  // -------------------------------
  // Controls
  // -------------------------------
  const seedTypeEl = document.getElementById("kpzSeedType");
  const polygonSidesEl = document.getElementById("kpzPolygonSides");
  const seedRadiusEl = document.getElementById("kpzSeedRadius");
  const growthRuleEl = document.getElementById("kpzGrowthRule");
  const growthPerFrameEl = document.getElementById("kpzGrowthPerFrame");
  const anisotropyEl = document.getElementById("kpzAnisotropy");
  const smoothingEl = document.getElementById("kpzSmoothing");
  const randomSeedEl = document.getElementById("kpzRandomSeed");
  const infoEl = document.getElementById("kpzInfo");

  const startBtn = document.getElementById("kpzStartBtn");
  const pauseBtn = document.getElementById("kpzPauseBtn");
  const stepBtn = document.getElementById("kpzStepBtn");
  const resetBtn = document.getElementById("kpzResetBtn");

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

  function setRNG() {
    const s = parseInt(randomSeedEl.value, 10);
    if (Number.isFinite(s)) {
      rng = mulberry32(s);
    } else {
      rng = Math.random;
    }
  }

  function randRange(a, b) {
    return a + (b - a) * rng();
  }

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  // -------------------------------
  // Polygon / curve generation
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
    // Radial Fourier-style random blob
    const pts = [];
    const mMax = 5;
    const amps = [];
    const phases = [];
    for (let m = 2; m <= mMax; m++) {
      amps.push(randRange(0.03, 0.12) * r0 / Math.sqrt(m));
      phases.push(randRange(0, 2 * Math.PI));
    }

    const NPTS = 160;
    for (let j = 0; j < NPTS; j++) {
      const t = (2 * Math.PI * j) / NPTS;
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
          growthType[i] = 0;
        }
      }
    }
  }

  // -------------------------------
  // Frontier handling
  // -------------------------------
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

  const [x, y] = xyFromIndex(i);
  const nOcc = countOccupiedNeighbors4(x, y);

  occupied[i] = 1;
  bornStep[i] = stepCount;
  growthType[i] = nOcc;

  frontier.delete(i);

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
    return Math.max(0.05, 1 + strength * Math.cos(fold * theta));
  }

  function growthWeight(i) {
    const [x, y] = xyFromIndex(i);
    const theta = siteAngle(x, y);
    const nOcc = countOccupiedNeighbors4(x, y);
    const rule = growthRuleEl.value;
    const anis = parseFloat(anisotropyEl.value);
    const smooth = parseFloat(smoothingEl.value);

    if (rule === "isotropic") {
      return 1.0;
    }

    if (rule === "anis4") {
      return anisWeight(theta, 4, anis);
    }

    if (rule === "anis6") {
      return anisWeight(theta, 6, anis);
    }

    if (rule === "surface") {
      // Prefer filling notches / bays: more occupied neighbors => larger weight
      return 1.0 + smooth * nOcc;
    }

    if (rule === "lpp") {
      // Toy corner-growth rule:
      // strongly prefer sites with >=2 occupied neighbors
      // which makes faceted / corner-like outward growth.
      if (nOcc >= 2) {
        return 3.5 + 0.5 * nOcc;
      }
      return 0.08;
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

  function stepSimulation(nSteps) {
    for (let k = 0; k < nSteps; k++) {
      if (frontier.size === 0) {
        stopSimulation();
        break;
      }
      stepCount++;
      const i = chooseWeightedFrontierSite();
      if (i === null) {
        stopSimulation();
        break;
      }
      occupySite(i);
    }
    draw();
    updateInfo();
  }

  // -------------------------------
  // Drawing
  // -------------------------------
  function drawBackground() {
    ctx.fillStyle = "#fafaf7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

function colorForCell(i) {
  if (bornStep[i] === 0) return "#233044";

  const gt = growthType[i];
  let base;

  if (gt <= 1) base = [111, 134, 182];
  else if (gt === 2) base = [183, 194, 216];
  else if (gt === 3) base = [154, 141, 184];
  else base = [94, 111, 143];

  const age = Math.min(1, bornStep[i] / 20000);
  const mix = 0.12 * age; // gentle brightening over time

  const r = Math.round(base[0] * (1 - mix) + 245 * mix);
  const g = Math.round(base[1] * (1 - mix) + 245 * mix);
  const b = Math.round(base[2] * (1 - mix) + 245 * mix);

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

    // Optional frontier highlight: much softer than before
    ctx.fillStyle = "rgba(80, 50, 40, 0.06)";
    for (const i of frontier) {
      const [x, y] = xyFromIndex(i);
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  // -------------------------------
  // Init / reset
  // -------------------------------
function resetArrays() {
  occupied = new Uint8Array(MAX_SITES);
  bornStep = new Int32Array(MAX_SITES);
  growthType = new Uint8Array(MAX_SITES);
  frontier.clear();
  stepCount = 0;
}

  function buildSeed() {
    resetArrays();
    setRNG();

    seedCenterX = NX / 2;
    seedCenterY = NY / 2;

    const radius = parseInt(seedRadiusEl.value, 10);
    const seedType = seedTypeEl.value;

    let pts;
    if (seedType === "polygon") {
      const n = clamp(parseInt(polygonSidesEl.value, 10) || 6, 3, 20);
      pts = makeRegularPolygon(seedCenterX, seedCenterY, radius, n);
    } else {
      pts = makeRandomClosedCurve(seedCenterX, seedCenterY, radius);
    }

    fillPolygon(pts);
    rebuildFrontier();
    draw();
    updateInfo();
  }

  function updateInfo() {
    let occCount = 0;
    for (let i = 0; i < MAX_SITES; i++) {
      occCount += occupied[i];
    }
    infoEl.textContent =
      `occupied = ${occCount}, frontier = ${frontier.size}, steps = ${stepCount}`;
  }

  function startSimulation() {
    if (running) return;
    running = true;
    timer = setInterval(() => {
      const n = clamp(parseInt(growthPerFrameEl.value, 10) || 10, 1, 500);
      stepSimulation(n);
    }, 30);
  }

  function pauseSimulation() {
    if (!running) return;
    clearInterval(timer);
    timer = null;
    running = false;
  }

  function stopSimulation() {
    pauseSimulation();
  }

  // -------------------------------
  // Events
  // -------------------------------
  startBtn.addEventListener("click", startSimulation);
  pauseBtn.addEventListener("click", pauseSimulation);
  stepBtn.addEventListener("click", () => {
    const n = clamp(parseInt(growthPerFrameEl.value, 10) || 10, 1, 500);
    stepSimulation(n);
  });
  resetBtn.addEventListener("click", () => {
    pauseSimulation();
    buildSeed();
  });

  seedTypeEl.addEventListener("change", () => {
    const isPoly = seedTypeEl.value === "polygon";
    polygonSidesEl.disabled = !isPoly;
  });

  // Build first seed on load
  seedTypeEl.dispatchEvent(new Event("change"));
  buildSeed();
})();
