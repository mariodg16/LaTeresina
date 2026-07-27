import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useGame } from '@/lib/game-context';
import type { Card } from '@/lib/game-context';
import { PlayingCard } from '@/components/card';
import { evaluateBestHand } from '@/lib/poker';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Game() {
  const { roomState, playerName, hand, discardCard, revealTableCard } = useGame();
  const [, setLocation] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roomState) setLocation('/');
  }, [roomState, setLocation]);

  // Reset selection when phase changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [roomState?.phase]);

  if (!roomState) return null;

  const me = roomState.players.find(p => p.name === playerName);
  const isDealer = me?.isDealer ?? false;
  const isMyTurnToDiscard =
    roomState.phase === 'discard' && roomState.currentDiscardPlayerId === me?.socketId;
  const otherPlayers = roomState.players.filter(p => p.name !== playerName);
  const canSelect = roomState.phase === 'playing';

  // ── Split mano: coperte vs scoperta ─────────────────────────────────────
  const hiddenCards = hand.filter(c => !c.faceUp);
  const revealedCards = hand.filter(c => c.faceUp);

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleCard = useCallback((id: string) => {
    if (!canSelect) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [canSelect]);

  const clearSelection = () => setSelectedIds(new Set());

  // Collect selected cards for evaluation
  const selectedHandCards = hand.filter(c => selectedIds.has(c.id));
  const selectedTableCards = roomState.tableCards.filter(
    (c): c is Card => c !== null && c.faceUp === true && 'suit' in c && selectedIds.has(c.id)
  );
  const allSelected = [...selectedHandCards, ...selectedTableCards];
  const handResult = allSelected.length >= 1 ? evaluateBestHand(allSelected) : null;

  // ── Discard handler ──────────────────────────────────────────────────────
  const handleDiscard = (cardId: string) => {
    if (isMyTurnToDiscard) discardCard(cardId).catch(console.error);
  };

  // ── Reveal handler ───────────────────────────────────────────────────────
  const handleReveal = (position: number) => {
    if (!isDealer || roomState.phase !== 'playing') return;
    const card = roomState.tableCards[position];
    if (card && !card.faceUp) revealTableCard(position).catch(console.error);
  };

  // ── Table card click ─────────────────────────────────────────────────────
  const handleTableClick = (position: number) => {
    const card = roomState.tableCards[position];
    if (!card) return;
    if (!card.faceUp) {
      handleReveal(position);
    } else if (canSelect && 'suit' in card) {
      toggleCard(card.id);
    }
  };

  const currentDiscardPlayer = roomState.players.find(
    p => p.socketId === roomState.currentDiscardPlayerId
  );

  // ── Rank colour ──────────────────────────────────────────────────────────
  const rankColor = (rank: number) => {
    if (rank >= 9) return 'text-yellow-300';
    if (rank >= 7) return 'text-amber-400';
    if (rank >= 5) return 'text-primary';
    if (rank >= 3) return 'text-emerald-400';
    return 'text-muted-foreground';
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh flex flex-col bg-background relative overflow-hidden">

      {/* Opponents Row */}
      <div className="pt-4 pb-2 flex justify-center gap-6 px-4 flex-wrap">
        {otherPlayers.map(p => (
          <div
            key={p.socketId}
            className={cn(
              'flex flex-col items-center gap-1 transition-all',
              roomState.phase === 'discard' && roomState.currentDiscardPlayerId === p.socketId
                ? 'scale-110 opacity-100'
                : 'opacity-70'
            )}
          >
            <div className="flex relative items-end">
              {Array.from({ length: p.cardCount }).map((_, i) => {
                const visible = p.visibleCards?.[i - (p.cardCount - (p.visibleCards?.length ?? 0))];
                const isVisible = i >= p.cardCount - (p.visibleCards?.length ?? 0) && visible;
                return isVisible ? (
                  <div key={i} className={cn('shrink-0', i > 0 && '-ml-4')} style={{ zIndex: i }}>
                    <PlayingCard card={{ ...visible, faceUp: true }} size="sm" />
                  </div>
                ) : (
                  <div
                    key={i}
                    className={cn(
                      'w-8 h-12 bg-zinc-800 rounded-sm border border-zinc-600 shadow-sm shrink-0',
                      i > 0 && '-ml-4'
                    )}
                    style={{ zIndex: i }}
                  />
                );
              })}
            </div>
            <div className="bg-card/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border text-xs flex items-center gap-2 shadow-lg">
              {p.isDealer && <Crown className="w-3 h-3 text-primary" />}
              <span className="font-serif truncate max-w-[100px]">{p.name}</span>
              <span className="text-primary font-mono">{p.cardCount}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table (Cross layout) */}
      <div className="flex-1 flex items-center justify-center relative p-4">
        <div className="relative w-full max-w-[380px] aspect-square flex items-center justify-center">
          {/* Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            {roomState.tableCards[2] && (
              <div className="relative group">
                <PlayingCard
                  card={roomState.tableCards[2]}
                  size="table"
                  onClick={() => handleTableClick(2)}
                  highlighted={isDealer && roomState.phase === 'playing' && !roomState.tableCards[2].faceUp}
                  selected={selectedIds.has(roomState.tableCards[2].id)}
                />
                {!roomState.tableCards[2].faceUp && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-background/80 px-2 rounded">Centro</span>
                )}
              </div>
            )}
          </div>

          {/* Top */}
          <div className="absolute top-[5%] left-1/2 -translate-x-1/2">
            {roomState.tableCards[0] && (
              <div className="relative group">
                <PlayingCard
                  card={roomState.tableCards[0]}
                  size="table"
                  onClick={() => handleTableClick(0)}
                  highlighted={isDealer && roomState.phase === 'playing' && !roomState.tableCards[0].faceUp}
                  selected={selectedIds.has(roomState.tableCards[0].id)}
                />
                {!roomState.tableCards[0].faceUp && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-background/80 px-2 rounded">Sopra</span>
                )}
              </div>
            )}
          </div>

          {/* Bottom */}
          <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2">
            {roomState.tableCards[4] && (
              <div className="relative group">
                <PlayingCard
                  card={roomState.tableCards[4]}
                  size="table"
                  onClick={() => handleTableClick(4)}
                  highlighted={isDealer && roomState.phase === 'playing' && !roomState.tableCards[4].faceUp}
                  selected={selectedIds.has(roomState.tableCards[4].id)}
                />
                {!roomState.tableCards[4].faceUp && (
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-background/80 px-2 rounded">Sotto</span>
                )}
              </div>
            )}
          </div>

          {/* Left */}
          <div className="absolute top-1/2 left-[5%] -translate-y-1/2">
            {roomState.tableCards[1] && (
              <div className="relative group">
                <PlayingCard
                  card={roomState.tableCards[1]}
                  size="table"
                  onClick={() => handleTableClick(1)}
                  highlighted={isDealer && roomState.phase === 'playing' && !roomState.tableCards[1].faceUp}
                  selected={selectedIds.has(roomState.tableCards[1].id)}
                />
                {!roomState.tableCards[1].faceUp && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-background/80 px-2 rounded">Sinistra</span>
                )}
              </div>
            )}
          </div>

          {/* Right */}
          <div className="absolute top-1/2 right-[5%] -translate-y-1/2">
            {roomState.tableCards[3] && (
              <div className="relative group">
                <PlayingCard
                  card={roomState.tableCards[3]}
                  size="table"
                  onClick={() => handleTableClick(3)}
                  highlighted={isDealer && roomState.phase === 'playing' && !roomState.tableCards[3].faceUp}
                  selected={selectedIds.has(roomState.tableCards[3].id)}
                />
                {!roomState.tableCards[3].faceUp && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-background/80 px-2 rounded">Destra</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status / Hand Display Bar */}
      <div className="min-h-12 bg-black/40 backdrop-blur-md border-y border-border flex items-center justify-center relative z-20 px-4 py-2 gap-4">
        {roomState.phase === 'discard' && (
          <div className="flex items-center gap-2 text-primary text-center">
            {isMyTurnToDiscard ? (
              <span className="font-serif animate-pulse font-bold tracking-wide text-sm">
                È IL TUO TURNO — Seleziona una carta da passare in senso antiorario
              </span>
            ) : (
              <span className="font-serif text-muted-foreground text-sm">
                Fase di scarto — In attesa di {currentDiscardPlayer?.name}...
              </span>
            )}
          </div>
        )}

        {roomState.phase === 'playing' && !handResult && (
          <span className="font-serif text-muted-foreground tracking-wide text-sm text-center">
            {isDealer
              ? 'Sei il Mazziere — clicca le carte al centro per rivelarle.'
              : 'Seleziona le carte per mostrare il tuo punto.'}
          </span>
        )}

        {roomState.phase === 'playing' && handResult && (
          <div className="flex items-center gap-3">
            <span className={cn('font-serif font-bold text-lg tracking-wide', rankColor(handResult.rank))}>
              {handResult.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ({allSelected.length} {allSelected.length === 1 ? 'carta' : 'carte'})
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1 transition-colors"
            >
              Deseleziona
            </button>
          </div>
        )}
      </div>

      {/* Hand Area */}
      <div className={cn(
        'bg-card/30 border-t border-border pt-8 pb-12 relative',
        isMyTurnToDiscard && 'bg-primary/5 border-primary/20'
      )}>
        {/* Player name badge */}
        <div className="absolute top-0 left-4 -translate-y-1/2 bg-card border border-border px-4 py-1 rounded-full shadow-lg flex items-center gap-2 z-10">
          {me?.isDealer && <Crown className="w-4 h-4 text-primary" />}
          <span className="font-serif font-medium">{playerName}</span>
        </div>

        {canSelect && (
          <div className="absolute top-0 right-4 -translate-y-1/2 bg-card/80 border border-border px-3 py-1 rounded-full text-xs text-muted-foreground">
            Clicca per selezionare
          </div>
        )}

        {/* Cards layout: hidden fan + revealed card separated */}
        <div className="flex items-end justify-center gap-10 px-4 max-w-4xl mx-auto flex-wrap">

          {/* Fan di carte coperte */}
          {hiddenCards.length > 0 && (
            <div className="flex justify-center">
              {hiddenCards.map((card, i) => (
                <div
                  key={card.id}
                  className={cn(
                    'transition-all duration-300 hover:z-20',
                    (canSelect || isMyTurnToDiscard) && 'cursor-pointer',
                    !selectedIds.has(card.id) && 'hover:-translate-y-4',
                    selectedIds.has(card.id) && '-translate-y-8',
                    i > 0 && '-ml-6 sm:-ml-4'
                  )}
                  style={{ zIndex: selectedIds.has(card.id) ? 30 : i }}
                >
                  <PlayingCard
                    card={{ ...card, faceUp: true }}
                    size="lg"
                    onClick={() => {
                      if (isMyTurnToDiscard) handleDiscard(card.id);
                      else toggleCard(card.id);
                    }}
                    highlighted={isMyTurnToDiscard}
                    selected={canSelect && selectedIds.has(card.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Carta scoperta — separata e ben identificata */}
          {revealedCards.length > 0 && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 px-3 py-0.5 rounded-full bg-primary/10 whitespace-nowrap">
                Carta Scoperta
              </span>
              <div className="flex gap-2">
                {revealedCards.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      'transition-all duration-300',
                      (canSelect || isMyTurnToDiscard) && 'cursor-pointer',
                      !selectedIds.has(card.id) && 'hover:-translate-y-4',
                      selectedIds.has(card.id) && '-translate-y-8',
                    )}
                    style={{ zIndex: selectedIds.has(card.id) ? 30 : 1 }}
                  >
                    <PlayingCard
                      card={{ ...card, faceUp: true }}
                      size="lg"
                      onClick={() => {
                        if (isMyTurnToDiscard) handleDiscard(card.id);
                        else toggleCard(card.id);
                      }}
                      highlighted={isMyTurnToDiscard}
                      selected={canSelect && selectedIds.has(card.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caso: tutte le carte in mano sono scoperte (Modalità 2 iniziale) */}
          {hiddenCards.length === 0 && revealedCards.length === 0 && hand.length > 0 && (
            <div className="flex justify-center">
              {hand.map((card, i) => (
                <div
                  key={card.id}
                  className={cn(
                    'transition-all duration-300 hover:z-20',
                    (canSelect || isMyTurnToDiscard) && 'cursor-pointer',
                    !selectedIds.has(card.id) && 'hover:-translate-y-4',
                    selectedIds.has(card.id) && '-translate-y-8',
                    i > 0 && '-ml-6 sm:-ml-4'
                  )}
                  style={{ zIndex: selectedIds.has(card.id) ? 30 : i }}
                >
                  <PlayingCard
                    card={{ ...card, faceUp: true }}
                    size="lg"
                    onClick={() => {
                      if (isMyTurnToDiscard) handleDiscard(card.id);
                      else toggleCard(card.id);
                    }}
                    highlighted={isMyTurnToDiscard}
                    selected={canSelect && selectedIds.has(card.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
