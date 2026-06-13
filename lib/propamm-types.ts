export type TokenSymbol = "ETH" | "USDC" | "WBTC" | "DAI" | "SOL" | "ARB" | "USDT" | "WETH"

export interface Token {
  symbol: TokenSymbol | string
  name: string
  price: number
  address?: string
  decimals?: number
}

export const TOKENS: Token[] = [
  { symbol: "ETH", name: "Ethereum", price: 3120.42 },
  { symbol: "USDC", name: "USD Coin", price: 1.0 },
  { symbol: "WBTC", name: "Wrapped Bitcoin", price: 64210.18 },
  { symbol: "DAI", name: "Dai Stablecoin", price: 1.0 },
  { symbol: "SOL", name: "Solana", price: 182.55 },
  { symbol: "ARB", name: "Arbitrum", price: 0.92 },
]

export function getToken(symbol: string): Token {
  return TOKENS.find((t) => t.symbol === symbol) ?? TOKENS[0]
}

export interface Quote {
  id: string
  proposer: string
  // output amount of tokenOut
  amountOut: number
  // price impact in basis points
  priceImpactBps: number
  // proposer fee in basis points
  feeBps: number
  // estimated fill latency in ms
  latencyMs: number
}

export type OptionSide = "call" | "put"

export interface OptionQuote {
  id: string
  proposer: string
  // premium per contract, denominated in the quote/settlement asset (USDC)
  premium: number
  // implied volatility in percent
  ivPct: number
  // proposer fee in basis points
  feeBps: number
  // estimated fill latency in ms
  latencyMs: number
}

export type FeedKind = "intent" | "memo"

export interface FeedEntry {
  id: string
  kind: FeedKind
  timestamp: number
  // for intent
  proposer?: string
  tokenIn?: TokenSymbol
  tokenOut?: TokenSymbol
  amountIn?: number
  // shared
  message: string
}
