/**
 * Ming (命) config — ad unit, card image map, localised question list and UI strings.
 */
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';
import { QUESTIONS } from './tarotEngine';

// ── Ad unit ───────────────────────────────────────────────────────────────────
export const MING_AD_ID = __DEV__ ? TestIds.REWARDED : Platform.OS === 'ios'
  ? 'ca-app-pub-6984775309510247/4788169035'
  : 'ca-app-pub-6984775309510247/2353577383';

// ── Card images, indexed by engine cardId (0..21) ─────────────────────────────
export const CARD_BACK = require('../../assets/tarot/tarot_card_back.png');

export const CARD_IMAGES = [
  require('../../assets/tarot/major_00_the_fool.png'),
  require('../../assets/tarot/major_01_the_magician.png'),
  require('../../assets/tarot/major_02_the_high_priestess.png'),
  require('../../assets/tarot/major_03_the_empress.png'),
  require('../../assets/tarot/major_04_the_emperor.png'),
  require('../../assets/tarot/major_05_the_hierophant.png'),
  require('../../assets/tarot/major_06_the_lovers.png'),
  require('../../assets/tarot/major_07_the_chariot.png'),
  require('../../assets/tarot/major_08_strength.png'),
  require('../../assets/tarot/major_09_the_hermit.png'),
  require('../../assets/tarot/major_10_wheel_of_fortune.png'),
  require('../../assets/tarot/major_11_justice.png'),
  require('../../assets/tarot/major_12_the_hanged_man.png'),
  require('../../assets/tarot/major_13_death.png'),
  require('../../assets/tarot/major_14_temperance.png'),
  require('../../assets/tarot/major_15_the_devil.png'),
  require('../../assets/tarot/major_16_the_tower.png'),
  require('../../assets/tarot/major_17_the_star.png'),
  require('../../assets/tarot/major_18_the_moon.png'),
  require('../../assets/tarot/major_19_the_sun.png'),
  require('../../assets/tarot/major_20_judgement.png'),
  require('../../assets/tarot/major_21_the_world.png'),
] as const;

// ── Questions ─────────────────────────────────────────────────────────────────
// The engine ships English question text only; Chinese text lives here.
const QUESTION_ZH: Record<string, string> = {
  luck_today: '今日的运势象征什么？',
  career: '我在事业上应该思考什么？',
  love: '关于感情，我能领悟什么？',
  money: '关于金钱，我该考虑什么？',
  wellbeing: '什么能滋养我的身心？',
  month: '这个月有什么主题指引我？',
};

export interface MingQuestion {
  id: string;
  textEN: string;
  textZH: string;
  /** Number of cards in the spread (1, 3 or 5). */
  cards: number;
}

export const MING_QUESTIONS: MingQuestion[] = QUESTIONS.map(q => ({
  id: q.id,
  textEN: q.text,
  textZH: QUESTION_ZH[q.id] ?? q.text,
  cards: q.positions.length,
}));

// ── Position labels (the engine's position keys are English only) ─────────────
export const POSITION_ZH: Record<string, string> = {
  Theme: '主题', Situation: '处境', Challenge: '挑战', Guidance: '指引',
  Self: '自我', Connection: '关系', Present: '当下', Influence: '影响',
  'Next step': '下一步', 'Current needs': '当前需要', Balance: '平衡',
  'Self-care': '自我关怀', Foundation: '根基', Opportunity: '机遇',
  Support: '支持', Reflection: '回顾',
};

export const ELEMENT_ZH: Record<string, string> = {
  wood: '木', fire: '火', earth: '土', metal: '金', water: '水',
};

// ── Copy ──────────────────────────────────────────────────────────────────────
export const NUMBER_DISCLAIMER_EN = 'For entertainment only. Not a betting recommendation.';
export const NUMBER_DISCLAIMER_ZH = '仅供娱乐，不构成投注建议。';
