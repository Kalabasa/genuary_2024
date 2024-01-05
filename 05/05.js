/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const padding = 50;
const gridWidth = 20;
const gridHeight = 10;
let cellWidth;
let cellHeight;

let palette;

let grainBuffer;
let grainShader;

let canvas;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080, WEBGL);
  commonSetup(canvas, "jitter");

  cellWidth = (width - padding * 2) / gridWidth;
  cellHeight = (height - padding * 2) / gridHeight;

  const baseColor = chroma(random(0xffffff)).set("lch.l", 40).set("lch.c", 15);
  palette = chroma.scale([baseColor, baseColor.set("lch.h", "+120")]).mode("lch").classes(3).gamma(1.5).colors(6);

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
          * (1.0 - 0.14 * pow(cnoise(vTexCoord * 1.5 * 1080.0), 2.0)),
        1.0
      );
    }`
  );
}

function draw() {
  translate(-width / 2, -height / 2);
  background(255);

  noFill();
  stroke(0);
  let step = 0;
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const randoms = Array.from({ length: 44 + 24 }, (_, i) => {
        noiseDetail(2, .5);
        const noiseVal = noise(step ** 1.8 * .006, 1, i * 121) / (.5 + .25);
        return noiseVal;
      });
      drawCell(padding + x * cellWidth, padding + y * cellHeight, cellWidth, cellHeight, randoms);
      step++;
    }
  }

  grainBuffer.shader(grainShader);
  grainShader.setUniform("tex0", canvas);
  grainBuffer.rectMode(CENTER);
  grainBuffer.noStroke();
  grainBuffer.rect(0, 0, width, height);
  image(grainBuffer, 0, 0);

  noLoop();
}

function drawCell(x, y, w, h, randoms) {
  function birand() {
    return randoms.pop() * 2 - 1;
  }

  brush.set("marker2", chroma(palette[0]).darken(2.5).desaturate(0.95).hex(), 1);

  const windowFactor = lerp(0, .6, y / height);
  brush.fill(random(palette), (y / height) ** 2 * 400);
  brush.bleed(0.02);
  brush.fillTexture(.1, .01);
  brush.noStroke();
  brush.beginShape();
  const windowTopLeft = [x + w * windowFactor * randoms.pop(), y + h * windowFactor * randoms.pop()];
  const windowTopRight = [x + w - w * windowFactor * randoms.pop(), y + h * windowFactor * randoms.pop()];
  const windowBottomLeft = [x + w * windowFactor * randoms.pop(), y + h - h * windowFactor * randoms.pop()];
  const windowBottomRight = [x + w - w * windowFactor * randoms.pop(), y + h - h * windowFactor * randoms.pop()];
  brush.polygon([
    [x, y],
    windowTopLeft,
    windowTopRight,
    [x + w, y]
  ]);
  brush.polygon([
    [x + w, y],
    windowTopRight,
    windowBottomRight,
    [x + w, y + h],
  ]);
  brush.polygon([
    [x + w, y + h],
    windowBottomRight,
    windowBottomLeft,
    [x, y + h],
  ]);
  brush.polygon([
    [x, y + h],
    windowBottomLeft,
    windowTopLeft,
    [x, y],
  ]);

  const boxFactor = lerp(0, .2, y / height);
  const boxTopLeft = [x + w * boxFactor * birand(), y + w * boxFactor * birand()];
  const boxTopRight = [x + w - w * boxFactor * birand(), y + w * boxFactor * birand()];
  const boxBottomLeft = [x + w * boxFactor * birand(), y + h - w * boxFactor * birand()];
  const boxBottomRight = [x + w - w * boxFactor * birand(), y + h - w * boxFactor * birand()];
  brush.noFill();
  brush.strokeWeight(w * .002);
  brush.line(...boxTopLeft, ...boxTopRight);
  brush.line(...boxTopLeft, ...boxBottomLeft);
  brush.line(...boxBottomLeft, ...boxBottomRight);
  brush.line(...boxTopRight, ...boxBottomRight);

  const chaosFactor = lerp(0, 0.7, (y / height) ** 3);

  const armSourceX = lerp(x, x + w, .5 + .3 * birand());
  const armSourceY = lerp(y, y + h, .4 + .3 * birand());
  for (let i = 0; i < 2; i++) {
    tentacle(
      w * .009,
      armSourceX + w * .4 * birand() + (chaosFactor * w * birand()),
      armSourceY + h * .2 * birand() + (chaosFactor * w * birand()),
      lerp(x, x + w, .5 + .6 * birand()) + (chaosFactor * w * birand()),
      lerp(y, y + h, .4 + .4 * birand()) + (chaosFactor * w * birand()),
      lerp(x, x + w, .5 + .6 * birand()) + (chaosFactor * w * birand()),
      lerp(y, y + h, .3 + .4 * birand()) + (chaosFactor * w * birand()),
    );
  }

  const legSourceX = lerp(x, x + w, .5 + .3 * birand());
  const legSourceY = lerp(y, y + h, .4 + .1 * birand());
  for (let i = 0; i < 2; i++) {
    tentacle(
      w * .012,
      legSourceX + w * .2 * birand() + (chaosFactor * w * birand()),
      legSourceY + h * .1 * birand() + (chaosFactor * w * birand()),
      lerp(x, x + w, .5 + 1. * birand()) + (chaosFactor * w * birand()),
      lerp(y, y + h, .5 + .3 * birand()) + (chaosFactor * w * birand()),
      lerp(x, x + w, .5 + .6 * birand()) + (chaosFactor * w * birand()),
      lerp(y, y + h, .9 + .1 * birand()) + (chaosFactor * w * birand()),
    );
  }
}

function tentacle(weight, x0, y0, cx, cy, x1, y1) {
  const distance = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const steps = distance * .8;
  for (let i = 0; i < steps; i++) {
    const ti = i / steps;
    const tn = (i + 1) / steps;
    const xi = quadberp(x0, cx, x1, ti);
    const yi = quadberp(y0, cy, y1, ti);
    const xn = quadberp(x0, cx, x1, tn);
    const yn = quadberp(y0, cy, y1, tn);
    brush.strokeWeight(lerp(weight * .4, weight, 0.8 * (1 - ti) + 0.2 * Math.sqrt(2 * (.5 - Math.abs(ti - .5)))));
    brush.line(xi, yi, xn, yn);
  }
}

function quadberp(a, c, b, t) {
  const c1 = lerp(a, c, t);
  const c2 = lerp(c, b, t);
  return lerp(c1, c2, t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
