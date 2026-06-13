"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { TokenConfig } from "@/lib/token-registry"

export function TokenInput({
  label,
  amount,
  onAmountChange,
  token,
  tokens,
  onTokenChange,
  readOnly,
  loading,
  disabledToken,
}: {
  label: string
  amount: string
  onAmountChange?: (v: string) => void
  token?: TokenConfig
  tokens: TokenConfig[]
  onTokenChange: (t: TokenConfig) => void
  readOnly?: boolean
  loading?: boolean
  /** A token symbol to disable (e.g. the one selected on the other side). */
  disabledToken?: string
}) {
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
          placeholder="0.0"
          onChange={(e) => {
            const v = e.target.value
            if (v === "" || /^\d*\.?\d*$/.test(v)) onAmountChange?.(v)
          }}
          className={cn(
            "h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0",
            loading && "animate-pulse text-muted-foreground",
          )}
        />
        <Select
          value={token?.symbol}
          onValueChange={(sym) => {
            const t = tokens.find((tk) => tk.symbol === sym)
            if (t) onTokenChange(t)
          }}
        >
          <SelectTrigger className="w-auto shrink-0 gap-1.5 rounded-full border-border bg-card font-semibold">
            <SelectValue placeholder="Token" />
          </SelectTrigger>
          <SelectContent>
            {tokens.map((t) => (
              <SelectItem
                key={t.symbol}
                value={t.symbol}
                disabled={t.symbol === disabledToken}
              >
                {t.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
