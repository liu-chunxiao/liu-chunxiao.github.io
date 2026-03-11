document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gol-canvas");
  const ctx = canvas.getContext("2d");

  const startBtn = document.getElementById("gol-start");
  const stepBtn = document.getElementById("gol-step");
  const clearBtn = document.getElementById("gol-clear");
  const randomBtn = document.getElementById("gol-random");

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
  let drawMode = 1; // 1 = make alive, 0 = make dead

  function makeEmptyGrid(r, c) {
    return Array.from({ length: r }, () => Array(c).fill(0));
  }

  function resizeCanvas() {
    const parentWidth = canvas.parentElement.clientWidth;
    const maxCanvasSize = Math.min(parentWidth, 720);
    canvas.width = maxCanvasSize;
    canvas.height = maxCanvasSize;
  }

  function initializeGrid() {
    grid = makeEmptyGrid(rows, cols);
    nextGrid = makeEmptyGrid(rows, cols);
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

  function clearGrid() {
    for (let i = 0; i < rows; i++) {
      grid[i].fill(0);
    }
    drawGrid();
  }

  function drawGrid() {
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background
    ctx.fillStyle = "#faf8f2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // live cells
    ctx.fillStyle = "#5f7c6f";
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (grid[i][j]) {
          ctx.fillRect(
            j * cellW + 0.5,
            i * cellH + 0.5,
            cellW - 1,
            cellH - 1
          );
        }
      }
    }

    // grid lines
    ctx.strokeStyle = "rgba(80, 80, 80, 0.16)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= rows; i++) {
      const y = i * cellH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    for (let j = 0; j <= cols; j++) {
      const x = j * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  }

  // Torus boundary condition:
  // (i + di + rows) % rows and (j + dj + cols) % cols
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
        const neighbors = countNeighbors(i, j);

        if (alive) {
          nextGrid[i][j] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
        } else {
          nextGrid[i][j] = (neighbors === 3) ? 1 : 0;
        }
      }
    }

    // swap references
    [grid, nextGrid] = [nextGrid, grid];
    drawGrid();
  }

  function currentInterval() {
    return parseInt(speedSlider.value, 10);
  }

  function updateSpeedLabel() {
    speedValue.textContent = `${speedSlider.value} ms`;
  }

  function updateSizeLabel() {
    sizeValue.textContent = `${sizeSlider.value} × ${sizeSlider.value}`;
  }

  function updateDensityLabel() {
    densityValue.textContent = densitySlider.value;
  }

  function restartTimerIfRunning() {
    if (!running) return;
    clearInterval(timer);
    timer = setInterval(stepSimulation, currentInterval());
  }

  function startSimulation() {
    if (running) return;
    running = true;
    startBtn.textContent = "Pause";
    timer = setInterval(stepSimulation, currentInterval());
  }

  function pauseSimulation() {
    running = false;
    startBtn.textContent = "Start";
    clearInterval(timer);
    timer = null;
  }

  function toggleSimulation() {
    if (running) {
      pauseSimulation();
    } else {
      startSimulation();
    }
  }

  function cellFromEvent(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    const j = Math.floor(x / cellW);
    const i = Math.floor(y / cellH);

    if (i < 0 || i >= rows || j < 0 || j >= cols) return null;
    return { i, j };
  }

  function paintCell(evt) {
    const cell = cellFromEvent(evt);
    if (!cell) return;
    grid[cell.i][cell.j] = drawMode;
    drawGrid();
  }

  canvas.addEventListener("mousedown", (evt) => {
    isMouseDown = true;
    const cell = cellFromEvent(evt);
    if (!cell) return;

    drawMode = grid[cell.i][cell.j] ? 0 : 1;
    grid[cell.i][cell.j] = drawMode;
    drawGrid();
  });

  canvas.addEventListener("mousemove", (evt) => {
    if (!isMouseDown) return;
    paintCell(evt);
  });

  window.addEventListener("mouseup", () => {
    isMouseDown = false;
  });

  canvas.addEventListener("mouseleave", () => {
    isMouseDown = false;
  });

  startBtn.addEventListener("click", toggleSimulation);

  stepBtn.addEventListener("click", () => {
    if (!running) stepSimulation();
  });

  clearBtn.addEventListener("click", () => {
    pauseSimulation();
    clearGrid();
  });

  randomBtn.addEventListener("click", () => {
    pauseSimulation();
    const density = parseFloat(densitySlider.value);
    randomizeGrid(density);
  });

  speedSlider.addEventListener("input", () => {
    updateSpeedLabel();
    restartTimerIfRunning();
  });

  sizeSlider.addEventListener("input", () => {
    updateSizeLabel();
    rows = parseInt(sizeSlider.value, 10);
    cols = rows;
    pauseSimulation();
    initializeGrid();
  });

  densitySlider.addEventListener("input", updateDensityLabel);

  window.addEventListener("resize", () => {
    resizeCanvas();
    drawGrid();
  });

  // Initial setup
  updateSpeedLabel();
  updateSizeLabel();
  updateDensityLabel();
  resizeCanvas();
  initializeGrid();
  randomizeGrid(parseFloat(densitySlider.value));
});
