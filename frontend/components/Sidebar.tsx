"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, BriefcaseBusiness, Target, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const links: NavItem[] = [
  { href: "/review",        label: "Review CV",    icon: FileSearch },
  { href: "/analyse",       label: "Match to Job", icon: Target },
  { href: "/applications",  label: "Applications", icon: BriefcaseBusiness },
  { href: "/dashboard",     label: "Dashboard",    icon: LayoutDashboard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className="sidebar-shell shrink-0 flex flex-col bg-card border-r border-border"
      style={{ minHeight: "100vh" }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Wordmark */}
      <Link
        href="/"
        className="sidebar-logo flex items-center h-14 shrink-0"
        style={{
          borderBottom: "1px solid #222222",
          justifyContent: expanded ? "flex-start" : "center",
          paddingLeft: expanded ? "16px" : "0",
        }}
      >
        {expanded ? (
          <span
            className="font-display font-bold uppercase whitespace-nowrap"
            style={{ color: "#E8FF00", fontSize: "0.8rem", letterSpacing: "0.18em" }}
          >
            HIREWORTHY
          </span>
        ) : (
          <span
            className="font-display font-bold"
            style={{ color: "#E8FF00", fontSize: "1.25rem" }}
          >
            H
          </span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-0 flex-1 pt-2 px-0">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "sidebar-nav-link flex items-center gap-3 h-11 px-4 text-sm whitespace-nowrap transition-colors",
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
              <span className={cn("sidebar-nav-label font-display text-[13px]", active ? "font-bold" : "font-medium")}>
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
