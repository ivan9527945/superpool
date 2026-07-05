'use client';

// 檔案感 OSD:REC、時間戳、TRACKING(其實就是 1-D 的偽裝讀數)。
// 日期是不存在的:1997 不是閏年,沒有 2 月 29 日 — 這卷帶子來自一個不該存在的現實。
// 穿門會讓時間戳跳 137 秒 — 錄影帶被剪接過的暗示。

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { startAudio } from '@/core/audio';
import { shareUrl } from '@/core/branch';
import { detectQuality } from '@/core/quality';
import TouchControls from './TouchControls';

// 揭露:D 歸零時,遊戲不說「你回家了」
const LUCID_LINES = [
  '訊號穩定。分岔度歸零。',
  '這裡幾乎就是你出發的地方。幾乎。',
  '你數過天花板的燈嗎。',
  '沒有任何一個分支是特權的。',
  '家,從來不是一個座標。',
];

export default function Hud() {
  const started = useStore((s) => s.started);
  const D = useStore((s) => s.D);
  const travelNonce = useStore((s) => s.travelNonce);
  const phase = useStore((s) => s.phase);
  const [lucidLine, setLucidLine] = useState(-1);
  const [scramble, setScramble] = useState('');
  const [coarse, setCoarse] = useState(false);
  const [copied, setCopied] = useState(false);

  // 觸控裝置:顯示虛擬搖桿、換提示文案(UA 或粗指標任一;?touch=1 強制)
  useEffect(() => {
    const coarsePtr = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const force =
      new URLSearchParams(window.location.search).get('touch') === '1';
    setCoarse(force || detectQuality().isMobile || coarsePtr);
  }, []);

  const share = async () => {
    const url = shareUrl(useStore.getState().path);
    try {
      if (navigator.share) {
        await navigator.share({ title: '疊池 SUPERPOOL', url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 使用者取消分享 / 剪貼簿被拒 — 靜默
    }
  };

  // lucid:字幕逐行浮現
  useEffect(() => {
    if (phase !== 'lucid') {
      setLucidLine(-1);
      return;
    }
    setLucidLine(0);
    const id = setInterval(
      () => setLucidLine((i) => Math.min(i + 1, LUCID_LINES.length - 1)),
      3000,
    );
    return () => clearInterval(id);
  }, [phase]);

  // super:TRACKING 讀數失效 — 所有狀態同時為真
  useEffect(() => {
    if (phase !== 'super') return;
    const CH = '█▓▒░ ';
    const id = setInterval(() => {
      setScramble(
        Array.from(
          { length: 12 },
          () => CH[Math.floor(Math.random() * CH.length)],
        ).join(''),
      );
    }, 110);
    return () => clearInterval(id);
  }, [phase]);
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
  const tracking =
    phase === 'super'
      ? scramble
      : '█'.repeat(bars) + '░'.repeat(12 - bars);
  const trackingLabel = phase === 'lucid' ? 'NO ORIGIN' : 'TRACKING';

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
            FEB.29 1997
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
            {trackingLabel} {tracking}
          </div>
          {phase === 'lucid' && lucidLine >= 0 && (
            <div
              key={lucidLine}
              className="lucid-line"
              style={{
                position: 'absolute',
                bottom: 90,
                width: '100%',
                textAlign: 'center',
                fontSize: 16,
                letterSpacing: 4,
                textShadow: '0 0 10px rgba(120,255,220,0.5)',
              }}
            >
              {LUCID_LINES[lucidLine]}
            </div>
          )}
          {phase === 'end' && (
            <div
              className="end-fade"
              onClick={() => window.location.assign(window.location.pathname)}
              style={{
                position: 'absolute',
                inset: 0,
                background: '#000',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
            >
              <div
                className="end-quote"
                style={{ fontSize: 20, letterSpacing: 6, lineHeight: 2.2, textAlign: 'center', padding: '0 24px' }}
              >
                不知周之夢為胡蝶與,
                <br />
                胡蝶之夢為周與?
              </div>
              <div
                className="end-quote"
                style={{ fontSize: 12, letterSpacing: 4, opacity: 0.55, marginTop: 26 }}
              >
                —《莊子・齊物論》
              </div>
              <div
                className="end-hint"
                style={{ fontSize: 11, letterSpacing: 3, opacity: 0.35, marginTop: 70 }}
              >
                點擊,再作一次夢
              </div>
            </div>
          )}
          {phase === 'play' && (
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
              {coarse ? '拖曳環顧 · 搖桿移動 · 走向門' : '拖曳環顧 · WASD 移動 · 走向門'}
            </div>
          )}

          {/* 分享此分支:把 path 編進連結,任何人打開就重現同一條路 */}
          {(phase === 'play' || phase === 'lucid') && (
            <button
              onClick={share}
              style={{
                position: 'absolute',
                bottom: 16,
                right: 20,
                pointerEvents: 'auto',
                background: 'rgba(20,40,38,0.3)',
                border: '1px solid rgba(150,220,205,0.3)',
                color: '#cfeee6',
                fontFamily: 'inherit',
                fontSize: 11,
                letterSpacing: 2,
                padding: '7px 12px',
                cursor: 'pointer',
                textShadow: 'inherit',
              }}
            >
              {copied ? '已複製分支連結' : '分享此分支'}
            </button>
          )}

          {coarse && phase === 'play' && <TouchControls />}
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
