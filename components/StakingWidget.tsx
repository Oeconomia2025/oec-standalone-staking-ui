"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, JsonRpcProvider, Contract, formatUnits, parseUnits } from "ethers";
import {
  STAKING_ADDRESS,
  DDB_ADDRESS,
  DDB_DECIMALS,
  SEPOLIA_CHAIN_ID_HEX,
  SEPOLIA_RPC, // expect NEXT_PUBLIC_SEPOLIA_RPC to be set in Netlify
} from "@/lib/config";

/* ---- ABIs ---- */
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
];

/* ---- Helpers ---- */
const SEPOLIA_ID = SEPOLIA_CHAIN_ID_HEX; // "0xaa36a7"
const VALID_STAKING =
  /^0x[a-fA-F0-9]{40}$/.test(STAKING_ADDRESS) &&
  STAKING_ADDRESS.toLowerCase() !== "0xyour_staking_contract";

const fmt2 = (s: string) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return s || "0.00";
  return new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
};
const fmtInt = (s: string) =>
  new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Number(s||"0"));
const days = (sec: bigint) => (Number(sec)/86400).toFixed(0);
const poolName = (id: number) => String.fromCharCode(65 + id); // 0->A

async function ensureSepolia(): Promise<boolean> {
  const eth: any = (window as any).ethereum;
  if (!eth) { alert("Please install MetaMask"); return false; }
  const currentId: string = await eth.request({ method:"eth_chainId" });
  if (currentId === SEPOLIA_ID) return true;
  try {
    await eth.request({ method:"wallet_switchEthereumChain", params:[{ chainId: SEPOLIA_ID }] });
    return true;
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: SEPOLIA_ID,
          chainName: "Sepolia",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"]
        }]
      });
      return true;
    }
    if (err?.code === 4001) alert("Please approve the network switch to Sepolia.");
    console.error("Switch chain error:", err);
    return false;
  }
}

type PoolInfo = {
  id: number;
  aprBps: bigint;
  lockPeriod: bigint;
  totalSupply: bigint;
};

export default function StakingWidgetCards() {
  // ---- Read provider (works with NO wallet) ----
  const readProvider = useMemo(() => {
    if (SEPOLIA_RPC) return new JsonRpcProvider(SEPOLIA_RPC);
    // fallback: if user has MM and is on Sepolia, we can still read via wallet provider
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return new BrowserProvider((window as any).ethereum);
    }
    return null;
  }, []);

  const [readReady, setReadReady] = useState(false);
  const [readHint, setReadHint] = useState("");

  // ---- Wallet / signer state (only needed for actions & user balances) ----
  const [provider, setProvider] = useState<BrowserProvider|null>(null);
  const [signerAddr, setSignerAddr] = useState("");
  const [staking, setStaking] = useState<Contract|null>(null);
  const [ddb, setDdb] = useState<Contract|null>(null);

  // ---- Shared data ----
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [myBalances, setMyBalances] = useState<Record<number,string>>({});
  const [myEarned, setMyEarned] = useState<Record<number,string>>({});
  const [myDdb, setMyDdb] = useState("0");

  const [amountByPool, setAmountByPool] = useState<Record<number,string>>({});
  const [pending, setPending] = useState("");
  const connected = !!provider && !!signerAddr;
  const blockHandlerRef = useRef<((...args:any[])=>void)|null>(null);

  /* ---------- PUBLIC READS: load pools & TVL with NO wallet ---------- */
  async function loadPoolsPublic() {
    if (!readProvider) { setReadHint("Set NEXT_PUBLIC_SEPOLIA_RPC or connect wallet."); return; }
    if (!VALID_STAKING) { setReadHint("Staking contract address not set."); return; }

    try {
      const st = new Contract(STAKING_ADDRESS, STAKING_ABI, readProvider);
      const count: bigint = await st.poolCount();
      const arr: PoolInfo[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [, , aprBps, lockPeriod, totalSupply] = await st.getPoolInfo(i);
        arr.push({ id: i, aprBps, lockPeriod, totalSupply });
      }
      setPools(arr);
      setReadReady(true);
      setReadHint("");
    } catch (e:any) {
      console.error("Public read failed:", e);
      setReadHint("Unable to read pools. Check RPC or contract address.");
      setReadReady(false);
    }
  }

  // Keep TVL fresh on new blocks (if provider supports events)
  useEffect(() => {
    loadPoolsPublic(); // initial
    if ((readProvider as any)?.on && VALID_STAKING) {
      const st = new Contract(STAKING_ADDRESS, STAKING_ABI, readProvider);
      const onBlock = async () => {
        try {
          const count: bigint = await st.poolCount();
          const arr: PoolInfo[] = [];
          for (let i = 0; i < Number(count); i++) {
            const [, , aprBps, lockPeriod, totalSupply] = await st.getPoolInfo(i);
            arr.push({ id: i, aprBps, lockPeriod, totalSupply });
          }
          setPools(arr);
        } catch {}
      };
      (readProvider as any).on("block", onBlock);
      return () => (readProvider as any).removeListener?.("block", onBlock);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readProvider]);

  /* ---------- CONNECT / DISCONNECT (for actions & user balances) ---------- */
  async function initFromEthereum(ethereum: any) {
    const ok = await ensureSepolia(); if (!ok) return;

    if (provider && blockHandlerRef.current) {
      (provider as any).removeListener?.("block", blockHandlerRef.current);
      blockHandlerRef.current = null;
    }

    const prov = new BrowserProvider(ethereum);
    const signer = await prov.getSigner();
    const addr = await signer.getAddress();
    setProvider(prov);
    setSignerAddr(addr);

    const token = new Contract(DDB_ADDRESS, ERC20_ABI, signer);
    setDdb(token);
    // wallet balance (unstaked)
    try {
      const bal: bigint = await token.balanceOf(addr);
      setMyDdb(formatUnits(bal, DDB_DECIMALS));
    } catch {}

    if (VALID_STAKING) {
      const st = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      setStaking(st);
      await loadUserData(st, addr); // your per-pool balances & earned
    } else {
      setStaking(null);
      setMyBalances({});
      setMyEarned({});
    }

    const onBlock = async () => {
      try {
        const bal: bigint = await token.balanceOf(addr);
        setMyDdb(formatUnits(bal, DDB_DECIMALS));
        if (staking) await loadUserData(staking, addr);
      } catch {}
    };
    blockHandlerRef.current = onBlock;
    (prov as any).on?.("block", onBlock);
  }

  async function connect() {
    const { ethereum } = window as any;
    if (!ethereum) { alert("Please install MetaMask"); return; }
    await ethereum.request({ method:"eth_requestAccounts" });
    await initFromEthereum(ethereum);
  }

  async function disconnect() {
    try {
      if (provider && blockHandlerRef.current) {
        (provider as any).removeListener?.("block", blockHandlerRef.current);
      }
    } catch {}
    blockHandlerRef.current = null;

    setProvider(null); setSignerAddr("");
    setStaking(null); setDdb(null);
    setMyBalances({}); setMyEarned({});
    setMyDdb("0");
  }

  /* ---------- USER DATA (requires wallet) ---------- */
  async function loadUserData(st?: Contract|null, who?: string) {
    const s = st ?? staking; const addr = who ?? signerAddr;
    if (!s || !addr) return;
    const balances: Record<number,string> = {};
    const earned: Record<number,string> = {};
    for (const p of pools){
      const b: bigint = await s.balanceOf(p.id, addr);
      const e: bigint = await s.earned(p.id, addr);
      balances[p.id] = formatUnits(b, DDB_DECIMALS);
      earned[p.id] = formatUnits(e, DDB_DECIMALS);
    }
    setMyBalances(balances); setMyEarned(earned);
  }

  /* ---------- ACTIONS (require wallet) ---------- */
  async function ensureAllowance(amount: string){
    if (!ddb || !signerAddr) throw new Error("No token or signer");
    const need = parseUnits(amount, DDB_DECIMALS);
    const allowance: bigint = await ddb.allowance(signerAddr, STAKING_ADDRESS);
    if (allowance < need){
      setPending("Approving...");
      const tx = await ddb.approve(STAKING_ADDRESS, need); await tx.wait();
    }
  }
  async function onStake(poolId:number){
    if (!staking) return alert("Connect wallet first.");
    const amt = (amountByPool[poolId] ?? "0").trim(); if (+amt <= 0) return;
    try{
      await ensureSepolia();
      await ensureAllowance(amt);
      setPending("Staking...");
      const tx = await staking.stake(poolId, parseUnits(amt, DDB_DECIMALS)); await tx.wait();
      setPending(""); setAmountByPool(a=>({...a,[poolId]:"0"}));
      await loadUserData();
      alert("Staked!");
    }catch(e:any){ console.error(e); setPending(""); alert(e?.reason||e?.message||"Stake failed"); }
  }
  async function onWithdraw(poolId:number){
    if (!staking) return alert("Connect wallet first.");
    const amt = (amountByPool[poolId] ?? "0").trim(); if (+amt <= 0) return;
    try{
      setPending("Withdrawing...");
      const tx = await staking.withdraw(poolId, parseUnits(amt, DDB_DECIMALS)); await tx.wait();
      setPending(""); setAmountByPool(a=>({...a,[poolId]:"0"}));
      await loadUserData();
      alert("Withdrawn!");
    }catch(e:any){ console.error(e); setPending(""); alert(e?.reason||e?.message||"Withdraw failed"); }
  }
  async function onEarly(poolId:number){
    if (!staking) return alert("Connect wallet first.");
    const amt = (amountByPool[poolId] ?? "0").trim(); if (+amt <= 0) return;
    try{
      setPending("Early withdrawing...");
      const tx = await staking.earlyWithdraw(poolId, parseUnits(amt, DDB_DECIMALS)); await tx.wait();
      setPending(""); setAmountByPool(a=>({...a,[poolId]:"0"}));
      await loadUserData();
      alert("Early withdrawal complete (penalty applied; rewards forfeited)");
    }catch(e:any){ console.error(e); setPending(""); alert(e?.reason||e?.message||"Early withdraw failed"); }
  }
  async function onClaim(poolId:number){
    if (!staking) return alert("Connect wallet first.");
    try{
      setPending("Claiming rewards...");
      const tx = await staking.getReward(poolId); await tx.wait();
      setPending(""); await loadUserData();
      alert("Rewards claimed!");
    }catch(e:any){ console.error(e); setPending(""); alert(e?.reason||e?.message||"Claim failed"); }
  }
  async function onExit(poolId:number){
    if (!staking) return alert("Connect wallet first.");
    try{
      setPending("Exit...");
      const tx = await staking.exit(poolId); await tx.wait();
      setPending(""); await loadUserData();
      alert("Exited (withdrew + claimed)");
    }catch(e:any){ console.error(e); setPending(""); alert(e?.reason||e?.message||"Exit failed"); }
  }

  /* ---------- Render ---------- */
  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div className="pool-head" style={{ marginBottom: 12 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
          <h2 style={{ margin:0 }}>DooDoo Butt — Staking</h2>
          <span className="small">
            {connected ? `Wallet DDB: ${fmt2(myDdb)}` : "Connect to see your wallet balance"}
          </span>
        </div>
        {connected ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span className="small">Connected: {signerAddr.slice(0,6)}…{signerAddr.slice(-4)}</span>
            <button className="btn" onClick={disconnect}>Disconnect</button>
          </div>
        ) : (
          <button className="btn" onClick={connect}>Connect Wallet (Sepolia)</button>
        )}
      </div>

      {!readProvider && (
        <div className="small" style={{ marginBottom: 12 }}>
          Set <code>NEXT_PUBLIC_SEPOLIA_RPC</code> (Infura/Alchemy) in Netlify env vars, or connect your wallet on Sepolia.
        </div>
      )}
      {!!readHint && <div className="small" style={{ marginBottom: 12 }}>{readHint}</div>}

      <div className="pool-grid">
        {(!readReady || pools.length === 0) ? (
          <div className="pool-card">
            <div className="pool-head">
              <div className="pool-title">Loading pools…</div>
              <span className="badge">—</span>
            </div>
            <p className="small" style={{ marginTop:8 }}>
              If this never loads: confirm the staking address is set and <code>NEXT_PUBLIC_SEPOLIA_RPC</code> is configured.
            </p>
          </div>
        ) : (
          pools.map((p) => {
            const lockTxt = p.lockPeriod === 0n ? "Flex" : `${days(p.lockPeriod)}d`;
            const apr = (Number(p.aprBps)/100).toFixed(2);
            const myBal = connected ? (myBalances[p.id] ?? "0") : "—";
            const myEarn = connected ? (myEarned[p.id] ?? "0") : "—";
            const inputVal = amountByPool[p.id] ?? "0";
            return (
              <div key={p.id} className="pool-card">
                <div className="pool-head">
                  <div className="pool-title">Pool {poolName(p.id)}</div>
                  <span className="badge">{lockTxt}</span>
                </div>

                <div className="apr">{apr}% APR</div>
                <div className="kv"><span>Total Staked</span><span>{fmtInt(formatUnits(p.totalSupply, DDB_DECIMALS))} DDB</span></div>
                <div className="kv"><span>Your Stake</span><span>{connected ? `${fmt2(myBal)} DDB` : "—"}</span></div>
                <div className="kv"><span>Your Earned</span><span>{connected ? `${fmt2(myEarn)} DDB` : "—"}</span></div>

                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.000000000000000001"
                  value={inputVal}
                  onChange={(e)=>setAmountByPool(a=>({...a,[p.id]:e.target.value}))}
                  placeholder={connected ? "Amount (DDB)" : "Connect wallet to stake"}
                  disabled={!connected}
                />

                <div className="row">
                  <button className="btn" onClick={()=>onStake(p.id)}     disabled={!connected || pending!=="" || !VALID_STAKING}>Approve + Stake</button>
                  <button className="btn" onClick={()=>onWithdraw(p.id)}  disabled={!connected || pending!=="" || !VALID_STAKING}>Withdraw</button>
                  <button className="btn" onClick={()=>onEarly(p.id)}     disabled={!connected || pending!=="" || !VALID_STAKING}>Early Withdraw</button>
                  <button className="btn" onClick={()=>onClaim(p.id)}     disabled={!connected || pending!=="" || !VALID_STAKING}>Claim</button>
                  <button className="btn" onClick={()=>onExit(p.id)}      disabled={!connected || pending!=="" || !VALID_STAKING}>Exit</button>
                </div>

                {pending && <div className="small" style={{ marginTop:8 }}>⏳ {pending}</div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
