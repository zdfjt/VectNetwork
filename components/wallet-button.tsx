"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useBalance } from "wagmi"
import { formatUnits } from "viem"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

export function WalletButton() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return (
      <div className="inline-flex h-9 w-32 animate-pulse items-center rounded-xl border border-border bg-card px-4" />
    )
  }

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted: rkMounted,
      }) => {
        const ready = rkMounted && !!(account && chain)
        const { data: balance } = useBalance({ address: account?.address as `0x${string}` | undefined })

        const displayBalance = balance
          ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`
          : undefined

        return (
          <div
            {...(!rkMounted && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {!ready ? (
              <button
                onClick={openConnectModal}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Connect Wallet
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
              >
                Wrong Network
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={openChainModal}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary",
                    chain.unsupported && "border-red-500/30 text-red-400",
                  )}
                >
                  {chain.iconUrl && (
                    <img
                      alt={chain.name ?? "Chain"}
                      src={chain.iconUrl}
                      className="size-4 rounded-full"
                    />
                  )}
                  {chain.name ?? chain.id}
                </button>
                <button
                  onClick={openAccountModal}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {displayBalance && (
                    <span className="text-muted-foreground">{displayBalance}</span>
                  )}
                  {account.displayName}
                </button>
              </div>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
