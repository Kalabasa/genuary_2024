/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

const charSize = 20;
let canvas;
let font;

const regions = [];

let grainBuffer;
let grainShader;

function preload() {
  font = loadFont("type.otf");
}

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "ASCII");
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
          * (1.0 - 0.18 * pow(cnoise(vTexCoord * 1.5 * 1080.0), 2.0)),
        1.0
      );
    }`
  );
}

function draw() {
  background("#fefce8");

  const totalRegions = Math.max(2, Math.min(9, Math.round(randomGaussian(4, 0.5))));
  const circlesWeight = random() * 3;
  const vstripesWeight = random() * 2;
  const hstripesWeight = random() * 3;
  const circles = Math.round(totalRegions * circlesWeight / (circlesWeight + vstripesWeight + hstripesWeight));
  const vstripes = Math.round(totalRegions * vstripesWeight / (circlesWeight + vstripesWeight + hstripesWeight));
  const hstripes = Math.round(totalRegions * hstripesWeight / (circlesWeight + vstripesWeight + hstripesWeight));

  for (let i = 0; i < circles; i++) {
    regions.push((x, y) => {
      const diameter = ((i + 1) / circles) * (width / (2 - circles * 0.3));
      return Math.hypot(x - width / 2, y - height / 2) * 2 < diameter;
    });
  }

  for (let i = 0; i < vstripes; i++) {
    regions.push((x, y) => {
      return x + (noise(y * 0.001, 13) - 0.5) * (width / 8) < ((i + 1) / (vstripes + 1)) * width;
    });
  }

  for (let i = 0; i < hstripes; i++) {
    regions.push((x, y) => {
      return y + (noise(x * 0.001, 13) - 0.5) * (height / 8) < ((i + 1) / (hstripes + 1)) * height;
    });
  }

  shuffle(regions);

  textFont(font);
  textSize(charSize);
  textAlign(CENTER, CENTER);
  noStroke();

  push();
  blendMode(MULTIPLY);
  const polarities = regions.length;
  for (let i = 0; i < polarities; i++) {
    const speed = Math.max(charSize * 0.25, randomGaussian(charSize * (0.2 + 0.4 * (1 - i / polarities)), charSize * 0.1));
    const turb = randomGaussian(charSize * 0.2, charSize * 0.1);

    const noiseSeed = random();
    const angle = random(2 * Math.PI);
    let vx = Math.abs(Math.sin(angle) * speed);
    let vy = Math.cos(angle) * speed;
    let sx = (speed * Math.max(2, randomGaussian(3, 0.5))) / Math.abs(Math.cos(angle));
    let sy = (speed * Math.max(2, randomGaussian(3, 0.5))) / Math.abs(Math.sin(angle));

    const rgb = random([[44, 44, 44], [160, 44, 44], [44, 44, 180]]);

    const checkRegion = (x, y) => {
      const polarity = regions.reduce((a, r) => (a + (r(x, y) ? 1 : 0)) % polarities, 0);
      return i === polarity || i - 1 === polarity;
    };

    let getChar;
    if (i === 0 || random() < 0.3) {
      const char = randomChar("#',.:;|/_-\\");
      const pair = random() < 0.5
        ? { "|": "-", "-": "|", "/": "\\", "\\": "/" }[char] ?? char
        : char;
      getChar = makeLooper(char + pair);
      vx *= 0.8;
      vy *= 0.8;
      sx *= 0.8;
      sy *= 0.8;
    } else if (random() < 0.6) {
      getChar = () => " ";
    } else if (random() < 0.2) {
      const char = randomChar("aAfHiIloOsxX");
      getChar = () => char;
    } else {
      const dramas = drama.split("\n").filter(l => l.length);
      const drama1 = random(dramas);
      getChar = makeLooper(drama1 + " ");
    }

    for (let x = 0; x < width; x += sx) {
      flow(x, vy > 0 ? 0 : height, vx, vy, turb, noiseSeed, rgb, checkRegion, getChar);
    }
    for (let y = sy; y < height - sy / 2; y += sy) {
      flow(vx > 0 ? 0 : width, y, vx, vy, turb, noiseSeed, rgb, checkRegion, getChar);
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

function flow(x, y, vx, vy, turb, noiseSeed, rgb, checkRegion, getChar) {
  let lastX = x;
  let lastY = y;
  while (x >= 0 && y >= 0 && x <= width && y <= height) {
    x += vx;
    y += vy;
    x += (noise(x * 0.003 / vx, y * 0.006 / vy, noiseSeed * 71) - 0.5) * turb;
    y += (noise(x * 0.003 / vx, y * 0.006 / vy, noiseSeed * 71 + 43) - 0.5) * turb;

    if (!checkRegion(x, y)) continue;

    // convert to continuous typing
    let tx = x;
    let ty = y;
    const hsize = charSize * 0.75;
    const letterSpacing = Math.abs(x - lastX) / hsize;
    if (Math.abs(y - lastY) < charSize * 0.8
      && Math.abs(1 - Math.log(letterSpacing / Math.round(letterSpacing))) < 0.2) {
      tx = lastX + Math.sign(x - lastX) * Math.round(letterSpacing) * hsize;
      ty = lastY;
    }

    if (tx > 40 && ty > 40 && tx < width - 40 && ty < height - 40) {
      const ox = randomGaussian(tx, 0.8);
      const oy = randomGaussian(ty, 1.2);
      const char = getChar();
      for (let i = 0; i < 3; i++) {
        fill(...rgb, randomGaussian(96, 16));
        text(char, randomGaussian(ox, 0.4), randomGaussian(oy, 0.4));
      }
    }

    lastX = tx;
    lastY = ty;
  }
}

function randomChar(set) {
  return random(set.split(""));
}

function makeLooper(text) {
  let i = Math.floor(random(text.length));
  return () => text[i++ % text.length];
}

const drama = `
i can see them but i cannot look but
i know what i sense is not what is true is not what i feel not what
strange sounds scary footsteps strange shapes scary figures
`;