import type { FeedEntry, TokenSymbol } from "./propamm-types"
import { TOKENS } from "./propamm-types"

const PROPOSERS = [
  "0xA3F1", "0x7C2e", "0xBe09", "0x14dd", "0xF8a2",
  "0x9b31", "0x5e7C", "0x2D4f", "0xCa88", "0x6071",
]

const MEMO_TEMPLATES = [
  "routing via internal book, depth ok",
  "matched against resting proposer order",
  "partial fill rebalanced to backup path",
  "spread tightened, requote in 200ms",
  "solver bond posted, awaiting settlement",
  "intent expired, recycling liquidity",
  "cross-domain hint detected",
  "MEV guard active — protected route",
]

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function makeIntent(): FeedEntry {
  let tokenIn = rand(TOKENS).symbol
  let tokenOut = rand(TOKENS).symbol
  while (tokenOut === tokenIn) tokenOut = rand(TOKENS).symbol
  const amountIn = Number((Math.random() * 50 + 0.1).toFixed(3))
  return {
    id: randomId(),
    kind: "intent",
    timestamp: Date.now(),
    proposer: rand(PROPOSERS),
    tokenIn: tokenIn as TokenSymbol,
    tokenOut: tokenOut as TokenSymbol,
    amountIn,
    message: `swap ${amountIn} ${tokenIn} → ${tokenOut}`,
  }
}

function makeMemo(): FeedEntry {
  return {
    id: randomId(),
    kind: "memo",
    timestamp: Date.now(),
    message: rand(MEMO_TEMPLATES),
  }
}

/**
 * Simulates a WebSocket stream of intent broadcasts.
 * Emits an intent, frequently followed by one or more memos.
 */
export function createFeedStream(onMessage: (entry: FeedEntry) => void) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout>

  const tick = () => {
    if (stopped) return
    onMessage(makeIntent())

    // chance to emit follow-up memos tied to the intent
    const memoCount = Math.random() < 0.7 ? (Math.random() < 0.4 ? 2 : 1) : 0
    for (let i = 0; i < memoCount; i++) {
      setTimeout(() => {
        if (!stopped) onMessage(makeMemo())
      }, 250 * (i + 1))
    }

    timer = setTimeout(tick, 900 + Math.random() * 1600)
  }

  // kick off quickly so the feed looks alive on mount
  timer = setTimeout(tick, 300)

  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

/** Seed entries so the terminal isn't empty on first paint. */
export function seedFeed(count = 8): FeedEntry[] {
  const entries: FeedEntry[] = []
  let t = Date.now() - count * 1100
  for (let i = 0; i < count; i++) {
    const entry = Math.random() < 0.65 ? makeIntent() : makeMemo()
    entry.timestamp = t
    entry.id = randomId()
    entries.push(entry)
    t += 900 + Math.random() * 600
  }
  return entries
}
