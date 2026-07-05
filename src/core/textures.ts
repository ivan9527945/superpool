// 程序化瓷磚貼圖:一張 4×4 小磚的 canvas texture,各表面 clone 後設定自己的 repeat。
// 貼圖本身近白,實際色調由材質 color 乘上(調色盤跟著 blend 漂移)。

import * as THREE from 'three';

let cached: THREE.CanvasTexture | null = null;

export function makeTileTexture(): THREE.Texture {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2f6f3';
  g.fillRect(0, 0, 256, 256);

  const n = 4;
  const s = 256 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 230 + ((i * 7 + j * 13) % 4) * 6;
      g.fillStyle = `rgb(${v},${v + 4},${v + 2})`;
      g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    }
  }
  g.strokeStyle = '#8fb0a8';
  g.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo(i * s, 0);
    g.lineTo(i * s, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * s);
    g.lineTo(256, i * s);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cached = tex;
  return tex;
}
