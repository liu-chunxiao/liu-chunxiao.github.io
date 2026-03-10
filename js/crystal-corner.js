document.addEventListener("DOMContentLoaded", () => {

const container = document.getElementById("crystal-corner-game");
if (!container) return;

container.innerHTML = `
<div class="crystal-corner-game">

<div class="crystal-controls">

<label>
L (crystal size)
<input type="range" id="cc-L" min="10" max="60" value="30">
<span id="cc-L-val">30</span>
</label>

<label>
Temperature T
<input type="range" id="cc-T" min="0.1" max="5" step="0.1" value="1">
<span id="cc-T-val">1</span>
</label>

<label>
MC sweeps / frame
<input type="range" id="cc-sweeps" min="10" max="400" value="100">
<span id="cc-sweeps-val">100</span>
</label>

<div class="crystal-button-row">
<button id="cc-reset">Reset</button>
<button id="cc-pause">Pause</button>
</div>

</div>

<div class="crystal-canvas-wrap">
<canvas id="cc-canvas" width="700" height="520"></canvas>
</div>

</div>
`;

const canvas = document.getElementById("cc-canvas");
const ctx = canvas.getContext("2d");

let L = 30;
let T = 1;
let sweeps = 100;

let paused = false;

let h;

function init() {

h = [];

for (let i = 0; i < L; i++) {
h[i] = [];
for (let j = 0; j < L; j++) {

h[i][j] = Math.max(0, L - i - j - 1);

}
}

}

function volume() {

let v = 0;

for (let i=0;i<L;i++)
for (let j=0;j<L;j++)
v += h[i][j];

return v;

}

function allowedUp(i,j){

if (h[i][j] >= L) return false;

if (i>0 && h[i][j] >= h[i-1][j]) return false;
if (j>0 && h[i][j] >= h[i][j-1]) return false;

return true;
}

function allowedDown(i,j){

if (h[i][j] <= 0) return false;

if (i<L-1 && h[i][j] <= h[i+1][j]) return false;
if (j<L-1 && h[i][j] <= h[i][j+1]) return false;

return true;
}

function MCstep(){

let i = Math.floor(Math.random()*L);
let j = Math.floor(Math.random()*L);

let dir = Math.random()<0.5 ? 1 : -1;

if (dir===1 && allowedUp(i,j)){

let dE = 1;

if (Math.random() < Math.exp(-dE/T))
h[i][j]++;

}

if (dir===-1 && allowedDown(i,j)){

let dE = -1;

if (dE<=0 || Math.random() < Math.exp(-dE/T))
h[i][j]--;

}

}

function sweep(){

for (let k=0;k<L*L;k++)
MCstep();

}

function project(x,y,z){

let sx = canvas.width/2 + (x-y)*8;
let sy = 80 + (x+y)*4 - z*6;

return [sx,sy];
}

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height);

for (let i=0;i<L;i++)
for (let j=0;j<L;j++){

let z = L - h[i][j];

let [x,y] = project(i,j,z);

ctx.fillStyle = "#d9d9d9";
ctx.beginPath();
ctx.rect(x,y,6,6);
ctx.fill();

}

}

function frame(){

if (!paused){

for (let s=0;s<sweeps;s++)
sweep();

draw();

}

requestAnimationFrame(frame);

}

document.getElementById("cc-L").oninput = e=>{
L = parseInt(e.target.value);
document.getElementById("cc-L-val").innerText=L;
init();
};

document.getElementById("cc-T").oninput = e=>{
T = parseFloat(e.target.value);
document.getElementById("cc-T-val").innerText=T;
};

document.getElementById("cc-sweeps").oninput = e=>{
sweeps = parseInt(e.target.value);
document.getElementById("cc-sweeps-val").innerText=sweeps;
};

document.getElementById("cc-reset").onclick = ()=>{
init();
};

document.getElementById("cc-pause").onclick = ()=>{
paused=!paused;
};

init();
frame();

});
