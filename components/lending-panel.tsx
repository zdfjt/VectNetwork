"use client"

import { useMemo, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Check, Loader2, Zap } from "lucide-react"
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
import { getToken, type TokenSymbol } from "@/lib/propamm-types"
import { formatUsd, formatAmount } from "@/lib/quotes"
import {
  generateLendingQuotes,
  accruedInterest,
  LOAN_MARKET_ASSETS,
  LOAN_COLLATERAL_ASSETS,
  LOAN_TERMS,
  type LendingQuote,
  type LoanDirection,
} from "@/lib/lending"

type Stage = "idle" | "requesting" | "selecting" | "signing" | "done"

function QuoteRow({
  quote,
  best,
  selected,
  onSelect,
}: {
  quote: LendingQuote
  best: boolean
  selected: boolean
  onSelect: () => void
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
          <span className="font-mono text-xs text-muted-foreground">{quote.proposer}</span>
          {best && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-400">
              best
            </span>
          )}
        </div>
        <span className="mt-0.5 text-xs text-muted-foreground">
          fee {quote.feeBps}bps · {quote.latencyMs}ms
        </span>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums text-foreground">
          {quote.aprPct.toFixed(2)}%
        </div>
        <div className="text-xs text-muted-foreground">APR</div>
      </div>
    </button>
  )
}

export function LendingPanel() {
  const [direction, setDirection] = useState<LoanDirection>("lend")
  const [asset, setAsset] = useState<TokenSymbol>("USDC")
  const [collateral, setCollateral] = useState<TokenSymbol>("ETH")
  const [amount, setAmount] = useState("5000")
  const [termDays, setTermDays] = useState(30)
  const [ltv, setLtv] = useState("60")
  const [memo, setMemo] = useState("")

  const [stage, setStage] = useState<Stage>("idle")
  const [quotes, setQuotes] = useState<LendingQuote[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const parsedAmount = Number.parseFloat(amount) || 0
  const parsedLtv = Number.parseFloat(ltv) || 0
  const principalUsd = parsedAmount * getToken(asset).price
  const selectedQuote = quotes.find((q) => q.id === selectedId) ?? null

  const interest = useMemo(() => {
    const apr = selectedQuote?.aprPct ?? 0
    return accruedInterest(principalUsd, apr, termDays)
  }, [selectedQuote, principalUsd, termDays])

  const resetFlow = () => {
    setStage("idle")
    setQuotes([])
    setSelectedId(null)
  }

  const handleRequestQuotes = () => {
    setStage("requesting")
    setQuotes([])
    setSelectedId(null)
    setTimeout(() => {
      const q = generateLendingQuotes(direction, termDays, parsedLtv)
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

  const invalid = parsedAmount <= 0 || parsedLtv <= 0 || parsedLtv > 90

  const renderButton = () => {
    if (stage === "idle" || stage === "done") {
      return (
        <Button
          size="lg"
          disabled={invalid}
          onClick={handleRequestQuotes}
          className="h-12 w-full bg-sky-500 text-base font-semibold text-sky-950 hover:bg-sky-400"
        >
          {stage === "done" ? (
            <>
              <Check className="size-5" /> {direction === "lend" ? "Loan Funded" : "Loan Opened"}
            </>
          ) : invalid ? (
            "Set amount, term & LTV"
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
        <Button size="lg" disabled className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950">
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
    return (
      <Button size="lg" disabled className="h-12 w-full bg-emerald-500/80 text-base font-semibold text-emerald-950">
        <Loader2 className="size-5 animate-spin" /> Sign Transaction
      </Button>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Lending</h2>
        <span className="font-mono text-xs text-muted-foreground">PropAMM · intent</span>
      </div>

      {/* Lend / Borrow toggle */}
      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-secondary/40 p-1">
        <button
          type="button"
          onClick={() => {
            setDirection("lend")
            resetFlow()
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
            direction === "lend"
              ? "bg-emerald-500/15 text-emerald-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowUpFromLine className="size-4" /> Lend
        </button>
        <button
          type="button"
          onClick={() => {
            setDirection("borrow")
            resetFlow()
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
            direction === "borrow"
              ? "bg-sky-500/15 text-sky-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowDownToLine className="size-4" /> Borrow
        </button>
      </div>

      {/* Amount + asset */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {direction === "lend" ? "Amount to lend" : "Amount to borrow"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            ≈ {formatUsd(principalUsd)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Input
            inputMode="decimal"
            value={amount}
            placeholder="0.0"
            onChange={(e) => {
              const v = e.target.value
              if (v === "" || /^\d*\.?\d*$/.test(v)) {
                setAmount(v)
                resetFlow()
              }
            }}
            className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          />
          <Select
            value={asset}
            onValueChange={(v) => {
              setAsset(v as TokenSymbol)
              resetFlow()
            }}
          >
            <SelectTrigger className="w-[120px] shrink-0 bg-card font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAN_MARKET_ASSETS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Collateral + LTV */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Collateral</span>
          <Select
            value={collateral}
            onValueChange={(v) => {
              setCollateral(v as TokenSymbol)
              resetFlow()
            }}
          >
            <SelectTrigger className="mt-2 w-full bg-card font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAN_COLLATERAL_ASSETS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <Label htmlFor="ltv" className="text-xs uppercase tracking-wider text-muted-foreground">
            Max LTV
          </Label>
          <div className="mt-2 flex items-baseline gap-1">
            <Input
              id="ltv"
              inputMode="decimal"
              value={ltv}
              placeholder="60"
              onChange={(e) => {
                const v = e.target.value
                if (v === "" || /^\d*\.?\d*$/.test(v)) {
                  setLtv(v)
                  resetFlow()
                }
              }}
              className="h-auto border-0 bg-transparent p-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      {/* Term */}
      <div className="mt-1.5 rounded-xl border border-border bg-secondary/40 p-3">
        <span className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
          Term
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {LOAN_TERMS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTermDays(t)
                resetFlow()
              }}
              className={cn(
                "rounded-lg py-1.5 text-xs font-medium transition-colors",
                termDays === t
                  ? "bg-sky-500/15 text-sky-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}d
            </button>
          ))}
        </div>
      </div>

      {/* Memo */}
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="lend-memo" className="text-xs text-muted-foreground">
          Memo (optional)
        </Label>
        <Input
          id="lend-memo"
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
              />
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {!invalid && stage !== "selecting" && (
        <div className="mt-4 space-y-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Position</span>
            <span className="font-mono text-foreground">
              {direction === "lend" ? "Supply" : "Borrow"} {formatAmount(parsedAmount)} {asset}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Collateral · term</span>
            <span className="font-mono text-foreground">
              {collateral} · {termDays}d @ {parsedLtv}% LTV
            </span>
          </div>
          {selectedQuote && (
            <div className="flex items-center justify-between">
              <span>Est. interest @ {selectedQuote.aprPct.toFixed(2)}%</span>
              <span className="font-mono text-foreground">{formatUsd(interest)}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto pt-5">{renderButton()}</div>
    </div>
  )
}
