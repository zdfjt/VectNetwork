"use client"

import { useState } from "react"
import { formatUnits } from "viem"
import { ChevronDown, ShieldCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { VenueBadge } from "@/components/propamm/venue-badge"
import type { QuoteResult, QuoteStatus } from "@/hooks/use-propamm-quote"
import type { TokenConfig } from "@/lib/token-registry"

function fmt(amount: bigint | null, decimals: number): string {
  if (amount === null) return "—"
  const n = Number(formatUnits(amount, decimals))
  if (n === 0) return "0"
  if (n < 0.0001) return "<0.0001"
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export function RouteInfo({
  status,
  quote,
  error,
  tokenOut,
}: {
  status: QuoteStatus
  quote: QuoteResult | null
  error: string | null
  tokenOut?: TokenConfig
}) {
  const [open, setOpen] = useState(false)

  if (status === "idle") return null

  if (status === "loading" && !quote) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Finding the best route across venues…
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error ?? "No route found"}
      </div>
    )
  }

  if (!quote || !tokenOut) return null

  const { bestVenue, venueQuotes, usedFallback } = quote
  const comparable = venueQuotes.filter((v) => v.amountOut !== null)

  return (
    <div className="rounded-xl border border-border bg-secondary/40">
      {/* Best route summary */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Routing via
          </span>
          <VenueBadge venue={bestVenue} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {comparable.length > 0 && (
            <span>{comparable.length} venues compared</span>
          )}
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Auto-fallback safety note */}
      {usedFallback ? (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-xs text-pink-300">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Proprietary venues couldn&apos;t fill this trade, so the router
            automatically fell back to <strong>Uniswap V3</strong> — your trade
            still executes at the best public price.
          </span>
        </div>
      ) : (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300/90">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Best price from a proprietary venue. If it can&apos;t fill at
            execution, the router auto-falls back to Uniswap V3.
          </span>
        </div>
      )}

      {/* Per-venue breakdown */}
      {open && comparable.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Venue comparison
          </div>
          <ul className="flex flex-col gap-1.5">
            {comparable
              .slice()
              .sort((a, b) =>
                (b.amountOut ?? 0n) > (a.amountOut ?? 0n) ? 1 : -1,
              )
              .map((vq) => (
                <li
                  key={vq.venue.key}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-2 py-1.5 text-sm",
                    vq.isBest && "bg-sky-500/10",
                  )}
                >
                  <VenueBadge venue={vq.venue} />
                  <span
                    className={cn(
                      "font-mono",
                      vq.isBest
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {fmt(vq.amountOut, tokenOut.decimals)} {tokenOut.symbol}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
