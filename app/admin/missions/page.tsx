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
import { Plus, Power, CheckCircle2, XCircle } from "lucide-react";
import { timeAgo } from "@/lib/helpers/timeAgo";

type Mission = {
  id: string;
  title: string;
  description: string | null;
  pointsReward: number;
  type: "INDIVIDUAL" | "TEAM";
  endDate: string | null;
  isActive: boolean;
  _count: { completions: number };
};

type Completion = {
  id: string;
  completedAt: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  mission: { id: string; title: string; pointsReward: number };
};

export default function AdminMissionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { apiFetch } = useApiClient();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsReward, setPointsReward] = useState("100");
  const [type, setType] = useState<"INDIVIDUAL" | "TEAM">("INDIVIDUAL");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function load() {
    try {
      const [m, c] = await Promise.all([
        apiFetch<{ data: Mission[] }>("/api/admin/missions"),
        apiFetch<{ data: Completion[] }>("/api/admin/missions/completions"),
      ]);
      setMissions(m.data);
      setCompletions(c.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/admin/missions", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || undefined,
          pointsReward: Number(pointsReward),
          type,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }),
      });
      setShowForm(false);
      setTitle(""); setDescription(""); setPointsReward("100"); setType("INDIVIDUAL"); setEndDate("");
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to create mission");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(mission: Mission) {
    try {
      await apiFetch(`/api/admin/missions/${mission.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !mission.isActive }),
      });
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to update mission status");
    }
  }

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      await apiFetch(`/api/admin/missions/completions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to approve completion");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    if (!rejectNote.trim()) return;
    setProcessing(id);
    try {
      await apiFetch(`/api/admin/missions/completions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", adminNote: rejectNote }),
      });
      setRejectId(null);
      setRejectNote("");
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to reject completion");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Missions</h1>
          <p className="text-gray-500 text-sm mt-1">Create challenges and review employee completions.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Mission
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Mission</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Complete the safety training" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Description <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Points Reward</Label>
                  <Input type="number" min={1} value={pointsReward} onChange={(e) => setPointsReward(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => v && setType(v as "INDIVIDUAL" | "TEAM")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      <SelectItem value="TEAM">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Deadline <span className="text-gray-400 font-normal">(optional)</span></Label>
                  <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create Mission"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">All Missions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mission</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No missions yet.</TableCell></TableRow>
              ) : missions.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.title}</p>
                    {m.description && <p className="text-xs text-gray-400 truncate max-w-xs">{m.description}</p>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{m.type}</Badge></TableCell>
                  <TableCell className="font-semibold text-navy-600">{m.pointsReward}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {m.endDate ? new Date(m.endDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>{m._count.completions}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(m)} className="h-7 px-2">
                      <Power className="w-3 h-3 mr-1" />{m.isActive ? "Pause" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {completions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Completions ({completions.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Mission</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.user.displayName}</TableCell>
                    <TableCell>{c.mission.title}</TableCell>
                    <TableCell className="font-semibold text-navy-600">+{c.mission.pointsReward}</TableCell>
                    <TableCell className="text-sm text-gray-400">{timeAgo(c.completedAt)}</TableCell>
                    <TableCell>
                      {rejectId === c.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            placeholder="Reason for rejection (required)"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            className="h-7 text-sm w-56"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2"
                            disabled={!rejectNote.trim() || processing === c.id}
                            onClick={() => handleReject(c.id)}
                          >
                            Confirm
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setRejectId(null); setRejectNote(""); }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            disabled={processing === c.id}
                            onClick={() => handleApprove(c.id)}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-red-500 border-red-200 hover:bg-red-50"
                            disabled={processing === c.id}
                            onClick={() => setRejectId(c.id)}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
