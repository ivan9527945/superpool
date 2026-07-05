'use client';

// 註冊 service worker(僅正式環境;dev 不註冊以免快取干擾 HMR)。

import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    )
      return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // 註冊失敗不影響遊玩
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
