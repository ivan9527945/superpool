'use client';

// 手機控制:左下角虛擬搖桿(移動)。環顧沿用 canvas 的拖曳 —
// 搖桿是獨立 DOM,自己吃掉觸控事件,不會傳到 canvas 觸發轉視角。

import { useEffect, useRef, useState } from 'react';
import { setTouchAxis, clearTouchAxis } from '@/core/input';

const R = 62; // 搖桿半徑(px)
const KNOB = 26;

export default function TouchControls() {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const update = (cx: number, cy: number) => {
      let dx = cx - center.current.x;
      let dy = cy - center.current.y;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      setKnob({ x: dx, y: dy });
      // 上為前進(dy 負) → forward 正;右為 right 正
      setTouchAxis(-dy / R, dx / R);
    };

    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      active.current = e.pointerId;
      const rect = base.getBoundingClientRect();
      center.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      base.setPointerCapture(e.pointerId);
      update(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (active.current !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      update(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (active.current !== e.pointerId) return;
      active.current = null;
      setKnob({ x: 0, y: 0 });
      clearTouchAxis();
    };

    base.addEventListener('pointerdown', down);
    base.addEventListener('pointermove', move);
    base.addEventListener('pointerup', up);
    base.addEventListener('pointercancel', up);
    return () => {
      base.removeEventListener('pointerdown', down);
      base.removeEventListener('pointermove', move);
      base.removeEventListener('pointerup', up);
      base.removeEventListener('pointercancel', up);
      clearTouchAxis();
    };
  }, []);

  return (
    <div
      ref={baseRef}
      style={{
        position: 'absolute',
        left: 26,
        bottom: 42,
        width: R * 2,
        height: R * 2,
        borderRadius: '50%',
        border: '1px solid rgba(150,220,205,0.28)',
        background: 'rgba(20,40,38,0.22)',
        pointerEvents: 'auto',
        touchAction: 'none',
        zIndex: 12,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: R - KNOB + knob.x,
          top: R - KNOB + knob.y,
          width: KNOB * 2,
          height: KNOB * 2,
          borderRadius: '50%',
          background: 'rgba(120,230,205,0.32)',
          border: '1px solid rgba(150,240,220,0.5)',
        }}
      />
    </div>
  );
}
