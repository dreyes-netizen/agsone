"use client";

type PromotionPiece = "q" | "r" | "b" | "n";

type Props = {
  color: "white" | "black";
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

const PROMOTION_CHOICES: {
  piece: PromotionPiece;
  label: string;
  whiteGlyph: string;
  blackGlyph: string;
}[] = [
  { piece: "q", label: "Queen", whiteGlyph: "♕", blackGlyph: "♛" },
  { piece: "r", label: "Rook", whiteGlyph: "♖", blackGlyph: "♜" },
  { piece: "b", label: "Bishop", whiteGlyph: "♗", blackGlyph: "♝" },
  { piece: "n", label: "Knight", whiteGlyph: "♘", blackGlyph: "♞" },
];

/**
 * Keyboard-reachable promotion prompt: four real `<button>` elements, each
 * with a text-based accessible name ("Promote to Queen", etc). The board
 * piece glyph is decorative (`aria-hidden`) — it is a visual aid on top of
 * the text label, never a substitute for it.
 */
export function ChessPromotionPicker({ color, onSelect, onCancel }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a piece to promote to"
      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40 p-4"
    >
      <div className="w-64 space-y-3 rounded-2xl border border-table-border bg-white p-4 shadow-lg">
        <p className="text-center text-sm font-bold text-gray-700">
          Promote pawn to…
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PROMOTION_CHOICES.map(({ piece, label, whiteGlyph, blackGlyph }) => (
            <button
              key={piece}
              type="button"
              onClick={() => onSelect(piece)}
              aria-label={`Promote to ${label}`}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 py-3 transition-colors hover:border-navy-400 hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
            >
              <span className="text-3xl leading-none" aria-hidden="true">
                {color === "white" ? whiteGlyph : blackGlyph}
              </span>
              <span className="text-xs font-medium text-gray-600">{label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-xl border border-gray-200 py-2 text-xs text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
