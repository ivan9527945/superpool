import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

export const metadata: Metadata = {
  // 偽裝:頁籤看起來就是一個再普通不過的 Claude 對話分頁。
  title: 'New chat – Claude',
  description:
    '你 noclip 進的不是某個地方,而是宇宙與宇宙之間的那層膜。每往前一步,就關掉身後一個世界。',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '疊池',
  },
  icons: {
    icon: '/claude-icon.svg',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
