import Link from "next/link";
import { ShoppingBag, Gamepad2, Megaphone } from "lucide-react";

export function QuickActionsWidget() {
  return (
    <div className="bg-white rounded-card border border-table-border overflow-hidden">
      <p className="px-4 py-3 text-xs font-semibold text-gray-700 border-b border-gray-100">Quick Actions</p>
      <div className="divide-y divide-gray-100">
        {[
          { href: "/marketplace", icon: ShoppingBag, label: "Redeem Points",   color: "text-navy-500" },
          { href: "/minigames",   icon: Gamepad2,    label: "Play a Minigame", color: "text-navy-700" },
          { href: "/feed",        icon: Megaphone,   label: "Send a Shoutout", color: "text-emerald-500" },
        ].map(({ href, icon: Icon, label, color }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
            <Icon className={`w-4 h-4 shrink-0 ${color}`} aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
