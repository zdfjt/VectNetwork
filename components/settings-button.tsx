"use client"

import { useEffect, useRef, useState } from "react"
import { Settings, Loader2 } from "lucide-react"
import { createPublicClient, http } from "viem"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useCustomRpcUrl, setCustomRpcUrl } from "@/lib/rpc-store"

type ConnState = "idle" | "checking" | "connected" | "failed"

/** Validate an RPC endpoint by requesting its chain id. */
async function probeRpc(url: string): Promise<{ ok: boolean; chainId?: number }> {
  try {
    const client = createPublicClient({ transport: http(url, { timeout: 8000 }) })
    const chainId = await client.getChainId()
    return { ok: true, chainId }
  } catch {
    return { ok: false }
  }
}

export function SettingsButton() {
  const savedUrl = useCustomRpcUrl()
  const [draft, setDraft] = useState(savedUrl ?? "")
  const [state, setState] = useState<ConnState>("idle")
  const [chainId, setChainId] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the input in sync if the stored value changes elsewhere.
  useEffect(() => {
    setDraft(savedUrl ?? "")
  }, [savedUrl])

  // Auto-probe + auto-save (debounced) whenever the user edits the URL.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = draft.trim()
    if (!trimmed) {
      setState("idle")
      setChainId(null)
      // Empty input clears the custom RPC -> falls back to wallet RPC.
      setCustomRpcUrl(null)
      return
    }

    // Basic shape check before hitting the network.
    if (!/^https?:\/\//i.test(trimmed) && !/^wss?:\/\//i.test(trimmed)) {
      setState("failed")
      setChainId(null)
      return
    }

    setState("checking")
    debounceRef.current = setTimeout(async () => {
      const { ok, chainId: id } = await probeRpc(trimmed)
      if (ok) {
        setState("connected")
        setChainId(id ?? null)
        // Auto-save only valid endpoints.
        setCustomRpcUrl(trimmed)
      } else {
        setState("failed")
        setChainId(null)
      }
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [draft])

  const indicator = {
    idle: { dot: "bg-muted-foreground", label: "Using wallet RPC" },
    checking: { dot: "bg-amber-400", label: "Checking connection…" },
    connected: { dot: "bg-emerald-500", label: "RPC Connected" },
    failed: { dot: "bg-red-500", label: "Connection Failed" },
  }[state]

  return (
    <Sheet>
      <SheetTrigger
        className="rounded-lg border border-border bg-secondary/60 p-2 text-foreground transition-colors hover:bg-secondary"
        aria-label="Open settings"
      >
        <Settings className="size-4" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Configure how the app connects on-chain.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          {/* Node Configuration */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Node Configuration</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Advanced: route reads and simulations through your own RPC endpoint.
              Leave empty to use your connected wallet&apos;s network.
            </p>

            <label
              htmlFor="rpc-url"
              className="mt-4 block text-xs font-medium text-muted-foreground"
            >
              Custom RPC URL
            </label>
            <input
              id="rpc-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://your-node.example/rpc"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-sky-500"
            />

            {/* Status indicator */}
            <div className="mt-3 flex items-center gap-2">
              {state === "checking" ? (
                <Loader2 className="size-3.5 animate-spin text-amber-400" />
              ) : (
                <span className={cn("size-2.5 rounded-full", indicator.dot)} />
              )}
              <span className="text-xs text-foreground">{indicator.label}</span>
              {state === "connected" && chainId != null && (
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                  chain id {chainId}
                </span>
              )}
            </div>

            {savedUrl && (
              <button
                type="button"
                onClick={() => {
                  setDraft("")
                  setCustomRpcUrl(null)
                  setState("idle")
                  setChainId(null)
                }}
                className="mt-3 text-xs font-medium text-sky-400 transition-colors hover:text-sky-300"
              >
                Reset to wallet RPC
              </button>
            )}
          </section>

          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Your endpoint is saved locally in this browser and loaded automatically
            next time. It is never sent anywhere except to make RPC calls.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
