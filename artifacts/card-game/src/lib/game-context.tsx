import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Carte napoletane
export type Suit = 'coppe' | 'denari' | 'bastoni' | 'spade';

export interface Card {
  id: string;
  suit: Suit;
  value: number; // 1=Asso, 2-7, 8=Fante, 9=Cavallo, 10=Re
  faceUp: boolean;
}

export interface PlayerView {
  socketId: string;
  name: string;
  isDealer: boolean;
  isFirstPlayer: boolean;
  cardCount: number;
  visibleCards: Card[];
}

export interface RoomState {
  code: string;
  phase: 'lobby' | 'mode_selection' | 'discard' | 'playing';
  gameMode: 1 | 2 | null;
  players: PlayerView[];
  tableCards: (Card | { id: string; faceUp: false } | null)[];
  currentDiscardPlayerId: string | null;
}

interface GameContextState {
  socket: Socket | null;
  playerName: string;
  roomState: RoomState | null;
  hand: Card[];
  isConnected: boolean;
  error: string | null;
  roomPassword: string | null;
  pendingRoomCode: string | null;

  setPlayerName: (name: string) => void;
  createRoom: (name: string, password: string) => Promise<string>;
  joinRoom: (code: string, name: string, password: string) => Promise<string>;
  startGame: (mode: 1 | 2) => Promise<void>;
  revealTableCard: (position: number) => Promise<void>;
  discardCard: (cardId: string) => Promise<void>;
  leaveRoom: () => void;
}

const GameContext = createContext<GameContextState | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roomPassword, setRoomPassword] = useState<string | null>(null);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io({ path: '/socket.io' });
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setRoomState(null);
      setHand([]);
    });
    newSocket.on('room_state', (state: RoomState) => {
      setRoomState(state);
      setPendingRoomCode(null);
      setError(null);
    });
    newSocket.on('hand_update', (data: { hand: Card[] }) => {
      setHand(data.hand);
    });
    newSocket.on('table_update', (data: { tableCards: RoomState['tableCards'] }) => {
      setRoomState(prev => prev ? { ...prev, tableCards: data.tableCards } : null);
    });
    newSocket.on('player_left', (data: { socketId: string }) => {
      setRoomState(prev =>
        prev ? { ...prev, players: prev.players.filter(p => p.socketId !== data.socketId) } : null
      );
    });

    return () => { newSocket.close(); };
  }, []);

  const handleSetPlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('playerName', name);
  };

  const createRoom = (name: string, password: string): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!socket) return reject('Socket non connesso');
      handleSetPlayerName(name);
      socket.emit('create_room', { playerName: name, password }, (res: { ok: boolean; code?: string; error?: string }) => {
        if (res.ok && res.code) {
          setRoomPassword(password);
          setPendingRoomCode(res.code);
          resolve(res.code);
        } else { setError(res.error || 'Errore'); reject(res.error); }
      });
    });

  const joinRoom = (code: string, name: string, password: string): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!socket) return reject('Socket non connesso');
      handleSetPlayerName(name);
      socket.emit('join_room', { code: code.toUpperCase(), playerName: name, password }, (res: { ok: boolean; code?: string; error?: string }) => {
        if (res.ok && res.code) {
          setRoomPassword(null);
          setPendingRoomCode(res.code);
          resolve(res.code);
        } else { setError(res.error || 'Errore'); reject(res.error); }
      });
    });

  const startGame = (mode: 1 | 2): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!socket) return reject('Socket non connesso');
      socket.emit('start_game', { mode }, (res: { ok: boolean; error?: string }) => {
        if (res.ok) resolve();
        else { setError(res.error || 'Errore'); reject(res.error); }
      });
    });

  const revealTableCard = (position: number): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!socket) return reject();
      socket.emit('reveal_table_card', { position }, (res: { ok: boolean; error?: string }) => {
        if (res.ok) resolve(); else reject(res.error);
      });
    });

  const discardCard = (cardId: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!socket) return reject();
      socket.emit('discard_card', { cardId }, (res: { ok: boolean; error?: string }) => {
        if (res.ok) resolve();
        else { setError(res.error || 'Errore'); reject(res.error); }
      });
    });

  const leaveRoom = () => {
    if (socket) {
      socket.disconnect();
      setTimeout(() => socket.connect(), 500);
      setRoomState(null);
      setHand([]);
      setRoomPassword(null);
      setPendingRoomCode(null);
    }
  };

  return (
    <GameContext.Provider value={{
      socket, playerName, roomState, hand, isConnected, error, roomPassword, pendingRoomCode,
      setPlayerName: handleSetPlayerName,
      createRoom, joinRoom, startGame, revealTableCard, discardCard, leaveRoom
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame deve essere usato dentro GameProvider');
  return context;
}
