import { cn } from '@/lib/utils';
import type { Card as CardType } from '@/lib/game-context';

interface PlayingCardProps {
  card: CardType | { id: string; faceUp: false };
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'table';
  onClick?: () => void;
  highlighted?: boolean;
  selected?: boolean;
}

// ── Valore → nome napoletano per il percorso immagine ────────────────────────
const valueToName: Record<number, string> = {
  1: 'asso',
  2: 'due',
  3: 'tre',
  4: 'quattro',
  5: 'cinque',
  6: 'sei',
  7: 'sette',
  8: 'fante',
  9: 'cavallo',
  10: 're',
};

function getCardImageUrl(value: number, suit: string): string {
  return `/images/cards/${valueToName[value]}-${suit}.jpg`;
}

const CARD_BACK_URL = '/images/cards/card-back.jpg';

// ── Retro della carta ─────────────────────────────────────────────────────────
function CardBack({ className }: { className?: string }) {
  return (
    <div className={cn(
      'w-full h-full absolute inset-0 backface-hidden rounded-lg border border-zinc-300 overflow-hidden',
      className
    )}>
      <img
        src={CARD_BACK_URL}
        alt="retro carta"
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}

// ── Componente carta ──────────────────────────────────────────────────────────
export function PlayingCard({
  card,
  className,
  size = 'md',
  onClick,
  highlighted = false,
  selected = false,
}: PlayingCardProps) {
  const isFaceUp = card.faceUp;
  const full = isFaceUp ? (card as CardType) : null;

  const sizes = {
    sm:    'w-10 h-16',
    md:    'w-14 h-[88px]',
    table: 'w-20 h-28 sm:w-24 sm:h-36',
    lg:    'w-20 h-32 sm:w-28 sm:h-44',
  };

  return (
    <div
      className={cn(
        'relative select-none',
        sizes[size],
        onClick && 'cursor-pointer',
        highlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg shadow-[0_0_15px_rgba(201,168,76,0.5)]',
        selected   && 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-background rounded-lg shadow-[0_0_18px_rgba(52,211,153,0.65)]',
        className
      )}
      style={{ perspective: '600px' }}
      onClick={onClick}
    >
      <div
        className="w-full h-full relative transition-transform duration-500 rounded-lg"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFaceUp ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* RETRO */}
        <CardBack />

        {/* FRONTE — immagine fotografica napoletana */}
        <div
          className="absolute inset-0 backface-hidden rounded-lg border border-zinc-200 overflow-hidden bg-white"
          style={{ transform: 'rotateY(180deg)' }}
        >
          {full && (
            <img
              src={getCardImageUrl(full.value, full.suit)}
              alt={`${valueToName[full.value]} di ${full.suit}`}
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
