"use client";

export const HOW_TO_PLAY: Record<string, { title: string; emoji: string; rules: { heading: string; text: string }[] }> = {
  RPS: {
    title: "Rock Paper Scissors",
    emoji: "✌️",
    rules: [
      { heading: "Simultaneous picks", text: "Both players choose Rock, Paper, or Scissors at the same time — you can't see the opponent's pick until both have chosen." },
      { heading: "Who wins a round", text: "Rock beats Scissors · Scissors beats Paper · Paper beats Rock. A tie is a draw round." },
      { heading: "Match format", text: "Play 3 rounds. The player who wins the most rounds wins the match. If tied after 3 rounds it's a draw." },
    ],
  },
  TIC_TAC_TOE: {
    title: "Tic-Tac-Toe",
    emoji: "⭕",
    rules: [
      { heading: "The board", text: "3×3 grid of empty cells. Host plays X, Guest plays O." },
      { heading: "Taking turns", text: "Players alternate placing their mark on any empty cell. Host goes first." },
      { heading: "Winning", text: "First to get 3 of your marks in a row — horizontally, vertically, or diagonally — wins." },
      { heading: "Draw", text: "If all 9 cells are filled and nobody has 3 in a row, it's a draw." },
    ],
  },
  CONNECT_FOUR: {
    title: "Connect Four",
    emoji: "🔴",
    rules: [
      { heading: "The board", text: "7 columns × 6 rows. Host is Yellow 🟡, Guest is Red 🔴." },
      { heading: "Dropping a disc", text: "Click the ▼ arrow above any column to drop your disc — it falls to the lowest empty row in that column." },
      { heading: "Winning", text: "First to connect 4 discs in a row — horizontally, vertically, or diagonally — wins." },
      { heading: "Draw", text: "If the board fills completely with no winner, it's a draw." },
    ],
  },
  DOTS_AND_BOXES: {
    title: "Dots & Boxes",
    emoji: "🟦",
    rules: [
      { heading: "The board", text: "A 4×4 grid of dots. Players take turns drawing a line between two adjacent dots." },
      { heading: "Claiming a box", text: "When you draw the 4th and final side of a box, you claim it — your color fills it in." },
      { heading: "Extra turn", text: "Completing a box earns you another turn immediately. Chain multiple boxes in a row if you can!" },
      { heading: "Winning", text: "When all lines are drawn, the player with the most boxes wins. Host is Yellow 🟡, Guest is Red 🔴." },
    ],
  },
  BATTLESHIP: {
    title: "Battleship",
    emoji: "🚢",
    rules: [
      { heading: "Deploy your fleet", text: "Before the battle, each player secretly places 3 ships (Battleship·4, Cruiser·3, Destroyer·2) on their 8×8 grid. Tap Shuffle to get a new random layout, then Deploy Fleet when happy." },
      { heading: "Take turns shooting", text: "Click any cell on the Enemy Waters grid to fire a shot. A hit ✕ means you struck a ship — a miss ○ means open water." },
      { heading: "Sinking a ship", text: "Hit every cell of a ship to sink it. The full ship outline is revealed when sunk so you can see what you destroyed." },
      { heading: "Winning", text: "The first player to sink all 3 of the opponent's ships wins. Ships: 🚢 Battleship (4), ⛵ Cruiser (3), 🚤 Destroyer (2)." },
    ],
  },
  MEMORY: {
    title: "Memory",
    emoji: "🧠",
    rules: [
      { heading: "The grid", text: "16 cards face-down in a 4×4 grid — 8 pairs of matching emojis shuffled randomly at the start." },
      { heading: "Your turn", text: "Flip two cards by tapping them. If they match, you keep the pair and get another turn!" },
      { heading: "No match", text: "If the two cards don't match, study them and tap Flip Back to hide them — then it's the opponent's turn." },
      { heading: "Winning", text: "The player who collects the most matched pairs when all 16 cards are cleared wins. A draw is possible!" },
    ],
  },
};

export function HowToPlayModal({ gameType, onClose }: { gameType: string; onClose: () => void }) {
  const info = HOW_TO_PLAY[gameType];
  if (!info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <span className="text-2xl" aria-hidden="true">{info.emoji}</span>
          <div className="flex-1 min-w-0">
            <p id="how-to-play-title" className="text-sm font-bold text-gray-900">How to Play — {info.title}</p>
          </div>
          <button
            autoFocus
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            <span aria-hidden="true" className="text-lg leading-none">×</span>
          </button>
        </div>

        {/* Rules */}
        <div className="px-5 py-4 space-y-3.5">
          {info.rules.map((r, i) => (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{r.heading}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#111827] hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
