'use client';

// 房間零件庫:磚面、燈具、門廊、拱牆、天窗、高窗、壁龕、道具、身影、焦散。
// 所有零件都是 spec 的純渲染,可被任何原型組裝。

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { DoorSpec, FigureSpec, LightSpec } from '@/core/room';
import { makeCausticsTexture } from '@/core/textures';

export const TILE = 0.62;
export const BLACK = new THREE.Color('#000000');

export interface Palette {
  wallTile: THREE.Color;
  plaster: THREE.Color;
  floor: THREE.Color;
  basin: THREE.Color;
  ceil: THREE.Color;
  lightOn: THREE.Color;
  amb: THREE.Color;
}

/** 平鋪磚面:texture clone + 依尺寸設 repeat */
export function Tiled(props: {
  map: THREE.Texture;
  w: number;
  h: number;
  color: THREE.Color;
  tile?: number;
  roughness?: number;
  metalness?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const {
    map: base,
    w,
    h,
    color,
    tile = TILE,
    roughness = 0.38,
    metalness = 0.02,
    position,
    rotation,
  } = props;
  const map = useMemo(() => {
    const t = base.clone();
    t.repeat.set(w / tile, h / tile);
    t.needsUpdate = true;
    return t;
  }, [base, w, h, tile]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial
        map={map}
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
}

/** 兩段式牆:下方磚裙牆 + 上方粉刷 */
export function Wall(props: {
  mosaic: THREE.Texture;
  plaster: THREE.Texture;
  w: number;
  height: number;
  wainscot: number;
  pal: Palette;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const { mosaic, plaster, w, height, wainscot, pal, position, rotation } =
    props;
  const ws = Math.min(wainscot, height);
  const upper = height - ws;
  return (
    <group position={position} rotation={rotation}>
      <Tiled map={mosaic} w={w} h={ws} color={pal.wallTile} tile={0.9}
        position={[0, ws / 2, 0]} />
      {upper > 0.01 && (
        <Tiled map={plaster} w={w} h={upper} color={pal.plaster} tile={2.6}
          roughness={0.85} position={[0, ws + upper / 2, 0]} />
      )}
      {/* 裙牆頂的收邊條 */}
      {upper > 0.01 && (
        <mesh position={[0, ws, 0.015]}>
          <boxGeometry args={[w, 0.06, 0.03]} />
          <meshStandardMaterial color={pal.wallTile} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

/** 燈具:亮/死/閃爍(相位由位置決定 — 決定論) */
export function Fixture({
  l,
  height,
  color,
  withPoint,
}: {
  l: LightSpec;
  height: number;
  color: THREE.Color;
  withPoint: boolean;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const point = useRef<THREE.PointLight>(null);
  const phase = useMemo(() => ((l.x * 7.31 + l.z * 3.17) % 9.7) + 9.7, [l]);
  useFrame(({ clock }) => {
    if (!l.flicker) return;
    const t = clock.elapsedTime + phase;
    const f = Math.sin(t * 13.7) * 0.5 + Math.sin(t * 7.3 + 1.7) * 0.35 + 0.55;
    const v = f > 0.42 ? 1 : 0.07;
    if (mat.current) mat.current.emissiveIntensity = 1.5 * v;
    if (point.current) point.current.intensity = 28 * v;
  });
  return (
    <group position={[l.x, 0, l.z]}>
      <mesh position={[0, height - 0.05, 0]}>
        {/* 方形嵌板(後室 Level 0 的天花板燈格) */}
        <boxGeometry args={[1.15, 0.09, 0.92]} />
        <meshStandardMaterial
          ref={mat}
          color={l.on ? '#f2ecd2' : '#2f2c20'}
          emissive={l.on ? color : BLACK}
          emissiveIntensity={l.on ? 1.5 : 0}
        />
      </mesh>
      {withPoint && (
        <pointLight
          ref={point}
          position={[0, height - 0.6, 0]}
          intensity={28}
          distance={19}
          decay={1.7}
          color={color}
        />
      )}
    </group>
  );
}

/** 天窗:天花板上的亮面 + 白色日光點光源 */
export function Skylight({
  x,
  z,
  w,
  d,
  height,
  lit,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  height: number;
  lit: boolean;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#d9ecf2" />
      </mesh>
      {/* 天窗框 */}
      <mesh position={[0, height - 0.05, 0]}>
        <boxGeometry args={[w + 0.16, 0.08, d + 0.16]} />
        <meshStandardMaterial color="#cfd8d4" roughness={0.6} />
      </mesh>
      {lit && (
        <pointLight
          position={[0, height - 1.1, 0]}
          intensity={26}
          distance={22}
          decay={1.7}
          color="#eef8ff"
        />
      )}
    </group>
  );
}

/** 高窗帶:側牆上緣的一排亮窗(白日在牆外) */
export function WindowStrip({
  wall,
  width,
  depth,
  height,
  lit,
}: {
  wall: 'east' | 'west';
  width: number;
  depth: number;
  height: number;
  lit: boolean;
}) {
  const n = Math.max(3, Math.floor(depth / 3.2));
  const x = wall === 'east' ? width / 2 - 0.02 : -width / 2 + 0.02;
  const rotY = wall === 'east' ? -Math.PI / 2 : Math.PI / 2;
  const y = height - 0.75;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const z = -depth / 2 + ((i + 0.5) * depth) / n;
        return (
          <group key={i} position={[x, y, z]} rotation={[0, rotY, 0]}>
            <mesh>
              <planeGeometry args={[1.7, 0.95]} />
              <meshBasicMaterial color="#dcedf5" />
            </mesh>
            <mesh position={[0, 0, -0.02]}>
              <boxGeometry args={[1.86, 1.1, 0.06]} />
              <meshStandardMaterial color="#d8ddd8" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
      {lit && (
        <>
          <pointLight
            position={[x * 0.8, y - 0.4, -depth / 4]}
            intensity={16}
            distance={18}
            decay={1.8}
            color="#edf7fc"
          />
          <pointLight
            position={[x * 0.8, y - 0.4, depth / 4]}
            intensity={16}
            distance={18}
            decay={1.8}
            color="#edf7fc"
          />
        </>
      )}
    </group>
  );
}

/** 門廊:凸出牆面的小玄關,盡頭是黑暗的開口 + 門縫線索光 */
export function DoorGroup({
  d,
  pal,
  mosaic,
  lit,
}: {
  d: DoorSpec;
  pal: Palette;
  mosaic: THREE.Texture;
  lit: boolean;
}) {
  const DEEP = 0.55;
  const W = 1.24;
  const H = 2.3;
  return (
    <group>
      {/* 玄關側壁/頂 */}
      <Tiled map={mosaic} w={DEEP} h={H} color={pal.wallTile} tile={0.9}
        position={[-W / 2, H / 2, DEEP / 2]} rotation={[0, Math.PI / 2, 0]} />
      <Tiled map={mosaic} w={DEEP} h={H} color={pal.wallTile} tile={0.9}
        position={[W / 2, H / 2, DEEP / 2]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh position={[0, H, DEEP / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, DEEP]} />
        <meshStandardMaterial color={pal.plaster} roughness={0.8} />
      </mesh>
      {/* 外框 */}
      <mesh position={[0, H + 0.09, DEEP / 2]}>
        <boxGeometry args={[W + 0.28, 0.18, DEEP + 0.02]} />
        <meshStandardMaterial color={pal.wallTile} roughness={0.4} />
      </mesh>
      {/* 盡頭的黑暗開口 */}
      <mesh position={[0, H / 2, 0.02]}>
        <planeGeometry args={[W - 0.08, H - 0.06]} />
        <meshBasicMaterial color="#030404" />
      </mesh>
      {/* 門縫透光:分岔預覽 */}
      <mesh position={[0, 0.035, 0.06]}>
        <planeGeometry args={[W - 0.2, 0.07]} />
        <meshBasicMaterial color={d.cue} toneMapped={false} />
      </mesh>
      {lit && (
        <pointLight
          position={[0, 0.3, 0.7]}
          intensity={2.6}
          distance={3.6}
          decay={2}
          color={d.cue}
        />
      )}
    </group>
  );
}

/** 隔間牆:室內的實體薄牆(下磚裙 + 上粉刷 + 頂收邊),逼你繞行 */
export function Partition({
  b,
  height,
  pal,
  mosaic,
}: {
  b: { x: number; z: number; w: number; d: number };
  height: number;
  pal: Palette;
  mosaic: THREE.Texture;
}) {
  const alongZ = b.d > b.w; // 沿 z 走的牆
  const len = alongZ ? b.d : b.w;
  const rotY = alongZ ? Math.PI / 2 : 0;
  const ws = Math.min(1.5, height);
  const map = useMemo(() => {
    const t = mosaic.clone();
    t.repeat.set(len / 0.9, ws / 0.9);
    t.needsUpdate = true;
    return t;
  }, [mosaic, len, ws]);
  const upper = height - ws;
  return (
    <group position={[b.x, 0, b.z]} rotation={[0, rotY, 0]}>
      {/* 實心量體(兩面皆可見) */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[len, height, Math.min(b.w, b.d)]} />
        <meshStandardMaterial color={pal.plaster} roughness={0.85} />
      </mesh>
      {/* 兩面磁磚裙牆 */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, ws / 2, (s * Math.min(b.w, b.d)) / 2 + s * 0.006]}
          rotation={[0, s < 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[len, ws]} />
          <meshStandardMaterial map={map} color={pal.wallTile} roughness={0.4} />
        </mesh>
      ))}
      {/* 頂收邊 */}
      <mesh position={[0, height - 0.05, 0]}>
        <boxGeometry args={[len + 0.08, 0.1, Math.min(b.w, b.d) + 0.08]} />
        <meshStandardMaterial color={pal.wallTile} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** 拱牆:跨過水道的整面牆,中央大拱 + 兩側走道拱 */
export function ArchWall({
  width,
  height,
  canalHalf,
  mosaic,
  pal,
  z,
}: {
  width: number;
  height: number;
  canalHalf: number;
  mosaic: THREE.Texture;
  pal: Palette;
  z: number;
}) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height);
    shape.lineTo(-width / 2, height);
    shape.closePath();

    const addArch = (cx: number, half: number, top: number) => {
      const r = half;
      const rise = Math.min(top - r, height * 0.45);
      const p = new THREE.Path();
      p.moveTo(cx - half, 0);
      p.lineTo(cx - half, rise);
      p.absarc(cx, rise, r, Math.PI, 0, true);
      p.lineTo(cx + half, 0);
      p.closePath();
      shape.holes.push(p);
    };
    // 中央大拱(水道)
    addArch(0, canalHalf + 0.35, height * 0.72);
    // 兩側走道拱
    const ledgeMid = (canalHalf + width / 2) / 2;
    const ledgeHalf = (width / 2 - canalHalf) * 0.32;
    addArch(-ledgeMid, ledgeHalf, height * 0.55);
    addArch(ledgeMid, ledgeHalf, height * 0.55);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.45,
      bevelEnabled: false,
    });
    g.translate(0, 0, -0.225);
    return g;
  }, [width, height, canalHalf]);

  const map = useMemo(() => {
    const t = mosaic.clone();
    t.repeat.set(1 / 0.9, 1 / 0.9);
    t.needsUpdate = true;
    return t;
  }, [mosaic]);

  return (
    <mesh geometry={geo} position={[0, 0, z]}>
      <meshStandardMaterial map={map} color={pal.wallTile} roughness={0.45} />
    </mesh>
  );
}

/** 欄杆:沿水道邊的鉻管 */
export function Railing({
  x,
  z,
  length,
}: {
  x: number;
  z: number;
  length: number;
}) {
  const posts = Math.max(2, Math.floor(length / 2.2));
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, length, 8]} />
        <meshStandardMaterial color="#dfe5e2" roughness={0.25} metalness={0.85} />
      </mesh>
      {Array.from({ length: posts }, (_, i) => (
        <mesh key={i}
          position={[0, 0.46, -length / 2 + ((i + 0.5) * length) / posts]}>
          <cylinderGeometry args={[0.022, 0.022, 0.92, 8]} />
          <meshStandardMaterial color="#cfd6d2" roughness={0.3} metalness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** 池畔扶梯 */
export function Ladder(props: { position: [number, number, number]; rotY: number }) {
  return (
    <group position={props.position} rotation={[0, props.rotY, 0]}>
      {[-0.22, 0.22].map((ox) => (
        <mesh key={ox} position={[ox, 0.45, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.9, 10]} />
          <meshStandardMaterial color="#e2e8e5" roughness={0.2} metalness={0.9} />
        </mesh>
      ))}
      {[0.2, -0.15, -0.5].map((oy) => (
        <mesh key={oy} position={[0, oy + 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.024, 0.024, 0.44, 8]} />
          <meshStandardMaterial color="#d5dcd8" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** 滑水道:紅色管道滑進池裡 */
export function Slide(props: { position: [number, number, number]; rotY: number }) {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.0, 2.4),
      new THREE.Vector3(0.3, 2.2, 1.4),
      new THREE.Vector3(0.9, 1.2, 0.5),
      new THREE.Vector3(1.6, 0.45, -0.4),
    ]);
    return new THREE.TubeGeometry(curve, 28, 0.36, 12, false);
  }, []);
  return (
    <group position={props.position} rotation={[0, props.rotY, 0]}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#c23b30" roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* 支撐腳 */}
      <mesh position={[0, 1.5, 2.4]}>
        <cylinderGeometry args={[0.07, 0.07, 3.0, 10]} />
        <meshStandardMaterial color="#d8dedb" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0.9, 0.6, 0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 1.2, 10]} />
        <meshStandardMaterial color="#d8dedb" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** 疊起來的泳池椅(儲藏間) */
export function ChairStack(props: { position: [number, number, number]; rotY: number }) {
  const n = 5;
  return (
    <group position={props.position} rotation={[0, props.rotY, 0]}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[0, i * 0.24, i * 0.02]}
          rotation={[0, (i % 2) * 0.06 - 0.03, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.52, 0.05, 0.5]} />
            <meshStandardMaterial color="#f4f4ee" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.66, -0.26]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.52, 0.55, 0.05]} />
            <meshStandardMaterial color="#f4f4ee" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.46, 0.38, 0.44]} />
            <meshStandardMaterial color="#e4e4dc" roughness={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 黃色小鴨 */
export function Duck(props: { position: [number, number, number]; rotY: number }) {
  return (
    <group position={props.position} rotation={[0, props.rotY, 0]} scale={0.32}>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.5, 14, 12]} />
        <meshStandardMaterial color="#ffd23e" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.85, 0.28]}>
        <sphereGeometry args={[0.3, 12, 10]} />
        <meshStandardMaterial color="#ffd23e" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.8, 0.56]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.22, 8]} />
        <meshStandardMaterial color="#e8862e" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** 身影:永遠面向你;phase 模式忽隱忽現 + 眼角餘光效應 */
export function Figure({
  f,
  seed,
  y = 0,
}: {
  f: FigureSpec;
  seed: number;
  y?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#020202',
        roughness: 0.98,
        transparent: f.mode === 'phase',
        opacity: f.mode === 'phase' ? 0 : 1,
      }),
    [f.mode],
  );
  const phase = useMemo(() => (seed % 997) * 0.37, [seed]);
  const tmp = useMemo(
    () => ({ dir: new THREE.Vector3(), toF: new THREE.Vector3() }),
    [],
  );
  useFrame(({ camera, clock }) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y = Math.atan2(
      camera.position.x - f.x,
      camera.position.z - f.z,
    );
    if (f.mode !== 'phase') return;
    const t = clock.elapsedTime + phase;
    const flutter = Math.max(
      0,
      Math.sin(t * 0.7) * 0.5 + Math.sin(t * 2.3 + 1.1) * 0.3 + 0.25,
    );
    camera.getWorldDirection(tmp.dir);
    tmp.toF.set(f.x - camera.position.x, 0, f.z - camera.position.z).normalize();
    const facing = Math.max(0, tmp.dir.x * tmp.toF.x + tmp.dir.z * tmp.toF.z);
    mat.opacity = 0.42 * flutter * (1 - facing * 0.85);
  });
  return (
    <group ref={group} position={[f.x, y, f.z]}>
      <mesh position={[0, 0.62, 0]} material={mat}>
        <cylinderGeometry args={[0.13, 0.2, 1.24, 10]} />
      </mesh>
      <mesh position={[0, 1.36, 0]} material={mat}>
        <sphereGeometry args={[0.135, 12, 10]} />
      </mesh>
    </group>
  );
}

/** 焦散:牆面/地面上緩慢流動的水光網(淹水室) */
export function Caustics({
  width,
  depth,
  height,
}: {
  width: number;
  depth: number;
  height: number;
}) {
  const tex1 = useMemo(() => {
    const t = makeCausticsTexture().clone();
    t.repeat.set(width / 4, height / 4);
    t.needsUpdate = true;
    return t;
  }, [width, height]);
  const tex2 = useMemo(() => {
    const t = makeCausticsTexture().clone();
    t.repeat.set(width / 6.3, height / 6.3);
    t.needsUpdate = true;
    return t;
  }, [width, height]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    tex1.offset.set(t * 0.014, Math.sin(t * 0.18) * 0.05);
    tex2.offset.set(-t * 0.01, Math.cos(t * 0.14) * 0.04);
  });
  const mat = (tex: THREE.Texture, opacity: number) => (
    <meshBasicMaterial
      map={tex}
      transparent
      opacity={opacity}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
    />
  );
  const walls: {
    pos: [number, number, number];
    rot: [number, number, number];
    w: number;
  }[] = [
    { pos: [0, height / 2, -depth / 2 + 0.03], rot: [0, 0, 0], w: width },
    { pos: [0, height / 2, depth / 2 - 0.03], rot: [0, Math.PI, 0], w: width },
    { pos: [-width / 2 + 0.03, height / 2, 0], rot: [0, Math.PI / 2, 0], w: depth },
    { pos: [width / 2 - 0.03, height / 2, 0], rot: [0, -Math.PI / 2, 0], w: depth },
  ];
  return (
    <group>
      {walls.map((wl, i) => (
        <mesh key={i} position={wl.pos} rotation={wl.rot}>
          <planeGeometry args={[wl.w, height]} />
          {mat(i % 2 ? tex1 : tex2, 0.16)}
        </mesh>
      ))}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        {mat(tex2, 0.13)}
      </mesh>
    </group>
  );
}
