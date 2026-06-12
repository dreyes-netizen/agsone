"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ShoppingBag, Star, User, ShieldCheck, LogOut,
  Rss, Menu, UtensilsCrossed, MessageSquare, Search, Pill, Puzzle,
} from "lucide-react";
import { AllyWidget } from "@/components/AllyWidget";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";

const mainNav = [
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/medicine",    label: "Medicine",    icon: Pill },
  { href: "/minigames",   label: "Minigames",   icon: Puzzle },
  { href: "/leaderboard", label: "Top Performers", icon: Star },
  { href: "/profile",     label: "Profile",     icon: User },
  { href: "/feedback",    label: "Feedback",    icon: MessageSquare },
];

const bottomNavItems = [
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/minigames",   label: "Minigames",   icon: Puzzle },
  { href: "/leaderboard", label: "Leaderboard", icon: Star },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
        active
          ? "bg-white/20 text-white font-semibold border-l-2 border-white/60 pl-[10px]"
          : "text-white/80 hover:text-white hover:bg-white/[0.10]"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, dbUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (dbUser !== null && !dbUser.onboardingComplete && pathname !== "/onboarding") {
      router.push("/onboarding");
    }
  }, [dbUser, pathname, router]);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  const initials = user?.displayName?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const roleBadge: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    HR_ADMIN:    "HR Admin",
    MANAGER:     "Manager",
    EMPLOYEE:    "Employee",
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm">
              <Image src="/agslogo.png" alt="AGS One" width={28} height={28} className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-white font-semibold text-[13px] leading-tight">AGS One</p>
              <p className="text-white text-[10px] leading-tight">Alliance Global Solutions</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      <div className="mx-4 border-t border-white/[0.07]" />

      {/* Search button */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white/80 text-[13px]"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span>Search employees…</span>
        </button>
      </div>

      {/* Nav */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold text-white uppercase tracking-widest">Navigate</p>
        {mainNav.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={pathname === href} />
        ))}

        {(dbUser?.role === "MANAGER" || dbUser?.role === "HR_ADMIN" || dbUser?.role === "SUPER_ADMIN") && (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold text-white uppercase tracking-widest">Management</p>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-white/25 text-white"
                  : "text-white hover:bg-white/[0.10]"
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      <div className="mx-4 border-t border-white/[0.07]" />

      {/* User footer */}
      <div className="p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 transition-colors group cursor-default">
          <div className="relative shrink-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName ?? ""} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-navy-500 flex items-center justify-center text-xs font-bold text-white">
                {initials}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-[1.5px] border-[#111827]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate leading-tight">{user?.displayName ?? "—"}</p>
            <p className="text-white text-[10px] truncate leading-tight mt-0.5">
              {dbUser ? roleBadge[dbUser.role] : user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="text-white hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[216px] bg-[#111827] flex-col fixed h-full z-10 border-r border-white/[0.05]">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-[216px] bg-[#111827] flex flex-col z-30 lg:hidden transition-transform duration-300 ease-in-out border-r border-white/[0.05] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#111827]/95 backdrop-blur-md flex items-center justify-between px-4 z-10 border-b border-white/[0.06]">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="w-8 h-8 flex items-center justify-center text-white transition-colors rounded-md hover:bg-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm">
            <Image src="/agslogo.png" alt="AGS One" width={24} height={24} className="w-full h-full object-contain p-0.5" />
          </div>
          <span className="text-white font-semibold text-sm">AGS One</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-md hover:bg-white/10"
          >
            <Search className="w-4 h-4" />
          </button>
          <NotificationBell />
        </div>
      </div>

      <AllyWidget />

      {/* Main content */}
      <main className="flex-1 lg:ml-[216px] min-h-screen">
        <div className="lg:hidden h-14" />
        <div className="p-4 pb-24 lg:p-8 lg:pb-10 overflow-x-clip">{children}</div>
        <div className="lg:hidden h-16" />
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Mobile navigation" className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#111827]/95 backdrop-blur-md flex items-center justify-around z-10 border-t border-white/[0.06]">
        {bottomNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-white transition-colors relative"
            >
              {active && (
                <span className="absolute inset-x-1.5 top-1.5 bottom-1.5 bg-white/15 rounded-xl" />
              )}
              <Icon className={`shrink-0 relative z-10 transition-transform ${active ? "w-[22px] h-[22px]" : "w-5 h-5 opacity-70"}`} />
              <span className={`text-[9px] font-medium leading-none relative z-10 ${active ? "" : "opacity-70"}`}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
