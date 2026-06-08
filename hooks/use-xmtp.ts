"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  type OrderInquiry,
  type XmtpConversation,
  type XmtpMessage,
  encodeInquiry,
  tryDecodeInquiry,
} from "@/lib/xmtp-types"

/**
 * useXMTP — XMTP-shaped messaging hook with a MOCK transport.
 *
 * The public surface mirrors `@xmtp/browser-sdk` (V3/MLS) so production wiring
 * is mechanical:
 *   - `connect()`           -> `Client.create(signer, { env })`
 *   - `newConversation()`   -> `client.conversations.newDm(peerInboxId)`
 *   - `sendText/sendInquiry`-> `conversation.send(content)`
 *   - `messages`/`stream`   -> `conversation.messages()` + `conversation.stream()`
 *
 * Right now everything is held in memory (per page session). Mock peers also
 * auto-reply so the UI is fully demonstrable without a wallet or network.
 *
 * ============================================================================
 * TODO(xmtp): SWITCH TO REAL CLIENT
 * ----------------------------------------------------------------------------
 * 1. `pnpm add @xmtp/browser-sdk` (+ a wallet/signer source like wagmi/viem).
 * 2. Replace `connect()` body with:
 *      const client = await Client.create(signer, { env: "production" })
 *    where `signer` is an ethers/viem Signer adapter implementing
 *    `getAddress()` + `signMessage()`.
 * 3. Replace `newConversation()` with `client.conversations.newDm(addr)`.
 * 4. Replace the mock send/stream below with real `conversation.send()` and
 *    an async `for await (const msg of await conversation.stream())` loop.
 * 5. Drop `simulatePeerReply` entirely — real peers send their own messages.
 * ============================================================================
 */

// A deterministic-ish mock address for "you" before a real wallet is connected.
const MOCK_SELF_ADDRESS = "0xYOU000000000000000000000000000000000000"

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function previewOf(m: XmtpMessage): string {
  if (m.content.type === "order_inquiry") {
    const i = m.content.inquiry
    return `RFQ ${i.asset} · ${i.side} ${i.quantity}`
  }
  return m.content.text
}

export interface UseXmtpResult {
  isReady: boolean
  isConnecting: boolean
  selfAddress: string
  conversations: XmtpConversation[]
  /** messages keyed by conversation topic */
  messagesByTopic: Record<string, XmtpMessage[]>
  connect: () => Promise<void>
  /** Create (or fetch existing) a conversation with a peer for a given quote. */
  openConversation: (peerAddress: string, quoteId?: string) => string
  sendText: (topic: string, text: string) => void
  sendInquiry: (topic: string, inquiry: OrderInquiry) => void
}

export function useXMTP(): UseXmtpResult {
  const [isReady, setIsReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [selfAddress, setSelfAddress] = useState(MOCK_SELF_ADDRESS)
  const [conversations, setConversations] = useState<XmtpConversation[]>([])
  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, XmtpMessage[]>>({})

  const replyTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      replyTimers.current.forEach(clearTimeout)
    }
  }, [])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    // TODO(xmtp): replace with real wallet signature + Client.create(signer)
    await new Promise((r) => setTimeout(r, 600))
    setSelfAddress(MOCK_SELF_ADDRESS)
    setIsReady(true)
    setIsConnecting(false)
  }, [])

  const topicFor = (peerAddress: string, quoteId?: string) =>
    `dm:${peerAddress.toLowerCase()}${quoteId ? `:${quoteId}` : ""}`

  const appendMessage = useCallback((topic: string, message: XmtpMessage) => {
    setMessagesByTopic((prev) => ({
      ...prev,
      [topic]: [...(prev[topic] ?? []), message],
    }))
    setConversations((prev) =>
      prev.map((c) =>
        c.topic === topic
          ? { ...c, lastMessageAt: message.sentAt, preview: previewOf(message) }
          : c,
      ),
    )
  }, [])

  // MOCK ONLY: the counterparty types back so the UI feels alive.
  // TODO(xmtp): delete — real peers deliver messages via the stream.
  const simulatePeerReply = useCallback(
    (topic: string, peerAddress: string, context?: string) => {
      const t = setTimeout(
        () => {
          appendMessage(topic, {
            id: randomId(),
            senderAddress: peerAddress.toLowerCase(),
            sentAt: Date.now(),
            content: {
              type: "text",
              text: context
                ? `gm — saw your ${context} request. I can make a market, what size are you firm on?`
                : "gm, how can I help?",
            },
          })
        },
        1200 + Math.random() * 1200,
      )
      replyTimers.current.push(t)
    },
    [appendMessage],
  )

  const openConversation = useCallback(
    (peerAddress: string, quoteId?: string) => {
      const topic = topicFor(peerAddress, quoteId)
      setConversations((prev) => {
        if (prev.some((c) => c.topic === topic)) return prev
        const now = Date.now()
        const convo: XmtpConversation = {
          topic,
          peerAddress: peerAddress.toLowerCase(),
          quoteId,
          createdAt: now,
          lastMessageAt: now,
          preview: "New conversation",
        }
        return [convo, ...prev]
      })
      setMessagesByTopic((prev) => (prev[topic] ? prev : { ...prev, [topic]: [] }))
      return topic
    },
    [],
  )

  const sendText = useCallback(
    (topic: string, text: string) => {
      if (!text.trim()) return
      // TODO(xmtp): await conversation.send(text)
      appendMessage(topic, {
        id: randomId(),
        senderAddress: selfAddress.toLowerCase(),
        sentAt: Date.now(),
        content: { type: "text", text: text.trim() },
      })
      const convo = conversations.find((c) => c.topic === topic)
      if (convo) simulatePeerReply(topic, convo.peerAddress)
    },
    [appendMessage, conversations, selfAddress, simulatePeerReply],
  )

  const sendInquiry = useCallback(
    (topic: string, inquiry: OrderInquiry) => {
      // TODO(xmtp): await conversation.send(encodeInquiry(inquiry), { contentType })
      const body = encodeInquiry(inquiry)
      const decoded = tryDecodeInquiry(body)
      appendMessage(topic, {
        id: randomId(),
        senderAddress: selfAddress.toLowerCase(),
        sentAt: Date.now(),
        content: decoded
          ? { type: "order_inquiry", inquiry: decoded }
          : { type: "text", text: body },
      })
      const convo = conversations.find((c) => c.topic === topic)
      if (convo) simulatePeerReply(topic, convo.peerAddress, `${inquiry.asset} ${inquiry.side}`)
    },
    [appendMessage, conversations, selfAddress, simulatePeerReply],
  )

  return {
    isReady,
    isConnecting,
    selfAddress,
    conversations,
    messagesByTopic,
    connect,
    openConversation,
    sendText,
    sendInquiry,
  }
}
