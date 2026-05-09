/**
 * DripBase contract ABI — only the functions/events we need.
 */
export const DRIPBASE_ABI = [
  // tip(address recipient, string message) payable
  "function tip(address recipient, string message) external payable",

  // TipSent event
  "event TipSent(address indexed sender, address indexed recipient, uint256 amount, string message)",
];

/**
 * Network & contract configuration.
 *
 * Replace CONTRACT_ADDRESS with your deployed DripBase address.
 */
export const CONFIG = {
  // Base Mainnet
  chainId: 8453,
  chainIdHex: "0x2105",
  chainName: "Base",
  rpcUrl: "https://mainnet.base.org",
  blockExplorer: "https://basescan.org",
  currency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },

  // ──────────────────────────────────────────────
  // ⬇️  Paste your deployed contract address here
  // ──────────────────────────────────────────────
  contractAddress: "0x4851CD277219480234Cf7eC3E469757e3cF748C0",
};
