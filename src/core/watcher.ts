'use client';

// 「被監視」結局的素材來源。
//
// 這裡蒐集的全是瀏覽器「自願暴露」給任何網站的環境訊號 —— 不需要任何權限、
// 不碰檔案、不讀別的分頁或別的網站的瀏覽記錄(那是瀏覽器沙箱從設計上就禁止的)。
// 所有欄位都只會回顯給使用者自己看,留在本機。
//
// 唯一一個對外請求是 probeGeo():向免費 IP 定位服務問「這個 IP 大概在哪個城市」,
// 那會把使用者的公開 IP 送給第三方。若不想要,別呼叫它即可,其餘一切照常運作。

export type Ambient = {
  weekday: string; // 星期幾
  dateStr: string; // 2026 年 7 月 6 日
  timeStr: string; // 03:33
  tz: string; // Asia/Taipei
  os: string;
  browser: string;
  lang: string; // 中文(繁體)
  screen: string; // 2560×1440
  win: string; // 1440×900
  cores: number | null;
  referrerHost: string | null;
  visitCount: number; // 本機第幾次抵達結局(含這次)
  firstSeen: string | null; // 本機第一次抵達結局的日期
};

export type Geo = { city: string | null; region: string | null; country: string | null };

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const LANG_NAMES: Record<string, string> = {
  'zh-tw': '中文(繁體)',
  'zh-hk': '中文(繁體)',
  'zh-cn': '中文(簡體)',
  zh: '中文',
  en: '英文',
  ja: '日文',
  ko: '韓文',
  fr: '法文',
  de: '德文',
  es: '西班牙文',
};

function parseOS(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return '未知系統';
}

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return '未知瀏覽器';
}

function langName(tag: string): string {
  const t = tag.toLowerCase();
  return LANG_NAMES[t] ?? LANG_NAMES[t.split('-')[0]] ?? tag;
}

const VISIT_KEY = 'sp.watch.visits';
const FIRST_KEY = 'sp.watch.first';

/** 立即可得的同步訊號。呼叫時順手把「抵達結局」的次數 +1 記進 localStorage。 */
export function gatherAmbient(): Ambient {
  const now = new Date();
  const two = (n: number) => String(n).padStart(2, '0');

  let visitCount = 1;
  let firstSeen: string | null = null;
  try {
    visitCount = (parseInt(localStorage.getItem(VISIT_KEY) ?? '0', 10) || 0) + 1;
    localStorage.setItem(VISIT_KEY, String(visitCount));
    firstSeen = localStorage.getItem(FIRST_KEY);
    if (!firstSeen) {
      firstSeen = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
      localStorage.setItem(FIRST_KEY, firstSeen);
    }
  } catch {
    // 無痕模式 / localStorage 被封鎖 —— 靜默降級成「第一次」
  }

  const ua = navigator.userAgent ?? '';
  let referrerHost: string | null = null;
  try {
    if (document.referrer) referrerHost = new URL(document.referrer).hostname;
  } catch {
    referrerHost = null;
  }

  return {
    weekday: WEEK[now.getDay()],
    dateStr: `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`,
    timeStr: `${two(now.getHours())}:${two(now.getMinutes())}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '未知時區',
    os: parseOS(ua),
    browser: parseBrowser(ua),
    lang: langName(navigator.language || ''),
    screen: `${window.screen.width}×${window.screen.height}`,
    win: `${window.innerWidth}×${window.innerHeight}`,
    cores: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
    referrerHost,
    visitCount,
    firstSeen,
  };
}

/** 可選的粗略地理定位:向免費 IP 服務問城市。失敗(離線 / 被擋 / 逾時)就回全 null。 */
export async function probeGeo(timeoutMs = 3500): Promise<Geo> {
  const empty: Geo = { city: null, region: null, country: null };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch('https://ipwho.is/', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return empty;
    const j = await res.json();
    if (j && j.success !== false) {
      return {
        city: j.city ?? null,
        region: j.region ?? null,
        country: j.country ?? null,
      };
    }
    return empty;
  } catch {
    return empty;
  }
}
