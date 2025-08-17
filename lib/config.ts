// lib/config.ts
export const STAKING_ADDRESS = "0xYOUR_STAKING_CONTRACT"; // <-- set me
export const DDB_ADDRESS      = "0x02675d29817Dd82E4268A58cd11Ba3d3868bd9B3";
export const DDB_DECIMALS     = 18;

// Optional: set a browser-friendly RPC (Infura/Alchemy) via env var.
// If left blank, the dashboard uses the connected wallet as the provider.
export const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || "";
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // used by the widget for chain switching
