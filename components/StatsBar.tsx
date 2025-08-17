"use client";
import React, { useEffect, useState } from "react";
import { JsonRpcProvider, BrowserProvider, Contract, formatUnits } from "ethers";
import { STAKING_ADDRESS, DDB_ADDRESS, DDB_DECIMALS, SEPOLIA_RPC } from "@/lib/config";

const STAKING_ABI = [
  "function poolCount() view returns (uint256)",
  "function getPoolInfo(uint256) view returns (address stakingToken,address rewardsToken,uint256 aprBps,uint256 lockPeriod,uint256 totalSupply,uint256 lastUpdateTime,uint256 rewardPerTokenStored)"
];
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

export default function StatsBar() {
  const [totalStaked, setTotalStaked] = useState<string>("0");
  const [rewardsReserve, setRewardsReserve] = useState<string>("0");
  const [poolCount, setPoolCount] = useState<number>(0);
  const [aprs, setAprs] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Prefer user wallet if present; otherwise use public RPC
        const prov =
          typeof window !== "undefined" && (window as any).ethereum
            ? new BrowserProvider((window as any).ethereum)
            : new JsonRpcProvider(SEPOLIA_RPC);

        const staking = new Contract(STAKING_ADDRESS, STAKING_ABI, prov);
        const token   = new Contract(DDB_ADDRESS,     ERC20_ABI,   prov);

        const count: bigint = await staking.poolCount();
        setPoolCount(Number(count));

        let tvl = 0n;
        const aprList: number[] = [];
        for (let i = 0; i < Number(count); i++) {
          const [, , aprBps, , totalSupply] = await staking.getPoolInfo(i);
          tvl += BigInt(totalSupply);
          aprList.push(Number(aprBps) / 100);
        }
        setTotalStaked(formatUnits(tvl, DDB_DECIMALS));
        setAprs(aprList);

        const reserve: bigint = await token.balanceOf(STAKING_ADDRESS);
        setRewardsReserve(formatUnits(reserve, DDB_DECIMALS));
      } catch (e) {
        console.error("Stats load failed:", e);
      }
    })();
  }, []);

  return (
    <div style={{ padding: "16px 0 12px", borderBottom: "1px solid #333" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>Oeconomia — Staking</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>DooDoo Butt (DDB) • Sepolia</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, width: "100%", marginTop: 12 }}>
          <StatCard label="Total Staked" value={`${Number(totalStaked).toLocaleString()} DDB`} />
          <StatCard label="Rewards Reserve" value={`${Number(rewardsReserve).toLocaleString()} DDB`} />
          <StatCard label="Pools" value={String(poolCount)} />
          <StatCard label="APRs" value={aprs.length ? aprs.map(a => `${a}%`).join(" • ") : "—"} />
        </div>
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
