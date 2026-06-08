"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { TradePanel } from "@/components/trade-panel"
import { OrdersPanel } from "@/components/orders-panel"
import { QuotesPanel } from "@/components/quotes-panel"

type View = "trade" | "orders" | "quotes"

export function Workspace() {
  const [view, setView] = useState<View>("trade")

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* View switch */}
      <nav className="mb-6 flex items-center gap-1 rounded-xl border border-border bg-card p-1 sm:w-fit">
        <button
          type="button"
          onClick={() => setView("trade")}
          className={cn(
            "flex-1 rounded-lg px-5 py-2 text-sm font-medium transition-colors sm:flex-none",
            view === "trade"
              ? "bg-sky-500 text-sky-950"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Trade
        </button>
        <button
          type="button"
          onClick={() => setView("orders")}
          className={cn(
            "flex-1 rounded-lg px-5 py-2 text-sm font-medium transition-colors sm:flex-none",
            view === "orders"
              ? "bg-sky-500 text-sky-950"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Open Orders
        </button>
        <button
          type="button"
          onClick={() => setView("quotes")}
          className={cn(
            "flex-1 rounded-lg px-5 py-2 text-sm font-medium transition-colors sm:flex-none",
            view === "quotes"
              ? "bg-sky-500 text-sky-950"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Open Quotes
        </button>
      </nav>

      {view === "trade" ? (
        <div className="mx-auto max-w-md">
          <section>
            <TradePanel />
          </section>
        </div>
      ) : view === "orders" ? (
        <div>
          <section className="min-h-[640px]">
            <OrdersPanel />
          </section>
        </div>
      ) : (
        <div>
          <section className="min-h-[640px]">
            <QuotesPanel />
          </section>
        </div>
      )}
    </div>
  )
}
