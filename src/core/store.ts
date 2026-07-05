// 全作中樞狀態:branchId(當前宇宙)、D(分岔度)、path(走過的分岔序列)。
// path 就是可分享/可重播的完整紀錄 — 從 ROOT 依序 hashCombine 即可重建整條路。

import { create } from 'zustand';
import { clamp01 } from './prng';
import {
  ROOT_BRANCH,
  INITIAL_D,
  stepBranch,
  replayPath,
  decodePath,
  shareUrl,
} from './branch';

export { ROOT_BRANCH } from './branch';

/**
 * 結局狀態機:
 * play → lucid(把 D 壓到 ≈0:揭露「沒有原初的家」)→ super(疊加態)→ end(莊子收束)
 * play → super(D 衝過閾值,直接迷失進疊加態)→ end
 */
export type Phase = 'play' | 'lucid' | 'super' | 'end';

interface SuperpoolState {
  started: boolean;
  branchId: number;
  D: number;
  path: number[];
  travelNonce: number;
  phase: Phase;
  start: () => void;
  traverse: (doorIndex: number, dDelta: number) => void;
  setPhase: (phase: Phase) => void;
}

/** 開場狀態:?b= 分享連結優先重播;否則 ?d= debug;否則從家出發 */
function initialState(): { branchId: number; D: number; path: number[] } {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const b = params.get('b');
    if (b) {
      const path = decodePath(b);
      if (path && path.length) {
        const { branchId, D, valid } = replayPath(path);
        if (valid) return { branchId, D, path };
      }
    }
    const d = parseFloat(params.get('d') ?? '');
    if (Number.isFinite(d)) {
      return { branchId: ROOT_BRANCH, D: clamp01(d), path: [] };
    }
  }
  return { branchId: ROOT_BRANCH, D: INITIAL_D, path: [] };
}

export const useStore = create<SuperpoolState>((set) => ({
  started: false,
  ...initialState(),
  travelNonce: 0,
  phase: 'play',
  start: () => set({ started: true }),
  setPhase: (phase) => set({ phase }),
  traverse: (doorIndex, dDelta) =>
    set((s) => {
      const next = stepBranch(s.branchId, s.D, doorIndex, dDelta);
      return {
        branchId: next.branchId,
        D: next.D,
        path: [...s.path, doorIndex],
        travelNonce: s.travelNonce + 1,
      };
    }),
}));

// debug:console 可直接操作狀態(配合 ?d= 使用)
if (typeof window !== 'undefined') {
  (window as unknown as { __superpool: typeof useStore }).__superpool =
    useStore;
  (window as unknown as { __branch: unknown }).__branch = {
    replayPath,
    decodePath,
    shareUrl,
  };
}
