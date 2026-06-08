import type { OptionQuote, OptionSide, Quote, Token } from "./propamm-types"

const PROPOSERS = ["0xA3F1", "0x7C2e", "0xBe09", "0x14dd", "0xF8a2", "0x9b31"]

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Generates a set of competing quotes from different proposers
 * for a given input amount, tokenIn and tokenOut.
 */
export function generateQuotes(
  amountIn: number,
  tokenIn: Token,
  tokenOut: Token,
): Quote[] {
  if (!amountIn || amountIn <= 0) return []

  const fairOut = (amountIn * tokenIn.price) / tokenOut.price
  const count = 3 + Math.floor(Math.random() * 2) // 3-4 quotes

  const proposers = [...PROPOSERS].sort(() => Math.random() - 0.5).slice(0, count)

  return proposers
    .map((proposer) => {
      const feeBps = Math.floor(Math.random() * 25) + 5 // 5-30 bps
      const priceImpactBps = Math.floor(Math.random() * 40) + 2 // 2-42 bps
      const slip = 1 - (feeBps + priceImpactBps) / 10000
      const noise = 1 + (Math.random() - 0.5) * 0.004
      return {
        id: randomId(),
        proposer,
        amountOut: fairOut * slip * noise,
        priceImpactBps,
        feeBps,
        latencyMs: Math.floor(Math.random() * 240) + 40,
      } satisfies Quote
    })
    .sort((a, b) => b.amountOut - a.amountOut)
}

export function formatAmount(n: number): string {
  if (n === 0) return "0"
  if (n < 0.0001) return n.toExponential(2)
  if (n < 1) return n.toFixed(6)
  if (n < 1000) return n.toFixed(4)
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

/** Standard normal CDF via Abramowitz-Stegun approximation. */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  // tail probability for |x|, i.e. 1 - N(|x|)
  const tail =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - tail : tail
}

/** Black-Scholes premium estimate used to seed proposer option quotes. */
function blackScholes(
  side: OptionSide,
  spot: number,
  strike: number,
  tYears: number,
  vol: number,
): number {
  if (tYears <= 0 || spot <= 0 || strike <= 0) {
    const intrinsic = side === "call" ? spot - strike : strike - spot
    return Math.max(intrinsic, 0)
  }
  const r = 0.04
  const d1 =
    (Math.log(spot / strike) + (r + (vol * vol) / 2) * tYears) /
    (vol * Math.sqrt(tYears))
  const d2 = d1 - vol * Math.sqrt(tYears)
  if (side === "call") {
    return spot * normCdf(d1) - strike * Math.exp(-r * tYears) * normCdf(d2)
  }
  return strike * Math.exp(-r * tYears) * normCdf(-d2) - spot * normCdf(-d1)
}

/**
 * Generates competing option quotes from different proposers for a given
 * underlying, side, strike (settlement price), expiry and contract size.
 */
export function generateOptionQuotes(
  side: OptionSide,
  underlying: Token,
  strike: number,
  expiryMs: number,
  contracts: number,
): OptionQuote[] {
  if (!strike || strike <= 0 || !contracts || contracts <= 0) return []

  const tYears = Math.max((expiryMs - Date.now()) / (365 * 24 * 3600 * 1000), 0)
  const count = 3 + Math.floor(Math.random() * 2) // 3-4 quotes
  const proposers = [...PROPOSERS].sort(() => Math.random() - 0.5).slice(0, count)

  return proposers
    .map((proposer) => {
      const ivPct = 45 + (Math.random() - 0.5) * 30 // 30%-60% IV
      const base = blackScholes(
        side,
        underlying.price,
        strike,
        tYears,
        ivPct / 100,
      )
      const feeBps = Math.floor(Math.random() * 25) + 5 // 5-30 bps
      const noise = 1 + (Math.random() - 0.5) * 0.05
      const premium = base * (1 + feeBps / 10000) * noise * contracts
      return {
        id: randomId(),
        proposer,
        premium: Math.max(premium, 0),
        ivPct,
        feeBps,
        latencyMs: Math.floor(Math.random() * 240) + 40,
      } satisfies OptionQuote
    })
    // best = cheapest premium for the buyer
    .sort((a, b) => a.premium - b.premium)
}
