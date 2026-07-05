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
import { BlendFunction, Effect } from 'postprocessing';
import { useStore } from '@/core/store';

// VHS tracking 錯位:偶發的整條水平帶狀撕裂,強度綁 D,穿門瞬間最重。
// 磁帶讀取頭對不準的那種「畫面被扯走一格」。
const TRACKING_FRAG = /* glsl */ `
uniform float uIntensity;
uniform float uTime;

float vhsHash(float n) { return fract(sin(n) * 43758.5453123); }

void mainUv(inout vec2 uv) {
  float t = floor(uTime * 12.0);
  float trigger = step(1.0 - clamp(uIntensity, 0.0, 1.0) * 0.3, vhsHash(t * 3.71));
  float band = floor(uv.y * 40.0);
  float sel = step(0.88, vhsHash(band + t * 91.7));
  uv.x += trigger * sel * (vhsHash(band * 7.7 + t * 1.3) - 0.5)
        * (0.02 + 0.09 * uIntensity);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
}
`;

class VHSTrackingEffect extends Effect {
  constructor() {
    super('VHSTrackingEffect', TRACKING_FRAG, {
      uniforms: new Map<string, THREE.Uniform>([
        ['uIntensity', new THREE.Uniform(0.2)],
        ['uTime', new THREE.Uniform(0)],
      ]),
    });
  }
}

export default function Effects() {
  // D 只在穿門時變,re-render 成本可接受;Bloom 強度 = 濕氣讓燈暈開(鏡頭起霧)
  const D = useStore((s) => s.D);
  const chroma = useRef<any>(null);
  const noise = useRef<any>(null);
  const flash = useRef(0);
  const nonce = useRef(0);
  const offset = useMemo(() => new THREE.Vector2(0.0008, 0.0004), []);
  const tracking = useMemo(() => new VHSTrackingEffect(), []);

  useFrame(({ clock }, dt) => {
    const s = useStore.getState();
    if (s.travelNonce !== nonce.current) {
      nonce.current = s.travelNonce;
      flash.current = 1;
    }
    flash.current = Math.max(0, flash.current - dt * 2.4);
    const D = s.D;
    const f = flash.current;
    tracking.uniforms.get('uTime')!.value = clock.elapsedTime;
    tracking.uniforms.get('uIntensity')!.value = 0.12 + D * 0.5 + f * 1.6;
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
      <primitive object={tracking} />
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
