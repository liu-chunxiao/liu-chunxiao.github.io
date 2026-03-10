document.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("crystal-corner-game");
  if (!host) return;

  host.innerHTML = `
    <div class="crystal-corner-game">
      <div class="crystal-controls">
        <label>
          L (crystal size)
          <input type="range" id="cc-L" min="12" max="54" value="24">
          <span id="cc-L-val">24</span>
        </label>

        <label>
          Temperature T
          <input type="range" id="cc-T" min="0.20" max="4.00" step="0.05" value="1.20">
          <span id="cc-T-val">1.20</span>
        </label>

        <label>
          MC sweeps / frame
          <input type="range" id="cc-sweeps" min="1" max="160" value="24">
          <span id="cc-sweeps-val">24</span>
        </label>

        <div class="crystal-button-row">
          <button id="cc-reset">Reset</button>
          <button id="cc-pause">Pause</button>
        </div>
      </div>

      <div class="crystal-canvas-wrap">
        <canvas id="cc-canvas" width="980" height="760"></canvas>
      </div>
    </div>
  `;

  const canvas = document.getElementById("cc-canvas");
  const ctx = canvas.getContext("2d");

  const LSlider = document.getElementById("cc-L");
  const TSlider = document.getElementById("cc-T");
  const sweepsSlider = document.getElementById("cc-sweeps");
  const LVal = document.getElementById("cc-L-val");
  const TVal = document.getElementById("cc-T-val");
  const sweepsVal = document.getElementById("cc-sweeps-val");
  const resetBtn = document.getElementById("cc-reset");
  const pauseBtn = document.getElementById("cc-pause");

  let L = parseInt(LSlider.value, 10);
  let T = parseFloat(TSlider.value);
  let sweepsPerFrame = parseInt(sweepsSlider.value, 10);
  let paused = false;

  // pi[a][b] is the Young-diagram height at coordinates
  // a,b = distance from the (L,L,L) corner along -x and -y directions.
  // Constraints:
  // pi[a][b] >= pi[a+1][b],  pi[a][b] >= pi[a][b+1]
  // 0 <= pi[a][b] <= L
  let pi = [];

  function make2D(n, m, value = 0) {
    return Array.from({ length: n }, () => Array(m).fill(value));
  }

  function initializePartition() {
    pi = make2D(L, L, 0);

    // Initial corner Young diagram:
    // deep near the corner (a,b small), decaying linearly away.
    const alpha = 0.78 * L;
    for (let a = 0; a < L; a++) {
      for (let b = 0; b < L; b++) {
        const v = Math.floor(Math.max(0, alpha - 0.82 * a - 0.82 * b));
        pi[a][b] = Math.min(L, v);
      }
    }
  }

  function canIncrease(a, b) {
    if (pi[a][b] >= L) return false;
    if (a > 0 && pi[a][b] + 1 > pi[a - 1][b]) return false;
    if (b > 0 && pi[a][b] + 1 > pi[a][b - 1]) return false;
    return true;
  }

  function canDecrease(a, b) {
    if (pi[a][b] <= 0) return false;
    if (a < L - 1 && pi[a][b] - 1 < pi[a + 1][b]) return false;
    if (b < L - 1 && pi[a][b] - 1 < pi[a][b + 1]) return false;
    return true;
  }

  function localDeltaE(up) {
    return up ? 1 : -1;
  }

  function activeSites() {
    const sites = [];
    for (let a = 0; a < L; a++) {
      for (let b = 0; b < L; b++) {
        const v = pi[a][b];
        const boundary =
          (v > 0 && canDecrease(a, b)) ||
          (v < L && canIncrease(a, b));
        if (boundary) sites.push([a, b]);
      }
    }
    return sites;
  }

  // More effective interface-focused Metropolis:
  // most proposals target active boundary sites.
  function metropolisSweep() {
    const sites = activeSites();
    const nMoves = Math.max(L * L, 4 * sites.length);

    for (let n = 0; n < nMoves; n++) {
      let a, b;
      if (sites.length > 0 && Math.random() < 0.8) {
        [a, b] = sites[(Math.random() * sites.length) | 0];
      } else {
        a = (Math.random() * L) | 0;
        b = (Math.random() * L) | 0;
      }

      const up = Math.random() < 0.5;

      if (up) {
        if (!canIncrease(a, b)) continue;
        const dE = localDeltaE(true);
        if (Math.random() < Math.exp(-dE / T)) {
          pi[a][b] += 1;
        }
      } else {
        if (!canDecrease(a, b)) continue;
        const dE = localDeltaE(false);
        if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
          pi[a][b] -= 1;
        }
      }
    }
  }

  // -------- isometric projection --------
  // Use equal cube-edge lengths in projected geometry.
  // This fixes the "squashed z" issue.
  const s = 15; // cube size scale

  function project(x, y, z) {
    const ox = canvas.width * 0.50;
    const oy = canvas.height * 0.20;

    // Classic isometric projection
    return {
      x: ox + (x - y) * s,
      y: oy + (x + y) * (0.5 * s) - z * s
    };
  }

  function quad(p1, p2, p3, p4, fill, stroke = null, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function poly(points, fill, stroke = null, lineWidth = 1) {
    if (points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let k = 1; k < points.length; k++) {
      ctx.lineTo(points[k].x, points[k].y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawOuterCube() {
    const top = [
      project(0, 0, L),
      project(L, 0, L),
      project(L, L, L),
      project(0, L, L)
    ];

    const right = [
      project(L, 0, 0),
      project(L, L, 0),
      project(L, L, L),
      project(L, 0, L)
    ];

    const left = [
      project(0, L, 0),
      project(L, L, 0),
      project(L, L, L),
      project(0, L, L)
    ];

    poly(left,  "#a6a6a6");
    poly(right, "#757575");
    poly(top,   "#d3d3d3");

    poly(left,  "rgba(0,0,0,0)", "rgba(120,120,120,0.20)", 1);
    poly(right, "rgba(0,0,0,0)", "rgba(120,120,120,0.20)", 1);
    poly(top,   "rgba(0,0,0,0)", "rgba(120,120,120,0.16)", 1);
  }

  // Convert Young-diagram coordinates (a,b,c), measured from the corner (L,L,L)
  // along (-x,-y,-z), to physical cube coordinates:
  // x = L-a, y = L-b, z = L-c
  function physFromYoung(a, b, c) {
    return { x: L - a, y: L - b, z: L - c };
  }

  function drawCavity() {
    const cells = [];
    for (let a = 0; a < L; a++) {
      for (let b = 0; b < L; b++) {
        const h = pi[a][b];
        if (h > 0) cells.push({ a, b, h, key: a + b });
      }
    }

    // Draw far-to-near in the cavity coordinate
    cells.sort((u, v) => v.key - u.key);

    for (const cell of cells) {
      const { a, b, h } = cell;

      // The exposed terrace is the bottom of the removed column:
      // c = h, i.e. physical z = L-h
      const zc = L - h;

      // In physical x,y, the cell occupies [L-a-1, L-a] × [L-b-1, L-b]
      const x0 = L - a - 1;
      const x1 = L - a;
      const y0 = L - b - 1;
      const y1 = L - b;

      // terrace
      const p1 = project(x0, y0, zc);
      const p2 = project(x1, y0, zc);
      const p3 = project(x1, y1, zc);
      const p4 = project(x0, y1, zc);
      quad(p1, p2, p3, p4, "#eeeeee", "rgba(150,150,150,0.16)", 0.7);

      // Compare with neighbor one step farther along -x, i.e. a+1
      const hx = (a + 1 < L) ? pi[a + 1][b] : 0;
      if (h > hx) {
        const zn = L - hx;
        const q1 = project(x0, y0, zn);
        const q2 = project(x0, y1, zn);
        const q3 = project(x0, y1, zc);
        const q4 = project(x0, y0, zc);
        quad(q1, q2, q3, q4, "#d8d8d8", "rgba(155,155,155,0.16)", 0.7);
      }

      // Compare with neighbor one step farther along -y, i.e. b+1
      const hy = (b + 1 < L) ? pi[a][b + 1] : 0;
      if (h > hy) {
        const zn = L - hy;
        const r1 = project(x0, y0, zn);
        const r2 = project(x1, y0, zn);
        const r3 = project(x1, y0, zc);
        const r4 = project(x0, y0, zc);
        quad(r1, r2, r3, r4, "#e2e2e2", "rgba(160,160,160,0.16)", 0.7);
      }
    }
  }

  function drawCubeEdges() {
    const A = project(0, 0, L);
    const B = project(L, 0, L);
    const C = project(L, L, L);
    const D = project(0, L, L);
    const E = project(L, 0, 0);
    const F = project(L, L, 0);
    const G = project(0, L, 0);

    ctx.strokeStyle = "rgba(110,110,110,0.26)";
    ctx.lineWidth = 1.0;

    const segs = [
      [A, B], [B, C], [C, D], [D, A],
      [B, E], [C, F], [D, G],
      [E, F], [F, G]
    ];

    for (const [u, v] of segs) {
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    }
  }

  function render() {
    drawBackground();
    drawOuterCube();
    drawCavity();
    drawCubeEdges();
  }

  function animate() {
    if (!paused) {
      for (let s = 0; s < sweepsPerFrame; s++) {
        metropolisSweep();
      }
      render();
    }
    requestAnimationFrame(animate);
  }

  LSlider.addEventListener("input", () => {
    L = parseInt(LSlider.value, 10);
    LVal.textContent = String(L);
    initializePartition();
    render();
  });

  TSlider.addEventListener("input", () => {
    T = parseFloat(TSlider.value);
    TVal.textContent = T.toFixed(2);
  });

  sweepsSlider.addEventListener("input", () => {
    sweepsPerFrame = parseInt(sweepsSlider.value, 10);
    sweepsVal.textContent = String(sweepsPerFrame);
  });

  resetBtn.addEventListener("click", () => {
    initializePartition();
    render();
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  });

  initializePartition();
  render();
  animate();
});
