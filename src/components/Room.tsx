'use client';

// 房間 = spec 的純渲染,依原型組裝零件。
// real 與 mirror 變體共用;ghost < 1 時整層半透明(疊加態)。

import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { doorAnchor, type RoomSpec } from '@/core/room';
import {
  makeMosaicTexture,
  makeTileTexture,
  makePlasterTexture,
} from '@/core/textures';
import {
  Tiled,
  Wall,
  Fixture,
  Skylight,
  WindowStrip,
  DoorGroup,
  Partition,
  ArchWall,
  Railing,
  Ladder,
  Slide,
  ChairStack,
  Duck,
  Figure,
  Caustics,
  type Palette,
} from './room/parts';

export default function Room({
  spec,
  variant = 'real',
  ghost = 1,
  lit = true,
}: {
  spec: RoomSpec;
  variant?: 'real' | 'mirror';
  ghost?: number;
  lit?: boolean;
}) {
  const mosaic = useMemo(() => makeMosaicTexture(), []);
  const tile = useMemo(() => makeTileTexture(), []);
  const plaster = useMemo(() => makePlasterTexture(), []);
  const { width, depth, height, blend, archetype } = spec;
  const groupRef = useRef<THREE.Group>(null);

  // 疊加態:整層材質半透明(材質實例都是這棵子樹私有的)
  useEffect(() => {
    if (ghost >= 1 || !groupRef.current) return;
    groupRef.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.Material & { opacity: number };
      m.transparent = true;
      m.opacity = Math.min(m.opacity, ghost);
      m.depthWrite = false;
    });
  }, [ghost, spec]);

  // 後室 Level 0 黃:基底就是黃的(不等 blend),D 越高越髒越暗
  const pal: Palette = useMemo(
    () => ({
      wallTile: new THREE.Color('#d6c887').lerp(new THREE.Color('#a8925a'), blend),
      plaster: new THREE.Color('#ddd092').lerp(new THREE.Color('#b09a55'), blend),
      floor: new THREE.Color('#c9ba76').lerp(new THREE.Color('#96854e'), blend),
      basin: new THREE.Color('#c3bd80').lerp(new THREE.Color('#8f854f'), blend),
      ceil: new THREE.Color('#cfc37e').lerp(new THREE.Color('#8d7f4e'), blend),
      lightOn: new THREE.Color('#fff3c9').lerp(new THREE.Color('#ffd54f'), blend * 0.6),
      amb: new THREE.Color('#ded08d').lerp(new THREE.Color('#9c8b4d'), blend),
    }),
    [blend],
  );

  const litSet = useMemo(
    () => new Set(spec.lights.filter((l) => l.on).slice(0, 3)),
    [spec],
  );

  const bright = archetype === 'poolhall' || archetype === 'arcade';
  const flooded = spec.floodLevel != null;
  const w0 = spec.water[0];

  return (
    <group ref={groupRef}>
      {lit && (
        <>
          <ambientLight
            intensity={(bright ? 0.52 : flooded ? 0.55 : 0.48) - blend * 0.25}
            color={flooded ? new THREE.Color('#a4bd7a') : pal.amb}
          />
          {bright && (
            <hemisphereLight
              intensity={0.28 - blend * 0.15}
              color="#f4ecc8"
              groundColor="#9c8d55"
            />
          )}
        </>
      )}

      {/* ── 地板 */}
      {w0 && !flooded ? (
        <>
          <Tiled map={tile} w={width} h={w0.z - w0.d / 2 + depth / 2}
            color={pal.floor} roughness={0.24}
            position={[0, 0, (-depth / 2 + w0.z - w0.d / 2) / 2]}
            rotation={[-Math.PI / 2, 0, 0]} />
          <Tiled map={tile} w={width} h={depth / 2 - (w0.z + w0.d / 2)}
            color={pal.floor} roughness={0.24}
            position={[0, 0, (w0.z + w0.d / 2 + depth / 2) / 2]}
            rotation={[-Math.PI / 2, 0, 0]} />
          <Tiled map={tile} w={w0.x - w0.w / 2 + width / 2} h={w0.d}
            color={pal.floor} roughness={0.24}
            position={[(-width / 2 + w0.x - w0.w / 2) / 2, 0, w0.z]}
            rotation={[-Math.PI / 2, 0, 0]} />
          <Tiled map={tile} w={width / 2 - (w0.x + w0.w / 2)} h={w0.d}
            color={pal.floor} roughness={0.24}
            position={[(w0.x + w0.w / 2 + width / 2) / 2, 0, w0.z]}
            rotation={[-Math.PI / 2, 0, 0]} />
        </>
      ) : (
        <Tiled map={tile} w={width} h={depth} color={pal.floor}
          roughness={0.24} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      )}

      {/* ── 池體(有深度的水域) */}
      {w0 && spec.basinDepth > 0 && (
        <group>
          <Tiled map={mosaic} w={w0.w} h={w0.d} color={pal.basin} tile={0.9}
            position={[w0.x, -spec.basinDepth, w0.z]} rotation={[-Math.PI / 2, 0, 0]} />
          <Tiled map={mosaic} w={w0.w} h={spec.basinDepth} color={pal.basin} tile={0.9}
            position={[w0.x, -spec.basinDepth / 2, w0.z - w0.d / 2]} />
          <Tiled map={mosaic} w={w0.w} h={spec.basinDepth} color={pal.basin} tile={0.9}
            position={[w0.x, -spec.basinDepth / 2, w0.z + w0.d / 2]}
            rotation={[0, Math.PI, 0]} />
          <Tiled map={mosaic} w={w0.d} h={spec.basinDepth} color={pal.basin} tile={0.9}
            position={[w0.x - w0.w / 2, -spec.basinDepth / 2, w0.z]}
            rotation={[0, Math.PI / 2, 0]} />
          <Tiled map={mosaic} w={w0.d} h={spec.basinDepth} color={pal.basin} tile={0.9}
            position={[w0.x + w0.w / 2, -spec.basinDepth / 2, w0.z]}
            rotation={[0, -Math.PI / 2, 0]} />
          {/* 池緣收邊 */}
          {archetype === 'poolhall' && (
            <>
              <mesh position={[w0.x, 0.035, w0.z - w0.d / 2 - 0.17]}>
                <boxGeometry args={[w0.w + 0.68, 0.07, 0.34]} />
                <meshStandardMaterial color="#e9e2c0" roughness={0.3} />
              </mesh>
              <mesh position={[w0.x, 0.035, w0.z + w0.d / 2 + 0.17]}>
                <boxGeometry args={[w0.w + 0.68, 0.07, 0.34]} />
                <meshStandardMaterial color="#e9e2c0" roughness={0.3} />
              </mesh>
              <mesh position={[w0.x - w0.w / 2 - 0.17, 0.035, w0.z]}>
                <boxGeometry args={[0.34, 0.07, w0.d]} />
                <meshStandardMaterial color="#e9e2c0" roughness={0.3} />
              </mesh>
              <mesh position={[w0.x + w0.w / 2 + 0.17, 0.035, w0.z]}>
                <boxGeometry args={[0.34, 0.07, w0.d]} />
                <meshStandardMaterial color="#e9e2c0" roughness={0.3} />
              </mesh>
            </>
          )}
        </group>
      )}

      {/* ── 四面牆(兩段式) */}
      <Wall mosaic={mosaic} plaster={plaster} w={width} height={height}
        wainscot={spec.wainscot} pal={pal}
        position={[0, 0, -depth / 2]} />
      <Wall mosaic={mosaic} plaster={plaster} w={width} height={height}
        wainscot={spec.wainscot} pal={pal}
        position={[0, 0, depth / 2]} rotation={[0, Math.PI, 0]} />
      <Wall mosaic={mosaic} plaster={plaster} w={depth} height={height}
        wainscot={spec.wainscot} pal={pal}
        position={[-width / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Wall mosaic={mosaic} plaster={plaster} w={depth} height={height}
        wainscot={spec.wainscot} pal={pal}
        position={[width / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* ── 天花板 */}
      <Tiled map={plaster} w={width} h={depth} color={pal.ceil} tile={2.6}
        roughness={0.9} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} />

      {/* 天花板橫樑(泳池廳的結構感) */}
      {archetype === 'poolhall' &&
        Array.from({ length: Math.floor(depth / 4.5) }, (_, i) => (
          <mesh key={i}
            position={[0, height - 0.14, -depth / 2 + (i + 1) * 4.5]}>
            <boxGeometry args={[width, 0.28, 0.3]} />
            <meshStandardMaterial color={pal.ceil} roughness={0.85} />
          </mesh>
        ))}

      {/* ── 拱牆(拱廊) */}
      {spec.arches.map((z, i) => (
        <ArchWall key={i} width={width} height={height}
          canalHalf={spec.canalHalf} mosaic={mosaic} pal={pal} z={z} />
      ))}
      {archetype === 'arcade' && w0 && (
        <>
          <Railing x={-(spec.canalHalf + 0.28)} z={w0.z} length={w0.d - 1} />
          <Railing x={spec.canalHalf + 0.28} z={w0.z} length={w0.d - 1} />
        </>
      )}

      {/* ── 天窗與高窗 */}
      {spec.skylights.map((s, i) => (
        <Skylight key={i} {...s} height={height} lit={lit} />
      ))}
      {spec.windowWall && (
        <WindowStrip wall={spec.windowWall} width={width} depth={depth}
          height={height} lit={lit} />
      )}

      {/* ── 燈具 */}
      {spec.lights.map((l, i) => (
        <Fixture key={i} l={l} height={height} color={pal.lightOn}
          withPoint={lit && litSet.has(l)} />
      ))}

      {/* ── 柱(含柱頭柱腳) */}
      {spec.columns.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, 0, c.tilt]}>
          <mesh position={[0, height / 2, 0]}>
            <boxGeometry args={[0.44, height, 0.44]} />
            <meshStandardMaterial color={pal.wallTile} roughness={0.5} />
          </mesh>
          <mesh position={[0, height - 0.15, 0]}>
            <boxGeometry args={[0.6, 0.3, 0.6]} />
            <meshStandardMaterial color={pal.plaster} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.58, 0.2, 0.58]} />
            <meshStandardMaterial color={pal.wallTile} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ── 壁龕(淺凹版:深色內襯 + 框) */}
      {spec.niches.map((n, i) => (
        <group key={i}
          position={[n.wall === 'east' ? width / 2 - 0.02 : -width / 2 + 0.02, 0, n.z]}
          rotation={[0, n.wall === 'east' ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh position={[0, n.h / 2 + 0.2, 0]}>
            <planeGeometry args={[n.w, n.h]} />
            <meshStandardMaterial color="#131a18" roughness={0.9} />
          </mesh>
          <mesh position={[0, n.h + 0.26, 0.02]}>
            <boxGeometry args={[n.w + 0.16, 0.12, 0.06]} />
            <meshStandardMaterial color={pal.wallTile} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ── 隔間牆(逼你繞行、轉彎) */}
      {spec.barriers.map((b, i) => (
        <Partition key={i} b={b} height={height} pal={pal} mosaic={mosaic} />
      ))}

      {/* ── 門(散落四面牆的玄關們) */}
      {spec.doors.map((d) => {
        const a = doorAnchor(spec, d);
        return (
          <group key={d.index} position={[a.x, 0, a.z]} rotation={[0, a.rotY, 0]}>
            <DoorGroup d={d} pal={pal} mosaic={mosaic} lit={lit} />
          </group>
        );
      })}

      {/* ── 不該有的門 */}
      {spec.fakeDoors.map((f, i) => (
        <group key={i}
          position={[f.wall === 'east' ? width / 2 : -width / 2, 0, f.z]}
          rotation={[0, f.wall === 'east' ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh position={[0, 1.05, 0.03]}>
            <planeGeometry args={[1.0, 2.1]} />
            <meshBasicMaterial color="#020202" />
          </mesh>
        </group>
      ))}

      {/* ── 淹水室:水面(上下皆可見)+ 焦散 */}
      {flooded && (
        <>
          <mesh position={[0, spec.floodLevel!, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial
              color="#8fd8cf"
              transparent
              opacity={0.34}
              roughness={0.15}
              metalness={0.25}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <Caustics width={width} depth={depth} height={height} />
        </>
      )}

      {/* ── 身影(淹水室:懸浮在水中) */}
      {spec.figure && (
        <Figure f={spec.figure} seed={spec.seed}
          y={flooded ? spec.floodLevel! * 0.4 : 0} />
      )}

      {/* ── 道具 */}
      {spec.props.map((p, i) => {
        const floatY = flooded ? spec.floodLevel! - 0.16 : 0;
        switch (p.kind) {
          case 'ladder':
            return <Ladder key={i} position={[p.x, 0.35, p.z]} rotY={p.rotY} />;
          case 'slide':
            return <Slide key={i} position={[p.x, 0, p.z]} rotY={p.rotY} />;
          case 'chairstack':
            return <ChairStack key={i} position={[p.x, 0, p.z]} rotY={p.rotY} />;
          case 'duck': {
            const y = flooded
              ? spec.floodLevel! + 0.02
              : spec.mirrorWater && archetype !== 'storage'
                ? spec.mirrorWater.y + 0.02
                : 0.02;
            const pos: [number, number, number] =
              archetype === 'poolhall' && spec.mirrorWater
                ? [p.x, y, p.z]
                : [p.x, y, p.z];
            return <Duck key={i} position={pos} rotY={p.rotY} />;
          }
          case 'chair':
            return (
              <group key={i} position={[p.x, floatY, p.z]}
                rotation={[flooded ? 0.12 : 0, p.rotY, flooded ? -0.08 : 0]}>
                <mesh position={[0, 0.42, 0]}>
                  <boxGeometry args={[0.5, 0.06, 0.5]} />
                  <meshStandardMaterial color="#f0f0e8" roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.72, -0.24]}>
                  <boxGeometry args={[0.5, 0.7, 0.06]} />
                  <meshStandardMaterial color="#f0f0e8" roughness={0.35} />
                </mesh>
                <mesh position={[0, 0.2, 0]}>
                  <boxGeometry args={[0.44, 0.4, 0.44]} />
                  <meshStandardMaterial color="#e0e0d6" roughness={0.5} />
                </mesh>
              </group>
            );
          case 'bench':
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
          case 'locker':
            return (
              <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rotY, 0]}>
                {[-0.62, 0, 0.62].map((ox) => (
                  <mesh key={ox} position={[ox, 0.95, 0]}>
                    <boxGeometry args={[0.58, 1.9, 0.45]} />
                    <meshStandardMaterial color="#5f7a6e" roughness={0.45}
                      metalness={0.35} />
                  </mesh>
                ))}
              </group>
            );
          default:
            return (
              <mesh key={i} position={[p.x, 0.06, p.z]}
                rotation={[-Math.PI / 2, 0, p.rotY]}>
                <torusGeometry args={[0.42, 0.11, 10, 24]} />
                <meshStandardMaterial color="#8a4038" roughness={0.6} />
              </mesh>
            );
        }
      })}

      {/* ── 鏡像分支自己的靜水(死寂;它的宇宙沒有你攪動它) */}
      {variant === 'mirror' && spec.mirrorWater && !flooded && (
        <mesh
          position={[spec.mirrorWater.x, spec.mirrorWater.y - 0.03, spec.mirrorWater.z]}
          rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[spec.mirrorWater.w, spec.mirrorWater.d]} />
          <meshStandardMaterial color="#04100e" roughness={0.18} metalness={0.5} />
        </mesh>
      )}
    </group>
  );
}
