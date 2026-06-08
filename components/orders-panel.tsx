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
  TrendingDown,
  TrendingUp,
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
  generateOpenOrders,
  ORDER_ASSETS,
  type OpenOrder,
} from "@/lib/orders"
import type { TokenSymbol } from "@/lib/propamm-types"

type FillStage = "review" | "signing" | "done"
type AssetFilter = TokenSymbol | "ALL"
type OrderScope = "token" | "option"

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
  const label =
    h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  return { expired: ms <= 0, label }
}

function DirectionBadge({ direction }: { direction: OpenOrder["direction"] }) {
  const isBuy = direction === "buy"
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
      {direction}
    </span>
  )
}

function OrderCard({
  order,
  onClick,
}: {
  order: OpenOrder
  onClick: () => void
}) {
  const { expired, label } = useCountdown(order.orderExpiry)
  const isOption = order.instrument === "option"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={expired}
      className={cn(
        "flex w-full flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-left transition-colors",
        expired
          ? "cursor-not-allowed opacity-40"
          : "hover:border-sky-500/40 hover:bg-secondary",
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
              <span className="font-mono text-xs font-bold">{order.asset.slice(0, 2)}</span>
            )}
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {order.asset}
              {isOption && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    order.optionLeg === "call" ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {order.optionLeg === "call" ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {order.optionLeg === "call" ? "Call" : "Put"}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {isOption ? "Option" : "Token"} · {order.maker}
            </div>
          </div>
        </div>
        <DirectionBadge direction={order.direction} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">
            {isOption ? "Contracts" : "Quantity"}
          </div>
          <div className="font-medium tabular-nums text-foreground">
            {formatAmount(order.quantity)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">
            {isOption ? "Strike" : "Unit price"}
          </div>
          <div className="font-medium tabular-nums text-foreground">
            {isOption ? formatUsd(order.strikeUsd ?? 0) : formatUsd(order.unitPriceUsd)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Order value</div>
          <div className="font-semibold tabular-nums text-foreground">
            {formatUsd(order.notionalUsd)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {expired ? "Expired" : `Expires in ${label}`}
        </span>
        {isOption && order.optionExpiry && (
          <span className="text-muted-foreground">
            Exp {format(order.optionExpiry, "dd MMM")}
          </span>
        )}
      </div>
    </button>
  )
}

function OrderDetailRow({
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

function OrderDetailDialog({
  order,
  onClose,
  onFilled,
}: {
  order: OpenOrder | null
  onClose: () => void
  onFilled: (id: string) => void
}) {
  const [stage, setStage] = useState<FillStage>("review")

  useEffect(() => {
    if (order) setStage("review")
  }, [order])

  if (!order) return null

  const isOption = order.instrument === "option"
  // taker takes the opposite side of the maker
  const takerAction = order.direction === "buy" ? "Sell to maker" : "Buy from maker"

  const handleSign = () => {
    setStage("signing")
    setTimeout(() => {
      setStage("done")
      setTimeout(() => {
        onFilled(order.id)
        onClose()
      }, 1600)
    }, 1800)
  }

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{order.asset}</span>
            {isOption ? (
              <span
                className={cn(
                  "text-sm font-medium",
                  order.optionLeg === "call" ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {order.optionLeg === "call" ? "Call Option" : "Put Option"}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                Spot Token
              </span>
            )}
            <DirectionBadge direction={order.direction} />
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border">
          <OrderDetailRow label="Maker" value={order.maker} />
          <OrderDetailRow label="Your side" value={takerAction} mono={false} />
          <OrderDetailRow
            label={isOption ? "Contracts" : "Quantity"}
            value={`${formatAmount(order.quantity)} ${isOption ? "" : order.asset}`}
          />
          {isOption && (
            <>
              <OrderDetailRow label="Strike price" value={formatUsd(order.strikeUsd ?? 0)} />
              <OrderDetailRow
                label="Premium / contract"
                value={formatUsd(order.unitPriceUsd)}
              />
              <OrderDetailRow
                label="Option expiry"
                value={order.optionExpiry ? format(order.optionExpiry, "dd MMM yyyy") : "—"}
              />
            </>
          )}
          {!isOption && (
            <OrderDetailRow label="Unit price" value={formatUsd(order.unitPriceUsd)} />
          )}
          <OrderDetailRow label="Settlement" value={order.settlement} />
          <OrderDetailRow
            label="Order expires"
            value={format(order.orderExpiry, "dd MMM HH:mm")}
          />
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-foreground">Total value</span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatUsd(order.notionalUsd)}
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
          <Button
            size="lg"
            disabled
            className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950"
          >
            <Loader2 className="size-5 animate-spin" /> Signing Transaction
          </Button>
        )}
        {stage === "done" && (
          <Button
            size="lg"
            disabled
            className="h-12 w-full bg-emerald-500 text-base font-semibold text-emerald-950"
          >
            <Check className="size-5" /> Order Filled
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function OrdersPanel({ scope = "token" }: { scope?: OrderScope }) {
  const [orders, setOrders] = useState<OpenOrder[]>([])
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("ALL")
  const [active, setActive] = useState<OpenOrder | null>(null)

  useEffect(() => {
    setOrders(generateOpenOrders(18))
  }, [])

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (o.instrument !== scope) return false
      if (assetFilter !== "ALL" && o.asset !== assetFilter) return false
      return true
    })
  }, [orders, assetFilter, scope])

  const handleFilled = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          {scope === "option" ? "Option Orders" : "Token Orders"}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {filtered.length} fillable
        </span>
      </div>

      {/* Asset filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["ALL", ...ORDER_ASSETS] as AssetFilter[]).map((a) => (
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

      {/* Order list */}
      <div className="terminal-scroll -mr-2 flex-1 space-y-2.5 overflow-y-auto pr-2">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Layers className="size-6 opacity-40" />
            No open orders match your filters
          </div>
        ) : (
          filtered.map((o) => (
            <OrderCard key={o.id} order={o} onClick={() => setActive(o)} />
          ))
        )}
      </div>

      <OrderDetailDialog
        order={active}
        onClose={() => setActive(null)}
        onFilled={handleFilled}
      />
    </div>
  )
}
