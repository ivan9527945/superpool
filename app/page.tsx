'use client';

import dynamic from 'next/dynamic';

// WebGL / Web Audio 都是純客戶端 — 關掉 SSR。
// 不放 loading 畫面:偽裝首頁要無縫出現,底色鋪成跟它一致的深色避免黑閃。
const Experience = dynamic(() => import('@/components/Experience'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, background: '#262624' }} />
  ),
});

export default function Page() {
  return <Experience />;
}
