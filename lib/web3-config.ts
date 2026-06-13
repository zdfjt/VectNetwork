import { createConfig } from "wagmi"
import { mainnet, arbitrum, sepolia } from "wagmi/chains"
import { injected, metaMask, walletConnect, coinbaseWallet } from "wagmi/connectors"
import { http } from "viem"

/**
 * NOTE on RPC usage:
 * All on-chain reads (quoteV1 / quoteVenueV1 simulations) and writes (swapV1,
 * approvals) go through the CONNECTED WALLET'S RPC via `useReadClient` /
 * `useWalletClient`. We no longer hardcode a custom RPC endpoint here.
 *
 * The `http()` transports below (with no URL) only provide a sensible default
 * public endpoint for the brief window before a wallet is connected. Once the
 * user connects, the wallet's own provider becomes the source of truth for
 * whichever network it is pointed at.
 */

declare module "wagmi" {
  interface Register {
    config: typeof config
  }
}

export const config = createConfig({
  chains: [mainnet, arbitrum, sepolia],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({ appName: "PropAMM" }),
    walletConnect({
      projectId: "000000000000000000000000000000000000",
    }),
  ],
  transports: {
    // No hardcoded URL — defaults to each chain's public RPC. Reads/writes
    // after wallet connection use the wallet's injected provider instead.
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [sepolia.id]: http(),
  },
})
