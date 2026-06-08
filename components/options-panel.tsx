"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, Check, Loader2, TrendingDown, TrendingUp, Zap } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  TOKENS,
  getToken,
  type OptionQuote,
  type OptionSide,
  type TokenSymbol,
} from "@/lib/propamm-types"
import { generateOptionQuotes, formatUsd } from "@/lib/quotes"

type OptionStage = "idle" | "requesting" | "selecting" | "signing" | "done"

// underlyings we allow writing options on (exclude stablecoins)
const UNDERLYINGS = TOKENS.filter((t) => !["USDC", "DAI"].includes(t.symbol))

function defaultExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(8, 0, 0, 0)
  return d
}

function OptionQuoteRow({
  quote,
  best,
  selected,
  onSelect,
}: {
  quote: OptionQuote
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
          IV {quote.ivPct.toFixed(1)}% · fee {quote.feeBps}bps · {quote.latencyMs}ms
        </span>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums text-foreground">
          {formatUsd(quote.premium)}
        </div>
        <div className="text-xs text-muted-foreground">premium</div>
      </div>
    </button>
  )
}

export function OptionsPanel() {
  const [underlying, setUnderlying] = useState<TokenSymbol>("ETH")
  const [side, setSide] = useState<OptionSide>("call")
  const [expiry, setExpiry] = useState<Date>(defaultExpiry)
  const [strike, setStrike] = useState("3200")
  const [contracts, setContracts] = useState("1")
  const [memo, setMemo] = useState("")

  const [stage, setStage] = useState<OptionStage>("idle")
  const [quotes, setQuotes] = useState<OptionQuote[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const spot = getToken(underlying).price
  const parsedStrike = Number.parseFloat(strike) || 0
  const parsedContracts = Number.parseFloat(contracts) || 0
  const selectedQuote = quotes.find((q) => q.id === selectedId) ?? null

  const resetFlow = () => {
    setStage("idle")
    setQuotes([])
    setSelectedId(null)
  }

  const daysToExpiry = useMemo(
    () => Math.max(Math.round((expiry.getTime() - Date.now()) / 86_400_000), 0),
    [expiry],
  )

  const handleRequestQuotes = () => {
    setStage("requesting")
    setQuotes([])
    setSelectedId(null)
    setTimeout(() => {
      const q = generateOptionQuotes(
        side,
        getToken(underlying),
        parsedStrike,
        expiry.getTime(),
        parsedContracts,
      )
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

  const invalid = parsedStrike <= 0 || parsedContracts <= 0 || daysToExpiry <= 0

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
              <Check className="size-5" /> Position Opened
            </>
          ) : invalid ? (
            "Set strike, size & expiry"
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
        <h2 className="text-sm font-medium text-foreground">Options</h2>
        <span className="font-mono text-xs text-muted-foreground">
          PropAMM · intent
        </span>
      </div>

      {/* Call / Put toggle */}
      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-secondary/40 p-1">
        <button
          type="button"
          onClick={() => {
            setSide("call")
            resetFlow()
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
            side === "call"
              ? "bg-emerald-500/15 text-emerald-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <TrendingUp className="size-4" /> Call
        </button>
        <button
          type="button"
          onClick={() => {
            setSide("put")
            resetFlow()
          }}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
            side === "put"
              ? "bg-rose-500/15 text-rose-400"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <TrendingDown className="size-4" /> Put
        </button>
      </div>

      {/* Underlying + size */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Underlying
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            spot {formatUsd(spot)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Input
            inputMode="decimal"
            value={contracts}
            placeholder="1"
            onChange={(e) => {
              const v = e.target.value
              if (v === "" || /^\d*\.?\d*$/.test(v)) {
                setContracts(v)
                resetFlow()
              }
            }}
            className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
          />
          <Select
            value={underlying}
            onValueChange={(v) => {
              setUnderlying(v as TokenSymbol)
              resetFlow()
            }}
          >
            <SelectTrigger className="w-[120px] shrink-0 bg-card font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNDERLYINGS.map((t) => (
                <SelectItem key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">contracts</div>
      </div>

      {/* Strike (settlement price) + Expiry */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <Label htmlFor="strike" className="text-xs uppercase tracking-wider text-muted-foreground">
            Strike price
          </Label>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              id="strike"
              inputMode="decimal"
              value={strike}
              placeholder="0.0"
              onChange={(e) => {
                const v = e.target.value
                if (v === "" || /^\d*\.?\d*$/.test(v)) {
                  setStrike(v)
                  resetFlow()
                }
              }}
              className="h-auto border-0 bg-transparent p-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Expiry
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                className="mt-2 flex w-full cursor-pointer items-center gap-1.5 text-left text-base font-semibold text-foreground"
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {format(expiry, "dd MMM yyyy")}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={expiry}
                disabled={{ before: new Date() }}
                onSelect={(d) => {
                  if (d) {
                    const next = new Date(d)
                    next.setHours(8, 0, 0, 0)
                    setExpiry(next)
                    resetFlow()
                  }
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          <div className="mt-1 text-xs text-muted-foreground">
            {daysToExpiry}d to expiry
          </div>
        </div>
      </div>

      {/* Memo */}
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="opt-memo" className="text-xs text-muted-foreground">
          Memo (optional)
        </Label>
        <Input
          id="opt-memo"
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
              <OptionQuoteRow
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

      {/* Contract summary */}
      {!invalid && stage !== "selecting" && (
        <div className="mt-4 space-y-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Contract</span>
            <span className="font-mono text-foreground">
              {underlying} {parsedStrike ? formatUsd(parsedStrike) : "—"}{" "}
              {side === "call" ? "Call" : "Put"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Expires</span>
            <span className="font-mono text-foreground">
              {format(expiry, "dd MMM yyyy")}
            </span>
          </div>
        </div>
      )}

      <div className="mt-auto pt-5">{renderButton()}</div>
    </div>
  )
}
