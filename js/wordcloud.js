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

// Backdoor option: try "hexagon", "circle", "square", "diamond", "triangle-forward", etc.
const WORDCLOUD_SHAPE = "hexagon";

// Slightly boost freq=2 words so they reliably appear.
const boostedWords = words.map(([word, freq]) => {
  if (freq === 2) return [word, 2.8];
  return [word, freq];
});

// Academic but richer palette: each entry has a light and dark version.
// Higher-frequency words use the darker tone.
const palettePairs = [
  ["#7DA7C0", "#3E6F8E"], // dusty blue
  ["#9A8BC2", "#6B5A99"], // muted violet
  ["#C090A8", "#8E5E77"], // mauve rose
  ["#C89A68", "#9A6F3E"], // warm amber
  ["#8DB08A", "#5F845C"], // moss green
  ["#76A7A8", "#467D80"], // teal
  ["#B39AAE", "#7D657F"], // soft plum
  ["#A4B69A", "#708563"], // sage
  ["#B7A27E", "#866F49"], // sand bronze
  ["#8DA0B8", "#5E7390"]  // gray-blue
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getOriginalFreq(word) {
  const entry = words.find(([w]) => w === word);
  return entry ? entry[1] : 1;
}

function pickColor(word) {
  const pair = palettePairs[hashCode(word) % palettePairs.length];
  const freq = getOriginalFreq(word);

  // Large words get the darker color; smaller words get the lighter one.
  if (freq >= 7) return pair[1];
  if (freq >= 4) return pair[1];
  return pair[0];
}

function renderWordCloud() {
  const canvas = document.getElementById("wordcloud");

  WordCloud(canvas, {
    list: boostedWords,
    shape: WORDCLOUD_SHAPE,

    // Smaller grid packs more words.
    gridSize: 5,

    // Stronger nonlinear contrast between frequencies.
    weightFactor: function (freq) {
      return 8 + 8 * Math.pow(freq, 1.5);
    },

    fontFamily: "Georgia, Garamond, 'Times New Roman', serif",

    color: function (word) {
      return pickColor(word);
    },

    backgroundColor: "transparent",

    // Mild rotation keeps readability while adding texture.
    rotateRatio: 0.14,
    minRotation: -Math.PI / 14,
    maxRotation: Math.PI / 14,

    drawOutOfBound: false,
    shrinkToFit: true,
    ellipticity: 0.9
  });
}

document.addEventListener("DOMContentLoaded", function () {
  renderWordCloud();
});
