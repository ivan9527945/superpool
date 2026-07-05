// 效能分級:桌機 60fps、手機 30–40fps。
// 依裝置能力一次決定品質層,驅動 dpr、FBO 解析度、後製 pass 數。

export type Tier = 'high' | 'low';

export interface Quality {
  tier: Tier;
  isMobile: boolean;
  /** Canvas devicePixelRatio 上限 */
  dprMax: number;
  /** 反射 FBO 相對螢幕的解析度倍率 */
  fboScale: number;
  /** 是否啟用較貴的後製(Bloom / Scanline) */
  heavyPost: boolean;
}

let cached: Quality | null = null;

export function detectQuality(): Quality {
  if (cached) return cached;

  // SSR 預設走高階(client 掛載後會重新量測)
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { tier: 'high', isMobile: false, dprMax: 1.75, fboScale: 0.5, heavyPost: true };
  }

  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 560;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  const lowMem =
    (navigator as unknown as { deviceMemory?: number }).deviceMemory != null &&
    (navigator as unknown as { deviceMemory: number }).deviceMemory <= 4;

  const isMobile = uaMobile || (coarse && smallScreen);
  const low = isMobile || fewCores || lowMem;

  cached = low
    ? { tier: 'low', isMobile, dprMax: 1.25, fboScale: 0.34, heavyPost: false }
    : { tier: 'high', isMobile, dprMax: 1.75, fboScale: 0.5, heavyPost: true };
  return cached;
}
