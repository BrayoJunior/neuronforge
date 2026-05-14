"use client";

import { useState, useEffect, useCallback } from "react";
import { getProvider } from "../utils/wallet";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const FALLBACK_CHAIN = {
  chainId: "0x40DA",
  chainName: "0G-Galileo-Testnet",
  rpcUrls: ["https://evmrpc-testnet.0g.ai"],
  nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
  blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
  network: "testnet",
};

interface ChainConfig {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
  network: string;
}

export default function Navbar() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [chainOk, setChainOk] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pathname, setPathname] = useState("/");
  const [targetChain, setTargetChain] = useState<ChainConfig>(FALLBACK_CHAIN);

  useEffect(() => {
    setPathname(window.location.pathname);
    fetchNetworkConfig();
  }, []);

  const fetchNetworkConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/network`);
      if (res.ok) {
        const config = await res.json();
        setTargetChain(config);
        console.log(`🌐 Backend network: ${config.network} (${config.chainName})`);
      }
    } catch {
      console.log("⚠️ Backend unreachable, using fallback testnet config");
    }
  };

  // Auto-detect existing connection on mount
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const init = async () => {
      try {
        const accounts = await provider.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          fetchBalanceSafe(accounts[0], provider);
          checkChainSafe(provider);
        }
      } catch (e) {
        console.log("Auto-connect skipped:", e);
      }
    };
    init();

    try {
      provider.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null);
          setBalance(null);
        } else {
          setAddress(accounts[0]);
          fetchBalanceSafe(accounts[0], provider);
        }
      });
      provider.on("chainChanged", () => {
        const addr = address;
        checkChainSafe(provider);
        if (addr) fetchBalanceSafe(addr, provider);
      });
    } catch (e) {
      console.log("Event listeners skipped:", e);
    }
  }, [targetChain]);

  const checkChainSafe = async (provider?: any) => {
    try {
      const eth = provider || getProvider();
      if (!eth) return;
      const chainId = await eth.request({ method: "eth_chainId" });
      setChainOk(chainId.toLowerCase() === targetChain.chainId.toLowerCase());
    } catch (e) {
      console.log("Chain check failed:", e);
    }
  };

  const fetchBalanceSafe = async (addr: string, provider?: any) => {
    try {
      const eth = provider || getProvider();
      if (!eth) return;
      const bal = await eth.request({
        method: "eth_getBalance",
        params: [addr, "latest"],
      });
      const ogBal = parseInt(bal, 16) / 1e18;
      setBalance(ogBal.toFixed(3));
    } catch (e) {
      console.log("Balance fetch failed:", e);
      setBalance(null);
    }
  };

  const switchToOG = async () => {
    const provider = getProvider();
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChain.chainId }],
      });
      setChainOk(true);
      if (address) fetchBalanceSafe(address, provider);
    } catch (e: any) {
      if (e.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: targetChain.chainId,
              chainName: targetChain.chainName,
              rpcUrls: targetChain.rpcUrls,
              nativeCurrency: targetChain.nativeCurrency,
              blockExplorerUrls: targetChain.blockExplorerUrls,
            }],
          });
          setChainOk(true);
          if (address) fetchBalanceSafe(address, provider);
        } catch (addError) {
          console.error("Failed to add network:", addError);
        }
      }
    }
  };

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setConnecting(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        fetchBalanceSafe(accounts[0], provider);
        checkChainSafe(provider);
      }
    } catch (e) {
      console.error("Wallet connection failed:", e);
    } finally {
      setConnecting(false);
    }
  }, [targetChain]);

  const disconnect = () => {
    setAddress(null);
    setBalance(null);
  };

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  const navLinks = [
    { href: "/forge", label: "⚡ Forge" },
    { href: "/skills", label: "🔧 Skills" },
    { href: "/marketplace", label: "🛒 Marketplace" },
  ];

  const networkLabel = targetChain.network === "mainnet" ? "Mainnet" : "Testnet";
  const networkColor = targetChain.network === "mainnet" ? "#22c55e" : "#06b6d4";

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <a href="/" className="navbar-brand">
          <span className="brand-icon">⚡</span>
          NeuronForge
          <span style={{
            fontSize: "0.6rem",
            padding: "2px 6px",
            borderRadius: "4px",
            background: `${networkColor}20`,
            color: networkColor,
            border: `1px solid ${networkColor}40`,
            marginLeft: "8px",
            fontWeight: 600,
          }}>
            {networkLabel}
          </span>
        </a>

        <button
          className="mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>

        <ul className={`navbar-links ${mobileOpen ? "open" : ""}`}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={pathname === link.href ? "nav-active" : ""}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            {address ? (
              <div className="wallet-connected">
                {!chainOk && (
                  <button
                    className="btn btn-sm"
                    onClick={switchToOG}
                    style={{
                      background: "rgba(255, 100, 100, 0.2)",
                      border: "1px solid rgba(255, 100, 100, 0.5)",
                      color: "#ff6b6b",
                      marginRight: "8px",
                      fontSize: "0.75rem",
                    }}
                  >
                    ⚠️ Switch to 0G {networkLabel}
                  </button>
                )}
                {balance && (
                  <span className="wallet-balance">
                    <span className="live-dot" style={{ width: 6, height: 6, marginRight: 4 }} />
                    {balance} OG
                  </span>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={disconnect}
                  id="connect-wallet-btn"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: chainOk ? "#00e676" : "#ff6b6b",
                    display: "inline-block",
                  }} />
                  {shortAddr}
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={connect}
                disabled={connecting}
                id="connect-wallet-btn"
              >
                {connecting ? "Connecting..." : "🔗 Connect Wallet"}
              </button>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
}
