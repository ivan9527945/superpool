'use client';

// 組裝:Canvas + 分岔迴圈。
// 真實房間 = generateRoomSpec(branchId),鏡像房間 = generateRoomSpec(mirrorSeed)。
// 霧色/背景/音訊全部即時綁 D。

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useStore } from '@/core/store';
import { generateRoomSpec } from '@/core/room';
import { mirrorSeed, clamp01 } from '@/core/prng';
import { setAudioDivergence } from '@/core/audio';
import Room from './Room';
import Pool from './Pool';
import Player from './Player';
import Effects from './Effects';
import Hud from './Hud';

export default function Experience() {
  const branchId = useStore((s) => s.branchId);
  const D = useStore((s) => s.D);
  const started = useStore((s) => s.started);

  const spec = useMemo(() => generateRoomSpec(branchId, D), [branchId, D]);
  const mirror = useMemo(
    () =>
      generateRoomSpec(mirrorSeed(branchId), clamp01(D + 0.1), {
        figureChance: 0.22 + D * 0.5,
      }),
    [branchId, D],
  );
  const fogColor = useMemo(
    () => new THREE.Color('#0c2124').lerp(new THREE.Color('#251d09'), D),
    [D],
  );

  useEffect(() => {
    setAudioDivergence(D);
  }, [D]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        camera={{ fov: 72, near: 0.08, far: 60, position: [0, 1.6, 8] }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[fogColor]} />
        {/* 濕區的霧更近更濃:蒸氣間的體感 */}
        <fog
          attach="fog"
          args={[
            fogColor,
            spec.biome === 'wetzone' ? 1.6 : 3,
            (spec.biome === 'wetzone' ? 21 : 30) - D * 11,
          ]}
        />
        <Room spec={spec} />
        <Pool spec={spec} mirrorSpec={mirror} D={D} fogColor={fogColor} />
        {started && <Player spec={spec} />}
        <Effects />
      </Canvas>
      <Hud />
    </div>
  );
}
