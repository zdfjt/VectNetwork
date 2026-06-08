import { Workspace } from "@/components/workspace"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
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
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
              <span className="text-foreground">Swap</span>
              <span className="cursor-default transition-colors hover:text-foreground">
                Pools
              </span>
              <span className="cursor-default transition-colors hover:text-foreground">
                Proposers
              </span>
            </nav>
            <button
              type="button"
              className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
            >
              0x71C…4a2F
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <Workspace />
    </main>
  )
}
