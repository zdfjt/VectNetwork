"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clock,
  Coins,
  Loader2,
  Shield,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatUsd, formatAmount } from "@/lib/quotes"
import {
  generateLoanOffers,
  accruedInterest,
  LOAN_MARKET_ASSETS,
  type LoanOffer,
} from "@/lib/lending"
import type { TokenSymbol } from "@/lib/propamm-types"

type FillStage = "review" | "signing" | "done"
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

function DirectionBadge({ direction }: { direction: LoanOffer["direction"] }) {
  const isLend = direction === "lend"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
        isLend ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400",
      )}
    >
      {isLend ? <ArrowUpFromLine className="size-3" /> : <ArrowDownToLine className="size-3" />}
      {isLend ? "offers to lend" : "wants to borrow"}
    </span>
  )
}

function OfferCard({ offer, onClick }: { offer: LoanOffer; onClick: () => void }) {
  const { expired, label } = useCountdown(offer.offerExpiry)
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
            <div className="font-semibold text-foreground">{offer.asset}</div>
            <div className="text-xs text-muted-foreground">Loan · {offer.maker}</div>
          </div>
        </div>
        <DirectionBadge direction={offer.direction} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Principal</div>
          <div className="font-medium tabular-nums text-foreground">
            {formatAmount(offer.principal)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">APR</div>
          <div className="font-semibold tabular-nums text-foreground">
            {offer.aprPct.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Term</div>
          <div className="font-medium tabular-nums text-foreground">{offer.termDays}d</div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Shield className="size-3" />
          {offer.collateral} · {offer.ltvPct}% LTV
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {expired ? "Expired" : label}
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

function OfferDetailDialog({
  offer,
  onClose,
  onFilled,
}: {
  offer: LoanOffer | null
  onClose: () => void
  onFilled: (id: string) => void
}) {
  const [stage, setStage] = useState<FillStage>("review")

  useEffect(() => {
    if (offer) setStage("review")
  }, [offer])

  if (!offer) return null

  // taker takes the opposite side of the maker
  const yourSide = offer.direction === "lend" ? "Borrow from maker" : "Lend to maker"
  const interest = accruedInterest(offer.principalUsd, offer.aprPct, offer.termDays)

  const handleSign = () => {
    setStage("signing")
    setTimeout(() => {
      setStage("done")
      setTimeout(() => {
        onFilled(offer.id)
        onClose()
      }, 1600)
    }, 1800)
  }

  return (
    <Dialog open={!!offer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{offer.asset}</span>
            <span className="text-sm font-medium text-muted-foreground">Loan</span>
            <DirectionBadge direction={offer.direction} />
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border">
          <DetailRow label="Maker" value={offer.maker} />
          <DetailRow label="Your side" value={yourSide} mono={false} />
          <DetailRow label="Principal" value={`${formatAmount(offer.principal)} ${offer.asset}`} />
          <DetailRow label="Principal value" value={formatUsd(offer.principalUsd)} />
          <DetailRow label="APR" value={`${offer.aprPct.toFixed(2)}%`} />
          <DetailRow label="Term" value={`${offer.termDays} days`} />
          <DetailRow label="Collateral" value={`${offer.collateral} · ${offer.ltvPct}% LTV`} />
          <DetailRow label="Offer expires" value={format(offer.offerExpiry, "dd MMM HH:mm")} />
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-foreground">Est. interest</span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatUsd(interest)}
            </span>
          </div>
        </div>

        {stage === "review" && (
          <Button
            size="lg"
            onClick={handleSign}
            className="h-12 w-full bg-sky-500 text-base font-semibold text-sky-950 hover:bg-sky-400"
          >
            Confirm & Sign Transaction
          </Button>
        )}
        {stage === "signing" && (
          <Button size="lg" disabled className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950">
            <Loader2 className="size-5 animate-spin" /> Signing Transaction
          </Button>
        )}
        {stage === "done" && (
          <Button size="lg" disabled className="h-12 w-full bg-emerald-500 text-base font-semibold text-emerald-950">
            <Check className="size-5" /> Loan Filled
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function LendingOrdersPanel() {
  const [offers, setOffers] = useState<LoanOffer[]>([])
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL")
  const [active, setActive] = useState<LoanOffer | null>(null)

  useEffect(() => {
    setOffers(generateLoanOffers(16))
  }, [])

  const filtered = useMemo(() => {
    return offers.filter((o) => assetFilter === "ALL" || o.asset === assetFilter)
  }, [offers, assetFilter])

  const handleFilled = (id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id))
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Loan Orders</h2>
        <span className="font-mono text-xs text-muted-foreground">{filtered.length} fillable</span>
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
            <Coins className="size-6 opacity-40" />
            No loan offers match your filters
          </div>
        ) : (
          filtered.map((o) => <OfferCard key={o.id} offer={o} onClick={() => setActive(o)} />)
        )}
      </div>

      <OfferDetailDialog offer={active} onClose={() => setActive(null)} onFilled={handleFilled} />
    </div>
  )
}
