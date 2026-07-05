// 內容模型:房間 = 原型模板 + 一組由 seed 決定論生成的突變。
// generateRoomSpec 是純函數 — 同一個 (seed, D) 永遠產出同一個房間。
// 每道門後是不同「原型」的空間:泳池廳、拱廊水道、淹水室、儲藏間、濕區廊道。

import { mulberry32, clamp01, lerpHex } from './prng';

export type Archetype =
  | 'poolhall' // 開闊泳池廳:天窗、扶梯、池緣,「家」的樣子
  | 'arcade' // 拱廊水道:連續拱牆跨過水道,錯綜的空間
  | 'flooded' // 淹水室:整室在水中,漂浮
  | 'storage' // 儲藏間:低天花板、成堆泳池椅、地面積水
  | 'corridor'; // 濕區廊道:窄長、排水槽

export interface WaterRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface DoorSpec {
  index: number;
  x: number;
  dDelta: number;
  cue: string;
}

export interface FakeDoorSpec {
  wall: 'east' | 'west';
  z: number;
}

export interface LightSpec {
  x: number;
  z: number;
  on: boolean;
  flicker: boolean;
}

export interface ColumnSpec {
  x: number;
  z: number;
  tilt: number;
}

export interface PropSpec {
  kind:
    | 'chair'
    | 'ring'
    | 'bench'
    | 'locker'
    | 'chairstack'
    | 'duck'
    | 'ladder'
    | 'slide';
  x: number;
  z: number;
  rotY: number;
}

export interface FigureSpec {
  x: number;
  z: number;
  mode: 'solid' | 'phase';
}

export interface NicheSpec {
  wall: 'east' | 'west';
  z: number;
  w: number;
  h: number;
}

export interface SkylightSpec {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface RoomSpec {
  seed: number;
  archetype: Archetype;
  width: number;
  depth: number;
  height: number;
  /** 擋路的水域 */
  water: WaterRect[];
  /** 渲染平行宇宙倒影的那面水(池面/水道/積水)與其高度 */
  mirrorWater: (WaterRect & { y: number }) | null;
  /** flooded:整室淹水的水面高度(null = 沒淹) */
  floodLevel: number | null;
  basinDepth: number;
  /** arcade:拱牆的 z 位置 */
  arches: number[];
  /** arcade:水道半寬 */
  canalHalf: number;
  niches: NicheSpec[];
  skylights: SkylightSpec[];
  /** 高窗所在的側牆(null = 無窗) */
  windowWall: 'east' | 'west' | null;
  /** 磚裙牆高度(以上是粉刷牆) */
  wainscot: number;
  lights: LightSpec[];
  columns: ColumnSpec[];
  props: PropSpec[];
  doors: DoorSpec[];
  fakeDoors: FakeDoorSpec[];
  figure: FigureSpec | null;
  blend: number;
}

const CUE_COHERENT = '#46e0c8';
const CUE_DIVERGENT = '#e6c34a';

export function cueColor(dDelta: number): string {
  const t = clamp01((dDelta + 0.07) / 0.22);
  return lerpHex(CUE_COHERENT, CUE_DIVERGENT, t);
}

/** 原型選擇:seed 決定,D 輕微偏壓(離家越遠越封閉、越不對勁) */
function pickArchetype(roll: number, D: number): Archetype {
  const w: [Archetype, number][] = [
    ['poolhall', 0.3 * (1.15 - 0.55 * D)],
    ['arcade', 0.24 * (1.15 - 0.45 * D)],
    ['flooded', 0.15 + 0.05 * D],
    ['storage', 0.14 + 0.08 * D],
    ['corridor', 0.14 + 0.2 * D],
  ];
  const total = w.reduce((s, [, v]) => s + v, 0);
  let acc = 0;
  for (const [a, v] of w) {
    acc += v / total;
    if (roll < acc) return a;
  }
  return 'corridor';
}

export function generateRoomSpec(
  seed: number,
  D: number,
  opts: {
    figureChance?: number;
    figureMode?: 'solid' | 'phase';
    forceArchetype?: Archetype;
  } = {},
): RoomSpec {
  const rng = mulberry32(seed);

  const archRoll = rng();
  const archetype = opts.forceArchetype ?? pickArchetype(archRoll, D);

  // ── 尺寸與水體(依原型)
  let width: number;
  let depth: number;
  let height: number;
  const water: WaterRect[] = [];
  let mirrorWater: (WaterRect & { y: number }) | null = null;
  let floodLevel: number | null = null;
  let basinDepth = 1.6;
  const arches: number[] = [];
  let canalHalf = 0;

  if (archetype === 'poolhall') {
    width = 13 + rng() * 6;
    depth = 18 + rng() * 9;
    height = 4.6 + rng() * 1.8;
    const pool = { x: 0, z: -depth * 0.05, w: width * 0.5, d: depth * 0.42 };
    water.push(pool);
    mirrorWater = { ...pool, y: -0.35 };
  } else if (archetype === 'arcade') {
    width = 10 + rng() * 4.5;
    depth = 22 + rng() * 8;
    height = 4.8 + rng() * 1.4;
    canalHalf = width * (0.2 + rng() * 0.06);
    const canal = { x: 0, z: 0, w: canalHalf * 2, d: depth - 3 };
    water.push(canal);
    mirrorWater = { ...canal, y: -0.3 };
    basinDepth = 1.1;
    const archCount = Math.max(3, Math.floor(depth / 4.6));
    for (let i = 1; i <= archCount; i++) {
      arches.push(-depth / 2 + (i * depth) / (archCount + 1) + (rng() - 0.5) * 0.5);
    }
  } else if (archetype === 'flooded') {
    width = 9 + rng() * 5;
    depth = 14 + rng() * 8;
    height = 4.2 + rng() * 1.4;
    floodLevel = height * (0.62 + rng() * 0.16);
    basinDepth = 0;
  } else if (archetype === 'storage') {
    width = 8 + rng() * 5;
    depth = 12 + rng() * 8;
    height = 2.7 + rng() * 0.7;
    // 地面積水:乾房間裡的平行宇宙之窗
    const px = (rng() - 0.5) * width * 0.4;
    const pz = (rng() - 0.5) * depth * 0.4;
    mirrorWater = {
      x: px,
      z: pz,
      w: 1.6 + rng() * 2.2,
      d: 1.2 + rng() * 1.8,
      y: 0.012,
    };
    basinDepth = 0;
  } else {
    // corridor
    width = 6.8 + rng() * 3;
    depth = 22 + rng() * 8;
    height = 3.1 + rng() * 0.9;
    const side = rng() < 0.5 ? -1 : 1;
    const drain = {
      x: side * width * 0.12,
      z: -depth * 0.05,
      w: width * 0.32,
      d: depth * 0.55,
    };
    water.push(drain);
    mirrorWater = { ...drain, y: -0.35 };
    basinDepth = 0.9;
  }

  // ── 天窗與高窗(明亮原型才有;這是「白日感」的來源)
  const skylights: SkylightSpec[] = [];
  let windowWall: 'east' | 'west' | null = null;
  const skyRoll = rng();
  const winRoll = rng();
  if (archetype === 'poolhall' || archetype === 'arcade') {
    const n = archetype === 'poolhall' ? 2 + Math.floor(skyRoll * 2) : 3;
    for (let i = 0; i < n; i++) {
      skylights.push({
        x: (rng() - 0.5) * width * 0.4,
        z: -depth / 2 + ((i + 0.5) * depth) / n,
        w: 1.6 + rng() * 1.6,
        d: 2.4 + rng() * 2,
      });
    }
    if (winRoll < 0.75) windowWall = winRoll < 0.375 ? 'east' : 'west';
  } else if (archetype === 'flooded' && skyRoll < 0.6) {
    skylights.push({
      x: 0,
      z: -depth * 0.1,
      w: 1.8 + rng() * 1.4,
      d: 1.8 + rng() * 1.4,
    });
  }

  // ── 磚裙牆高度
  const wainscot =
    archetype === 'storage' ? height : 1.6 + rng() * 0.8;

  // ── 燈陣:D 越高亮的越少;封閉原型的燈開始接觸不良
  const nx = Math.max(archetype === 'corridor' ? 1 : 2, Math.floor(width / 3.8));
  const nz = Math.max(3, Math.floor(depth / 3.8));
  const onProb = clamp01(
    (archetype === 'corridor' || archetype === 'storage' ? 0.82 : 0.94) -
      D * 0.8,
  );
  const flickerProb =
    archetype === 'corridor' || archetype === 'storage'
      ? 0.22 + D * 0.3
      : Math.max(0, D - 0.25) * 0.3;
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

  // ── 柱:D 高開始歪斜
  const columns: ColumnSpec[] = [];
  const tiltAmt = D > 0.45 ? (D - 0.45) * 1.6 : 0;
  if (archetype === 'poolhall') {
    const colX = water[0].w / 2 + 1.3;
    const rows = Math.max(2, Math.floor(water[0].d / 4.2));
    for (let j = 0; j < rows; j++) {
      const z = water[0].z - water[0].d / 2 + ((j + 0.5) * water[0].d) / rows;
      columns.push({ x: -colX, z, tilt: (rng() - 0.5) * 0.16 * tiltAmt });
      columns.push({ x: colX, z, tilt: (rng() - 0.5) * 0.16 * tiltAmt });
    }
  } else if (archetype === 'corridor' || archetype === 'storage') {
    const rows = Math.max(2, Math.floor(depth / 6));
    for (let j = 0; j < rows; j++) {
      const z = -depth / 2 + ((j + 0.5) * depth) / rows;
      columns.push({
        x: -(width / 2 - 0.45),
        z,
        tilt: (rng() - 0.5) * 0.2 * tiltAmt,
      });
      columns.push({
        x: width / 2 - 0.45,
        z,
        tilt: (rng() - 0.5) * 0.2 * tiltAmt,
      });
    }
  }

  // ── 壁龕(封閉原型的空間層次)
  const niches: NicheSpec[] = [];
  if (archetype === 'corridor' || archetype === 'storage') {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      niches.push({
        wall: rng() < 0.5 ? 'east' : 'west',
        z: -depth / 2 + 3 + rng() * (depth - 6),
        w: 1.2 + rng() * 1.4,
        h: Math.min(height - 0.5, 1.8 + rng() * 0.7),
      });
    }
  }

  // ── 門:2–3 道,在遠牆上(arcade 的門在兩側走道端)
  const doorCount =
    archetype === 'arcade' ? 2 : rng() < 0.5 ? 2 : 3;
  const spread = (width - 4) / 2;
  const hasCoherent = rng() < 0.7;
  const coherentIdx = Math.floor(rng() * doorCount);
  const doors: DoorSpec[] = [];
  for (let i = 0; i < doorCount; i++) {
    let x: number;
    if (archetype === 'arcade') {
      const ledgeMid = (canalHalf + width / 2) / 2;
      x = (i === 0 ? -1 : 1) * ledgeMid + (rng() - 0.5) * 0.4;
    } else {
      x = -spread + ((i + 0.5) * 2 * spread) / doorCount + (rng() - 0.5) * 0.6;
    }
    const coherent = hasCoherent && i === coherentIdx;
    const dDelta = coherent ? -(0.02 + rng() * 0.05) : 0.02 + rng() * 0.14;
    doors.push({ index: i, x, dDelta, cue: cueColor(dDelta) });
  }

  // ── 不該有的門(封閉原型高 D)
  const fakeDoors: FakeDoorSpec[] = [];
  const fakeRoll1 = rng();
  const fakeRoll2 = rng();
  if (archetype === 'corridor' || archetype === 'storage') {
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

  // ── 道具(依原型)
  const props: PropSpec[] = [];
  const propRolls = [rng(), rng(), rng(), rng(), rng(), rng()];
  if (archetype === 'poolhall') {
    // 扶梯永遠在池緣
    const pool = water[0];
    props.push({
      kind: 'ladder',
      x: pool.x + pool.w / 2,
      z: pool.z + pool.d * 0.3,
      rotY: -Math.PI / 2,
    });
    if (propRolls[0] < 0.3) {
      props.push({
        kind: 'slide',
        x: pool.x - pool.w / 2 - 0.4,
        z: pool.z - pool.d * 0.2,
        rotY: Math.PI / 2,
      });
    }
    if (propRolls[1] < 0.5) {
      props.push({
        kind: 'chair',
        x: (propRolls[2] < 0.5 ? -1 : 1) * (width / 2 - 1.3),
        z: -depth / 2 + 3 + propRolls[3] * (depth - 6),
        rotY: propRolls[4] * Math.PI * 2,
      });
    }
    if (propRolls[5] < 0.1) {
      props.push({ kind: 'duck', x: pool.x + (propRolls[2] - 0.5) * pool.w * 0.6, z: pool.z + (propRolls[3] - 0.5) * pool.d * 0.6, rotY: propRolls[4] * 6 });
    }
  } else if (archetype === 'storage') {
    const n = 2 + Math.floor(propRolls[0] * 3);
    for (let i = 0; i < n; i++) {
      const r = (propRolls[i % 6] + i * 0.37) % 1;
      props.push({
        kind: r < 0.55 ? 'chairstack' : r < 0.8 ? 'locker' : 'bench',
        x: (r < 0.5 ? -1 : 1) * (width / 2 - 0.9 - r * 0.5),
        z: -depth / 2 + 2 + ((propRolls[(i + 1) % 6] + i * 0.51) % 1) * (depth - 4),
        rotY: r < 0.5 ? Math.PI / 2 : -Math.PI / 2,
      });
    }
    if (propRolls[5] < 0.12) {
      props.push({ kind: 'duck', x: 0, z: depth * 0.2, rotY: propRolls[1] * 6 });
    }
  } else if (archetype === 'flooded') {
    // 漂在水面的椅子
    const n = Math.floor(propRolls[0] * 3);
    for (let i = 0; i < n; i++) {
      props.push({
        kind: 'chair',
        x: (propRolls[i + 1] - 0.5) * width * 0.7,
        z: (propRolls[i + 2] - 0.5) * depth * 0.7,
        rotY: propRolls[i + 3] * Math.PI * 2,
      });
    }
    if (propRolls[5] < 0.15) {
      props.push({ kind: 'duck', x: (propRolls[1] - 0.5) * width * 0.5, z: (propRolls[2] - 0.5) * depth * 0.5, rotY: 0 });
    }
  } else if (archetype === 'corridor') {
    const n = Math.floor(propRolls[0] * 3);
    const walkSide = water[0] ? -Math.sign(water[0].x) || 1 : 1;
    for (let i = 0; i < n; i++) {
      const r = propRolls[i + 1];
      props.push({
        kind: r < 0.55 ? 'bench' : 'locker',
        x: walkSide * (width / 2 - 0.75),
        z: -depth / 2 + 2 + propRolls[i + 2] * (depth - 4),
        rotY: walkSide > 0 ? -Math.PI / 2 : Math.PI / 2,
      });
    }
  }

  // ── 身影(draw 順序固定)
  const figSide = rng() < 0.5 ? -1 : 1;
  const figZroll = rng();
  const figRoll = rng();
  const figureChance = opts.figureChance ?? clamp01((D - 0.38) * 1.4);
  let figure: FigureSpec | null = null;
  if (figRoll < figureChance) {
    const cornerZ = -depth / 2 + 1.6 + figZroll * 2.5;
    const approach = clamp01((D - 0.5) * 1.2) * 0.65;
    const mode =
      opts.figureMode ??
      (D + (figZroll - 0.5) * 0.06 >= 0.72 ? 'solid' : 'phase');
    figure = {
      x: figSide * (width / 2 - 1.3),
      z: cornerZ + (depth * 0.1 - cornerZ) * approach,
      mode,
    };
  }

  const blend = clamp01(
    D * 0.9 +
      (archetype === 'corridor' || archetype === 'storage' ? 0.1 : 0) +
      (rng() - 0.5) * 0.12,
  );

  return {
    seed,
    archetype,
    width,
    depth,
    height,
    water,
    mirrorWater,
    floodLevel,
    basinDepth,
    arches,
    canalHalf,
    niches,
    skylights,
    windowWall,
    wainscot,
    lights,
    columns,
    props,
    doors,
    fakeDoors,
    figure,
    blend,
  };
}

/** 每個房間的出生點(靠近南牆,面向門) */
export function spawnPoint(spec: RoomSpec): { x: number; z: number } {
  if (spec.archetype === 'arcade') {
    // 出生在其中一側走道
    return { x: (spec.canalHalf + spec.width / 2) / 2, z: spec.depth / 2 - 1.7 };
  }
  return { x: 0, z: spec.depth / 2 - 1.7 };
}
