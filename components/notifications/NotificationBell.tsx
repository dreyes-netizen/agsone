"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotificationsStore, type Notification } from "@/lib/stores/notifications";

function getNotificationLink(n: Notification): string | null {
  switch (n.type) {
    case "SHOUTOUT_RECEIVED":      return "/feed";
    case "POINTS_AWARDED":         return "/profile";
    case "MILESTONE_REWARD":       return "/profile";
    case "GAME_INVITE":             return n.data?.sessionId ? `/minigames/${n.data.sessionId}` : "/minigames";
    case "GAME_WIN":               return n.data?.sessionId ? `/minigames/${n.data.sessionId}` : "/games";
    case "REDEMPTION_APPROVED":
    case "REDEMPTION_REJECTED":
    case "REDEMPTION_PENDING":     return "/marketplace";
    case "LEVEL_UP":
    case "BADGE_EARNED":           return "/profile";
    case "FEEDBACK_REPLY":         return "/feedback";
    default:                       return null;
  }
}

export function NotificationBell() {
  // Purely a consumer of the shared store — the fetch-on-mount, 60s poll,
  // and Realtime subscription live once in <NotificationsController> (see
  // app/(dashboard)/layout.tsx), not here. This component is mounted 3x
  // (desktop sidebar, mobile drawer, mobile top bar); before this change
  // each instance ran its own copy of that side-effect trio independently.
  const notifications = useNotificationsStore((s) => s.notifications);
  const unread = useNotificationsStore((s) => s.unread);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const markRead = useNotificationsStore((s) => s.markRead);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleNotificationClick(n: Notification) {
    if (!n.readAt) {
      await markRead(n.id);
    }
    const link = getNotificationLink(n);
    setOpen(false);
    if (link) router.push(link);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-white hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 lg:right-auto lg:left-0 top-11 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-navy-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400">No notifications yet.</li>
            ) : notifications.map((n) => {
              const link = getNotificationLink(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 transition-colors ${link ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"} ${!n.readAt ? "bg-navy-50/60" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && <span className="mt-1.5 w-2 h-2 rounded-full bg-navy-500 shrink-0" />}
                      <div className={!n.readAt ? "" : "ml-4"}>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        {link && <p className="text-[10px] text-navy-500 mt-0.5">Tap to view →</p>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
