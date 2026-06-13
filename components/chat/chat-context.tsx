"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useConnection, useWalletClient } from "wagmi"
import { useXMTP } from "@/hooks/use-xmtp"
import { buildOrderInquiry } from "@/lib/xmtp-types"

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
  startChatFromQuote: (input: StartChatInput) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const xmtp = useXMTP()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTopic, setActiveTopic] = useState<string | null>(null)

  const { isConnected } = useConnection()
  const { data: walletClient } = useWalletClient()

  // ── Bridge: wallet ready → auto-trigger XMTP connect ─────────────
  useEffect(() => {
    if (
      isConnected &&
      walletClient &&
      xmtp.registrationStatus === "idle" &&
      !xmtp.isReady &&
      !xmtp.isConnecting
    ) {
      const timer = setTimeout(() => {
        console.log("[XMTP Debug] 缓冲结束，正式向钱包发起首次注册签名请求...")
        xmtp.connect(walletClient)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isConnected, walletClient, xmtp.registrationStatus, xmtp.isReady, xmtp.isConnecting, xmtp.connect])

  const openSidebar = useCallback(() => setIsOpen(true), [])
  const closeSidebar = useCallback(() => setIsOpen(false), [])

  const startChatFromQuote = useCallback(
    async (input: StartChatInput) => {
      // Ensure XMTP client is connected and ready
      let ready = xmtp.isReady
      if (!ready) {
        console.log("[Chat] XMTP not ready, connecting...")
        ready = await xmtp.connect(walletClient)
      }

      // Verify connection succeeded
      if (!ready) {
        console.error("[Chat] XMTP failed to connect")
        const errorMsg = xmtp.xmtpError || "连接失败，请确保已连接钱包并在弹出的签名请求中确认。"
        alert(errorMsg)
        return
      }

      const topic = xmtp.openConversation(input.peerAddress, input.quoteId)
      setActiveTopic(topic)
      setIsOpen(true)
      xmtp.sendInquiry(topic, buildOrderInquiry(input.inquiry))
    },
    [xmtp, walletClient],
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
