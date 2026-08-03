import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useGame } from '@/lib/game-context';
import type { Card } from '@/lib/game-context';
import { PlayingCard } from '@/components/card';
import { evaluateBestHand } from '@/lib/poker';
import { Crown, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Game() {
  const { roomState, playerName, hand, discardCard, revealTableCard, showCards, startGame } = useGame();
  const [, setLocation] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedMode, setSelectedMode] = useState<number>(1);

  useEffect(() => {
    if (roomState?.gameMode) {
      setSelectedMode(roomState.gameMode);
    }
  }, [roomState?.gameMode]);

  useEffect(() => {
    if (!roomState) {
      const timer = setTimeout(() => {
        setLocation('/');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [roomState, setLocation]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [roomState?.phase]);

  useEffect(() => {
    if (roomState?.phase !== 'playing') return;
    const handCardIds = Array.from(selectedIds).filter(id => hand.some(c => c.id === id));
    showCards(handCardIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

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

  const players = roomState.players;
  const me = players.find(p => p.name === playerName);
  const myIndex = players.findIndex(p => p.name === playerName);
  const isDealer = me?.isDealer ?? false;
  const isMyTurnToDiscard =
    roomState.phase === 'discard' && roomState.currentDiscardPlayerId === me?.socketId;
  const otherPlayers = players.filter(p => p.name !== playerName);

  const dealerIndex = players.findIndex(p => p.isDealer);
  const rightOfDealerIndex = dealerIndex !== -1 ? (dealerIndex + 1) % players.length : -1;

  const hiddenCards = hand.filter(c => !c.faceUp);
  const revealedCards = hand.filter(c => c.faceUp);

  const clearSelection = () => setSelectedIds(new Set());

  const isTableSelectionValid = (selectedPositions: number[]) => {
    if (selectedPositions.length === 0) return true;
    const mode = roomState.gameMode || selectedMode;

    if (mode === 3) {
      const validLines = [
        [1, 4],
        [2, 0, 5],
        [3, 6]
      ];
      return validLines.some(line => selectedPositions.every(pos => line.includes(pos)));
    } else {
      const validLines = [
        [0, 2, 4],
        [1, 2, 3]
      ];
      return validLines.some(line => selectedPositions.every(pos => line.includes(pos)));
    }
  };

  const selectedHandCards = hand.filter(c => selectedIds.has(c.id));
  
  const selectedTableEntries = roomState.tableCards
    .map((c, idx) => ({ card: c, idx }))
    .filter(({ card }) => card !== null && card.faceUp === true && 'suit' in card && selectedIds.has(card!.id));

  const selectedTableCards = selectedTableEntries.map(e => e.card as Card);
  const selectedTablePositions = selectedTableEntries.map(e => e.idx);

  const tableValid = isTableSelectionValid(selectedTablePositions);
  const allSelected = [...selectedHandCards, ...selectedTableCards];
  const handResult = (allSelected.length >= 1 && tableValid) ? evaluateBestHand(allSelected) : null;

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

  // Funzione protetta per testare la distribuzione con log in console
  const handleTriggerStart = () => {
    console.log("Tentativo di avvio/distribuzione con modalità:", selectedMode);
    if (typeof startGame === 'function') {
      startGame(selectedMode);
    } else {
      console.error("startGame non è una funzione disponibile nel context!");
    }
  };

  const currentDiscardPlayer = players.find(
    p => p.socketId === roomState.currentDiscardPlayerId
  );

  const rankColor = (rank: number) => {
    if (rank >= 9) return 'text-yellow-300';
    if (rank >= 7) return 'text-amber-400';
    if (rank >= 5) return 'text-primary';
    if (rank >= 3) return 'text-emerald-400';
    return 'text-muted-foreground';
  };

  const TableCard = ({ position }: { position: number }) => {
    const card = roomState.tableCards[position];
    if (!card) return <div className="w-16 h-24 sm:w-20 sm:h-30 rounded-lg border border-dashed border-border/30 opacity-20" />;
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

  return (
    <div className="h-[100dvh] flex flex-col bg-background relative overflow-hidden select-none">

      {/* Pulsante fluttuante e selettore modalità per il mazziere */}
      {isDealer && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 bg-card/90 border border-border p-1.5 rounded-lg shadow-xl backdrop-blur-md">
          <select 
            value={selectedMode} 
            onChange={(e) => setSelectedMode(Number(e.target.value))}
            className="bg-background text-foreground text-[11px] border border-border rounded px-1.5 py-0.5 outline-none cursor-pointer"
          >
            <option value={1}>Mod. 1</option>
            <option value={2}>Mod. 2</option>
            <option value={3}>Ascensore</option>
          </select>
          <button
            type="button"
            onClick={handleTriggerStart}
            className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold rounded shadow flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Distribuisci carte"
          >
            <RotateCcw className="w-3 h-3" /> Distribuisci
          </button>
        </div>
      )}

      {/* Opponents Row */}
      <div className="pt-1.5 pb-1 flex justify-center gap-2 sm:gap-4 px-2 flex-wrap shrink-0">
        {otherPlayers.map(p => {
          const pIndex = players.findIndex(item => item.socketId === p.socketId);
          const isRightOfDealer = pIndex === rightOfDealerIndex;

          return (
            <div
              key={p.socketId}
              className={cn(
                'flex flex-col items-center gap-0.5 transition-all scale-85 sm:scale-95',
                roomState.phase === 'discard' && roomState.currentDiscardPlayerId === p.socketId
                  ? 'scale-100 opacity-100'
                  : 'opacity-80'
              )}
            >
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
                        'w-5 h-8 sm:w-7 sm:h-10 bg-zinc-800 rounded-sm border border-zinc-600 shadow-sm shrink-0',
                        i > 0 && '-ml-2.5'
                      )}
                      style={{ zIndex: i }}
                    />
                  );
                })}
              </div>

              <div className="bg-card/90 backdrop-blur-sm px-2 py-0.2 rounded-full border border-border text-[10px] flex items-center gap-1 shadow-md whitespace-nowrap">
                <span className="font-mono text-primary font-bold">#{pIndex + 1}</span>
                {p.isDealer && <Crown className="w-2.5 h-2.5 text-primary shrink-0" />}
                <span className="font-serif truncate max-w-[60px] sm:max-w-[80px]">{p.name}</span>
                <span className="text-primary font-mono">({p.cardCount})</span>
              </div>

              {isRightOfDealer && (
                <span className="text-[7px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.1 rounded-full uppercase tracking-wider font-semibold whitespace-nowrap">
                  1° di mano
                </span>
              )}

              {p.shownCards && p.shownCards.length > 0 && (
                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  <span className="text-[7px] font-bold uppercase tracking-widest text-primary/80 bg-primary/10 border border-primary/30 px-1 py-0.1 rounded-full">
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
          );
        })}
      </div>

      {/* Table */}
      <div className="flex-1 flex items-center justify-center p-1 overflow-hidden">
        {(roomState.gameMode || selectedMode) === 3 ? (
          <div className="flex flex-col items-center gap-0.5 scale-85 sm:scale-95">
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/70 mb-0.5">
              Ascensore
            </span>
            <div
              className="grid gap-1 sm:gap-1.5"
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
            className="grid gap-1 sm:gap-2 scale-85 sm:scale-95"
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

      {/* Status Bar */}
      <div className="py-2 bg-black/60 backdrop-blur-md border-y border-border flex items-center justify-center relative z-20 px-3 shrink-0">
        {roomState.phase === 'lobby' || roomState.phase === 'mode_selection' ? (
          <div className="flex flex-col items-center gap-2 w-full">
            {isDealer ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="font-serif font-bold text-primary text-xs sm:text-sm text-center">
                  Scegli modalità:
                </span>
                <button onClick={() => startGame(1)} className="px-2.5 py-1 bg-primary text-primary-foreground text-xs rounded-md font-bold flex items-center gap-1 cursor-pointer">
                  <Play className="w-3 h-3" /> Mod. 1
                </button>
                <button onClick={() => startGame(2)} className="px-2.5 py-1 bg-primary text-primary-foreground text-xs rounded-md font-bold flex items-center gap-1 cursor-pointer">
                  <Play className="w-3 h-3" /> Mod. 2
                </button>
                <button onClick={() => startGame(3)} className="px-2.5 py-1 bg-amber-500 text-amber-950 text-xs rounded-md font-bold flex items-center gap-1 cursor-pointer">
                  <Play className="w-3 h-3" /> Ascensore
                </button>
              </div>
            ) : (
              <span className="font-serif text-muted-foreground text-xs text-center animate-pulse">
                In attesa che il mazziere distribuisca le carte...
              </span>
            )}
          </div>
        ) : roomState.phase === 'discard' ? (
          <div className="text-center px-2">
            {isMyTurnToDiscard ? (
              <span className="font-serif animate-pulse font-bold text-primary text-xs block">
                È IL TUO TURNO — Seleziona una carta da passare
              </span>
            ) : (
              <span className="font-serif text-muted-foreground text-xs block">
                Fase di scarto — In attesa di {currentDiscardPlayer?.name}...
              </span>
            )}
          </div>
        ) : roomState.phase === 'playing' && !handResult ? (
          <div className="text-center px-2">
            <span className="font-serif text-muted-foreground text-xs block leading-relaxed">
              {isDealer
                ? 'Sei il Mazziere — clicca le carte al centro.'
                : !tableValid 
                  ? '⚠️ Selezione a terra non valida (usa righe o colonne corrette)'
                  : 'Seleziona le carte per mostrare il tuo punto.'}
            </span>
          </div>
        ) : roomState.phase === 'playing' && handResult ? (
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center text-center">
            <span className={cn('font-serif font-bold text-sm sm:text-base tracking-wide', rankColor(handResult.rank))}>
              {handResult.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({allSelected.length} {allSelected.length === 1 ? 'carta' : 'carte'})
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
            >
              Deseleziona
            </button>
          </div>
        ) : null}
      </div>

      {/* Hand Area */}
      <div className={cn(
        'bg-card/30 border-t border-border pt-4 pb-5 relative shrink-0',
        isMyTurnToDiscard && 'bg-primary/5 border-primary/20'
      )}>
        <div className="absolute top-0 left-4 -translate-y-1/2 bg-card border border-border px-3 py-0.5 rounded-full shadow-lg flex items-center gap-1.5 z-10 text-xs whitespace-nowrap">
          <span className="font-mono text-primary font-bold">#{myIndex !== -1 ? myIndex + 1 : 1}</span>
          {me?.isDealer && <Crown className="w-3 h-3 text-primary shrink-0" />}
          <span className="font-serif font-medium truncate max-w-[100px] sm:max-w-[140px]">{playerName}</span>
          {myIndex === rightOfDealerIndex && (
            <span className="text-[8px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.1 rounded-full uppercase tracking-wider font-semibold ml-1">
              1° di mano
            </span>
          )}
        </div>

        <div className="flex items-end justify-center gap-4 sm:gap-8 px-2 max-w-4xl mx-auto flex-wrap">
          {hiddenCards.length > 0 && (
            <div className="flex justify-center scale-85 sm:scale-95 origin-bottom">
              {hiddenCards.map((card, i) => (
                <div
                  key={card.id}
                  className={cn(
                    'transition-all duration-150 hover:z-20',
                    (canSelect || isMyTurnToDiscard) && 'cursor-pointer',
                    !selectedIds.has(card.id) && 'hover:-translate-y-3',
                    selectedIds.has(card.id) && '-translate-y-5',
                    i > 0 && '-ml-5 sm:-ml-3'
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
            <div className="flex flex-col items-center gap-1 scale-85 sm:scale-95 origin-bottom">
              <span className="text-[8px] font-bold uppercase tracking-widest text-primary border border-primary/40 px-2 py-0.1 rounded-full bg-primary/10 whitespace-nowrap">
                Carta Scoperta
              </span>
              <div className="flex gap-2">
                {revealedCards.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      'transition-all duration-150',
                      (canSelect || isMyTurnToDiscard) && 'cursor-pointer',
                      !selectedIds.has(card.id) && 'hover:-translate-y-3',
                      selectedIds.has(card.id) && '-translate-y-5',
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
