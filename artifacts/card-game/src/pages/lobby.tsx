import { useGame } from '@/lib/game-context';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Copy, CheckCircle2, LogOut, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Lobby() {
  const { roomState, playerName, roomPassword, pendingRoomCode, leaveRoom, startGame } = useGame();
  const [, setLocation] = useLocation();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (!roomState && !pendingRoomCode) {
      setLocation('/');
    } else if (roomState && (roomState.phase === 'discard' || roomState.phase === 'playing')) {
      setLocation('/game');
    }
  }, [roomState, pendingRoomCode, setLocation]);

  if (!roomState) return null;

  const me = roomState.players.find(p => p.name === playerName);
  const isDealer = me?.isDealer || false;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const handleCopyCode = async () => {
    await copyToClipboard(roomState.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyAll = async () => {
    const text = roomPassword
      ? `La Teresina\nCodice: ${roomState.code}\nPassword: ${roomPassword}`
      : `La Teresina\nCodice: ${roomState.code}`;
    await copyToClipboard(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleLeave = () => {
    leaveRoom();
    setLocation('/');
  };

  const canStart = roomState.players.length >= 2;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-lg bg-card/60 backdrop-blur-md border border-border p-8 rounded-3xl shadow-2xl relative">

        <Button
          variant="ghost" size="icon"
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground"
          onClick={handleLeave}
        >
          <LogOut className="h-5 w-5" />
        </Button>

        {/* Codice + password da condividere */}
        <div className="text-center space-y-3 mb-8">
          <h2 className="text-primary text-xs font-bold uppercase tracking-widest">
            {isDealer ? 'Condividi con gli altri giocatori' : 'Stanza'}
          </h2>

          <div
            className="flex items-center justify-center gap-4 group cursor-pointer"
            onClick={handleCopyCode}
          >
            <span className="text-6xl font-mono font-bold tracking-[0.2em] text-foreground group-hover:text-primary transition-colors">
              {roomState.code}
            </span>
            {copiedCode
              ? <CheckCircle2 className="h-7 w-7 text-green-500" />
              : <Copy className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
            }
          </div>

          {/* Password — visibile solo al creatore */}
          {isDealer && roomPassword && (
            <div className="flex items-center justify-center gap-2 bg-primary/8 border border-primary/20 rounded-xl px-5 py-3">
              <Lock className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-lg font-semibold text-foreground tracking-wide select-all">
                {roomPassword}
              </span>
            </div>
          )}

          {/* Copia tutto */}
          {isDealer && roomPassword && (
            <button
              onClick={handleCopyAll}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 mx-auto"
            >
              {copiedAll
                ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Copiato!</>
                : <><Copy className="h-3.5 w-3.5" /> Copia codice + password</>
              }
            </button>
          )}
        </div>

        {/* Lista giocatori */}
        <div className="space-y-4 mb-10">
          <h3 className="text-muted-foreground font-serif text-lg italic text-center">
            Giocatori al tavolo ({roomState.players.length}/7)
          </h3>
          <div className="space-y-2">
            {roomState.players.map((p) => (
              <div
                key={p.socketId}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border',
                  p.name === playerName ? 'bg-primary/10 border-primary/30' : 'bg-background/50 border-border/50'
                )}
              >
                <span className="font-serif text-lg font-medium">
                  {p.name} {p.name === playerName && <span className="text-muted-foreground text-sm">(Tu)</span>}
                </span>
                {p.isDealer && (
                  <span className="flex items-center text-primary text-sm font-bold uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    <Crown className="h-4 w-4 mr-2" />
                    Mazziere
                  </span>
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 4 - roomState.players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center p-4 rounded-xl border border-dashed border-border/40 opacity-40">
                <span className="font-serif text-muted-foreground">In attesa...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Azioni mazziere / attesa */}
        {isDealer ? (
          <div className="space-y-4">
            <Button
              className="w-full h-14 text-lg bg-primary text-primary-foreground"
              disabled={!canStart}
              onClick={() => startGame(1).catch(() => {})}
            >
              Inizia Partita (Modalità 1)
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 text-lg border-primary text-primary hover:bg-primary/10"
              disabled={!canStart}
              onClick={() => startGame(2).catch(() => {})}
            >
              Inizia Partita (Modalità 2 – Scarto)
            </Button>
            {!canStart && (
              <p className="text-center text-sm text-muted-foreground">
                Servono almeno 2 giocatori per iniziare.
              </p>
            )}
          </div>
        ) : (
          <div className="text-center p-6 rounded-xl bg-background/50 border border-border/50">
            <p className="text-muted-foreground font-serif animate-pulse text-lg">
              In attesa che il mazziere inizi la partita...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
