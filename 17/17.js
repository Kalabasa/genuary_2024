/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const bigSideLength = 100;
const diagonalLength = bigSideLength * 4 / 3 * Math.cos(Math.PI / 6);

const tileOrigin = [
  0,
  0,
];
const tileRightVertex = [
  bigSideLength * Math.sin(Math.PI / 3),
  bigSideLength * Math.cos(Math.PI / 3),
];
const tileLeftVertex = [
  0,
  bigSideLength,
];
const tileRearVertex = [
  diagonalLength * Math.sin(Math.PI / 6),
  diagonalLength * Math.cos(Math.PI / 6),
];

let leftShapeParam;
let rightShapeParam;
let outerWingShapeParam;
let innerWingShapeParam;

let strokeColor;
let strokeSize;

let canvas;

let grainBuffer;
let grainShader;

let buffer;
let mask;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Arabesque");
  noiseDetail(2, 1);

  buffer = createGraphics(width, height);
  mask = createGraphics(width, height);

  leftShapeParam = Math.max(0, Math.min(1, randomGaussian(0.5, 0.25)));
  rightShapeParam = Math.max(0, Math.min(1, randomGaussian(0.5, 0.25)));
  outerWingShapeParam = Math.max(0, Math.min(1, randomGaussian(0.5, 0.25)));
  innerWingShapeParam = Math.max(0, Math.min(1, randomGaussian(0.5, 0.25)));

  // repulsion
  const delta = outerWingShapeParam - (leftShapeParam + rightShapeParam) / 2;
  outerWingShapeParam = Math.max(0, Math.min(1,
    outerWingShapeParam + (sigmoid(Math.sign(delta) * 0.02 / delta ** 2) - 0.5) * 0.3));

  // https://github.com/ashima/webgl-noise/blob/master/src/classicnoise2D.glsl
  grainBuffer = createGraphics(width, height, WEBGL);
  grainShader = grainBuffer.createFilterShader(`
    precision highp float;
    varying vec2 vTexCoord;
    uniform sampler2D tex0;
    uniform vec2 texelSize;
    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }
    vec4 permute(vec4 x) {
      return mod289(((x*34.0)+10.0)*x);
    }
    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }
    vec2 fade(vec2 t) {
      return t*t*t*(t*(t*6.0-15.0)+10.0);
    }
    float cnoise(vec2 P) {
      vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
      vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
      Pi = mod289(Pi); // To avoid truncation effects in permutation
      vec4 ix = Pi.xzxz;
      vec4 iy = Pi.yyww;
      vec4 fx = Pf.xzxz;
      vec4 fy = Pf.yyww;
      vec4 i = permute(permute(ix) + iy);
      vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
      vec4 gy = abs(gx) - 0.5 ;
      vec4 tx = floor(gx + 0.5);
      gx = gx - tx;
      vec2 g00 = vec2(gx.x,gy.x);
      vec2 g10 = vec2(gx.y,gy.y);
      vec2 g01 = vec2(gx.z,gy.z);
      vec2 g11 = vec2(gx.w,gy.w);
      vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
      g00 *= norm.x;
      g01 *= norm.y;
      g10 *= norm.z;
      g11 *= norm.w;
      float n00 = dot(g00, vec2(fx.x, fy.x));
      float n10 = dot(g10, vec2(fx.y, fy.y));
      float n01 = dot(g01, vec2(fx.z, fy.z));
      float n11 = dot(g11, vec2(fx.w, fy.w));
      vec2 fade_xy = fade(Pf.xy);
      vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
      float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
      return 2.3 * n_xy;
    }
    void main() {
      gl_FragColor = vec4(
        texture2D(tex0, vTexCoord).rgb
          * (1.0 - 0.44 * pow(cnoise(vTexCoord * 1.5 * 1080.0), 2.0)),
        1.0
      );
    }`
  );
}

function draw() {
  background(255);

  const thickness = randomGaussian(19, 3);
  const gap = randomGaussian(thickness / 2, thickness / 8);

  strokeColor = 0;
  strokeSize = gap + thickness;
  drawAll();
  if (gap > 0) {
    strokeColor = 255;
    strokeSize = gap;
    drawAll();
  }
  filter(DILATE);

  push();
  const baseColor = chroma.blend(
    chroma(random(0xffffff)),
    "#ff8844",
    "burn"
  ).set("lch.l", 80)
    .set("lch.c", 20);
  blendMode(LIGHTEST);
  background(...baseColor.darken(2.6).rgb());
  blendMode(DARKEST);
  background(...baseColor.rgb());
  pop();

  push();
  buffer.push();
  buffer.clear();
  buffer.image(canvas, 0, height * 0.0006);
  buffer.filter(BLUR, 1);
  buffer.pop();
  blendMode(LIGHTEST);
  tint(255, 240);
  image(buffer, 0, 0);

  buffer.push();
  buffer.clear();
  buffer.image(canvas, -width * 0.01, -height * 0.005, width * 1.02, height * 1.02);
  buffer.filter(BLUR, 6);
  buffer.pop();
  blendMode(DARKEST);
  tint(255, 112);
  image(buffer, 0, 0);

  buffer.push();
  buffer.clear();
  buffer.image(canvas, 0, 0);
  buffer.filter(BLUR, 2);
  buffer.pop();
  blendMode(DARKEST);
  tint(255, 64);
  image(buffer, 0, 0);
  pop();

  grainBuffer.shader(grainShader);
  grainShader.setUniform("tex0", canvas);
  grainBuffer.rectMode(CENTER);
  grainBuffer.noStroke();
  grainBuffer.rect(0, 0, width, height);
  image(grainBuffer, 0, 0);

  noLoop();
}

function drawAll() {
  push();
  const groupStepX = Math.sin(Math.PI / 3) * bigSideLength * 2;
  const groupStepY = Math.cos(Math.PI / 3) * bigSideLength * 2;
  const cols = Math.ceil(width / groupStepX);
  const rows = Math.ceil(height / groupStepY);
  const offsetX = (width - cols * groupStepX) / 2;
  const offsetY = (height - rows * groupStepY) / 2;
  for (let i = 0; i < cols; i++) {
    const groupX = offsetX + i * groupStepX;
    for (let j = -1; j < rows; j++) {
      const groupY = offsetY + (i % 2 + j * 2) * groupStepY;
      drawTile(groupX, groupY);
      drawTile(groupX + groupStepX, groupY + groupStepY, Math.PI / 3);
      drawTile(groupX + groupStepX, groupY + groupStepY, Math.PI * 2 / 3);
      drawTile(groupX, groupY + groupStepY * 2, Math.PI * 4 / 3);
      drawTile(groupX, groupY + groupStepY * 2, Math.PI * 5 / 3);
      drawTile(groupX + groupStepX, groupY + groupStepY * 3, Math.PI);
    }
  }
  pop();
}

function drawTile(tipX, tipY, rotation) {
  buffer.clear();
  buffer.push();
  buffer.translate(tipX, tipY);
  buffer.rotate(rotation);

  buffer.noFill();
  buffer.stroke(strokeColor);
  buffer.strokeJoin(MITER);
  buffer.strokeWeight(strokeSize);

  buffer.strokeCap(PROJECT);
  const leftShapeLine = [
    ...lerpPoint(tileOrigin, tileLeftVertex, leftShapeParam),
    ...lerpPoint(tileRightVertex, tileRearVertex, rightShapeParam),
  ];
  const rightShapeLine = [
    ...lerpPoint(tileOrigin, tileRightVertex, leftShapeParam),
    ...lerpPoint(tileLeftVertex, tileRearVertex, rightShapeParam),
  ];
  buffer.line(...leftShapeLine);
  buffer.line(...rightShapeLine);

  // choose shorter of two wing types
  const adjacentWingTypeLength = distance(
    ...lerpPoint(tileOrigin, tileLeftVertex, outerWingShapeParam),
    ...lerpPoint(
      leftShapeLine.slice(0, 2),
      leftShapeLine.slice(2, 4),
      innerWingShapeParam,
    ),
  );
  const oppositeWingTypeLength = distance(
    ...lerpPoint(tileOrigin, tileLeftVertex, outerWingShapeParam),
    ...lerpPoint(
      rightShapeLine.slice(0, 2),
      rightShapeLine.slice(2, 4),
      innerWingShapeParam,
    ),
  );
  const useOpposite = oppositeWingTypeLength < adjacentWingTypeLength;
  const leftInnerWingShapeLine = useOpposite ? rightShapeLine : leftShapeLine;
  const rightInnerWingShapeLine = useOpposite ? leftShapeLine : rightShapeLine;
  buffer.strokeCap(ROUND);
  buffer.line(
    ...lerpPoint(tileOrigin, tileLeftVertex, outerWingShapeParam),
    ...lerpPoint(
      leftInnerWingShapeLine.slice(0, 2),
      leftInnerWingShapeLine.slice(2, 4),
      innerWingShapeParam,
    ),
  );
  buffer.line(
    ...lerpPoint(tileOrigin, tileRightVertex, outerWingShapeParam),
    ...lerpPoint(
      rightInnerWingShapeLine.slice(0, 2),
      rightInnerWingShapeLine.slice(2, 4),
      innerWingShapeParam,
    ),
  );

  buffer.pop();

  mask.push();
  mask.translate(tipX, tipY);
  mask.rotate(rotation);
  mask.clear();
  mask.noStroke();
  mask.fill(0);
  mask.beginShape();
  tileVertices(mask);
  mask.endShape(CLOSE);
  const masked = buffer.get();
  masked.mask(mask);
  mask.pop();

  image(masked, 0, 0);
}

function tileVertices(target) {
  target.vertex(...tileOrigin);
  target.vertex(...tileRightVertex);
  target.vertex(...tileRearVertex);
  target.vertex(...tileLeftVertex);
}

function distance(a, b, x, y) {
  return Math.hypot(a - x, b - y);
}

function lerpPoint(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
  ];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sigmoid(x) {
  return 1 / (1 + Math.E ** -x);
}