"use client";
import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, JsonRpcProvider, Contract, formatUnits } from "ethers";
import {
  STAKING_ADDRESS,
  DDB_ADDRESS,
  DDB_DECIMALS,
  SEPOLIA_RPC,
  SEPOLIA_CHAIN_ID_HEX
} from "@/lib/config";

// ---- Minimal ABIs ----
const STAKING_ABI = [
  "function poolCount() view returns (uint256)",
  "function getPoolInfo(uint256) view returns (address stakingToken,address rewardsToken,uint256 aprBps,uint256 lockPeriod,uint256 totalSupply,uint256 lastUpdateTime,uint256 rewardPerTokenStored)"
];
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

// Treat staking contract as optional (so wallet balance still shows)
const HAS_STAKING =
  /^0x[a-fA-F0-9]{40}$/.test(STAKING_ADDRESS) &&
  STAKING_ADDRESS.toLowerCase() !== "0xyour_staking_contract";

export default function StatsBar() {
  const [walletAddr, setWalletAddr] = useState<string>("");
  const [poolCount, setPoolCount] = useState(0);
  const [totalStaked, setTotalStaked] = useState("0");
  const [rewardsReserve, setRewardsReserve] = useState("0");
  const [aprs, setAprs] = useState<number[]>([]);
  const [walletDdb, setWalletDdb] = useState("0");
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");

  // Prefer MetaMask on Sepolia for reads; else use public RPC if provided
  const provider = useMemo(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      // We'll decide at runtime if it's on Sepolia; if not, we'll fall back to RPC
      return new BrowserProvider((window as any).ethereum);
    }
    if (SEPOLIA_RPC) return new JsonRpcProvider(SEPOLIA_RPC);
    return null;
  }, []);

  // Determine if the BrowserProvider is actually on Sepolia; otherwise we’ll use JSON RPC (if set)
  const [readProvider, setReadProvider] = useState<BrowserProvider | JsonRpcProvider | null>(null);

  async function selectReadProvider() {
    if (!provider) {
      setReadProvider(null);
      setHint("Connect wallet on Sepolia or set NEXT_PUBLIC_SEPOLIA_RPC.");
      return;
    }
    // If provider is a BrowserProvider, check chain
    if (provider instanceof BrowserProvider) {
      try {
        const chainId = await (provider as any).send("eth_chainId", []);
        if (chainId === SEPOLIA_CHAIN_ID_HEX) {
          setReadProvider(provider);
          setHint("");
          return;
        }
      } catch {
        /* ignore; fall through to RPC if any */
      }
      // Not on Sepolia → try RPC fallback
      if (SEPOLIA_RPC) {
        setReadProvider(new JsonRpcProvider(SEPOLIA_RPC));
        setHint("Reading via RPC. Connect wallet to Sepolia for live reads via wallet.");
      } else {
        setReadProvider(null);
        setHint("Please switch wallet to Sepolia or set NEXT_PUBLIC_SEPOLIA_RPC.");
      }
    } else {
      // JsonRpcProvider already
      setReadProvider(provider);
      setHint("");
    }
  }

  // Detect wallet address (no prompts)
  async function detectWallet() {
    if (typeof window === "undefined") return;
    const eth: any = (window as any).ethereum;
    if (!eth) { setWalletAddr(""); return; }
    try {
      const accounts: string[] = await eth.request({ method: "eth_accounts" });
      setWalletAddr(accounts?.[0] ?? "");
    } catch {
      setWalletAddr("");
    }
  }

  const fetchStats = async () => {
    if (!readProvider) return;
    setLoading(true);
    try {
      // ----- Token contract (used for reserve + wallet balance)
      const token = new Contract(DDB_ADDRESS, ERC20_ABI, readProvider);

      // ----- Staking stats (optional)
      if (HAS_STAKING) {
        const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, readProvider);

        const count: bigint = await staking.poolCount();
        const n = Number(count);
        setPoolCount(n);

        let tvl = 0n;
        const aprList: number[] = [];
        for (let i = 0; i < n; i++) {
          const [, , aprBps, , totalSupply] = await staking.getPoolInfo(i);
          tvl += totalSupply as bigint; // ethers v6 returns bigint
          aprList.push(Number(aprBps) / 100);
        }
        setTotalStaked(formatUnits(tvl, DDB_DECIMALS));

        const reserve: bigint = await token.balanceOf(STAKING_ADDRESS);
        setRewardsReserve(formatUnits(reserve, DDB_DECIMALS));
        setAprs(aprList);
      } else {
        // No staking contract set yet
        setPoolCount(0);
        setTotalStaked("0");
        setRewardsReserve("0");
        setAprs([]);
      }

      // ----- Wallet (unstaked) DDB
      if (walletAddr) {
        const bal: bigint = await token.balanceOf(walletAddr);
        setWalletDdb(formatUnits(bal, DDB_DECIMALS));
      } else {
        setWalletDdb("0");
      }
    } catch (e) {
      console.error("Stats load failed:", e);
      setHint("Unable to read. Check addresses and provider/RPC.");
    } finally {
      setLoading(false);
    }
  };

  // Initial setup + handle provider selection
  useEffect(() => {
    detectWallet();
    selectReadProvider();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Re-run when wallet changes network/accounts
  useEffect(() => {
    const eth: any = (typeof window !== "undefined" && (window as any).ethereum) || null;
    const onAcc = () => { detectWallet(); selectReadProvider(); fetchStats(); };
    const onChain = () => { selectReadProvider(); fetchStats(); };
    if (eth?.on) {
      eth.on("accountsChanged", onAcc);
      eth.on("chainChanged", onChain);
    }
    return () => {
      if (eth?.removeListener) {
        eth.removeListener("accountsChanged", onAcc);
        eth.removeListener("chainChanged", onChain);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial fetch + live block updates
  useEffect(() => {
    if (!readProvider) return;
    fetchStats(); // initial
    const onBlock = () => fetchStats();
    (readProvider as any).on?.("block", onBlock);
    return () => (readProvider as any).removeListener?.("block", onBlock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readProvider, walletAddr]);

  const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Not connected");

  return (
    <div style={{ padding: "16px 0 12px", borderBottom: "1px solid #333" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>Oeconomia Staking</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>DooDoo Butt (DDB) • Sepolia</div>
        </div>
        <button onClick={fetchStats} style={{ padding: "6px 10px", borderRadius: 8 }} disabled={!readProvider}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!!hint && (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          {hint}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, width: "100%", marginTop: 12 }}>
        <StatCard label="Total Staked" value={`${Number(totalStaked).toLocaleString()} DDB`} />
        <StatCard label="Rewards Reserve" value={`${Number(rewardsReserve).toLocaleString()} DDB`} />
        <StatCard label="Pools" value={String(poolCount)} />
        <StatCard label="APRs" value={aprs.length ? aprs.map(a => `${a}%`).join(" • ") : "—"} />
        <StatCard label={`Wallet (unstaked) ${walletAddr ? `• ${short(walletAddr)}` : ""}`} value={`${Number(walletDdb).toLocaleString()} DDB`} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #333", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
