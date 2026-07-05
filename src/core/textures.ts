// 程序化材質庫:馬賽克磚(細/中)、粉刷牆、水下焦散。
// 全部 canvas 生成、模組級快取;各表面 clone 後設自己的 repeat。

import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}

function finish(key: string, c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/** 細馬賽克磚:8×8 小磚、灰縫、往青綠的微色差 — poolrooms 的皮膚 */
export function makeMosaicTexture(): THREE.Texture {
  const hit = cache.get('mosaic');
  if (hit) return hit;
  const [c, g] = makeCanvas(512);
  g.fillStyle = '#b7c9c3'; // 灰縫
  g.fillRect(0, 0, 512, 512);
  const n = 8;
  const s = 512 / n;
  let k = 7;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      k = (k * 31 + 17) % 97;
      const v = 233 + (k % 5) * 4;
      const teal = (k % 7) - 2;
      g.fillStyle = `rgb(${v - Math.max(0, teal * 3)},${v + 2},${v + Math.max(0, teal * 2)})`;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      // 每片磚極淡的內緣陰影,增加立體感
      g.fillStyle = 'rgba(90,110,105,0.10)';
      g.fillRect(i * s + 2, j * s + s - 6, s - 4, 4);
      g.fillRect(i * s + s - 6, j * s + 2, 4, s - 4);
    }
  }
  return finish('mosaic', c);
}

/** 中尺寸磁磚:4×4,用於地板 */
export function makeTileTexture(): THREE.Texture {
  const hit = cache.get('tile');
  if (hit) return hit;
  const [c, g] = makeCanvas(512);
  g.fillStyle = '#aebfb9';
  g.fillRect(0, 0, 512, 512);
  const n = 4;
  const s = 512 / n;
  let k = 3;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      k = (k * 29 + 11) % 89;
      const v = 226 + (k % 4) * 5;
      g.fillStyle = `rgb(${v - 2},${v + 3},${v})`;
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      g.fillStyle = 'rgba(80,100,95,0.08)';
      g.fillRect(i * s + 3, j * s + s - 8, s - 6, 5);
    }
  }
  return finish('tile', c);
}

/** 粉刷牆(磚裙牆上方):細噪點 + 極淡髒污 */
export function makePlasterTexture(): THREE.Texture {
  const hit = cache.get('plaster');
  if (hit) return hit;
  const [c, g] = makeCanvas(256);
  g.fillStyle = '#f0efe8';
  g.fillRect(0, 0, 256, 256);
  let k = 13;
  for (let i = 0; i < 2600; i++) {
    k = (k * 37 + 19) % 65536;
    const x = k % 256;
    const y = (k >> 8) % 256;
    const a = 0.02 + (k % 5) * 0.008;
    g.fillStyle = `rgba(${120 + (k % 40)},${125 + (k % 30)},${115 + (k % 35)},${a})`;
    g.fillRect(x, y, 2, 2);
  }
  // 淡水漬
  for (let i = 0; i < 5; i++) {
    k = (k * 41 + 7) % 65536;
    const x = k % 256;
    const w = 20 + (k % 60);
    g.fillStyle = 'rgba(150,155,140,0.05)';
    g.fillRect(x, 0, w, 256);
  }
  return finish('plaster', c);
}

/** 水下焦散:亮色網狀弧線,additive 疊在牆上滾動 */
export function makeCausticsTexture(): THREE.Texture {
  const hit = cache.get('caustics');
  if (hit) return hit;
  const [c, g] = makeCanvas(256);
  g.clearRect(0, 0, 256, 256);
  let k = 5;
  g.strokeStyle = 'rgba(190,255,240,0.55)';
  for (let i = 0; i < 46; i++) {
    k = (k * 53 + 23) % 65536;
    const x = k % 256;
    const y = (k >> 6) % 256;
    const r = 14 + (k % 34);
    const a0 = ((k % 63) / 63) * Math.PI * 2;
    g.lineWidth = 1.5 + (k % 3);
    g.beginPath();
    g.arc(x, y, r, a0, a0 + 1.2 + (k % 20) / 10);
    g.stroke();
    // 邊緣 wrap,讓貼圖可平鋪
    g.beginPath();
    g.arc(x - 256, y, r, a0, a0 + 1.2 + (k % 20) / 10);
    g.stroke();
    g.beginPath();
    g.arc(x, y - 256, r, a0, a0 + 1.2 + (k % 20) / 10);
    g.stroke();
  }
  return finish('caustics', c);
}
