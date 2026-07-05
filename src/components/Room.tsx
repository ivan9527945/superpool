'use client';

// 房間 = spec 的純渲染。real 與 mirror 兩個變體共用同一個元件 —
// 「倒影裡的房間」只是拿另一個 seed 生成的同構空間。

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { FigureSpec, LightSpec, RoomSpec } from '@/core/room';
import { makeTileTexture } from '@/core/textures';

const TILE = 0.62;
const BLACK = new THREE.Color('#000000');

// 身影:靜止的黑色剪影。它不追、不動 — 但永遠面向你。
// phase 模式 = 滲入中的殘影:半透明、低頻不規則地忽隱忽現,
// 而且你的視線越正對它越淡(眼角餘光效應),轉頭直視 → 幾乎不在。
function Figure({ f, seed }: { f: FigureSpec; seed: number }) {
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
    // 水平鏡射不改 x/z,面向主相機 = 也面向倒影裡的虛擬相機
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
    tmp.toF
      .set(f.x - camera.position.x, 0, f.z - camera.position.z)
      .normalize();
    const facing = Math.max(
      0,
      tmp.dir.x * tmp.toF.x + tmp.dir.z * tmp.toF.z,
    );
    mat.opacity = 0.42 * flutter * (1 - facing * 0.85);
  });
  return (
    <group ref={group} position={[f.x, 0, f.z]}>
      <mesh position={[0, 0.62, 0]} material={mat}>
        <cylinderGeometry args={[0.13, 0.2, 1.24, 10]} />
      </mesh>
      <mesh position={[0, 1.36, 0]} material={mat}>
        <sphereGeometry args={[0.135, 12, 10]} />
      </mesh>
    </group>
  );
}

// 燈具:亮/死/閃爍。閃爍相位由燈的位置決定(決定論,鏡像分支自己閃自己的)
function Fixture({
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
    const f =
      Math.sin(t * 13.7) * 0.5 + Math.sin(t * 7.3 + 1.7) * 0.35 + 0.55;
    const v = f > 0.42 ? 1 : 0.07;
    if (mat.current) mat.current.emissiveIntensity = 1.4 * v;
    if (point.current) point.current.intensity = 34 * v;
  });
  return (
    <group position={[l.x, 0, l.z]}>
      <mesh position={[0, height - 0.05, 0]}>
        <boxGeometry args={[1.25, 0.09, 0.48]} />
        <meshStandardMaterial
          ref={mat}
          color={l.on ? '#e8e2cf' : '#262a25'}
          emissive={l.on ? color : BLACK}
          emissiveIntensity={l.on ? 1.4 : 0}
        />
      </mesh>
      {withPoint && (
        <pointLight
          ref={point}
          position={[0, height - 0.6, 0]}
          intensity={34}
          distance={18}
          decay={1.7}
          color={color}
        />
      )}
    </group>
  );
}

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
  const litSet = useMemo(
    () => new Set(spec.lights.filter((l) => l.on).slice(0, 3)),
    [spec],
  );

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

      {/* 燈具:亮/死/閃爍由 seed + D 決定;前三盞亮燈掛真實點光源 */}
      {spec.lights.map((l, i) => (
        <Fixture key={i} l={l} height={height} color={cols.lightOn}
          withPoint={litSet.has(l)} />
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

      {/* 不該有的門:側牆上的黑洞。沒有光、沒有框、沒有去處 */}
      {spec.fakeDoors.map((f, i) => (
        <group
          key={i}
          position={[f.wall === 'east' ? width / 2 : -width / 2, 0, f.z]}
          rotation={[0, f.wall === 'east' ? -Math.PI / 2 : Math.PI / 2, 0]}
        >
          <mesh position={[0, 1.05, 0.03]}>
            <planeGeometry args={[1.0, 2.1]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
        </group>
      ))}

      {/* 身影 */}
      {spec.figure && <Figure f={spec.figure} seed={spec.seed} />}

      {/* 道具 */}
      {spec.props.map((p, i) => {
        if (p.kind === 'chair') {
          return (
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
          );
        }
        if (p.kind === 'bench') {
          return (
            <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]}>
              <mesh position={[0, 0.42, 0]}>
                <boxGeometry args={[1.8, 0.07, 0.36]} />
                <meshStandardMaterial color="#9a8f78" roughness={0.7} />
              </mesh>
              <mesh position={[-0.7, 0.2, 0]}>
                <boxGeometry args={[0.08, 0.4, 0.32]} />
                <meshStandardMaterial color="#6f6a5c" roughness={0.8} />
              </mesh>
              <mesh position={[0.7, 0.2, 0]}>
                <boxGeometry args={[0.08, 0.4, 0.32]} />
                <meshStandardMaterial color="#6f6a5c" roughness={0.8} />
              </mesh>
            </group>
          );
        }
        if (p.kind === 'locker') {
          return (
            <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]}>
              {[-0.62, 0, 0.62].map((ox) => (
                <mesh key={ox} position={[ox, 0.95, 0]}>
                  <boxGeometry args={[0.58, 1.9, 0.45]} />
                  <meshStandardMaterial
                    color="#5f7a6e"
                    roughness={0.45}
                    metalness={0.35}
                  />
                </mesh>
              ))}
            </group>
          );
        }
        return (
          <mesh key={i} position={[p.x, 0.06, p.z]} rotation={[-Math.PI / 2, 0, p.rotY]}>
            <torusGeometry args={[0.42, 0.11, 10, 24]} />
            <meshStandardMaterial color="#8a4038" roughness={0.6} />
          </mesh>
        );
      })}

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
