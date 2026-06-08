"use client"

import { useState } from "react"
import { ArrowLeftRight, Coins, Layers, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { Workspace } from "@/components/workspace"
import { ChatProvider, useChat } from "@/components/chat/chat-context"
import { ChatSidebar } from "@/components/chat/chat-sidebar"

export type Category = "spot" | "options" | "lending"

const CATEGORIES: { id: Category; label: string; icon: typeof Coins }[] = [
  { id: "spot", label: "Spot", icon: ArrowLeftRight },
  { id: "options", label: "Options", icon: Layers },
  { id: "lending", label: "Lending", icon: Coins },
]

function ChatButton() {
  const { openSidebar, conversations } = useChat()
  return (
    <button
      type="button"
      onClick={openSidebar}
      className="relative rounded-lg border border-border bg-secondary/60 p-2 text-foreground transition-colors hover:bg-secondary"
      aria-label="Open messages"
    >
      <MessageSquare className="size-4" />
      {conversations.length > 0 && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-sky-950">
          {conversations.length}
        </span>
      )}
    </button>
  )
}

export function AppShell() {
  return (
    <ChatProvider>
      <AppShellInner />
      <ChatSidebar />
    </ChatProvider>
  )
}

function AppShellInner() {
  const [category, setCategory] = useState<Category>("spot")

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500 font-mono text-sm font-bold text-sky-950">
              P
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">PropAMM</div>
              <div className="font-mono text-xs text-muted-foreground">
                proposer-based amm
              </div>
            </div>
          </div>

          {/* Top-level category nav */}
          <nav className="hidden items-center gap-1 rounded-xl border border-border bg-card p-1 md:flex">
            {CATEGORIES.map((c) => {
              const Icon = c.icon
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
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

          <div className="flex items-center gap-3">
            <ChatButton />
            <button
              type="button"
              className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
            >
              0x71C…4a2F
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile category nav */}
        <nav className="flex items-center gap-1 border-t border-border px-6 py-2 md:hidden">
          {CATEGORIES.map((c) => {
            const Icon = c.icon
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
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
      </header>

      {/* Main workspace */}
      <Workspace category={category} />
    </main>
  )
}
