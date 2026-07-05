// 全作中樞狀態:branchId(當前宇宙)、D(分岔度)、path(走過的分岔序列)。
// path 就是可分享/可重播的完整紀錄 — 從 ROOT 依序 hashCombine 即可重建整條路。

import { create } from 'zustand';
import { hashCombine, clamp01 } from './prng';

export const ROOT_BRANCH = 0x50554c31; // 'PUL1'

/** 熵:每次穿門的固定外推,玩家的選擇只能對抗它 */
const ENTROPY_DRIFT = 0.008;

interface SuperpoolState {
  started: boolean;
  branchId: number;
  D: number;
  path: number[];
  travelNonce: number;
  start: () => void;
  traverse: (doorIndex: number, dDelta: number) => void;
}

/** debug:?d=0.6 直接跳到任意分岔度(client-only,SSR 拿預設值) */
function initialD(): number {
  if (typeof window === 'undefined') return 0.08;
  const v = parseFloat(
    new URLSearchParams(window.location.search).get('d') ?? '',
  );
  return Number.isFinite(v) ? clamp01(v) : 0.08;
}

export const useStore = create<SuperpoolState>((set) => ({
  started: false,
  branchId: ROOT_BRANCH,
  D: initialD(),
  path: [],
  travelNonce: 0,
  start: () => set({ started: true }),
  traverse: (doorIndex, dDelta) =>
    set((s) => ({
      branchId: hashCombine(s.branchId, doorIndex + 1),
      D: clamp01(s.D + dDelta + ENTROPY_DRIFT),
      path: [...s.path, doorIndex],
      travelNonce: s.travelNonce + 1,
    })),
}));
