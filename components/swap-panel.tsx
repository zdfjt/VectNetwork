"use client"

import { useMemo, useState } from "react"
import { ArrowDown, Check, Loader2, Zap } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TOKENS, getToken, type Quote, type TokenSymbol } from "@/lib/propamm-types"
import { generateQuotes, formatAmount } from "@/lib/quotes"

type SwapStage = "idle" | "requesting" | "selecting" | "signing" | "done"

function TokenField({
  label,
  amount,
  onAmountChange,
  token,
  onTokenChange,
  readOnly,
  placeholder,
}: {
  label: string
  amount: string
  onAmountChange?: (v: string) => void
  token: TokenSymbol
  onTokenChange: (v: TokenSymbol) => void
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Input
          inputMode="decimal"
          value={amount}
          readOnly={readOnly}
          placeholder={placeholder ?? "0.0"}
          onChange={(e) => {
            const v = e.target.value
            if (v === "" || /^\d*\.?\d*$/.test(v)) onAmountChange?.(v)
          }}
          className={cn(
            "h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0",
            readOnly && "text-muted-foreground",
          )}
        />
        <Select value={token} onValueChange={(v) => onTokenChange(v as TokenSymbol)}>
          <SelectTrigger className="w-[120px] shrink-0 bg-card font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOKENS.map((t) => (
              <SelectItem key={t.symbol} value={t.symbol}>
                {t.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function QuoteRow({
  quote,
  best,
  selected,
  onSelect,
  symbol,
}: {
  quote: Quote
  best: boolean
  selected: boolean
  onSelect: () => void
  symbol: TokenSymbol
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-sky-500/60 bg-sky-500/10"
          : "border-border bg-secondary/40 hover:border-sky-500/30 hover:bg-secondary",
      )}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {quote.proposer}
          </span>
          {best && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-400">
              best
            </span>
          )}
        </div>
        <span className="mt-0.5 text-xs text-muted-foreground">
          fee {quote.feeBps}bps · impact {quote.priceImpactBps}bps · {quote.latencyMs}ms
        </span>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums text-foreground">
          {formatAmount(quote.amountOut)}
        </div>
        <div className="text-xs text-muted-foreground">{symbol}</div>
      </div>
    </button>
  )
}

export function SwapPanel() {
  const [tokenIn, setTokenIn] = useState<TokenSymbol>("ETH")
  const [tokenOut, setTokenOut] = useState<TokenSymbol>("USDC")
  const [amountIn, setAmountIn] = useState("1.0")
  const [memo, setMemo] = useState("")

  const [stage, setStage] = useState<SwapStage>("idle")
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const parsedAmount = Number.parseFloat(amountIn) || 0
  const selectedQuote = quotes.find((q) => q.id === selectedId) ?? null

  const estimatedOut = useMemo(() => {
    if (selectedQuote) return formatAmount(selectedQuote.amountOut)
    if (!parsedAmount) return ""
    const fair = (parsedAmount * getToken(tokenIn).price) / getToken(tokenOut).price
    return formatAmount(fair)
  }, [selectedQuote, parsedAmount, tokenIn, tokenOut])

  const flipTokens = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    resetFlow()
  }

  const resetFlow = () => {
    setStage("idle")
    setQuotes([])
    setSelectedId(null)
  }

  const handleRequestQuotes = () => {
    setStage("requesting")
    setQuotes([])
    setSelectedId(null)
    // simulate proposer auction round-trip
    setTimeout(() => {
      const q = generateQuotes(parsedAmount, getToken(tokenIn), getToken(tokenOut))
      setQuotes(q)
      setSelectedId(q[0]?.id ?? null)
      setStage("selecting")
    }, 1400)
  }

  const handleSign = () => {
    setStage("signing")
    setTimeout(() => {
      setStage("done")
      setTimeout(resetFlow, 2600)
    }, 1800)
  }

  const disabled =
    parsedAmount <= 0 || tokenIn === tokenOut

  const renderButton = () => {
    if (stage === "idle" || stage === "done") {
      return (
        <Button
          size="lg"
          disabled={disabled}
          onClick={handleRequestQuotes}
          className="h-12 w-full bg-sky-500 text-base font-semibold text-sky-950 hover:bg-sky-400"
        >
          {stage === "done" ? (
            <>
              <Check className="size-5" /> Swap Confirmed
            </>
          ) : tokenIn === tokenOut ? (
            "Select different tokens"
          ) : parsedAmount <= 0 ? (
            "Enter an amount"
          ) : (
            <>
              <Zap className="size-5" /> Request Quotes
            </>
          )}
        </Button>
      )
    }

    if (stage === "requesting") {
      return (
        <Button
          size="lg"
          disabled
          className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950"
        >
          <Loader2 className="size-5 animate-spin" /> Requesting Quotes
        </Button>
      )
    }

    if (stage === "selecting") {
      return (
        <Button
          size="lg"
          disabled={!selectedQuote}
          onClick={handleSign}
          className="h-12 w-full bg-emerald-500 text-base font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          <Check className="size-5" /> Select Best Quote
        </Button>
      )
    }

    // signing
    return (
      <Button
        size="lg"
        disabled
        className="h-12 w-full bg-emerald-500/80 text-base font-semibold text-emerald-950"
      >
        <Loader2 className="size-5 animate-spin" /> Sign Transaction
      </Button>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Swap</h2>
        <span className="font-mono text-xs text-muted-foreground">
          PropAMM · intent
        </span>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <TokenField
          label="Token In"
          amount={amountIn}
          onAmountChange={(v) => {
            setAmountIn(v)
            resetFlow()
          }}
          token={tokenIn}
          onTokenChange={(t) => {
            setTokenIn(t)
            resetFlow()
          }}
        />

        <button
          type="button"
          onClick={flipTokens}
          aria-label="Flip tokens"
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-sky-400"
        >
          <ArrowDown className="size-4" />
        </button>

        <TokenField
          label="Token Out"
          amount={estimatedOut}
          token={tokenOut}
          onTokenChange={(t) => {
            setTokenOut(t)
            resetFlow()
          }}
          readOnly
          placeholder="0.0"
        />
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="memo" className="text-xs text-muted-foreground">
          Memo (optional)
        </Label>
        <Input
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Attach a note to your intent broadcast"
          className="bg-secondary/40 font-mono text-sm"
        />
      </div>

      {/* Quote list */}
      {stage === "selecting" && quotes.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {quotes.length} proposer quotes
            </span>
            <span className="text-xs text-muted-foreground">tap to select</span>
          </div>
          <div className="space-y-1.5">
            {quotes.map((q, i) => (
              <QuoteRow
                key={q.id}
                quote={q}
                best={i === 0}
                selected={q.id === selectedId}
                onSelect={() => setSelectedId(q.id)}
                symbol={tokenOut}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rate summary */}
      {parsedAmount > 0 && tokenIn !== tokenOut && stage !== "selecting" && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          <span>Rate</span>
          <span className="font-mono text-foreground">
            1 {tokenIn} ≈{" "}
            {formatAmount(getToken(tokenIn).price / getToken(tokenOut).price)} {tokenOut}
          </span>
        </div>
      )}

      <div className="mt-auto pt-5">{renderButton()}</div>
    </div>
  )
}
