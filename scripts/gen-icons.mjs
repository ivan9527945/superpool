// 產生 PWA 圖示(192 / 512 PNG),無外部依賴 — 手刻 PNG 編碼 + zlib。
// 設計:池核暗青底、居中泳池、三道漣漪、一道門縫。

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

function png(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    // alpha over
    const na = a / 255;
    px[i] = Math.round(px[i] * (1 - na) + r * na);
    px[i + 1] = Math.round(px[i + 1] * (1 - na) + g * na);
    px[i + 2] = Math.round(px[i + 2] * (1 - na) + b * na);
    px[i + 3] = 255;
  };
  draw(set, size);

  // 每列前綴 filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function draw(set, S) {
  const c = S / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // 徑向漸層底(池核暗青)
      const d = Math.hypot(x - c, y - c) / (S * 0.72);
      const t = Math.min(1, d);
      set(x, y, Math.round(16 + t * -6), Math.round(41 - t * 14), Math.round(42 - t * 12));
    }
  }
  // 居中泳池(圓角矩形)
  const pw = S * 0.5;
  const px0 = c - pw / 2;
  const py0 = c - pw / 2;
  const rad = S * 0.06;
  const inRound = (x, y) => {
    const ix = Math.max(px0 + rad, Math.min(px0 + pw - rad, x));
    const iy = Math.max(py0 + rad, Math.min(py0 + pw - rad, y));
    return Math.hypot(x - ix, y - iy) <= rad;
  };
  for (let y = py0; y < py0 + pw; y++) {
    for (let x = px0; x < px0 + pw; x++) {
      if (inRound(x, y)) set(x, y, 40, 118, 108, 235);
    }
  }
  // 三道漣漪
  for (let r = 0; r < 3; r++) {
    const yy = py0 + pw * (0.3 + r * 0.2);
    const thick = S * 0.012;
    for (let x = px0 + pw * 0.12; x < px0 + pw * 0.88; x++) {
      const wob = Math.sin((x - px0) * 0.08 + r * 1.3) * (S * 0.02);
      const y = yy + wob;
      for (let th = -thick; th <= thick; th++) {
        const a = 235 * (1 - Math.abs(th) / (thick + 0.5));
        set(x, Math.round(y + th), 205, 246, 230, a);
      }
    }
  }
  // 門縫:泳池下緣一道亮線
  const dy = py0 + pw - S * 0.022;
  for (let x = c - pw * 0.15; x < c + pw * 0.15; x++)
    for (let th = 0; th < Math.max(2, S * 0.008); th++)
      set(x, dy + th, 150, 250, 224, 240);
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, png(size, draw));
  console.log(`public/icons/icon-${size}.png`);
}
