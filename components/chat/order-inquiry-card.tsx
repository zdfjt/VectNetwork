"use client"

import { ArrowDownLeft, ArrowUpRight } from "lucide-react"
import type { OrderInquiry } from "@/lib/xmtp-types"
import { cn } from "@/lib/utils"

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 })
}

/**
 * Renders an ORDER_INQUIRY message as a structured "order quote card" so both
 * parties can read the trade context at a glance and act on it.
 */
export function OrderInquiryCard({
  inquiry,
  mine,
  onAccept,
  onCounter,
}: {
  inquiry: OrderInquiry
  mine: boolean
  onAccept?: () => void
  onCounter?: () => void
}) {
  const isBuy = inquiry.side === "buy"
  const isOption = inquiry.instrument === "option"

  return (
    <div
      className={cn(
        "w-full max-w-[300px] overflow-hidden rounded-xl border bg-card",
        mine ? "border-sky-500/40" : "border-border",
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
        <span className="text-xs font-medium text-foreground">Order inquiry</span>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
          )}
        >
          {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
          {inquiry.side.toUpperCase()}
        </span>
      </div>

      <div className="space-y-1.5 px-3 py-2.5 text-xs">
        <Row label="Asset" value={`${inquiry.asset}${isOption ? " (option)" : ""}`} />
        <Row label="Quantity" value={`${fmt(inquiry.quantity)} ${isOption ? "contracts" : inquiry.asset}`} />
        {inquiry.proposedPrice != null && (
          <Row
            label={isOption ? "Premium" : "Price"}
            value={`${fmt(inquiry.proposedPrice)} ${inquiry.settlement}`}
          />
        )}
        {isOption && inquiry.strikeUsd != null && (
          <Row label="Strike" value={`$${fmt(inquiry.strikeUsd)}`} />
        )}
        {isOption && inquiry.optionExpiry != null && (
          <Row
            label="Expiry"
            value={new Date(inquiry.optionExpiry).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          />
        )}
        <Row label="Settles in" value={inquiry.settlement} />
        <Row label="Quote ID" value={inquiry.quoteId} mono />
      </div>

      {inquiry.note && (
        <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {inquiry.note}
        </p>
      )}

      {!mine && (onAccept || onCounter) && (
        <div className="flex gap-2 border-t border-border px-3 py-2">
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 rounded-lg bg-sky-500 py-1.5 text-xs font-medium text-sky-950 transition-colors hover:bg-sky-400"
            >
              Accept
            </button>
          )}
          {onCounter && (
            <button
              type="button"
              onClick={onCounter}
              className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Counter
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground", mono && "font-mono text-[11px]")}>{value}</span>
    </div>
  )
}
