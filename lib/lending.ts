import { TOKENS, type TokenSymbol } from "./propamm-types"

export type LoanDirection = "lend" | "borrow"

/** An open loan offer posted by a maker (lender or borrower). */
export interface LoanOffer {
  id: string
  maker: string
  // "lend" = maker supplies the asset, "borrow" = maker wants to borrow it
  direction: LoanDirection
  // the asset being lent / borrowed
  asset: TokenSymbol
  // principal amount of the asset
  principal: number
  // principal value in USD
  principalUsd: number
  // annual percentage rate offered, in percent
  aprPct: number
  // loan term in days
  termDays: number
  // collateral asset the borrower must post
  collateral: TokenSymbol
  // loan-to-value ratio in percent (max borrow vs collateral value)
  ltvPct: number
  // when the offer stops being fillable
  offerExpiry: number
  createdAt: number
}

/** A price-less request for a loan — makers quote an APR. */
export interface LendingRfq {
  id: string
  requester: string
  // the side the requester wants (you quote the opposite)
  direction: LoanDirection
  asset: TokenSymbol
  principal: number
  principalUsd: number
  termDays: number
  collateral: TokenSymbol
  ltvPct: number
  // when the RFQ stops accepting quotes
  rfqExpiry: number
  createdAt: number
  // how many makers have already quoted an APR
  competingQuotes: number
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
]

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

// assets that can be borrowed / lent
const LOAN_ASSETS: TokenSymbol[] = ["USDC", "DAI", "ETH", "WBTC"]
// assets accepted as collateral
const COLLATERAL_ASSETS: TokenSymbol[] = ["ETH", "WBTC", "SOL", "ARB"]
const TERMS = [7, 14, 30, 60, 90]

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function priceOf(symbol: TokenSymbol): number {
  return TOKENS.find((t) => t.symbol === symbol)?.price ?? 1
}

function principalForAsset(asset: TokenSymbol): { amount: number; usd: number } {
  const price = priceOf(asset)
  const decimals = price < 10 ? 0 : 4
  const amount = Number(
    (price < 10 ? 1000 + Math.random() * 50_000 : 0.5 + Math.random() * 20).toFixed(decimals),
  )
  return { amount, usd: Number((amount * price).toFixed(2)) }
}

function makeLoanOffer(): LoanOffer {
  const direction: LoanDirection = Math.random() > 0.5 ? "lend" : "borrow"
  const asset = pick(LOAN_ASSETS)
  const { amount, usd } = principalForAsset(asset)
  const now = Date.now()
  const offerExpiry = now + (30_000 + Math.random() * 6 * 3600_000)
  return {
    id: randomId(),
    maker: pick(MAKERS),
    direction,
    asset,
    principal: amount,
    principalUsd: usd,
    aprPct: Number((2 + Math.random() * 18).toFixed(2)),
    termDays: pick(TERMS),
    collateral: pick(COLLATERAL_ASSETS),
    ltvPct: Number((40 + Math.random() * 35).toFixed(0)),
    offerExpiry,
    createdAt: now - Math.random() * 90_000,
  }
}

function makeLendingRfq(): LendingRfq {
  const direction: LoanDirection = Math.random() > 0.5 ? "lend" : "borrow"
  const asset = pick(LOAN_ASSETS)
  const { amount, usd } = principalForAsset(asset)
  const now = Date.now()
  return {
    id: randomId(),
    requester: pick(REQUESTERS),
    direction,
    asset,
    principal: amount,
    principalUsd: usd,
    termDays: pick(TERMS),
    collateral: pick(COLLATERAL_ASSETS),
    ltvPct: Number((40 + Math.random() * 35).toFixed(0)),
    rfqExpiry: now + (20_000 + Math.random() * 4 * 3600_000),
    createdAt: now - Math.random() * 60_000,
    competingQuotes: Math.floor(Math.random() * 5),
  }
}

/** Seed a list of mock open loan offers. */
export function generateLoanOffers(count = 12): LoanOffer[] {
  return Array.from({ length: count }, makeLoanOffer).sort(
    (a, b) => b.createdAt - a.createdAt,
  )
}

/** Seed a list of mock lending RFQs. */
export function generateLendingRfqs(count = 12): LendingRfq[] {
  return Array.from({ length: count }, makeLendingRfq).sort(
    (a, b) => b.createdAt - a.createdAt,
  )
}

/** A reference APR used to suggest a starting quote. */
export function suggestApr(rfq: LendingRfq): number {
  // base rate scaled lightly by term and LTV
  const base = 4 + (rfq.termDays / 90) * 4 + (rfq.ltvPct / 100) * 6
  return Number(base.toFixed(2))
}

/** Simple interest accrued over the term for a given principal & APR. */
export function accruedInterest(principalUsd: number, aprPct: number, termDays: number): number {
  return Number(((principalUsd * (aprPct / 100) * termDays) / 365).toFixed(2))
}

/** Generate proposer APR quotes for a borrow/lend intent (best first). */
export interface LendingQuote {
  id: string
  proposer: string
  aprPct: number
  // proposer fee in basis points
  feeBps: number
  // estimated fill latency in ms
  latencyMs: number
}

export function generateLendingQuotes(
  direction: LoanDirection,
  termDays: number,
  ltvPct: number,
): LendingQuote[] {
  const count = 3 + Math.floor(Math.random() * 3)
  const base = 4 + (termDays / 90) * 4 + (ltvPct / 100) * 6
  const quotes: LendingQuote[] = Array.from({ length: count }, () => ({
    id: randomId(),
    proposer: pick(MAKERS),
    aprPct: Number((base + (Math.random() - 0.5) * 4).toFixed(2)),
    feeBps: Math.floor(2 + Math.random() * 18),
    latencyMs: Math.floor(120 + Math.random() * 600),
  }))
  // borrowers want the lowest APR, lenders want the highest
  quotes.sort((a, b) => (direction === "borrow" ? a.aprPct - b.aprPct : b.aprPct - a.aprPct))
  return quotes
}

export const LOAN_MARKET_ASSETS = LOAN_ASSETS
export const LOAN_COLLATERAL_ASSETS = COLLATERAL_ASSETS
export const LOAN_TERMS = TERMS
