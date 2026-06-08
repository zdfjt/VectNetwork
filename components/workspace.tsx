"use client"

import { useState } from "react"
import { ArrowLeftRight, Coins, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { SwapPanel } from "@/components/swap-panel"
import { OptionsPanel } from "@/components/options-panel"
import { LendingPanel } from "@/components/lending-panel"
import { OrdersPanel } from "@/components/orders-panel"
import { QuotesPanel } from "@/components/quotes-panel"
import { LendingOrdersPanel } from "@/components/lending-orders-panel"
import { LendingQuotesPanel } from "@/components/lending-quotes-panel"

type Category = "spot" | "options" | "lending"
type Tab = "trade" | "orders" | "quotes"

const CATEGORIES: { id: Category; label: string; icon: typeof Coins }[] = [
  { id: "spot", label: "Spot", icon: ArrowLeftRight },
  { id: "options", label: "Options", icon: Layers },
  { id: "lending", label: "Lending", icon: Coins },
]

const TABS: { id: Tab; label: string }[] = [
  { id: "trade", label: "Trade" },
  { id: "orders", label: "Orders" },
  { id: "quotes", label: "Quotes" },
]

export function Workspace() {
  const [category, setCategory] = useState<Category>("spot")
  const [tab, setTab] = useState<Tab>("trade")

  const isTrade = tab === "trade"

  function renderPanel() {
    if (category === "spot") {
      if (tab === "trade") return <SwapPanel />
      if (tab === "orders") return <OrdersPanel scope="token" />
      return <QuotesPanel scope="token" />
    }
    if (category === "options") {
      if (tab === "trade") return <OptionsPanel />
      if (tab === "orders") return <OrdersPanel scope="option" />
      return <QuotesPanel scope="option" />
    }
    // lending
    if (tab === "trade") return <LendingPanel />
    if (tab === "orders") return <LendingOrdersPanel />
    return <LendingQuotesPanel />
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Category switch */}
      <nav className="mb-4 flex items-center gap-1 rounded-xl border border-border bg-card p-1 sm:w-fit">
        {CATEGORIES.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors sm:flex-none",
                category === c.id
                  ? "bg-sky-500 text-sky-950"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {c.label}
            </button>
          )
        })}
      </nav>

      {/* Sub-tab switch */}
      <nav className="mb-6 flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-4 py-1.5 text-xs font-medium transition-colors sm:flex-none",
              tab === t.id
                ? "bg-sky-500/15 text-sky-400"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {isTrade ? (
        <div className="mx-auto max-w-md">
          <section>{renderPanel()}</section>
        </div>
      ) : (
        <div>
          <section className="min-h-[640px]">{renderPanel()}</section>
        </div>
      )}
    </div>
  )
}
