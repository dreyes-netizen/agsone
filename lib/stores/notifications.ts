"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/hooks/useApiClient";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
};

type NotificationsState = {
  notifications: Notification[];
  unread: number;
  load: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
};

/**
 * Single source of truth for the notification bell, shared across every
 * mounted instance of <NotificationBell>. Previously each instance ran its
 * own fetch-on-mount, 60s poll, and Realtime subscription independently; the
 * dashboard layout renders the bell 3x (desktop sidebar, mobile drawer,
 * mobile top bar — see app/(dashboard)/layout.tsx), which tripled every
 * request. The fetch/poll/subscribe side effects now live once in
 * <NotificationsController> (mounted once in the dashboard layout); this
 * store just holds the resulting state so all three <NotificationBell>
 * instances render the same data without re-fetching it themselves.
 */
export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unread: 0,

  async load() {
    try {
      const res = await apiFetch<{ data: Notification[]; unreadCount: number }>("/api/notifications");
      set({ notifications: res.data, unread: res.unreadCount });
    } catch {
      // Keep whatever we last had rather than clearing the bell on a blip.
    }
  },

  async markAllRead() {
    await apiFetch("/api/notifications", { method: "PATCH" });
    const now = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, readAt: n.readAt ?? now })),
      unread: 0,
    }));
  },

  async markRead(id) {
    await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
    const wasUnread = get().notifications.some((n) => n.id === id && !n.readAt);
    const now = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)),
      unread: wasUnread ? Math.max(0, s.unread - 1) : s.unread,
    }));
  },
}));
