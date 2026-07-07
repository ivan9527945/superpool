// 產生 PWA / 分享縮圖(192 / 512 PNG),無外部依賴 — 手刻 PNG 編碼 + zlib。
// 設計:奶油底、居中珊瑚色放射星芒(對外偽裝成一般 AI 對話產品)。

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
  // 奶油底
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) set(x, y, 239, 235, 226);

  // 珊瑚色 12 道放射星芒(圓角):每道從中心往外描一串圓點
  const R = S * 0.34; // 外半徑
  const stamp = S * 0.042; // 筆刷半徑
  const disc = (cx, cy, rr) => {
    for (let dy = -rr; dy <= rr; dy++)
      for (let dx = -rr; dx <= rr; dx++)
        if (dx * dx + dy * dy <= rr * rr) set(cx + dx, cy + dy, 217, 119, 87);
  };
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const ex = Math.cos(a) * R;
    const ey = Math.sin(a) * R;
    const steps = Math.ceil(R);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      disc(Math.round(c + ex * t), Math.round(c + ey * t), Math.round(stamp));
    }
  }
  // 中心稍實
  disc(c, c, Math.round(S * 0.06));
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, png(size, draw));
  console.log(`public/icons/icon-${size}.png`);
}
