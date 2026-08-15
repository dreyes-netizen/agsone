"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Bell, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";

export function NotificationsTab() {
  const { apiFetch } = useApiClient();
  const { dbUser } = useAuth();
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [notifError, setNotifError] = useState("");

  function load() {
    setNotifLoading(true);
    apiFetch<{ data: Record<string, boolean> }>("/api/me/notification-preferences")
      .then((res) => setNotifPrefs(res.data))
      .catch(() => setNotifError("Failed to load preferences"))
      .finally(() => setNotifLoading(false));
  }

  useEffect(() => {
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtimeChannel(
    dbUser ? realtimeTopics.notificationPreferences(dbUser.id) : null,
    load,
    { debounceMs: 150 },
  );

  async function handleNotifToggle(type: string, value: boolean) {
    if (!notifPrefs) return;
    const previous = notifPrefs;
    setNotifPrefs({ ...notifPrefs, [type]: value });
    setNotifSaving(type);
    try {
      const res = await apiFetch<{ data: Record<string, boolean> }>(
        "/api/me/notification-preferences",
        { method: "PUT", body: JSON.stringify({ [type]: value }) }
      );
      setNotifPrefs(res.data);
    } catch {
      setNotifPrefs(previous);
      setNotifError("Failed to save preference");
    } finally {
      setNotifSaving(null);
    }
  }

  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <Bell className="w-4 h-4 text-gray-500" aria-hidden="true" />
        <h2 className="text-sm font-bold text-gray-800 flex-1">Notification Preferences</h2>
        <span className="text-xs text-gray-500 w-9 text-center">In-App</span>
        <span className="text-xs text-gray-500 w-7 text-center">Email</span>
      </div>

      {notifLoading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 p-8 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading…
        </div>
      ) : notifError ? (
        <div className="p-8 text-center text-red-400 text-sm">{notifError}</div>
      ) : notifPrefs ? (
        <ul className="divide-y divide-gray-100">
          {[
            { type: "SHOUTOUT_RECEIVED", label: "Shoutout received", description: "When a colleague shouts you out" },
            { type: "POINTS_AWARDED",    label: "Points awarded",   description: "When an admin manually awards you points" },
          ].map(({ type, label, description }) => {
            const enabled = notifPrefs[type] !== false;
            return (
              <li key={type} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                {/* In-app toggle */}
                <button
                  role="switch"
                  aria-label={`${label} in-app notifications`}
                  aria-checked={enabled}
                  disabled={notifSaving === type}
                  onClick={() => handleNotifToggle(type, !enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                    enabled ? "bg-navy-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                {/* Email toggle */}
                {(() => {
                  const emailKey = `${type}_EMAIL`;
                  const emailEnabled = notifPrefs[emailKey] === true;
                  const emailSaving = notifSaving === emailKey;
                  return (
                    <button
                      role="switch"
                      aria-label={`${label} email notifications`}
                      aria-checked={emailEnabled}
                      disabled={emailSaving}
                      onClick={() => handleNotifToggle(emailKey, !emailEnabled)}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
                        emailEnabled ? "bg-navy-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          emailEnabled ? "translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </button>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
