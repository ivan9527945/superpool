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

export type DoorWall = 'north' | 'south' | 'east' | 'west';

export interface DoorSpec {
  index: number;
  /** 門所在的牆:門散落四面,不再全擠在遠牆 */
  wall: DoorWall;
  /** 沿牆的座標(north/south 用 x、east/west 用 z) */
  along: number;
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
  /** 隔間牆:室內的實體薄牆,逼你轉彎繞行(碰撞同水域) */
  barriers: WaterRect[];
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

  // ── 迷宮 PRNG:格局(門的散落、隔間牆)走獨立的隨機串流,
  //    完全不動主 rng 的抽取順序 — 所以門的 dDelta 不變,舊的分享連結仍指向同一棵分岔樹。
  const mrng = mulberry32((seed ^ 0x9e3779b9) >>> 0);

  // ── 門:2–3 道,散落在四面牆的不同位置(逼你轉彎才找得到)
  const doorCount =
    archetype === 'arcade' ? 2 : rng() < 0.5 ? 2 : 3;
  const hasCoherent = rng() < 0.7;
  const coherentIdx = Math.floor(rng() * doorCount);
  // 門要落在的牆(避開南牆出生點正前方的直線);arcade 維持兩側走道端
  const wallPlan: DoorWall[] =
    archetype === 'arcade'
      ? ['north', 'north']
      : doorCount === 2
        ? mrng() < 0.5
          ? ['west', 'north']
          : ['east', 'north']
        : ['west', 'north', 'east'];
  const doors: DoorSpec[] = [];
  for (let i = 0; i < doorCount; i++) {
    const xRoll = rng(); // 保留主串流的抽取(原本是門的 x)
    const coherent = hasCoherent && i === coherentIdx;
    const dDelta = coherent ? -(0.02 + rng() * 0.05) : 0.02 + rng() * 0.14;
    const wall = wallPlan[i];
    let along: number;
    if (archetype === 'arcade') {
      const ledgeMid = (canalHalf + width / 2) / 2;
      along = (i === 0 ? -1 : 1) * ledgeMid + (xRoll - 0.5) * 0.4;
    } else if (wall === 'north' || wall === 'south') {
      // 遠牆的門推向側邊,不擺正中央 — 出生點看不到直達路線
      const side = xRoll < 0.5 ? -1 : 1;
      along = side * (width * 0.22 + mrng() * (width * 0.24));
    } else {
      // 側牆的門落在遠半場(北半),得先深入再轉彎
      along = -depth / 2 + 2.5 + mrng() * (depth * 0.42);
    }
    doors.push({ index: i, wall, along, dDelta, cue: cueColor(dDelta) });
  }

  // ── 隔間牆:逼你繞行。開闊原型(storage/flooded)織成蛇形隔間;
  //    有中央水體的原型(poolhall/arcade/corridor)放幾道獨立屏風,繞過即需轉身。
  const barriers = buildBarriers(mrng, archetype, width, depth, water, doors);

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
    barriers,
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

/** 一道門在世界座標的位置與朝向(開口朝向房間內) */
export function doorAnchor(
  spec: Pick<RoomSpec, 'width' | 'depth'>,
  d: DoorSpec,
): { x: number; z: number; rotY: number } {
  const { width, depth } = spec;
  switch (d.wall) {
    case 'north':
      return { x: d.along, z: -depth / 2, rotY: 0 };
    case 'south':
      return { x: d.along, z: depth / 2, rotY: Math.PI };
    case 'east':
      return { x: width / 2, z: d.along, rotY: -Math.PI / 2 };
    case 'west':
      return { x: -width / 2, z: d.along, rotY: Math.PI / 2 };
  }
}

/** AABB 重疊(含邊界寬容) */
function rectsOverlap(a: WaterRect, b: WaterRect, m = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + m &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + m
  );
}

/** 隔間牆生成:開闊原型織蛇形、水體原型放獨立屏風;皆保證有通路、不封死。 */
function buildBarriers(
  mrng: () => number,
  archetype: Archetype,
  width: number,
  depth: number,
  water: WaterRect[],
  doors: DoorSpec[],
): WaterRect[] {
  const T = 0.3; // 牆厚
  const bars: WaterRect[] = [];
  const spawnZ = depth / 2 - 1.7;

  // 門口前方的淨空區(別讓隔間牆擋死門)
  const doorZones: WaterRect[] = doors.map((d) => {
    const a = doorAnchor({ width, depth }, d);
    // 沿著門的內側方向留一塊淨空
    if (d.wall === 'north') return { x: a.x, z: a.z + 1.6, w: 2.4, d: 3.2 };
    if (d.wall === 'south') return { x: a.x, z: a.z - 1.6, w: 2.4, d: 3.2 };
    if (d.wall === 'east') return { x: a.x - 1.6, z: a.z, w: 3.2, d: 2.4 };
    return { x: a.x + 1.6, z: a.z, w: 3.2, d: 2.4 };
  });

  const clear = (r: WaterRect) => {
    if (r.z > spawnZ - 2.4) return false; // 出生帶淨空
    if (water.some((w) => rectsOverlap(r, w, 0.5))) return false;
    if (doorZones.some((z) => rectsOverlap(r, z, 0.2))) return false;
    return true;
  };

  if (archetype === 'storage' || archetype === 'flooded') {
    // 蛇形隔間:每帶一道貼側牆的牆,缺口在對側,左右交替 → 得來回穿梭
    const bands = 3;
    for (let b = 0; b < bands; b++) {
      const cz = -depth / 2 + ((b + 1) * depth) / (bands + 1);
      if (cz > spawnZ - 2.4) continue;
      const side = b % 2 === 0 ? -1 : 1; // 貼哪面側牆
      const gap = 2.0 + mrng() * 0.8; // 對側留的缺口
      const wallX = (side * width) / 2;
      const innerEdge = -side * (width / 2 - gap);
      const len = Math.abs(wallX - innerEdge);
      const cx = (wallX + innerEdge) / 2;
      const r = { x: cx, z: cz, w: len, d: T };
      if (water.some((w) => rectsOverlap(r, w, 0.3))) continue;
      if (doorZones.some((z) => rectsOverlap(r, z, 0.2))) continue;
      bars.push(r);
    }
  } else {
    // 獨立屏風:短牆,兩端皆可繞;交錯擺放逼你轉身
    const target = archetype === 'corridor' ? 3 : 2;
    let tries = 0;
    while (bars.length < target && tries < 20) {
      tries++;
      const cz = -depth * 0.34 + mrng() * depth * 0.6;
      const cx = (mrng() - 0.5) * width * 0.55;
      const alongZ = mrng() < 0.5;
      const r: WaterRect = alongZ
        ? { x: cx, z: cz, w: T, d: 1.4 + mrng() * 1.8 }
        : { x: cx, z: cz, w: 1.8 + mrng() * 2.0, d: T };
      if (!clear(r)) continue;
      if (bars.some((o) => rectsOverlap(r, o, 0.6))) continue;
      bars.push(r);
    }
  }
  return bars;
}

/** 每個房間的出生點(靠近南牆,面向門) */
export function spawnPoint(spec: RoomSpec): { x: number; z: number } {
  if (spec.archetype === 'arcade') {
    // 出生在其中一側走道
    return { x: (spec.canalHalf + spec.width / 2) / 2, z: spec.depth / 2 - 1.7 };
  }
  return { x: 0, z: spec.depth / 2 - 1.7 };
}
