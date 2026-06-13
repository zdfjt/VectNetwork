export const ETH_ADDRESS = "0x0000000000000000000000000000000000000000"

export interface TokenConfig {
  symbol: string
  name: string
  address: string
  decimals: number
  price: number
}

export interface ChainConfig {
  chainId: number
  name: string
  dexAddress: string
  tokens: TokenConfig[]
}

// ========== 在这里配置你的链和代币 ==========
export const CHAINS: Record<number, ChainConfig> = {
  1: {
    chainId: 1,
    name: "Ethereum",
    dexAddress: "0x4ddf368080cd7946db5b459ad591c350158175e1",
    tokens: [
      { symbol: "ETH", name: "Ether", address: ETH_ADDRESS, decimals: 18, price: 3120.42 },
      { symbol: "WETH", name: "Wrapped Ether", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, price: 3120.42 },
      { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, price: 1.0 },
      { symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, price: 1.0 },
      { symbol: "DAI", name: "Dai Stablecoin", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, price: 1.0 },
      { symbol: "WBTC", name: "Wrapped BTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, price: 64210.18 },
      { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, price: 7.85 },
      { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, price: 14.2 },
      { symbol: "PEPE", name: "Pepe", address: "0x6982508145454Ce325dDbE47a25d4f3d2060356c", decimals: 18, price: 0.0000098 },
    ],
  },
  31337: {
    chainId: 31337,
    name: "Sepolia",
    dexAddress: "0xaF3F6F1F71DF9665e1d4df0C89b14Ac3a1F6588d",
    tokens: [
      { symbol: "ETH", name: "Ether", address: ETH_ADDRESS, decimals: 18, price: 3120.42 },
      { symbol: "WETH", name: "Wrapped Ether", address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", decimals: 18, price: 3120.42 },
      { symbol: "USDC", name: "USD Coin", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6, price: 1.0 },
      { symbol: "USDT", name: "Tether USD", address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", decimals: 6, price: 1.0 },
      { symbol: "DAI", name: "Dai Stablecoin", address: "0x5C221E77624690fff6dd741493D04a6e7aB8De2b", decimals: 18, price: 1.0 },
      { symbol: "WBTC", name: "Wrapped BTC", address: "0x29f2D40B0602D4d86F7FE75784b4932C1DdB2bB5", decimals: 8, price: 64210.18 },
    ],
  },
}

export function getTokensByChain(chainId: number): TokenConfig[] {
  return CHAINS[chainId]?.tokens ?? CHAINS[31337].tokens
}

export function getChainConfig(chainId: number): ChainConfig {
  return CHAINS[chainId] ?? CHAINS[31337]
}

export function findTokenByAddress(chainId: number, address: string): TokenConfig | undefined {
  return getTokensByChain(chainId).find(
    (t) => t.address.toLowerCase() === address.toLowerCase(),
  )
}

export function findTokenBySymbol(chainId: number, symbol: string): TokenConfig | undefined {
  return getTokensByChain(chainId).find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase(),
  )
}
