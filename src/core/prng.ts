// 決定論地基:所有「宇宙」都由一個 32-bit branchId 唯一決定。
// seed → room 必須是純函數;這是倒影、重播、分享 hash 的共同前提。

/** mulberry32 — 快速、品質足夠的 seeded PRNG。回傳 [0,1) 均勻分佈。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由父宇宙 id + 門的序號,決定論地導出子宇宙 id。 */
export function hashCombine(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ b, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 水面倒影分支:同一個房間在「隔壁宇宙」的版本。 */
export function mirrorSeed(branchId: number): number {
  return (branchId ^ 0x9e3779b9) >>> 0;
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** '#rrggbb' 兩色線性插值,回傳 '#rrggbb'。核心層不依賴 three。 */
export function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}
