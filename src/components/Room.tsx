'use client';

// 房間 = spec 的純渲染。real 與 mirror 兩個變體共用同一個元件 —
// 「倒影裡的房間」只是拿另一個 seed 生成的同構空間。

import * as THREE from 'three';
import { useMemo } from 'react';
import type { RoomSpec } from '@/core/room';
import { makeTileTexture } from '@/core/textures';

const TILE = 0.62;
const BLACK = new THREE.Color('#000000');

function Tiled(props: {
  base: THREE.Texture;
  w: number;
  h: number;
  color: THREE.Color;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const { base, w, h, color, position, rotation } = props;
  const map = useMemo(() => {
    const t = base.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / TILE, h / TILE);
    t.needsUpdate = true;
    return t;
  }, [base, w, h]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} color={color} roughness={0.42} metalness={0.02} />
    </mesh>
  );
}

export default function Room({
  spec,
  variant = 'real',
}: {
  spec: RoomSpec;
  variant?: 'real' | 'mirror';
}) {
  const base = useMemo(() => makeTileTexture(), []);
  const { width, depth, height, pool, blend, basinDepth } = spec;

  const cols = useMemo(
    () => ({
      wall: new THREE.Color('#d9ece6').lerp(new THREE.Color('#cfbc7a'), blend),
      floor: new THREE.Color('#bed6d0').lerp(new THREE.Color('#b3a468'), blend),
      basin: new THREE.Color('#a5cdc6').lerp(new THREE.Color('#a2955f'), blend),
      ceil: new THREE.Color('#7c8d89').lerp(new THREE.Color('#7d7355'), blend),
      lightOn: new THREE.Color('#fff3d6').lerp(new THREE.Color('#ffd54f'), blend * 0.6),
      amb: new THREE.Color('#9fc4c9').lerp(new THREE.Color('#b39e55'), blend),
    }),
    [blend],
  );

  const px0 = pool.x - pool.w / 2;
  const px1 = pool.x + pool.w / 2;
  const pz0 = pool.z - pool.d / 2;
  const pz1 = pool.z + pool.d / 2;
  const litLights = useMemo(() => spec.lights.filter((l) => l.on).slice(0, 3), [spec]);

  return (
    <group>
      <ambientLight intensity={0.55 - blend * 0.25} color={cols.amb} />

      {/* 地板(四塊,繞開泳池) */}
      <Tiled base={base} w={width} h={pz0 + depth / 2} color={cols.floor}
        position={[0, 0, (-depth / 2 + pz0) / 2]} rotation={[-Math.PI / 2, 0, 0]} />
      <Tiled base={base} w={width} h={depth / 2 - pz1} color={cols.floor}
        position={[0, 0, (pz1 + depth / 2) / 2]} rotation={[-Math.PI / 2, 0, 0]} />
      <Tiled base={base} w={px0 + width / 2} h={pool.d} color={cols.floor}
        position={[(-width / 2 + px0) / 2, 0, pool.z]} rotation={[-Math.PI / 2, 0, 0]} />
      <Tiled base={base} w={width / 2 - px1} h={pool.d} color={cols.floor}
        position={[(px1 + width / 2) / 2, 0, pool.z]} rotation={[-Math.PI / 2, 0, 0]} />

      {/* 池體 */}
      <Tiled base={base} w={pool.w} h={pool.d} color={cols.basin}
        position={[pool.x, -basinDepth, pool.z]} rotation={[-Math.PI / 2, 0, 0]} />
      <Tiled base={base} w={pool.w} h={basinDepth} color={cols.basin}
        position={[pool.x, -basinDepth / 2, pz0]} rotation={[0, 0, 0]} />
      <Tiled base={base} w={pool.w} h={basinDepth} color={cols.basin}
        position={[pool.x, -basinDepth / 2, pz1]} rotation={[0, Math.PI, 0]} />
      <Tiled base={base} w={pool.d} h={basinDepth} color={cols.basin}
        position={[px0, -basinDepth / 2, pool.z]} rotation={[0, Math.PI / 2, 0]} />
      <Tiled base={base} w={pool.d} h={basinDepth} color={cols.basin}
        position={[px1, -basinDepth / 2, pool.z]} rotation={[0, -Math.PI / 2, 0]} />

      {/* 四面牆 */}
      <Tiled base={base} w={width} h={height} color={cols.wall}
        position={[0, height / 2, -depth / 2]} rotation={[0, 0, 0]} />
      <Tiled base={base} w={width} h={height} color={cols.wall}
        position={[0, height / 2, depth / 2]} rotation={[0, Math.PI, 0]} />
      <Tiled base={base} w={depth} h={height} color={cols.wall}
        position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Tiled base={base} w={depth} h={height} color={cols.wall}
        position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* 天花板 */}
      <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={cols.ceil} roughness={0.9} />
      </mesh>

      {/* 燈具:亮/死由 seed + D 決定 */}
      {spec.lights.map((l, i) => (
        <mesh key={i} position={[l.x, height - 0.05, l.z]}>
          <boxGeometry args={[1.25, 0.09, 0.48]} />
          <meshStandardMaterial
            color={l.on ? '#e8e2cf' : '#262a25'}
            emissive={l.on ? cols.lightOn : BLACK}
            emissiveIntensity={l.on ? 1.4 : 0}
          />
        </mesh>
      ))}
      {litLights.map((l, i) => (
        <pointLight key={i} position={[l.x, height - 0.6, l.z]}
          intensity={34} distance={18} decay={1.7} color={cols.lightOn} />
      ))}

      {/* 池邊柱 */}
      {spec.columns.map((c, i) => (
        <mesh key={i} position={[c.x, height / 2, c.z]} rotation={[0, 0, c.tilt]}>
          <boxGeometry args={[0.42, height, 0.42]} />
          <meshStandardMaterial color={cols.wall} roughness={0.5} />
        </mesh>
      ))}

      {/* 門 + 分岔預覽線索(門縫透光) */}
      {spec.doors.map((d) => (
        <group key={d.index} position={[d.x, 0, -depth / 2]}>
          <mesh position={[0, 1.1, 0.02]}>
            <planeGeometry args={[1.12, 2.2]} />
            <meshBasicMaterial color="#040404" />
          </mesh>
          <mesh position={[-0.63, 1.16, 0.06]}>
            <boxGeometry args={[0.14, 2.32, 0.16]} />
            <meshStandardMaterial color={cols.wall} roughness={0.4} />
          </mesh>
          <mesh position={[0.63, 1.16, 0.06]}>
            <boxGeometry args={[0.14, 2.32, 0.16]} />
            <meshStandardMaterial color={cols.wall} roughness={0.4} />
          </mesh>
          <mesh position={[0, 2.36, 0.06]}>
            <boxGeometry args={[1.4, 0.14, 0.16]} />
            <meshStandardMaterial color={cols.wall} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.035, 0.045]}>
            <planeGeometry args={[1.04, 0.07]} />
            <meshBasicMaterial color={d.cue} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0.28, 0.5]}
            intensity={2.4} distance={3.4} decay={2} color={d.cue} />
        </group>
      ))}

      {/* 身影:靜止的黑色剪影 — 它不追、不動;威脅只是「它在」 */}
      {spec.figure && (
        <group position={[spec.figure.x, 0, spec.figure.z]} rotation={[0.02, 0.15, 0.03]}>
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.13, 0.2, 1.24, 10]} />
            <meshStandardMaterial color="#020202" roughness={0.98} />
          </mesh>
          <mesh position={[0, 1.36, 0]}>
            <sphereGeometry args={[0.135, 12, 10]} />
            <meshStandardMaterial color="#020202" roughness={0.98} />
          </mesh>
        </group>
      )}

      {/* 道具 */}
      {spec.props.map((p, i) =>
        p.kind === 'chair' ? (
          <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]}>
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[0.5, 0.06, 0.5]} />
              <meshStandardMaterial color="#e6e3da" roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.72, -0.24]}>
              <boxGeometry args={[0.5, 0.7, 0.06]} />
              <meshStandardMaterial color="#e6e3da" roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.44, 0.4, 0.44]} />
              <meshStandardMaterial color="#cfccc2" roughness={0.5} />
            </mesh>
          </group>
        ) : (
          <mesh key={i} position={[p.x, 0.06, p.z]} rotation={[-Math.PI / 2, 0, p.rotY]}>
            <torusGeometry args={[0.42, 0.11, 10, 24]} />
            <meshStandardMaterial color="#8a4038" roughness={0.6} />
          </mesh>
        ),
      )}

      {/* 鏡像分支自己的水面:死寂的暗色靜水(它的宇宙沒有你攪動它) */}
      {variant === 'mirror' && (
        <mesh position={[pool.x, spec.waterY - 0.03, pool.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[pool.w, pool.d]} />
          <meshStandardMaterial color="#03100e" roughness={0.2} metalness={0.5} />
        </mesh>
      )}
    </group>
  );
}
