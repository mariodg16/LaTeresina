import { useGame } from '@/lib/game-context';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayingCard } from '@/components/card';
import { Crown, Users, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'crea' | 'unisciti';

export default function Home() {
  const { playerName, setPlayerName, createRoom, joinRoom, isConnected } = useGame();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('crea');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const clearError = () => setErrorMsg('');

  const handleCreate = async () => {
    if (!playerName.trim()) { setErrorMsg('Inserisci il tuo nome'); return; }
    if (!password.trim())   { setErrorMsg('Imposta una password per la stanza'); return; }
    setLoading(true);
    try {
      await createRoom(playerName, password.trim());
      setLocation('/lobby');
    } catch (err: any) {
      setErrorMsg(err || 'Errore');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim())   { setErrorMsg('Inserisci il tuo nome'); return; }
    if (code.length !== 4)    { setErrorMsg('Il codice deve essere di 4 lettere'); return; }
    if (!joinPassword.trim()) { setErrorMsg('Inserisci la password della stanza'); return; }
    setLoading(true);
    try {
      await joinRoom(code, playerName, joinPassword.trim());
      setLocation('/lobby');
    } catch (err: any) {
      setErrorMsg(err || 'Errore');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background to-black">
      <div className="w-full max-w-md space-y-10">

        {/* Titolo */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <h1 className="text-6xl md:text-7xl font-serif font-bold text-primary tracking-tighter" style={{ textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              La Teresina
            </h1>
            <div className="absolute -top-6 -right-6 rotate-12">
              <PlayingCard card={{ id: 'fake1', suit: 'spade', value: 1, faceUp: true }} size="sm" />
            </div>
            <div className="absolute -bottom-6 -left-8 -rotate-12">
              <PlayingCard card={{ id: 'fake2', suit: 'coppe', value: 10, faceUp: true }} size="sm" />
            </div>
          </div>
          <p className="text-muted-foreground font-serif italic text-lg mt-4">Il tavolo ti aspetta.</p>
        </div>

        <div className="bg-card/40 backdrop-blur-sm border border-border rounded-2xl shadow-2xl overflow-hidden relative z-10">

          {/* Tab selector */}
          <div className="flex border-b border-border">
            {(['crea', 'unisciti'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); clearError(); }}
                className={cn(
                  'flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-colors',
                  tab === t
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'crea' ? '✦ Crea stanza' : '→ Unisciti'}
              </button>
            ))}
          </div>

          <div className="p-8 space-y-5">
            {/* Nome sempre visibile */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Il tuo nome</label>
              <Input
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); clearError(); }}
                placeholder="GIOCATORE"
                className="h-12 font-serif text-lg"
              />
            </div>

            {tab === 'crea' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Password stanza
                  </label>
                  <Input
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    placeholder="Scegli una password…"
                    className="h-12 font-serif text-lg"
                  />
                  <p className="text-[11px] text-muted-foreground pl-1">Condividi codice + password con gli altri giocatori.</p>
                </div>

                {errorMsg && <ErrorBox msg={errorMsg} />}

                <Button
                  className="w-full h-13 text-base"
                  onClick={handleCreate}
                  disabled={loading || !isConnected}
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Crea Nuova Stanza
                </Button>
              </>
            )}

            {tab === 'unisciti' && (
              <form onSubmit={handleJoin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Codice stanza</label>
                  <Input
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); clearError(); }}
                    placeholder="ABCD"
                    maxLength={4}
                    className="h-12 font-mono text-2xl tracking-[0.3em] text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Password
                  </label>
                  <Input
                    value={joinPassword}
                    onChange={(e) => { setJoinPassword(e.target.value); clearError(); }}
                    placeholder="Password della stanza"
                    className="h-12 font-serif text-lg"
                  />
                </div>

                {errorMsg && <ErrorBox msg={errorMsg} />}

                <Button
                  type="submit"
                  className="w-full h-13 text-base"
                  disabled={loading || !isConnected || code.length !== 4}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Unisciti alla Stanza
                </Button>
              </form>
            )}

            {!isConnected && (
              <p className="text-xs text-center text-muted-foreground animate-pulse">
                Connessione al tavolo...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="text-destructive text-sm text-center bg-destructive/10 p-2.5 rounded-md border border-destructive/20 font-medium">
      {msg}
    </div>
  );
}
