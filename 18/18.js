/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

let rows;

let canvas;

let grainBuffer;
let grainShader;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Bauhaus");
  noiseDetail(2, 1);

  rows = Math.max(4, Math.round(randomGaussian(4.5, 6)));

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
  background(255);

  const themeColor = chroma(random(0xffffff));
  const colorScheme = shuffle([
    chroma.blend(
      themeColor.luminance(randomGaussian(0.2, 0.05), "oklab").set("lch.c", randomGaussian(10, 7.5)),
      0x000022,
      "overlay",
    ),
    chroma.blend(
      themeColor.luminance(randomGaussian(0.4, 0.05), "oklab").set("lch.c", randomGaussian(30, 7.5)),
      0x0044cc,
      "overlay",
    ),
    themeColor.luminance(randomGaussian(0.5, 0.05), "oklab").set("lch.c", randomGaussian(95, 2.5)),
    chroma.blend(
      themeColor.luminance(randomGaussian(0.6, 0.05), "oklab").set("lch.c", randomGaussian(30, 7.5)),
      0xffcc44,
      "overlay",
    ),
  ])
    .map(color => {
      const lch =
        chroma.mix(
          color,
          themeColor.luminance(0.3, "oklab"),
          0.2,
          "oklab",
        ).oklch();
      return chroma.oklch(lch);
    });

  const pattern0 = createPattern();
  const pattern1 = createPattern(createPattern(pattern0));
  const pattern2 = createPattern(createPattern(createPattern(pattern0)));

  push();
  const tileSize = width / rows;
  for (let i = 0; i < rows; i++) {
    const cx = i * tileSize;
    for (let j = 0; j < rows; j++) {
      const cy = j * tileSize;

      const r = pattern1(i, j);
      const c = pattern2(i, j);

      push();
      translate(cx, cy);
      translate(tileSize / 2, tileSize / 2);
      rotate(r * Math.PI / 2);
      translate(-tileSize / 2, -tileSize / 2);
      noStroke();
      fill(colorScheme[c].rgb());
      arc(0, 0, tileSize * 2, tileSize * 2, 0, Math.PI / 2, PIE);
      pop();
    }
  }
  pop();

  grainBuffer.shader(grainShader);
  grainShader.setUniform("tex0", canvas);
  grainBuffer.rectMode(CENTER);
  grainBuffer.noStroke();
  grainBuffer.rect(0, 0, width, height);
  image(grainBuffer, 0, 0);

  noLoop();
}

function createPattern(basePattern) {
  if (basePattern) {
    const noiseSeed = random(0xff);
    const noiseMask = (i, j, newPattern) => {
      if (random() < 0.02) return Math.floor(random(4));
      if (noise(i * 1e-1, j * 1e-1, noiseSeed) < 0.5) {
        return newPattern();
      } else {
        return basePattern(i, j);
      }
    };

    const style = random(["offset", "new", "flip", "random"]);
    switch (style) {
      case "offset":
        let offsetX = 0;
        let offsetY = 0;
        while (offsetX === 0 && offsetY === 0) {
          offsetX = Math.round(randomGaussian(0, 1));
          offsetY = Math.round(randomGaussian(0, 1));
        }
        return (i, j) => noiseMask(i, j, () => basePattern(i + offsetX, j + offsetY));
      case "new":
        const newPattern = createPattern();
        return (i, j) => noiseMask(i, j, () => newPattern(i, j));
      case "flip":
        let steps = 0;
        while (steps === 0) {
          steps = Math.round(randomGaussian(0, 2));
        }
        return (i, j) => noiseMask(i, j, () => (basePattern(i, j) + steps + 400) % 4);
      case "random":
        return (i, j) => noiseMask(i, j, () => Math.floor(random(4)));
    }
  } else {
    const map = shuffle([0, 1, 2, 3]);
    let factorX = 0;
    let factorY = 0;
    while (Math.round(factorX) === 0 && Math.round(factorY) === 0) {
      factorX = (Math.floor(random(2)) * 2 - 1) * randomGaussian(1, 1);
      factorY = (Math.floor(random(2)) * 2 - 1) * randomGaussian(1, 1);
    }
    factorX = Math.round(factorX) * 0.8 + factorX * 0.2;
    factorY = Math.round(factorY) * 0.8 + factorY * 0.2;
    return (i, j) => map[(400 + Math.round(i * factorX) + Math.round(j * factorY)) % 4];
  }
}
