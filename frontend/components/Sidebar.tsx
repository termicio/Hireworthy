"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BriefcaseBusiness, ScanText } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/analyse",      label: "Analyse",      icon: ScanText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="sidebar-shell shrink-0 flex flex-col bg-card border-r border-border"
      style={{ minHeight: "100vh" }}
    >
      {/* Logo mark */}
      <div className="sidebar-logo flex items-center justify-center h-14 border-b border-border shrink-0">
        <div
          className="w-7 h-7 flex items-center justify-center"
          style={{ background: "#E8FF00" }}
        >
          <BriefcaseBusiness size={14} style={{ color: "#080808" }} strokeWidth={2.5} />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0 flex-1 pt-2 px-0">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 h-11 px-4 text-sm whitespace-nowrap transition-colors",
                active
                  ? "text-[#E8FF00] bg-[#E8FF00]/5"
                  : "text-[#666666] hover:text-[#F5F5F5] hover:bg-[#1a1a1a]"
              )}
              style={active ? { borderLeft: "2px solid #E8FF00" } : { borderLeft: "2px solid transparent" }}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.2 : 1.6}
                className="shrink-0"
              />
              <span className="sidebar-nav-label font-display font-medium text-[13px]">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer px-4 py-4 border-t border-border">
        <span className="text-[10px] text-[#444444] font-mono whitespace-nowrap">v1.0</span>
      </div>
    </aside>
  );
}
