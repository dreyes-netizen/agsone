"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home, ShoppingBag, Trophy, User, ShieldCheck, LogOut,
  Rss, Gamepad2, Menu, Target, UtensilsCrossed, MessageSquare,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const mainNav = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/games",       label: "Games",       icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile",     label: "Profile",     icon: User },
  { href: "/feedback",    label: "Feedback",    icon: MessageSquare },
];

const bottomNavItems = [
  { href: "/dashboard",   label: "Home",        icon: Home },
  { href: "/feed",        label: "Feed",        icon: Rss },
  { href: "/missions",    label: "Missions",    icon: Target },
  { href: "/food",        label: "Food",        icon: UtensilsCrossed },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
];

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-white/40 hover:text-white hover:bg-white/5"
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-full" />}
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
    HR_ADMIN: "HR Admin",
    MANAGER:  "Manager",
    EMPLOYEE: "Employee",
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-white font-semibold text-[13px] leading-tight">AGS One</p>
              <p className="text-white text-[10px] leading-tight">Alliance Global</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      <div className="mx-4 border-t border-white/[0.07]" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 pt-1 text-[10px] font-semibold text-white uppercase tracking-widest">Navigate</p>
        {mainNav.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={pathname === href} />
        ))}

        {(dbUser?.role === "MANAGER" || dbUser?.role === "HR_ADMIN") && (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold text-white uppercase tracking-widest">Management</p>
            <Link
              href="/admin"
              className={`group relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              {pathname.startsWith("/admin") && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-full" />}
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
            <div className="w-7 h-7 rounded-full bg-navy-500 flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
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
            <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-0.5" />
          </div>
          <span className="text-white font-semibold text-sm">AGS One</span>
        </div>

        <NotificationBell />
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-[216px] min-h-screen">
        <div className="lg:hidden h-14" />
        <div className="p-5 pb-24 lg:p-8 lg:pb-10">{children}</div>
        <div className="lg:hidden h-16" />
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#111827]/95 backdrop-blur-md flex items-center justify-around z-10 border-t border-white/[0.06]">
        {bottomNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors relative ${
                active ? "text-white" : "text-white/40"
              }`}
            >
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />}
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
