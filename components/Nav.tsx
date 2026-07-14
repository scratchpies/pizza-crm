"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  Receipt,
  Calendar,
  BarChart3,
  Download,
  Upload,
  LogOut,
  Pizza,
} from "lucide-react";

const mainLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const moreLinks = [
  { href: "/export", label: "Export", icon: Download },
  { href: "/import", label: "Import", icon: Upload },
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Top bar */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-crust text-white flex items-center justify-center">
              <Pizza size={18} />
            </span>
            <span className="font-bold text-neutral-800 hidden sm:inline">Scratch Pies CRM</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {[...mainLinks, ...moreLinks].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(l.href)
                    ? "bg-crust/10 text-crust"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <l.icon size={16} />
                {l.label}
              </Link>
            ))}
          </nav>

          <form action="/api/auth/logout" method="post">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-neutral-500 hover:bg-neutral-100">
              <LogOut size={16} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </form>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-neutral-200 flex">
        {mainLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              isActive(l.href) ? "text-crust" : "text-neutral-500"
            }`}
          >
            <l.icon size={20} />
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
