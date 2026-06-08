"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clock,
  Coins,
  Loader2,
  Send,
  Shield,
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
import {
  generateLendingRfqs,
  suggestApr,
  accruedInterest,
  LOAN_MARKET_ASSETS,
  type LendingRfq,
} from "@/lib/lending"
import type { TokenSymbol } from "@/lib/propamm-types"

type QuoteStage = "draft" | "submitting" | "done"
type AssetFilter = TokenSymbol | "ALL"

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

function SideBadge({ direction }: { direction: LendingRfq["direction"] }) {
  const isLend = direction === "lend"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        isLend ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400",
      )}
    >
      {isLend ? <ArrowUpFromLine className="size-3" /> : <ArrowDownToLine className="size-3" />}
      wants to {isLend ? "lend" : "borrow"}
    </span>
  )
}

function RfqCard({ rfq, onClick }: { rfq: LendingRfq; onClick: () => void }) {
  const { expired, label } = useCountdown(rfq.rfqExpiry)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={expired}
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-left transition-colors",
        expired ? "cursor-not-allowed opacity-40" : "hover:border-sky-500/40 hover:bg-secondary",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
            <Coins className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-foreground">{rfq.asset}</div>
            <div className="text-xs text-muted-foreground">Loan RFQ · {rfq.requester}</div>
          </div>
        </div>
        <SideBadge direction={rfq.direction} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Principal</div>
          <div className="font-medium tabular-nums text-foreground">
            {formatAmount(rfq.principal)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Term</div>
          <div className="font-medium tabular-nums text-foreground">{rfq.termDays}d</div>
        </div>
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
          <Shield className="size-3" />
          {rfq.collateral} · {rfq.ltvPct}% LTV
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {expired ? "Closed" : `closes in ${label}`}
        </span>
      </div>
    </button>
  )
}

function DetailRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  )
}

function QuoteDialog({
  rfq,
  onClose,
  onQuoted,
}: {
  rfq: LendingRfq | null
  onClose: () => void
  onQuoted: (id: string) => void
}) {
  const [stage, setStage] = useState<QuoteStage>("draft")
  const [apr, setApr] = useState("")

  useEffect(() => {
    if (rfq) {
      setStage("draft")
      setApr(String(suggestApr(rfq)))
    }
  }, [rfq])

  if (!rfq) return null

  const yourSide = rfq.direction === "lend" ? "Borrow from requester" : "Lend to requester"
  const aprNum = Number(apr) || 0
  const interest = accruedInterest(rfq.principalUsd, aprNum, rfq.termDays)

  const handleSubmit = () => {
    if (aprNum <= 0) return
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
            <span className="text-sm font-medium text-muted-foreground">Loan</span>
            <SideBadge direction={rfq.direction} />
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border">
          <DetailRow label="Requester" value={rfq.requester} />
          <DetailRow label="Your side" value={yourSide} mono={false} />
          <DetailRow label="Principal" value={`${formatAmount(rfq.principal)} ${rfq.asset}`} />
          <DetailRow label="Principal value" value={formatUsd(rfq.principalUsd)} />
          <DetailRow label="Term" value={`${rfq.termDays} days`} />
          <DetailRow label="Collateral" value={`${rfq.collateral} · ${rfq.ltvPct}% LTV`} />
          <DetailRow label="Competing quotes" value={String(rfq.competingQuotes)} />
        </div>

        {stage === "draft" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Your APR quote (%)
              </label>
              <Input
                type="number"
                inputMode="decimal"
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                className="h-11 font-mono"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Est. interest over term</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {formatUsd(interest)}
              </span>
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={aprNum <= 0}
              className="h-12 w-full bg-sky-500 text-base font-semibold text-sky-950 hover:bg-sky-400"
            >
              <Send className="size-4" /> Submit Quote
            </Button>
          </div>
        )}
        {stage === "submitting" && (
          <Button size="lg" disabled className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950">
            <Loader2 className="size-5 animate-spin" /> Submitting Quote
          </Button>
        )}
        {stage === "done" && (
          <Button size="lg" disabled className="h-12 w-full bg-emerald-500 text-base font-semibold text-emerald-950">
            <Check className="size-5" /> Quote Submitted
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function LendingQuotesPanel() {
  const [rfqs, setRfqs] = useState<LendingRfq[]>([])
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL")
  const [active, setActive] = useState<LendingRfq | null>(null)

  useEffect(() => {
    setRfqs(generateLendingRfqs(16))
  }, [])

  const filtered = useMemo(() => {
    return rfqs.filter((r) => assetFilter === "ALL" || r.asset === assetFilter)
  }, [rfqs, assetFilter])

  const handleQuoted = (id: string) => {
    setRfqs((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Loan Quotes</h2>
        <span className="font-mono text-xs text-muted-foreground">{filtered.length} active RFQs</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["ALL", ...LOAN_MARKET_ASSETS] as AssetFilter[]).map((a) => (
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

      <div className="terminal-scroll -mr-2 flex-1 space-y-2.5 overflow-y-auto pr-2">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Send className="size-6 opacity-40" />
            No loan RFQs match your filters
          </div>
        ) : (
          filtered.map((r) => <RfqCard key={r.id} rfq={r} onClick={() => setActive(r)} />)
        )}
      </div>

      <QuoteDialog rfq={active} onClose={() => setActive(null)} onQuoted={handleQuoted} />
    </div>
  )
}
