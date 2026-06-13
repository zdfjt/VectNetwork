"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, MessageSquare, Send } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useChat } from "@/components/chat/chat-context"
import { OrderInquiryCard } from "@/components/chat/order-inquiry-card"
import type { XmtpMessage } from "@/lib/xmtp-types"
import { cn } from "@/lib/utils"

function shortAddr(addr: string) {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function timeOf(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

export function ChatSidebar() {
  const {
    isOpen,
    closeSidebar,
    conversations,
    activeTopic,
    setActiveTopic,
    messagesByTopic,
    selfAddress,
    sendText,
    getPeerAddressByTopic,
    getRoomIdByTopic,
  } = useChat()

  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeConvo = useMemo(
    () => conversations.find((c) => c.topic === activeTopic) ?? null,
    [conversations, activeTopic],
  )
  const messages = activeTopic ? (messagesByTopic[activeTopic] ?? []) : []

  // The structured trade context currently being negotiated (first inquiry in thread).
  const negotiatingInquiry = useMemo(() => {
    const m = messages.find((msg) => msg.content.type === "order_inquiry")
    return m && m.content.type === "order_inquiry" ? m.content.inquiry : null
  }, [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages.length, activeTopic])

  const handleSend = () => {
    if (!activeTopic || !draft.trim()) return
    sendText(activeTopic, draft)
    setDraft("")
  }

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (o ? null : closeSidebar())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-sm">
            {activeConvo ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTopic(null)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span>
                  <span className="font-mono">交易对手: {shortAddr(getPeerAddressByTopic(activeTopic ?? ""))}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">房间号: {(() => {
                    const roomId = getRoomIdByTopic(activeTopic ?? "")
                    return roomId ? `${roomId.slice(0, 6)}…${roomId.slice(-4)}` : "Connecting…"
                  })()}</span>
                </span>
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 text-sky-400" />
                Messages
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {!activeConvo ? (
          <ConversationList
            conversations={conversations}
            onSelect={(t) => setActiveTopic(t)}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Pinned negotiating-order header */}
            {negotiatingInquiry && (
              <div className="border-b border-border bg-secondary/30 px-4 py-2.5">
                <p className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Negotiating
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {negotiatingInquiry.side.toUpperCase()} {negotiatingInquiry.quantity}{" "}
                    {negotiatingInquiry.asset}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {negotiatingInquiry.quoteId}
                  </span>
                </div>
              </div>
            )}

            {/* Thread */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <p className="mt-8 text-center text-xs text-muted-foreground">
                  No messages yet. Say gm.
                </p>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} selfAddress={selfAddress} />
              ))}
            </div>

            {/* Composer */}
            <div className="flex items-center gap-2 border-t border-border px-3 py-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-sky-500/50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!draft.trim()}
                className="rounded-lg bg-sky-500 p-2 text-sky-950 transition-colors hover:bg-sky-400 disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ConversationList({
  conversations,
  onSelect,
}: {
  conversations: { topic: string; peerAddress: string; preview: string; lastMessageAt: number }[]
  onSelect: (topic: string) => void
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-foreground">No conversations yet</p>
        <p className="text-xs text-muted-foreground">
          Open a quote and tap “Chat with maker” to start an encrypted DM.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((c) => (
        <button
          key={c.topic}
          type="button"
          onClick={() => onSelect(c.topic)}
          className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary/50"
        >
          <div className="min-w-0">
            <p className="font-mono text-sm text-foreground">{shortAddr(c.peerAddress)}</p>
            <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeOf(c.lastMessageAt)}
          </span>
        </button>
      ))}
    </div>
  )
}

function MessageBubble({ message, selfAddress }: { message: XmtpMessage; selfAddress: string }) {
  const mine = message.senderAddress.toLowerCase() === selfAddress.toLowerCase()

  if (message.content.type === "order_inquiry") {
    return (
      <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
        <OrderInquiryCard inquiry={message.content.inquiry} mine={mine} />
        <span className="px-1 text-[10px] text-muted-foreground">{timeOf(message.sentAt)}</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          mine
            ? "rounded-br-sm bg-sky-500 text-sky-950"
            : "rounded-bl-sm bg-secondary text-foreground",
        )}
      >
        {message.content.text}
      </div>
      <span className="px-1 text-[10px] text-muted-foreground">{timeOf(message.sentAt)}</span>
    </div>
  )
}
