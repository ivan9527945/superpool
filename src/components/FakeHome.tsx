'use client';

// 偽裝首頁:一個看起來再正常不過的 AI 對話網站(仿 Claude 首頁切版)。
// 使用者點擊「問問題的輸入框」時,startAudio() 要在同一個手勢裡同步觸發(自動播放政策),
// 然後播放「跌倒」動畫 —— 地板抽掉、整個頁面往前栽下去 —— 動畫尾聲才真正 start() 進入疊池。

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { startAudio } from '@/core/audio';

const CORAL = '#d97757';
const INK = '#eeece4';
const MUTED = '#98958b';
const BG = '#262624';
const CARD = '#30302e';

/** 跌進遊戲的瞬間:把偽裝的 Claude 頁籤換成「後室」真身(標題 + favicon)。
 *  換 favicon 用「移除舊 link、插新 link」最保險 —— 只改 href 有些瀏覽器不重抓。 */
function revealTab() {
  if (typeof document === 'undefined') return;
  document.title = '後室';
  document
    .querySelectorAll('link[rel~="icon"]')
    .forEach((l) => l.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = '/icons/backrooms-64.png';
  document.head.appendChild(link);
}

/** 依當地時間算出「Happy <星期>」 */
function weekday(): string {
  try {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return 'Day';
  }
}

/** Claude 那顆珊瑚色放射星芒 */
function Sunburst({ size = 30 }: { size?: number }) {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const x = 12 + Math.cos(a) * 11;
    const y = 12 + Math.sin(a) * 11;
    return (
      <line
        key={i}
        x1={12}
        y1={12}
        x2={x}
        y2={y}
        stroke={CORAL}
        strokeWidth={2.1}
        strokeLinecap="round"
      />
    );
  });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {spokes}
    </svg>
  );
}

/** 藥丸標籤 + 小圖示 */
function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 14px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.02)',
        color: INK,
        fontSize: 14,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: MUTED, display: 'inline-flex' }}>{icon}</span>
      {label}
    </div>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function FakeHome() {
  const [falling, setFalling] = useState(false);
  // 只在客戶端掛載(Experience 為 ssr:false),初始渲染即依當前日期算出星期,無需等 effect。
  const [day] = useState(weekday);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // 點擊畫面任何地方(含所有按鈕):先啟動音訊(必須在手勢裡),播放跌倒動畫,尾聲才進遊戲。
  const trip = () => {
    if (falling) return;
    startAudio();
    setFalling(true);
    timer.current = setTimeout(() => {
      revealTab(); // 跌進來的瞬間,頁籤褪去偽裝、露出真身
      useStore.getState().start();
    }, 920);
  };

  return (
    <div
      className={falling ? 'fh-root fh-falling' : 'fh-root'}
      onClick={trip}
      style={{
        position: 'absolute',
        inset: 0,
        background: BG,
        color: INK,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* 頂列:側欄開關 / 幽靈 */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 20,
          right: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: MUTED,
        }}
      >
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          aria-hidden
          style={{ cursor: 'pointer' }}
        >
          <rect x="3" y="4" width="18" height="16" rx="2.5" style={stroke} />
          <line x1="9" y1="4" x2="9" y2="20" style={stroke} />
        </svg>
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          aria-hidden
          style={{ cursor: 'pointer' }}
        >
          <path
            d="M5 20V10a7 7 0 0 1 14 0v10l-2.3-1.6L14.4 20 12 18.4 9.6 20l-2.3-1.6L5 20Z"
            style={stroke}
          />
          <circle cx="9.4" cy="10.5" r="1" fill="currentColor" />
          <circle cx="14.6" cy="10.5" r="1" fill="currentColor" />
        </svg>
      </div>

      {/* 主體 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px',
          gap: 26,
        }}
      >
        <div style={{ width: '100%', maxWidth: 720 }}>
          {/* 招呼語 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 26,
              paddingLeft: 2,
            }}
          >
            <Sunburst size={34} />
            <h1
              style={{
                margin: 0,
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontWeight: 400,
                fontSize: 34,
                letterSpacing: 0.2,
                color: '#f2f0e8',
              }}
            >
              Happy {day}
            </h1>
          </div>

          {/* 輸入框 */}
          <div
            role="textbox"
            aria-label="Ask a question"
            style={{
              background: CARD,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '18px 18px 14px',
              boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
              cursor: 'pointer',
            }}
          >
            <div style={{ color: MUTED, fontSize: 16, minHeight: 44 }}>
              Type / for skills
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: MUTED,
              }}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden>
                <line x1="12" y1="5" x2="12" y2="19" style={stroke} />
                <line x1="5" y1="12" x2="19" y2="12" style={stroke} />
              </svg>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <span style={{ color: INK }}>Opus 4.8</span>
                <span>High</span>
                <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
                  <polyline points="6 9 12 15 18 9" style={stroke} />
                </svg>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
                  <rect x="9" y="3" width="6" height="12" rx="3" style={stroke} />
                  <path d="M6 11a6 6 0 0 0 12 0" style={stroke} />
                  <line x1="12" y1="17" x2="12" y2="21" style={stroke} />
                </svg>
                <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
                  <line x1="5" y1="9" x2="5" y2="15" style={stroke} />
                  <line x1="9.5" y1="6" x2="9.5" y2="18" style={stroke} />
                  <line x1="14.5" y1="6" x2="14.5" y2="18" style={stroke} />
                  <line x1="19" y1="9" x2="19" y2="15" style={stroke} />
                </svg>
              </div>
            </div>
          </div>

          {/* 快捷藥丸 */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 10,
              marginTop: 20,
            }}
          >
            <Pill
              label="Code"
              icon={
                <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                  <polyline points="8 8 4 12 8 16" style={stroke} />
                  <polyline points="16 8 20 12 16 16" style={stroke} />
                </svg>
              }
            />
            <Pill
              label="Write"
              icon={
                <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 20l4-1 10-10-3-3L5 16l-1 4Z" style={stroke} />
                </svg>
              }
            />
            <Pill
              label="Learn"
              icon={
                <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 5l9 4-9 4-9-4 9-4Z" style={stroke} />
                  <path d="M7 11v4c0 1.1 2.2 2 5 2s5-.9 5-2v-4" style={stroke} />
                </svg>
              }
            />
            <Pill
              label="Life stuff"
              icon={
                <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 8h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" style={stroke} />
                  <path d="M16 9h2a2 2 0 0 1 0 4h-2" style={stroke} />
                </svg>
              }
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <Pill
              label="Claude's choice"
              icon={
                <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
                  <path d="M9 18h6M10 21h4" style={stroke} />
                  <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z" style={stroke} />
                </svg>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
