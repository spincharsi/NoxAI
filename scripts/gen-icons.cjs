const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}

function makePNG(w, h, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    px.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const lerp = (a, b, t) => a + (b - a) * t;

function inRRect(x, y, rx, ry, rw, rh, r) {
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false;
  if (x >= rx + r || x <= rx + rw - r || y >= ry + r || y <= ry + rh - r) return true;
  let cx = x < rx + r ? rx + r : rx + rw - r;
  let cy = y < ry + r ? ry + r : ry + rh - r;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function render(size) {
  const SS = 4;
  const w = size * SS, h = size * SS;
  const buf = Buffer.alloc(w * h * 4);
  const bg = [0x18, 0x1b, 0x25];
  const pad = size * 0.24 * SS;
  const uw = w - 2 * pad, uh = h - 2 * pad;
  const lw = uw * 0.16, gap = uw * 0.14;
  const total = 3 * lw + 2 * gap;
  const sx = (w - total) / 2, cy = h / 2;
  const heights = [uh * 0.70, uh * 0.52, uh * 0.34];
  const rad = lw * 0.3;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = bg[0], g = bg[1], b = bg[2];
      for (let li = 0; li < 3; li++) {
        const lx = sx + li * (lw + gap);
        const lh = heights[li], ly = cy - lh / 2;
        if (inRRect(x, y, lx, ly, lw, lh, rad)) {
          if (li === 0) { r = 0xE2; g = 0xE8; b = 0xF0; }
          else if (li === 1) { r = 0x94; g = 0xA3; b = 0xB8; }
          else { r = 0x47; g = 0x55; b = 0x69; }
          break;
        }
      }
      buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rr = 0, gg = 0, bb = 0;
      for (let dy = 0; dy < SS; dy++)
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y*SS+dy)*w + (x*SS+dx)) * 4;
          rr += buf[i]; gg += buf[i+1]; bb += buf[i+2];
        }
      const c = SS * SS, o = (y * size + x) * 4;
      out[o] = Math.round(rr/c); out[o+1] = Math.round(gg/c); out[o+2] = Math.round(bb/c); out[o+3] = 255;
    }
  }
  return out;
}

const dir = path.join(process.argv[2] || '.', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const { name, size } of [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]) {
  fs.writeFileSync(path.join(dir, name), makePNG(size, size, render(size)));
  console.log('Generated ' + name);
}
