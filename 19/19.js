document.title = 'Flocking';
document.body.style.display = 'flex';
document.body.style.justifyContent = 'center';
document.body.style.alignItems = 'center';
document.body.style.width = '100vw';
document.body.style.height = '100vh';
document.body.style.background = 'black';

const div = document.createElement('div');

div.style.overflow = 'hidden';
div.style.width = '1080px';
div.style.height = '1080px';
// div.style.borderRadius = '50%';

document.body.appendChild(div);

const canvas = document.createElement('canvas');

canvas.width = 60;
canvas.height = 60;
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.margin = '-0%';
canvas.style.imageRendering = 'pixelated';
// canvas.style.filter = `blur(18px)`;

div.appendChild(canvas);

const context = canvas.getContext('2d');

let data = new Uint32Array(canvas.width * canvas.height);

for (let y = 0; y < canvas.height; y++) {
  for (let x = 0; x < canvas.width; x++) {
    data[y * canvas.width + x] = rgb(
      0x0 + Math.floor(Math.random() * 2),
      0x88 + Math.floor(Math.random() * 2),
      0xCC + Math.floor(Math.random() * 2),
    );
  }
}

let buffer = new Uint32Array(data);
const dir = new Array(data.length).fill([
  Math.random(),
  Math.random(),
  Math.random(),
]);
const accel = [...dir];

const captor = new CCapture({ format: "webm", framerate: 60 });
let videoFrameLimit = 600;
let framesCaptured = 0;

const params = new URLSearchParams(window.location.search);
const videoParam = params.get("v");
const videoParamInt = parseInt(videoParam);
if (!isNaN(videoParamInt)) {
  videoFrameLimit = videoParamInt;
  console.log("Frame limit: " + videoFrameLimit);
}

if (videoParam != undefined) {
  captor.start();
}

function draw() {
  let i = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      context.fillStyle = '#' + data[i].toString(16).padStart(6, '0');
      context.fillRect(x, y, 1, 1);
      i++;
    }
  }
}

function step() {
  let i = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const topIndex = index(x, (y + canvas.height - 1) % canvas.height);
      const bottomIndex = index(x, (y + 1) % canvas.height);
      const leftIndex = index((x + canvas.width - 1) % canvas.width, y);
      const rightIndex = index((x + 1) % canvas.width, y);

      const top = splitRGB(data[topIndex]);
      const bottom = splitRGB(data[bottomIndex]);
      const left = splitRGB(data[leftIndex]);
      const right = splitRGB(data[rightIndex]);

      const topDir = dir[topIndex];
      const bottomDir = dir[bottomIndex];
      const leftDir = dir[leftIndex];
      const rightDir = dir[rightIndex];

      const current = splitRGB(data[i]);

      const cohesionVector = normalize(
        current.map((n, c) => (
          (top[c] + bottom[c] + left[c] + right[c]) / 4 - n
        ))
      );

      const separationVector = normalize(
        [top, bottom, left, right].reduce(
          (acc, neighbor) => {
            const d = delta(current, neighbor);
            const sl = squaredLength(d);
            return sl === 0 ? acc : add(acc, d.map(n => 255 * n / sl / sl));
          },
          [0, 0, 0]
        )
      );

      const alignmentVector = normalize(
        [topDir, bottomDir, leftDir, rightDir].reduce(
          (acc, neighborDir) => {
            const d = delta(neighborDir, dir[i]);
            const sl = squaredLength(d);
            return sl === 0 ? acc : add(acc, d.map(n => 255 * n / sl / sl));
          },
          [0, 0, 0]
        )
      );

      const cohesionFactor = 1.65; timeSine(0.2, 7000, 1.45, 1.85);
      const separationFactor = 1.4; timeSine(0.2, 11000, 1.2, 1.5);
      const alignmentFactor = 9; timeSine(0.5, 13000, 0, 12);

      accel[i] = dir[i].map((n, c) => (
        cohesionVector[c] * cohesionFactor
        + separationVector[c] * separationFactor
        + alignmentVector[c] * alignmentFactor
      ));

      i++;
    }
  }

  i = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      // accelerate & friction
      dir[i] = add(dir[i], accel[i]).map(n => n * 0.96);

      buffer[i] = rgb(
        ...splitRGB(data[i]).map((n, c) => {
          const s = dir[i][c];
          return Math.max(0, Math.min(255, n + Math.sign(s) * Math.ceil(Math.abs(s))));
        })
      );

      i++;
    }
  }

  [data, buffer] = [buffer, data];
}

function timeSine(phase, period, min, max) {
  return min + (max - min) * (Math.sin(2 * Math.PI * (phase + Date.now() / period)) + 1) / 2;
}

function squaredLength(vec) {
  return vec[0] ** 2 + vec[1] ** 2 + vec[2] ** 2;
}

function length(vec) {
  return Math.sqrt(squaredLength(vec));
}

function squaredDistance(vecA, vecB) {
  return squaredLength(delta(vecA, vecB));
}

function add(vecA, vecB) {
  return vecA.map((n, i) => n + vecB[i]);
}

function delta(vecA, vecB) {
  return vecA.map((n, i) => n - vecB[i]);
}

function normalize(vec) {
  const len = length(vec);
  if (len == 0) {
    return vec;
  } else {
    return vec.map(n => n / len);
  }
}

function index(x, y) {
  return y * canvas.width + x;
}

function splitRGB(n) {
  return [
    n >> 16,
    (n >> 8) & 0xff,
    n & 0xff,
  ]
}

function rgb(r, g, b) {
  return (r << 16) | (g << 8) | b;
}

function loop() {
  step();
  draw();

  let willLoop = true;

  if (videoParam != undefined) {
    captor.capture(canvas);
    framesCaptured++;
    console.log(`${framesCaptured}/${videoFrameLimit}`);
    if (framesCaptured > videoFrameLimit) {
      willLoop = false;
      captor.stop();
      captor.save((blob) => {
        const a = document.createElement("a");
        document.body.appendChild(a);
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = document.title + ".webm";
        a.click();
        window.URL.revokeObjectURL(url);
        setTimeout(() => a.remove());
      });
    }
  }

  if (willLoop) {
    requestAnimationFrame(loop);
  }
}

loop();
