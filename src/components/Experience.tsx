'use client';

// 組裝:Canvas + 分岔迴圈。
// 真實房間 = generateRoomSpec(branchId),鏡像房間 = generateRoomSpec(mirrorSeed)。
// 霧色/背景/音訊全部即時綁 D。

import * as THREE from 'three';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useStore, ROOT_BRANCH } from '@/core/store';
import {
  generateRoomSpec,
  doorAnchor,
  spawnPoint,
  type Archetype,
  type RoomSpec,
} from '@/core/room';
import { mirrorSeed, clamp01, hashCombine } from '@/core/prng';
import { detectQuality } from '@/core/quality';
import {
  setAudioDivergence,
  setDoorVoices,
  setFigureState,
  setSuperposition,
  setUnderwater,
  resolveEnd,
  pulseTraverse,
} from '@/core/audio';

/** 各原型的霧氛圍:一律黃調,遠平面壓在房間深度之內 —
 *  遠牆永遠溶在與牆同色的黃霧裡,空間看不到盡頭(後室 Level 0 的感覺) */
const FOG: Record<Archetype, { base: string; near: number; far: number }> = {
  poolhall: { base: '#c8bb72', near: 4, far: 26 },
  arcade: { base: '#cec172', near: 5, far: 28 },
  flooded: { base: '#31421f', near: 0.5, far: 10 },
  storage: { base: '#8e8149', near: 2.4, far: 17 },
  corridor: { base: '#7a6f40', near: 2, far: 16 },
};
import Room from './Room';
import Pool from './Pool';
import Player from './Player';
import Effects from './Effects';
import Hud from './Hud';
import FakeHome from './FakeHome';

/** started 前的相機:同步擺到出生點的第一人稱視角。
 *  Canvas 預設相機懸在泳池上方,而 Player 要等跌倒動畫結束才掛載 —
 *  沒有這個,轉場露出 canvas 的那段會先看到一幀「泳池空拍」再跳到出生點。 */
function SpawnCamera({ spec, active }: { spec: RoomSpec; active: boolean }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    if (!active) return;
    const sp = spawnPoint(spec);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(0, 0, 0); // 面向北,與 Player 的初始 yaw/pitch 一致
    camera.position.set(sp.x, 1.6, sp.z); // 1.6 = Player 的 EYE 高度
  }, [active, spec, camera]);
  return null;
}

/** 進疊加態的分岔度閾值;壓回這以下則觸發「揭露」 */
const SUPER_D = 0.9;
/** 最後一關:疊加態畫面停留多久後,進入「被監視」資訊畫面 */
const SUPER_HOLD_MS = 4000;
const LUCID_D = 0.02;

export default function Experience() {
  const branchId = useStore((s) => s.branchId);
  const D = useStore((s) => s.D);
  const started = useStore((s) => s.started);
  const phase = useStore((s) => s.phase);
  const travelNonce = useStore((s) => s.travelNonce);

  const quality = useMemo(() => detectQuality(), []);

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
      spec.doors.map((d) => {
        const a = doorAnchor(spec, d);
        return {
          x: a.x,
          z: a.z,
          t: clamp01((d.dDelta + 0.07) / 0.22),
        };
      }),
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
      const id = setTimeout(
        () => useStore.getState().setPhase('end'),
        SUPER_HOLD_MS,
      );
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
        dpr={[1, quality.dprMax]}
        gl={{
          antialias: quality.heavyPost,
          powerPreference: 'high-performance',
        }}
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
        <SpawnCamera spec={spec} active={!started} />
        <Effects />
      </Canvas>
      <Hud />
      {!started && <FakeHome />}
    </div>
  );
}
