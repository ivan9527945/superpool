'use client';

// 倒影即平行宇宙 — 全作的 signature。
// 水面不反射現實:它把「鏡像分支」(mirrorSeed 生成的另一個宇宙)render 進 FBO,
// 再以平面反射的投影矩陣取樣,加上隨 D 增強的漣漪擾動。
// 反射相機與斜裁剪面的數學移植自 three.js Reflector(已驗證,避開鏡像剔除坑)。

import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import Room from './Room';
import type { RoomSpec } from '@/core/room';

const VERT = /* glsl */ `
uniform mat4 uTextureMatrix;
varying vec4 vCoord;
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vCoord = uTextureMatrix * wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D tReflect;
uniform float uTime;
uniform float uRipple;
uniform vec3 uTint;
varying vec4 vCoord;
varying vec3 vWorldPos;
void main() {
  float r1 = sin(vWorldPos.x * 3.3 + uTime * 1.4) * sin(vWorldPos.z * 2.8 + uTime * 1.9);
  float r2 = sin(vWorldPos.x * 7.9 - uTime * 2.3) * sin(vWorldPos.z * 6.3 + uTime * 1.2);
  float r3 = sin((vWorldPos.x + vWorldPos.z) * 11.0 + uTime * 3.1);
  vec2 duv = vec2(r1 + r3 * 0.4, r2 - r3 * 0.3) * (0.0035 + uRipple * 0.028);
  vec2 uv = clamp(vCoord.xy / vCoord.w + duv, 0.001, 0.999);
  vec3 refl = texture2D(tReflect, uv).rgb;
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - max(viewDir.y, 0.0), 2.2);
  vec3 deep = uTint * 0.4;
  vec3 col = mix(deep, refl, 0.45 + 0.5 * fres);
  col += uTint * 0.08;
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function Pool({
  spec,
  mirrorSpec,
  D,
  fogColor,
}: {
  spec: RoomSpec;
  mirrorSpec: RoomSpec;
  D: number;
  fogColor: THREE.Color;
}) {
  const { gl, size, viewport } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  const fbo = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(1, 1);
    t.texture.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => fbo.dispose(), [fbo]);

  // 反射 FBO 用半解析度(效能預算)
  useEffect(() => {
    const dpr = viewport.dpr ?? 1;
    fbo.setSize(
      Math.max(2, Math.floor(size.width * dpr * 0.5)),
      Math.max(2, Math.floor(size.height * dpr * 0.5)),
    );
  }, [fbo, size.width, size.height, viewport.dpr]);

  const mirrorScene = useMemo(() => new THREE.Scene(), []);
  useEffect(() => {
    mirrorScene.background = fogColor.clone().multiplyScalar(0.55);
    // 倒影分支的霧跟它自己的 biome:水裡可能已經是濕區,而你站的還是池核
    const wet = mirrorSpec.biome === 'wetzone';
    mirrorScene.fog = new THREE.Fog(
      fogColor.clone().multiplyScalar(0.7),
      wet ? 1.6 : 3,
      wet ? 17 : 24,
    );
  }, [mirrorScene, fogColor, mirrorSpec.biome]);

  const virtualCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
  const uTextureMatrix = useMemo(() => new THREE.Matrix4(), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          tReflect: { value: fbo.texture },
          uTextureMatrix: { value: uTextureMatrix },
          uTime: { value: 0 },
          uRipple: { value: 0 },
          uTint: { value: new THREE.Color('#155048') },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      }),
    [fbo, uTextureMatrix],
  );

  const tmp = useMemo(
    () => ({
      plane: new THREE.Plane(),
      normal: new THREE.Vector3(),
      reflPos: new THREE.Vector3(),
      camPos: new THREE.Vector3(),
      rot: new THREE.Matrix4(),
      lookAt: new THREE.Vector3(),
      view: new THREE.Vector3(),
      target: new THREE.Vector3(),
      clip: new THREE.Vector4(),
      q: new THREE.Vector4(),
      tintA: new THREE.Color('#155048'),
      tintB: new THREE.Color('#4a3f14'),
    }),
    [],
  );

  useFrame((state) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const mesh = meshRef.current;
    if (!mesh) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uRipple.value = 0.12 + D * 0.88;
    (material.uniforms.uTint.value as THREE.Color).copy(tmp.tintA).lerp(tmp.tintB, D);

    const { plane, normal, reflPos, camPos, rot, lookAt, view, target, clip, q } = tmp;

    reflPos.setFromMatrixPosition(mesh.matrixWorld);
    camPos.setFromMatrixPosition(cam.matrixWorld);
    rot.extractRotation(mesh.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rot);

    view.subVectors(reflPos, camPos);
    if (view.dot(normal) > 0) return; // 相機在水面下:保留上一幀

    view.reflect(normal).negate();
    view.add(reflPos);

    rot.extractRotation(cam.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.subVectors(reflPos, lookAt);
    target.reflect(normal).negate();
    target.add(reflPos);

    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.far = cam.far;
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy(cam.projectionMatrix);

    uTextureMatrix.set(
      0.5, 0, 0, 0.5,
      0, 0.5, 0, 0.5,
      0, 0, 0.5, 0.5,
      0, 0, 0, 1,
    );
    uTextureMatrix.multiply(virtualCamera.projectionMatrix);
    uTextureMatrix.multiply(virtualCamera.matrixWorldInverse);

    // 斜裁剪面:只 render 水面以上的鏡像世界
    plane.setFromNormalAndCoplanarPoint(normal, reflPos);
    plane.applyMatrix4(virtualCamera.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = virtualCamera.projectionMatrix;
    q.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1.0;
    pm.elements[14] = clip.w;

    const prevRT = gl.getRenderTarget();
    const prevXr = gl.xr.enabled;
    gl.xr.enabled = false;
    gl.setRenderTarget(fbo);
    gl.render(mirrorScene, virtualCamera);
    gl.setRenderTarget(prevRT);
    gl.xr.enabled = prevXr;
  });

  return (
    <>
      {createPortal(<Room spec={mirrorSpec} variant="mirror" />, mirrorScene)}
      <mesh
        ref={meshRef}
        rotation-x={-Math.PI / 2}
        position={[spec.pool.x, spec.waterY, spec.pool.z]}
      >
        <planeGeometry args={[spec.pool.w, spec.pool.d]} />
        <primitive object={material} attach="material" />
      </mesh>
    </>
  );
}
