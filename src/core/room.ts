// 內容模型:房間 = 基礎模板 + 一組由 seed 決定論生成的突變。
// generateRoomSpec 是純函數 — 同一個 (seed, D) 永遠產出同一個房間。
// biome 由 D 的區間決定(帶 seed 抖動),切換基礎模板與可用突變集合。

import { mulberry32, clamp01, lerpHex } from './prng';

export type Biome = 'poolcore' | 'wetzone';

export interface DoorSpec {
  index: number;
  /** 門在遠牆(z = -depth/2)上的 x 位置 */
  x: number;
  /** 穿過這道門的 ΔD:負 = 相干(靠近家),正 = 發散 */
  dDelta: number;
  /** 分岔預覽線索的顏色(門縫透光):青綠 = 低分岔,黃 = 高分岔 */
  cue: string;
}

/** 不該存在的門:只在側牆上,沒有光、沒有去處 */
export interface FakeDoorSpec {
  wall: 'east' | 'west';
  z: number;
}

export interface LightSpec {
  x: number;
  z: number;
  on: boolean;
  /** 接觸不良的閃爍(濕區與高分岔的突變) */
  flicker: boolean;
}

export interface ColumnSpec {
  x: number;
  z: number;
  tilt: number;
}

export interface PropSpec {
  kind: 'chair' | 'ring' | 'bench' | 'locker';
  x: number;
  z: number;
  rotY: number;
}

export interface RoomSpec {
  seed: number;
  biome: Biome;
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
  fakeDoors: FakeDoorSpec[];
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

  // biome:D 越過閾值進入濕區;閾值帶 seed 抖動,讓邊界不是一條硬線
  const biomeRoll = rng();
  const biome: Biome =
    D >= 0.35 + (biomeRoll - 0.5) * 0.1 ? 'wetzone' : 'poolcore';

  // 尺寸與泳池:池核 = 開闊泳池廳;濕區 = 窄長廊道 + 退化成排水槽的池
  let width: number;
  let depth: number;
  let height: number;
  let pool: { x: number; z: number; w: number; d: number };
  if (biome === 'poolcore') {
    width = 11 + rng() * 6;
    depth = 16 + rng() * 8;
    height = 4.2 + rng() * 1.6;
    pool = { x: 0, z: -depth * 0.06, w: width * 0.52, d: depth * 0.44 };
  } else {
    width = 6.8 + rng() * 3;
    depth = 22 + rng() * 8;
    height = 3.1 + rng() * 0.9;
    const side = rng() < 0.5 ? -1 : 1;
    pool = {
      x: side * width * 0.12,
      z: -depth * 0.05,
      w: width * 0.32,
      d: depth * 0.55,
    };
  }
  const waterY = -0.35;
  const basinDepth = biome === 'poolcore' ? 1.5 : 0.9;

  // 天花板燈陣:D 越高,亮著的越少;濕區的燈開始接觸不良
  const nx = Math.max(biome === 'poolcore' ? 2 : 1, Math.floor(width / 3.6));
  const nz = Math.max(3, Math.floor(depth / 3.6));
  const onProb = clamp01((biome === 'poolcore' ? 0.92 : 0.8) - D * 0.8);
  const flickerProb =
    biome === 'wetzone' ? 0.25 + D * 0.3 : Math.max(0, D - 0.2) * 0.25;
  const lights: LightSpec[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const on = rng() < onProb;
      const flicker = rng() < flickerProb;
      lights.push({
        x: -width / 2 + ((i + 0.5) * width) / nx,
        z: -depth / 2 + ((j + 0.5) * depth) / nz,
        on,
        flicker: on && flicker,
      });
    }
  }

  // 柱:池核沿池邊;濕區貼牆。D 高時開始歪斜(幾何相干性崩解)
  const columns: ColumnSpec[] = [];
  const tiltAmt = D > 0.45 ? (D - 0.45) * 1.6 : 0;
  if (biome === 'poolcore') {
    const colX = pool.w / 2 + 1.15;
    const colRows = Math.max(2, Math.floor(pool.d / 4));
    for (let j = 0; j < colRows; j++) {
      const z = pool.z - pool.d / 2 + ((j + 0.5) * pool.d) / colRows;
      const t1 = (rng() - 0.5) * 0.16;
      const t2 = (rng() - 0.5) * 0.16;
      columns.push({ x: -colX, z, tilt: t1 * tiltAmt });
      columns.push({ x: colX, z, tilt: t2 * tiltAmt });
    }
  } else {
    const colRows = Math.max(2, Math.floor(depth / 6));
    for (let j = 0; j < colRows; j++) {
      const z = -depth / 2 + ((j + 0.5) * depth) / colRows;
      const t1 = (rng() - 0.5) * 0.2;
      const t2 = (rng() - 0.5) * 0.2;
      columns.push({ x: -(width / 2 - 0.45), z, tilt: t1 * tiltAmt });
      columns.push({ x: width / 2 - 0.45, z, tilt: t2 * tiltAmt });
    }
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

  // 不該有的門:濕區高分岔時,側牆上多出黑洞般的假門
  const fakeDoors: FakeDoorSpec[] = [];
  const fakeRoll1 = rng();
  const fakeRoll2 = rng();
  if (biome === 'wetzone') {
    const fakeChance = clamp01((D - 0.4) * 1.6);
    if (fakeRoll1 < fakeChance) {
      fakeDoors.push({
        wall: fakeRoll2 < 0.5 ? 'east' : 'west',
        z: -depth / 2 + 3 + fakeRoll2 * (depth - 6),
      });
    }
    if (fakeRoll2 < fakeChance - 0.3) {
      fakeDoors.push({
        wall: fakeRoll1 < 0.5 ? 'west' : 'east',
        z: -depth / 2 + 3 + fakeRoll1 * (depth - 6),
      });
    }
  }

  // 道具:池核 = 池畔椅/救生圈;濕區 = 更衣室長凳/置物櫃
  const props: PropSpec[] = [];
  const walkSide = -Math.sign(pool.x) || 1; // 濕區的走道側
  const propCount = Math.floor(rng() * 3);
  for (let i = 0; i < propCount; i++) {
    const roll = rng();
    const zPos = -depth / 2 + 2 + rng() * (depth - 4);
    if (biome === 'poolcore') {
      const side = roll < 0.5 ? -1 : 1;
      props.push({
        kind: rng() < 0.6 ? 'chair' : 'ring',
        x: side * (width / 2 - 1.1 - rng() * 0.8),
        z: zPos,
        rotY: rng() * Math.PI * 2,
      });
    } else {
      props.push({
        kind: roll < 0.55 ? 'bench' : 'locker',
        x: walkSide * (width / 2 - 0.75),
        z: zPos,
        rotY: walkSide > 0 ? -Math.PI / 2 : Math.PI / 2,
      });
    }
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

  const blend = clamp01(
    D * 0.9 + (biome === 'wetzone' ? 0.12 : 0) + (rng() - 0.5) * 0.12,
  );

  return {
    seed,
    biome,
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
    fakeDoors,
    figure,
    blend,
  };
}

/** 每個房間的出生點(靠近南牆,面向泳池與門) */
export function spawnPoint(spec: RoomSpec): { x: number; z: number } {
  return { x: 0, z: spec.depth / 2 - 1.7 };
}
