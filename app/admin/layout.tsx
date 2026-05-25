"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Gamepad2, Building2, Target, MessageSquare } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/missions", label: "Missions", icon: Target },
  { href: "/admin/points", label: "Award Points", icon: Award },
  { href: "/admin/rewards", label: "Rewards", icon: ShoppingBag },
  { href: "/admin/redemptions", label: "Redemptions", icon: ClipboardList },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/feedback",    label: "Feedback",    icon: MessageSquare },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/agslogo.png" alt="AGS One" className="w-full h-full object-contain p-0.5" />
            </div>
            <span className="text-sm font-semibold text-navy-600">AGS One Admin</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href))
                  ? "bg-navy-50 text-navy-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 mb-1"
          >
            ← Back to App
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
