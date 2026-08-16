"use client";

import { useEffect, useMemo, useState } from "react";
import { useApiClient } from "@/lib/hooks/useApiClient";
import { Bell, Loader2, BellRing, BellOff, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRealtimeChannel } from "@/lib/hooks/useRealtimeChannel";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";
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

/**
 * Master push control for this device.
 *
 * Push is per-device, not per-account: enabling it on a laptop says nothing
 * about a phone, so this is framed as "this device" throughout. Each state
 * needs different words — particularly `denied`, which the page cannot recover
 * from, and iOS, which only exposes Web Push to home-screen apps.
 */
function PushBanner({ push }: { push: ReturnType<typeof usePushSubscription> }) {
  if (push.status === "loading" || push.status === "unsupported") return null;

  const base = "px-5 py-3 border-b border-gray-100 flex items-start gap-3 text-xs";

  if (push.status === "ios-needs-install") {
    return (
      <div className={`${base} bg-blue-50/60`}>
        <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-blue-900">
          <span className="font-semibold">Add AGS One to your Home Screen</span> to get push
          notifications on iPhone or iPad. Tap Share, then &ldquo;Add to Home Screen&rdquo;, and open
          AGS One from there. Apple only allows notifications for installed apps.
        </p>
      </div>
    );
  }

  if (push.status === "denied") {
    return (
      <div className={`${base} bg-amber-50`}>
        <BellOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-amber-900">
          <span className="font-semibold">Notifications are blocked for this site.</span> We
          can&apos;t re-ask from inside the app — you&apos;ll need to allow notifications for AGS One
          in your browser or system settings, then reload this page.
        </p>
      </div>
    );
  }

  const subscribed = push.status === "subscribed";
  return (
    <div className={`${base} bg-gray-50 items-center`}>
      {subscribed ? (
        <BellRing className="w-4 h-4 text-navy-600 shrink-0" aria-hidden="true" />
      ) : (
        <BellOff className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1">
        <p className="font-semibold text-gray-800">
          {subscribed ? "Push is on for this device" : "Push is off for this device"}
        </p>
        <p className="text-gray-500 mt-0.5">
          {subscribed
            ? "You'll get notifications even when AGS One is closed. The switches below control which ones."
            : "Turn on to get notified when the app is closed. Push settings are per device."}
        </p>
        {push.error && <p className="text-red-500 mt-1">{push.error}</p>}
      </div>
      <button
        onClick={subscribed ? push.unsubscribe : push.subscribe}
        disabled={push.busy}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navy-500 ${
          subscribed
            ? "border border-gray-300 text-gray-700 hover:bg-gray-100"
            : "bg-command-black text-white hover:bg-gray-800"
        }`}
      >
        {push.busy ? "Working…" : subscribed ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}

export function NotificationsTab() {
  const { apiFetch } = useApiClient();
  const { dbUser } = useAuth();
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean> | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState<string | null>(null);
  const [notifError, setNotifError] = useState("");
  const push = usePushSubscription();

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
    const pushKey = `${type}_PUSH`;
    // In-app defaults on unless explicitly disabled; email is strictly opt-in;
    // push follows the catalog default but only matters once subscribed.
    const enabled = notifPrefs?.[type] ?? entry.defaults.inApp;
    const emailEnabled = notifPrefs?.[emailKey] === true;
    const pushEnabled = notifPrefs?.[pushKey] ?? entry.defaults.push;

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
          checked={pushEnabled}
          // Greyed out until this device is actually subscribed — the switch is
          // meaningless otherwise, and showing it live would imply push is on.
          disabled={notifSaving === pushKey || push.status !== "subscribed"}
          label={`${entry.label} push notifications`}
          size="lg"
          onChange={() => handleNotifToggle(pushKey, !pushEnabled)}
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
        <span className="text-xs text-gray-500 w-9 text-center">Push</span>
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
          <PushBanner push={push} />
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
