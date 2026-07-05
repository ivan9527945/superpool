'use client';

// found-footage post:顆粒、掃描線、色差、暗角。
// 強度全部綁 D;穿門瞬間疊一記 flash(世界被抽換的訊號干擾)。

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Noise,
  ChromaticAberration,
  Scanline,
  Vignette,
  Bloom,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useStore } from '@/core/store';

export default function Effects() {
  // D 只在穿門時變,re-render 成本可接受;Bloom 強度 = 濕氣讓燈暈開(鏡頭起霧)
  const D = useStore((s) => s.D);
  const chroma = useRef<any>(null);
  const noise = useRef<any>(null);
  const flash = useRef(0);
  const nonce = useRef(0);
  const offset = useMemo(() => new THREE.Vector2(0.0008, 0.0004), []);

  useFrame((_, dt) => {
    const s = useStore.getState();
    if (s.travelNonce !== nonce.current) {
      nonce.current = s.travelNonce;
      flash.current = 1;
    }
    flash.current = Math.max(0, flash.current - dt * 2.4);
    const D = s.D;
    const f = flash.current;
    if (chroma.current?.offset) {
      chroma.current.offset.set(
        0.0008 + D * 0.0022 + f * 0.005,
        0.0004 + D * 0.001 + f * 0.002,
      );
    }
    if (noise.current?.blendMode) {
      noise.current.blendMode.opacity.value = 0.14 + D * 0.2 + f * 0.55;
    }
  });

  return (
    <EffectComposer>
      <Bloom
        intensity={0.12 + D * 0.75}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      {/* callback ref:wrapEffect 會 JSON.stringify 剩餘 props(React 19 含 ref),
          object ref 掛載後帶循環引用會爆;函數會被 stringify 忽略 */}
      <Noise
        ref={(e: unknown) => {
          noise.current = e;
        }}
        premultiply
        blendFunction={BlendFunction.SCREEN}
      />
      <ChromaticAberration
        ref={(e: unknown) => {
          chroma.current = e;
        }}
        offset={offset}
      />
      <Scanline blendFunction={BlendFunction.OVERLAY} density={1.3} opacity={0.18} />
      <Vignette eskil={false} offset={0.18} darkness={0.88} />
    </EffectComposer>
  );
}
