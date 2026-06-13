"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useConnection, useChainId } from "wagmi"
import {
  type StreamMessage,
  type ConnectionState,
  createQuoteStream,
  buildRfq,
  buildIntent,
  submitIntent,
} from "@/lib/ws-client"
import { getChainConfig, type TokenConfig } from "@/lib/token-registry"
import { WS_ENDPOINT, INTENT_POST_ENDPOINT } from "@/lib/ws-config"

interface QuoteStreamContextValue {
  quotes: StreamMessage[]
  orders: StreamMessage[]
  connectionState: ConnectionState
  sendRfq: (params: {
    tokenIn: TokenConfig
    tokenOut: TokenConfig
    amountIn: string
    amountOut?: string
    recipient?: string
    message?: string
    deadlineMinutes?: number
  }) => Promise<{ ok: boolean; status: number; body?: unknown } | undefined>
  clearQuotes: () => void
}

const QuoteStreamContext = createContext<QuoteStreamContextValue | null>(null)

export function QuoteStreamProvider({ children }: { children: ReactNode }) {
  const { isConnected, address } = useConnection()
  const chainId = useChainId()
  const [quotes, setQuotes] = useState<StreamMessage[]>([])
  const [orders, setOrders] = useState<StreamMessage[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const streamRef = useRef<ReturnType<typeof createQuoteStream> | null>(null)

  useEffect(() => {
    const stream = createQuoteStream({
      url: WS_ENDPOINT,
      onMessage: (msg) => {
        const hasAmountBuy = msg.parsedPayload?.amountBuy && msg.parsedPayload.amountBuy !== "0"
        if (hasAmountBuy) {
          setOrders((prev) => [msg, ...prev].slice(0, 100))
        } else {
          setQuotes((prev) => [msg, ...prev].slice(0, 100))
        }
      },
      onStateChange: setConnectionState,
    })
    streamRef.current = stream

    return () => {
      stream.close()
      streamRef.current = null
    }
  }, [])

  const sendRfq = useCallback(
    async (params: {
      tokenIn: TokenConfig
      tokenOut: TokenConfig
      amountIn: string
      amountOut?: string
      recipient?: string
      message?: string
      deadlineMinutes?: number
    }) => {
      if (!address) return

      const chainConfig = getChainConfig(chainId)
      const rfq = buildRfq({
        dexAddress: chainConfig.dexAddress,
        requester: address,
        assetSellAddress: params.tokenIn.address,
        assetBuyAddress: params.tokenOut.address,
        amountSell: params.amountIn,
        amountBuy: params.amountOut,
        taker: params.recipient,
        chainId,
        message: params.message ?? `Swap ${params.amountIn} ${params.tokenIn.symbol} for ${params.amountOut ?? "?"} ${params.tokenOut.symbol}`,
        deadlineMinutes: params.deadlineMinutes,
      })
      const intent = buildIntent(rfq, address)
      return submitIntent(intent, INTENT_POST_ENDPOINT)
    },
    [address, chainId],
  )

  const clearQuotes = useCallback(() => {
    setQuotes([])
  }, [])

  return (
    <QuoteStreamContext.Provider value={{ quotes, orders, connectionState, sendRfq, clearQuotes }}>
      {children}
    </QuoteStreamContext.Provider>
  )
}

export function useQuoteStream(): QuoteStreamContextValue {
  const ctx = useContext(QuoteStreamContext)
  if (!ctx) throw new Error("useQuoteStream must be used within QuoteStreamProvider")
  return ctx
}
