import type { Server, Socket } from "socket.io";
import { logger } from "../lib/logger.js";
import {
  createRoom,
  joinRoom,
  getRoomBySocket,
  removePlayer,
  dealCards,
  revealTableCard,
  discardCard,
  setShownCards,
  buildRoomState,
  buildTableState,
} from "./rooms.js";

export function setupSocketIO(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    // ── Create room ──────────────────────────────────────────────────────────
    socket.on(
      "create_room",
      (data: { playerName: string; password: string }, callback: (res: object) => void) => {
        try {
          const name = String(data?.playerName ?? "").trim().slice(0, 20) || "Giocatore";
          const password = String(data?.password ?? "").trim().slice(0, 30);
          if (!password) { callback({ ok: false, error: "La password è obbligatoria" }); return; }
          const room = createRoom(socket.id, name, password);
          socket.join(room.code);
          logger.info({ roomCode: room.code, socketId: socket.id }, "Room created");
          callback({ ok: true, code: room.code });
          io.to(room.code).emit("room_state", buildRoomState(room));
        } catch (err) {
          logger.error({ err }, "create_room error");
          callback({ ok: false, error: "Errore nella creazione della stanza" });
        }
      }
    );

    // ── Join room ────────────────────────────────────────────────────────────
    socket.on(
      "join_room",
      (data: { code: string; playerName: string; password: string }, callback: (res: object) => void) => {
        try {
          const code = String(data?.code ?? "").toUpperCase().trim();
          const name = String(data?.playerName ?? "").trim().slice(0, 20) || "Giocatore";
          const password = String(data?.password ?? "").trim();
          const result = joinRoom(code, socket.id, name, password);
          if ("error" in result) {
            const msg: Record<string, string> = {
              NOT_FOUND:     "Stanza non trovata — controlla il codice",
              WRONG_PASSWORD:"Password errata",
              GAME_STARTED:  "La partita è già iniziata",
              ROOM_FULL:     "La stanza è piena (max 7 giocatori)",
              ALREADY_IN:    "Sei già in questa stanza",
            };
            callback({ ok: false, error: msg[result.error] ?? "Errore" });
            return;
          }
          const { room } = result;
          socket.join(room.code);
          logger.info({ roomCode: room.code, socketId: socket.id }, "Player joined room");
          callback({ ok: true, code: room.code });
          io.to(room.code).emit("room_state", buildRoomState(room));
        } catch (err) {
          logger.error({ err }, "join_room error");
          callback({ ok: false, error: "Errore nell'ingresso nella stanza" });
        }
      }
    );

    // ── Start game (dealer only) ─────────────────────────────────────────────
    socket.on(
      "start_game",
      (data: { mode: 1 | 2 | 3 }, callback: (res: object) => void) => {
        try {
          const room = getRoomBySocket(socket.id);
          if (!room) { callback({ ok: false, error: "Stanza non trovata" }); return; }

          const player = room.players.find((p) => p.socketId === socket.id);
          if (!player?.isDealer) { callback({ ok: false, error: "Solo il mazziere può iniziare" }); return; }
          if (room.phase !== "lobby") { callback({ ok: false, error: "Partita già iniziata" }); return; }
          if (room.players.length < 2) { callback({ ok: false, error: "Servono almeno 2 giocatori" }); return; }

          const raw = Number(data?.mode);
          const mode: 1 | 2 | 3 = raw === 2 ? 2 : raw === 3 ? 3 : 1;
          const ok = dealCards(room, mode);
          if (!ok) { callback({ ok: false, error: "Errore nella distribuzione" }); return; }

          logger.info({ roomCode: room.code, mode }, "Game started");
          callback({ ok: true });

          // Broadcast public state to all
          io.to(room.code).emit("room_state", buildRoomState(room));

          // Send private hands to each player
          for (const p of room.players) {
            io.to(p.socketId).emit("hand_update", { hand: p.hand });
          }
        } catch (err) {
          logger.error({ err }, "start_game error");
          callback({ ok: false, error: "Errore nell'avvio" });
        }
      }
    );

    // ── Reveal table card (dealer only) ──────────────────────────────────────
    socket.on(
      "reveal_table_card",
      (data: { position: number }, callback: (res: object) => void) => {
        try {
          const room = getRoomBySocket(socket.id);
          if (!room) { callback({ ok: false, error: "Stanza non trovata" }); return; }

          const player = room.players.find((p) => p.socketId === socket.id);
          if (!player?.isDealer) { callback({ ok: false, error: "Solo il mazziere può scoprire le carte" }); return; }
          if (room.phase !== "playing") { callback({ ok: false, error: "Non è la fase di gioco" }); return; }

          const position = Number(data?.position);
          const ok = revealTableCard(room, position);
          if (!ok) { callback({ ok: false, error: "Posizione non valida o carta già scoperta" }); return; }

          callback({ ok: true });
          io.to(room.code).emit("room_state", buildRoomState(room));
          io.to(room.code).emit("table_update", { tableCards: buildTableState(room) });
        } catch (err) {
          logger.error({ err }, "reveal_table_card error");
          callback({ ok: false, error: "Errore nello scoprire la carta" });
        }
      }
    );

    // ── Discard card (mode 2 pass-and-discard) ───────────────────────────────
    socket.on(
      "discard_card",
      (data: { cardId: string }, callback: (res: object) => void) => {
        try {
          const room = getRoomBySocket(socket.id);
          if (!room) { callback({ ok: false, error: "Stanza non trovata" }); return; }

          const cardId = String(data?.cardId ?? "");
          const ok = discardCard(room, socket.id, cardId);
          if (!ok) { callback({ ok: false, error: "Non è il tuo turno o carta non trovata" }); return; }

          callback({ ok: true });

          // Broadcast updated public state
          io.to(room.code).emit("room_state", buildRoomState(room));

          // Send updated private hands to all players (they may have received a card)
          for (const p of room.players) {
            io.to(p.socketId).emit("hand_update", { hand: p.hand });
          }
        } catch (err) {
          logger.error({ err }, "discard_card error");
          callback({ ok: false, error: "Errore nello scarto" });
        }
      }
    );

    // ── Show cards to opponents ──────────────────────────────────────────────
    socket.on(
      "show_cards",
      (data: { cardIds: string[] }) => {
        try {
          const room = getRoomBySocket(socket.id);
          if (!room || room.phase !== "playing") return;
          const cardIds = Array.isArray(data?.cardIds) ? data.cardIds.map(String) : [];
          setShownCards(room, socket.id, cardIds);
          // Broadcast updated room state so all players see the shown cards
          io.to(room.code).emit("room_state", buildRoomState(room));
        } catch (err) {
          logger.error({ err }, "show_cards error");
        }
      }
    );

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
      const room = removePlayer(socket.id);
      if (room) {
        io.to(room.code).emit("room_state", buildRoomState(room));
        io.to(room.code).emit("player_left", { socketId: socket.id });
      }
    });
  });
}
