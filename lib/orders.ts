import { TOKENS, type TokenSymbol } from "./propamm-types"

export type OrderInstrument = "token" | "option"
export type OrderDirection = "buy" | "sell"
export type OptionLeg = "call" | "put"

export interface OpenOrder {
  id: string
  // who posted the order
  maker: string
  instrument: OrderInstrument
  direction: OrderDirection
  // underlying / traded asset
  asset: TokenSymbol
  // quantity of the asset (tokens) or number of contracts (option)
  quantity: number
  // total order value in USD that the taker pays / receives
  notionalUsd: number
  // unit price in USD (per token or per contract premium)
  unitPriceUsd: number
  // option-specific
  optionLeg?: OptionLeg
  strikeUsd?: number
  optionExpiry?: number
  // when the order itself expires (no longer fillable)
  orderExpiry: number
  createdAt: number
  // settlement asset
  settlement: TokenSymbol
}

const MAKERS = [
  "0xA3F1",
  "0x7C2e",
  "0xBe09",
  "0x14dd",
  "0xF8a2",
  "0x9b31",
  "0xC0de",
  "0x4Eb7",
  "0xD2a9",
]

const ASSETS: TokenSymbol[] = ["ETH", "WBTC", "SOL", "ARB"]

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function priceOf(symbol: TokenSymbol): number {
  return TOKENS.find((t) => t.symbol === symbol)?.price ?? 1
}

function makeOrder(): OpenOrder {
  const instrument: OrderInstrument = Math.random() > 0.45 ? "option" : "token"
  const direction: OrderDirection = Math.random() > 0.5 ? "buy" : "sell"
  const asset = pick(ASSETS)
  const spot = priceOf(asset)
  const now = Date.now()
  // order is fillable for the next 30s - 6h
  const orderExpiry = now + (30_000 + Math.random() * 6 * 3600_000)
  const createdAt = now - Math.random() * 90_000

  if (instrument === "option") {
    const leg: OptionLeg = Math.random() > 0.5 ? "call" : "put"
    const contracts = Math.ceil(Math.random() * 25)
    // strike within +-20% of spot
    const strikeUsd = Number((spot * (0.8 + Math.random() * 0.4)).toFixed(spot < 10 ? 3 : 0))
    const optionExpiry = now + (1 + Math.floor(Math.random() * 45)) * 86_400_000
    // rough premium: 1.5% - 7% of spot per contract
    const unitPriceUsd = Number((spot * (0.015 + Math.random() * 0.055)).toFixed(2))
    return {
      id: randomId(),
      maker: pick(MAKERS),
      instrument,
      direction,
      asset,
      quantity: contracts,
      unitPriceUsd,
      notionalUsd: Number((unitPriceUsd * contracts).toFixed(2)),
      optionLeg: leg,
      strikeUsd,
      optionExpiry,
      orderExpiry,
      createdAt,
      settlement: "USDC",
    }
  }

  // token spot order
  const decimals = spot < 10 ? 0 : 4
  const quantity = Number(
    (spot < 10 ? 500 + Math.random() * 9000 : 0.2 + Math.random() * 12).toFixed(decimals),
  )
  // unit price within +-1.5% of spot
  const unitPriceUsd = Number((spot * (0.985 + Math.random() * 0.03)).toFixed(spot < 10 ? 4 : 2))
  return {
    id: randomId(),
    maker: pick(MAKERS),
    instrument,
    direction,
    asset,
    quantity,
    unitPriceUsd,
    notionalUsd: Number((unitPriceUsd * quantity).toFixed(2)),
    orderExpiry,
    createdAt,
    settlement: "USDC",
  }
}

/** Seed a list of mock open orders posted by other makers. */
export function generateOpenOrders(count = 14): OpenOrder[] {
  return Array.from({ length: count }, makeOrder).sort(
    (a, b) => b.createdAt - a.createdAt,
  )
}

export const ORDER_ASSETS = ASSETS
