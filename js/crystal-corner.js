(function () {
  'use strict';

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  class CrystalCornerGame {
    constructor(container) {
      this.container = container;
      this.running = true;
      this.lastFrameTime = 0;
      this.pendingThermalize = 0;

      this.defaults = {
        L: 28,
        temperature: 0.65,
        sweepsPerFrame: 3,
        tileW: 17,
        tileH: 9,
        cubeH: 10
      };

      this.buildUI();
      this.attachEvents();
      this.resetModel(true);
      requestAnimationFrame((t) => this.animate(t));
    }

    buildUI() {
      this.container.classList.add('crystal-corner-game');
      this.container.innerHTML = `
        <div class="crystal-controls">
          <div class="crystal-control-grid">
            <label>
              <span>Crystal size L</span>
              <input type="range" min="10" max="46" step="2" value="${this.defaults.L}" data-role="L">
              <strong data-value="L">${this.defaults.L}</strong>
            </label>
            <label>
              <span>Temperature T</span>
              <input type="range" min="0.12" max="2.40" step="0.01" value="${this.defaults.temperature}" data-role="temperature">
              <strong data-value="temperature">${this.defaults.temperature.toFixed(2)}</strong>
            </label>
            <label>
              <span>Monte Carlo sweeps / frame</span>
              <input type="range" min="1" max="10" step="1" value="${this.defaults.sweepsPerFrame}" data-role="sweepsPerFrame">
              <strong data-value="sweepsPerFrame">${this.defaults.sweepsPerFrame}</strong>
            </label>
          </div>

          <div class="crystal-button-row">
            <button type="button" data-action="toggle">Pause</button>
            <button type="button" data-action="randomize">Randomize</button>
            <button type="button" data-action="thermalize">Thermalize</button>
            <button type="button" data-action="reset">Reset</button>
          </div>

          <div class="crystal-status" data-role="status"></div>
          <p class="crystal-caption">
            A discrete monotone corner crystal with fixed occupation on the <em>xy</em>, <em>yz</em>, and <em>xz</em> planes.
            The configuration is sampled by local Metropolis updates of a stepped surface. Lower <em>T</em> produces a smoother, more faceted corner;
            higher <em>T</em> produces a rougher random surface.
          </p>
        </div>

        <div class="crystal-canvas-wrap">
          <canvas width="980" height="700"></canvas>
        </div>
      `;

      this.canvas = this.container.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.statusEl = this.container.querySelector('[data-role="status"]');
      this.toggleBtn = this.container.querySelector('[data-action="toggle"]');

      this.inputs = {
        L: this.container.querySelector('input[data-role="L"]'),
        temperature: this.container.querySelector('input[data-role="temperature"]'),
        sweepsPerFrame: this.container.querySelector('input[data-role="sweepsPerFrame"]')
      };

      this.valueEls = {
        L: this.container.querySelector('[data-value="L"]'),
        temperature: this.container.querySelector('[data-value="temperature"]'),
        sweepsPerFrame: this.container.querySelector('[data-value="sweepsPerFrame"]')
      };
    }

    attachEvents() {
      Object.entries(this.inputs).forEach(([key, input]) => {
        input.addEventListener('input', () => {
          const value = Number(input.value);
          if (key === 'temperature') {
            this.valueEls[key].textContent = value.toFixed(2);
          } else {
            this.valueEls[key].textContent = String(value);
          }

          if (key === 'L') {
            this.resetModel(true);
          } else {
            this[key] = value;
            this.updateStatus();
          }
        });
      });

      this.container.querySelector('[data-action="toggle"]').addEventListener('click', () => {
        this.running = !this.running;
        this.toggleBtn.textContent = this.running ? 'Pause' : 'Resume';
      });

      this.container.querySelector('[data-action="randomize"]').addEventListener('click', () => {
        this.randomizeInterior();
        this.updateStatus();
        this.render();
      });

      this.container.querySelector('[data-action="thermalize"]').addEventListener('click', () => {
        this.pendingThermalize += 180;
      });

      this.container.querySelector('[data-action="reset"]').addEventListener('click', () => {
        this.resetModel(true);
      });
    }

    resetModel(resetControls) {
      if (resetControls) {
        this.L = Number(this.inputs.L.value);
        this.temperature = Number(this.inputs.temperature.value);
        this.sweepsPerFrame = Number(this.inputs.sweepsPerFrame.value);
      }

      this.N = this.L;
      this.h = Array.from({ length: this.N + 1 }, () => Array(this.N + 1).fill(0));

      for (let i = 0; i <= this.N; i += 1) {
        this.h[i][this.N] = 0;
        this.h[this.N][i] = 0;
      }

      for (let j = 0; j < this.N; j += 1) {
        this.h[0][j] = this.N;
      }
      for (let i = 0; i < this.N; i += 1) {
        this.h[i][0] = this.N;
      }

      // A simple faceted starting profile.
      for (let i = 1; i < this.N; i += 1) {
        for (let j = 1; j < this.N; j += 1) {
          this.h[i][j] = Math.max(0, this.N - Math.max(i, j));
        }
      }

      this.mcSteps = 0;
      this.accepts = 0;
      this.pendingThermalize = 0;
      this.updateStatus();
      this.render();
    }

    randomizeInterior() {
      // Random monotone fill obtained by walking from fixed boundaries inward.
      for (let i = 1; i < this.N; i += 1) {
        for (let j = 1; j < this.N; j += 1) {
          const hi = Math.min(this.h[i - 1][j], this.h[i][j - 1]);
          const lo = Math.max(this.h[i + 1][j], this.h[i][j + 1]);
          const span = Math.max(0, hi - lo);
          this.h[i][j] = hi - randInt(span + 1);
        }
      }
    }

    localEnergy(i, j, value) {
      const l = this.h[i - 1][j];
      const u = this.h[i][j - 1];
      const r = this.h[i + 1][j];
      const d = this.h[i][j + 1];
      return Math.abs(value - l) + Math.abs(value - u) + Math.abs(value - r) + Math.abs(value - d);
    }

    allowedInterval(i, j) {
      const lo = Math.max(this.h[i + 1][j], this.h[i][j + 1]);
      const hi = Math.min(this.h[i - 1][j], this.h[i][j - 1]);
      return [lo, hi];
    }

    metropolisAttempt() {
      const i = 1 + randInt(this.N - 1);
      const j = 1 + randInt(this.N - 1);
      const oldVal = this.h[i][j];
      const delta = Math.random() < 0.5 ? -1 : 1;
      const [lo, hi] = this.allowedInterval(i, j);
      const newVal = oldVal + delta;
      if (newVal < lo || newVal > hi) return;

      const oldE = this.localEnergy(i, j, oldVal);
      const newE = this.localEnergy(i, j, newVal);
      const dE = newE - oldE;

      const T = Math.max(1e-6, this.temperature);
      const accept = dE <= 0 || Math.random() < Math.exp(-dE / T);

      this.mcSteps += 1;
      if (accept) {
        this.h[i][j] = newVal;
        this.accepts += 1;
      }
    }

    sweep(count) {
      const attempts = count * this.N * this.N;
      for (let n = 0; n < attempts; n += 1) {
        this.metropolisAttempt();
      }
    }

    averageHeight() {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < this.N; i += 1) {
        for (let j = 0; j < this.N; j += 1) {
          sum += this.h[i][j];
          count += 1;
        }
      }
      return sum / count;
    }

    acceptanceRate() {
      return this.mcSteps > 0 ? this.accepts / this.mcSteps : 0;
    }

    animate(timestamp) {
      if (!this.lastFrameTime) this.lastFrameTime = timestamp;
      this.lastFrameTime = timestamp;

      if (this.running) {
        const sweeps = this.sweepsPerFrame + (this.pendingThermalize > 0 ? 10 : 0);
        this.sweep(sweeps);
        if (this.pendingThermalize > 0) this.pendingThermalize -= 1;
        this.updateStatus();
        this.render();
      }

      requestAnimationFrame((t) => this.animate(t));
    }

    isoPoint(i, j, z, originX, originY, tileW, tileH, cubeH) {
      const x = originX + (i - j) * tileW;
      const y = originY + (i + j) * tileH - z * cubeH;
      return { x, y };
    }

    drawPoly(points, fill, stroke) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let k = 1; k < points.length; k += 1) {
        ctx.lineTo(points[k].x, points[k].y);
      }
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    }

    renderBackdrop(originX, originY, tileW, tileH, cubeH) {
      const ctx = this.ctx;
      const N = this.N;
      ctx.save();
      ctx.lineWidth = 1;

      const p000 = this.isoPoint(0, 0, 0, originX, originY, tileW, tileH, cubeH);
      const pN00 = this.isoPoint(N, 0, 0, originX, originY, tileW, tileH, cubeH);
      const p0N0 = this.isoPoint(0, N, 0, originX, originY, tileW, tileH, cubeH);
      const pNN0 = this.isoPoint(N, N, 0, originX, originY, tileW, tileH, cubeH);
      const p00N = this.isoPoint(0, 0, N, originX, originY, tileW, tileH, cubeH);
      const pN0N = this.isoPoint(N, 0, N, originX, originY, tileW, tileH, cubeH);
      const p0NN = this.isoPoint(0, N, N, originX, originY, tileW, tileH, cubeH);

      // Base facets / reference box.
      this.drawPoly([p000, pN00, pNN0, p0N0], 'rgba(235,235,235,0.95)', 'rgba(160,160,160,0.55)');
      this.drawPoly([p000, pN00, pN0N, p00N], 'rgba(210,210,210,0.45)', 'rgba(160,160,160,0.45)');
      this.drawPoly([p000, p0N0, p0NN, p00N], 'rgba(190,190,190,0.40)', 'rgba(160,160,160,0.45)');

      // Box edges.
      ctx.strokeStyle = 'rgba(120,120,120,0.85)';
      ctx.beginPath();
      ctx.moveTo(p000.x, p000.y);
      [pN00, pNN0, p0N0, p000, p00N, pN0N, pN00, pN0N, p00N, p0NN, p0N0].forEach((p) => {
        ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    render() {
      const ctx = this.ctx;
      const canvas = this.canvas;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const N = this.N;
      const tileW = clamp(390 / N, 6.5, this.defaults.tileW);
      const tileH = tileW * 0.52;
      const cubeH = tileW * 0.65;
      const originX = canvas.width * 0.54;
      const originY = canvas.height * 0.82;

      this.renderBackdrop(originX, originY, tileW, tileH, cubeH);

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.65;

      // Draw cubes / exposed faces from back to front.
      for (let s = 2 * N - 2; s >= 0; s -= 1) {
        for (let i = Math.min(N - 1, s); i >= 0; i -= 1) {
          const j = s - i;
          if (j < 0 || j >= N) continue;
          const z = this.h[i][j];
          const pTop = this.isoPoint(i, j, z, originX, originY, tileW, tileH, cubeH);
          const pTopR = this.isoPoint(i + 1, j, z, originX, originY, tileW, tileH, cubeH);
          const pTopB = this.isoPoint(i, j + 1, z, originX, originY, tileW, tileH, cubeH);
          const pTopD = this.isoPoint(i + 1, j + 1, z, originX, originY, tileW, tileH, cubeH);

          // Right visible side: difference to cell (i+1, j)
          const zr = this.h[i + 1][j];
          if (z > zr) {
            const pLow1 = this.isoPoint(i + 1, j, zr, originX, originY, tileW, tileH, cubeH);
            const pLow2 = this.isoPoint(i + 1, j + 1, zr, originX, originY, tileW, tileH, cubeH);
            this.drawPoly([pTopR, pTopD, pLow2, pLow1], 'rgba(120,120,120,0.92)', 'rgba(235,235,235,0.25)');
          }

          // Front visible side: difference to cell (i, j+1)
          const zd = this.h[i][j + 1];
          if (z > zd) {
            const pLow1 = this.isoPoint(i, j + 1, zd, originX, originY, tileW, tileH, cubeH);
            const pLow2 = this.isoPoint(i + 1, j + 1, zd, originX, originY, tileW, tileH, cubeH);
            this.drawPoly([pTopB, pTopD, pLow2, pLow1], 'rgba(165,165,165,0.96)', 'rgba(235,235,235,0.28)');
          }

          // Top facet.
          this.drawPoly([pTop, pTopR, pTopD, pTopB], 'rgba(223,223,223,0.98)', 'rgba(90,90,90,0.08)');
        }
      }

      // Highlight the outer stepped ridge.
      ctx.strokeStyle = 'rgba(70,70,70,0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let i = 0; i < N; i += 1) {
        const p = this.isoPoint(i, 0, this.h[i][0], originX, originY, tileW, tileH, cubeH);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      for (let j = 1; j < N; j += 1) {
        const p = this.isoPoint(N - 1, j, this.h[N - 1][j], originX, originY, tileW, tileH, cubeH);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    updateStatus() {
      this.statusEl.innerHTML = `
        <span><strong>L</strong> = ${this.N}</span>
        <span><strong>T</strong> = ${this.temperature.toFixed(2)}</span>
        <span><strong>avg. height</strong> = ${this.averageHeight().toFixed(2)}</span>
        <span><strong>acceptance</strong> = ${(100 * this.acceptanceRate()).toFixed(1)}%</span>
      `;
    }
  }

  function initCrystalCornerGame() {
    const container = document.getElementById('crystal-corner-game');
    if (!container) return;
    if (container.dataset.initialized === 'true') return;
    container.dataset.initialized = 'true';
    new CrystalCornerGame(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCrystalCornerGame);
  } else {
    initCrystalCornerGame();
  }
})();
