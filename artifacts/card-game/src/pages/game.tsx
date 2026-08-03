import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useGame } from '@/lib/game-context';
import type { Card } from '@/lib/game-context';
import { PlayingCard } from '@/components/card';
import { evaluateBestHand } from '@/lib/poker';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Game() {
  const { roomState, playerName, hand, discardCard, revealTableCard, showCards, selectGameMode } = useGame();
  const [, setLocation] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roomState) setLocation('/');
  }, [roomState, setLocation]);

  // Reset selection when phase changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [roomState?.phase]);

  // Broadcast selected hand cards to opponents whenever selection changes
  useEffect(() => {
    if (roomState?.phase !== 'playing') return;
    const handCardIds = Array.from(selectedIds).filter(id => hand.some(c => c.id === id));
    showCards(handCardIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // ── Tutte le callback/hook prima del guard ───────────────────────────────
  const canSelect = roomState?.phase === 'playing';

  const toggleCard = useCallback((id: string) => {
    if (!canSelect) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [canSelect]);

  if (!roomState) return null;

  const me = roomState.players.find(p => p.name === playerName);
  const isDealer = me?.isDealer ?? false;
  const isMyTurnToDiscard =
    roomState.phase === 'discard' && roomState.currentDiscardPlayerId === me?.socketId;
  const otherPlayers = roomState.players.filter(p => p.name !== playerName);

  // ── Split mano: coperte vs scoperta ─────────────────────────────────────
  const hiddenCards = hand.filter(c => !c.faceUp);
  const revealedCards = hand.filter(c => c.faceUp);

  const clearSelection = () => setSelectedIds(new Set());

  // Collect selected cards for evaluation
  const selectedHandCards = hand.filter(c => selectedIds.has(c.id));
  const selectedTableCards = roomState.tableCards.filter(
    (c): c is Card => c !== null && c.faceUp === true && 'suit' in c && selectedIds.has(c.id)
  );
  const allSelected = [...selectedHandCards, ...selectedTableCards];
  const handResult = allSelected.length >= 1 ? evaluateBestHand(allSelected) : null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDiscard = (cardId: string) => {
    if (isMyTurnToDiscard) discardCard(cardId).catch(console.error);
  };

  const handleReveal = (position: number) => {
    if (!isDealer || roomState.phase !== 'playing') return;
    const card = roomState.tableCards[position];
    if (card && !card.faceUp) revealTableCard(position).catch(console.error);
  };

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

  const rankColor = (rank: number) => {
    if (rank >= 9) return 'text-yellow-300';
    if (rank >= 7) return 'text-amber-400';
    if (rank >= 5) return 'text-primary';
    if (rank >= 3) return 'text-emerald-400';
    return 'text-muted-foreground';
  };

  // ── Table card helper ─────────────────────────────────────────────────────
  const TableCard = ({ position }: { position: number }) => {
    const card = roomState.tableCards[position];
    if (!card) return <div className="w-20 h-28 sm:w-24 sm:h-36 rounded-lg border border-dashed border-border/30 opacity-20" />;
    return (
      <div className="relative group">
        <PlayingCard
          card={card}
          size="table"
          onClick={() => handleTableClick(position)}
          highlighted={isDealer && roomState.phase === 'playing' && !card.faceUp}
          selected={'suit' in card && selectedIds.has(card.id)}
        />
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] flex flex-col bg-background relative overflow-hidden">

      {/* Opponents Row */}
      <div className="py-2 flex justify-center gap-2 sm:gap-4 px-2 flex-wrap shrink-0">
        {otherPlayers.map(p => (
          <div
            key={p.socketId}
            className={cn(
              'flex flex-col items-center gap-0.5 transition-all scale-90 sm:scale-100',
              roomState.phase === 'discard' && roomState.currentDiscardPlayerId === p.socketId
                ? 'scale-105 opacity-100'
                : 'opacity-80'
            )}
          >
            {/* Hand silhouette + visible cards */}
            <div className="flex relative items-end">
              {Array.from({ length: p.cardCount }).map((_, i) => {
                const visible = p.visibleCards?.[i - (p.cardCount - (p.visibleCards?.length ?? 0))];
                const isVisible = i >= p.cardCount - (p.visibleCards?.length ?? 0) && visible;
                return isVisible ? (
                  <div key={i} className={cn('shrink-0', i > 0 && '-ml-3')} style={{ zIndex: i }}>
                    <PlayingCard card={{ ...visible, faceUp: true }} size="sm" />
                  </div>
                ) : (
                  <div
                    key={i}
                    className={cn(
                      'w-6 h-9 sm:w-8 sm:h-12 bg-zinc-800 rounded-sm border border-zinc-600 shadow-sm shrink-0',
                      i > 0 && '-ml-3'
                    )}
                    style={{ zIndex: i }}
                  />
                );
              })}
            </div>

            {/* Name badge */}
            <div className="bg-card/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border text-[10px] sm:text-xs flex items-center gap-1.5 shadow-lg">
              {p.isDealer && <Crown className="w-2.5 h-2.5 text-primary" />}
              <span className="font-serif truncate max-w-[70px] sm:max-w-[90px]">{p.name}</span>
              <span className="text-primary font-mono">{p.cardCount}</span>
            </div>

            {/* Carte che l'avversario sta mostrando */}
            {p.shownCards && p.shownCards.length > 0 && (
              <div className="flex flex-col items-center gap-0.5 mt-0.5">
                <span className="text-[8px] font-bold uppercase tracking-widest text-primary/80 bg-primary/10 border border-primary/30 px-1.5 py-0.2 rounded-full">
                  Mostra
                </span>
                <div className="flex gap-1">
                  {p.shownCards.map(card => (
                    <PlayingCard
                      key={card.id}
                      card={{ ...card, faceUp: true }}
                      size="sm"
                      selected
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        {roomState.gameMode === 3 ? (
          <div className="flex flex-col items-center gap-1 scale-90 sm:scale-100">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70 mb-0.5">
              Ascensore
            </span>
            <div
              className="grid gap-1 sm:gap-2"
              style={{ gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto auto' }}
            >
              <TableCard position={1} />
              <div />
              <TableCard position={4} />
              <TableCard position={2} />
              <TableCard position={0} />
              <TableCard position={5} />
              <TableCard position={3} />
              <div />
              <TableCard position={6} />
            </div>
          </div>
        ) : (
          <div
            className="grid gap-1.5 sm:gap-3 scale-90 sm:scale-100"
            style={{ gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto auto' }}
          >
            <div />
            <TableCard position={0} />
            <div />
            <TableCard position={1} />
            <TableCard position={2} />
            <TableCard position={3} />
            <div />
            <TableCard position={4} />
            <div />
          </div>
        )}
      </div>

      {/* Status Bar / Selezione Modalità */}
      <div className="h-16 sm:h-20 bg-black/40 backdrop-blur-md border-y border-border flex items-center justify-center relative z-20 px-3 py-1 gap-2 shrink-0">
        {roomState.phase === 'mode-select' ? (
          <div className="flex flex-col items-center gap-1">
            {isDealer ? (
              <>
                <span className="font-serif font-bold text-primary text-xs sm:text-sm animate-pulse">
                  Tocca a te (Mazziere): scegli la modalità di gioco
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => selectGameMode?.(1)}
                    className="px-2.5 py-1 bg-primary/20 hover:bg-primary/30 border border-primary text-xs rounded-lg font-medium text-foreground transition-colors"
                  >
                    Modalità 1
                  </button>
                  <button
                    onClick={() => selectGameMode?.(2)}
                    className="px-2.5 py-1 bg-primary/20 hover:bg-primary/30 border border-primary text-xs rounded-lg font-medium text-foreground transition-colors"
                  >
                    Modalità 2
                  </button>
                  <button
                    onClick={() => selectGameMode?.(3)}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500 text-xs rounded-lg font-medium text-amber-300 transition-colors"
                  >
                    Ascensore (Mod. 3)
                  </button>
                </div>
              </>
            ) : (
              <span className="font-serif text-muted-foreground text-xs sm:text-sm animate-pulse">
                In attesa che il mazziere scelga la modalità...
              </span>
            )}
          </div>
        ) : roomState.phase === 'discard' ? (
          <div className="flex items-center gap-2 text-primary text-center">
            {isMyTurnToDiscard ? (
              <span className="font-serif animate-pulse font-bold tracking-wide text-xs sm:text-sm">
                È IL TUO TURNO — Seleziona una carta da passare
              </span>
            ) : (
              <span className="font-serif text-muted-foreground text-xs sm:text-sm">
                Fase di scarto — In attesa di {currentDiscardPlayer?.name}...
              </span>
            )}
          </div>
        ) : roomState.phase === 'playing' && !handResult ? (
          <span className="font-serif text-muted-foreground tracking-wide text-xs sm:text-sm text-center">
            {isDealer
              ? 'Sei il Mazziere — clicca le carte al centro.'
              : 'Seleziona le carte per mostrare il tuo punto.'}
          </span>
        ) : roomState.phase === 'playing' && handResult ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={cn('font-serif font-bold text-base sm:text-lg tracking-wide', rankColor(handResult.rank))}>
              {handResult.name}
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              ({allSelected.length} {allSelected.length === 1 ? 'carta' : 'carte'})
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1 transition-colors"
            >
              Deseleziona
            </button>
          </div>
        ) : null}
      </div>

      {/* Hand Area */}
      <div className={cn(
        'bg-card/30 border-t border-border pt-6 pb-6 sm:pb-8 relative shrink-0',
        isMyTurnToDiscard && 'bg-primary/5 border-primary/20'
      )}>
        <div className="absolute top-0 left-4 -translate-y-1/2 bg-card border border-border px-3 py-0.5 rounded-full shadow-lg flex items-center gap-1.5 z-10 text-xs">
          {me?.isDealer && <Crown className="w-3.5 h-3.5 text-primary" />}
          <span className="font-serif font-medium">{playerName}</span>
        </div>

        {canSelect && (
          <div className="absolute top-0 right-4 -translate-y-1/2 bg-card/80 border border-border px-2.5 py-0.5 rounded-full text-[10px] text-muted-foreground">
            Clicca per selezionare
          </div>
        )}

        <div className="flex items-end justify-center gap-6 sm:gap-10 px-2 max-w-4xl mx-auto flex-wrap">
          {hiddenCards.length > 0 && (
            <div className="flex justify-center scale-90 sm:scale-100 origin-bottom">
              {hiddenCards.map((card, i) => (
                <div
                  key={card.id}
                  className={cn(
                    'transition-all duration-300 hover:z-20',
                    (canSelect || isMyTurnToDiscard) && 'cursor-pointer',
                    !selectedIds.has(card.id) && 'hover:-translate-y-3',
                    selectedIds.has(card.id) && '-translate-y-6',
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

          {revealedCards.length > 0 && (
            <div className="flex flex-col items-center gap-1 scale-90 sm:scale-100 origin-bottom">
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary border border-primary/40 px-2 py-0.2 rounded-full bg-primary/10 whitespace-nowrap">
                Carta Scoperta
              </span>
              <div className="flex gap-2">
                {revealedCards.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      'transition-all duration-300',
                      (canSelect || isMyTurnToDiscard) && 'cursor-pointer',
                      !selectedIds.has(card.id) && 'hover:-translate-y-3',
                      selectedIds.has(card.id) && '-translate-y-6',
                    )}
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
        </div>
      </div>
    </div>
  );
}
