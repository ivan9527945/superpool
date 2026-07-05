'use client';

// 拖曳環顧 + WASD。邊界碰撞、繞池行走、頭部微晃。
// 穿門 = impossible-space:dispatch traverse 後世界抽換,人被傳回出生點 —
// 記憶體永遠只有一個房間,體感卻是無盡。

import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '@/core/store';
import { pulseTraverse, updateListener, setFigureState } from '@/core/audio';
import { spawnPoint, type RoomSpec } from '@/core/room';

const EYE = 1.6;
const SPEED = 3.1;

export default function Player({ spec }: { spec: RoomSpec }) {
  const { camera, gl } = useThree();
  const pos = useRef(new THREE.Vector3(0, EYE, 0));
  const yaw = useRef(0);
  const pitch = useRef(0);
  const bob = useRef(0);
  const swim = useRef(0);
  const vel = useRef({ x: 0, z: 0 });
  const keys = useRef<Record<string, boolean>>({});
  const nearFigure = useRef(false);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  // 房間抽換時回到出生點(視角保留 — 你只是「繼續往前走」)。
  // 必須在 frame loop 內同步做:useEffect 在 paint 後才跑,新房間的第一個 frame
  // 可能帶著舊座標(貼著遠牆)直接誤觸新房間的門,造成連鎖穿門。
  const lastSeed = useRef<number | null>(null);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const ku = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const el = gl.domElement;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    const pd = (e: PointerEvent) => {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const pm = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.current -= (e.clientX - lx) * 0.004;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - (e.clientY - ly) * 0.003,
        -1.25,
        1.25,
      );
      lx = e.clientX;
      ly = e.clientY;
    };
    const pu = () => {
      dragging = false;
    };
    el.addEventListener('pointerdown', pd);
    el.addEventListener('pointermove', pm);
    el.addEventListener('pointerup', pu);
    el.addEventListener('pointercancel', pu);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      el.removeEventListener('pointerdown', pd);
      el.removeEventListener('pointermove', pm);
      el.removeEventListener('pointerup', pu);
      el.removeEventListener('pointercancel', pu);
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    // spec 尚未跟上 store(剛穿門的那幾幀):先不動,避免重複觸發
    if (useStore.getState().branchId !== spec.seed) return;

    if (lastSeed.current !== spec.seed) {
      lastSeed.current = spec.seed;
      nearFigure.current = false;
      const s = spawnPoint(spec);
      pos.current.set(s.x, EYE, s.z);
    }

    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const f =
      (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    const r =
      (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);

    // 淹水室:在水中 — 慢、有慣性、緩緩浮沉
    const flooded = spec.floodLevel != null;
    const speed = flooded ? 1.5 : SPEED;
    const sy = Math.sin(yaw.current);
    const cy = Math.cos(yaw.current);
    const tvx = (-sy * f + cy * r) * speed;
    const tvz = (-cy * f - sy * r) * speed;
    if (flooded) {
      // 水的慣性:速度慢慢跟上目標
      const ease = 1 - Math.exp(-dt * 1.8);
      vel.current.x += (tvx - vel.current.x) * ease;
      vel.current.z += (tvz - vel.current.z) * ease;
    } else {
      vel.current.x = tvx;
      vel.current.z = tvz;
    }
    const dx = vel.current.x * dt;
    const dz = vel.current.z * dt;

    const m = 0.42;
    const p = pos.current;
    let nx = THREE.MathUtils.clamp(p.x + dx, -spec.width / 2 + m, spec.width / 2 - m);
    let nz = THREE.MathUtils.clamp(p.z + dz, -spec.depth / 2 + m, spec.depth / 2 - m);

    // 水域是障礙物:分軸解算,可沿邊滑行(淹水室例外 — 你就在水裡)
    const e = 0.34;
    const blocked = (x: number, z: number) =>
      spec.water.some(
        (wr) =>
          x > wr.x - wr.w / 2 - e &&
          x < wr.x + wr.w / 2 + e &&
          z > wr.z - wr.d / 2 - e &&
          z < wr.z + wr.d / 2 + e,
      );
    if (!flooded) {
      if (blocked(nx, p.z)) nx = p.x;
      if (blocked(nx, nz)) nz = p.z;
    }
    p.x = nx;
    p.z = nz;

    const moving = f !== 0 || r !== 0;
    if (flooded) {
      // 漂浮:大而慢的浮沉 + 極輕的側傾
      swim.current += dt;
      const t = swim.current;
      camera.position.set(
        p.x,
        EYE + Math.sin(t * 1.05) * 0.13 + Math.sin(t * 0.47 + 1.3) * 0.07,
        p.z,
      );
      camera.rotation.set(
        pitch.current,
        yaw.current,
        Math.sin(t * 0.4) * 0.022,
      );
    } else {
      if (moving) bob.current += dt * 7.5;
      camera.position.set(
        p.x,
        EYE + (moving ? Math.sin(bob.current) * 0.035 : 0),
        p.z,
      );
      camera.rotation.set(pitch.current, yaw.current, 0);
    }

    // 空間音:各門水聲的音量/聲像跟著位置與朝向
    updateListener(p.x, p.z, yaw.current);

    // 身影接近偵測(hysteresis 避免邊界抖動):走近它 → 聲場退開
    if (spec.figure) {
      const df = Math.hypot(p.x - spec.figure.x, p.z - spec.figure.z);
      const wasNear = nearFigure.current;
      if (!wasNear && df < 3) {
        nearFigure.current = true;
        setFigureState(true, true);
      } else if (wasNear && df > 3.6) {
        nearFigure.current = false;
        setFigureState(true, false);
      }
    }

    // 門的觸發:走到遠牆上的門口 = 穿進新的分支(結局階段不再有門)
    if (useStore.getState().phase !== 'play') return;
    for (const d of spec.doors) {
      if (p.z < -spec.depth / 2 + 0.62 && Math.abs(p.x - d.x) < 0.72) {
        pulseTraverse();
        useStore.getState().traverse(d.index, d.dDelta);
        break;
      }
    }
  });

  return null;
}
