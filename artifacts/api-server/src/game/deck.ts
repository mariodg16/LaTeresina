import type { Card, Suit } from "./types.js";

// Mazzo napoletano: 40 carte (4 semi × 10 valori: 1-7, Fante=8, Cavallo=9, Re=10)
const SUITS: Suit[] = ["coppe", "denari", "bastoni", "spade"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let value = 1; value <= 10; value++) {
      deck.push({ id: `${suit}-${value}`, suit, value, faceUp: false });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
