(() => {
  // =========================================================
  // Lianliankan with PBC + 1-cell padding border
  // Board cells are (0..R-1, 0..C-1). Border ring is empty.
  // PBC applies to connectivity: row/col wrap-around is allowed.
  // =========================================================

  const THEMES = {
    animals: ["🐱","🐶","🦊","🐼","🐯","🐸","🐵","🐰","🦁","🐨","🐧","🦉","🐙","🐢","🦋","🐝","🦒","🦓","🦝","🦔"],
    music:   ["🎹","🎻","🎺","🥁","🎷","🎧","🎤","🎼","🎶","🎵","♪","♫","♩","♬","𝄞","🎸","🪕","🪘","🪗","📯"],
    math:    ["∞","∑","π","∂","∫","∇","⊗","⊕","≃","≡","≤","≥","ℤ","ℝ","ℂ","⚛","⟨","⟩","⊂","⊃"],
    cards:   ["♠","♥","♦","♣","♟","♞","♜","♝","♛","♚","🃏","🎴","👑","⚙️","⚑","🧩","🔷","🔶","⬣","⬡"],
    space:   ["🌌","🌙","☀️","⭐","🌟","🪐","☄️","🌍","🌎","🌏","🌑","🛰️","🚀","🛸","🧿","🌠","🔭","🧬","⚡","🔥"],
    food:    ["☕","🍵","🍫","🍪","🍎","🍋","🍇","🍓","🥐","🍞","🧀","🥑","🌶️","🥕","🍅","🫐","🍯","🍷","🧊","🍬"]
  };

  // Use Twemoji SVG from CDN for consistent scalable icons
  const USE_TWEMOJI = true;

  function emojiToTwemojiSvgUrl(emoji) {
    // Convert to codepoints and strip variation selectors (FE0F/FE0E)
    const cps = [];
    for (const ch of emoji) {
      const cp = ch.codePointAt(0);
      if (cp === 0xFE0F || cp === 0xFE0E) continue;
      cps.push(cp.toString(16));
    }
    return `https://twemoji.maxcdn.com/v/latest/svg/${cps.join("-")}.svg`;
  }

  function looksLikeEmoji(symbol) {
    return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(symbol);
  }

  function renderSymbolHTML(symbol) {
    if (!USE_TWEMOJI) return `<span class="llk-symbol">${symbol}</span>`;
    if (!looksLikeEmoji(symbol)) return `<span class="llk-symbol">${symbol}</span>`;
    const url = emojiToTwemojiSvgUrl(symbol);
    return `<span class="llk-symbol"><img src="${url}" alt="${symbol}" loading="lazy"></span>`;
  }

  // =========================================================
  // DOM
  // =========================================================
  const boardEl = document.getElementById("llk-board");
  const statusEl = document.getElementById("llk-status");
  const newBtn = document.getElementById("llk-new");
  const shuffleBtn = document.getElementById("llk-shuffle");
  const sizeSel = document.getElementById("llk-size");
  const themeSel = document.getElementById("llk-theme");

  const canvas = document.getElementById("llk-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;

  const stageEl = document.getElementById("llk-stage");

  const zoomOutBtn = document.getElementById("llk-zoom-out");
  const zoomInBtn = document.getElementById("llk-zoom-in");
  const zoomResetBtn = document.getElementById("llk-zoom-reset");

  if (!boardEl || !statusEl || !sizeSel || !themeSel || !canvas || !ctx || !stageEl) {
    // Required elements not present on this page
    return;
  }

  // =========================================================
  // Zoom
  // =========================================================
  let zoom = 1.0;

  function resizeCanvasToBoard() {
    const rect = stageEl.getBoundingClientRect();
    canvas.width = Math.round(rect.width * devicePixelRatio);
    canvas.height = Math.round(rect.height * devicePixelRatio);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    clearPath();
  }

  function applyZoom() {
    stageEl.style.transform = `scale(${zoom})`;
    resizeCanvasToBoard();
  }

  zoomInBtn?.addEventListener("click", () => {
    zoom = Math.min(2.0, zoom + 0.1);
    applyZoom();
  });

  zoomOutBtn?.addEventListener("click", () => {
    zoom = Math.max(0.4, zoom - 0.1);
    applyZoom();
  });

  zoomResetBtn?.addEventListener("click", () => {
    zoom = 1.0;
    applyZoom();
  });

  // =========================================================
  // State
  // =========================================================
  let R = 8, C = 8;               // full grid including padding ring
  let grid = [];
  let first = null, second = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  function parseSize() {
    const [r,c] = sizeSel.value.split("x").map(Number);
    R = r; C = c;
    R = Math.max(R, 4);
    C = Math.max(C, 4);
  }

  function currentSymbols() {
    const k = themeSel.value;
    return THEMES[k] || THEMES.animals;
  }

  function makeEmptyGrid() {
    grid = Array.from({length: R}, () => Array(C).fill(null));
  }

  function shuffleArray(a) {
    for (let i=a.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isBorder(r,c) {
    return r===0 || c===0 || r===R-1 || c===C-1;
  }

  function remainingTiles() {
    let count = 0;
    for (let r=1; r<=R-2; r++) {
      for (let c=1; c<=C-2; c++) {
        if (grid[r][c] !== null) count++;
      }
    }
    return count;
  }

  function renderBoard() {
    boardEl.style.gridTemplateColumns = `repeat(${C}, minmax(0, 1fr))`;
    boardEl.innerHTML = "";

    for (let r=0; r<R; r++) {
      for (let c=0; c<C; c++) {
        const v = grid[r][c];
        const tile = document.createElement("div");
        const empty = (v === null);

        tile.className = "tile" + (empty ? " empty" : "");
        tile.dataset.r = r;
        tile.dataset.c = c;
        tile.innerHTML = empty ? "" : renderSymbolHTML(v);

        tile.addEventListener("click", () => onTileClick(tile));
        boardEl.appendChild(tile);
      }
    }
  }

  function clearPath() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function getTileSizePx() {
    const el = boardEl.querySelector(".tile");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {w: rect.width, h: rect.height};
  }

  // Note: these constants should match your CSS (gap=2px, padding=6px in the latest CSS I gave)
  function cellCenterPx(r,c) {
    const tile = getTileSizePx();
    if (!tile) return {x:0, y:0};

    const gap = 2;
    const pad = 6;
    const x = (c + 0.5) * (tile.w + gap) - gap/2 + pad;
    const y = (r + 0.5) * (tile.h + gap) - gap/2 + pad;
    return {x,y};
  }

  function drawPath(points) {
    clearPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();

    const p0 = cellCenterPx(points[0].r, points[0].c);
    ctx.moveTo(p0.x, p0.y);
    for (let i=1; i<points.length; i++) {
      const pi = cellCenterPx(points[i].r, points[i].c);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.stroke();
    setTimeout(clearPath, 180);
  }

  // =========================================================
  // PBC line-clear checks
  // =========================================================
  function isEmptyCell(r,c, p1, p2) {
    if (p1 && r===p1.r && c===p1.c) return true;
    if (p2 && r===p2.r && c===p2.c) return true;
    return grid[r][c] === null;
  }

  function stepsRow(c1,c2,dir) {
    let steps = 0, c = c1;
    while (c !== c2) {
      c = (c + dir + C) % C;
      steps++;
      if (steps > C+2) break;
    }
    return steps;
  }

  function stepsCol(r1,r2,dir) {
    let steps = 0, r = r1;
    while (r !== r2) {
      r = (r + dir + R) % R;
      steps++;
      if (steps > R+2) break;
    }
    return steps;
  }

  function lineClearRowPBC(r, c1, c2, p1, p2) {
    if (c1 === c2) return {ok:true, path:[{r,c:c1},{r,c:c2}]};

    // forward
    let okF = true, c = c1;
    const pathF = [{r,c:c1}];
    while (true) {
      c = (c + 1) % C;
      if (c === c2) break;
      if (!isEmptyCell(r,c,p1,p2)) { okF=false; break; }
    }
    if (okF) pathF.push({r,c:c2});

    // backward
    let okB = true; c = c1;
    const pathB = [{r,c:c1}];
    while (true) {
      c = (c - 1 + C) % C;
      if (c === c2) break;
      if (!isEmptyCell(r,c,p1,p2)) { okB=false; break; }
    }
    if (okB) pathB.push({r,c:c2});

    if (!okF && !okB) return {ok:false, path:[]};

    const chosen = (okF && okB)
      ? (stepsRow(c1,c2,+1) <= stepsRow(c1,c2,-1) ? pathF : pathB)
      : (okF ? pathF : pathB);

    return {ok:true, path:chosen};
  }

  function lineClearColPBC(c, r1, r2, p1, p2) {
    if (r1 === r2) return {ok:true, path:[{r:r1,c},{r:r2,c}]};

    // forward
    let okF = true, r = r1;
    const pathF = [{r:r1,c}];
    while (true) {
      r = (r + 1) % R;
      if (r === r2) break;
      if (!isEmptyCell(r,c,p1,p2)) { okF=false; break; }
    }
    if (okF) pathF.push({r:r2,c});

    // backward
    let okB = true; r = r1;
    const pathB = [{r:r1,c}];
    while (true) {
      r = (r - 1 + R) % R;
      if (r === r2) break;
      if (!isEmptyCell(r,c,p1,p2)) { okB=false; break; }
    }
    if (okB) pathB.push({r:r2,c});

    if (!okF && !okB) return {ok:false, path:[]};

    const chosen = (okF && okB)
      ? (stepsCol(r1,r2,+1) <= stepsCol(r1,r2,-1) ? pathF : pathB)
      : (okF ? pathF : pathB);

    return {ok:true, path:chosen};
  }

  function lineClearPBC(pA, pB, p1, p2) {
    if (pA.r === pB.r) return lineClearRowPBC(pA.r, pA.c, pB.c, p1, p2);
    if (pA.c === pB.c) return lineClearColPBC(pA.c, pA.r, pB.r, p1, p2);
    return {ok:false, path:[]};
  }

  function compress(points) {
    const out = [points[0]];
    for (let i=1;i<points.length-1;i++) {
      const a = out[out.length-1], b = points[i], c = points[i+1];
      const collinear = (a.r===b.r && b.r===c.r) || (a.c===b.c && b.c===c.c);
      if (!collinear) out.push(b);
    }
    out.push(points[points.length-1]);
    return out;
  }

  function findPath(p1, p2) {
    // 0-turn
    if (p1.r===p2.r || p1.c===p2.c) {
      const seg = lineClearPBC(p1, p2, p1, p2);
      if (seg.ok) return compress(seg.path);
    }

    // 1-turn
    const corner1 = {r: p1.r, c: p2.c};
    if (isEmptyCell(corner1.r,corner1.c,p1,p2)) {
      const s1 = lineClearPBC(p1, corner1, p1, p2);
      const s2 = lineClearPBC(corner1, p2, p1, p2);
      if (s1.ok && s2.ok) return compress([p1, corner1, p2]);
    }

    const corner2 = {r: p2.r, c: p1.c};
    if (isEmptyCell(corner2.r,corner2.c,p1,p2)) {
      const s1 = lineClearPBC(p1, corner2, p1, p2);
      const s2 = lineClearPBC(corner2, p2, p1, p2);
      if (s1.ok && s2.ok) return compress([p1, corner2, p2]);
    }

    // 2-turn: scan rows
    for (let r=0; r<R; r++) {
      const a = {r, c: p1.c};
      const b = {r, c: p2.c};
      if (isEmptyCell(a.r,a.c,p1,p2) && isEmptyCell(b.r,b.c,p1,p2)) {
        const s1 = lineClearPBC(p1, a, p1, p2);
        const s2 = lineClearPBC(a, b, p1, p2);
        const s3 = lineClearPBC(b, p2, p1, p2);
        if (s1.ok && s2.ok && s3.ok) return compress([p1, a, b, p2]);
      }
    }

    // 2-turn: scan cols
    for (let c=0; c<C; c++) {
      const a = {r: p1.r, c};
      const b = {r: p2.r, c};
      if (isEmptyCell(a.r,a.c,p1,p2) && isEmptyCell(b.r,b.c,p1,p2)) {
        const s1 = lineClearPBC(p1, a, p1, p2);
        const s2 = lineClearPBC(a, b, p1, p2);
        const s3 = lineClearPBC(b, p2, p1, p2);
        if (s1.ok && s2.ok && s3.ok) return compress([p1, a, b, p2]);
      }
    }

    return null;
  }

  // =========================================================
  // Game mechanics
  // =========================================================
  function newGame() {
    parseSize();
    makeEmptyGrid();
    first = second = null;

    const innerR = R - 2;
    const innerC = C - 2;
    const total = innerR * innerC;
    const usable = (total % 2 === 0) ? total : total - 1;
    const pairs = usable / 2;

    const syms = currentSymbols();
    const pool = [];
    for (let i=0;i<pairs;i++) {
      const s = syms[i % syms.length];
      pool.push(s, s);
    }
    shuffleArray(pool);

    let k = 0;
    for (let r=1; r<=R-2; r++) {
      for (let c=1; c<=C-2; c++) {
        grid[r][c] = (k < pool.length) ? pool[k++] : null;
      }
    }

    renderBoard();
    applyZoom();  // ensures canvas matches stage (esp. after size changes)
    setStatus("Pick two identical tiles (PBC + padding ring).");
  }

  function shuffleRemaining() {
    const pos = [];
    for (let r=1; r<=R-2; r++) {
      for (let c=1; c<=C-2; c++) {
        if (grid[r][c] !== null) pos.push([r,c]);
      }
    }
    const vals = pos.map(([r,c]) => grid[r][c]);
    shuffleArray(vals);
    for (let i=0;i<pos.length;i++) {
      const [r,c] = pos[i];
      grid[r][c] = vals[i];
    }
    first = second = null;
    renderBoard();
    applyZoom();
    setStatus("Shuffled. Continue.");
  }

  function resetSelectionSoon() {
    setTimeout(() => {
      if (first) first.el.classList.remove("selected");
      if (second) second.el.classList.remove("selected");
      first = second = null;
      setStatus("Pick two identical tiles.");
    }, 220);
  }

  function onTileClick(tileEl) {
    const r = Number(tileEl.dataset.r);
    const c = Number(tileEl.dataset.c);
    const v = grid[r][c];

    if (v === null) return;
    if (isBorder(r,c)) return;

    if (first && first.r===r && first.c===c) {
      tileEl.classList.remove("selected");
      first = null;
      setStatus("Pick two identical tiles.");
      return;
    }

    if (!first) {
      first = {r,c,el: tileEl};
      tileEl.classList.add("selected");
      setStatus("Pick the matching tile.");
      return;
    }

    second = {r,c,el: tileEl};
    second.el.classList.add("selected");

    const v1 = grid[first.r][first.c];
    const v2 = grid[second.r][second.c];

    if (v1 !== v2) {
      setStatus("Not the same. Try again.");
      return resetSelectionSoon();
    }

    const path = findPath(first, second);
    if (!path) {
      setStatus("Blocked (needs >2 turns).");
      return resetSelectionSoon();
    }

    drawPath(path);
    grid[first.r][first.c] = null;
    grid[second.r][second.c] = null;

    first.el.classList.remove("selected");
    second.el.classList.remove("selected");
    first = second = null;

    renderBoard();
    applyZoom();

    const rem = remainingTiles();
    if (rem === 0) setStatus("🎉 Cleared! New Game?");
    else setStatus(`Nice. ${rem} tiles left.`);
  }

  // Events
  newBtn?.addEventListener("click", newGame);
  shuffleBtn?.addEventListener("click", shuffleRemaining);
  sizeSel?.addEventListener("change", newGame);
  themeSel?.addEventListener("change", newGame);
  window.addEventListener("resize", applyZoom);

  // Start
  newGame();
})();
