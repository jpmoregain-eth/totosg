/**
 * Ming (命) engine adapter — wraps tarot engine v1.2 for React Native.
 *
 * All randomness comes from the OS secure RNG via react-native-get-random-values.
 * There is deliberately NO Math.random() fallback: if secure random is not
 * available we throw rather than deal a weak shuffle.
 */
import 'react-native-get-random-values';
import {
  VERSION, CARDS, createReading, explainNumberSymbolism, generateNumbers,
  prepareSpread, revealSelection,
  type Draw, type Locale, type Reading, type RandomBytes,
} from './tarotEngine';

export { VERSION as ENGINE_VERSION, CARDS };
export type { Draw, Locale, Reading };

const secureBytes: RandomBytes = (length: number) => {
  const g = (globalThis as any).crypto;
  if (!g || typeof g.getRandomValues !== 'function') {
    throw new Error('Secure random source unavailable');
  }
  const out = new Uint8Array(length);
  g.getRandomValues(out);
  return out;
};

/** Everything that must be fixed once the cards are dealt. Text is derived from it. */
export interface MingDeal {
  questionId: string;
  draws: Draw[];
  numbers: { fourD: string[]; toto: number[][] };
}

/**
 * Shuffle, commit to the deck, and fix the draw (cards + orientations) and the
 * entertainment numbers. The UI then just flips the cards face-up one by one.
 * Cards 0..N-1 on screen map to deck positions 0..N-1.
 */
export function dealReading(questionId: string, cardCount: number): MingDeal {
  const prepared = prepareSpread(questionId, secureBytes);
  const indices = Array.from({ length: cardCount }, (_, i) => i);
  const draws = revealSelection(prepared, indices, secureBytes);
  // 2 sets of 4D + 2 sets of TOTO. Uniformly random — independent of the cards.
  const numbers = generateNumbers(secureBytes, 2, 2);
  return { questionId, draws, numbers };
}

/** Build the bilingual reading text for a deal. Safe to call again when the language toggles. */
export function buildReading(deal: MingDeal, locale: Locale): Reading {
  const base = createReading(deal.questionId, deal.draws, locale);
  const zh = locale === 'zh';
  return {
    ...base,
    numbers: {
      ...deal.numbers,
      explanation: zh
        ? '随机生成的娱乐号码，与抽中的牌没有预测性关联。'
        : 'Random entertainment combinations; the selected cards do not improve winning odds.',
      symbolism: explainNumberSymbolism(deal.draws, locale),
    },
  };
}
