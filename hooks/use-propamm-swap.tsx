"use client"

import { useCallback, useState } from "react"
import {
  useAccount,
  usePublicClient,
  useWalletClient,
} from "wagmi"
import { parseUnits, decodeEventLog, type Hash } from "viem"
import {
  PROPAMM_ROUTER_ABI,
  PROPAMM_ROUTER_ADDRESS,
  ERC20_ABI,
} from "@/lib/propamm-router-abi"
import { resolveVenue, type VenueInfo } from "@/lib/venues"
import { ETH_ADDRESS, type TokenConfig } from "@/lib/token-registry"

export type SwapStage =
  | "idle"
  | "checking" // reading allowance
  | "approving" // waiting for approve tx
  | "simulating" // eth_call simulate before send
  | "pending" // swap tx in mempool
  | "success"
  | "error"

export type SwapResult = {
  hash: Hash
  amountOut: bigint
  /** The venue that actually filled on-chain (from the Swapped event). */
  executedVenue: VenueInfo
  /** True when the public Uniswap V3 fallback ran instead of a propAMM. */
  usedFallback: boolean
}

type SwapArgs = {
  tokenIn: TokenConfig
  tokenOut: TokenConfig
  /** Human-readable input amount. */
  amountIn: string
  /** Best quoted output (base units) used to compute amountOutMin. */
  quotedOut: bigint
  /** Slippage tolerance in basis points (e.g. 50 = 0.5%). */
  slippageBps: number
  /** The venue we expect to fill, for the "expected vs actual" UI comparison. */
  expectedVenue: VenueInfo
}

const DEADLINE_SECONDS = 600 // 10 minutes

export function usePropammSwap() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [stage, setStage] = useState<SwapStage>("idle")
  const [result, setResult] = useState<SwapResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expectedVenue, setExpectedVenue] = useState<VenueInfo | null>(null)

  const reset = useCallback(() => {
    setStage("idle")
    setResult(null)
    setError(null)
    setExpectedVenue(null)
  }, [])

  const swap = useCallback(
    async (args: SwapArgs) => {
      if (!publicClient || !walletClient || !address) {
        setError("Connect your wallet first")
        setStage("error")
        return
      }

      const {
        tokenIn,
        tokenOut,
        amountIn,
        quotedOut,
        slippageBps,
        expectedVenue: expected,
      } = args

      setError(null)
      setResult(null)
      setExpectedVenue(expected)

      let amount: bigint
      try {
        amount = parseUnits(amountIn, tokenIn.decimals)
      } catch {
        setError("Invalid amount")
        setStage("error")
        return
      }

      // amountOutMin from quoted output minus slippage tolerance.
      const amountOutMin =
        (quotedOut * BigInt(10_000 - slippageBps)) / 10_000n
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEADLINE_SECONDS,
      )
      const isNativeIn = tokenIn.address.toLowerCase() === ETH_ADDRESS

      try {
        // 1. ERC-20 allowance check + approve (skip for native ETH).
        if (!isNativeIn) {
          setStage("checking")
          const allowance = (await publicClient.readContract({
            address: tokenIn.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, PROPAMM_ROUTER_ADDRESS as `0x${string}`],
          })) as bigint

          if (allowance < amount) {
            setStage("approving")
            const approveHash = await walletClient.writeContract({
              address: tokenIn.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [PROPAMM_ROUTER_ADDRESS as `0x${string}`, amount],
            })
            await publicClient.waitForTransactionReceipt({ hash: approveHash })
          }
        }

        // 2. Simulate swapV1 via eth_call to catch reverts before spending gas.
        setStage("simulating")
        const { request } = await publicClient.simulateContract({
          account: address,
          address: PROPAMM_ROUTER_ADDRESS as `0x${string}`,
          abi: PROPAMM_ROUTER_ABI,
          functionName: "swapV1",
          args: [
            tokenIn.address as `0x${string}`,
            tokenOut.address as `0x${string}`,
            amount,
            amountOutMin,
            address,
            deadline,
          ],
          value: isNativeIn ? amount : 0n,
        })

        // 3. Send the swap transaction.
        setStage("pending")
        const hash = await walletClient.writeContract(request)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        // 4. Parse the Swapped event for the venue that actually filled.
        let executedVenueAddr: string | null = null
        let amountOut = 0n
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: PROPAMM_ROUTER_ABI,
              data: log.data,
              topics: log.topics,
            })
            if (decoded.eventName === "Swapped") {
              const a = decoded.args as unknown as {
                amountOut: bigint
                marketMaker: string
              }
              amountOut = a.amountOut
              executedVenueAddr = a.marketMaker
              break
            }
          } catch {
            // Not our event; ignore.
          }
        }

        const executedVenue = resolveVenue(executedVenueAddr)
        setResult({
          hash,
          amountOut,
          executedVenue,
          usedFallback: executedVenue.kind === "fallback",
        })
        setStage("success")
      } catch (err) {
        console.log("[v0] swap error:", err)
        setError(
          err instanceof Error ? humanizeSwapError(err.message) : "Swap failed",
        )
        setStage("error")
      }
    },
    [publicClient, walletClient, address],
  )

  return { stage, result, error, expectedVenue, swap, reset }
}

function humanizeSwapError(message: string): string {
  if (/User rejected|rejected the request|denied/i.test(message))
    return "Transaction rejected in wallet"
  if (/insufficient funds/i.test(message))
    return "Insufficient balance for this swap"
  if (/amountOutMin|slippage|INSUFFICIENT_OUTPUT/i.test(message))
    return "Price moved beyond slippage — try again or raise tolerance"
  if (/deadline/i.test(message)) return "Transaction deadline expired"
  return "Swap failed — please try again"
}
