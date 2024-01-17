/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

let canvas;

let grainBuffer;
let grainShader;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "10000");
  noiseDetail(2, 1);

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
          * (1.0 - 0.22 * pow(cnoise(vTexCoord * 1.5 * 1080.0), 2.0)),
        1.0
      );
    }`
  );
}

function draw() {
  const padding = 50;
  const cols = 50;
  const rows = 100;
  const spacing = (width - padding * 2) / rows;

  const baseColor =
    chroma.blend(
      chroma(random(0xffffff)),
      "cccccc",
      "overlay"
    ).set("lch.l", 60)
      .set("lch.c", 20);
  const secondColor = baseColor.set("lch.h", "+120");

  const baseRotation = random(2 * Math.PI);
  const secondRotation = randomGaussian(baseRotation + Math.PI / 2, Math.PI * 0.2);

  push();
  background(255);
  blendMode(MULTIPLY);

  push();
  translate(randomGaussian(width / 2, width / 32), randomGaussian(height / 2, height / 32));
  rotate(baseRotation);
  translate(-spacing * cols / 2, -spacing * rows / 2);
  noStroke();
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      fill(...baseColor.rgb(), randomGaussian(240, 16));
      circle(
        randomGaussian(i * spacing, 0.3),
        randomGaussian(j * spacing, 0.3),
        7
      );
    }
  }
  pop();
  push();
  translate(randomGaussian(width / 2, width / 32), randomGaussian(height / 2, height / 32));
  rotate(secondRotation);
  translate(-spacing * cols / 2, -spacing * rows / 2);
  noStroke();
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      fill(...secondColor.rgb(), randomGaussian(240, 16));
      circle(
        randomGaussian(i * spacing, 0.3),
        randomGaussian(j * spacing, 0.3),
        7
      );
    }
  }
  pop();
  pop();

  grainBuffer.shader(grainShader);
  grainShader.setUniform("tex0", canvas);
  grainBuffer.rectMode(CENTER);
  grainBuffer.noStroke();
  grainBuffer.rect(0, 0, width, height);
  image(grainBuffer, 0, 0);

  noLoop();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const turn = 2 * Math.PI;

function aerp(a, b, t) {
  return a + angleDelta(a, b) * t;
}

function angleDelta(a, b) {
  const d = (b - a) % turn;
  return (2 * d) % turn - d;
}

function sigmoid(x) {
  return 1 / (1 + Math.E ** -x);
}