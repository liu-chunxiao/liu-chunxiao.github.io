const words = [
  ["quantum", 16],
  ["lattice", 11],
  ["spin liquid", 10],
  ["spin", 7],
  ["topological", 7],
  ["entanglement", 6],
  ["symmetry", 5],
  ["pyrochlore", 5],
  ["triangular", 5],
  ["frustrated", 4],
  ["twisted bilayer graphene", 4],
  ["transition", 4],
  ["magnetization", 3],
  ["many-body", 3],
  ["magic angle", 3],
  ["thermal", 3],
  ["gapped", 3],
  ["realization", 3],
  ["diamond", 3],
  ["sachdev-ye-kitaev", 3],
  ["non-unitary", 3],
  ["antiferromagnet", 2],
  ["constraint", 2],
  ["correlation", 2],
  ["coupling", 2],
  ["dynamics", 2],
  ["emergent", 2],
  ["excitation", 2],
  ["flat band", 2],
  ["interlayer", 2],
  ["itinerant", 2],
  ["magnetism", 2],
  ["phase", 2],
  ["purification", 2],
  ["randomness", 2],
  ["universality", 2],
  ["lieb-schultz-mattis", 2],
  ["chain", 2],
  ["carrier", 2]
];

// Backdoor option: change this to "circle", "square", "diamond", "hexagon", etc.
const WORDCLOUD_SHAPE = "hexagon";

const palette = [
  "#5b6c8f",
  "#8b5e3c",
  "#7b8f6a",
  "#8c6f9c",
  "#4f7c82",
  "#a06d5f"
];

function pickColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function renderWordCloud() {
  const canvas = document.getElementById("wordcloud");

  WordCloud(canvas, {
    list: words,
    shape: WORDCLOUD_SHAPE,

    // Smaller grid helps fit more words
    gridSize: 6,

    // Make size differences less extreme so freq=2 words survive
    weightFactor: function (freq) {
      return 12 + freq * 2.2;
    },

    fontFamily: "Georgia, Garamond, 'Times New Roman', serif",
    color: function () {
      return pickColor();
    },

    backgroundColor: "transparent",

    // Less rotation = easier packing
    rotateRatio: 0.12,
    minRotation: -Math.PI / 14,
    maxRotation: Math.PI / 14,

    drawOutOfBound: false,
    shrinkToFit: true,
    ellipticity: 0.82
  });
}

document.addEventListener("DOMContentLoaded", function () {
  renderWordCloud();
});
