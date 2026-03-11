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

    function makeEmptyGrid(r, c) {
      return Array.from({ length: r }, () => Array(c).fill(0));
    }

    function resizeCanvas() {
      const wrap = canvas.parentElement;
      const wrapWidth = wrap ? wrap.clientWidth : 720;
      const size = Math.max(260, Math.min(wrapWidth - 12, 720));
      canvas.width = size;
      canvas.height = size;
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
      pauseSimulation();
      randomizeGrid(parseFloat(densitySlider.value));
    });

    zoomInBtn.addEventListener("click", () => {
      zoomFactor = Math.min(zoomMax, zoomFactor + zoomStep);
      applyZoom();
    });

    zoomOutBtn.addEventListener("click", () => {
      zoomFactor = Math.max(zoomMin, zoomFactor - zoomStep);
      applyZoom();
    });

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
    });

    densitySlider.addEventListener("input", updateLabels);

    window.addEventListener("resize", () => {
      resizeCanvas();
      drawGrid();
    });

    updateLabels();
    resizeCanvas();
    initializeGrid();
    randomizeGrid(parseFloat(densitySlider.value));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGameOfLife);
  } else {
    initGameOfLife();
  }
})();
