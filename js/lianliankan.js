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

// Use Twemoji SVG from CDN to make icons consistent + scalable
const USE_TWEMOJI = true;  // set false if you prefer plain emoji text

  // ≤ 2 turns
  const MAX_TURNS = 2;

  // DOM
  const boardEl = document.getElementById("llk-board");
  const statusEl = document.getElementById("llk-status");
  const newBtn = document.getElementById("llk-new");
  const shuffleBtn = document.getElementById("llk-shuffle");
  const sizeSel = document.getElementById("llk-size");
  const themeSel = document.getElementById("llk-theme");
  const canvas = document.getElementById("llk-canvas");
  const ctx = canvas.getContext("2d");

  // State
  let R = 8, C = 10;                 // visible grid size INCLUDING padding ring
  let grid = [];                     // grid[r][c] = null or symbol
  let first = null, second = null;   // selected tiles

  function setStatus(msg) { statusEl.textContent = msg; }

  function parseSize() {
    const [r,c] = sizeSel.value.split("x").map(Number);
    R = r; C = c;
    if (R < 4 || C < 4) {
      // need room for padding ring + interior
      R = Math.max(R, 4);
      C = Math.max(C, 4);
    }
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

  // Border ring is always empty: r=0, r=R-1, c=0, c=C-1
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
    boardEl.style.gridTemplateColumns = `repeat(${C}, 1fr)`;
    boardEl.innerHTML = "";

    for (let r=0; r<R; r++) {
      for (let c=0; c<C; c++) {
        const v = grid[r][c];
        const tile = document.createElement("div");

        // Border ring is shown as empty, visually subtle
        const empty = (v === null);
        tile.className = "tile" + (empty ? " empty" : "");
        tile.dataset.r = r;
        tile.dataset.c = c;
        tile.innerHTML = empty ? "" : renderSymbolHTML(v);

        // Click only on non-empty interior tiles
        tile.addEventListener("click", () => onTileClick(tile));
        boardEl.appendChild(tile);
      }
    }
  }

  function resizeCanvasToBoard() {
    const rect = boardEl.getBoundingClientRect();
    canvas.width = Math.round(rect.width * devicePixelRatio);
    canvas.height = Math.round(rect.height * devicePixelRatio);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    clearPath();
  }

  function clearPath() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  function getTileSizePx() {
    const el = boardEl.querySelector(".tile");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {w: rect.width, h: rect.height};
  }

  function cellCenterPx(r,c) {
    // depends on CSS: padding 14px, gap 8px
    const tile = getTileSizePx();
    if (!tile) return {x:0,y:0};
    const gap = 8;
    const pad = 14;
    const x = (c + 0.5) * (tile.w + gap) - gap/2 + pad;
    const y = (r + 0.5) * (tile.h + gap) - gap/2 + pad;
    return {x,y};
  }

  function drawPath(points) {
    // points: array of {r,c} in [0..R-1],[0..C-1]
    clearPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();

    const p0 = cellCenterPx(points[0].r, points[0].c);
    ctx.moveTo(p0.x, p0.y);
    for (let i=1;i<points.length;i++) {
      const pi = cellCenterPx(points[i].r, points[i].c);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.stroke();
    setTimeout(clearPath, 180);
  }

  // =========================================================
  // PBC line-clear checks
  // In same row: there are two wrap paths between c1 and c2.
  // In same col: two wrap paths between r1 and r2.
  // We accept if either direction is clear (through empties),
  // allowing endpoints as occupied (selected tiles).
  // =========================================================

  function isEmptyCell(r,c, p1, p2) {
    if (p1 && r===p1.r && c===p1.c) return true;
    if (p2 && r===p2.r && c===p2.c) return true;
    return grid[r][c] === null;
  }

  function lineClearRowPBC(r, c1, c2, p1, p2) {
    if (c1 === c2) return {ok:true, path:[{r,c:c1},{r,c:c2}]};

    // forward direction from c1 to c2
    let okF = true;
    let c = c1;
    const pathF = [{r,c:c1}];
    while (true) {
      c = (c + 1) % C;
      if (c === c2) break;
      if (!isEmptyCell(r,c,p1,p2)) { okF=false; break; }
    }
    if (okF) pathF.push({r,c:c2});

    // backward direction
    let okB = true;
    c = c1;
    const pathB = [{r,c:c1}];
    while (true) {
      c = (c - 1 + C) % C;
      if (c === c2) break;
      if (!isEmptyCell(r,c,p1,p2)) { okB=false; break; }
    }
    if (okB) pathB.push({r,c:c2});

    if (!okF && !okB) return {ok:false, path:[]};

    // choose shorter for drawing
    const chosen = (okF && okB)
      ? (stepsRow(c1,c2,+1) <= stepsRow(c1,c2,-1) ? pathF : pathB)
      : (okF ? pathF : pathB);

    return {ok:true, path:chosen};
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

  function lineClearColPBC(c, r1, r2, p1, p2) {
    if (r1 === r2) return {ok:true, path:[{r:r1,c},{r:r2,c}]};

    // forward direction from r1 to r2
    let okF = true;
    let r = r1;
    const pathF = [{r:r1,c}];
    while (true) {
      r = (r + 1) % R;
      if (r === r2) break;
      if (!isEmptyCell(r,c,p1,p2)) { okF=false; break; }
    }
    if (okF) pathF.push({r:r2,c});

    // backward direction
    let okB = true;
    r = r1;
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

  function stepsCol(r1,r2,dir) {
    let steps = 0, r = r1;
    while (r !== r2) {
      r = (r + dir + R) % R;
      steps++;
      if (steps > R+2) break;
    }
    return steps;
  }

  function lineClearPBC(pA, pB, p1, p2) {
    if (pA.r === pB.r) return lineClearRowPBC(pA.r, pA.c, pB.c, p1, p2);
    if (pA.c === pB.c) return lineClearColPBC(pA.c, pA.r, pB.r, p1, p2);
    return {ok:false, path:[]};
  }

  // Compress polyline points if collinear
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

  // Find path ≤ 2 turns with PBC
  function findPath(p1, p2) {
    // 0-turn
    if (p1.r===p2.r || p1.c===p2.c) {
      const seg = lineClearPBC(p1, p2, p1, p2);
      if (seg.ok) return compress(seg.path);
    }

    // 1-turn: corners (p1.r, p2.c) and (p2.r, p1.c)
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

    // 2-turn: scan candidate intermediate rows
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

    // 2-turn: scan candidate intermediate cols
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

    // Fill only interior (1..R-2, 1..C-2). Border ring empty.
    const innerR = R - 2;
    const innerC = C - 2;
    const total = innerR * innerC;

    // If odd, leave one interior empty to keep pairing (or adjust size).
    const usable = (total % 2 === 0) ? total : total - 1;
    const pairs = usable / 2;

    const syms = currentSymbols();
    const pool = [];
    for (let i=0;i<pairs;i++) {
      const s = syms[i % syms.length];
      pool.push(s, s);
    }
    shuffleArray(pool);

    // Fill interior
    let k = 0;
    for (let r=1; r<=R-2; r++) {
      for (let c=1; c<=C-2; c++) {
        if (k < pool.length) grid[r][c] = pool[k++];
        else grid[r][c] = null; // if total was odd, one empty
      }
    }

    renderBoard();
    resizeCanvasToBoard();
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
    setStatus("Shuffled. Continue.");
  }

  function onTileClick(tileEl) {
    const r = Number(tileEl.dataset.r);
    const c = Number(tileEl.dataset.c);
    const v = grid[r][c];

    // only allow clicks on non-empty interior
    if (v === null) return;
    if (isBorder(r,c)) return;

    // toggle off
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

    // success
    drawPath(path);
    grid[first.r][first.c] = null;
    grid[second.r][second.c] = null;

    first.el.classList.remove("selected");
    second.el.classList.remove("selected");
    first = second = null;

    renderBoard();

    const rem = remainingTiles();
    if (rem === 0) setStatus("🎉 Cleared! New Game?");
    else setStatus(`Nice. ${rem} tiles left.`);
  }

  function resetSelectionSoon() {
    setTimeout(() => {
      if (first) first.el.classList.remove("selected");
      if (second) second.el.classList.remove("selected");
      first = second = null;
      setStatus("Pick two identical tiles.");
    }, 220);
  }


  function emojiToTwemojiSvgUrl(emoji) {
  // Convert emoji to codepoint(s) like "1f60a" or "1f1eb-1f1f7"
  const codepoints = Array.from(emoji)
    .map(ch => ch.codePointAt(0).toString(16))
    .join("-");
  return `https://twemoji.maxcdn.com/v/latest/svg/${codepoints}.svg`;
}

function renderSymbolHTML(symbol) {
  if (!USE_TWEMOJI) {
    return `<span class="llk-symbol">${symbol}</span>`;
  }
  // Twemoji works best for actual emoji; for pure math symbols we keep text
  const looksLikeEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(symbol);
  if (!looksLikeEmoji) {
    return `<span class="llk-symbol">${symbol}</span>`;
  }
  const url = emojiToTwemojiSvgUrl(symbol);
  return `<span class="llk-symbol"><img src="${url}" alt="${symbol}"></span>`;
}

  // Events
  newBtn?.addEventListener("click", newGame);
  shuffleBtn?.addEventListener("click", shuffleRemaining);
  sizeSel?.addEventListener("change", newGame);
  themeSel?.addEventListener("change", newGame);

  window.addEventListener("resize", resizeCanvasToBoard);

  // Start
  if (boardEl) newGame();
})();
