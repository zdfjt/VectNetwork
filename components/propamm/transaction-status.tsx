"use client"

import { formatUnits } from "viem"
import { CheckCircle2, Loader2, XCircle, ShieldCheck, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { VenueBadge } from "@/components/propamm/venue-badge"
import type { SwapStage, SwapResult } from "@/hooks/use-propamm-swap"
import type { VenueInfo } from "@/lib/venues"
import type { TokenConfig } from "@/lib/token-registry"

const STAGE_LABELS: Record<Exclude<SwapStage, "idle">, string> = {
  checking: "Checking token allowance…",
  approving: "Approve the router in your wallet…",
  simulating: "Simulating the swap…",
  pending: "Swap submitted — waiting for confirmation…",
  success: "Swap complete",
  error: "Swap failed",
}

export function TransactionStatus({
  stage,
  result,
  error,
  expectedVenue,
  tokenOut,
  onClose,
}: {
  stage: SwapStage
  result: SwapResult | null
  error: string | null
  expectedVenue: VenueInfo | null
  tokenOut?: TokenConfig
  onClose: () => void
}) {
  if (stage === "idle") return null

  const isWorking =
    stage === "checking" ||
    stage === "approving" ||
    stage === "simulating" ||
    stage === "pending"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          {isWorking && (
            <Loader2 className="size-12 animate-spin text-sky-400" />
          )}
          {stage === "success" && (
            <CheckCircle2 className="size-12 text-emerald-400" />
          )}
          {stage === "error" && <XCircle className="size-12 text-destructive" />}
        </div>

        {/* Title */}
        <h3 className="text-center text-base font-semibold text-foreground">
          {STAGE_LABELS[stage]}
        </h3>

        {/* Working: stepper */}
        {isWorking && (
          <div className="mt-4 flex flex-col gap-2">
            <Step active={stage === "checking"} done={stage !== "checking"} label="Allowance" />
            <Step
              active={stage === "approving"}
              done={["simulating", "pending"].includes(stage)}
              label="Approval"
            />
            <Step
              active={stage === "simulating"}
              done={stage === "pending"}
              label="Simulation"
            />
            <Step active={stage === "pending"} done={false} label="Confirmation" />
            {expectedVenue && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Expected venue: <VenueBadge venue={expectedVenue} />
              </p>
            )}
          </div>
        )}

        {/* Success: show actual executed venue + fallback awareness */}
        {stage === "success" && result && tokenOut && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Received
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-foreground">
                {Number(
                  formatUnits(result.amountOut, tokenOut.decimals),
                ).toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                {tokenOut.symbol}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">Filled by</span>
              <VenueBadge venue={result.executedVenue} size="md" />
            </div>

            {/* Auto-fallback transparency */}
            {result.usedFallback &&
              expectedVenue &&
              expectedVenue.kind !== "fallback" && (
                <div className="flex items-start gap-2 rounded-lg border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-xs text-pink-300">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {expectedVenue.name} couldn&apos;t fill at execution, so the
                    router safely routed through Uniswap V3 instead. You still
                    got a valid fill within your slippage limit.
                  </span>
                </div>
              )}

            <a
              href={`#tx-${result.hash}`}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              View transaction
              <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {error ?? "Something went wrong."}
          </p>
        )}

        {/* Close button (only when finished) */}
        {!isWorking && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "mt-5 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors",
              stage === "success"
                ? "bg-sky-500 text-sky-950 hover:bg-sky-400"
                : "border border-border text-foreground hover:bg-secondary",
            )}
          >
            {stage === "success" ? "Done" : "Close"}
          </button>
        )}
      </div>
    </div>
  )
}

function Step({
  active,
  done,
  label,
}: {
  active: boolean
  done: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full border text-[10px]",
          done
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
            : active
              ? "border-sky-500/40 bg-sky-500/15 text-sky-400"
              : "border-border text-muted-foreground",
        )}
      >
        {done ? <CheckCircle2 className="size-3" /> : active ? <Loader2 className="size-3 animate-spin" /> : ""}
      </span>
      <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  )
}
