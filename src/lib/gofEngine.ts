// ─────────────────────────────────────────────────────────────────────────────
// GOF ENGINE — Client-side metaphysics number generation
// All calculations are client-side, seeded by user inputs + today's date
// Same inputs on same day = same numbers (daily fixed)
// ─────────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female';
export type SoulColour = 'red' | 'yellow' | 'green' | 'white' | 'blue';

export interface GofInputs {
  day: number;
  month: number;
  year: number;
  gender: Gender;
  colour: SoulColour;
}

export interface GofProfile {
  zodiac: string;
  zodiacZH: string;
  element: string;
  elementZH: string;
  kuaNumber: number;
  kuaElement: string;
  kuaElementZH: string;
  loShuMissing: number[];
  chineseHour: string;
  chineseHourZH: string;
  colourElement: string;
  colourElementZH: string;
}

export interface GofNumbers {
  fourd: string[];   // 3 sets of 4-digit numbers
  toto: number[][];  // 2 sets of 6 numbers (1-49)
}

// ── Lookup Tables ─────────────────────────────────────────────────────────────

const ZODIAC_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
const ZODIAC_ZH = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const ZODIAC_EMOJI = ['🐭', '🐂', '🐯', '🐰', '🐲', '🐍', '🐴', '🐑', '🐒', '🐓', '🐕', '🐖'];

const ELEMENT_EN = ['Metal', 'Metal', 'Water', 'Water', 'Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth'];
const ELEMENT_ZH = ['金', '金', '水', '水', '木', '木', '火', '火', '土', '土'];

const KUA_ELEMENT_EN = ['', 'Water', 'Earth', 'Wood', 'Wood', 'Earth', 'Metal', 'Metal', 'Earth', 'Fire'];
const KUA_ELEMENT_ZH = ['', '水', '土', '木', '木', '土', '金', '金', '土', '火'];

// Lucky numbers by element
const ELEMENT_LUCKY: Record<string, number[]> = {
  Metal: [6, 7, 17, 27, 37, 47],
  Water: [1, 6, 11, 16, 21, 41],
  Wood:  [3, 4, 13, 23, 33, 43],
  Fire:  [2, 7, 12, 22, 32, 42],
  Earth: [5, 8, 15, 18, 25, 35],
};

const COLOUR_ELEMENT: Record<SoulColour, string> = {
  red:    'Fire',
  yellow: 'Earth',
  green:  'Wood',
  white:  'Metal',
  blue:   'Water',
};
const COLOUR_ELEMENT_ZH: Record<SoulColour, string> = {
  red:    '火',
  yellow: '土',
  green:  '木',
  white:  '金',
  blue:   '水',
};

// Chinese hours (十二时辰) by current hour
const CHINESE_HOURS_EN = [
  'Hour of the Rat (11pm–1am)', 'Hour of the Rat (11pm–1am)',
  'Hour of the Ox (1am–3am)',   'Hour of the Ox (1am–3am)',
  'Hour of the Tiger (3am–5am)','Hour of the Tiger (3am–5am)',
  'Hour of the Rabbit (5am–7am)','Hour of the Rabbit (5am–7am)',
  'Hour of the Dragon (7am–9am)','Hour of the Dragon (7am–9am)',
  'Hour of the Snake (9am–11am)','Hour of the Snake (9am–11am)',
  'Hour of the Horse (11am–1pm)','Hour of the Horse (11am–1pm)',
  'Hour of the Goat (1pm–3pm)',  'Hour of the Goat (1pm–3pm)',
  'Hour of the Monkey (3pm–5pm)','Hour of the Monkey (3pm–5pm)',
  'Hour of the Rooster (5pm–7pm)','Hour of the Rooster (5pm–7pm)',
  'Hour of the Dog (7pm–9pm)',   'Hour of the Dog (7pm–9pm)',
  'Hour of the Pig (9pm–11pm)',  'Hour of the Pig (9pm–11pm)',
];
const CHINESE_HOURS_ZH = [
  '子时（晚上11点至凌晨1点）','子时（晚上11点至凌晨1点）',
  '丑时（凌晨1点至3点）',    '丑时（凌晨1点至3点）',
  '寅时（凌晨3点至5点）',    '寅时（凌晨3点至5点）',
  '卯时（早上5点至7点）',    '卯时（早上5点至7点）',
  '辰时（早上7点至9点）',    '辰时（早上7点至9点）',
  '巳时（早上9点至11点）',   '巳时（早上9点至11点）',
  '午时（中午11点至1点）',   '午时（中午11点至1点）',
  '未时（下午1点至3点）',    '未时（下午1点至3点）',
  '申时（下午3点至5点）',    '申时（下午3点至5点）',
  '酉时（下午5点至7点）',    '酉时（下午5点至7点）',
  '戌时（晚上7点至9点）',    '戌时（晚上7点至9点）',
  '亥时（晚上9点至11点）',   '亥时（晚上9点至11点）',
];

// ── Seeded RNG (Mulberry32) ───────────────────────────────────────────────────

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(inputs: GofInputs): () => number {
  const today = new Date().toDateString();
  const seedStr = `${inputs.day}-${inputs.month}-${inputs.year}-${inputs.gender}-${inputs.colour}-${today}`;
  return mulberry32(hashCode(seedStr));
}

// ── Calculations ──────────────────────────────────────────────────────────────

function getZodiac(year: number) {
  const idx = ((year - 1900) % 12 + 12) % 12;
  return {
    en: `${ZODIAC_EMOJI[idx]} Year of the ${ZODIAC_EN[idx]}`,
    zh: `${ZODIAC_EMOJI[idx]} ${ZODIAC_EN[idx]}年`,
    animal: ZODIAC_EN[idx],
  };
}

function getElement(year: number) {
  const idx = year % 10;
  return { en: ELEMENT_EN[idx], zh: ELEMENT_ZH[idx] };
}

function getKuaNumber(year: number, gender: Gender): number {
  const yearStr = String(year);
  let sum = yearStr.split('').reduce((a, b) => a + parseInt(b), 0);
  while (sum >= 10) sum = String(sum).split('').reduce((a, b) => a + parseInt(b), 0);

  let kua: number;
  if (gender === 'male') {
    kua = year >= 2000 ? (9 - sum) : (10 - sum);
    if (kua <= 0) kua += 9;
    if (kua === 5) kua = 2;
  } else {
    kua = year >= 2000 ? (sum + 6) : (sum + 5);
    while (kua > 9) kua -= 9;
    if (kua === 5) kua = 8;
  }
  return kua;
}

function getLoShuMissing(day: number, month: number): number[] {
  const digits = new Set<number>();
  [day, month].forEach(n => {
    String(n).split('').forEach(d => {
      const num = parseInt(d);
      if (num >= 1 && num <= 9) digits.add(num);
    });
  });
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => !digits.has(n));
}

function getChineseHour(): { en: string; zh: string } {
  const hour = new Date().getHours();
  const adjustedHour = hour === 23 ? 0 : hour + 1;
  const idx = Math.floor(adjustedHour / 2) % 12;
  return { en: CHINESE_HOURS_EN[idx * 2], zh: CHINESE_HOURS_ZH[idx * 2] };
}

// ── Number Generation ─────────────────────────────────────────────────────────

function generateFourdSet(rng: () => number, luckyNums: number[]): string {
  // Build digit pool weighted toward lucky numbers
  const pool: number[] = [];
  for (let d = 0; d <= 9; d++) {
    const weight = luckyNums.some(n => n % 10 === d) ? 4 : 1;
    for (let w = 0; w < weight; w++) pool.push(d);
  }
  const digits = Array.from({ length: 4 }, () => pool[Math.floor(rng() * pool.length)]);
  return digits.join('').padStart(4, '0');
}

function generateTotoSet(rng: () => number, luckyNums: number[]): number[] {
  const pool: number[] = [];
  for (let n = 1; n <= 49; n++) {
    const weight = luckyNums.includes(n) ? 4 : 1;
    for (let w = 0; w < weight; w++) pool.push(n);
  }
  const picked = new Set<number>();
  while (picked.size < 6) {
    picked.add(pool[Math.floor(rng() * pool.length)]);
  }
  return Array.from(picked).sort((a, b) => a - b);
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function computeProfile(inputs: GofInputs): GofProfile {
  const zodiac    = getZodiac(inputs.year);
  const element   = getElement(inputs.year);
  const kuaNum    = getKuaNumber(inputs.year, inputs.gender);
  const loShu     = getLoShuMissing(inputs.day, inputs.month);
  const chiHour   = getChineseHour();
  const colEl     = COLOUR_ELEMENT[inputs.colour];
  const colElZH   = COLOUR_ELEMENT_ZH[inputs.colour];

  return {
    zodiac:         zodiac.en,
    zodiacZH:       zodiac.zh,
    element:        element.en,
    elementZH:      element.zh,
    kuaNumber:      kuaNum,
    kuaElement:     KUA_ELEMENT_EN[kuaNum] || 'Earth',
    kuaElementZH:   KUA_ELEMENT_ZH[kuaNum] || '土',
    loShuMissing:   loShu,
    chineseHour:    chiHour.en,
    chineseHourZH:  chiHour.zh,
    colourElement:  colEl,
    colourElementZH: colElZH,
  };
}

export function generateNumbers(inputs: GofInputs, profile: GofProfile): GofNumbers {
  const rng = makeRng(inputs);

  // Combine lucky numbers from all sources
  const luckyPool = new Set<number>([
    ...ELEMENT_LUCKY[profile.element] || [],
    ...ELEMENT_LUCKY[profile.kuaElement] || [],
    ...ELEMENT_LUCKY[profile.colourElement] || [],
    ...profile.loShuMissing.filter(n => n <= 49),
  ]);
  const luckyNums = Array.from(luckyPool);

  return {
    fourd: Array.from({ length: 3 }, () => generateFourdSet(rng, luckyNums)),
    toto:  Array.from({ length: 2 }, () => generateTotoSet(rng, luckyNums)),
  };
}
