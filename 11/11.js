/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

let canvas;

let grainBuffer;
let grainShader;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Anni Albers");
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
  push();
  background(255);

  const strings = [];
  const stringCount = Math.max(2, Math.round(randomGaussian(3, 1)));

  for (let i = 0; i < stringCount; i++) {
    const x = -5;
    const y = randomGaussian(height / 2, height / 9);
    strings.push({
      seed: i,
      x,
      y,
      heading: Math.PI / 2,
      nextTarget: { x, y },
      color: chroma(random(0xffffff)).set("lch.l", 65).set("lch.c", randomGaussian(15, 2)),
      history: [],
    });
  }

  const lifetime = 800 + 1500 / stringCount;
  for (let t = 0; t < lifetime; t++) {
    for (let i = strings.length - 1; i >= 0; i--) {
      const string = strings[i];

      noStroke();
      if (string.history.length > 3) {
        const pastPoint = string.history.shift();
        fill(string.color.hex());
        circle(randomGaussian(pastPoint.x, 0.2), randomGaussian(pastPoint.y, 0.2), randomGaussian(10, 0.2));
      }
      fill(string.color.darken(2).hex());
      circle(randomGaussian(string.x, 0.2), randomGaussian(string.y, 0.2), randomGaussian(15, 0.2));

      // randomise heading
      string.heading += 0.4 * (noise(15 * t / lifetime, string.seed * 123) - 0.5);

      if (Math.hypot(string.nextTarget.x - string.x, string.nextTarget.y - string.y) < 30) {
        string.nextTarget.x = width * 0.2 + random(width * 0.6);
        string.nextTarget.y = height * 0.2 + random(height * 0.6);
      }
      const targetDx = string.nextTarget.x - string.x;
      const targetDy = string.nextTarget.y - string.y;

      const headingParam = 0.3 * (-0.5 + sigmoid(
        20 * (-1 + 4 * Math.abs(0.5 - t / lifetime))
      ));

      if (headingParam < 0) {
        const toEdge = Math.atan2(width * 1.5 - string.x, height / 2 - string.y);
        string.heading = aerp(string.heading, toEdge, -headingParam);
      } else {
        const toTarget = Math.atan2(targetDx, targetDy);
        string.heading = aerp(string.heading, toTarget, headingParam);
      }

      string.x += Math.sin(string.heading) * 4;
      string.y += Math.cos(string.heading) * 4;

      // repulsion. O(n^2) but I don't care
      for (const otherString of strings) {
        const dx = string.x - otherString.x;
        const dy = string.y - otherString.y;
        const d = Math.max(1e-6, Math.hypot(dx, dy) ** 2);
        const fx = 20 * dx / d;
        const fy = 20 * dy / d;
        string.x += fx;
        string.y += fy;
        otherString.x -= fx;
        otherString.y -= fy;
      }

      string.history.push({ x: string.x, y: string.y });

      if (string.x > width + 20) {
        strings.splice(i, 1);
      }
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