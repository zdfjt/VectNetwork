import { createConfig } from "wagmi"
import { mainnet, arbitrum } from "wagmi/chains"
import { injected, metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors"
import { http } from "viem"
// 生产环境用 custom(window.ethereum) 替换 http 以使用钱包注入的 provider
// import { custom } from "viem"
// const ethProvider = typeof window !== "undefined" ? (window as any).ethereum : undefined

const sepolia = {
  id: 31337,
  name: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.intentflow.trade/"] },
    public: { http: ["https://rpc.intentflow.trade/"] },
  },
} as const

declare module "wagmi" {
  interface Register {
    config: typeof config
  }
}

export const config = createConfig({
  chains: [sepolia, mainnet, arbitrum],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({ appName: "PropAMM" }),
    walletConnect({
      projectId: "000000000000000000000000000000000000",
    }),
  ],
  transports: {
    [sepolia.id]: http("https://rpc.intentflow.trade/"),
    [mainnet.id]: http("https://rpc.intentflow.trade/"),
    [arbitrum.id]: http("https://rpc.intentflow.trade/"),
    // 生产环境（正式上线）切换到 wallet 注入的 provider：
    // [sepolia.id]: custom(ethProvider),
    // [mainnet.id]: custom(ethProvider),
    // [arbitrum.id]: custom(ethProvider),
  },
})
