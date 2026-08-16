"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Bell, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { realtimeTopics } from "@/lib/realtime/topics";
import {
  NOTIFICATION_TYPES,
  preferenceGroupsForRole,
  type NotificationType,
} from "@/lib/constants/notificationTypes";

/** Shared switch styling — the in-app row is the larger of the two. */
function Toggle({
  checked,
  disabled,
  label,
  size,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  size: "lg" | "sm";
  onChange: () => void;
}) {
  const track = size === "lg" ? "h-5 w-9" : "h-4 w-7";
  const knob = size === "lg" ? "h-4 w-4" : "h-3 w-3";
  const shift = checked ? (size === "lg" ? "translate-x-4" : "translate-x-3") : "translate-x-0";

  return (
    <button
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex ${track} shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
        checked ? "bg-navy-500" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block ${knob} transform rounded-full bg-white shadow ring-0 transition duration-200 ${shift}`}
      />
    </button>
  );
}

export function NotificationsTab() {
  const { apiFetch } = useApiClient();
  const { dbUser } = useAuth();
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [notifError, setNotifError] = useState("");

  // Rows come from the notification catalog rather than a hardcoded list, so a
  // new notification type gets a switch automatically and a renamed one cannot
  // leave an inert toggle behind. Filtered by role: an employee never sees the
  // admin-queue or manager-budget rows, because those types never fire for them.
  const groups = useMemo(
    () => preferenceGroupsForRole(dbUser?.role ?? "EMPLOYEE"),
    [dbUser?.role],
  );

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

  async function handleNotifToggle(key: string, value: boolean) {
    if (!notifPrefs) return;
    const previous = notifPrefs;
    setNotifPrefs({ ...notifPrefs, [key]: value });
    setNotifSaving(key);
    setNotifError("");
    try {
      const res = await apiFetch<{ data: Record<string, boolean> }>(
        "/api/me/notification-preferences",
        { method: "PUT", body: JSON.stringify({ [key]: value }) }
      );
      setNotifPrefs(res.data);
    } catch {
      setNotifPrefs(previous);
      setNotifError("Failed to save preference");
    } finally {
      setNotifSaving(null);
    }
  }

  function renderRow(type: NotificationType) {
    const entry = NOTIFICATION_TYPES[type];
    const emailKey = `${type}_EMAIL`;
    // In-app defaults on unless explicitly disabled; email is strictly opt-in.
    const enabled = notifPrefs?.[type] ?? entry.defaults.inApp;
    const emailEnabled = notifPrefs?.[emailKey] === true;

    return (
      <li key={type} className="flex items-center gap-4 px-5 py-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{entry.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
        </div>
        <Toggle
          checked={enabled}
          disabled={notifSaving === type}
          label={`${entry.label} in-app notifications`}
          size="lg"
          onChange={() => handleNotifToggle(type, !enabled)}
        />
        <Toggle
          checked={emailEnabled}
          disabled={notifSaving === emailKey}
          label={`${entry.label} email notifications`}
          size="sm"
          onChange={() => handleNotifToggle(emailKey, !emailEnabled)}
        />
      </li>
    );
  }

  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-4">
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
        <>
          {groups.map(({ group, types }) => (
            <section key={group}>
              <h3 className="px-5 pt-4 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                {group}
              </h3>
              <ul className="divide-y divide-gray-100">{types.map(renderRow)}</ul>
            </section>
          ))}
          <p className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
            Some notifications can&apos;t be switched off — outcomes of your own requests,
            changes to your points balance, and confidential reports always reach you.
          </p>
        </>
      ) : null}
    </div>
  );
}
