"use client"

import { useMemo } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { createPublicClient, custom, type PublicClient } from "viem"

/**
 * Returns a viem PublicClient for read / eth_call operations.
 *
 * When a wallet is connected we route reads through the WALLET'S OWN RPC
 * (the provider injected by MetaMask / Coinbase / WalletConnect, i.e.
 * `walletClient.transport`) instead of any hardcoded RPC URL. This keeps the
 * app on whatever network/endpoint the user's wallet is actually pointed at.
 *
 * Falls back to wagmi's configured public client only when no wallet is
 * connected (e.g. initial render before the user connects).
 */
export function useReadClient(): PublicClient | undefined {
  const fallbackClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  return useMemo(() => {
    if (walletClient) {
      // Derive a public client from the connected wallet's transport so all
      // eth_call / readContract traffic uses the wallet's RPC connection.
      return createPublicClient({
        chain: walletClient.chain,
        transport: custom(walletClient.transport),
      })
    }
    return fallbackClient
  }, [walletClient, fallbackClient])
}
