"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * A dismissible nudge to install AGS One to the home screen.
 *
 * Worth its own banner because installing is not merely nicer on mobile — on
 * iOS it is the only way Web Push works at all, so an employee who never
 * installs simply never gets notified.
 *
 * Two very different paths:
 *  - Chromium fires `beforeinstallprompt`, which can be deferred and replayed
 *    from a button, giving a real one-tap install.
 *  - iOS Safari exposes no install API whatsoever, so the best available is to
 *    describe the Share → Add to Home Screen gesture.
 */

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ags-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    // Already installed, or the user has said no once — don't nag.
    if (standalone || localStorage.getItem(DISMISS_KEY) === "1") return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
    // Deferred out of the effect body: setting state synchronously there
    // triggers a cascading render. iOS has nothing to wait for; Chromium waits
    // for beforeinstallprompt so the banner only appears when an install is
    // genuinely available.
    queueMicrotask(() => {
      setIsIOS(ios);
      if (ios) setVisible(true);
    });

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setVisible(false);
    // The event is single-use; drop it either way.
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 lg:left-auto lg:right-6 lg:w-96 rounded-card border border-table-border bg-white shadow-lg p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-command-black flex items-center justify-center shrink-0">
        <Download className="w-4 h-4 text-white" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Install AGS One</p>
        {isIOS ? (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Tap <Share className="inline w-3 h-3 -mt-0.5" aria-label="the Share button" /> then
            <span className="font-medium text-gray-700"> Add to Home Screen</span>. Notifications
            only work once AGS One is installed.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mt-1">
              Add it to your home screen for faster access and notifications.
            </p>
            <button
              onClick={install}
              className="mt-2 rounded-lg bg-command-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-command-black"
            >
              Install
            </button>
          </>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
