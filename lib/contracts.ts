// lib/contracts.ts
import { JsonRpcProvider, Contract } from "ethers";
import STAKING_ABI from "@/abi/Staking.json";  // your staking ABI
import ERC20_ABI from "@/abi/ERC20.json";

export const isAddress = (a?: string) => !!a && /^0x[a-fA-F0-9]{40}$/.test(a);

export function getReadContracts() {
  // Never construct ethers stuff during SSR
  if (typeof window === "undefined") return null;

  const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "";
  const SA  = process.env.NEXT_PUBLIC_STAKING_ADDRESS ?? "";
  const DDB = process.env.NEXT_PUBLIC_DDB_ADDRESS ?? "";

  if (!RPC || !isAddress(SA) || !isAddress(DDB)) return null;

  const provider = new JsonRpcProvider(RPC);
  return {
    provider,
    staking: new Contract(SA, STAKING_ABI, provider),
    token:   new Contract(DDB, ERC20_ABI, provider),
  };
}
