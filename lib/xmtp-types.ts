import type { TokenSymbol } from "./propamm-types"
import type { OrderDirection, OrderInstrument } from "./orders"

/**
 * XMTP message model for the OTC desk.
 *
 * Uses real `@xmtp/browser-sdk` (v5) transport.
 * Inquiry payloads are JSON-encoded as text messages.
 */

/** The structured trade context attached to an "I want to chat about this RFQ" message. */
export interface OrderInquiry {
  kind: "ORDER_INQUIRY"
  version: 1
  /** RFQ / quote id this conversation is negotiating. */
  quoteId: string
  instrument: OrderInstrument
  /** The side the requester wants to take (you, the maker, quote the opposite). */
  side: OrderDirection
  asset: TokenSymbol
  quantity: number
  settlement: TokenSymbol
  /** Indicative price the initiator is proposing (token px or option premium). */
  proposedPrice?: number
  /** Option-only context. */
  strikeUsd?: number
  optionExpiry?: number
  /** Free-form note from the initiator. */
  note?: string
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "order_inquiry"; inquiry: OrderInquiry }

export interface XmtpMessage {
  id: string
  /** Wallet address (lowercased) of the sender. */
  senderAddress: string
  /** ms epoch. */
  sentAt: number
  content: MessageContent
}

export interface XmtpConversation {
  /** Topic / conversation id. For mock we derive it from the peer address + quote. */
  topic: string
  /** The counterparty wallet address. */
  peerAddress: string
  /** Optional RFQ this conversation was spawned from. */
  quoteId?: string
  createdAt: number
  lastMessageAt: number
  /** Preview of the most recent message for the conversation list. */
  preview: string
}

/** Build the canonical ORDER_INQUIRY message content from an RFQ-like object. */
export function buildOrderInquiry(input: {
  quoteId: string
  instrument: OrderInstrument
  side: OrderDirection
  asset: TokenSymbol
  quantity: number
  settlement: TokenSymbol
  proposedPrice?: number
  strikeUsd?: number
  optionExpiry?: number
  note?: string
}): OrderInquiry {
  return {
    kind: "ORDER_INQUIRY",
    version: 1,
    ...input,
  }
}

/**
 * Serialize the on-wire form. With the real SDK this becomes the message body.
 * TODO(xmtp): replace with `conversation.send(content, { contentType: ContentTypeOrderInquiry })`.
 */
export function encodeInquiry(inquiry: OrderInquiry): string {
  return JSON.stringify(inquiry)
}

/** Parse an inbound text body into an inquiry if it matches our schema. */
export function tryDecodeInquiry(body: string): OrderInquiry | null {
  try {
    const parsed = JSON.parse(body)
    if (parsed && parsed.kind === "ORDER_INQUIRY") return parsed as OrderInquiry
  } catch {
    // not JSON, treat as plain text
  }
  return null
}
