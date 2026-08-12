"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Users, Award, LayoutDashboard, LogOut, ShoppingBag, ClipboardList, Building2, Gift, FileText, Pill, Menu, ShieldAlert } from "lucide-react";
import { WhistleIcon } from "@/components/icons/WhistleIcon";
import { auth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEffect, useState } from "react";

const overviewItem = { href: "/admin", label: "Overview", icon: LayoutDashboard };

const navGroups = [
  {
    label: "People",
    items: [
      { href: "/admin/employees",   label: "Employees",    icon: Users },
      { href: "/admin/departments", label: "Departments",  icon: Building2 },
    ],
  },
  {
    label: "Points & Rewards",
    items: [
      { href: "/admin/milestones",  label: "Milestones",   icon: Gift },
      { href: "/admin/points",      label: "Award Points", icon: Award },
      { href: "/admin/rewards",     label: "Rewards",      icon: ShoppingBag },
      { href: "/admin/redemptions", label: "Redemptions",  icon: ClipboardList },
    ],
  },
  {
    label: "System & Trust",
    items: [
      { href: "/admin/feedback",    label: "Whistleblower", icon: WhistleIcon },
      { href: "/admin/documents",   label: "Documents",    icon: FileText },
      { href: "/admin/medicine",    label: "Medicine",     icon: Pill },
      { href: "/admin/audit",       label: "Audit Log",    icon: ShieldAlert },
    ],
  },
];

function AdminNavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400 ${
        active ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
      }`}
    >
      <Icon aria-hidden="true" className={`w-4 h-4 shrink-0 ${active ? "text-gray-900" : "text-gray-500"}`} />
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { dbUser, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  useEffect(() => {
    if (!loading && dbUser?.role !== "HR_ADMIN" && dbUser?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [loading, dbUser, router]);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setSidebarOpen(false);
  }

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
        <div className="bg-command-black px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0">
              <Image src="/agslogo.png" alt="AGS One" width={28} height={28} className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-white font-semibold text-[13px] leading-tight">AGS One</p>
              <p className="text-white/50 text-[10px] leading-tight">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <AdminNavLink
            href={overviewItem.href}
            label={overviewItem.label}
            icon={overviewItem.icon}
            active={pathname === overviewItem.href}
          />
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 pt-4 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{group.label}</p>
              {group.items.map(({ href, label, icon }) => (
                <AdminNavLink key={href} href={href} label={label} icon={icon} active={pathname.startsWith(href)} />
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-0.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400"
          >
            ← Back to App
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-red-500 hover:bg-red-50 transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-10 bg-command-black px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-white p-1 -ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center overflow-hidden shadow-sm shrink-0">
            <Image src="/agslogo.png" alt="AGS One" width={24} height={24} className="w-full h-full object-contain p-0.5" />
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
