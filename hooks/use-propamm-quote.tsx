"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePublicClient } from "wagmi"
import { parseUnits } from "viem"
import { PROPAMM_ROUTER_ABI, PROPAMM_ROUTER_ADDRESS } from "@/lib/propamm-router-abi"
import {
  PROPAMM_VENUE_ADDRESSES,
  resolveVenue,
  type VenueInfo,
} from "@/lib/venues"
import type { TokenConfig } from "@/lib/token-registry"

export type VenueQuote = {
  venue: VenueInfo
  /** Raw quoted amountOut in tokenOut base units. null = venue reverted/failed. */
  amountOut: bigint | null
  /** True when this venue produced the best quoteV1 result. */
  isBest: boolean
}

export type QuoteResult = {
  /** Best amountOut across all venues (from quoteV1). */
  bestAmountOut: bigint
  /** The venue that produced the best quote. */
  bestVenue: VenueInfo
  /** Per-venue breakdown for transparency (from quoteVenueV1). */
  venueQuotes: VenueQuote[]
  /** True when the best route is the Uniswap V3 public fallback. */
  usedFallback: boolean
}

export type QuoteStatus = "idle" | "loading" | "success" | "error"

type UseQuoteArgs = {
  tokenIn?: TokenConfig
  tokenOut?: TokenConfig
  /** Human-readable input amount, e.g. "1.5". */
  amountIn: string
  /** Debounce + auto-refresh interval (ms). */
  refreshMs?: number
}

/**
 * Fetches PropAMMRouter quotes.
 *
 * NOTE: quoteV1 / quoteVenueV1 are NOT `view` functions on this contract, so we
 * cannot use a plain `readContract`. We simulate them through `eth_call` via
 * viem's `simulateContract`, which returns the function's return values without
 * sending a transaction.
 */
export function usePropammQuote({
  tokenIn,
  tokenOut,
  amountIn,
  refreshMs = 12_000,
}: UseQuoteArgs) {
  const publicClient = usePublicClient()
  const [status, setStatus] = useState<QuoteStatus>("idle")
  const [quote, setQuote] = useState<QuoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  const canQuote =
    !!publicClient &&
    !!tokenIn &&
    !!tokenOut &&
    tokenIn.address.toLowerCase() !== tokenOut.address.toLowerCase() &&
    !!amountIn &&
    Number(amountIn) > 0

  const fetchQuote = useCallback(async () => {
    if (!canQuote || !publicClient || !tokenIn || !tokenOut) return
    const id = ++reqId.current
    setStatus("loading")
    setError(null)

    let amount: bigint
    try {
      amount = parseUnits(amountIn, tokenIn.decimals)
    } catch {
      setStatus("error")
      setError("Invalid amount")
      return
    }

    const baseArgs = {
      address: PROPAMM_ROUTER_ADDRESS as `0x${string}`,
      abi: PROPAMM_ROUTER_ABI,
    } as const

    try {
      // Best quote across all venues (the router's own selection).
      const bestPromise = publicClient.simulateContract({
        ...baseArgs,
        functionName: "quoteV1",
        args: [
          tokenIn.address as `0x${string}`,
          tokenOut.address as `0x${string}`,
          amount,
        ],
      })

      // Per-venue quotes for the transparency breakdown. Each may revert if the
      // venue can't price the pair — we catch and mark it as unavailable.
      const venuePromises = PROPAMM_VENUE_ADDRESSES.map((venueAddr) =>
        publicClient
          .simulateContract({
            ...baseArgs,
            functionName: "quoteVenueV1",
            args: [
              venueAddr,
              tokenIn.address as `0x${string}`,
              tokenOut.address as `0x${string}`,
              amount,
            ],
          })
          .then((res) => {
            const [amountOut, quotedVenue] = res.result as [bigint, string]
            return { venueAddr, amountOut, quotedVenue }
          })
          .catch(() => ({ venueAddr, amountOut: null, quotedVenue: null })),
      )

      const [bestRes, venueResults] = await Promise.all([
        bestPromise,
        Promise.all(venuePromises),
      ])

      // A newer request superseded this one.
      if (id !== reqId.current) return

      const [bestAmountOut, bestVenueAddr] = bestRes.result as [bigint, string]
      const bestVenue = resolveVenue(bestVenueAddr)

      const venueQuotes: VenueQuote[] = venueResults.map((r) => {
        const venue = resolveVenue(r.venueAddr)
        return {
          venue,
          amountOut: r.amountOut,
          isBest: venue.key === bestVenue.key,
        }
      })

      // If the fallback won, surface it as its own row so the user sees it.
      if (bestVenue.kind === "fallback") {
        venueQuotes.push({
          venue: bestVenue,
          amountOut: bestAmountOut,
          isBest: true,
        })
      }

      setQuote({
        bestAmountOut,
        bestVenue,
        venueQuotes,
        usedFallback: bestVenue.kind === "fallback",
      })
      setStatus("success")
    } catch (err) {
      if (id !== reqId.current) return
      console.log("[v0] quote error:", err)
      setStatus("error")
      setError(
        err instanceof Error
          ? humanizeQuoteError(err.message)
          : "Unable to fetch quote",
      )
      setQuote(null)
    }
  }, [canQuote, publicClient, tokenIn, tokenOut, amountIn])

  // Debounced fetch on input change + periodic refresh.
  useEffect(() => {
    if (!canQuote) {
      setStatus("idle")
      setQuote(null)
      setError(null)
      return
    }
    const debounce = setTimeout(fetchQuote, 400)
    const interval = setInterval(fetchQuote, refreshMs)
    return () => {
      clearTimeout(debounce)
      clearInterval(interval)
    }
  }, [canQuote, fetchQuote, refreshMs])

  return { status, quote, error, refetch: fetchQuote }
}

function humanizeQuoteError(message: string): string {
  if (/insufficient liquidity|no.*liquidity/i.test(message))
    return "No liquidity available for this pair"
  if (/UnknownVenue/i.test(message)) return "Venue not available"
  return "No route found for this pair"
}
