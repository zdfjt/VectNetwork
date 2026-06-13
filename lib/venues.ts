// Venue registry for the PropAMMRouter.
//
// Venues are plain addresses on-chain (not an enum). The router whitelists a set
// of proprietary AMMs (Fermi, Kipseli, Bebop) and uses Uniswap V3 as the public
// "fallback" venue when a proprietary venue cannot fill. These addresses come from
// the contract repo's setup script (scripts/setupRouterVariables.s.sol) and the
// venue interface constants.

export type VenueKind = "propamm" | "fallback" | "unknown"

export type VenueInfo = {
  key: string
  name: string
  /** Short tagline shown in the UI. */
  blurb: string
  kind: VenueKind
  /** Tailwind classes for the badge accent. */
  accent: string
}

// Lowercased address -> venue metadata.
export const KNOWN_VENUES: Record<string, VenueInfo> = {
  "0xb1076fe3ab5e28005c7c323bac5ac06a680d452e": {
    key: "fermi",
    name: "FermiSwap",
    blurb: "Proprietary market maker",
    kind: "propamm",
    accent: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  },
  "0x71e790dd841c8a9061487cb3e78c288e75ce0b3d": {
    key: "kipseli",
    name: "Kipseli",
    blurb: "Proprietary market maker",
    kind: "propamm",
    accent: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  },
  "0x160141a205f5ddcf096ba3f48b7ed21eb52c62ea": {
    key: "bebop",
    name: "Bebop",
    blurb: "Proprietary market maker",
    kind: "propamm",
    accent: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
}

// The proprietary venues we ask the router to quote individually.
export const PROPAMM_VENUE_ADDRESSES = Object.keys(KNOWN_VENUES) as `0x${string}`[]

// Uniswap V3 public fallback. The router exposes it as the fallback venue; any
// executed/quoted venue address that is not a known propAMM is treated as the
// Uniswap V3 fallback.
const UNISWAP_FALLBACK: VenueInfo = {
  key: "uniswap-v3",
  name: "Uniswap V3",
  blurb: "Public fallback venue",
  kind: "fallback",
  accent: "text-pink-400 bg-pink-500/10 border-pink-500/30",
}

/**
 * Resolve a venue address (as returned by quoteV1 / swapV1) to display metadata.
 * Unknown addresses are assumed to be the Uniswap V3 public fallback, since the
 * router only ever returns a whitelisted propAMM or the fallback address.
 */
export function resolveVenue(address?: string | null): VenueInfo {
  if (!address) return UNISWAP_FALLBACK
  const known = KNOWN_VENUES[address.toLowerCase()]
  if (known) return known
  return { ...UNISWAP_FALLBACK, key: `fallback-${address.toLowerCase()}` }
}

export function isFallbackVenue(address?: string | null): boolean {
  return resolveVenue(address).kind === "fallback"
}
