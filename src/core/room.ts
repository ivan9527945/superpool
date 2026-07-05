// 內容模型:房間 = 基礎模板 + 一組由 seed 決定論生成的突變。
// generateRoomSpec 是純函數 — 同一個 (seed, D) 永遠產出同一個房間。

import { mulberry32, clamp01, lerpHex } from './prng';

export interface DoorSpec {
  index: number;
  /** 門在遠牆(z = -depth/2)上的 x 位置 */
  x: number;
  /** 穿過這道門的 ΔD:負 = 相干(靠近家),正 = 發散 */
  dDelta: number;
  /** 分岔預覽線索的顏色(門縫透光):青綠 = 低分岔,黃 = 高分岔 */
  cue: string;
}

export interface LightSpec {
  x: number;
  z: number;
  on: boolean;
}

export interface ColumnSpec {
  x: number;
  z: number;
  tilt: number;
}

export interface PropSpec {
  kind: 'chair' | 'ring';
  x: number;
  z: number;
  rotY: number;
}

export interface RoomSpec {
  seed: number;
  width: number;
  depth: number;
  height: number;
  pool: { x: number; z: number; w: number; d: number };
  waterY: number;
  basinDepth: number;
  lights: LightSpec[];
  columns: ColumnSpec[];
  props: PropSpec[];
  doors: DoorSpec[];
  figure: { x: number; z: number } | null;
  /** 調色盤漂移量:0 = 池核青綠,1 = 後室黃 */
  blend: number;
}

const CUE_COHERENT = '#46e0c8';
const CUE_DIVERGENT = '#e6c34a';

export function cueColor(dDelta: number): string {
  const t = clamp01((dDelta + 0.07) / 0.22);
  return lerpHex(CUE_COHERENT, CUE_DIVERGENT, t);
}

export function generateRoomSpec(
  seed: number,
  D: number,
  opts: { figureChance?: number } = {},
): RoomSpec {
  const rng = mulberry32(seed);

  // 尺寸
  const width = 11 + rng() * 6;
  const depth = 16 + rng() * 8;
  const height = 4.2 + rng() * 1.6;

  // 泳池
  const pool = { x: 0, z: -depth * 0.06, w: width * 0.52, d: depth * 0.44 };
  const waterY = -0.35;
  const basinDepth = 1.5;

  // 天花板燈陣:D 越高,亮著的越少
  const nx = Math.max(2, Math.floor(width / 3.6));
  const nz = Math.max(3, Math.floor(depth / 3.6));
  const onProb = clamp01(0.92 - D * 0.8);
  const lights: LightSpec[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      lights.push({
        x: -width / 2 + ((i + 0.5) * width) / nx,
        z: -depth / 2 + ((j + 0.5) * depth) / nz,
        on: rng() < onProb,
      });
    }
  }

  // 池邊柱:D 高時開始歪斜(幾何相干性崩解)
  const columns: ColumnSpec[] = [];
  const colX = pool.w / 2 + 1.15;
  const colRows = Math.max(2, Math.floor(pool.d / 4));
  for (let j = 0; j < colRows; j++) {
    const z = pool.z - pool.d / 2 + ((j + 0.5) * pool.d) / colRows;
    const tiltRoll1 = (rng() - 0.5) * 0.16;
    const tiltRoll2 = (rng() - 0.5) * 0.16;
    const tiltAmt = D > 0.45 ? (D - 0.45) * 1.6 : 0;
    columns.push({ x: -colX, z, tilt: tiltRoll1 * tiltAmt });
    columns.push({ x: colX, z, tilt: tiltRoll2 * tiltAmt });
  }

  // 門:2–3 道,在遠牆上;每道帶一個分岔預覽值
  const doorCount = rng() < 0.5 ? 2 : 3;
  const spread = (width - 4) / 2;
  const hasCoherent = rng() < 0.7;
  const coherentIdx = Math.floor(rng() * doorCount);
  const doors: DoorSpec[] = [];
  for (let i = 0; i < doorCount; i++) {
    const x =
      -spread + ((i + 0.5) * 2 * spread) / doorCount + (rng() - 0.5) * 0.6;
    const coherent = hasCoherent && i === coherentIdx;
    const dDelta = coherent
      ? -(0.02 + rng() * 0.05)
      : 0.02 + rng() * 0.14;
    doors.push({ index: i, x, dDelta, cue: cueColor(dDelta) });
  }

  // 道具
  const props: PropSpec[] = [];
  const propCount = Math.floor(rng() * 3);
  for (let i = 0; i < propCount; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    props.push({
      kind: rng() < 0.6 ? 'chair' : 'ring',
      x: side * (width / 2 - 1.1 - rng() * 0.8),
      z: -depth / 2 + 2 + rng() * (depth - 4),
      rotY: rng() * Math.PI * 2,
    });
  }

  // 身影:固定抽取三個 roll,再依 chance 決定是否存在(保持 draw 順序穩定)
  const figSide = rng() < 0.5 ? -1 : 1;
  const figZroll = rng();
  const figRoll = rng();
  const figureChance = opts.figureChance ?? Math.max(0, D - 0.35) * 0.9;
  const figure =
    figRoll < figureChance
      ? {
          x: figSide * (width / 2 - 1.3),
          z: -depth / 2 + 1.6 + figZroll * 2.5,
        }
      : null;

  const blend = clamp01(D * 0.9 + (rng() - 0.5) * 0.12);

  return {
    seed,
    width,
    depth,
    height,
    pool,
    waterY,
    basinDepth,
    lights,
    columns,
    props,
    doors,
    figure,
    blend,
  };
}

/** 每個房間的出生點(靠近南牆,面向泳池與門) */
export function spawnPoint(spec: RoomSpec): { x: number; z: number } {
  return { x: 0, z: spec.depth / 2 - 1.7 };
}
