import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '疊池 SUPERPOOL',
    short_name: '疊池',
    description:
      '你 noclip 進的不是某個地方,而是宇宙與宇宙之間的那層膜。每往前一步,就關掉身後一個世界。',
    start_url: '.',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
