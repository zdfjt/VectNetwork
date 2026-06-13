"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import { useChainId, useWriteContract, useAccount } from "wagmi"
import { parseEther, parseUnits } from "viem"
import { readContract } from "@wagmi/core"
import { config } from "@/lib/web3-config"
import { ArrowDown, Check, Loader2, Zap, Link2, X, ChevronDown, ChevronUp, ArrowRightLeft, AlertTriangle, Settings2 } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger, PopoverHeader, PopoverTitle } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getTokensByChain, getChainConfig, ETH_ADDRESS, type TokenConfig } from "@/lib/token-registry"
import { useQuoteStream } from "@/hooks/use-quote-stream"
import type { StreamMessage } from "@/lib/ws-client"

const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
const WETH_ABI = [
  {
    name: "deposit",
    type: "function" as const,
    stateMutability: "payable" as const,
    inputs: [],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [{ name: "wad", type: "uint256" as const }],
    outputs: [],
  },
]

const DEX_ABI = [
  {
    name: "verifyRFQ",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [
      { name: "user", type: "address" as const },
      { name: "assetSell", type: "address" as const },
      { name: "amountSell", type: "uint256" as const },
    ],
    outputs: [
      { name: "sufficient", type: "bool" as const },
      { name: "reason", type: "string" as const },
    ],
  },
]

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "spender", type: "address" as const },
      { name: "amount", type: "uint256" as const },
    ],
    outputs: [{ name: "", type: "bool" as const }],
  },
]

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function TokenField({
  label,
  amount,
  onAmountChange,
  token,
  tokens,
  onTokenChange,
  onCustomAddress,
  customAddress,
  readOnly,
  placeholder,
}: {
  label: string
  amount: string
  onAmountChange?: (v: string) => void
  token: TokenConfig
  tokens: TokenConfig[]
  onTokenChange: (t: TokenConfig) => void
  onCustomAddress?: (addr: string) => void
  customAddress?: string
  readOnly?: boolean
  placeholder?: string
}) {
  const [showCustom, setShowCustom] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Input
          inputMode="decimal"
          value={amount}
          readOnly={readOnly}
          placeholder={placeholder ?? "0.0"}
          onChange={(e) => {
            const v = e.target.value
            if (v === "" || /^\d*\.?\d*$/.test(v)) onAmountChange?.(v)
          }}
          className={cn(
            "h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0",
            readOnly && "text-muted-foreground",
          )}
        />
        <Select
          value={showCustom ? "__custom__" : token.symbol}
          onValueChange={(v) => {
            if (v === "__custom__") {
              setShowCustom(true)
            } else {
              setShowCustom(false)
              const found = tokens.find((t) => t.symbol === v)
              if (found) onTokenChange(found)
            }
          }}
        >
          <SelectTrigger className="w-[120px] shrink-0 bg-card font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tokens.map((t) => (
              <SelectItem key={t.symbol} value={t.symbol}>
                {t.symbol}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">Custom...</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showCustom && onCustomAddress && (
        <div className="mt-2">
          <Input
            value={customAddress ?? ""}
            placeholder="0x... contract address"
            onChange={(e) => onCustomAddress(e.target.value)}
            className={cn(
              "h-8 border-border bg-background font-mono text-xs",
              customAddress && !isValidAddress(customAddress) && "border-red-500/50",
            )}
          />
          {customAddress && !isValidAddress(customAddress) && (
            <p className="mt-1 text-[10px] text-red-400">
              Invalid address format (0x + 40 hex chars)
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function StreamQuoteRow({
  msg,
  best,
  selected,
  onSelect,
  tokenOutSymbol,
}: {
  msg: StreamMessage
  best: boolean
  selected: boolean
  onSelect: () => void
  tokenOutSymbol: string
}) {
  const payload = msg.parsedPayload
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
            {msg.maker.slice(0, 6)}...{msg.maker.slice(-4)}
          </span>
          {best && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-400">
              best
            </span>
          )}
        </div>
        <span className="mt-0.5 text-xs text-muted-foreground">
          {payload?.message ?? "intent quote"}
        </span>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums text-foreground">
          {payload?.amountIn ?? "—"}
        </div>
        <div className="text-xs text-muted-foreground">{tokenOutSymbol}</div>
      </div>
    </button>
  )
}

export function SwapPanel() {
  const chainId = useChainId()
  const tokens = useMemo(() => getTokensByChain(chainId), [chainId])
  const { quotes, connectionState, sendRfq } = useQuoteStream()
  const { writeContractAsync } = useWriteContract()

  const [tokenIn, setTokenIn] = useState<TokenConfig>(() => tokens[0] ?? tokens[0])
  const [tokenOut, setTokenOut] = useState<TokenConfig>(() => tokens[1] ?? tokens[0])
  const [amountIn, setAmountIn] = useState("1.0")
  const [amountOut, setAmountOut] = useState("")
  const [memo, setMemo] = useState("")
  const [recipient, setRecipient] = useState("")
  const [showRecipient, setShowRecipient] = useState(false)
  const [customInAddress, setCustomInAddress] = useState("")
  const [customOutAddress, setCustomOutAddress] = useState("")

  const [stage, setStage] = useState<"idle" | "verifying" | "sending" | "received" | "success">("idle")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [wrapTxHash, setWrapTxHash] = useState("")
  const [verifyError, setVerifyError] = useState("")
  const [needsApproval, setNeedsApproval] = useState(false)
  const [deadlineMinutes, setDeadlineMinutes] = useState("30")
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const parsedAmount = Number.parseFloat(amountIn) || 0

  const { address } = useAccount()
  const dexAddress = getChainConfig(chainId).dexAddress

  const activeTokenIn = useMemo(() => {
    if (customInAddress && isValidAddress(customInAddress)) {
      return {
        symbol: "CUSTOM_IN",
        name: "Custom Token In",
        address: customInAddress,
        decimals: 18,
        price: 0,
      }
    }
    return tokenIn
  }, [tokenIn, customInAddress])

  const activeTokenOut = useMemo(() => {
    if (customOutAddress && isValidAddress(customOutAddress)) {
      return {
        symbol: "CUSTOM_OUT",
        name: "Custom Token Out",
        address: customOutAddress,
        decimals: 18,
        price: 0,
      }
    }
    return tokenOut
  }, [tokenOut, customOutAddress])

  const isEth = (addr: string) => addr === ETH_ADDRESS
  const isWeth = (addr: string) => addr.toLowerCase() === WETH_ADDRESS.toLowerCase()
  const isWrap = isEth(activeTokenIn.address) && isWeth(activeTokenOut.address)
  const isUnwrap = isWeth(activeTokenIn.address) && isEth(activeTokenOut.address)
  const isWrapUnwrap = isWrap || isUnwrap

  const flipTokens = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setCustomInAddress(customOutAddress)
    setCustomOutAddress(customInAddress)
    setAmountIn(amountOut || amountIn)
    setAmountOut("")
    resetFlow()
  }

  const resetFlow = () => {
    setStage("idle")
    setSelectedId(null)
    setAmountOut("")
    setWrapTxHash("")
    setVerifyError("")
    setNeedsApproval(false)
  }

  const handleRequestQuotes = useCallback(async () => {
    console.log("[Swap] handleRequestQuotes", { amountIn, tokenIn: activeTokenIn.symbol, tokenOut: activeTokenOut.symbol, address: address?.slice(0, 10) })

    // ETH ↔ WETH: direct wrap/unwrap, skip RFQ
    if (isWrap) {
      console.log("[Swap] → wrap flow")
      setStage("sending")
      try {
        const hash = await writeContractAsync({
          address: WETH_ADDRESS,
          abi: WETH_ABI,
          functionName: "deposit",
          value: parseEther(amountIn),
        })
        setWrapTxHash(hash)
        setStage("success")
      } catch {
        setStage("idle")
      }
      return
    }
    if (isUnwrap) {
      console.log("[Swap] → unwrap flow")
      setStage("sending")
      try {
        const hash = await writeContractAsync({
          address: WETH_ADDRESS,
          abi: WETH_ABI,
          functionName: "withdraw",
          args: [parseEther(amountIn)],
        })
        setWrapTxHash(hash)
        setStage("success")
      } catch {
        setStage("idle")
      }
      return
    }

    // ── On-chain verification: balance + allowance ──
    console.log("[Swap] → verification flow")
    setStage("verifying")
    setVerifyError("")
    setNeedsApproval(false)

    if (!address) {
      console.log("[Swap] no address, abort")
      setStage("idle")
      return
    }

    try {
      const amountInWei = parseUnits(amountIn, activeTokenIn.decimals)
      // 打印钱包当前链 ID，确认请求发到了哪条链
      const providerChainId = await (window as any).ethereum?.request?.({ method: "eth_chainId" })
      const ethBalance = await (window as any).ethereum?.request?.({ method: "eth_getBalance", params: [address, "latest"] })
      console.log("[Swap] calling verifyRFQ", { dexAddress, assetIn: activeTokenIn.address, amountInWei: amountInWei.toString(), providerChainId: providerChainId ? parseInt(providerChainId, 16) : "N/A", ethBalanceWei: ethBalance ?? "N/A" })
      const verifyResult = await readContract(config, {
        chainId: 31337,
        address: dexAddress as `0x${string}`,
        abi: DEX_ABI,
        functionName: "verifyRFQ",
        args: [address as `0x${string}`, activeTokenIn.address as `0x${string}`, amountInWei],
      })
      const sufficient = Array.isArray(verifyResult) ? verifyResult[0] : (verifyResult as any)?.sufficient
      const reason = Array.isArray(verifyResult) ? verifyResult[1] : (verifyResult as any)?.reason
      console.log("[Swap] verifyRFQ result:", { sufficient, reason, raw: verifyResult })

      if (!sufficient) {
        console.log("[Swap] verifyRFQ rejected:", reason)
        setVerifyError(reason)
        setNeedsApproval(reason === "insufficient allowance")
        setStage("idle")
        return
      }
    } catch (e) {
      const errMsg = String((e as any)?.message ?? e ?? "")
      console.error("[Swap] verifyRFQ error:", errMsg.slice(0, 300))
      if (errMsg.toLowerCase().includes("chain") || errMsg.toLowerCase().includes("network") || errMsg.includes("4902") || errMsg.includes("switch")) {
        setVerifyError("Wrong Network")
      } else if (errMsg.toLowerCase().includes("user rejected") || errMsg.toLowerCase().includes("user denied")) {
        setVerifyError("Request cancelled")
      } else {
        setVerifyError(errMsg.slice(0, 120))
      }
      setStage("idle")
      return
    }

    // ── Send RFQ ──
    const deadlineNum = parseInt(deadlineMinutes) || 30
    console.log("[Swap] → sending RFQ", {
      tokenIn: activeTokenIn.symbol,
      tokenOut: activeTokenOut.symbol,
      amountIn,
      deadlineMinutes: deadlineNum,
      recipient: recipient || "0x0000...0000",
      memo: memo || "(none)",
    })
    setStage("sending")
    setSelectedId(null)

    const result = await sendRfq({
      tokenIn: activeTokenIn,
      tokenOut: activeTokenOut,
      amountIn,
      amountOut: amountOut || "0",
      recipient: recipient || undefined,
      message: memo || `Swap ${amountIn} ${activeTokenIn.symbol} for ${amountOut || "?"} ${activeTokenOut.symbol}`,
      deadlineMinutes: deadlineNum,
    })
    console.log("[Swap] sendRfq result:", result)

    if (result?.ok) {
      setStage("received")
    } else {
      setStage("idle")
    }
  }, [activeTokenIn, activeTokenOut, amountIn, amountOut, memo, recipient, address, dexAddress, sendRfq, isWrap, isUnwrap, writeContractAsync, deadlineMinutes])

  const handleApprove = useCallback(async () => {
    setStage("verifying")
    setVerifyError("")
    try {
      const amountInWei = parseUnits(amountIn, activeTokenIn.decimals)
      const hash = await writeContractAsync({
        address: activeTokenIn.address as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [dexAddress as `0x${string}`, amountInWei],
      })
      // Approve confirmed, re-verify and proceed
      const approveVerifyResult = await readContract(config, {
        chainId: 31337,
        address: dexAddress as `0x${string}`,
        abi: DEX_ABI,
        functionName: "verifyRFQ",
        args: [address as `0x${string}`, activeTokenIn.address as `0x${string}`, amountInWei],
      })
      const sufficient = Array.isArray(approveVerifyResult) ? approveVerifyResult[0] : (approveVerifyResult as any)?.sufficient
      if (sufficient) {
        setNeedsApproval(false)
        // Continue to RFQ
        setStage("sending")
        setSelectedId(null)
        const result = await sendRfq({
          tokenIn: activeTokenIn,
          tokenOut: activeTokenOut,
          amountIn,
          amountOut: amountOut || "0",
          recipient: recipient || undefined,
          message: memo || `Swap ${amountIn} ${activeTokenIn.symbol} for ${amountOut || "?"} ${activeTokenOut.symbol}`,
          deadlineMinutes: parseInt(deadlineMinutes) || 30,
        })
        if (result?.ok) {
          setStage("received")
        } else {
          setStage("idle")
        }
      } else {
        setVerifyError("Approval succeeded but verification still fails. Check balance and try again.")
        setStage("idle")
      }
    } catch (e) {
      console.error("[Swap] handleApprove error:", String((e as any)?.message ?? e ?? "").slice(0, 300))
      setStage("idle")
    }
  }, [activeTokenIn, amountIn, amountOut, memo, recipient, address, dexAddress, sendRfq, writeContractAsync, deadlineMinutes])

  const disabled =
    parsedAmount <= 0 ||
    activeTokenIn.address === activeTokenOut.address ||
    !!(customInAddress && !isValidAddress(customInAddress)) ||
    !!(customOutAddress && !isValidAddress(customOutAddress))

  const renderButton = () => {
    // ── Wrap/Unwrap success ──
    if (stage === "success") {
      return (
        <div className="space-y-2">
          <Button
            size="lg"
            disabled
            className="h-12 w-full bg-emerald-500/80 text-base font-semibold text-emerald-950"
          >
            <Check className="size-5" /> {isWrap ? "Wrapped" : "Unwrapped"} successfully
          </Button>
          {wrapTxHash && (
            <p className="text-center font-mono text-xs text-muted-foreground break-all">
              Tx: {wrapTxHash.slice(0, 10)}…{wrapTxHash.slice(-6)}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setStage("idle"); setWrapTxHash("") }}
            className="h-8 w-full text-xs"
          >
            New swap
          </Button>
        </div>
      )
    }

    // ── Verifying (on-chain check before RFQ) ──
    if (stage === "verifying") {
      return (
        <Button
          size="lg"
          disabled
          className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950"
        >
          <Loader2 className="size-5 animate-spin" />{" "}
          {needsApproval ? "Approving..." : "Verifying balance & allowance..."}
        </Button>
      )
    }

    // ── Sending (RFQ or wrap/unwrap) ──
    if (stage === "sending") {
      return (
        <Button
          size="lg"
          disabled
          className="h-12 w-full bg-sky-500/80 text-base font-semibold text-sky-950"
        >
          <Loader2 className="size-5 animate-spin" />{" "}
          {isWrapUnwrap ? "Confirming transaction..." : "Sending RFQ..."}
        </Button>
      )
    }

    // ── Idle / Received (with possible error / approve prompt) ──
    return (
      <div className="space-y-2">
        {verifyError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <span className="text-xs text-amber-300">
              {verifyError === "insufficient balance"
                ? `Insufficient ${activeTokenIn.symbol} balance`
                : verifyError === "insufficient allowance"
                  ? `${activeTokenIn.symbol} allowance needed`
                  : verifyError}
            </span>
          </div>
        )}
        {needsApproval ? (
          <Button
            size="lg"
            className="h-12 w-full bg-amber-500 text-base font-semibold text-amber-950 hover:bg-amber-400"
            onClick={handleApprove}
          >
            Approve {activeTokenIn.symbol}
          </Button>
        ) : (
          <Button
            size="lg"
            disabled={disabled || !address}
            onClick={handleRequestQuotes}
            className="h-12 w-full bg-sky-500 text-base font-semibold text-sky-950 hover:bg-sky-400"
          >
            {!address ? (
              "Connect wallet"
            ) : activeTokenIn.address === activeTokenOut.address ? (
              "Select different tokens"
            ) : parsedAmount <= 0 ? (
              "Enter an amount"
            ) : isWrapUnwrap ? (
              <>
                <ArrowRightLeft className="size-5" />{" "}
                {isWrap
                  ? `Wrap ${amountIn} ETH → WETH (1:1)`
                  : `Unwrap ${amountIn} WETH → ETH (1:1)`}
              </>
            ) : (
              <>
                <Zap className="size-5" /> Request Quotes
              </>
            )}
          </Button>
        )}
      </div>
    )
  }

  if (!mounted) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-12 rounded bg-secondary/60" />
          <div className="h-24 rounded bg-secondary/60" />
          <div className="h-24 rounded bg-secondary/60" />
          <div className="h-10 rounded bg-secondary/60" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">OtcSwap</h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            OTC · intent
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            {connectionState === "connected" ? (
              <>
                <Link2 className="size-3 text-emerald-400" />
                <span className="text-emerald-400">live</span>
              </>
            ) : (
              <>
                <X className="size-3 text-red-400" />
                <span className="text-red-400">offline</span>
              </>
            )}
          </span>
          <Popover>
            <PopoverTrigger className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Settings">
              <Settings2 className="size-4" />
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" className="w-64">
              <PopoverHeader>
                <PopoverTitle>Transaction Settings</PopoverTitle>
              </PopoverHeader>
              <div className="space-y-2 px-1 pb-1">
                <Label className="text-xs text-muted-foreground">Deadline</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={deadlineMinutes}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === "" || /^\d*\.?\d*$/.test(v)) setDeadlineMinutes(v)
                    }}
                    className="h-8 bg-background font-mono text-xs"
                  />
                  <span className="text-xs text-muted-foreground">minutes</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="relative flex flex-col gap-1.5">
        <TokenField
          label="You Sell"
          amount={amountIn}
          onAmountChange={(v) => {
            setAmountIn(v)
            resetFlow()
          }}
          token={activeTokenIn}
          tokens={tokens}
          onTokenChange={(t) => {
            setTokenIn(t)
            setCustomInAddress("")
            resetFlow()
          }}
          onCustomAddress={setCustomInAddress}
          customAddress={customInAddress}
        />

        <button
          type="button"
          onClick={flipTokens}
          aria-label="Flip tokens"
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-sky-400"
        >
          <ArrowDown className="size-4" />
        </button>

        <TokenField
          label="You Buy"
          amount={amountOut}
          onAmountChange={(v) => {
            setAmountOut(v)
          }}
          token={activeTokenOut}
          tokens={tokens}
          onTokenChange={(t) => {
            setTokenOut(t)
            setCustomOutAddress("")
            resetFlow()
          }}
          onCustomAddress={setCustomOutAddress}
          customAddress={customOutAddress}
          placeholder="0.0"
        />
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="memo" className="text-xs text-muted-foreground">
          Memo (optional)
        </Label>
        <Input
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Attach a note to your intent broadcast"
          className="bg-secondary/40 font-mono text-sm"
        />
      </div>

      {/* Stream quotes */}
      {quotes.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {quotes.length} intent{quotes.length !== 1 ? "s" : ""} received
            </span>
            <span className="text-xs text-muted-foreground">tap to select</span>
          </div>
          <div className="space-y-1.5">
            {quotes.map((msg, i) => (
              <StreamQuoteRow
                key={msg.nonce + i}
                msg={msg}
                best={i === 0}
                selected={selectedId === i}
                onSelect={() => setSelectedId(i)}
                tokenOutSymbol={activeTokenOut.symbol}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recipient (expandable) */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowRecipient(!showRecipient)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showRecipient ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          Counterparty{recipient ? `: ${recipient.slice(0, 6)}...${recipient.slice(-4)}` : " (default: zero address)"}
        </button>
        {showRecipient && (
          <div className="mt-2">
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x... counterparty address (leave empty for zero address)"
              className={cn(
                "h-9 bg-background font-mono text-xs",
                recipient && !isValidAddress(recipient) && "border-red-500/50",
              )}
            />
            {recipient && !isValidAddress(recipient) && (
              <p className="mt-1 text-[10px] text-red-400">
                Invalid address format (0x + 40 hex chars)
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto pt-5">{renderButton()}</div>
    </div>
  )
}
