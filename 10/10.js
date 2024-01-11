/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const radius = 1080 / 6;
const sqrt3 = Math.sqrt(3);

let canvas;

let grainBuffer;
let grainShader;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Hex");
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
          * (1.0 - 0.33 * pow(cnoise(vTexCoord * 1.5 * 1080.0), 2.0)),
        1.0
      );
    }`
  );
}

function draw() {
  const palette = chroma
    .scale([
      chroma(random(0xffffff)).set("lch.l", 75).set("lch.c", 10),
      chroma(random(0xffffff)).set("lch.l", 75).set("lch.c", 10),
    ])
    .padding(0.6)
    .colors(2);

  push();
  background(255);
  const spacingX = radius * sqrt3 / 4;
  for (let i = 0; i < 180; i++) {
    let x = random(width);
    let y = random(height);

    x = Math.round(x / spacingX) * spacingX;
    y = (Math.round(y / (radius * 1.5)) + ((Math.round(x / spacingX) % 2) * 0.5)) * (radius * 1.5);

    blendMode(random([MULTIPLY, SOFT_LIGHT, SOFT_LIGHT]));
    fill(random(palette));
    noStroke();
    drawHex(x, y, radius);
  }
  for (let i = 0; i < 10; i++) {
    let x = random(width);
    let y = random(height);

    x = Math.round(x / spacingX) * spacingX;
    y = (Math.round(y / (radius * 1.5)) + ((Math.round(x / spacingX) % 2) * 0.5)) * (radius * 1.5);

    y += Math.round(randomGaussian(0, radius / 4) / (radius * 0.75)) * (radius * 0.75);

    blendMode(random([DIFFERENCE, SOFT_LIGHT, SOFT_LIGHT, OVERLAY]));
    fill(chroma(random(palette)).set("lch.l", "100").set("lch.h", "-60").hex());
    noStroke();
    drawHex(x, y, radius);
  }
  blendMode(DARKEST);
  background(chroma(random(palette)).set("lch.l", 95).hex());
  pop();

  grainBuffer.shader(grainShader);
  grainShader.setUniform("tex0", canvas);
  grainBuffer.rectMode(CENTER);
  grainBuffer.noStroke();
  grainBuffer.rect(0, 0, width, height);
  image(grainBuffer, 0, 0);

  blendMode(LIGHTEST);
  background(chroma(random(palette)).set("lch.l", 40).alpha(0.8).hex());

  noLoop();
}

function drawHex(x, y, r) {
  const r2 = r / 2;
  const width2 = r2 * sqrt3;
  const center = Math.floor(x);
  const left = Math.floor(x - width2);
  const right = Math.floor(x + width2);
  const shoulder = Math.floor(y - r2);
  const knee = Math.floor(y + r2);

  beginShape();
  vertex(center, Math.floor(y - r));
  vertex(right, shoulder);
  vertex(right, knee);
  vertex(center, Math.floor(y + r));
  vertex(left, knee);
  vertex(left, shoulder);
  endShape();
}