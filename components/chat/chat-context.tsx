"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { useXMTP } from "@/hooks/use-xmtp"
import { buildOrderInquiry, type OrderInquiry } from "@/lib/xmtp-types"

interface StartChatInput {
  peerAddress: string
  quoteId: string
  inquiry: Parameters<typeof buildOrderInquiry>[0]
}

interface ChatContextValue extends ReturnType<typeof useXMTP> {
  isOpen: boolean
  activeTopic: string | null
  openSidebar: () => void
  closeSidebar: () => void
  setActiveTopic: (topic: string | null) => void
  /** Intent-driven entry point used by the "Chat with maker" button. */
  startChatFromQuote: (input: StartChatInput) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const xmtp = useXMTP()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTopic, setActiveTopic] = useState<string | null>(null)

  const openSidebar = useCallback(() => setIsOpen(true), [])
  const closeSidebar = useCallback(() => setIsOpen(false), [])

  const startChatFromQuote = useCallback(
    async (input: StartChatInput) => {
      // Ensure the client is connected before starting a DM.
      if (!xmtp.isReady) {
        await xmtp.connect()
      }
      const topic = xmtp.openConversation(input.peerAddress, input.quoteId)
      setActiveTopic(topic)
      setIsOpen(true)
      // Auto-send the structured trade context as the first message.
      xmtp.sendInquiry(topic, buildOrderInquiry(input.inquiry))
    },
    [xmtp],
  )

  const value = useMemo<ChatContextValue>(
    () => ({
      ...xmtp,
      isOpen,
      activeTopic,
      openSidebar,
      closeSidebar,
      setActiveTopic,
      startChatFromQuote,
    }),
    [xmtp, isOpen, activeTopic, openSidebar, closeSidebar, startChatFromQuote],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChat must be used within a ChatProvider")
  return ctx
}
