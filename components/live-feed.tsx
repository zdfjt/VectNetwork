"use client"

import { useEffect, useRef, useState } from "react"
import { Activity } from "lucide-react"
import type { FeedEntry } from "@/lib/propamm-types"
import { createFeedStream, seedFeed } from "@/lib/feed-stream"
import { cn } from "@/lib/utils"

const MAX_ENTRIES = 80

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  if (entry.kind === "memo") {
    return (
      <div className="flex gap-2 pl-[4.5rem] leading-relaxed">
        <span className="select-none text-muted-foreground/40">↳</span>
        <span className="italic text-muted-foreground/70">{entry.message}</span>
      </div>
    )
  }

  return (
    <div className="flex gap-3 leading-relaxed">
      <span className="shrink-0 select-none tabular-nums text-muted-foreground/50">
        {formatTime(entry.timestamp)}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2 text-sky-400">
        <span className="rounded bg-sky-500/10 px-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-sky-300">
          intent
        </span>
        <span className="text-sky-300/70">{entry.proposer}</span>
        <span className="font-medium text-sky-200">
          {entry.amountIn} {entry.tokenIn}
        </span>
        <span className="text-sky-500/60">→</span>
        <span className="font-medium text-sky-200">{entry.tokenOut}</span>
      </span>
    </div>
  )
}

export function LiveFeed() {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  useEffect(() => {
    setEntries(seedFeed(10))
    const stop = createFeedStream((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
      })
    })
    return stop
  }, [])

  // auto-scroll to bottom when new entries arrive, unless user scrolled up
  useEffect(() => {
    const el = scrollRef.current
    if (el && atBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  const intentCount = entries.filter((e) => e.kind === "intent").length

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <h2 className="text-sm font-medium text-foreground">
            Live Market Feed
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="size-3.5" />
          <span className="tabular-nums">{intentCount}</span>
          <span>intents</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "terminal-scroll flex-1 space-y-1 overflow-y-auto px-4 py-3",
          "font-mono text-xs",
        )}
      >
        {entries.map((entry) => (
          <FeedRow key={entry.id} entry={entry} />
        ))}
        <div className="flex items-center gap-2 pt-1 text-muted-foreground/40">
          <span className="text-sky-500/60">propamm@mainnet</span>
          <span className="inline-block h-3.5 w-2 animate-pulse bg-sky-400/60" />
        </div>
      </div>
    </div>
  )
}
