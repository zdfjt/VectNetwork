"use client"

import { cn } from "@/lib/utils"
import { ShieldCheck } from "lucide-react"
import type { VenueInfo } from "@/lib/venues"

export function VenueBadge({
  venue,
  size = "sm",
  className,
}: {
  venue: VenueInfo
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        venue.accent,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className,
      )}
    >
      {venue.kind === "fallback" && (
        <ShieldCheck className={size === "sm" ? "size-3" : "size-3.5"} />
      )}
      {venue.name}
    </span>
  )
}
