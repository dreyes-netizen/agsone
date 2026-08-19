"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Users, Mail } from "lucide-react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import { Avatar } from "@/components/feed/Avatar";
import { buildGmailComposeUrl } from "@/lib/email/gmailCompose";

type Contact = {
  id: string;
  position: string;
  description: string | null;
  user: { id: string; displayName: string; email: string; avatarUrl: string | null; orgChartPhotoUrl: string | null };
};

export default function ContactsPage() {
  const { apiFetch } = useApiClient();
  const { user, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const res = await apiFetch<{ data: Contact[] }>("/api/points-of-contact");
      setContacts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  useRealtimeChannel(realtimeTopics.pointsOfContact, load, { debounceMs: 200 });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? contacts.filter((c) =>
        c.user.displayName.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      )
    : contacts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Points of Contact</h1>
        <p className="text-gray-500 text-sm mt-1">Who to reach out to for what.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, role, or topic…"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
        />
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-12 bg-white rounded-card border border-table-border">
          <Users className="w-8 h-8 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">{contacts.length === 0 ? "No points of contact set up yet." : "No matches."}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-card border border-table-border p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={c.user.displayName} url={c.user.orgChartPhotoUrl ?? c.user.avatarUrl} size="md" />
                <div className="min-w-0">
                  <Link href={`/employees/${c.user.id}`} className="font-semibold text-gray-900 hover:text-navy-700 truncate block">
                    {c.user.displayName}
                  </Link>
                  <p className="text-xs text-gray-500 truncate">{c.position}</p>
                </div>
              </div>
              {c.description && <p className="text-sm text-gray-600">{c.description}</p>}
              <a
                href={buildGmailComposeUrl({ to: c.user.email })}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex items-center justify-center gap-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Email
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
