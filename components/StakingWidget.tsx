"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import {
  STAKING_ADDRESS,
  DDB_ADDRESS,
  DDB_DECIMALS,
  SEPOLIA_CHAIN_ID_HEX,
} from "@/lib/config"; // ← change to "../lib/config" if no alias

// ---- Minimal ABIs ----
const STAKING_ABI = [
  "function poolCount() view returns (uint256)",
  "function getPoolInfo(uint256) view returns (address stakingToken,address rewardsToken,uint256 aprBps,uint256 lockPeriod,uint256 totalSupply,uint256 lastUpdateTime,uint256 rewardPerTokenStored)",
  "function balanceOf(uint256,address) view returns (uint256)",
  "function earned(uint256,address) view returns (uint256)",
  "function stake(uint256 poolId, uint256 amount)",
  "function withdraw(uint256 poolId, uint256 amount)",
  "function earlyWithdraw(uint256 poolId, uint256 amount)",
  "function getReward(uint256 poolId)",
  "function exit(uint256 poolId)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// ---- Helpers ----
const SEPOLIA_ID = SEPOLIA_CHAIN_ID_HEX; // "0xaa36a7"
const VALID_STAKING =
  /^0x[a-fA-F0-9]{40}$/.test(STAKING_ADDRESS) &&
  STAKING_ADDRESS.toLowerCase() !== "0xyour_staking_contract";

const AUTO_KEY = "oec_autoconnect"; // remember wallet connection across refreshes

// 2-decimal formatter w/ commas
const fmt2 = (s: string) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return s || "0.00";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

// Ensure MetaMask is on Sepolia; add it if missing
async function ensureSepolia(): Promise<boolean> {
  const eth: any = (window as any).ethereum;
  if (!eth) {
    alert("Please install MetaMask");
    return false;
  }
  const currentId: string = await eth.request({ method: "eth_chainId" });
  if (currentId === SEPOLIA_ID) return true;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_ID }],
    });
    return true;
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_ID,
            chainName: "Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [
              "https://rpc.sepolia.org",
              // optionally add your Infura/Alchemy endpoints:
              // "https://sepolia.infura.io/v3/YOUR_ID",
              // "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY",
            ],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
      return true;
    }
    if (err?.code === 4001) {
      alert("Please approve the network switch to Sepolia.");
      return false;
    }
    console.error("Switch chain error:", err);
    return false;
  }
}

type PoolInfo = {
  id: number;
  stakingToken: string;
  rewardsToken: string;
  aprBps: bigint;
  lockPeriod: bigint;
  totalSupply: bigint;
};

export default function StakingWidget() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signerAddr, setSignerAddr] = useState<string>("");

  const [staking, setStaking] = useState<Contract | null>(null);
  const [ddb, setDdb] = useState<Contract | null>(null);

  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [myBalances, setMyBalances] = useState<Record<number, string>>({});
  const [myEarned, setMyEarned] = useState<Record<number, string>>({});
  const [myDdbBalance, setMyDdbBalance] = useState<string>("0");

  const [amount, setAmount] = useState<string>("0");
  const [selectedPool, setSelectedPool] = useState<number>(0);
  const [pending, setPending] = useState<string>("");

  // keep a reference to the block handler so we can remove it on disconnect
  const blockHandlerRef = useRef<((...args: any[]) => void) | null>(null);

  // ----- wiring (shared by connect + autoconnect) -----
  async function initFromEthereum(ethereum: any) {
    const ok = await ensureSepolia();
    if (!ok) return;

    // clean prior listener if any
    if (provider && blockHandlerRef.current) {
      (provider as any).removeListener?.("block", blockHandlerRef.current);
      blockHandlerRef.current = null;
    }

    const prov = new BrowserProvider(ethereum);
    const signer = await prov.getSigner();
    const addr = await signer.getAddress();

    setProvider(prov);
    setSignerAddr(addr);

    if (VALID_STAKING) {
      const stakingC = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      setStaking(stakingC);
      // load pools right away
      await loadPools(stakingC);
      await loadUserData(stakingC, addr);
    } else {
      setStaking(null);
      setPools([]);
      setMyBalances({});
      setMyEarned({});
    }

    const ddbC = new Contract(DDB_ADDRESS, ERC20_ABI, signer);
    setDdb(ddbC);
    await loadWalletDdb(ddbC, addr);

    // live refresh wallet balance on new blocks
    const onBlock = () => loadWalletDdb(ddbC, addr);
    blockHandlerRef.current = onBlock;
    (prov as any).on?.("block", onBlock);
  }

  // ---- Connect / Disconnect ----
  async function connect() {
    const { ethereum } = window as any;
    if (!ethereum) {
      alert("Please install MetaMask");
      return;
    }
    try {
      await ethereum.request({ method: "eth_requestAccounts" });
      localStorage.setItem(AUTO_KEY, "1"); // remember connection
      await initFromEthereum(ethereum);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to connect wallet");
    }
  }

  async function disconnect() {
    // remove block listener if any
    try {
      if (provider && blockHandlerRef.current) {
        (provider as any).removeListener?.("block", blockHandlerRef.current);
      }
    } catch {}
    blockHandlerRef.current = null;

    // clear state
    setProvider(null);
    setSignerAddr("");
    setStaking(null);
    setDdb(null);
    setPools([]);
    setMyBalances({});
    setMyEarned({});
    setMyDdbBalance("0");
    setAmount("0");
    setPending("");

    // stop autoconnect
    localStorage.removeItem(AUTO_KEY);
  }

  // ---- Loaders ----
  async function loadPools(currentStaking?: Contract | null) {
    const s = currentStaking ?? staking;
    if (!s) {
      setPools([]);
      return;
    }
    const count: bigint = await s.poolCount();
    const arr: PoolInfo[] = [];
    for (let i = 0; i < Number(count); i++) {
      const [stakingToken, rewardsToken, aprBps, lockPeriod, totalSupply] = await s.getPoolInfo(i);
      arr.push({ id: i, stakingToken, rewardsToken, aprBps, lockPeriod, totalSupply });
    }
    setPools(arr);
  }

  async function loadUserData(currentStaking?: Contract | null, addr?: string) {
    const s = currentStaking ?? staking;
    const who = addr ?? signerAddr;
    if (!s || !who) return;

    const updatesBalances: Record<number, string> = {};
    const updatesEarned: Record<number, string> = {};

    for (const p of pools) {
      const bal: bigint = await s.balanceOf(p.id, who);
      const ernd: bigint = await s.earned(p.id, who);
      updatesBalances[p.id] = formatUnits(bal, DDB_DECIMALS);
      updatesEarned[p.id] = formatUnits(ernd, DDB_DECIMALS);
    }
    setMyBalances(updatesBalances);
    setMyEarned(updatesEarned);
  }

  async function loadWalletDdb(currentDdb?: Contract | null, addr?: string) {
    const token = currentDdb ?? ddb;
    const who = addr ?? signerAddr;
    if (!token || !who) return;
    try {
      const wBal: bigint = await token.balanceOf(who);
      setMyDdbBalance(formatUnits(wBal, DDB_DECIMALS));
    } catch (e) {
      console.error("wallet DDB read failed:", e);
    }
  }

  // ---- Effects ----
  // Autoconnect on mount (silent): if we have AUTO_KEY and already authorized, wire up
  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      const eth: any = (window as any).ethereum;
      if (!eth) return;
      if (localStorage.getItem(AUTO_KEY) !== "1") return;

      try {
        const accounts: string[] = await eth.request({ method: "eth_accounts" });
        if (accounts && accounts[0]) {
          await initFromEthereum(eth);
        }
      } catch (e) {
        console.warn("Autoconnect failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When staking contract is ready, (re)load pools
  useEffect(() => {
    if (staking) loadPools(staking);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staking]);

  // When pools/addr/contract change, refresh per-pool user data
  useEffect(() => {
    if (staking && signerAddr) loadUserData(staking, signerAddr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staking, signerAddr, pools.length]);

  // React to wallet account/chain changes
  useEffect(() => {
    const eth: any = (typeof window !== "undefined" && (window as any).ethereum) || null;
    const onAcc = async () => {
      if (!provider) return;
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setSignerAddr(addr);
      await loadWalletDdb(ddb, addr);
      await loadUserData(staking, addr);
    };
    const onChain = async () => {
      await loadWalletDdb(ddb, signerAddr);
      await loadUserData(staking, signerAddr);
    };
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
  }, [provider, ddb, staking, signerAddr]);

  // ---- Actions ----
  async function ensureAllowance(tokenAmount: string) {
    if (!ddb || !signerAddr) throw new Error("No token or signer");
    const amt = parseUnits(tokenAmount, DDB_DECIMALS);
    const allowance: bigint = await ddb.allowance(signerAddr, STAKING_ADDRESS);
    if (allowance < amt) {
      setPending("Approving...");
      const tx = await ddb.approve(STAKING_ADDRESS, amt);
      await tx.wait();
    }
  }

  async function doStake() {
    if (!staking) return alert("Staking contract not set.");
    const tokenAmount = amount.trim();
    if (+tokenAmount <= 0) return;
    try {
      await ensureSepolia();
      await ensureAllowance(tokenAmount);
      setPending("Staking...");
      const tx = await staking.stake(selectedPool, parseUnits(tokenAmount, DDB_DECIMALS));
      await tx.wait();
      setPending("");
      setAmount("0");
      await loadUserData();
      await loadPools();
      await loadWalletDdb();
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
      await loadWalletDdb();
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
      await loadWalletDdb();
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
      await loadWalletDdb();
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: 0 }}>DooDoo Butt Staking</h2>

        {connected ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>Connected: {signerAddr.slice(0, 6)}…{signerAddr.slice(-4)}</span>
            <button onClick={disconnect}>Disconnect</button>
          </div>
        ) : (
          <button onClick={connect}>Connect Wallet (Sepolia)</button>
        )}
      </div>

      <div style={{ marginTop: 8 }}>Wallet DDB: {fmt2(myDdbBalance)}</div>
      <hr style={{ margin: "12px 0 16px" }} />

      <div>
        <label>Pool:&nbsp;</label>
        <select value={selectedPool} onChange={(e) => setSelectedPool(parseInt(e.target.value, 10))}>
          {pools.length === 0 ? (
            <option value={0}>No pools configured</option>
          ) : (
            pools.map((p) => (
              <option key={p.id} value={p.id}>
                Pool {String.fromCharCode(65 + p.id)} • APR {(Number(p.aprBps) / 100).toFixed(2)}% • Lock {p.lockPeriod === 0n ? "Flex" : `${(Number(p.lockPeriod) / 86400).toFixed(0)}d`}
              </option>
            ))
          )}
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
<button className="btn" onClick={connect}>Connect Wallet (Sepolia)</button>
<button className="btn" onClick={disconnect}>Disconnect</button>

<button className="btn" onClick={doStake}     disabled={!connected || pending !== "" || !VALID_STAKING}>Approve + Stake</button>
<button className="btn" onClick={doWithdraw}  disabled={!connected || pending !== "" || !VALID_STAKING}>Withdraw (after lock)</button>
<button className="btn" onClick={doEarlyWithdraw} disabled={!connected || pending !== "" || !VALID_STAKING}>Early Withdraw (penalty)</button>
<button className="btn" onClick={doGetReward} disabled={!connected || pending !== "" || !VALID_STAKING}>Claim Rewards</button>
<button className="btn" onClick={doExit}      disabled={!connected || pending !== "" || !VALID_STAKING}>Exit (Withdraw+Claim)</button>
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
