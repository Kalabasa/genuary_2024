/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />

let canvas;
let frameDuration;

const lastPoint = {
  x: null,
  y: null,
};

let baseSegments;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, "Screensaver", { video: false });
  noiseDetail(2, 1);

  background(0);

  baseSegments = [
    {
      angle: 0,
    },
    {
      angle: 0,
    }
  ];

  const frameRate = 60;
  frameDuration = 1000 / frameRate;
  setupFrameRate(frameRate);
}

function state(now) {
  const seg1SpeedNoise = smoothen(72
    * ((noise(now / 120e3, 21) - 0.5) * 2)
  );

  const seg2RadiusNoise = smoothen(4
    * ((noise(now / 90e3, 7) - 0.5) * 2)
  );

  const seg2SpeedNoise = smoothen(3
    * ((noise(now / 120e3, 3) - 0.5) * 2)
  );

  return {
    segments: [
      {
        radius: 180 + (noise(now / 36e3, 11) - 0.5) * 2 * 80,
        skew: noise(now / 36e3) * 0.3,
        skewAngle: now / 18e3 + noise(now / 18e3, 39) * 2 * Math.PI,
        speed: seg1SpeedNoise * (0.01 + noise(now / 36e3, 71) * 0.02),
      },
      {
        radius: seg2RadiusNoise * 220,
        skew: 0,
        skewAngle: 0,
        speed: seg2SpeedNoise * noise(now / 24e3, 91) * 0.3,
      }
    ],
    color: [
      Math.min(255, Math.max(0, Math.round(192 + Math.sin(now / 15245) * 64))),
      Math.min(255, Math.max(0, Math.round(192 + Math.sin(now / 22124) * 64))),
      Math.min(255, Math.max(0, Math.round(192 + Math.sin(now / 13321) * 64))),
    ],
  }
}

function draw() {
  const now = Date.now();
  const stateNow = state(now);

  noStroke();

  if (frameCount % 3 === 0) {
    blendMode(ADD);
    fill(2);
    rect(0, 0, width, height);
    blendMode(MULTIPLY);
    fill(252);
    rect(0, 0, width, height);
    blendMode(BURN);
    fill(252);
    rect(0, 0, width, height);
  }

  translate(width / 2, height / 2);

  blendMode(LIGHTEST);
  noFill();
  let x = 0;
  let y = 0;
  let cumulativeSpeed = 0;
  for (let i = 0; i < baseSegments.length; i++) {
    const { radius, skew, skewAngle, speed } = stateNow.segments[i];

    const baseSegment = baseSegments[i];
    baseSegment.angle += speed + cumulativeSpeed;
    cumulativeSpeed += speed;

    const { angle } = baseSegment;
    const skewedRadius = radius * radius * (1 - skew) / Math.sqrt((radius * Math.sin(angle + skewAngle)) ** 2 + (radius * (1 - skew) * Math.cos(angle + skewAngle)) ** 2);
    x += Math.sin(angle) * skewedRadius;
    y += Math.cos(angle) * skewedRadius;
  }
  if (lastPoint.x !== null && lastPoint.y !== null) {
    strokeWeight(64);

    const chrome = chroma(...stateNow.color)
      .set("lch.l", 100 - Math.max(0, 100 * 80 / (80 + frameCount)))
      .set("lch.c", 45);

    stroke(...chrome.rgb());
    line(lastPoint.x, lastPoint.y, x, y);

    const hueRotate = Math.round(noise(now / 60e3, 2) ** 2 * 360 * 10) / 10;
    stroke(...chrome.set("lch.h", "+" + hueRotate).rgb());
    line(-lastPoint.x, -lastPoint.y, -x, -y);
  }
  lastPoint.x = x;
  lastPoint.y = y;
}

function smoothen(x) {
  return (1 / (1 + Math.E ** -x)) * 2 - 1;
}