"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { Category } from "@/components/app-shell"
import { SwapPanel } from "@/components/swap-panel"
import { OptionsPanel } from "@/components/options-panel"
import { LendingPanel } from "@/components/lending-panel"
import { OrdersPanel } from "@/components/orders-panel"
import { QuotesPanel } from "@/components/quotes-panel"
import { LendingOrdersPanel } from "@/components/lending-orders-panel"
import { LendingQuotesPanel } from "@/components/lending-quotes-panel"

type Tab = "trade" | "orders" | "quotes"

const TABS: { id: Tab; label: string }[] = [
  { id: "trade", label: "Trade" },
  { id: "orders", label: "Orders" },
  { id: "quotes", label: "Quotes" },
]

export function Workspace({ category }: { category: Category }) {
  const [tab, setTab] = useState<Tab>("trade")

  // reset to the Trade tab whenever the top-level category changes
  useEffect(() => {
    setTab("trade")
  }, [category])

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
