import type { Room, Player, Card, RoomState, PlayerView } from "./types.js";
import { createDeck, shuffle } from "./deck.js";

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

export function createRoom(socketId: string, playerName: string, password: string): Room {
  const code = generateCode();
  const dealer: Player = {
    socketId,
    name: playerName,
    hand: [],
    isDealer: true,
    isFirstPlayer: false,
    shownCardIds: [],
  };
  const room: Room = {
    code,
    password,
    players: [dealer],
    tableCards: [null, null, null, null, null],
    gameMode: null,
    phase: "lobby",
    discardQueue: [],
    currentDiscardIndex: 0,
  };
  rooms.set(code, room);
  return room;
}

export type JoinError =
  | "NOT_FOUND"
  | "WRONG_PASSWORD"
  | "GAME_STARTED"
  | "ROOM_FULL"
  | "ALREADY_IN";

export function joinRoom(
  code: string,
  socketId: string,
  playerName: string,
  password: string
): { room: Room } | { error: JoinError } {
  const room = rooms.get(code);
  if (!room) return { error: "NOT_FOUND" };
  if (room.password !== password) return { error: "WRONG_PASSWORD" };
  if (room.phase !== "lobby") return { error: "GAME_STARTED" };
  if (room.players.length >= 7) return { error: "ROOM_FULL" };
  if (room.players.some((p) => p.socketId === socketId)) return { error: "ALREADY_IN" };

  const isFirstPlayer = room.players.length === 1;
  room.players.push({
    socketId,
    name: playerName,
    hand: [],
    isDealer: false,
    isFirstPlayer,
    shownCardIds: [],
  });

  // Recompute isFirstPlayer: always index 1 (next to dealer)
  room.players.forEach((p, i) => {
    p.isFirstPlayer = i === 1;
  });

  return { room };
}

export function getRoomBySocket(socketId: string): Room | null {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room;
  }
  return null;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code) ?? null;
}

export function removePlayer(socketId: string): Room | null {
  const room = getRoomBySocket(socketId);
  if (!room) return null;

  room.players = room.players.filter((p) => p.socketId !== socketId);

  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return null;
  }

  // If the dealer left during lobby, assign dealer to the first remaining player
  const hasDealer = room.players.some((p) => p.isDealer);
  if (!hasDealer) {
    room.players[0].isDealer = true;
  }

  // Recompute isFirstPlayer
  room.players.forEach((p, i) => {
    p.isFirstPlayer = i === 1;
  });

  return room;
}

/** Deal cards for the chosen game mode */
export function dealCards(room: Room, mode: 1 | 2 | 3): boolean {
  if (room.players.length < 2) return false;

  const deck = shuffle(createDeck());
  let idx = 0;

  if (mode === 3) {
    // Ascensore: 7 carte a terra tutte coperte
    // Posizioni: 0=centro, 1=sinistra-alto, 2=sinistra-medio, 3=sinistra-basso,
    //            4=destra-alto, 5=destra-medio, 6=destra-basso
    room.tableCards = Array.from({ length: 7 }, () => ({ ...deck[idx++], faceUp: false }));
    // Fase di scarto come Modalità 2: chi sta di mano riceve 6 carte, gli altri 5
    for (let i = 0; i < room.players.length; i++) {
      const count = room.players[i].isFirstPlayer ? 6 : 5;
      const hand: Card[] = [];
      for (let j = 0; j < count; j++) hand.push({ ...deck[idx++], faceUp: false });
      room.players[i].hand = hand;
    }
    room.gameMode = 3;
    // Coda scarto: chi sta di mano poi in senso antiorario
    const firstIdx = room.players.findIndex((p) => p.isFirstPlayer);
    const n = room.players.length;
    const orderedIds: string[] = [];
    for (let i = 0; i < n; i++) {
      orderedIds.push(room.players[(firstIdx - i + n) % n].socketId);
    }
    room.discardQueue = orderedIds;
    room.currentDiscardIndex = 0;
    room.phase = "discard";
    return true;
  }

  // Deal 5 table cards face-down (cross pattern) — Mod 1 e 2
  room.tableCards = Array.from({ length: 5 }, () => {
    const c = { ...deck[idx++], faceUp: false };
    return c;
  });

  if (mode === 1) {
    // Each player gets 4 face-down + 1 face-up
    for (const player of room.players) {
      const hand: Card[] = [];
      for (let i = 0; i < 4; i++) {
        hand.push({ ...deck[idx++], faceUp: false });
      }
      hand.push({ ...deck[idx++], faceUp: true });
      player.hand = hand;
    }
    room.gameMode = 1;
    room.phase = "playing";
  } else {
    // Mode 2: first player (index 1) gets 6 face-down, others get 5 face-down
    for (let i = 0; i < room.players.length; i++) {
      const count = room.players[i].isFirstPlayer ? 6 : 5;
      const hand: Card[] = [];
      for (let j = 0; j < count; j++) {
        hand.push({ ...deck[idx++], faceUp: false });
      }
      room.players[i].hand = hand;
    }
    room.gameMode = 2;
    // Build discard queue: start with first player, then COUNTER-CLOCKWISE
    const firstIdx = room.players.findIndex((p) => p.isFirstPlayer);
    const n = room.players.length;
    const orderedIds: string[] = [];
    for (let i = 0; i < n; i++) {
      orderedIds.push(room.players[(firstIdx - i + n) % n].socketId);
    }
    room.discardQueue = orderedIds;
    room.currentDiscardIndex = 0;
    room.phase = "discard";
  }

  return true;
}

/** Reveal a table card by position index (0–4 for mode 1/2, 0–3 for mode 3) */
export function revealTableCard(room: Room, position: number): boolean {
  if (position < 0 || position >= room.tableCards.length) return false;
  const card = room.tableCards[position];
  if (!card || card.faceUp) return false;
  card.faceUp = true;
  return true;
}

/**
 * Mode 2: current player discards a card (by card id) and optionally passes it
 * to the next player in the queue. Last player's discard is removed from game.
 * Returns false if it's not this player's turn or card not found.
 */
export function discardCard(
  room: Room,
  socketId: string,
  cardId: string
): boolean {
  if (room.phase !== "discard") return false;
  const currentPlayerId = room.discardQueue[room.currentDiscardIndex];
  if (currentPlayerId !== socketId) return false;

  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return false;

  const cardIdx = player.hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return false;

  const [discarded] = player.hand.splice(cardIdx, 1);

  const isLast = room.currentDiscardIndex === room.discardQueue.length - 1;

  if (!isLast) {
    // Pass the discarded card to the next player
    const nextPlayerId = room.discardQueue[room.currentDiscardIndex + 1];
    const nextPlayer = room.players.find((p) => p.socketId === nextPlayerId);
    if (nextPlayer) {
      nextPlayer.hand.push({ ...discarded, faceUp: false });
    }
  }
  // If last player, card is simply removed (discarded from game)

  room.currentDiscardIndex++;

  if (room.currentDiscardIndex >= room.discardQueue.length) {
    room.phase = "playing";
  }

  return true;
}

/** Update which cards a player is showing to opponents */
export function setShownCards(room: Room, socketId: string, cardIds: string[]): boolean {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return false;
  // Only allow showing cards that are actually in the player's hand
  player.shownCardIds = cardIds.filter((id) => player.hand.some((c) => c.id === id));
  return true;
}

/** Build the public room state (no private hands) */
export function buildRoomState(room: Room): RoomState {
  const playerViews: PlayerView[] = room.players.map((p) => ({
    socketId: p.socketId,
    name: p.name,
    isDealer: p.isDealer,
    isFirstPlayer: p.isFirstPlayer,
    cardCount: p.hand.length,
    visibleCards: p.hand.filter((c) => c.faceUp),
    shownCards: p.hand.filter((c) => p.shownCardIds.includes(c.id)),
  }));

  const currentDiscardPlayerId =
    room.phase === "discard"
      ? (room.discardQueue[room.currentDiscardIndex] ?? null)
      : null;

  // Only show table cards that are face-up; hide others (null)
  const tableCards = room.tableCards.map((c) =>
    c === null ? null : c.faceUp ? c : { ...c, suit: undefined as any, value: undefined as any, faceUp: false }
  );

  return {
    code: room.code,
    phase: room.phase,
    gameMode: room.gameMode,
    players: playerViews,
    tableCards,
    currentDiscardPlayerId,
  };
}

/** Build the table cards visible state — face-up cards shown, face-down masked */
export function buildTableState(room: Room): (Card | { id: string; faceUp: false } | null)[] {
  return room.tableCards.map((c) => {
    if (c === null) return null;
    if (c.faceUp) return c;
    return { id: c.id, faceUp: false };
  });
}
