document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("crystal-corner-game");
  if (!container) return;

  container.innerHTML = `
    <div class="crystal-corner-game">
      <div class="crystal-controls">
        <label>
          L (crystal size)
          <input type="range" id="cc-L" min="12" max="55" value="28">
          <span id="cc-L-val">28</span>
        </label>

        <label>
          Temperature T
          <input type="range" id="cc-T" min="0.15" max="4.0" step="0.05" value="1.0">
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
        <canvas id="cc-canvas" width="920" height="700"></canvas>
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

  // h[i][j] = depth of removed cubes at position (i,j)
  // plane partition constraints:
  // h[i][j] >= h[i+1][j], h[i][j] >= h[i][j+1]
  let h = [];

  function makeArray(n, m, value = 0) {
    return Array.from({ length: n }, () => Array(m).fill(value));
  }

  function initializeHeights() {
    h = makeArray(L, L, 0);

    // A smooth-ish initial cavity near one corner.
    // This avoids the totally flat/frozen look from the previous version.
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        const val = Math.max(0, Math.floor(0.75 * L - 0.9 * i - 0.9 * j));
        h[i][j] = Math.min(L, val);
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

  // Boltzmann weight ~ exp(-V_removed / T)
  // Increasing h increases removed volume by +1
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

  // ---------- isometric projection ----------
  const tileW = 18;
  const tileH = 10;
  const stepH = 9;

  function project(x, y, z) {
    const originX = canvas.width * 0.50;
    const originY = canvas.height * 0.18;
    return {
      x: originX + (x - y) * tileW,
      y: originY + (x + y) * tileH - z * stepH
    };
  }

  function drawQuad(p1, p2, p3, p4, fill, stroke = null) {
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
      ctx.stroke();
    }
  }

  // We draw the *visible cavity boundary*:
  // horizontal terraces + two vertical side walls.
  function drawSurface() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // soft background
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw order: back to front
    const cells = [];
    for (let i = 0; i < L; i++) {
      for (let j = 0; j < L; j++) {
        cells.push({ i, j, key: i + j });
      }
    }
    cells.sort((a, b) => a.key - b.key);

    for (const cell of cells) {
      const i = cell.i;
      const j = cell.j;
      const zTop = h[i][j];

      if (zTop <= 0) continue;

      // Top terrace at height zTop
      const p1 = project(i, j, zTop);
      const p2 = project(i + 1, j, zTop);
      const p3 = project(i + 1, j + 1, zTop);
      const p4 = project(i, j + 1, zTop);

      drawQuad(p1, p2, p3, p4, "#dcdcdc", "#efefef");

      // Right/down visible wall if neighbor in +i direction is lower
      const hi = (i + 1 < L) ? h[i + 1][j] : 0;
      if (zTop > hi) {
        const q1 = project(i + 1, j, hi);
        const q2 = project(i + 1, j + 1, hi);
        const q3 = project(i + 1, j + 1, zTop);
        const q4 = project(i + 1, j, zTop);
        drawQuad(q1, q2, q3, q4, "#b8b8b8", "#d8d8d8");
      }

      // Left/down visible wall if neighbor in +j direction is lower
      const hj = (j + 1 < L) ? h[i][j + 1] : 0;
      if (zTop > hj) {
        const r1 = project(i, j + 1, hj);
        const r2 = project(i + 1, j + 1, hj);
        const r3 = project(i + 1, j + 1, zTop);
        const r4 = project(i, j + 1, zTop);
        drawQuad(r1, r2, r3, r4, "#c8c8c8", "#e0e0e0");
      }
    }

    drawOuterCubeHint();
  }

  // This draws faint outer cube edges so the cavity reads as "inside a cube"
  function drawOuterCubeHint() {
    const topA = project(0, 0, 0);
    const topB = project(L, 0, 0);
    const topC = project(L, L, 0);
    const topD = project(0, L, 0);

    const bottomA = project(0, 0, -L * 0.95);
    const bottomB = project(L, 0, -L * 0.95);
    const bottomC = project(L, L, -L * 0.95);
    const bottomD = project(0, L, -L * 0.95);

    ctx.strokeStyle = "rgba(120,120,120,0.20)";
    ctx.lineWidth = 1.2;

    // top rhombus
    ctx.beginPath();
    ctx.moveTo(topA.x, topA.y);
    ctx.lineTo(topB.x, topB.y);
    ctx.lineTo(topC.x, topC.y);
    ctx.lineTo(topD.x, topD.y);
    ctx.closePath();
    ctx.stroke();

    // vertical-ish edges
    for (const [u, v] of [
      [topA, bottomA],
      [topB, bottomB],
      [topC, bottomC],
      [topD, bottomD]
    ]) {
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    }
  }

  function animate() {
    if (!paused) {
      for (let s = 0; s < sweepsPerFrame; s++) {
        sweep();
      }
      drawSurface();
    }
    requestAnimationFrame(animate);
  }

  LSlider.addEventListener("input", () => {
    L = parseInt(LSlider.value, 10);
    LVal.textContent = String(L);
    initializeHeights();
    drawSurface();
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
    drawSurface();
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  });

  initializeHeights();
  drawSurface();
  animate();
});
