"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useConnection } from "wagmi"
import { stringToHex } from "viem"
import { Client } from "@xmtp/browser-sdk"
import type { Dm } from "@xmtp/browser-sdk"
import {
  type OrderInquiry,
  type XmtpConversation,
  type XmtpMessage,
  encodeInquiry,
  tryDecodeInquiry,
} from "@/lib/xmtp-types"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

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

function makeEthIdentifier(address: string) {
  return { identifier: address.toLowerCase(), identifierKind: "Ethereum" as const }
}

function normalizeAddress(addr: string) {
  return addr.toLowerCase()
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16)
  }
  return bytes
}

export interface UseXmtpResult {
  isReady: boolean
  isConnecting: boolean
  registrationStatus: "idle" | "checking" | "signature_pending" | "ready" | "failed"
  xmtpError: string | null
  selfAddress: string
  conversations: XmtpConversation[]
  messagesByTopic: Record<string, XmtpMessage[]>
  connect: (client: any) => Promise<boolean>
  clearError: () => void
  getPeerAddressByTopic: (topic: string) => string
  getRoomIdByTopic: (topic: string) => string | null
  openConversation: (peerAddress: string, quoteId?: string) => string
  sendText: (topic: string, text: string) => void
  sendInquiry: (topic: string, inquiry: OrderInquiry) => void
}

export function useXMTP(): UseXmtpResult {
  const { isConnected, address: walletAddress } = useConnection()
  const [conversations, setConversations] = useState<XmtpConversation[]>([])
  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, XmtpMessage[]>>({})
  const [isXmtpReady, setIsXmtpReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "checking" | "signature_pending" | "ready" | "failed">("idle")
  const [xmtpError, setXmtpError] = useState<string | null>(null)

  const clientRef = useRef<Client | null>(null)
  const streamRef = useRef<{ end(): void } | null>(null)
  const dmMapRef = useRef<Map<string, Dm>>(new Map())
  const dmPendingRef = useRef<Map<string, Promise<Dm>>>(new Map())
  // Maps XMTP conversation ID → custom topic (addr or addr:quoteId)
  const xmtpIdToTopicRef = useRef<Map<string, string>>(new Map())
  // Maps topic → peer inbox ID (for DM recovery and address lookup)
  const topicPeerRef = useRef<Map<string, string>>(new Map())
  // Maps inbox ID → Ethereum wallet address (set by openConversation)
  const peerInboxToAddressRef = useRef<Map<string, string>>(new Map())

  const isReady = isConnected && isXmtpReady
  const selfAddress = walletAddress ?? ZERO_ADDRESS

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

  const upsertConversation = useCallback((convo: XmtpConversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.topic === convo.topic)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = convo
        return next
      }
      return [convo, ...prev]
    })
  }, [])

  const ensureTopicMessages = useCallback((topic: string) => {
    setMessagesByTopic((prev) => (prev[topic] ? prev : { ...prev, [topic]: [] }))
  }, [])

  const clearError = useCallback(() => {
    setXmtpError(null)
    setRegistrationStatus("idle")
  }, [])

  // ── XMTP connect ──────────────────────────────────────────────────
  const connect = useCallback(async (clientForSign: any): Promise<boolean> => {
    if (clientRef.current) {
      setRegistrationStatus("ready")
      return true
    }
    if (!clientForSign || !walletAddress) {
      console.error("[XMTP] Cannot connect: clientForSign=", !!clientForSign, "walletAddress=", !!walletAddress)
      setXmtpError("请先连接钱包")
      return false
    }

    setIsConnecting(true)
    setXmtpError(null)
    setRegistrationStatus("checking")
    try {
      // 从 wagmi walletClient 中提取底层纯净 provider，避免多钱包插件冲突
      const pureProvider = clientForSign.transport?.provider || clientForSign

      const signer = {
        type: "EOA" as const,
        getIdentifier: () => makeEthIdentifier(walletAddress),
        signMessage: async (message: string) => {
          console.log("[XMTP Debug] 正在拉起纯净 Provider 签名...")
          setRegistrationStatus("signature_pending")
          const messageHex = stringToHex(message)
          const sig = await pureProvider.request({
            method: "personal_sign",
            params: [messageHex, walletAddress.toLowerCase()],
          })
          console.log("[XMTP] 钱包签名已收到")
          return hexToBytes(sig)
        },
      }

      // 使用固定 dbPath（基于钱包地址），SDK 的 IndexedDB 会记住安装钥匙
      // 首次需要钱包签名注册；后续刷新秒级无感登录
      const client = await Client.create(signer, {
        env: "production",
        appVersion: "propamm/1.0",
        dbPath: `xmtp:${walletAddress.toLowerCase()}`,
      })
      console.log("[XMTP] Client.create 完毕！Inbox ID:", client.inboxId)

      clientRef.current = client
      setRegistrationStatus("ready")

      // Sync existing conversations
      const dms = await client.conversations.listDms()
      const now = Date.now()

      for (const dm of dms) {
        const peerInboxId = await dm.peerInboxId()
        const topic = dm.id
        dmMapRef.current.set(topic, dm)
        xmtpIdToTopicRef.current.set(topic, topic) // self-mapping for existing DMs
        topicPeerRef.current.set(topic, peerInboxId)

        // 后台异步解析 inbox ID → ETH 地址，不阻塞列表
        void backgroundResolveInbox(peerInboxId)

        const messages = await dm.messages()
        const lastMsg = messages[messages.length - 1]

        const convo: XmtpConversation = {
          topic,
          peerAddress: peerInboxId, // 临时用 inbox ID，后台解析后会通过 setConversations 刷新
          createdAt: now,
          lastMessageAt: lastMsg?.sentAtNs ? Number(lastMsg.sentAtNs) / 1e6 : now,
          preview: lastMsg?.content ? String(lastMsg.content) : "New conversation",
        }
        upsertConversation(convo)

        const mappedMsgs: XmtpMessage[] = messages.map((m) => ({
          id: m.id ?? randomId(),
          senderAddress: m.senderInboxId,
          sentAt: m.sentAtNs ? Number(m.sentAtNs) / 1e6 : now,
          content: (() => {
            const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content)
            const inquiry = tryDecodeInquiry(text)
            return inquiry
              ? { type: "order_inquiry" as const, inquiry }
              : { type: "text" as const, text }
          })(),
        }))
        setMessagesByTopic((prev) => ({ ...prev, [topic]: mappedMsgs }))
      }

      console.log("[XMTP] Loaded", dms.length, "existing DMs, starting stream...")

      const stream = await client.conversations.streamAllMessages({
        onValue: async (message: any) => {
          const xmtpConversationId = message.conversationId
          const senderInboxId = message.senderInboxId

          if (senderInboxId === client.inboxId) return

          const content = message.content
          const text = typeof content === "string" ? content : JSON.stringify(content)
          const inquiry = tryDecodeInquiry(text)

          // Resolve topic: use our custom topic if we have a mapping, else use XMTP ID
          const topic = xmtpIdToTopicRef.current.get(xmtpConversationId) ?? xmtpConversationId

          console.log("[XMTP] ← Stream received from", senderInboxId, "in", topic, "(xmtp:", xmtpConversationId, ")")

          // Auto-create conversation entry if this topic is new (A receiving B's first message)
          const existingConvo = conversations.find((c) => c.topic === topic)
          if (!existingConvo) {
            console.log("[XMTP] Auto-creating conversation for topic", topic)
            topicPeerRef.current.set(topic, senderInboxId)
            upsertConversation({
              topic,
              peerAddress: senderInboxId, // 临时，后台异步解析后会刷新
              createdAt: Date.now(),
              lastMessageAt: Date.now(),
              preview: inquiry
                ? `RFQ ${inquiry.asset} · ${inquiry.side}`
                : text.slice(0, 60),
            })
            ensureTopicMessages(topic)
          }

          appendMessage(topic, {
            id: message.id ?? randomId(),
            senderAddress: senderInboxId,
            sentAt: message.sentAtNs ? Number(message.sentAtNs) / 1e6 : Date.now(),
            content: inquiry
              ? { type: "order_inquiry", inquiry }
              : { type: "text", text },
          })

          // 后台异步解析 inbox ID → ETH 地址，不阻塞消息投递
          void backgroundResolveInbox(senderInboxId, topic)
        },
        onFail: () => {
          console.error("[XMTP] Stream failed")
        },
      })

      streamRef.current = stream
      setIsXmtpReady(true)
      console.log("[XMTP] ✓ Stream active, XMTP ready!")
      return true
    } catch (err: any) {
      console.error("[XMTP] ✗ Connect failed:", err)
      clientRef.current = null
      setIsXmtpReady(false)
      setRegistrationStatus("failed")

      // 判断是否是用户拒绝签名
      const msg = err?.message?.toLowerCase() || ""
      if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected")) {
        setXmtpError("首次使用需要签名以创建加密收件箱，您取消了签名。请点击按钮重试。")
      } else if (msg.includes("timeout") || msg.includes("timed out")) {
        setXmtpError("签名请求超时，请点击按钮重试。")
      } else {
        setXmtpError(err?.message || "XMTP 网络初始化失败，请检查网络后重试。")
      }
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [walletAddress, appendMessage, upsertConversation])

  useEffect(() => {
    return () => {
      streamRef.current?.end()
    }
  }, [])

  // ── Get or create DM (race-safe) ─────────────────────────────────
  const getOrCreateDm = useCallback(
    async (peerAddress: string): Promise<Dm> => {
      const client = clientRef.current
      if (!client) throw new Error("XMTP client not initialized — please wait for connection")

      const normalized = normalizeAddress(peerAddress)

      const existing = dmPendingRef.current.get(normalized)
      if (existing) return existing

      const promise = (async (): Promise<Dm> => {
        try {
          const identifier = makeEthIdentifier(normalized)

          const existingDm = await client.conversations.getDmByIdentifier(identifier)
          if (existingDm) {
            console.log("[XMTP] Found existing DM for", normalized, "→", existingDm.id)
            return existingDm
          }

          console.log("[XMTP] Creating new DM with", normalized)
          const dm = await client.conversations.newDmWithIdentifier(identifier)
          console.log("[XMTP] DM created:", dm.id)
          return dm
        } finally {
          dmPendingRef.current.delete(normalized)
        }
      })()

      dmPendingRef.current.set(normalized, promise)
      return promise
    },
    [],
  )

  const topicFor = (peerAddress: string, quoteId?: string) =>
    `${normalizeAddress(peerAddress)}${quoteId ? `:${quoteId}` : ""}`

  // ── Lookup peer address by topic ──────────────────────────────────
  const getPeerAddressByTopic = useCallback((topic: string) => {
    if (!topic) return ""
    const inboxId = topicPeerRef.current?.get(topic)
    if (!inboxId) return ""
    // 优先返回可读的以太坊地址
    const ethAddr = peerInboxToAddressRef.current.get(inboxId)
    return ethAddr || inboxId
  }, [])

  const getRoomIdByTopic = useCallback((topic: string) => {
    if (!topic) return null
    const dm = dmMapRef.current.get(topic)
    return dm?.id ?? null
  }, [])

  // ── Background inbox ID → ETH address resolution (fire & forget) ──
  const backgroundResolveInbox = async (inboxId: string, topic?: string) => {
    const client = clientRef.current
    if (!client) return

    // ── 解析 inbox ID → ETH 地址 ──
    if (!peerInboxToAddressRef.current.has(inboxId)) {
      try {
        const states = await client.preferences.inboxStateFromInboxIds([inboxId])
        const ethId = states[0]?.identifiers.find((i) => i.identifierKind === "Ethereum")
        if (ethId?.identifier) {
          const ethAddr = ethId.identifier.toLowerCase()
          peerInboxToAddressRef.current.set(inboxId, ethAddr)
          // 触发状态刷新，让 UI 把 peerAddress 从 inbox ID 更新为真实 ETH 地址
          setConversations((prev) =>
            prev.map((c) => (c.peerAddress === inboxId ? { ...c, peerAddress: ethAddr } : c)),
          )
        }
      } catch (e) {
        console.warn("[XMTP] Failed to resolve ETH address for inbox", inboxId, e)
      }
    }

    // ── 如果提供了 topic，在后台缓存 DM 到 dmMapRef（让房间号从 Connecting… 变为真实哈希）──
    if (topic && !dmMapRef.current.has(topic)) {
      try {
        const conv = await client.conversations.getConversationById(topic)
        if (conv) {
          const dm = conv as Dm
          dmMapRef.current.set(topic, dm)
          dmMapRef.current.set(dm.id, dm)
          xmtpIdToTopicRef.current.set(dm.id, topic)
          topicPeerRef.current.set(dm.id, inboxId)
          setConversations((prev) => [...prev])
        }
      } catch (e) {
        console.warn("[XMTP] Failed to cache DM for topic", topic, e)
      }
    }
  }

  // ── Open conversation ──────────────────────────────────────────────
  const openConversation = useCallback(
    (peerAddress: string, quoteId?: string) => {
      const topic = topicFor(peerAddress, quoteId)

      ensureTopicMessages(topic)
      topicPeerRef.current.set(topic, normalizeAddress(peerAddress))

      setConversations((prev) => {
        if (prev.some((c) => c.topic === topic)) return prev
        const now = Date.now()
        const convo: XmtpConversation = {
          topic,
          peerAddress: normalizeAddress(peerAddress),
          quoteId,
          createdAt: now,
          lastMessageAt: now,
          preview: "New conversation",
        }
        return [convo, ...prev]
      })

      if (clientRef.current && !dmMapRef.current.has(topic)) {
        getOrCreateDm(peerAddress)
          .then(async (dm) => {
            dmMapRef.current.set(topic, dm)
            dmMapRef.current.set(dm.id, dm)
            xmtpIdToTopicRef.current.set(dm.id, topic)
            // 建立 inboxId → 以太坊地址的反向映射
            const inboxId = await dm.peerInboxId()
            peerInboxToAddressRef.current.set(inboxId, normalizeAddress(peerAddress))
            // 同时用 inboxId 更新 topicPeerRef（两种 key 都能查到）
            topicPeerRef.current.set(dm.id, inboxId)
            topicPeerRef.current.set(topic, inboxId)
            console.log("[XMTP] DM cached for topic", topic, "→ dm.id:", dm.id, "→ peerInbox:", inboxId)
          })
          .catch((err) => {
            console.error("[XMTP] openConversation: failed to create DM:", err)
          })
      }

      return topic
    },
    [ensureTopicMessages, getOrCreateDm],
  )

  // ── Send text ──────────────────────────────────────────────────────
  const sendText = useCallback(
    (topic: string, text: string) => {
      if (!text.trim()) return

      appendMessage(topic, {
        id: randomId(),
        senderAddress: selfAddress.toLowerCase(),
        sentAt: Date.now(),
        content: { type: "text", text: text.trim() },
      })

      const doSend = async () => {
        try {
          if (!clientRef.current) return

          let dm = dmMapRef.current.get(topic)

          // 【核心修复】缓存未命中时，通过 topicPeerRef 现场恢复房间
          if (!dm) {
            const customTopic = xmtpIdToTopicRef.current.get(topic)
            if (customTopic) {
              dm = dmMapRef.current.get(customTopic)
            }
          }

          if (!dm) {
            const peerAddress = topicPeerRef.current.get(topic)
            if (peerAddress) {
              console.log("[XMTP 发送自愈] 缓存无此会话，正在现场为地址拉取真实房间:", peerAddress)
              try {
                dm = await clientRef.current.conversations.newDm(peerAddress)
              } catch {
                const identifier = { identifier: peerAddress.toLowerCase(), identifierKind: "Ethereum" as const }
                dm = await clientRef.current.conversations.newDmWithIdentifier(identifier)
              }
              dmMapRef.current.set(topic, dm)
              dmMapRef.current.set(dm.id, dm)
              xmtpIdToTopicRef.current.set(dm.id, topic)
            }
          }

          if (!dm) {
            console.error("[XMTP] sendText: 彻底找不到该 topic 对应的有效会话:", topic)
            return
          }

          console.log("[XMTP] → Sending text via DM", dm.id)
          await dm.send(text.trim())
          console.log("[XMTP] → Text sent!")
        } catch (err) {
          console.error("[XMTP Core Send Error]", err)
        }
      }
      doSend()
    },
    [appendMessage, selfAddress, getOrCreateDm],
  )

  // ── Send inquiry ──────────────────────────────────────────────────
  const sendInquiry = useCallback(
    (topic: string, inquiry: OrderInquiry) => {
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

      const doSend = async () => {
        try {
          if (!clientRef.current) return

          let dm = dmMapRef.current.get(topic)

          // 【核心修复】缓存未命中时，通过 topicPeerRef 现场恢复房间
          if (!dm) {
            const customTopic = xmtpIdToTopicRef.current.get(topic)
            if (customTopic) {
              dm = dmMapRef.current.get(customTopic)
            }
          }

          if (!dm) {
            const peerAddress = topicPeerRef.current.get(topic)
            if (peerAddress) {
              console.log("[XMTP 发送自愈] 缓存无此会话，正在现场为地址拉取真实房间:", peerAddress)
              try {
                dm = await clientRef.current.conversations.newDm(peerAddress)
              } catch {
                const identifier = { identifier: peerAddress.toLowerCase(), identifierKind: "Ethereum" as const }
                dm = await clientRef.current.conversations.newDmWithIdentifier(identifier)
              }
              dmMapRef.current.set(topic, dm)
              dmMapRef.current.set(dm.id, dm)
              xmtpIdToTopicRef.current.set(dm.id, topic)
            }
          }

          if (!dm) {
            console.error("[XMTP] sendInquiry: 彻底找不到该 topic 对应的有效会话:", topic)
            return
          }

          console.log("[XMTP] → Sending inquiry via DM", dm.id)
          await dm.send(body)
          console.log("[XMTP] → Inquiry sent!")
        } catch (err) {
          console.error("[XMTP Core Send Error]", err)
        }
      }
      doSend()
    },
    [appendMessage, selfAddress, getOrCreateDm],
  )

  return {
    isReady,
    isConnecting,
    registrationStatus,
    xmtpError,
    selfAddress,
    conversations,
    messagesByTopic,
    connect,
    clearError,
    getPeerAddressByTopic,
    getRoomIdByTopic,
    openConversation,
    sendText,
    sendInquiry,
  }
}
