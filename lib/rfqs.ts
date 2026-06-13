import { TOKENS, type TokenSymbol } from "./propamm-types"
import type { OptionLeg, OrderDirection, OrderInstrument } from "./orders"

export interface Rfq {
  id: string
  // who requested the quote (truncated for display)
  requester: string
  // full wallet address for XMTP operations
  makerAddress?: string
  instrument: OrderInstrument
  // the side the requester wants to take (you quote the opposite)
  side: OrderDirection
  asset: TokenSymbol
  assetAddress?: string
  // quantity of tokens or number of option contracts
  quantity: number
  // option-specific attributes (no price — that's what you quote)
  optionLeg?: OptionLeg
  strikeUsd?: number
  optionExpiry?: number
  // when the RFQ stops accepting quotes
  rfqExpiry: number
  createdAt: number
  // settlement asset
  settlement: TokenSymbol
  settlementAddress?: string
  // how many makers have already quoted
  competingQuotes: number
  // human-readable intent message
  message?: string
}

const REQUESTERS = [
  "0x5D1a",
  "0xE7b3",
  "0x22Ff",
  "0x8Ac4",
  "0x3f90",
  "0xB6e1",
  "0x0d77",
  "0xAA52",
]

const ASSETS: TokenSymbol[] = ["ETH", "WBTC", "SOL", "ARB"]

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function priceOf(symbol: TokenSymbol): number {
  return TOKENS.find((t) => t.symbol === symbol)?.price ?? 1
}

function makeRfq(): Rfq {
  const instrument: OrderInstrument = Math.random() > 0.45 ? "option" : "token"
  const side: OrderDirection = Math.random() > 0.5 ? "buy" : "sell"
  const asset = pick(ASSETS)
  const spot = priceOf(asset)
  const now = Date.now()
  // quotes accepted for the next 20s - 4h
  const rfqExpiry = now + (20_000 + Math.random() * 4 * 3600_000)
  const createdAt = now - Math.random() * 60_000
  const competingQuotes = Math.floor(Math.random() * 5)

  if (instrument === "option") {
    const leg: OptionLeg = Math.random() > 0.5 ? "call" : "put"
    const contracts = Math.ceil(Math.random() * 25)
    const strikeUsd = Number(
      (spot * (0.8 + Math.random() * 0.4)).toFixed(spot < 10 ? 3 : 0),
    )
    const optionExpiry = now + (1 + Math.floor(Math.random() * 45)) * 86_400_000
    return {
      id: randomId(),
      requester: pick(REQUESTERS),
      instrument,
      side,
      asset,
      quantity: contracts,
      optionLeg: leg,
      strikeUsd,
      optionExpiry,
      rfqExpiry,
      createdAt,
      settlement: "USDC",
      competingQuotes,
    }
  }

  const decimals = spot < 10 ? 0 : 4
  const quantity = Number(
    (spot < 10 ? 500 + Math.random() * 9000 : 0.2 + Math.random() * 12).toFixed(
      decimals,
    ),
  )
  return {
    id: randomId(),
    requester: pick(REQUESTERS),
    instrument,
    side,
    asset,
    quantity,
    rfqExpiry,
    createdAt,
    settlement: "USDC",
    competingQuotes,
  }
}

/** Seed a list of mock RFQs (price-less requests) posted by other traders. */
export function generateRfqs(count = 12): Rfq[] {
  return Array.from({ length: count }, makeRfq).sort(
    (a, b) => b.createdAt - a.createdAt,
  )
}

/** A reference mid price used to suggest a starting quote. */
export function suggestUnitPrice(rfq: Rfq): number {
  const spot = priceOf(rfq.asset)
  if (rfq.instrument === "option") {
    // rough premium per contract: 1.5% - 7% of spot
    return Number((spot * 0.035).toFixed(2))
  }
  return Number(spot.toFixed(spot < 10 ? 4 : 2))
}

export const RFQ_ASSETS = ASSETS
