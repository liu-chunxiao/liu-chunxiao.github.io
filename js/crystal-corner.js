document.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("crystal-corner-game");
  if (!host) return;

  host.innerHTML = `
    <div class="crystal-corner-game">
      <div class="crystal-controls">
        <label>
          L (crystal size)
          <input type="range" id="cc-L" min="12" max="52" value="28">
          <span id="cc-L-val">28</span>
        </label>

        <label>
          Temperature T
          <input type="range" id="cc-T" min="0.15" max="4.00" step="0.05" value="1.00">
          <span id="cc-T-val">1.00</span>
        </label>

        <label>
          MC sweeps / frame
          <input type="range" id="cc-sweeps" min="1" max="120" value="20">
          <span id="cc-sweeps-val">20</span>
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

  // h[i][j] = depth of removed cubes at column (i,j)
  // monotone constraints:
  // h[i][j] >= h[i+1][j], h[i][j] >= h[i][j+1]
  let h = [];

  // --------- camera / projection tuned toward PRE-like look ----------
  // x increases to viewer-right face
  // y increases to viewer-left face
  // z increases upward
  const tileW = 16;
  const tileH = 9;
  const stepH = 8;

  function project(x, y, z) {
    const ox = canvas.width * 0.50;
    const oy = canvas.height * 0.18;
    return {
      x: ox + (x - y) * tileW,
      y: oy + (x + y) * tileH - z * stepH
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

  function create2D(n, m, value = 0) {
    return Array.from({ length: n }, () => Array(m).fill(value));
  }

  function initializeHeights() {
    h = create2D(L, L, 0);

    // Smooth cavity near the visible top-front corner.
    // Chosen so the initial image already resembles the paper:
    // shallow near the facet edge, deep near the corner.
    const alpha = 0.72 * L;
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        const raw = alpha - 0.78 * i - 0.78 * j;
        h[i][j] = Math.max(0, Math.min(L, Math.floor(raw)));
      }
    }
  }

  function canIncrease(i, j) {
    if (h[i][j] >= L) return false;
    if (i > 0 && h[i][j] + 1 > h[i - 1][j]) return false;
    if (j > 0 && h[i][j] + 1 > h[i][j - 1]) return false;
    return true;
  }

  function canDecrease(i, j) {
    if (h[i][j] <= 0) return false;
    if (i < L - 1 && h[i][j] - 1 < h[i + 1][j]) return false;
    if (j < L - 1 && h[i][j] - 1 < h[i][j + 1]) return false;
    return true;
  }

  // Simple q^V / exp(-V/T)-like sampler on removed volume.
  function metropolisStep() {
    const i = Math.floor(Math.random() * L);
    const j = Math.floor(Math.random() * L);
    const up = Math.random() < 0.5;

    if (up) {
      if (!canIncrease(i, j)) return;
      const dE = 1;
      if (Math.random() < Math.exp(-dE / T)) {
        h[i][j] += 1;
      }
    } else {
      if (!canDecrease(i, j)) return;
      const dE = -1;
      if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
        h[i][j] -= 1;
      }
    }
  }

  function sweep() {
    for (let n = 0; n < L * L; n++) {
      metropolisStep();
    }
  }

  // ---------- outer cube ----------
  // Full cube spans 0<=x<=L, 0<=y<=L, 0<=z<=L
  // The cavity is carved downward from the top corner near (0,0,L).
  function drawOuterCubeFaces() {
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

    // draw broad solid faces first
    poly(left,  "#a8a8a8");
    poly(right, "#777777");
    poly(top,   "#d8d8d8");

    // subtle outlines
    poly(left,  "rgba(0,0,0,0)", "rgba(120,120,120,0.22)", 1);
    poly(right, "rgba(0,0,0,0)", "rgba(120,120,120,0.22)", 1);
    poly(top,   "rgba(0,0,0,0)", "rgba(120,120,120,0.18)", 1);
  }

  // ---------- carve cavity ----------
  // We draw the cavity terraces and interior walls over the cube.
  // zTop(i,j) = top height of remaining crystal at that column.
  // Since h is removed depth from top, zTop = L - h.
  function drawCavity() {
    const cells = [];
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        if (h[i][j] > 0) cells.push({ i, j, depth: h[i][j], key: i + j });
      }
    }

    // back-to-front painter order
    cells.sort((a, b) => a.key - b.key);

    for (const c of cells) {
      const i = c.i;
      const j = c.j;
      const zTop = L - h[i][j];

      // terrace (horizontal cavity floor at this local column)
      const p1 = project(i, j, zTop);
      const p2 = project(i + 1, j, zTop);
      const p3 = project(i + 1, j + 1, zTop);
      const p4 = project(i, j + 1, zTop);

      quad(p1, p2, p3, p4, "#f0f0f0", "rgba(150,150,150,0.14)", 0.8);

      // vertical wall against neighbor in +x direction
      const hx = (i + 1 < L) ? h[i + 1][j] : 0;
      const zNbrX = L - hx;
      if (h[i][j] > hx) {
        const q1 = project(i + 1, j, zNbrX);
        const q2 = project(i + 1, j + 1, zNbrX);
        const q3 = project(i + 1, j + 1, zTop);
        const q4 = project(i + 1, j, zTop);
        quad(q1, q2, q3, q4, "#d7d7d7", "rgba(155,155,155,0.18)", 0.8);
      }

      // vertical wall against neighbor in +y direction
      const hy = (j + 1 < L) ? h[i][j + 1] : 0;
      const zNbrY = L - hy;
      if (h[i][j] > hy) {
        const r1 = project(i, j + 1, zNbrY);
        const r2 = project(i + 1, j + 1, zNbrY);
        const r3 = project(i + 1, j + 1, zTop);
        const r4 = project(i, j + 1, zTop);
        quad(r1, r2, r3, r4, "#e1e1e1", "rgba(160,160,160,0.18)", 0.8);
      }
    }
  }

  // ---------- re-draw visible cube rims on top ----------
  function drawCubeEdges() {
    const A = project(0, 0, L);
    const B = project(L, 0, L);
    const C = project(L, L, L);
    const D = project(0, L, L);

    const E = project(L, 0, 0);
    const F = project(L, L, 0);
    const G = project(0, L, 0);

    ctx.strokeStyle = "rgba(120,120,120,0.28)";
    ctx.lineWidth = 1.1;

    const segments = [
      [A, B], [B, C], [C, D], [D, A],
      [B, E], [C, F], [D, G],
      [E, F], [F, G]
    ];

    for (const [u, v] of segments) {
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    }
  }

  // ---------- faint contour enhancement ----------
  function drawContourHints() {
    ctx.strokeStyle = "rgba(120,120,120,0.18)";
    ctx.lineWidth = 0.8;

    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        if (h[i][j] <= 0) continue;
        const z = L - h[i][j];
        const p1 = project(i, j, z);
        const p2 = project(i + 1, j, z);
        const p3 = project(i + 1, j + 1, z);
        const p4 = project(i, j + 1, z);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function render() {
    drawBackground();
    drawOuterCubeFaces();
    drawCavity();
    drawContourHints();
    drawCubeEdges();
  }

  function animate() {
    if (!paused) {
      for (let s = 0; s < sweepsPerFrame; s++) {
        sweep();
      }
      render();
    }
    requestAnimationFrame(animate);
  }

  LSlider.addEventListener("input", () => {
    L = parseInt(LSlider.value, 10);
    LVal.textContent = String(L);
    initializeHeights();
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
    initializeHeights();
    render();
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  });

  initializeHeights();
  render();
  animate();
});
