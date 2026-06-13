"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Check, Clock, Layers, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useQuoteStream } from "@/hooks/use-quote-stream"
import { findTokenByAddress } from "@/lib/token-registry"
import type { StreamMessage } from "@/lib/ws-client"
import { useChainId } from "wagmi"

type FillStage = "review" | "signing" | "done"
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

function StreamOrderCard({
  msg,
  onClick,
}: {
  msg: StreamMessage
  onClick: () => void
}) {
  const chainId = useChainId()
  const payload = msg.parsedPayload
  const assetSellToken = payload ? findTokenByAddress(chainId, payload.assetSell) : undefined
  const assetBuyToken = payload ? findTokenByAddress(chainId, payload.assetBuy) : undefined
  const assetSellSym = assetSellToken?.symbol ?? payload?.assetSell.slice(0, 6) ?? "?"
  const assetBuySym = assetBuyToken?.symbol ?? payload?.assetBuy.slice(0, 6) ?? "?"
  const { expired, label } = useCountdown(msg.deadline * 1000)

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
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
            <span className="font-mono text-xs font-bold">{assetSellSym.slice(0, 2)}</span>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              Sell {payload?.amountSell} {assetSellSym}
            </div>
            <div className="text-xs text-muted-foreground">
              Buy {payload?.amountBuy} {assetBuySym} · {msg.maker.slice(0, 6)}...{msg.maker.slice(-4)}
            </div>
          </div>
        </div>
      </div>

      {payload?.message && (
        <div className="text-xs text-muted-foreground italic line-clamp-2">
          {payload.message}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          {expired ? "Expired" : `Expires in ${label}`}
        </span>
        <span className="text-muted-foreground">
          {payload?.taker && payload.taker !== "0x0000000000000000000000000000000000000000"
            ? `Taker: ${payload.taker.slice(0, 6)}...${payload.taker.slice(-4)}`
            : "Public order"}
        </span>
      </div>
    </button>
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

function StreamOrderDialog({
  msg,
  onClose,
}: {
  msg: StreamMessage | null
  onClose: () => void
}) {
  const chainId = useChainId()
  const [stage, setStage] = useState<FillStage>("review")

  useEffect(() => {
    if (msg) setStage("review")
  }, [msg])

  if (!msg) return null

  const payload = msg.parsedPayload
  const assetSellToken = payload ? findTokenByAddress(chainId, payload.assetSell) : undefined
  const assetBuyToken = payload ? findTokenByAddress(chainId, payload.assetBuy) : undefined
  const assetSellSym = assetSellToken?.symbol ?? payload?.assetSell.slice(0, 6) ?? "?"
  const assetBuySym = assetBuyToken?.symbol ?? payload?.assetBuy.slice(0, 6) ?? "?"
  const isPrivate =
    payload?.taker && payload.taker !== "0x0000000000000000000000000000000000000000"

  const handleSign = () => {
    setStage("signing")
    setTimeout(() => {
      setStage("done")
      setTimeout(() => {
        onClose()
      }, 1600)
    }, 1800)
  }

  return (
    <Dialog open={!!msg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Order Detail</span>
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Maker</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(msg.maker)}
              className="cursor-pointer font-mono text-sm font-medium text-foreground hover:text-sky-400"
            >
              {msg.maker}
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Want Sell</span>
            <div
              className="cursor-pointer text-right hover:text-sky-400"
              onClick={() => payload?.assetSell && navigator.clipboard.writeText(payload.assetSell)}
              title={payload?.assetSell ?? ""}
            >
              <div className="text-sm font-medium text-foreground">
                {payload?.amountSell ?? "?"} {assetSellSym}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Want Buy</span>
            <div
              className="cursor-pointer text-right hover:text-sky-400"
              onClick={() => payload?.assetBuy && navigator.clipboard.writeText(payload.assetBuy)}
              title={payload?.assetBuy ?? ""}
            >
              <div className="text-sm font-medium text-foreground">
                {payload?.amountBuy ?? "?"} {assetBuySym}
              </div>
            </div>
          </div>
          <DetailRow
            label="Expiry"
            value={format(msg.deadline * 1000, "dd MMM yyyy HH:mm")}
          />
          <DetailRow
            label="Taker"
            value={
              isPrivate
                ? `${payload!.taker.slice(0, 8)}...${payload!.taker.slice(-6)}`
                : "Public (anyone can take)"
            }
            mono={false}
          />
          {payload?.message && (
            <div className="py-2">
              <span className="text-sm text-muted-foreground">Message</span>
              <p className="mt-1 text-sm text-foreground">{payload.message}</p>
            </div>
          )}
        </div>

        {stage === "review" && (
          <Button
            size="lg"
            onClick={handleSign}
            className="h-12 w-full bg-sky-500 text-base font-semibold text-sky-950 hover:bg-sky-400"
          >
            Take Order
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
  const { orders: streamOrders } = useQuoteStream()
  const [active, setActive] = useState<StreamMessage | null>(null)

  const showOrders = scope === "token" && streamOrders.length > 0

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          {scope === "option" ? "Option Orders" : "Token Orders"}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {showOrders ? streamOrders.length : 0} fillable
        </span>
      </div>

      <div className="terminal-scroll -mr-2 flex-1 space-y-2.5 overflow-y-auto pr-2">
        {!showOrders ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Layers className="size-6 opacity-40" />
            No open orders
          </div>
        ) : (
          streamOrders.map((msg) => (
            <StreamOrderCard
              key={msg.nonce}
              msg={msg}
              onClick={() => setActive(msg)}
            />
          ))
        )}
      </div>

      <StreamOrderDialog
        msg={active}
        onClose={() => setActive(null)}
      />
    </div>
  )
}
