export interface OtcRfq {
  dex: string
  requester: string
  assetSell: string
  assetBuy: string
  amountSell: string
  amountBuy: string
  deadline: number
  chainId: number
  message: string
  taker: string
}

export interface Intent {
  protocolId: string
  version: number
  intentType: number
  execMode: number
  nonce: string
  deadline: number
  maker: string
  recipient: string
  payload: string
  signature: string
}

export interface StreamMessage extends Intent {
  receivedAt: number
  chainId: number
  parsedPayload?: OtcRfq
}

export interface RfqParams {
  dexAddress: string
  requester: string
  assetSellAddress: string
  assetBuyAddress: string
  amountSell: string
  amountBuy?: string
  taker?: string
  chainId: number
  message: string
  deadlineMinutes?: number
}

function generateNonce(): string {
  const arr = new Uint8Array(6)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function buildRfq(params: RfqParams): OtcRfq {
  return {
    dex: params.dexAddress,
    requester: params.requester,
    assetSell: params.assetSellAddress,
    assetBuy: params.assetBuyAddress,
    amountSell: params.amountSell,
    amountBuy: params.amountBuy || "0",
    deadline: params.deadlineMinutes
      ? Math.floor(Date.now() / 1000) + params.deadlineMinutes * 60
      : 1900000000,
    chainId: params.chainId,
    message: params.message,
    taker: params.taker || "0x0000000000000000000000000000000000000000",
  }
}

export function buildIntent(rfq: OtcRfq, maker: string): Intent {
  return {
    protocolId: "test",
    version: 1,
    intentType: 0,
    execMode: 0,
    nonce: generateNonce(),
    deadline: rfq.deadline,
    maker,
    recipient: rfq.taker,
    payload: JSON.stringify(rfq),
    signature: "0x00",
  }
}

export function parseStreamMessage(raw: string): StreamMessage {
  const msg = JSON.parse(raw) as StreamMessage
  try {
    msg.parsedPayload = JSON.parse(msg.payload)
  } catch {
    // payload may not be JSON in some edge cases
  }
  return msg
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error"

export interface StreamOptions {
  url: string
  onMessage: (msg: StreamMessage) => void
  onStateChange: (state: ConnectionState) => void
}

export function createQuoteStream(options: StreamOptions) {
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  function connect() {
    if (closed) return
    options.onStateChange("connecting")

    try {
      ws = new WebSocket(options.url)
    } catch {
      options.onStateChange("error")
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      options.onStateChange("connected")
      try {
        ws!.send(JSON.stringify({ protocolId: "test" }))
      } catch {
        // ignore
      }
    }

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data)
        if (raw.type === "heartbeat") return

        const msg = parseStreamMessage(event.data)
        options.onMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (!closed) {
        options.onStateChange("disconnected")
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      options.onStateChange("error")
    }
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 3000)
  }

  function close() {
    closed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
  }

  connect()

  return { close }
}

export async function submitIntent(
  intent: Intent,
  endpoint: string,
): Promise<{ ok: boolean; status: number; body?: unknown }> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intent),
    })
    const body = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    return { ok: false, status: 0, body: String(err) }
  }
}
