"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
      <Icon size={32} style={{ color: "#333333" }} />
      <p
        className="font-display font-bold uppercase tracking-widest"
        style={{ fontSize: "1.5rem", color: "#222222" }}
      >
        {title}
      </p>
      <p style={{ color: "#444444", fontSize: "0.85rem", maxWidth: "360px" }}>
        {description}
      </p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className={buttonVariants({ variant: "primary", className: "h-auto py-3 px-6 text-sm" })}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
