const words = [
["quantum",16],
["lattice",11],
["spin liquid",10],
["spin",7],
["topological",7],
["entanglement",6],
["symmetry",5],
["pyrochlore",5],
["triangular",5],
["frustrated",4],
["twisted bilayer graphene",4],
["transition",4],
["magnetization",3],
["many-body",3],
["magic angle",3],
["thermal",3],
["gapped",3],
["realization",3],
["diamond",3],
["sachdev-ye-kitaev",3]
];

const palette = [
"#5b6c8f",
"#8b5e3c",
"#7b8f6a",
"#8c6f9c",
"#4f7c82"
];

WordCloud(document.getElementById('wordcloud'),{
  list: words,
  gridSize: 10,
  weightFactor: size => 8 + size * 3,
  fontFamily: "Georgia, serif",
  rotateRatio: 0.2,
  color: () => palette[Math.floor(Math.random()*palette.length)],
  backgroundColor: "transparent",
  shrinkToFit: true
});
