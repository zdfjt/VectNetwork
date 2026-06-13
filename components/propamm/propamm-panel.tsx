"use client"

import { useMemo, useState } from "react"
import { useAccount, useChainId } from "wagmi"
import { formatUnits } from "viem"
import { ArrowDown, Settings2, Zap } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getTokensByChain, type TokenConfig } from "@/lib/token-registry"
import { usePropammQuote } from "@/hooks/use-propamm-quote"
import { usePropammSwap } from "@/hooks/use-propamm-swap"
import { WalletButton } from "@/components/wallet-button"
import { TokenInput } from "@/components/propamm/token-input"
import { RouteInfo } from "@/components/propamm/route-info"
import { TransactionStatus } from "@/components/propamm/transaction-status"
import { PROPAMM_ROUTER_ADDRESS } from "@/lib/propamm-router-abi"

const SLIPPAGE_PRESETS = [10, 50, 100] // bps: 0.1%, 0.5%, 1%

export function PropammPanel() {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const tokens = useMemo(() => getTokensByChain(chainId), [chainId])

  const [tokenIn, setTokenIn] = useState<TokenConfig>(tokens[0])
  const [tokenOut, setTokenOut] = useState<TokenConfig>(tokens[2] ?? tokens[1])
  const [amountIn, setAmountIn] = useState("")
  const [slippageBps, setSlippageBps] = useState(50)

  const { status, quote, error } = usePropammQuote({
    tokenIn,
    tokenOut,
    amountIn,
  })

  const {
    stage,
    result,
    error: swapError,
    expectedVenue,
    swap,
    reset,
  } = usePropammSwap()

  const amountOut =
    quote && tokenOut
      ? Number(formatUnits(quote.bestAmountOut, tokenOut.decimals)).toLocaleString(
          undefined,
          { maximumFractionDigits: 6 },
        )
      : ""

  function flip() {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn("")
  }

  function handleSwap() {
    if (!quote) return
    swap({
      tokenIn,
      tokenOut,
      amountIn,
      quotedOut: quote.bestAmountOut,
      slippageBps,
      expectedVenue: quote.bestVenue,
    })
  }

  const minReceived =
    quote && tokenOut
      ? Number(
          formatUnits(
            (quote.bestAmountOut * BigInt(10_000 - slippageBps)) / 10_000n,
            tokenOut.decimals,
          ),
        ).toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "—"

  const canSwap =
    isConnected && status === "success" && !!quote && Number(amountIn) > 0

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-foreground">
            PropAMM Aggregator
          </h2>
        </div>
        <Popover>
          <PopoverTrigger
            className="rounded-lg border border-border bg-secondary/60 p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Slippage settings"
          >
            <Settings2 className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="mb-2 text-xs font-medium text-foreground">
              Slippage tolerance
            </div>
            <div className="flex gap-1.5">
              {SLIPPAGE_PRESETS.map((bps) => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => setSlippageBps(bps)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors",
                    slippageBps === bps
                      ? "border-sky-500/40 bg-sky-500/15 text-sky-400"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {bps / 100}%
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Token inputs */}
      <div className="flex flex-col gap-1">
        <TokenInput
          label="You pay"
          amount={amountIn}
          onAmountChange={setAmountIn}
          token={tokenIn}
          tokens={tokens}
          onTokenChange={setTokenIn}
          disabledToken={tokenOut.symbol}
        />

        <div className="relative z-10 -my-3 flex justify-center">
          <button
            type="button"
            onClick={flip}
            className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-sky-400"
            aria-label="Flip tokens"
          >
            <ArrowDown className="size-4" />
          </button>
        </div>

        <TokenInput
          label="You receive"
          amount={amountOut}
          token={tokenOut}
          tokens={tokens}
          onTokenChange={setTokenOut}
          readOnly
          loading={status === "loading"}
          disabledToken={tokenIn.symbol}
        />
      </div>

      {/* Route info / venue transparency */}
      <div className="mt-3">
        <RouteInfo
          status={status}
          quote={quote}
          error={error}
          tokenOut={tokenOut}
        />
      </div>

      {/* Quote details */}
      {quote && status === "success" && (
        <div className="mt-3 flex flex-col gap-1.5 px-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Min. received ({slippageBps / 100}% slippage)</span>
            <span className="font-mono text-foreground">
              {minReceived} {tokenOut.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Router</span>
            <span className="font-mono">
              {PROPAMM_ROUTER_ADDRESS.slice(0, 6)}…
              {PROPAMM_ROUTER_ADDRESS.slice(-4)}
            </span>
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="mt-4">
        {!isConnected ? (
          <div className="flex w-full justify-center">
            <WalletButton />
          </div>
        ) : (
          <button
            type="button"
            disabled={!canSwap}
            onClick={handleSwap}
            className={cn(
              "w-full rounded-xl py-3 text-sm font-semibold transition-colors",
              canSwap
                ? "bg-sky-500 text-sky-950 hover:bg-sky-400"
                : "cursor-not-allowed bg-secondary text-muted-foreground",
            )}
          >
            {!amountIn || Number(amountIn) === 0
              ? "Enter an amount"
              : status === "loading"
                ? "Fetching quote…"
                : status === "error"
                  ? "No route available"
                  : "Swap"}
          </button>
        )}
      </div>

      {/* Transaction lifecycle modal */}
      <TransactionStatus
        stage={stage}
        result={result}
        error={swapError}
        expectedVenue={expectedVenue}
        tokenOut={tokenOut}
        onClose={() => {
          reset()
          if (stage === "success") setAmountIn("")
        }}
      />
    </div>
  )
}
