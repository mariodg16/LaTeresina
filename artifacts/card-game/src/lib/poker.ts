import type { Card } from './game-context';

export interface HandResult {
  rank: number; // 1 (Carta Alta) → 10 (Royal Flush)
  name: string; // Nome italiano
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  return [
    ...combinations(tail, k - 1).map((c) => [head, ...c]),
    ...combinations(tail, k),
  ];
}

// Carte napoletane: Asso=11 (alto) o 1 (basso), Fante=8, Cavallo=9, Re=10
function pokerValue(v: number): number {
  return v === 1 ? 11 : v;
}

function valueCounts(vals: number[]): number[] {
  const counts: Record<number, number> = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  return Object.values(counts).sort((a, b) => b - a);
}

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

function isStraight(vals: number[]): boolean {
  const uniq = [...new Set(vals)].sort((a, b) => a - b);
  if (uniq.length !== 5) return false;
  return uniq[4] - uniq[0] === 4;
}

function isAceLowStraight(vals: number[]): boolean {
  // Asso basso: A-2-3-4-5 → tratta l'asso come 1
  const mapped = vals.map((v) => (v === 11 ? 1 : v));
  const uniq = [...new Set(mapped)].sort((a, b) => a - b);
  return uniq.length === 5 && uniq[0] === 1 && uniq[4] === 5;
}

// ── Valutatore a 5 carte ──────────────────────────────────────────────────────

function evaluate5(cards: Card[]): HandResult {
  const vals = cards.map((c) => pokerValue(c.value)).sort((a, b) => a - b);
  const flush = isFlush(cards);
  const straight = isStraight(vals) || isAceLowStraight(vals);
  const counts = valueCounts(vals);

  // Royal Flush napoletano: 7-F(8)-C(9)-R(10)-A(11) stesso seme
  const isRoyal = flush && isStraight(vals) && vals.join(',') === '7,8,9,10,11';

  if (isRoyal)                   return { rank: 10, name: 'Royal Flush' };
  if (flush && straight)         return { rank: 9,  name: 'Scala Colore' };
  if (counts[0] === 4)           return { rank: 8,  name: 'Poker' };
  if (counts[0] === 3 && counts[1] === 2)
                                 return { rank: 7,  name: 'Full House' };
  if (flush)                     return { rank: 6,  name: 'Colore' };
  if (straight)                  return { rank: 5,  name: 'Scala' };
  if (counts[0] === 3)           return { rank: 4,  name: 'Tris' };
  if (counts[0] === 2 && counts[1] === 2)
                                 return { rank: 3,  name: 'Doppia Coppia' };
  if (counts[0] === 2)           return { rank: 2,  name: 'Coppia' };
  return                                { rank: 1,  name: 'Carta Alta' };
}

function evaluatePartial(cards: Card[]): HandResult | null {
  const vals = cards.map((c) => pokerValue(c.value));
  const counts = valueCounts(vals);

  // Con meno di 5 carte NON si possono fare Scala, Colore, Full o Scala Colore
  if (counts[0] === 4)           return { rank: 8, name: 'Poker' };
  if (counts[0] === 3)           return { rank: 4, name: 'Tris' };
  if (counts[0] === 2 && counts[1] === 2)
                                 return { rank: 3, name: 'Doppia Coppia' };
  if (counts[0] === 2)           return { rank: 2, name: 'Coppia' };
  
  // Selezionando 1 o più carte senza coppie/tris/poker restituisce Carta Alta
  if (cards.length > 0)          return { rank: 1, name: 'Carta Alta' };
  return null;
}

// ── API pubblica ──────────────────────────────────────────────────────────────

export function evaluateBestHand(cards: Card[]): HandResult | null {
  const valid = cards.filter((c): c is Card => 'suit' in c && 'value' in c);
  if (valid.length < 1) return null;

  // Se ci sono meno di 5 carte, valutiamo solo le combinazioni parziali ammesse (coppie, tris, poker, carta alta)
  if (valid.length < 5) {
    return evaluatePartial(valid);
  }

  // Se ci sono 5 o più carte, cerchiamo la combinazione migliore esaminando i gruppi da 5 (include Scala, Colore, Full, ecc.)
  const combos = combinations(valid, 5);
  let best: HandResult = { rank: 0, name: '' };
  for (const combo of combos) {
    const r = evaluate5(combo);
    if (r.rank > best.rank) best = r;
  }
  return best.rank > 0 ? best : null;
}
