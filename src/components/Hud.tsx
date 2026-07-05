'use client';

// 檔案感 OSD:REC、1996 時間戳、TRACKING(其實就是 1-D 的偽裝讀數)。
// 穿門會讓時間戳跳 137 秒 — 錄影帶被剪接過的暗示。

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { startAudio } from '@/core/audio';

export default function Hud() {
  const started = useStore((s) => s.started);
  const D = useStore((s) => s.D);
  const travelNonce = useStore((s) => s.travelNonce);
  const [clock, setClock] = useState('03:33:00');
  const t0 = useRef<number | null>(null);
  const glitching = useRef(false);

  useEffect(() => {
    if (!started) return;
    if (t0.current == null) t0.current = performance.now();
    const id = setInterval(() => {
      if (glitching.current) return;
      const el = (performance.now() - (t0.current ?? 0)) / 1000;
      const total =
        Math.floor(3 * 3600 + 33 * 60 + el + travelNonce * 137) % 86400;
      const h = Math.floor(total / 3600);
      const mi = Math.floor((total % 3600) / 60);
      const se = total % 60;
      setClock(
        `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')}`,
      );
    }, 250);
    return () => clearInterval(id);
  }, [started, travelNonce]);

  // 穿門瞬間:時間戳短暫亂碼 — 這卷帶子被剪接過
  useEffect(() => {
    if (travelNonce === 0) return;
    glitching.current = true;
    const CHARS = '0123456789▓█░:';
    const scramble = setInterval(() => {
      setClock(
        Array.from({ length: 8 }, (_, i) =>
          i === 2 || i === 5
            ? ':'
            : CHARS[Math.floor(Math.random() * CHARS.length)],
        ).join(''),
      );
    }, 70);
    const stop = setTimeout(() => {
      clearInterval(scramble);
      glitching.current = false;
    }, 480);
    return () => {
      clearInterval(scramble);
      clearTimeout(stop);
      glitching.current = false;
    };
  }, [travelNonce]);

  const bars = Math.round((1 - D) * 12);
  const tracking = '█'.repeat(bars) + '░'.repeat(12 - bars);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: '"Courier New", Courier, monospace',
        color: '#e8e6da',
        textShadow: '0 0 6px rgba(120,255,220,0.35)',
        zIndex: 10,
      }}
    >
      {started ? (
        <>
          <div style={{ position: 'absolute', top: 18, left: 22, fontSize: 15, letterSpacing: 2 }}>
            <span className="rec-dot">●</span> REC
          </div>
          <div
            style={{
              position: 'absolute',
              top: 18,
              right: 22,
              fontSize: 15,
              letterSpacing: 2,
              textAlign: 'right',
              lineHeight: 1.5,
            }}
          >
            {clock}
            <br />
            JUN.13 1996
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: 22,
              fontSize: 12,
              letterSpacing: 1.5,
              opacity: 0.85,
            }}
          >
            TRACKING {tracking}
          </div>
          <div
            className="hint-fade"
            style={{
              position: 'absolute',
              bottom: 18,
              width: '100%',
              textAlign: 'center',
              fontSize: 12,
              letterSpacing: 3,
            }}
          >
            拖曳環顧 · WASD 移動 · 走向門
          </div>
        </>
      ) : (
        <div
          onClick={() => {
            startAudio();
            useStore.getState().start();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.82)',
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 44, letterSpacing: 16, paddingLeft: 16 }}>疊池</div>
          <div style={{ fontSize: 13, letterSpacing: 7, opacity: 0.7, marginTop: 10 }}>
            SUPERPOOL
          </div>
          <div style={{ fontSize: 12, letterSpacing: 3, opacity: 0.6, marginTop: 46 }}>
            點擊進入 · 建議戴耳機
          </div>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.35, marginTop: 14 }}>
            水面倒影不是反射。每道門都回不去。
          </div>
        </div>
      )}
    </div>
  );
}
