"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Power, Trophy } from "lucide-react";

type Segment = { label: string; pointsReward: number; weight: number; color: string };
type QuizQuestion = { id: string; question: string; options: [string, string, string, string]; correctIndex: number; pointsReward: number };
type Game = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  entryCostPoints: number;
  dailyPlaysLimit: number;
  isActive: boolean;
  endDate: string | null;
  config: Record<string, unknown>;
  _count: { plays: number };
};

const COLORS = ["#4f46e5","#7c3aed","#db2777","#dc2626","#d97706","#16a34a","#0891b2","#2563eb","#9333ea","#f97316"];

const DEFAULT_SEGMENTS: Segment[] = [
  { label: "Try Again", pointsReward: 0,    weight: 30, color: "#9ca3af" },
  { label: "50 pts",    pointsReward: 50,   weight: 28, color: "#4f46e5" },
  { label: "100 pts",   pointsReward: 100,  weight: 20, color: "#7c3aed" },
  { label: "200 pts",   pointsReward: 200,  weight: 13, color: "#0891b2" },
  { label: "500 pts",   pointsReward: 500,  weight: 7,  color: "#d97706" },
  { label: "1000 pts",  pointsReward: 1000, weight: 2,  color: "#dc2626" },
];

export default function AdminGamesPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [games, setGames] = useState<Game[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [gameType, setGameType] = useState<"SPIN_WHEEL" | "RAFFLE" | "QUIZ">("SPIN_WHEEL");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryCost, setEntryCost] = useState("0");
  const [dailyLimit, setDailyLimit] = useState("3");
  const [endDate, setEndDate] = useState("");
  const [prizePoints, setPrizePoints] = useState("1000");
  const [segments, setSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [submitting, setSubmitting] = useState(false);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    { id: "q1", question: "", options: ["", "", "", ""], correctIndex: 0, pointsReward: 100 },
  ]);
  const [timePerQuestion, setTimePerQuestion] = useState("30");

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load() {
    const res = await apiFetch<{ data: Game[] }>("/api/admin/games");
    setGames(res.data);
  }

  function updateSegment(i: number, field: keyof Segment, value: string | number) {
    setSegments((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function addSegment() {
    setSegments((prev) => [...prev, { label: "New Prize", pointsReward: 100, weight: 10, color: COLORS[prev.length % COLORS.length] }]);
  }

  function removeSegment(i: number) {
    setSegments((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addQuestion() {
    setQuizQuestions((prev) => [
      ...prev,
      { id: `q${prev.length + 1}`, question: "", options: ["", "", "", ""], correctIndex: 0, pointsReward: 100 },
    ]);
  }

  function updateQuestion(i: number, field: keyof Omit<QuizQuestion, "options" | "id">, value: string | number) {
    setQuizQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuizQuestions((prev) => prev.map((q, idx) => {
      if (idx !== qi) return q;
      const options = [...q.options] as [string, string, string, string];
      options[oi] = value;
      return { ...q, options };
    }));
  }

  function removeQuestion(i: number) {
    setQuizQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const config = gameType === "SPIN_WHEEL"
        ? { segments }
        : gameType === "RAFFLE"
        ? { prizePoints: Number(prizePoints) }
        : { questions: quizQuestions, timePerQuestion: Number(timePerQuestion) };

      await apiFetch("/api/admin/games", {
        method: "POST",
        body: JSON.stringify({
          type: gameType,
          name,
          description: description || undefined,
          entryCostPoints: Number(entryCost),
          dailyPlaysLimit: Number(dailyLimit),
          endDate: endDate || undefined,
          config,
        }),
      });
      setShowForm(false);
      setName(""); setDescription(""); setEntryCost("0"); setDailyLimit("3"); setEndDate(""); setSegments(DEFAULT_SEGMENTS);
      setQuizQuestions([{ id: "q1", question: "", options: ["", "", "", ""], correctIndex: 0, pointsReward: 100 }]);
      setTimePerQuestion("30");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(game: Game) {
    await apiFetch(`/api/admin/games/${game.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !game.isActive }) });
    await load();
  }

  async function handleDraw(gameId: string) {
    if (!confirm("Draw a winner now? This will end the raffle.")) return;
    setDrawingId(gameId);
    try {
      const res = await apiFetch<{ data: { winner: { displayName: string }; prizePoints: number } }>(`/api/admin/games/${gameId}/draw`, { method: "POST" });
      alert(`Winner: ${res.data.winner.displayName} — ${res.data.prizePoints.toLocaleString()} pts awarded!`);
      await load();
    } finally {
      setDrawingId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Games</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage mini-games for employees.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> New Game</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Game</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Game Type</Label>
                  <Select value={gameType} onValueChange={(v) => v && setGameType(v as "SPIN_WHEEL" | "RAFFLE" | "QUIZ")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPIN_WHEEL">🎡 Spin the Wheel</SelectItem>
                      <SelectItem value="RAFFLE">🎟️ Lucky Draw / Raffle</SelectItem>
                      <SelectItem value="QUIZ">🧠 Quiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Game Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Weekly Spin" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Entry Cost (pts)</Label>
                  <Input type="number" min={0} value={entryCost} onChange={(e) => setEntryCost(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Daily Plays per User</Label>
                  <Input type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date (optional)</Label>
                  <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                {gameType === "RAFFLE" && (
                  <div className="space-y-1.5">
                    <Label>Prize Points</Label>
                    <Input type="number" min={0} value={prizePoints} onChange={(e) => setPrizePoints(e.target.value)} />
                  </div>
                )}
              </div>

              {gameType === "SPIN_WHEEL" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Wheel Segments</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addSegment}><Plus className="w-3 h-3 mr-1" /> Add Segment</Button>
                  </div>
                  <div className="space-y-2">
                    {segments.map((seg, i) => (
                      <div key={i} className="grid grid-cols-5 gap-2 items-center">
                        <Input placeholder="Label" value={seg.label} onChange={(e) => updateSegment(i, "label", e.target.value)} />
                        <Input type="number" min={0} placeholder="Points" value={seg.pointsReward} onChange={(e) => updateSegment(i, "pointsReward", Number(e.target.value))} />
                        <Input type="number" min={0.1} step={0.1} placeholder="Weight" value={seg.weight} onChange={(e) => updateSegment(i, "weight", Number(e.target.value))} />
                        <div className="flex items-center gap-2">
                          <input type="color" value={seg.color} onChange={(e) => updateSegment(i, "color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                          <span className="text-xs text-gray-400">{seg.color}</span>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => removeSegment(i)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Weight determines probability. Higher weight = more likely to land on this segment.</p>
                </div>
              )}

              {gameType === "QUIZ" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Questions</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addQuestion}><Plus className="w-3 h-3 mr-1" /> Add Question</Button>
                  </div>
                  <div className="space-y-4">
                    {quizQuestions.map((q, qi) => (
                      <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-600 mt-1">Q{qi + 1}</span>
                          <Input
                            placeholder="Question text"
                            value={q.question}
                            onChange={(e) => updateQuestion(qi, "question", e.target.value)}
                            required
                            className="flex-1"
                          />
                          {quizQuestions.length > 1 && (
                            <Button type="button" size="sm" variant="outline" onClick={() => removeQuestion(qi)} className="text-red-500 hover:text-red-600 shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(["A", "B", "C", "D"] as const).map((letter, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${qi}`}
                                checked={q.correctIndex === oi}
                                onChange={() => updateQuestion(qi, "correctIndex", oi)}
                                className="accent-navy-600"
                              />
                              <span className="text-xs font-bold text-gray-400 w-4">{letter}</span>
                              <Input
                                placeholder={`Option ${letter}`}
                                value={q.options[oi]}
                                onChange={(e) => updateOption(qi, oi, e.target.value)}
                                required
                                className="flex-1 text-sm"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-500 whitespace-nowrap">Points for correct answer</Label>
                          <Input
                            type="number"
                            min={0}
                            value={q.pointsReward}
                            onChange={(e) => updateQuestion(qi, "pointsReward", Number(e.target.value))}
                            className="w-24 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-gray-600 whitespace-nowrap">Seconds per question</Label>
                    <Input
                      type="number"
                      min={5}
                      value={timePerQuestion}
                      onChange={(e) => setTimePerQuestion(e.target.value)}
                      className="w-24"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Game"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Plays</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">No games yet.</TableCell></TableRow>
              ) : games.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <p className="font-medium">{g.name}</p>
                    {g.description && <p className="text-xs text-gray-400 truncate max-w-xs">{g.description}</p>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{g.type === "SPIN_WHEEL" ? "🎡 Spin Wheel" : g.type === "RAFFLE" ? "🎟️ Raffle" : "🧠 Quiz"}</Badge></TableCell>
                  <TableCell>{g.entryCostPoints > 0 ? `${g.entryCostPoints} pts` : "Free"}</TableCell>
                  <TableCell>{g._count.plays}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${g.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {g.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(g)} className="h-7 px-2">
                        <Power className="w-3 h-3 mr-1" />{g.isActive ? "Pause" : "Activate"}
                      </Button>
                      {g.type === "RAFFLE" && g.isActive && (
                        <Button size="sm" variant="outline" onClick={() => handleDraw(g.id)} disabled={drawingId === g.id} className="h-7 px-2 text-yellow-600 border-yellow-200">
                          <Trophy className="w-3 h-3 mr-1" />Draw
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
