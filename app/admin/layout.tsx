"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Building2, MessageSquare, Gift, Swords, FileText, Pill, Menu } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/admin",             label: "Overview",     icon: LayoutDashboard },
  { href: "/admin/employees",   label: "Employees",    icon: Users },
  { href: "/admin/departments", label: "Departments",  icon: Building2 },
  { href: "/admin/milestones",  label: "Milestones",   icon: Gift },
  { href: "/admin/challenges",  label: "Challenges",   icon: Swords },
  { href: "/admin/points",      label: "Award Points", icon: Award },
  { href: "/admin/rewards",     label: "Rewards",      icon: ShoppingBag },
  { href: "/admin/redemptions", label: "Redemptions",  icon: ClipboardList },
  { href: "/admin/feedback",    label: "Feedback",     icon: MessageSquare },
  { href: "/admin/documents",   label: "Documents",    icon: FileText },
  { href: "/admin/medicine",    label: "Medicine",     icon: Pill },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dbUser, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && dbUser?.role !== "HR_ADMIN" && dbUser?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [loading, dbUser, router]);

  // Close sidebar on route change on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading || (dbUser?.role !== "HR_ADMIN" && dbUser?.role !== "SUPER_ADMIN")) return null;

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-60 bg-white border-r border-gray-100 flex flex-col shadow-sm transition-transform duration-200 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}>
        {/* Dark header */}
        <div className="bg-[#111827] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-white font-semibold text-[13px] leading-tight">AGS One</p>
              <p className="text-white/50 text-[10px] leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Management</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  active ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-gray-900" : "text-gray-400"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-0.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            ← Back to App
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-red-500 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-10 bg-[#111827] px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-white p-1 -ml-1"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0">
            <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-0.5" />
          </div>
          <p className="text-white font-semibold text-[13px]">AGS One Admin</p>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 p-4 lg:p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
