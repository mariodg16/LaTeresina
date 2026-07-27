// Carte napoletane: 4 semi × 10 valori = 40 carte
export type Suit = "coppe" | "denari" | "bastoni" | "spade";

export interface Card {
  id: string;
  suit: Suit;
  value: number; // 1–10 (1=Asso, 8=Fante, 9=Cavallo, 10=Re)
  faceUp: boolean;
}

export interface Player {
  socketId: string;
  name: string;
  hand: Card[];
  isDealer: boolean;
  isFirstPlayer: boolean; // "chi sta di mano" — giocatore alla sinistra del mazziere
}

export type GamePhase =
  | "lobby"
  | "mode_selection"
  | "discard"   // modalità 2: fase di scarto/passaggio
  | "playing";  // il mazziere può scoprire le carte

export interface Room {
  code: string;
  password: string;
  players: Player[];
  // Schema a croce: [sopra, sinistra, centro, destra, sotto]
  tableCards: (Card | null)[];
  gameMode: 1 | 2 | null;
  phase: GamePhase;
  discardQueue: string[];
  currentDiscardIndex: number;
}

export interface PlayerView {
  socketId: string;
  name: string;
  isDealer: boolean;
  isFirstPlayer: boolean;
  cardCount: number;
  /** Carte scoperte visibili a tutti (es. la quinta carta in Modalità 1) */
  visibleCards: Card[];
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  gameMode: 1 | 2 | null;
  players: PlayerView[];
  tableCards: (Card | null)[];
  currentDiscardPlayerId: string | null;
}

export interface HandUpdate {
  hand: Card[];
}
