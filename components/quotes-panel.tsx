"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Layers,
  Loader2,
  MessageSquare,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatUsd, formatAmount } from "@/lib/quotes"
import { generateRfqs, RFQ_ASSETS, suggestUnitPrice, type Rfq } from "@/lib/rfqs"
import type { TokenSymbol } from "@/lib/propamm-types"
import { useChat } from "@/components/chat/chat-context"

type QuoteStage = "draft" | "submitting" | "done"
type AssetFilter = TokenSymbol | "ALL"
type QuoteScope = "token" | "option"

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(target - now, 0)
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const label = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  return { expired: ms <= 0, label }
}

function SideBadge({ side }: { side: Rfq["side"] }) {
  const isBuy = side === "buy"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        isBuy
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-rose-500/15 text-rose-400",
      )}
    >
      {isBuy ? (
        <ArrowDownLeft className="size-3" />
      ) : (
        <ArrowUpRight className="size-3" />
      )}
      wants to {side}
    </span>
  )
}

function RfqCard({
  rfq,
  onClick,
  onChat,
}: {
  rfq: Rfq
  onClick: () => void
  onChat: () => void
}) {
  const { expired, label } = useCountdown(rfq.rfqExpiry)
  const isOption = rfq.instrument === "option"

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-left transition-colors",
        expired ? "opacity-40" : "hover:border-sky-500/40 hover:bg-secondary",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={expired}
        className={cn(
          "flex flex-col gap-3 text-left",
          expired ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              isOption ? "bg-sky-500/15 text-sky-400" : "bg-secondary text-foreground",
            )}
          >
            {isOption ? (
              <Layers className="size-4" />
            ) : (
              <span className="font-mono text-xs font-bold">{rfq.asset.slice(0, 2)}</span>
            )}
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {rfq.asset}
              {isOption && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    rfq.optionLeg === "call" ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {rfq.optionLeg === "call" ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {rfq.optionLeg === "call" ? "Call" : "Put"}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {isOption ? "Option" : "Token"} RFQ · {rfq.requester}
            </div>
          </div>
        </div>
        <SideBadge side={rfq.side} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">
            {isOption ? "Contracts" : "Quantity"}
          </div>
          <div className="font-medium tabular-nums text-foreground">
            {formatAmount(rfq.quantity)}
          </div>
        </div>
        {isOption ? (
          <div>
            <div className="text-xs text-muted-foreground">Strike</div>
            <div className="font-medium tabular-nums text-foreground">
              {formatUsd(rfq.strikeUsd ?? 0)}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-muted-foreground">Settle</div>
            <div className="font-medium tabular-nums text-foreground">{rfq.settlement}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-muted-foreground">Competing</div>
          <div className="flex items-center gap-1 font-medium tabular-nums text-foreground">
            <Users className="size-3 text-muted-foreground" />
            {rfq.competingQuotes}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {expired ? "Closed" : `Quotes close in ${label}`}
        </span>
        {isOption && rfq.optionExpiry && (
          <span className="text-muted-foreground">
            Exp {format(rfq.optionExpiry, "dd MMM")}
          </span>
        )}
      </div>
      </button>

      {/* Action row */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={expired}
          className={cn(
            "flex-1 rounded-lg bg-sky-500 py-2 text-xs font-semibold text-sky-950 transition-colors hover:bg-sky-400",
            expired && "cursor-not-allowed opacity-50",
          )}
        >
          Submit quote
        </button>
        <button
          type="button"
          onClick={onChat}
          disabled={expired}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary",
            expired && "cursor-not-allowed opacity-50",
          )}
        >
          <MessageSquare className="size-3.5" />
          Chat with maker
        </button>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono = true,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>
        {value}
      </span>
    </div>
  )
}

function QuoteDialog({
  rfq,
  onClose,
  onQuoted,
}: {
  rfq: Rfq | null
  onClose: () => void
  onQuoted: (id: string) => void
}) {
  const [stage, setStage] = useState<QuoteStage>("draft")
  const [price, setPrice] = useState("")

  useEffect(() => {
    if (rfq) {
      setStage("draft")
      setPrice(String(suggestUnitPrice(rfq)))
    }
  }, [rfq])

  if (!rfq) return null

  const isOption = rfq.instrument === "option"
  // you quote the opposite side of what the requester wants
  const yourSide = rfq.side === "buy" ? "Sell to requester" : "Buy from requester"
  const unit = Number(price) || 0
  const total = unit * rfq.quantity

  const handleSubmit = () => {
    if (unit <= 0) return
    setStage("submitting")
    setTimeout(() => {
      setStage("done")
      setTimeout(() => {
        onQuoted(rfq.id)
        onClose()
      }, 1600)
    }, 1600)
  }

  return (
    <Dialog open={!!rfq} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{rfq.asset}</span>
            {isOption ? (
              <span
                className={cn(
                  "text-sm font-medium",
                  rfq.optionLeg === "call" ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {rfq.optionLeg === "call" ? "Call Option" : "Put Option"}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">Spot Token</span>
            )}
            <SideBadge side={rfq.side} />
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border">
          <DetailRow label="Requester" value={rfq.requester} />
          <DetailRow label="Your side" value={yourSide} mono={false} />
          <DetailRow
            label={isOption ? "Contracts" : "Quantity"}
            value={`${formatAmount(rfq.quantity)} ${isOption ? "" : rfq.asset}`}
          />
          {isOption && (
            <>
              <DetailRow label="Strike price" value={formatUsd(rfq.strikeUsd ?? 0)} />
              <DetailRow
                label="Option expiry"
                value={rfq.optionExpiry ? format(rfq.optionExpiry, "dd MMM yyyy") : "—"}
              />
            </>
          )}
          <DetailRow label="Settlement" value={rfq.settlement} />
          <DetailRow label="Competing quotes" value={String(rfq.competingQuotes)} />
        </div>

        {stage === "draft" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Your {isOption ? "premium / contract" : "unit price"} ({rfq.settlement})
              </label>
              <Input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-11 font-mono"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Total quote value</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {formatUsd(total)}
              </span>
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={unit <= 0}
              className="h-12 w-full bg-sky-500 text-base font-semibold text-sky-950 hover:bg-sky-400"
            >
              <Send className="size-4" /> Submit Quote
            </Button>
          </div>
        )}
        {stage === "submitting" && (
          <Button
            size="lg"
            disabled
            className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950"
          >
            <Loader2 className="size-5 animate-spin" /> Submitting Quote
          </Button>
        )}
        {stage === "done" && (
          <Button
            size="lg"
            disabled
            className="h-12 w-full bg-emerald-500 text-base font-semibold text-emerald-950"
          >
            <Check className="size-5" /> Quote Submitted
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function QuotesPanel({ scope = "token" }: { scope?: QuoteScope }) {
  const [rfqs, setRfqs] = useState<Rfq[]>([])
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL")
  const [active, setActive] = useState<Rfq | null>(null)
  const { startChatFromQuote } = useChat()

  useEffect(() => {
    setRfqs(generateRfqs(18))
  }, [])

  const filtered = useMemo(() => {
    return rfqs.filter((r) => {
      if (r.instrument !== scope) return false
      if (assetFilter !== "ALL" && r.asset !== assetFilter) return false
      return true
    })
  }, [rfqs, assetFilter, scope])

  const handleQuoted = (id: string) => {
    setRfqs((prev) => prev.filter((r) => r.id !== id))
  }

  // Intent-driven: open the sidebar and auto-send the trade context.
  const handleChat = (rfq: Rfq) => {
    startChatFromQuote({
      peerAddress: rfq.requester,
      quoteId: rfq.id,
      inquiry: {
        quoteId: rfq.id,
        instrument: rfq.instrument,
        side: rfq.side,
        asset: rfq.asset,
        quantity: rfq.quantity,
        settlement: rfq.settlement,
        proposedPrice: suggestUnitPrice(rfq),
        strikeUsd: rfq.strikeUsd,
        optionExpiry: rfq.optionExpiry,
        note: `Following up on your ${rfq.asset} RFQ — happy to make you a market.`,
      },
    })
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          {scope === "option" ? "Option Quotes" : "Token Quotes"}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {filtered.length} active RFQs
        </span>
      </div>

      {/* Asset filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["ALL", ...RFQ_ASSETS] as AssetFilter[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAssetFilter(a)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              assetFilter === a
                ? "border-sky-500/60 bg-sky-500/10 text-sky-400"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {a === "ALL" ? "All assets" : a}
          </button>
        ))}
      </div>

      {/* RFQ list */}
      <div className="terminal-scroll -mr-2 flex-1 space-y-2.5 overflow-y-auto pr-2">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Send className="size-6 opacity-40" />
            No active RFQs match your filters
          </div>
        ) : (
          filtered.map((r) => (
            <RfqCard
              key={r.id}
              rfq={r}
              onClick={() => setActive(r)}
              onChat={() => handleChat(r)}
            />
          ))
        )}
      </div>

      <QuoteDialog
        rfq={active}
        onClose={() => setActive(null)}
        onQuoted={handleQuoted}
      />
    </div>
  )
}
