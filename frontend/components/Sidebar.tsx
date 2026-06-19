"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BriefcaseBusiness, ScanText } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/analyse", label: "Analyse", icon: ScanText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-[#1e293b] border-r border-[#334155] flex flex-col py-6 px-3 gap-1 shrink-0">
      <span className="text-indigo-400 font-bold text-lg px-3 mb-4 tracking-tight">
        Job Tracker
      </span>
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-[#0f172a] hover:text-slate-200"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
