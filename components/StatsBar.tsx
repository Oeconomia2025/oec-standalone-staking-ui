"use client";
import React, { useEffect, useState } from "react";
import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import { STAKING_ADDRESS, DDB_ADDRESS, DDB_DECIMALS, SEPOLIA_RPC } from "@/lib/config";

const STAKING_ABI = [
  "function poolCount() view returns (uint256)",
  "function getPoolInfo(uint256) view returns (address stakingToken,address rewardsToken,uint256 aprBps,uint256 lockPeriod,uint256 totalSupply,uint256 lastUpdateTime,uint256 rewardPerTokenStored)"
];
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

export default function StatsBar() {
  const [totalStaked, setTotalStaked] = useState("0");
  const [rewardsReserve, setRewardsReserve] = useState("0");
  const [poolCount, setPoolCount] = useState(0);
  const [aprs, setAprs] = useState<number[]>([]);
  const [walletAddr, setWalletAddr] = useState<string>("");
  const [walletDdb, setWalletDdb] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  // Read-only provider (always Sepolia)
  const provider = new JsonRpcProvider(SEPOLIA_RPC);
  const staking  = new Contract(STAKING_ADDRESS, STAKING_ABI, provider);
  const token    = new Contract(DDB_ADDRESS,     ERC20_ABI,   provider);

  // Grab wallet address if user is connected in MetaMask
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

  // Load all stats (contract + wallet balance if available)
  const fetchStats = async () => {
    try {
      setLoading(true);

      const count: bigint = await staking.poolCount();
      const n = Number(count);
      setPoolCount(n);

      let tvl = 0n;
      const aprList: number[] = [];
      for (let i = 0; i < n; i++) {
        const [, , aprBps, , totalSupply] = await staking.getPoolInfo(i);
        tvl += BigInt(totalSupply);
        aprList.push(Number(aprBps) / 100);
      }
      setTotalStaked(formatUnits(tvl, DDB_DECIMALS));

      const reserve: bigint = await token.balanceOf(STAKING_ADDRESS);
      setRewardsReserve(formatUnits(reserve, DDB_DECIMALS));

      setAprs(aprList);

      // Wallet DDB (unstaked)
      if (walletAddr) {
        const bal: bigint = await token.balanceOf(walletAddr);
        setWalletDdb(formatUnits(bal, DDB_DECIMALS));
      } else {
        setWalletDdb("0");
      }
    } catch (e) {
      console.error("Stats load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detectWallet();
    fetchStats();                   // initial
    provider.on("block", fetchStats); // live refresh on new blocks

    // react to wallet changes if MetaMask is present
    const eth: any = (typeof window !== "undefined" && (window as any).ethereum) || null;
    const onAcc = () => { detectWallet(); fetchStats(); };
    const onChain = () => { detectWallet(); fetchStats(); };
    if (eth?.on) {
      eth.on("accountsChanged", onAcc);
      eth.on("chainChanged", onChain);
    }

    return () => {
      provider.removeListener("block", fetchStats);
      if (eth?.removeListener) {
        eth.removeListener("accountsChanged", onAcc);
        eth.removeListener("chainChanged", onChain);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddr]);

  const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Not connected");

  return (
    <div style={{ padding: "16px 0 12px", borderBottom: "1px solid #333" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>Oeconomia — Staking</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>DooDoo Butt (DDB) • Sepolia</div>
        </div>

        <button onClick={fetchStats} style={{ padding: "6px 10px", borderRadius: 8 }}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

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
