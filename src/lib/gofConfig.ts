// ─────────────────────────────────────────────────────────────────────────────
// GOF CONFIG — Fetches app_config from Supabase, determines current season
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export interface GofConfig {
  active: boolean;
  featureActive: boolean;
  eventKey: string;
  icon: any; // require() result
  s1TitleEN: string;
  s1TitleZH: string;
  s1SubtitleEN: string;
  s1SubtitleZH: string;
  s2TitleEN: string;
  s2TitleZH: string;
  s2CtaEN: string;
  s2CtaZH: string;
  s2AdMsgEN: string;
  s2AdMsgZH: string;
  s3TitleEN: string;
  s3TitleZH: string;
  s3FlavourEN: string;
  s3FlavourZH: string;
  s3ShareEN: string;
  s3ShareZH: string;
  s3RateEN: string;
  s3RateZH: string;
  teaserEN: string;
  teaserZH: string;
}

// ── Icon Map ──────────────────────────────────────────────────────────────────
const ICONS: Record<string, any> = {
  default:       require('../assets/GoF.png'),
  cny:           require('../assets/GoF-cny.png'),
  hariraya:      require('../assets/GoF-hariraya.png'),
  fivetwenty:    require('../assets/GoF-fivetwenty.png'),
  dragonboat:    require('../assets/GoF-dragonboat.png'),
  qixi:          require('../assets/GoF-qixi.png'),
  nationalday:   require('../assets/GoF-nationalday.png'),
  ghost:         require('../assets/GoF-ghost.png'),
  midautumn:     require('../assets/GoF-midautumn.png'),
  deepavali:     require('../assets/GoF-deepavali.png'),
  double11:      require('../assets/GoF-double11.png'),
  wintersolstice:require('../assets/GoF-wintersolstice.png'),
};

// ── Hardcoded schedule (month/day ranges) — replace with gof_schedule table later ──
const SCHEDULE: { key: string; fromM: number; fromD: number; toM: number; toD: number }[] = [
  { key: 'cny',           fromM: 1,  fromD: 1,  toM: 3,  toD: 19 },
  { key: 'hariraya',      fromM: 3,  fromD: 20, toM: 5,  toD: 17 },
  { key: 'fivetwenty',    fromM: 5,  fromD: 18, toM: 5,  toD: 24 },
  { key: 'dragonboat',    fromM: 5,  fromD: 25, toM: 7,  toD: 27 },
  { key: 'qixi',          fromM: 7,  fromD: 28, toM: 8,  toD: 8  },
  { key: 'nationalday',   fromM: 8,  fromD: 9,  toM: 8,  toD: 9  },
  { key: 'ghost',         fromM: 8,  fromD: 10, toM: 9,  toD: 19 },
  { key: 'midautumn',     fromM: 9,  fromD: 20, toM: 10, toD: 14 },
  { key: 'deepavali',     fromM: 10, fromD: 15, toM: 11, toD: 8  },
  { key: 'double11',      fromM: 11, fromD: 9,  toM: 12, toD: 19 },
  { key: 'wintersolstice',fromM: 12, fromD: 20, toM: 12, toD: 31 },
];

function getCurrentEventKey(): string {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  for (const s of SCHEDULE) {
    const afterFrom = m > s.fromM || (m === s.fromM && d >= s.fromD);
    const beforeTo  = m < s.toM  || (m === s.toM  && d <= s.toD);
    if (afterFrom && beforeTo) return s.key;
  }
  return 'default';
}

function getVal(map: Record<string, string>, key: string, fallback = ''): string {
  return map[key] ?? fallback;
}

// ── Main fetch ────────────────────────────────────────────────────────────────
let cachedConfig: GofConfig | null = null;

export async function fetchGofConfig(): Promise<GofConfig> {
  if (cachedConfig) return cachedConfig;

  const { data } = await supabase.from('app_config').select('key, value');
  const map: Record<string, string> = {};
  (data || []).forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });

  const eventKey = getVal(map, 'gof_icon', 'default') === 'default'
    ? getCurrentEventKey()
    : getVal(map, 'gof_icon', 'default');

  const prefix = eventKey;

  cachedConfig = {
    active:        getVal(map, 'gof_active', 'true') === 'true',
    featureActive: getVal(map, 'gof_feature_active', 'false') === 'true',
    eventKey,
    icon: ICONS[eventKey] ?? ICONS.default,

    teaserEN:     getVal(map, 'gof_teaser_en', ''),
    teaserZH:     getVal(map, 'gof_teaser_zh', ''),

    s1TitleEN:    getVal(map, `${prefix}_s1_title_en`,    getVal(map, 'default_s1_title_en', '')),
    s1TitleZH:    getVal(map, `${prefix}_s1_title_zh`,    getVal(map, 'default_s1_title_zh', '')),
    s1SubtitleEN: getVal(map, `${prefix}_s1_subtitle_en`, getVal(map, 'default_s1_subtitle_en', '')),
    s1SubtitleZH: getVal(map, `${prefix}_s1_subtitle_zh`, getVal(map, 'default_s1_subtitle_zh', '')),

    s2TitleEN:    getVal(map, `${prefix}_s2_title_en`,    getVal(map, 'default_s2_title_en', '')),
    s2TitleZH:    getVal(map, `${prefix}_s2_title_zh`,    getVal(map, 'default_s2_title_zh', '')),
    s2CtaEN:      getVal(map, `${prefix}_s2_cta_en`,      getVal(map, 'default_s2_cta_en', '')),
    s2CtaZH:      getVal(map, `${prefix}_s2_cta_zh`,      getVal(map, 'default_s2_cta_zh', '')),
    s2AdMsgEN:    getVal(map, `${prefix}_s2_ad_msg_en`,   getVal(map, 'default_s2_ad_msg_en', '')),
    s2AdMsgZH:    getVal(map, `${prefix}_s2_ad_msg_zh`,   getVal(map, 'default_s2_ad_msg_zh', '')),

    s3TitleEN:    getVal(map, `${prefix}_s3_title_en`,    getVal(map, 'default_s3_title_en', '')),
    s3TitleZH:    getVal(map, `${prefix}_s3_title_zh`,    getVal(map, 'default_s3_title_zh', '')),
    s3FlavourEN:  getVal(map, `${prefix}_s3_flavour_en`,  getVal(map, 'default_s3_flavour_en', '')),
    s3FlavourZH:  getVal(map, `${prefix}_s3_flavour_zh`,  getVal(map, 'default_s3_flavour_zh', '')),
    s3ShareEN:    getVal(map, `${prefix}_s3_share_en`,    getVal(map, 'default_s3_share_en', '')),
    s3ShareZH:    getVal(map, `${prefix}_s3_share_zh`,    getVal(map, 'default_s3_share_zh', '')),
    s3RateEN:     getVal(map, `${prefix}_s3_rate_en`,     getVal(map, 'default_s3_rate_en', '')),
    s3RateZH:     getVal(map, `${prefix}_s3_rate_zh`,     getVal(map, 'default_s3_rate_zh', '')),
  };

  return cachedConfig;
}

export function clearGofCache() { cachedConfig = null; }
