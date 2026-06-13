// PropAMMRouter ABI — extracted from the open-source (unverified) contract repo:
// https://github.com/lambdaclass/propamm-router-contracts (src/interfaces/IPropAMMRouter.sol)
//
// We only include the entrypoints this frontend uses. The `*WithFeeV1` variants
// are intentionally omitted because this frontend charges NO frontend fees.

export const PROPAMM_ROUTER_ADDRESS =
  "0x4ddf368080cd7946db5b459ad591c350158175e1" as const

export const PROPAMM_ROUTER_ABI = [
  // --- Quoting (NOT view: must be simulated via eth_call) ---
  {
    type: "function",
    name: "quoteV1",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "bestQuote", type: "uint256" },
      { name: "venue", type: "address" },
    ],
  },
  {
    type: "function",
    name: "quoteVenueV1",
    stateMutability: "nonpayable",
    inputs: [
      { name: "venue", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "quotedVenue", type: "address" },
    ],
  },
  // --- Swapping ---
  {
    type: "function",
    name: "swapV1",
    stateMutability: "payable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "executedVenue", type: "address" },
    ],
  },
  {
    type: "function",
    name: "isWhitelistedVenue",
    stateMutability: "view",
    inputs: [{ name: "venue", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // --- Events ---
  {
    type: "event",
    name: "Swapped",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: true },
      { name: "tokenOut", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "recipient", type: "address", indexed: false },
      { name: "marketMaker", type: "address", indexed: false },
    ],
  },
] as const

// Minimal ERC-20 ABI for allowance / approve / metadata reads.
export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const
