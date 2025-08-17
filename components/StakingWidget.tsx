"use client";
import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";

// ---- SET THESE ----
const STAKING_ADDRESS = "0xYOUR_STAKING_CONTRACT"; // <-- set after you deploy MultiPoolStakingAPR
const DDB_ADDRESS = "0x02675d29817Dd82E4268A58cd11Ba3d3868bd9B3";
const DDB_DECIMALS = 18;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111

// --- Minimal ABIs ---
const STAKING_ABI = [
  "function poolCount() view returns (uint256)",
  "function getPoolInfo(uint256) view returns (address stakingToken,address rewardsToken,uint256 aprBps,uint256 lockPeriod,uint256 totalSupply,uint256 lastUpdateTime,uint256 rewardPerTokenStored)",
  "function balanceOf(uint256,address) view returns (uint256)",
  "function earned(uint256,address) view returns (uint256)",
  "function stake(uint256 poolId, uint256 amount)",
  "function withdraw(uint256 poolId, uint256 amount)",
  "function earlyWithdraw(uint256 poolId, uint256 amount)",
  "function getReward(uint256 poolId)",
  "function exit(uint256 poolId)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

type PoolInfo = {
  id: number;
  stakingToken: string;
  rewardsToken: string;
  aprBps: bigint;
  lockPeriod: bigint;
  totalSupply: bigint;
};

function secondsToDays(s: bigint) {
  const days = Number(s) / 86400;
  return days.toFixed(0);
}

export default function StakingWidget() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signerAddr, setSignerAddr] = useState<string>("");
  const [staking, setStaking] = useState<Contract | null>(null);
  const [ddb, setDdb] = useState<Contract | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [myBalances, setMyBalances] = useState<Record<number, string>>({});
  const [myEarned, setMyEarned] = useState<Record<number, string>>({});
  const [myDdbBalance, setMyDdbBalance] = useState<string>("0");
  const [amount, setAmount] = useState<string>("0"); // input amount in tokens
  const [selectedPool, setSelectedPool] = useState<number>(0);
  const [pending, setPending] = useState<string>("");

  async function connect() {
    const { ethereum } = window as any;
    if (!ethereum) {
      alert("Please install MetaMask");
      return;
    }
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      const chainId: string = await ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
          });
        } catch (err: any) {
          console.warn("Switch chain error:", err?.message || err);
          alert("Please switch MetaMask to Sepolia and reconnect.");
        }
      }
      const prov = new BrowserProvider(ethereum);
      const signer = await prov.getSigner();
      setProvider(prov);
      setSignerAddr(await signer.getAddress());
      const stakingC = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      setStaking(stakingC);
      const ddbC = new Contract(DDB_ADDRESS, ERC20_ABI, signer);
      setDdb(ddbC);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to connect wallet");
    }
  }

  async function loadPools() {
    if (!staking) return;
    const count: bigint = await staking.poolCount();
    const arr: PoolInfo[] = [];
    for (let i = 0; i < Number(count); i++) {
      const [stakingToken, rewardsToken, aprBps, lockPeriod, totalSupply] = await staking.getPoolInfo(i);
      arr.push({ id: i, stakingToken, rewardsToken, aprBps, lockPeriod, totalSupply });
    }
    setPools(arr);
  }

  async function loadUserData() {
    if (!staking || !ddb || !signerAddr) return;
    const updatesBalances: Record<number, string> = {};
    const updatesEarned: Record<number, string> = {};
    for (const p of pools) {
      const bal: bigint = await staking.balanceOf(p.id, signerAddr);
      const ernd: bigint = await staking.earned(p.id, signerAddr);
      updatesBalances[p.id] = formatUnits(bal, DDB_DECIMALS);
      updatesEarned[p.id] = formatUnits(ernd, DDB_DECIMALS);
    }
    setMyBalances(updatesBalances);
    setMyEarned(updatesEarned);
    const wBal: bigint = await ddb.balanceOf(signerAddr);
    setMyDdbBalance(formatUnits(wBal, DDB_DECIMALS));
  }

  useEffect(() => {
    if (staking) loadPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staking]);

  useEffect(() => {
    if (staking && ddb && pools.length > 0 && signerAddr) {
      loadUserData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staking, ddb, pools, signerAddr]);

  async function ensureAllowance(tokenAmount: string) {
    if (!ddb) throw new Error("No token");
    const amt = parseUnits(tokenAmount, DDB_DECIMALS);
    const allowance: bigint = await ddb.allowance(signerAddr, STAKING_ADDRESS);
    if (allowance < amt) {
      setPending("Approving...");
      const tx = await ddb.approve(STAKING_ADDRESS, amt);
      await tx.wait();
    }
  }

  async function doStake() {
    if (!staking) return;
    const tokenAmount = amount.trim();
    if (+tokenAmount <= 0) return;
    try {
      await ensureAllowance(tokenAmount);
      setPending("Staking...");
      const tx = await staking.stake(selectedPool, parseUnits(tokenAmount, DDB_DECIMALS));
      await tx.wait();
      setPending("");
      setAmount("0");
      await loadUserData();
      await loadPools();
      alert("Staked!");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Stake failed");
    }
  }

  async function doWithdraw() {
    if (!staking) return;
    const tokenAmount = amount.trim();
    if (+tokenAmount <= 0) return;
    try {
      setPending("Withdrawing...");
      const tx = await staking.withdraw(selectedPool, parseUnits(tokenAmount, DDB_DECIMALS));
      await tx.wait();
      setPending("");
      setAmount("0");
      await loadUserData();
      await loadPools();
      alert("Withdrawn!");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Withdraw failed (lock may not be over)");
    }
  }

  async function doEarlyWithdraw() {
    if (!staking) return;
    const tokenAmount = amount.trim();
    if (+tokenAmount <= 0) return;
    try {
      setPending("Early withdrawing...");
      const tx = await staking.earlyWithdraw(selectedPool, parseUnits(tokenAmount, DDB_DECIMALS));
      await tx.wait();
      setPending("");
      setAmount("0");
      await loadUserData();
      await loadPools();
      alert("Early withdrawal complete (penalty applied; rewards forfeited)");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Early withdraw failed");
    }
  }

  async function doGetReward() {
    if (!staking) return;
    try {
      setPending("Claiming rewards...");
      const tx = await staking.getReward(selectedPool);
      await tx.wait();
      setPending("");
      await loadUserData();
      alert("Rewards claimed!");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Claim failed (contract may need more rewards)");
    }
  }

  async function doExit() {
    if (!staking) return;
    try {
      setPending("Exit...");
      const tx = await staking.exit(selectedPool);
      await tx.wait();
      setPending("");
      await loadUserData();
      await loadPools();
      alert("Exited (withdrew + claimed)");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Exit failed");
    }
  }

  const connected = useMemo(() => !!provider && !!signerAddr, [provider, signerAddr]);

  return (
    <div style={{ maxWidth: 840, margin: "24px auto", padding: 16, border: "1px solid #333", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>DooDoo Butt — Staking</h2>
        <button onClick={connect}>{connected ? `Connected: ${signerAddr.slice(0,6)}…${signerAddr.slice(-4)}` : "Connect Wallet (Sepolia)"}</button>
      </div>

      <div style={{ marginTop: 8, opacity: 0.8 }}>Wallet DDB: {myDdbBalance}</div>

      <hr style={{ margin: "16px 0" }} />

      <div>
        <label>Pool:&nbsp;</label>
        <select value={selectedPool} onChange={(e) => setSelectedPool(parseInt(e.target.value, 10))}>
          {pools.map((p) => (
            <option key={p.id} value={p.id}>
              Pool {String.fromCharCode(65 + p.id)} • APR {(Number(p.aprBps)/100).toFixed(2)}% • Lock {p.lockPeriod === 0n ? "Flex" : `${secondsToDays(p.lockPeriod)}d`}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Your stake:</strong> {myBalances[selectedPool] ?? "0"} DDB
        <br />
        <strong>Your earned:</strong> {myEarned[selectedPool] ?? "0"} DDB
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          type="number"
          min="0"
          step="0.000000000000000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (DDB)"
          style={{ width: 280 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={doStake} disabled={!connected || pending !== ""}>Approve + Stake</button>
        <button onClick={doWithdraw} disabled={!connected || pending !== ""}>Withdraw (after lock)</button>
        <button onClick={doEarlyWithdraw} disabled={!connected || pending !== ""}>Early Withdraw (penalty)</button>
        <button onClick={doGetReward} disabled={!connected || pending !== ""}>Claim Rewards</button>
        <button onClick={doExit} disabled={!connected || pending !== ""}>Exit (Withdraw+Claim)</button>
      </div>

      {pending && <div style={{ marginTop: 12 }}>⏳ {pending}</div>}

      <hr style={{ margin: "16px 0" }} />
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Notes:
        <ul>
          <li>APR is fixed per pool; contract must hold enough DDB for payouts.</li>
          <li>“Withdraw” requires the lock to be over. “Early Withdraw” applies the pool’s penalty and forfeits rewards.</li>
          <li>If a tx fails with “insufficient reward tokens”, send more DDB to the staking contract address.</li>
        </ul>
      </div>
    </div>
  );
}
