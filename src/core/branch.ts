// 分享:一條分岔路徑 = 一串門的序號。
// 從固定起點(ROOT_BRANCH, INITIAL_D)依序套用,就能完整、決定論地重播整段旅程 —
// 所以只要把 path[] 編進 URL,任何人打開就重現同一條分岔。

import { generateRoomSpec, type Archetype } from './room';
import { hashCombine, clamp01 } from './prng';

export const ROOT_BRANCH = 0x50554c31; // 'PUL1'
export const ENTROPY_DRIFT = 0.008; // 熵:每次穿門的固定外推
export const INITIAL_D = 0.08;

/** 家(ROOT)永遠是泳池廳 — 重播必須沿用同一規則,否則門的 dDelta 會對不上 */
function rootForce(branchId: number): Archetype | undefined {
  return branchId === ROOT_BRANCH ? 'poolhall' : undefined;
}

/** 走一步:回傳新的 branchId 與 D(與 store.traverse 同一公式) */
export function stepBranch(
  branchId: number,
  D: number,
  doorIndex: number,
  dDelta: number,
): { branchId: number; D: number } {
  return {
    branchId: hashCombine(branchId, doorIndex + 1),
    D: clamp01(D + dDelta + ENTROPY_DRIFT),
  };
}

/** 從起點重播整條 path,回傳終點狀態(遇到不存在的門即中止) */
export function replayPath(path: number[]): {
  branchId: number;
  D: number;
  valid: boolean;
} {
  let branchId = ROOT_BRANCH;
  let D = INITIAL_D;
  for (const idx of path) {
    const spec = generateRoomSpec(branchId, D, {
      forceArchetype: rootForce(branchId),
    });
    const door = spec.doors[idx];
    if (!door) return { branchId, D, valid: false };
    ({ branchId, D } = stepBranch(branchId, D, idx, door.dDelta));
  }
  return { branchId, D, valid: true };
}

/** path → 緊湊字串(每道門一個 0–2 的字元) */
export function encodePath(path: number[]): string {
  return path.map((i) => String(i)).join('');
}

/** 字串 → path;含非法字元或超出門序號範圍則回 null */
export function decodePath(s: string): number[] | null {
  if (!/^[0-2]*$/.test(s)) return null;
  return Array.from(s, (c) => Number(c));
}

/** 目前分岔的可分享連結(空 path = 還在家,回站點根 URL) */
export function shareUrl(path: number[]): string {
  if (typeof window === 'undefined') return '';
  const base = window.location.origin + window.location.pathname;
  if (path.length === 0) return base;
  return `${base}?b=${encodePath(path)}`;
}
