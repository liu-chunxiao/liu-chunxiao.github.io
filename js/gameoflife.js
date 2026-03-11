(function () {
  function initGameOfLife() {
    const canvas = document.getElementById("gol-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startBtn = document.getElementById("gol-start");
    const stepBtn = document.getElementById("gol-step");
    const clearBtn = document.getElementById("gol-clear");
    const randomBtn = document.getElementById("gol-random");
    const zoomInBtn = document.getElementById("gol-zoom-in");
    const zoomOutBtn = document.getElementById("gol-zoom-out");

    const seedSelect = document.getElementById("gol-seed-type");

    const speedSlider = document.getElementById("gol-speed");
    const speedValue = document.getElementById("gol-speed-value");

    const sizeSlider = document.getElementById("gol-size");
    const sizeValue = document.getElementById("gol-size-value");

    const densitySlider = document.getElementById("gol-density");
    const densityValue = document.getElementById("gol-density-value");

    let rows = parseInt(sizeSlider.value, 10);
    let cols = rows;

    let grid = [];
    let nextGrid = [];

    let running = false;
    let timer = null;

    let isMouseDown = false;
    let drawMode = 1;

    let zoomFactor = 1.0;
    const zoomMin = 0.6;
    const zoomMax = 2.4;
    const zoomStep = 0.2;

    const CHARACTER_SEEDS = new Set([
      "王","李","张","刘","陈","杨","赵","黄","周","吴",
      "徐","孙","胡","朱","高","林","何","郭","马"
    ]);

    function makeEmptyGrid(r, c) {
      return Array.from({ length: r }, () => Array(c).fill(0));
    }

    function resizeCanvas() {
      let size = 500;

      if (window.innerWidth <= 980) {
        const wrap = canvas.parentElement;
        const wrapStyles = window.getComputedStyle(wrap);
        const horizontalPadding =
          parseFloat(wrapStyles.paddingLeft) + parseFloat(wrapStyles.paddingRight);

        size = Math.floor(wrap.clientWidth - horizontalPadding);
        size = Math.max(220, size);
      }

      canvas.width = size;
      canvas.height = size;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      applyZoom();
    }

    function applyZoom() {
      canvas.style.transform = `scale(${zoomFactor})`;
    }

    function initializeGrid() {
      grid = makeEmptyGrid(rows, cols);
      nextGrid = makeEmptyGrid(rows, cols);
      drawGrid();
    }

    function clearGrid() {
      for (let i = 0; i < rows; i++) {
        grid[i].fill(0);
      }
      drawGrid();
    }

    function randomizeGrid(density = 0.28) {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          grid[i][j] = Math.random() < density ? 1 : 0;
        }
      }
      drawGrid();
    }

    function drawGrid() {
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#faf8f2";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (grid[i][j]) {
            ctx.fillStyle = "#5f7c6f";
            ctx.fillRect(
              j * cellW + 0.5,
              i * cellH + 0.5,
              Math.max(0, cellW - 1),
              Math.max(0, cellH - 1)
            );
          }
        }
      }

      ctx.strokeStyle = "rgba(80,80,80,0.16)";
      ctx.lineWidth = 1;

      for (let i = 0; i <= rows; i++) {
        const y = i * cellH + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      for (let j = 0; j <= cols; j++) {
        const x = j * cellW + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    }

    function countNeighbors(r, c) {
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = (r + dr + rows) % rows;
          const cc = (c + dc + cols) % cols;
          count += grid[rr][cc];
        }
      }
      return count;
    }

    function stepSimulation() {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const alive = grid[i][j] === 1;
          const n = countNeighbors(i, j);

          if (alive) {
            nextGrid[i][j] = (n === 2 || n === 3) ? 1 : 0;
          } else {
            nextGrid[i][j] = (n === 3) ? 1 : 0;
          }
        }
      }

      [grid, nextGrid] = [nextGrid, grid];
      drawGrid();
    }

    function pauseSimulation() {
      running = false;
      startBtn.textContent = "Start";
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startSimulation() {
      running = true;
      startBtn.textContent = "Pause";
      timer = setInterval(stepSimulation, parseInt(speedSlider.value, 10));
    }

    function restartTimerIfRunning() {
      if (!running) return;
      clearInterval(timer);
      timer = setInterval(stepSimulation, parseInt(speedSlider.value, 10));
    }

    function updateLabels() {
      speedValue.textContent = `${speedSlider.value} ms`;
      sizeValue.textContent = `${sizeSlider.value} × ${sizeSlider.value}`;
      densityValue.textContent = densitySlider.value;
    }

    function cellFromPointerEvent(evt) {
      const rect = canvas.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;

      const j = Math.floor((x / rect.width) * cols);
      const i = Math.floor((y / rect.height) * rows);

      if (i < 0 || i >= rows || j < 0 || j >= cols) return null;
      return { i, j };
    }

    function paintFromEvent(evt) {
      const cell = cellFromPointerEvent(evt);
      if (!cell) return;
      grid[cell.i][cell.j] = drawMode;
      drawGrid();
    }

    function getBoundingBoxFromAlpha(alpha, w, h, threshold = 20) {
      let xmin = w, xmax = -1, ymin = h, ymax = -1;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const a = alpha[(y * w + x) * 4 + 3];
          if (a > threshold) {
            if (x < xmin) xmin = x;
            if (x > xmax) xmax = x;
            if (y < ymin) ymin = y;
            if (y > ymax) ymax = y;
          }
        }
      }

      if (xmax < xmin || ymax < ymin) {
        return null;
      }

      return { xmin, xmax, ymin, ymax };
    }

    function seedCharacter(ch) {
      const off = document.createElement("canvas");
      const offSize = 512;
      off.width = offSize;
      off.height = offSize;
      const octx = off.getContext("2d", { willReadFrequently: true });

      octx.clearRect(0, 0, offSize, offSize);
      octx.fillStyle = "#000";
      octx.textAlign = "center";
      octx.textBaseline = "middle";

      const fontStack = [
        '"Noto Sans CJK SC"',
        '"Noto Sans SC"',
        '"PingFang SC"',
        '"Hiragino Sans GB"',
        '"Microsoft YaHei"',
        '"Heiti SC"',
        '"SimHei"',
        'sans-serif'
      ].join(", ");

      let fontSize = Math.floor(offSize * 0.82);
      octx.font = `700 ${fontSize}px ${fontStack}`;
      octx.fillText(ch, offSize / 2, offSize / 2);

      let img = octx.getImageData(0, 0, offSize, offSize);
      let box = getBoundingBoxFromAlpha(img.data, offSize, offSize);

      if (!box) {
        clearGrid();
        return;
      }

      octx.clearRect(0, 0, offSize, offSize);

      const bw = box.xmax - box.xmin + 1;
      const bh = box.ymax - box.ymin + 1;
      const target = 0.80 * Math.min(offSize, offSize);
      const scale = target / Math.max(bw, bh);

      fontSize = Math.max(20, Math.floor(fontSize * scale));
      octx.font = `700 ${fontSize}px ${fontStack}`;
      octx.fillStyle = "#000";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(ch, offSize / 2, offSize / 2);

      img = octx.getImageData(0, 0, offSize, offSize);
      box = getBoundingBoxFromAlpha(img.data, offSize, offSize);

      if (!box) {
        clearGrid();
        return;
      }

      const w = box.xmax - box.xmin + 1;
      const h = box.ymax - box.ymin + 1;

      const targetCols = Math.max(1, Math.floor(cols * 0.80));
      const targetRows = Math.max(1, Math.floor(rows * 0.80));
      const scaleToGrid = Math.min(targetCols / w, targetRows / h);

      const sampledW = Math.max(1, Math.round(w * scaleToGrid));
      const sampledH = Math.max(1, Math.round(h * scaleToGrid));

      const offsetX = Math.floor((cols - sampledW) / 2);
      const offsetY = Math.floor((rows - sampledH) / 2);

      grid = makeEmptyGrid(rows, cols);
      nextGrid = makeEmptyGrid(rows, cols);

      for (let gy = 0; gy < sampledH; gy++) {
        for (let gx = 0; gx < sampledW; gx++) {
          const srcX = Math.floor(box.xmin + (gx + 0.5) / scaleToGrid);
          const srcY = Math.floor(box.ymin + (gy + 0.5) / scaleToGrid);
          const idx = (srcY * offSize + srcX) * 4 + 3;
          const alpha = img.data[idx];

          if (alpha > 70) {
            const row = offsetY + gy;
            const col = offsetX + gx;
            if (row >= 0 && row < rows && col >= 0 && col < cols) {
              grid[row][col] = 1;
            }
          }
        }
      }

      drawGrid();
    }

    function applyCurrentSeed() {
      const seed = seedSelect ? seedSelect.value : "random";
      pauseSimulation();

      if (CHARACTER_SEEDS.has(seed)) {
        seedCharacter(seed);
      } else {
        randomizeGrid(parseFloat(densitySlider.value));
      }
    }

    canvas.addEventListener("mousedown", (evt) => {
      isMouseDown = true;
      const cell = cellFromPointerEvent(evt);
      if (!cell) return;
      drawMode = grid[cell.i][cell.j] ? 0 : 1;
      grid[cell.i][cell.j] = drawMode;
      drawGrid();
    });

    canvas.addEventListener("mousemove", (evt) => {
      if (!isMouseDown) return;
      paintFromEvent(evt);
    });

    window.addEventListener("mouseup", () => {
      isMouseDown = false;
    });

    startBtn.addEventListener("click", () => {
      if (running) pauseSimulation();
      else startSimulation();
    });

    stepBtn.addEventListener("click", () => {
      if (!running) stepSimulation();
    });

    clearBtn.addEventListener("click", () => {
      pauseSimulation();
      clearGrid();
    });

    randomBtn.addEventListener("click", () => {
      if (seedSelect) seedSelect.value = "random";
      applyCurrentSeed();
    });

    zoomInBtn.addEventListener("click", () => {
      zoomFactor = Math.min(zoomMax, zoomFactor + zoomStep);
      applyZoom();
    });

    zoomOutBtn.addEventListener("click", () => {
      zoomFactor = Math.max(zoomMin, zoomFactor - zoomStep);
      applyZoom();
    });

    if (seedSelect) {
      seedSelect.addEventListener("change", () => {
        applyCurrentSeed();
      });
    }

    speedSlider.addEventListener("input", () => {
      updateLabels();
      restartTimerIfRunning();
    });

    sizeSlider.addEventListener("input", () => {
      updateLabels();
      rows = parseInt(sizeSlider.value, 10);
      cols = rows;
      pauseSimulation();
      initializeGrid();

      const seed = seedSelect ? seedSelect.value : "random";
      if (CHARACTER_SEEDS.has(seed)) {
        seedCharacter(seed);
      } else {
        randomizeGrid(parseFloat(densitySlider.value));
      }
    });

    densitySlider.addEventListener("input", () => {
      updateLabels();
    });

    window.addEventListener("resize", () => {
      resizeCanvas();
      drawGrid();
    });

    updateLabels();
    resizeCanvas();
    initializeGrid();
    applyCurrentSeed();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGameOfLife);
  } else {
    initGameOfLife();
  }
})();
