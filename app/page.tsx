'use client';

import dynamic from 'next/dynamic';

// WebGL / Web Audio 都是純客戶端 — 關掉 SSR
const Experience = dynamic(() => import('@/components/Experience'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        color: '#3b5f5a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Courier New", monospace',
        letterSpacing: 4,
        fontSize: 12,
      }}
    >
      LOADING TAPE…
    </div>
  ),
});

export default function Page() {
  return <Experience />;
}
