"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { use } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ticket, CheckCircle2, XCircle, Clock } from "lucide-react";

type Segment = { label: string; pointsReward: number; weight: number; color: string };
type QuizQuestion = { id: string; question: string; options: string[]; correctIndex: number; pointsReward: number };
type Game = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  entryCostPoints: number;
  dailyPlaysLimit: number;
  playsToday: number;
  canPlay: boolean;
  config: { segments?: Segment[]; prizePoints?: number; questions?: QuizQuestion[]; timePerQuestion?: number };
};

function SpinWheel({ segments, rotation }: { segments: Segment[]; rotation: number }) {
  const cx = 200, cy = 200, r = 185;
  const n = segments.length;
  const step = (2 * Math.PI) / n;

  return (
    <svg width="400" height="400" viewBox="0 0 400 400" className="drop-shadow-xl">
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "200px 200px",
          transition: rotation === 0 ? "none" : "transform 4s cubic-bezier(0.17, 0.67, 0.12, 1)",
        }}
      >
        {segments.map((seg, i) => {
          const start = i * step - Math.PI / 2;
          const end = (i + 1) * step - Math.PI / 2;
          const x1 = cx + r * Math.cos(start);
          const y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end);
          const y2 = cy + r * Math.sin(end);
          const large = step > Math.PI ? 1 : 0;
          const mid = (start + end) / 2;
          const tx = cx + r * 0.65 * Math.cos(mid);
          const ty = cy + r * 0.65 * Math.sin(mid);
          const textRot = (mid * 180) / Math.PI + 90;

          return (
            <g key={i}>
              <path
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                fill={seg.color}
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={tx} y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={n > 8 ? "11" : "13"}
                fontWeight="700"
                style={{ transform: `rotate(${textRot}deg)`, transformOrigin: `${tx}px ${ty}px` }}
              >
                {seg.label}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeWidth="3" />
      </g>

      <circle cx={cx} cy={cy} r={22} fill="white" stroke="#e5e7eb" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={10} fill="#4f46e5" />

      <polygon points="200,8 191,28 209,28" fill="#1f2937" />
    </svg>
  );
}

function RaffleView({ game, onBuy, buying, result }: {
  game: Game;
  onBuy: () => void;
  buying: boolean;
  result: { ticketNumber: number; newBalance: number } | null;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <span className="text-7xl">🎟️</span>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">{game.name}</h2>
        {game.description && <p className="text-white/60 mt-1">{game.description}</p>}
        <p className="text-amber-400 font-bold mt-2 text-lg">
          Prize: {game.config.prizePoints?.toLocaleString() ?? "?"} points
        </p>
      </div>

      {result ? (
        <div className="border border-green-500/30 bg-green-500/10 rounded-2xl w-full max-w-sm px-6 py-5 text-center">
          <p className="text-green-400 font-bold text-lg">Ticket #{result.ticketNumber} purchased!</p>
          <p className="text-green-300/70 text-sm mt-1">Good luck! Draw results will be announced soon.</p>
          <p className="text-white/40 text-xs mt-2">New balance: {result.newBalance.toLocaleString()} pts</p>
        </div>
      ) : (
        <button
          onClick={onBuy}
          disabled={buying || !game.canPlay}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold px-10 py-3 rounded-xl shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-orange-500 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-base"
        >
          {buying ? "Buying..." : game.canPlay ? `Buy Ticket — ${game.entryCostPoints} pts` : "You've already bought a ticket today"}
        </button>
      )}
    </div>
  );
}

type QuizResult = { score: number; total: number; pointsWon: number; newBalance: number; correctAnswers: number[] };

function QuizView({ game, onSubmit, submitting, result, onReset }: {
  game: Game;
  onSubmit: (answers: number[]) => void;
  submitting: boolean;
  result: QuizResult | null;
  onReset: () => void;
}) {
  const questions = game.config.questions ?? [];
  const timePerQuestion = game.config.timePerQuestion ?? 30;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(questions.length).fill(-1));
  const [timeLeft, setTimeLeft] = useState(timePerQuestion);

  const advance = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setTimeLeft(timePerQuestion);
    }
  }, [currentIndex, questions.length, timePerQuestion]);

  useEffect(() => {
    if (result) return;
    setTimeLeft(timePerQuestion);
  }, [currentIndex, timePerQuestion, result]);

  useEffect(() => {
    if (result) return;
    if (timeLeft <= 0) {
      if (currentIndex < questions.length - 1) {
        advance();
      }
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, result, currentIndex, questions.length, advance]);

  function selectOption(optionIndex: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  }

  if (result) {
    const percentage = Math.round((result.score / result.total) * 100);
    return (
      <div className="space-y-5">
        <div className="text-center py-4">
          <div className={`text-5xl font-black mb-2 ${percentage >= 70 ? "text-green-400" : percentage >= 40 ? "text-yellow-400" : "text-red-400"}`}>
            {result.score}/{result.total}
          </div>
          <p className="text-white/50">questions correct</p>
          {result.pointsWon > 0 && (
            <p className="text-navy-400 font-bold mt-2 text-lg">+{result.pointsWon.toLocaleString()} pts earned!</p>
          )}
          <p className="text-white/30 text-sm mt-1">Balance: {result.newBalance.toLocaleString()} pts</p>
        </div>

        <div className="space-y-3">
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const correct = result.correctAnswers[i];
            const isCorrect = userAnswer === correct;
            return (
              <div key={q.id} className={`rounded-xl border p-4 ${isCorrect ? "border-green-500/30 bg-green-500/10" : "border-red-500/20 bg-red-500/10"}`}>
                <div className="flex items-start gap-2">
                  {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90">{q.question}</p>
                    <div className="mt-1.5 space-y-0.5">
                      {q.options.map((opt, oi) => {
                        const isUserPick = userAnswer === oi;
                        const isCorrectOpt = correct === oi;
                        return (
                          <p key={oi} className={`text-xs px-2 py-0.5 rounded ${isCorrectOpt ? "text-green-400 font-semibold" : isUserPick && !isCorrect ? "text-red-400 line-through" : "text-white/40"}`}>
                            {String.fromCharCode(65 + oi)}. {opt}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-navy-400 shrink-0">+{isCorrect ? q.pointsReward : 0} pts</span>
                </div>
              </div>
            );
          })}
        </div>

        {game.canPlay && (
          <button
            onClick={onReset}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-2.5 rounded-xl transition-all"
          >
            Play Again
          </button>
        )}
      </div>
    );
  }

  const q = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const selectedAnswer = answers[currentIndex];
  const timerPct = (timeLeft / timePerQuestion) * 100;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm text-white/50">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <span className="flex items-center gap-1 font-mono">
          <Clock className="w-3.5 h-3.5" />{timeLeft}s
        </span>
      </div>

      <div className="w-full bg-white/10 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-1000 ${timerPct > 50 ? "bg-navy-500" : timerPct > 20 ? "bg-yellow-500" : "bg-red-500"}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      <div className="border border-navy-500/30 bg-navy-500/10 rounded-xl p-5">
        <p className="font-semibold text-white text-base">{q.question}</p>
        <p className="text-xs text-navy-400 mt-1">+{q.pointsReward} pts if correct</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {q.options.map((opt, oi) => (
          <button
            key={oi}
            onClick={() => selectOption(oi)}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors
              ${selectedAnswer === oi
                ? "border-navy-500 bg-navy-500/20 text-white"
                : "border-white/10 hover:border-navy-400/50 hover:bg-navy-500/10 text-white/70"
              }`}
          >
            <span className="font-bold mr-2 text-navy-400">{String.fromCharCode(65 + oi)}.</span>{opt}
          </button>
        ))}
      </div>

      <button
        className="w-full bg-gradient-to-r from-navy-500 to-violet-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-navy-500/30 hover:from-navy-400 hover:to-violet-500 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={selectedAnswer === -1 || submitting}
        onClick={() => {
          if (isLast) {
            onSubmit(answers);
          } else {
            advance();
          }
        }}
      >
        {submitting ? "Submitting..." : isLast ? "Submit" : "Next"}
      </button>
    </div>
  );
}

export default function GamePlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ segmentIndex: number; pointsWon: number; newBalance: number } | null>(null);
  const [raffleResult, setRaffleResult] = useState<{ ticketNumber: number; newBalance: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const rotationRef = useRef(0);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizKey, setQuizKey] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<{ data: Game }>(`/api/games/${id}`).then((res) => setGame(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, id]);

  async function handleSpin() {
    if (!game || spinning) return;
    setSpinning(true);
    setShowResult(false);

    try {
      const res = await apiFetch<{ data: { segmentIndex: number; pointsWon: number; newBalance: number } }>(
        `/api/games/${id}/play`,
        { method: "POST" }
      );
      const { segmentIndex, pointsWon, newBalance } = res.data;
      const segments = game.config.segments ?? [];
      const segmentAngle = 360 / segments.length;
      const normalizedCurrent = rotationRef.current % 360;
      const targetAngle = (360 - ((segmentIndex + 0.5) * segmentAngle)) % 360;
      const diff = ((targetAngle - normalizedCurrent) + 360) % 360;
      const newRotation = rotationRef.current + 5 * 360 + diff;

      rotationRef.current = newRotation;
      setRotation(newRotation);
      setResult({ segmentIndex, pointsWon, newBalance });

      setTimeout(() => {
        setShowResult(true);
        setSpinning(false);
        setGame((g) => g ? { ...g, playsToday: g.playsToday + 1, canPlay: g.playsToday + 1 < g.dailyPlaysLimit } : g);
      }, 4200);
    } catch {
      setSpinning(false);
    }
  }

  async function handleBuyTicket() {
    if (!game) return;
    const res = await apiFetch<{ data: { ticketNumber: number; newBalance: number } }>(`/api/games/${id}/play`, { method: "POST" });
    setRaffleResult(res.data);
    setGame((g) => g ? { ...g, playsToday: g.playsToday + 1, canPlay: false } : g);
  }

  async function handleQuizSubmit(answers: number[]) {
    if (!game) return;
    setQuizSubmitting(true);
    try {
      const res = await apiFetch<{ data: { score: number; total: number; pointsWon: number; newBalance: number; play: { outcome: { correctAnswers: number[] } } } }>(
        `/api/games/${id}/play`,
        { method: "POST", body: JSON.stringify({ answers }) }
      );
      setQuizResult({
        score: res.data.score,
        total: res.data.total,
        pointsWon: res.data.pointsWon,
        newBalance: res.data.newBalance,
        correctAnswers: res.data.play.outcome.correctAnswers,
      });
      setGame((g) => g ? { ...g, playsToday: g.playsToday + 1, canPlay: g.playsToday + 1 < g.dailyPlaysLimit } : g);
    } finally {
      setQuizSubmitting(false);
    }
  }

  function handleQuizReset() {
    setQuizResult(null);
    setQuizKey((k) => k + 1);
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0e1f] via-[#1a1730] to-[#0f0e1f] flex items-center justify-center">
        <span className="text-white/40 text-lg animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0e1f] via-[#1a1730] to-[#0f0e1f] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => router.push("/games")}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Games
        </button>

        {game.type === "SPIN_WHEEL" && game.config.segments && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-black text-white">{game.name}</h1>
              {game.description && <p className="text-white/60 text-sm mt-1">{game.description}</p>}
              <div className="flex justify-center gap-3 mt-3 flex-wrap">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {game.entryCostPoints > 0 ? `${game.entryCostPoints} pts per spin` : "Free spin"}
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-white/60 flex items-center gap-1">
                  <Ticket className="w-3 h-3" /> {game.playsToday}/{game.dailyPlaysLimit} today
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <SpinWheel segments={game.config.segments} rotation={rotation} />
            </div>

            <div className="text-center space-y-3">
              {showResult && result && (
                <div className={`inline-block px-6 py-3 rounded-xl font-bold text-lg ${result.pointsWon > 0 ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/5 text-white/50 border border-white/10"}`}>
                  {result.pointsWon > 0 ? `🎉 You won ${result.pointsWon.toLocaleString()} points!` : "😅 Better luck next time!"}
                  <p className="text-sm font-normal mt-1 opacity-75">Balance: {result.newBalance.toLocaleString()} pts</p>
                </div>
              )}

              <button
                disabled={spinning || !game.canPlay}
                onClick={handleSpin}
                className="bg-gradient-to-r from-navy-500 to-violet-600 text-white font-bold px-12 py-3 rounded-xl shadow-lg shadow-navy-500/30 hover:from-navy-400 hover:to-violet-500 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-base"
              >
                {spinning ? "Spinning..." : game.canPlay ? "Spin!" : "Come back tomorrow"}
              </button>
            </div>
          </div>
        )}

        {game.type === "RAFFLE" && (
          <RaffleView game={game} onBuy={handleBuyTicket} buying={false} result={raffleResult} />
        )}

        {game.type === "QUIZ" && game.config.questions && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-3xl font-black text-white">{game.name}</h1>
              {game.description && <p className="text-white/60 text-sm mt-1">{game.description}</p>}
              <div className="flex justify-center gap-3 mt-3 flex-wrap">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {game.entryCostPoints > 0 ? `${game.entryCostPoints} pts to play` : "Free"}
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-white/60 flex items-center gap-1">
                  <Ticket className="w-3 h-3" /> {game.playsToday}/{game.dailyPlaysLimit} today
                </span>
              </div>
            </div>

            {!game.canPlay && !quizResult ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
                <p className="text-white text-lg font-semibold">Come back tomorrow!</p>
                <p className="text-white/40 text-sm mt-1">You have used all your plays for today.</p>
              </div>
            ) : (
              <div className="border border-violet-500/20 bg-gradient-to-br from-[#1e1b4b]/60 to-[#0f0e1f]/60 rounded-2xl p-6">
                <QuizView
                  key={quizKey}
                  game={game}
                  onSubmit={handleQuizSubmit}
                  submitting={quizSubmitting}
                  result={quizResult}
                  onReset={handleQuizReset}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
