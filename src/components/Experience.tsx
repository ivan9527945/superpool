'use client';

// 組裝:Canvas + 分岔迴圈。
// 真實房間 = generateRoomSpec(branchId),鏡像房間 = generateRoomSpec(mirrorSeed)。
// 霧色/背景/音訊全部即時綁 D。

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useStore, ROOT_BRANCH } from '@/core/store';
import { generateRoomSpec, type Archetype } from '@/core/room';
import { mirrorSeed, clamp01, hashCombine } from '@/core/prng';
import {
  setAudioDivergence,
  setDoorVoices,
  setFigureState,
  setSuperposition,
  setUnderwater,
  resolveEnd,
  pulseTraverse,
} from '@/core/audio';

/** 各原型的霧氛圍(亮水域開闊、封閉空間壓縮、淹水室濃稠) */
const FOG: Record<Archetype, { base: string; near: number; far: number }> = {
  poolhall: { base: '#cfe6e0', near: 6, far: 46 },
  arcade: { base: '#d8ece6', near: 8, far: 50 },
  flooded: { base: '#175059', near: 0.5, far: 11 },
  storage: { base: '#9fada6', near: 3, far: 26 },
  corridor: { base: '#7f9a95', near: 2.2, far: 24 },
};
import Room from './Room';
import Pool from './Pool';
import Player from './Player';
import Effects from './Effects';
import Hud from './Hud';

/** 進疊加態的分岔度閾值;壓回這以下則觸發「揭露」 */
const SUPER_D = 0.9;
const LUCID_D = 0.02;

export default function Experience() {
  const branchId = useStore((s) => s.branchId);
  const D = useStore((s) => s.D);
  const started = useStore((s) => s.started);
  const phase = useStore((s) => s.phase);
  const travelNonce = useStore((s) => s.travelNonce);

  // debug:?a=arcade 強制原型
  const forced = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const a = new URLSearchParams(window.location.search).get('a');
    return a && a in FOG ? (a as Archetype) : undefined;
  }, []);

  const spec = useMemo(
    () =>
      generateRoomSpec(branchId, D, {
        // 家永遠是泳池廳
        forceArchetype:
          forced ?? (branchId === ROOT_BRANCH ? 'poolhall' : undefined),
      }),
    [branchId, D, forced],
  );
  // 倒影分支:身影在水裡是實心的(那是它的世界)。
  // D > 0.75 反轉:水裡的它消失 — 它已經滲透過來了。
  const mirror = useMemo(
    () =>
      generateRoomSpec(mirrorSeed(branchId), clamp01(D + 0.1), {
        figureChance: D > 0.75 ? 0 : 0.22 + D * 0.5,
        figureMode: 'solid',
      }),
    [branchId, D],
  );
  const fogColor = useMemo(
    () =>
      new THREE.Color(FOG[spec.archetype].base).lerp(
        new THREE.Color('#3e3410'),
        D * 0.85,
      ),
    [D, spec.archetype],
  );

  useEffect(() => {
    setAudioDivergence(D);
  }, [D]);

  // 房間就緒(且音訊已啟動)後:掛上各門的水聲、通報身影存在
  useEffect(() => {
    if (!started || phase !== 'play') return;
    setDoorVoices(
      spec.doors.map((d) => ({
        x: d.x,
        z: -spec.depth / 2,
        t: clamp01((d.dDelta + 0.07) / 0.22),
      })),
    );
    setFigureState(!!spec.figure, false);
    setUnderwater(spec.floodLevel != null);
  }, [spec, started, phase]);

  // ─ 結局觸發:D 衝過閾值 → 疊加態;把 D 壓回 ≈0 → 揭露「沒有原初的家」
  useEffect(() => {
    if (!started || phase !== 'play') return;
    if (D >= SUPER_D) {
      pulseTraverse();
      useStore.getState().setPhase('super');
    } else if (D <= LUCID_D && travelNonce > 0) {
      useStore.getState().setPhase('lucid');
    }
  }, [D, travelNonce, started, phase]);

  // ─ 結局時序:lucid 字幕 16s → 疊加態 30s → 收束
  useEffect(() => {
    if (phase === 'lucid') {
      const id = setTimeout(() => {
        pulseTraverse();
        useStore.getState().setPhase('super');
      }, 16000);
      return () => clearTimeout(id);
    }
    if (phase === 'super') {
      setSuperposition(true);
      setDoorVoices([]);
      setFigureState(true, false);
      const id = setTimeout(() => useStore.getState().setPhase('end'), 30000);
      return () => clearTimeout(id);
    }
    if (phase === 'end') resolveEnd();
  }, [phase]);

  // ─ 疊加態:同一個房間在五個現實裡的版本,同時被 render。
  //   每一層裡都站著一個實心的你(除了你自己站的主層)。
  const superSpecs = useMemo(() => {
    if (phase !== 'super' && phase !== 'end') return null;
    return Array.from({ length: 5 }, (_, i) =>
      generateRoomSpec(
        hashCombine(branchId, 0x5150 + i),
        clamp01(0.12 + i * 0.19),
        { figureChance: i === 0 ? 0 : 1, figureMode: 'solid' },
      ),
    );
  }, [phase, branchId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas
        camera={{ fov: 72, near: 0.08, far: 60, position: [0, 1.6, 8] }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[fogColor]} />
        <fog
          attach="fog"
          args={[
            fogColor,
            FOG[spec.archetype].near,
            Math.max(9, FOG[spec.archetype].far - D * 14),
          ]}
        />
        {superSpecs ? (
          <>
            {superSpecs.map((s, i) => (
              <group
                key={s.seed}
                position={[
                  (i % 2 ? -1 : 1) * i * 0.35,
                  0,
                  (((i * 7) % 3) - 1) * 0.45,
                ]}
                rotation={[0, (i - 2) * 0.022, 0]}
              >
                <Room
                  spec={s}
                  ghost={i === 0 ? 0.85 : 0.3 - i * 0.03}
                  lit={i === 0}
                />
              </group>
            ))}
            <Pool
              spec={superSpecs[0]}
              mirrorSpec={mirror}
              D={D}
              fogColor={fogColor}
            />
            {started && <Player spec={superSpecs[0]} />}
          </>
        ) : (
          <>
            <Room spec={spec} />
            <Pool spec={spec} mirrorSpec={mirror} D={D} fogColor={fogColor} />
            {started && <Player spec={spec} />}
          </>
        )}
        <Effects />
      </Canvas>
      <Hud />
    </div>
  );
}
