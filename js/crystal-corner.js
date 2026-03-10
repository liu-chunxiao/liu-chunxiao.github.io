document.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("crystal-corner-game");
  if (!host) return;

  host.innerHTML = `
    <div class="crystal-corner-game">
      <div class="crystal-controls">
        <label>
          L (crystal size)
          <input type="range" id="cc-Lexp" min="2" max="10" step="1" value="5">
          <span id="cc-L-val">32</span>
        </label>

        <label>
          Temperature T
          <input type="range" id="cc-T" min="0.20" max="4.00" step="0.05" value="1.20">
          <span id="cc-T-val">1.20</span>
        </label>

        <label>
          MC sweeps / snapshot
          <input type="range" id="cc-sweeps" min="1" max="200" value="20">
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

  const LexpSlider = document.getElementById("cc-Lexp");
  const TSlider = document.getElementById("cc-T");
  const sweepsSlider = document.getElementById("cc-sweeps");
  const LVal = document.getElementById("cc-L-val");
  const TVal = document.getElementById("cc-T-val");
  const sweepsVal = document.getElementById("cc-sweeps-val");
  const resetBtn = document.getElementById("cc-reset");
  const pauseBtn = document.getElementById("cc-pause");

  let paused = false;

  // Physical cube size shown to the user
  let Ltrue = 2 ** parseInt(LexpSlider.value, 10);

  // Internal simulation size (coarse-grained for large Ltrue)
  let N = effectiveResolution(Ltrue);

  let T = parseFloat(TSlider.value);
  let sweepsPerSnapshot = parseInt(sweepsSlider.value, 10);

  // Slower snapshots
  const SNAPSHOT_INTERVAL_MS = 260;
  let lastSnapshotTime = 0;

  // pi[a][b]: height of removed column in Young-diagram coordinates
  let pi = [];

  function effectiveResolution(L) {
    // Exact for small/moderate L, coarse-grained for large L.
    // This keeps the browser responsive.
    return Math.min(L, 96);
  }

  function make2D(n, m, value = 0) {
    return Array.from({ length: n }, () => Array(m).fill(value));
  }

  function initializePartition() {
    N = effectiveResolution(Ltrue);
    pi = make2D(N, N, 0);

    const alpha = 0.78 * N;
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) {
        const v = Math.floor(Math.max(0, alpha - 0.82 * a - 0.82 * b));
        pi[a][b] = Math.min(N, v);
      }
    }
  }

  function canIncrease(a, b) {
    if (pi[a][b] >= N) return false;
    if (a > 0 && pi[a][b] + 1 > pi[a - 1][b]) return false;
    if (b > 0 && pi[a][b] + 1 > pi[a][b - 1]) return false;
    return true;
  }

  function canDecrease(a, b) {
    if (pi[a][b] <= 0) return false;
    if (a < N - 1 && pi[a][b] - 1 < pi[a + 1][b]) return false;
    if (b < N - 1 && pi[a][b] - 1 < pi[a][b + 1]) return false;
    return true;
  }

  function interfaceBiasedSweep() {
    const tries = Math.max(N * N, 6 * N * N);

    for (let n = 0; n < tries; n++) {
      let a, b;

      // Mild interface bias: sample more often near the corner / active region
      if (Math.random() < 0.75) {
        a = Math.min(N - 1, Math.floor(-Math.log(1 - Math.random()) * 0.22 * N));
        b = Math.min(N - 1, Math.floor(-Math.log(1 - Math.random()) * 0.22 * N));
      } else {
        a = (Math.random() * N) | 0;
        b = (Math.random() * N) | 0;
      }

      const up = Math.random() < 0.5;

      if (up) {
        if (!canIncrease(a, b)) continue;
        const dE = 1;
        if (Math.random() < Math.exp(-dE / T)) {
          pi[a][b] += 1;
        }
      } else {
        if (!canDecrease(a, b)) continue;
        if (Math.random() < 1.0) {
          pi[a][b] -= 1;
        }
      }
    }
  }

  // ---------- Projection with automatic fit ----------
  // We deliberately make z visually longer than before.
  // The projection is still "isometric-like", but tuned for readability.
  let proj = {
    scale: 1,
    ox: 0,
    oy: 0,
    sx: 1,
    sy: 0.56,   // slightly smaller y compression
    sz: 1.30    // larger z scale so cube looks taller
  };

  function unitProject(x, y, z) {
    return {
      x: (x - y) * proj.sx,
      y: (x + y) * proj.sy - z * proj.sz
    };
  }

  function recomputeProjection() {
    const corners = [
      [0, 0, 0],
      [N, 0, 0],
      [0, N, 0],
      [N, N, 0],
      [0, 0, N],
      [N, 0, N],
      [0, N, N],
      [N, N, N]
    ].map(([x, y, z]) => unitProject(x, y, z));

    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of corners) {
      xmin = Math.min(xmin, p.x);
      xmax = Math.max(xmax, p.x);
      ymin = Math.min(ymin, p.y);
      ymax = Math.max(ymax, p.y);
    }

    const marginX = 34;
    const marginTop = 26;
    const marginBottom = 26;

    const wAvail = canvas.width - 2 * marginX;
    const hAvail = canvas.height - marginTop - marginBottom;

    const scaleX = wAvail / (xmax - xmin);
    const scaleY = hAvail / (ymax - ymin);
    proj.scale = Math.min(scaleX, scaleY);

    // Center horizontally; vertically place the cube slightly lower
    proj.ox = canvas.width * 0.50 - proj.scale * 0.5 * (xmin + xmax);
    proj.oy = canvas.height * 0.56 - proj.scale * 0.5 * (ymin + ymax);
  }

  function project(x, y, z) {
    const p = unitProject(x, y, z);
    return {
      x: proj.ox + proj.scale * p.x,
      y: proj.oy + proj.scale * p.y
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
      project(0, 0, N),
      project(N, 0, N),
      project(N, N, N),
      project(0, N, N)
    ];

    const right = [
      project(N, 0, 0),
      project(N, N, 0),
      project(N, N, N),
      project(N, 0, N)
    ];

    const left = [
      project(0, N, 0),
      project(N, N, 0),
      project(N, N, N),
      project(0, N, N)
    ];

    poly(left,  "#a8a8a8");
    poly(right, "#7b7b7b");
    poly(top,   "#d2d2d2");

    poly(left,  "rgba(0,0,0,0)", "rgba(120,120,120,0.16)", 1);
    poly(right, "rgba(0,0,0,0)", "rgba(120,120,120,0.16)", 1);
    poly(top,   "rgba(0,0,0,0)", "rgba(120,120,120,0.12)", 1);
  }

  function drawCavity() {
    const cells = [];
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) {
        const h = pi[a][b];
        if (h > 0) cells.push({ a, b, h, key: a + b });
      }
    }

    // far to near
    cells.sort((u, v) => v.key - u.key);

    for (const cell of cells) {
      const { a, b, h } = cell;

      // Young diagram anchored at (N,N,N)
      const x0 = N - a - 1;
      const x1 = N - a;
      const y0 = N - b - 1;
      const y1 = N - b;
      const zc = N - h;

      const p1 = project(x0, y0, zc);
      const p2 = project(x1, y0, zc);
      const p3 = project(x1, y1, zc);
      const p4 = project(x0, y1, zc);
      quad(p1, p2, p3, p4, "#ededed", "rgba(150,150,150,0.12)", 0.7);

      const hx = (a + 1 < N) ? pi[a + 1][b] : 0;
      if (h > hx) {
        const zn = N - hx;
        const q1 = project(x0, y0, zn);
        const q2 = project(x0, y1, zn);
        const q3 = project(x0, y1, zc);
        const q4 = project(x0, y0, zc);
        quad(q1, q2, q3, q4, "#d9d9d9", "rgba(150,150,150,0.10)", 0.7);
      }

      const hy = (b + 1 < N) ? pi[a][b + 1] : 0;
      if (h > hy) {
        const zn = N - hy;
        const r1 = project(x0, y0, zn);
        const r2 = project(x1, y0, zn);
        const r3 = project(x1, y0, zc);
        const r4 = project(x0, y0, zc);
        quad(r1, r2, r3, r4, "#e3e3e3", "rgba(150,150,150,0.10)", 0.7);
      }
    }
  }

  function drawCubeEdges() {
    const A = project(0, 0, N);
    const B = project(N, 0, N);
    const C = project(N, N, N);
    const D = project(0, N, N);
    const E = project(N, 0, 0);
    const F = project(N, N, 0);
    const G = project(0, N, 0);

    ctx.strokeStyle = "rgba(105,105,105,0.24)";
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
    recomputeProjection();
    drawBackground();
    drawOuterCube();
    drawCavity();
    drawCubeEdges();
  }

  function animate(timestamp) {
    if (!paused && timestamp - lastSnapshotTime >= SNAPSHOT_INTERVAL_MS) {
      for (let s = 0; s < sweepsPerSnapshot; s++) {
        interfaceBiasedSweep();
      }
      render();
      lastSnapshotTime = timestamp;
    }
    requestAnimationFrame(animate);
  }

  LexpSlider.addEventListener("input", () => {
    Ltrue = 2 ** parseInt(LexpSlider.value, 10);
    LVal.textContent = String(Ltrue);
    initializePartition();
    render();
  });

  TSlider.addEventListener("input", () => {
    T = parseFloat(TSlider.value);
    TVal.textContent = T.toFixed(2);
  });

  sweepsSlider.addEventListener("input", () => {
    sweepsPerSnapshot = parseInt(sweepsSlider.value, 10);
    sweepsVal.textContent = String(sweepsPerSnapshot);
  });

  resetBtn.addEventListener("click", () => {
    initializePartition();
    render();
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  });

  LVal.textContent = String(Ltrue);
  TVal.textContent = T.toFixed(2);
  sweepsVal.textContent = String(sweepsPerSnapshot);

  initializePartition();
  render();
  requestAnimationFrame(animate);
});
