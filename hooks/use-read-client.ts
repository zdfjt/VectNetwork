"use client"

import { useMemo } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { createPublicClient, custom, http, type PublicClient } from "viem"
import { useCustomRpcUrl } from "@/lib/rpc-store"

/**
 * Returns a viem PublicClient for read / eth_call operations.
 *
 * Priority order:
 *  1. A user-supplied custom RPC URL (Node Configuration in Settings), if set.
 *     Power users can point the app at their own node.
 *  2. The CONNECTED WALLET'S OWN RPC (the provider injected by MetaMask /
 *     Coinbase / WalletConnect, i.e. `walletClient.transport`).
 *  3. wagmi's configured public client (before a wallet is connected).
 *
 * This keeps the app on whatever endpoint the user prefers while never
 * relying on a hardcoded RPC URL in source.
 */
export function useReadClient(): PublicClient | undefined {
  const fallbackClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const customRpcUrl = useCustomRpcUrl()

  return useMemo(() => {
    // 1. Custom RPC URL takes precedence when provided.
    if (customRpcUrl) {
      return createPublicClient({
        chain: walletClient?.chain ?? fallbackClient?.chain,
        transport: http(customRpcUrl),
      })
    }
    // 2. Derive a public client from the connected wallet's transport.
    if (walletClient) {
      return createPublicClient({
        chain: walletClient.chain,
        transport: custom(walletClient.transport),
      })
    }
    // 3. Fall back to wagmi's configured client.
    return fallbackClient
  }, [customRpcUrl, walletClient, fallbackClient])
}
