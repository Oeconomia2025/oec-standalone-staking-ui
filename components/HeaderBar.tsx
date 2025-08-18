"use client";
import React from "react";

type Props = {
  connected: boolean;
  address?: string;
  onConnect: () => void;
  onDisconnect: () => void;
};

const LOGO_URL =
  "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo.png";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export default function HeaderBar({
  connected,
  address,
  onConnect,
  onDisconnect,
}: Props) {
  return (
    <header className="oec-header">
      <div className="oec-brand">
        <img className="oec-logo" src={LOGO_URL} alt="Oeconomia" />
        <div className="oec-title">
          <span className="oec-gradient">OECONOMIA STAKING</span>{" "}
          <span className="oec-gradient"></span>
        </div>
      </div>

      <div className="oec-actions">
        {connected ? (
          <>
            <span className="oec-addr">{short(address)}</span>
            <button className="btn ghost" onClick={onDisconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={onConnect}>
            Connect Wallet (Sepolia)
          </button>
        )}
      </div>
    </header>
  );
}
