"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotificationsStore, type Notification } from "@/lib/stores/notifications";
import { getNotificationEntry } from "@/lib/constants/notificationTypes";
import { stripMentionTokens } from "@/lib/helpers/mentionTokens";

// Deep links come from the notification catalog, not a switch maintained here.
// The switch this replaces had drifted badly: it routed two types nothing ever
// emitted (POINTS_AWARDED, FEEDBACK_REPLY, REDEMPTION_PENDING) while every real
// FEEDBACK_* type and REDEMPTION_FULFILLED fell through to null and rendered
// unclickable. Sharing one source with the prefs UI means they cannot disagree.
function getNotificationLink(n: Notification): string | null {
  return getNotificationEntry(n.type)?.href(n.data ?? null) ?? null;
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
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The panel is portalled to <body> and positioned from the button's own
  // screen rect rather than being absolutely positioned inside the bell.
  // It has to work from three very differently-placed anchors: the 216px-wide
  // sidebar/mobile drawer (where a right-aligned 320px panel hangs off the
  // left of the screen) and the mobile top bar (where a left-aligned one hangs
  // off the right). A portal is also what keeps `position: fixed` honest —
  // the mobile drawer animates with a transform, and a transformed ancestor
  // makes `fixed` resolve against the drawer instead of the viewport.
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const gap = 8;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const width = Math.min(320, vw - gap * 2);
    // Prefer opening rightward from the button's left edge; fall back to
    // right-aligning when that would overflow, then clamp into the viewport.
    const preferred = r.left + width <= vw - gap ? r.left : r.right - width;
    const top = r.bottom + gap;
    const next = {
      top,
      left: Math.min(Math.max(preferred, gap), vw - width - gap),
      width,
      maxHeight: Math.max(160, vh - top - gap),
    };
    // The scroll listener is capture-phase, so scrolling the notification list
    // itself fires it too — bail out when nothing actually moved rather than
    // re-rendering the panel on every scroll frame.
    setPos((prev) =>
      prev && prev.top === next.top && prev.left === next.left
        && prev.width === next.width && prev.maxHeight === next.maxHeight
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keep the panel glued to the bell while the page moves under it.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  async function handleNotificationClick(n: Notification) {
    if (!n.readAt) {
      await markRead(n.id);
    }
    const link = getNotificationLink(n);
    setOpen(false);
    if (link) router.push(link);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          // Measure before opening so the panel's first paint is already in
          // the right place — no flash in the wrong corner.
          if (!open) updatePosition();
          setOpen((v) => !v);
        }}
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

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-navy-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <ul className="flex-1 min-h-0 max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</li>
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
                        <p className="text-sm font-medium text-gray-900">
                          {n.title}
                          {n.count > 1 && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 align-middle">
                              ×{n.count}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{stripMentionTokens(n.body)}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        {link && <p className="text-[10px] text-navy-500 mt-0.5">Tap to view →</p>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
