import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

// 對外偽裝:頁籤、分享預覽卡都要看起來像一個普通的 Claude 對話分頁。
// 真實的作品資訊(疊池 / SUPERPOOL)不對外露出 —— 見 CLAUDE.md。
const DISGUISE_TITLE = 'New chat – Claude';
const DISGUISE_DESC =
  'Claude is a next-generation AI assistant built by Anthropic to be helpful, honest, and harmless. Start a new chat.';

export const metadata: Metadata = {
  metadataBase: new URL('https://superpool-production.up.railway.app'),
  title: DISGUISE_TITLE,
  description: DISGUISE_DESC,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Claude',
  },
  icons: {
    icon: '/claude-icon.svg',
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Claude',
    title: DISGUISE_TITLE,
    description: DISGUISE_DESC,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Claude' }],
  },
  twitter: {
    card: 'summary',
    title: DISGUISE_TITLE,
    description: DISGUISE_DESC,
    images: ['/icons/icon-512.png'],
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
