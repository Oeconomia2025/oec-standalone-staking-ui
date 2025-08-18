"use client";
import HeaderBar from "@/components/HeaderBar";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserProvider,
  JsonRpcProvider,
  Contract,
  formatUnits,
  parseUnits,
} from "ethers";
import {
  STAKING_ADDRESS,
  DDB_ADDRESS,
  DDB_DECIMALS,
  SEPOLIA_CHAIN_ID_HEX,
  SEPOLIA_RPC,
} from "@/lib/config";

/* ---------------- ABIs ---------------- */
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

/* ------------- Helpers / Defaults ------------- */
const VALID_STAKING =
  /^0x[a-fA-F0-9]{40}$/.test(STAKING_ADDRESS) &&
  STAKING_ADDRESS.toLowerCase() !== "0xyour_staking_contract";

type PoolInfo = {
  id: number;
  aprBps: bigint; // e.g. 2500 = 25.00%
  lockPeriod: bigint; // seconds
  totalSupply: bigint; // staked TVL in DDB
};

const SEPOLIA_ID = SEPOLIA_CHAIN_ID_HEX; // "0xaa36a7"
const SECONDS = { DAY: 86400 };
const DAYS = (d: number) => BigInt(d * SECONDS.DAY);

// PREVIEW (shown before pools exist on-chain)
const DEFAULT_POOLS: PoolInfo[] = [
  { id: 0, aprBps: 1500n, lockPeriod: DAYS(0), totalSupply: 0n }, // Flex 15%
  { id: 1, aprBps: 2500n, lockPeriod: DAYS(30), totalSupply: 0n }, // 30d 25%
  { id: 2, aprBps: 4000n, lockPeriod: DAYS(60), totalSupply: 0n }, // 60d 40%
  { id: 3, aprBps: 8000n, lockPeriod: DAYS(90), totalSupply: 0n }, // 90d 80%
];

const fmt2 = (s: string | number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(typeof s === "number" ? s : Number(s || "0"));
const fmt0 = (s: string | number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    typeof s === "number" ? s : Number(s || "0")
  );
const days = (sec: bigint) => (Number(sec) / SECONDS.DAY).toFixed(0);
const poolLabel = (id: number) =>
  ["Flexible Staking", "30-Day Lock", "60-Day Lock", "90-Day Lock"][id] ??
  `Pool ${String.fromCharCode(65 + id)}`;
const pill = (aprBps: bigint) => `${(Number(aprBps) / 100).toFixed(1)}% APY`;

const dailyReward = (amount: number, aprBps: bigint) =>
  (amount * (Number(aprBps) / 10000)) / 365;
const monthlyReward = (amount: number, aprBps: bigint) =>
  amount * (Number(aprBps) / 10000) * (30 / 365);

async function ensureSepolia(): Promise<boolean> {
  const eth: any = (window as any).ethereum;
  if (!eth) {
    alert("Please install MetaMask");
    return false;
  }
  const id: string = await eth.request({ method: "eth_chainId" });
  if (id === SEPOLIA_ID) return true;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_ID }],
    });
    return true;
  } catch (e: any) {
    if (e?.code === 4001) alert("Please approve the switch to Sepolia.");
    return false;
  }
}

export default function StakingWidgetNeo() {
  /** PUBLIC read provider (no wallet needed) */
  const readProvider = useMemo(() => {
    if (SEPOLIA_RPC) return new JsonRpcProvider(SEPOLIA_RPC);
    if (typeof window !== "undefined" && (window as any).ethereum) {
      return new BrowserProvider((window as any).ethereum);
    }
    return null;
  }, []);

  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [readHint, setReadHint] = useState("");

  /** Wallet / signer (only for user stats + actions) */
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signerAddr, setSignerAddr] = useState("");
  const [staking, setStaking] = useState<Contract | null>(null);
  const [ddb, setDdb] = useState<Contract | null>(null);

  const [myDdb, setMyDdb] = useState("0");
  const [myBalances, setMyBalances] = useState<Record<number, string>>({});
  const [myEarned, setMyEarned] = useState<Record<number, string>>({});
  const [amountByPool, setAmountByPool] = useState<Record<number, string>>({});
  const [tabByPool, setTabByPool] = useState<
    Record<number, "stake" | "unstake" | "rewards">
  >({});
  const [openByPool, setOpenByPool] = useState<Record<number, boolean>>({});
  const [pending, setPending] = useState("");

  // extra stats
  const [contractBal, setContractBal] = useState("0"); // staking contract's DDB balance

  const blockHandlerRef = useRef<((...args: any[]) => void) | null>(null);
  const connected = !!provider && !!signerAddr;

  /* -------- PUBLIC: load on-chain pools OR show preview -------- */
  async function loadPoolsPublic() {
    if (!VALID_STAKING || !readProvider) {
      setPools(DEFAULT_POOLS);
      setIsLive(false);
      setReadHint(
        !VALID_STAKING
          ? ""
          : "Set NEXT_PUBLIC_SEPOLIA_RPC or connect wallet to read live data"
      );
      return;
    }
    try {
      const st = new Contract(STAKING_ADDRESS, STAKING_ABI, readProvider);
      const count: bigint = await st.poolCount();
      if (Number(count) === 0) {
        setPools(DEFAULT_POOLS);
        setIsLive(false);
        setReadHint("Preview pools (no pools on-chain yet)");
      } else {
        const arr: PoolInfo[] = [];
        for (let i = 0; i < Number(count); i++) {
          const [, , aprBps, lockPeriod, totalSupply] = await st.getPoolInfo(i);
          arr.push({ id: i, aprBps, lockPeriod, totalSupply });
        }
        setPools(arr);
        setIsLive(true);
        setReadHint("");
      }

      // contract's DDB token balance (for "rewards reserve" rough estimate)
      try {
        const tok = new Contract(DDB_ADDRESS, ERC20_ABI, readProvider);
        const bal: bigint = await tok.balanceOf(STAKING_ADDRESS);
        setContractBal(formatUnits(bal, DDB_DECIMALS));
      } catch {}
    } catch {
      setPools(DEFAULT_POOLS);
      setIsLive(false);
      setReadHint("Preview pools (RPC read failed)");
    }
  }

  useEffect(() => {
    loadPoolsPublic();
    if ((readProvider as any)?.on) {
      const onBlock = () => loadPoolsPublic();
      (readProvider as any).on("block", onBlock);
      return () => (readProvider as any).removeListener?.("block", onBlock);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readProvider, VALID_STAKING]);

  /* ---------------- Connect / Disconnect ---------------- */
  async function initFromEthereum(ethereum: any) {
    const ok = await ensureSepolia();
    if (!ok) return;

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
    try {
      const bal: bigint = await token.balanceOf(addr);
      setMyDdb(formatUnits(bal, DDB_DECIMALS));
    } catch {}

    if (VALID_STAKING && isLive) {
      const st = new Contract(STAKING_ADDRESS, STAKING_ABI, signer);
      setStaking(st);
      await loadUserData(st, addr);
    } else {
      setStaking(null);
      setMyBalances({});
      setMyEarned({});
    }

    const onBlock = async () => {
      try {
        const bal: bigint = await token.balanceOf(addr);
        setMyDdb(formatUnits(bal, DDB_DECIMALS));
        if (staking && isLive) await loadUserData(staking, addr);
      } catch {}
    };
    blockHandlerRef.current = onBlock;
    (prov as any).on?.("block", onBlock);
  }

  async function connect() {
    const { ethereum } = window as any;
    if (!ethereum) {
      alert("Please install MetaMask");
      return;
    }
    await ethereum.request({ method: "eth_requestAccounts" });
    await initFromEthereum(ethereum);
  }

  async function disconnect() {
    try {
      if (provider && blockHandlerRef.current) {
        (provider as any).removeListener?.("block", blockHandlerRef.current);
      }
    } catch {}
    blockHandlerRef.current = null;

    setProvider(null);
    setSignerAddr("");
    setStaking(null);
    setDdb(null);
    setMyBalances({});
    setMyEarned({});
    setMyDdb("0");
  }

  /* ---------------- User data (needs wallet + live pools) ---------------- */
  async function loadUserData(st?: Contract | null, who?: string) {
    const s = st ?? staking;
    const addr = who ?? signerAddr;
    if (!s || !addr) return;
    const balances: Record<number, string> = {};
    const earned: Record<number, string> = {};
    for (const p of pools) {
      const b: bigint = await s.balanceOf(p.id, addr);
      const e: bigint = await s.earned(p.id, addr);
      balances[p.id] = formatUnits(b, DDB_DECIMALS);
      earned[p.id] = formatUnits(e, DDB_DECIMALS);
    }
    setMyBalances(balances);
    setMyEarned(earned);
  }

  /* ---------------- Actions ---------------- */
  async function ensureAllowance(amount: string) {
    if (!ddb || !signerAddr) throw new Error("No token or signer");
    const need = parseUnits(amount, DDB_DECIMALS);
    const allowance: bigint = await ddb.allowance(signerAddr, STAKING_ADDRESS);
    if (allowance < need) {
      setPending("Approving…");
      const tx = await ddb.approve(STAKING_ADDRESS, need);
      await tx.wait();
    }
  }
  async function stake(poolId: number) {
    if (!staking || !isLive) return alert("Pools aren’t live yet.");
    const amt = (amountByPool[poolId] ?? "0").trim();
    if (+amt <= 0) return;
    try {
      await ensureSepolia();
      await ensureAllowance(amt);
      setPending("Staking…");
      const tx = await staking.stake(poolId, parseUnits(amt, DDB_DECIMALS));
      await tx.wait();
      setPending("");
      setAmountByPool((a) => ({ ...a, [poolId]: "0" }));
      await loadUserData();
      alert("Staked!");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Stake failed");
    }
  }
  async function withdraw(poolId: number) {
    if (!staking || !isLive) return alert("Pools aren’t live yet.");
    const amt = (amountByPool[poolId] ?? "0").trim();
    if (+amt <= 0) return;
    try {
      setPending("Withdrawing…");
      const tx = await staking.withdraw(poolId, parseUnits(amt, DDB_DECIMALS));
      await tx.wait();
      setPending("");
      setAmountByPool((a) => ({ ...a, [poolId]: "0" }));
      await loadUserData();
      alert("Withdrawn!");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Withdraw failed");
    }
  }
  async function early(poolId: number) {
    if (!staking || !isLive) return alert("Pools aren’t live yet.");
    const amt = (amountByPool[poolId] ?? "0").trim();
    if (+amt <= 0) return;
    try {
      setPending("Early withdrawing…");
      const tx = await staking.earlyWithdraw(
        poolId,
        parseUnits(amt, DDB_DECIMALS)
      );
      await tx.wait();
      setPending("");
      setAmountByPool((a) => ({ ...a, [poolId]: "0" }));
      await loadUserData();
      alert("Early withdrawal complete");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Early withdraw failed");
    }
  }
  async function claim(poolId: number) {
    if (!staking || !isLive) return alert("Pools aren’t live yet.");
    try {
      setPending("Claiming…");
      const tx = await staking.getReward(poolId);
      await tx.wait();
      setPending("");
      await loadUserData();
      alert("Rewards claimed!");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Claim failed");
    }
  }
  async function exit(poolId: number) {
    if (!staking || !isLive) return alert("Pools aren’t live yet.");
    try {
      setPending("Exit…");
      const tx = await staking.exit(poolId);
      await tx.wait();
      setPending("");
      await loadUserData();
      alert("Exited (withdrew + claimed)");
    } catch (e: any) {
      console.error(e);
      setPending("");
      alert(e?.reason || e?.message || "Exit failed");
    }
  }

  /* ---------- Derived sidebar stats ---------- */
  // TVL: sum of pool totalSupply
  const tvl = pools.reduce((acc, p) => {
    try {
      return acc + Number(formatUnits(p.totalSupply, DDB_DECIMALS));
    } catch {
      return acc;
    }
  }, 0);

  // Rewards reserve (rough): contract token balance minus TVL (never below zero)
  const reserve = Math.max(Number(contractBal || "0") - tvl, 0);

  // Your totals (if connected + live)
  const yourStakedTotal = Object.values(myBalances).reduce(
    (a, b) => a + Number(b || "0"),
    0
  );
  const yourUnclaimed = Object.values(myEarned).reduce(
    (a, b) => a + Number(b || "0"),
    0
  );

  const aprs = pools.map((p) => Number(p.aprBps) / 100);
  const aprMin = aprs.length ? Math.min(...aprs) : 0;
  const aprMax = aprs.length ? Math.max(...aprs) : 0;

  /* ---------------- Render ---------------- */
  return (
    <>
      <HeaderBar
        connected={connected}
        address={signerAddr}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <div className="layout">
        {/* -------- Sidebar (Dashboard) -------- */}
        <aside className="sidebar">
          <div className="side-section">
            <div className="side-title">Wallet (unstaked)</div>
            <div className="large">
              {fmt2(myDdb)} <span className="unit">DDB</span>
            </div>
            {connected && (
              <div className="muted">
                {signerAddr.slice(0, 6)}…{signerAddr.slice(-4)}
              </div>
            )}
          </div>

          <div className="side-grid">
            <div className="stat">
              <div className="stat-label">Total Staked (TVL)</div>
              <div className="stat-value">{fmt0(tvl)} DDB</div>
            </div>
            <div className="stat">
              <div className="stat-label">Rewards Reserve*</div>
              <div className="stat-value">{fmt0(reserve)} DDB</div>
            </div>
            <div className="stat">
              <div className="stat-label">Pools</div>
              <div className="stat-value">
                {pools.length}
                {!isLive ? " (preview)" : ""}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">APRs</div>
              <div className="stat-value">
                {aprs.length
                  ? aprMin === aprMax
                    ? `${aprMin.toFixed(1)}%`
                    : `${aprMin.toFixed(1)}–${aprMax.toFixed(1)}%`
                  : "—"}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Your Staked Total</div>
              <div className="stat-value">{fmt2(yourStakedTotal)} DDB</div>
            </div>
            <div className="stat">
              <div className="stat-label">Your Unclaimed</div>
              <div className="stat-value">{fmt2(yourUnclaimed)} DDB</div>
            </div>
          </div>

          {readHint && (
            <div className="small" style={{ marginTop: 10 }}>
              {readHint}
            </div>
          )}
          <div className="small muted" style={{ marginTop: 8 }}>
            *Reserve ≈ Contract DDB − TVL
          </div>
        </aside>

        {/* -------- Main: pool cards -------- */}
        <main className="main">
          <div className="neo-list">
            {pools.map((p) => {
              const opened = !!openByPool[p.id];
              const tab = tabByPool[p.id] || "stake";
              const lockTxt =
                p.lockPeriod === 0n ? "Flexible" : `${days(p.lockPeriod)} Days`;
              const totalStaked = isLive
                ? `${fmt0(formatUnits(p.totalSupply, DDB_DECIMALS))} DDB`
                : "—";
              const myBal = connected && isLive ? myBalances[p.id] ?? "0" : "0";
              const myEarn = connected && isLive ? myEarned[p.id] ?? "0" : "0";
              const inputVal = amountByPool[p.id] ?? "0";
              const amountNum = Number(inputVal || "0");
              const estDaily = fmt2(dailyReward(amountNum, p.aprBps));
              const estMonthly = fmt2(monthlyReward(amountNum, p.aprBps));
              const theme = [
                "theme-blue",
                "theme-teal",
                "theme-purple",
                "theme-gold",
              ][p.id % 4];

              return (
                <div key={p.id} className={`neo-card ${theme}`}>
                  <button
                    className="neo-head"
                    onClick={() =>
                      setOpenByPool((o) => ({ ...o, [p.id]: !opened }))
                    }
                    title="Expand / Collapse"
                  >
                    <div className="neo-icon">🔒</div>
                    <div className="neo-head-mid">
                      <div className="neo-head-title">
                        OEC {poolLabel(p.id)}{" "}
                        <span className="neo-badge">{pill(p.aprBps)}</span>
                      </div>
                      <div className="neo-head-meta">
                        <span>⏱ {lockTxt}</span>
                        <span> {totalStaked} staked</span>
                      </div>
                    </div>
                    <div className="neo-head-right">
                      <div className="neo-head-total">
                        {connected && isLive ? fmt0(myBal) : "0"}{" "}
                        <span>DDB</span>
                      </div>
                      <div className={`neo-chevron ${opened ? "open" : ""}`}>
                        ▾
                      </div>
                    </div>
                  </button>

                  {opened && (
                    <div className="neo-body">
                      {/* Tabs + actions row */}
{/* Tabs + actions row */}
<div className="seg-row">
  <div className="seg">
    {/* Stake / Unstake / Rewards buttons (unchanged) */}
    {(["stake","unstake","rewards"] as const).map(t => (
      <button
        key={t}
        className={`seg-btn ${tab === t ? "active" : ""}`}
        onClick={() => setTabByPool(x => ({ ...x, [p.id]: t }))}
      >
        {t === "stake" ? "Stake" : t === "unstake" ? "Unstake" : "Rewards"}
      </button>
    ))}
  </div>

  <div className="seg-actions">
    <button
      className="btn danger"
      disabled={!connected || !isLive || pending !== ""}
      onClick={() => early(p.id)}
    >
      Early Withdraw
    </button>

    <button
      className="btn ghost"
      disabled={!connected || !isLive || pending !== ""}
      onClick={() => exit(p.id)}
    >
      Exit (Withdraw + Claim)
    </button>
  </div>
</div>


                      <div className="neo-content">
                        {/* Left column */}
                        <div className="neo-col">
                          {tab === "stake" && (
                            <>
                              <div className="neo-label">Amount to Stake</div>
                              <div className="input-cta">
                                <input
                                  className="input"
                                  type="text"
                                  min="0"
                                  step="0.000000000000000001"
                                  placeholder="0.0"
                                  value={inputVal}
                                  onChange={(e) =>
                                    setAmountByPool((a) => ({
                                      ...a,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                />
                                <button
                                  className="btn cta primary"
                                  disabled={
                                    !connected || !isLive || pending !== ""
                                  }
                                  onClick={() => stake(p.id)}
                                >
                                  Stake
                                </button>
                              </div>

                              <div className="neo-quick">
                                {["25", "50", "75", "Max"].map((q) => (
                                  <button
                                    key={q}
                                    className="chip"
                                    disabled={!connected || !isLive}
                                    onClick={() => {
                                      const base = Number(myDdb || "0");
                                      const amt =
                                        q === "Max"
                                          ? base
                                          : base * (Number(q) / 100);
                                      setAmountByPool((a) => ({
                                        ...a,
                                        [p.id]: (amt || 0).toString(),
                                      }));
                                    }}
                                  >
                                    {q}%
                                  </button>
                                ))}
                              </div>
                              <div className="small">
                                Min/Max are enforced by contract (if any).
                                Ensure you’ve approved enough DDB.
                              </div>
                            </>
                          )}

                          {tab === "unstake" && (
                            <>
                              <div className="neo-label">Amount to Unstake</div>
                              <div className="input-cta">
                                <input
                                  className="input"
                                  type="number"
                                  min="0"
                                  step="0.000000000000000001"
                                  value={inputVal}
                                  onChange={(e) =>
                                    setAmountByPool((a) => ({
                                      ...a,
                                      [p.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={
                                    isLive
                                      ? `Available: ${fmt2(myBal)} DDB`
                                      : "Pools not live yet"
                                  }
                                  disabled={!connected || !isLive}
                                />
                                <button
                                  className="btn cta"
                                  disabled={
                                    !connected || !isLive || pending !== ""
                                  }
                                  onClick={() => withdraw(p.id)}
                                >
                                  Unstake
                                </button>
                              </div>

                              <div className="neo-quick">
                                {["25", "50", "75", "Max"].map((q) => (
                                  <button
                                    key={q}
                                    className="chip"
                                    disabled={!connected || !isLive}
                                    onClick={() => {
                                      const base = Number(myBal || "0");
                                      const amt =
                                        q === "Max"
                                          ? base
                                          : base * (Number(q) / 100);
                                      setAmountByPool((a) => ({
                                        ...a,
                                        [p.id]: (amt || 0).toString(),
                                      }));
                                    }}
                                  >
                                    {q}%
                                  </button>
                                ))}
                              </div>
                              <div className="small">
                                Early unstaking may apply penalties (see pool
                                rules).
                              </div>
                            </>
                          )}

                          {tab === "rewards" && (
                            <>
                              <div className="neo-wrapper">
                                <div className="neo-rewards">
                                  <div className="neo-reward-main">
                                    {fmt2(myEarn)} <span>DDB</span>
                                  </div>
                                  <div className="small">Available Rewards</div>
<button
  className="btn success big"   // ← add `big`
  disabled={!connected || earnedIsZero || pending !== ""}
  onClick={() => claimRewards(p.id)}
>
  Claim Rewards
</button>

                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Right column */}
                        <div className="neo-col">
                          <div className="panel">
                            {tab !== "rewards" ? (
                              <>
                                <div className="kv">
                                  <span>Estimated Daily Rewards:</span>
                                  <span>{estDaily} DDB</span>
                                </div>
                                <div className="kv">
                                  <span>Estimated Monthly Rewards:</span>
                                  <span>{estMonthly} DDB</span>
                                </div>
                                <div className="kv">
                                  <span>Lock Period:</span>
                                  <span>{lockTxt}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="kv">
                                  <span>Total Earned:</span>
                                  <span>{fmt2(myEarn)} DDB</span>
                                </div>
                                <div className="kv">
                                  <span>Next Reward:</span>
                                  <span>—</span>
                                </div>
                                <div className="kv">
                                  <span>Distribution:</span>
                                  <span>per block</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer actions */}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}
