"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { getProvider } from "../utils/wallet";

const INFT_ADDRESS = "0xEC301d01Cf816010A2f1c4f8ef05726405277fA9";
const INFT_ABI = [
  "function mintAgent(address to, string metadataURI, bytes encryptedIntelligence) external returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "event AgentMinted(uint256 indexed tokenId, address indexed to, string metadataURI)",
];

interface Listing {
  id: string;
  name: string;
  description: string;
  price: string;
  skills: string[];
  creator: string;
  rating: number;
  sales: number;
  persona: string;
}

const DEMO_LISTINGS: Listing[] = [
  {
    id: "1",
    name: "Alpha Hunter",
    description: "Autonomous DeFi agent specialized in yield farming optimization. Monitors 50+ protocols and executes position management with verified inference.",
    price: "Free",
    skills: ["0g-inference", "0g-wallet", "0g-memory"],
    creator: "0x3BD5...4343",
    rating: 4.8,
    sales: 24,
    persona: "Expert DeFi yield analyst. You find the best farming opportunities across 0G Chain protocols.",
  },
  {
    id: "2",
    name: "Research Oracle",
    description: "Deep research agent that synthesizes information and persists findings to 0G Storage. Perfect for market research and competitive analysis.",
    price: "Free",
    skills: ["0g-inference", "0g-memory"],
    creator: "0x3BD5...4343",
    rating: 4.6,
    sales: 18,
    persona: "Thorough research agent. You synthesize information, store findings in persistent memory, and provide well-cited analysis.",
  },
  {
    id: "3",
    name: "Data Cruncher",
    description: "Specialized data analysis agent with persistent memory. Processes datasets, generates summaries and actionable insights.",
    price: "Free",
    skills: ["0g-inference", "0g-memory"],
    creator: "0x3BD5...4343",
    rating: 4.9,
    sales: 31,
    persona: "Data analysis expert. You process data, generate statistical insights, and communicate findings clearly with supporting data.",
  },
  {
    id: "4",
    name: "Smart Contract Auditor",
    description: "Security-focused agent that analyzes smart contracts on 0G Chain. Identifies vulnerabilities and generates audit reports.",
    price: "Free",
    skills: ["0g-inference", "0g-wallet", "0g-memory"],
    creator: "0x3BD5...4343",
    rating: 4.7,
    sales: 12,
    persona: "Expert Solidity auditor. You identify common vulnerabilities like reentrancy, overflow, and access control issues.",
  },
  {
    id: "5",
    name: "Content Strategist",
    description: "Creative writing and content strategy agent. Generates blog posts, social media content, and marketing copy.",
    price: "Free",
    skills: ["0g-inference", "0g-memory"],
    creator: "0x3BD5...4343",
    rating: 4.5,
    sales: 42,
    persona: "Creative content strategist. You generate engaging blog posts, social media content, and marketing copy with brand consistency.",
  },
  {
    id: "6",
    name: "Portfolio Manager",
    description: "Full-suite portfolio management agent. Tracks positions, rebalances strategies, and provides real-time P&L reporting.",
    price: "Free",
    skills: ["0g-inference", "0g-wallet", "0g-memory"],
    creator: "0x3BD5...4343",
    rating: 4.9,
    sales: 8,
    persona: "Expert portfolio manager. You track DeFi positions, suggest rebalancing strategies, and provide real-time P&L analysis.",
  },
];

export default function MarketplacePage() {
  const [listings] = useState<Listing[]>(DEMO_LISTINGS);
  const [sortBy, setSortBy] = useState<"price" | "rating" | "sales">("rating");
  const [mintingId, setMintingId] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<Record<string, { tokenId: string; txHash: string } | null>>({});

  const sorted = [...listings].sort((a, b) => {
    if (sortBy === "price") return 0;
    if (sortBy === "rating") return b.rating - a.rating;
    return b.sales - a.sales;
  });

  const handleMint = async (listing: Listing) => {
    const eth = getProvider();
    if (!eth) {
      alert("Please install MetaMask to mint agent INFTs");
      return;
    }

    setMintingId(listing.id);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const userAddress = accounts[0];

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);

      const metadataURI = `0g-storage://marketplace/${listing.name.toLowerCase().replace(/\s+/g, "-")}/${Date.now()}`;
      const intelligence = JSON.stringify({
        name: listing.name,
        persona: listing.persona,
        skills: listing.skills,
        description: listing.description,
      });

      const tx = await contract.mintAgent(
        userAddress,
        metadataURI,
        ethers.toUtf8Bytes(intelligence)
      );

      const receipt = await tx.wait();

      // Parse token ID from event
      let tokenId = "N/A";
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          return parsed?.name === "AgentMinted";
        } catch { return false; }
      });
      if (mintEvent) {
        const parsed = contract.interface.parseLog({ topics: mintEvent.topics as string[], data: mintEvent.data });
        tokenId = parsed?.args[0]?.toString() || "N/A";
      }

      setMintResult(prev => ({ ...prev, [listing.id]: { tokenId, txHash: tx.hash } }));
    } catch (e: any) {
      if (e.code !== 4001) {
        alert(`Mint failed: ${e.reason || e.message}`);
      }
    } finally {
      setMintingId(null);
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <div className="flex-between" style={{ marginBottom: "2rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.5rem" }}>
            <span className="text-gradient">🛒 Agent Marketplace</span>
          </h1>
          <p className="text-secondary">
            Mint agent INFTs directly to your wallet via MetaMask
          </p>
        </div>
        <a href="/forge" className="btn btn-primary">
          ⚡ Create Custom Agent
        </a>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-sm" style={{ marginBottom: "1.5rem", alignItems: "center" }}>
        <span className="text-muted text-small">Sort by:</span>
        {(["rating", "sales", "price"] as const).map((s) => (
          <button
            key={s}
            className={`btn ${sortBy === s ? "btn-primary" : "btn-ghost"} btn-sm`}
            onClick={() => setSortBy(s)}
          >
            {s === "rating" ? "⭐ Rating" : s === "sales" ? "📈 Sales" : "💰 Price"}
          </button>
        ))}
      </div>

      {/* Listings Grid */}
      <div className="grid grid-3">
        {sorted.map((listing) => (
          <div key={listing.id} className="card" id={`listing-${listing.id}`}>
            {/* Header */}
            <div style={{ marginBottom: "1rem" }}>
              <div className="flex-between" style={{ marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.1rem", margin: 0 }}>{listing.name}</h3>
                <span className="badge badge-cyan" style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  {listing.price === "Free" ? "🆓 Free Mint" : `${listing.price} OG`}
                </span>
              </div>
              <span className="text-muted text-small">by {listing.creator}</span>
            </div>

            {/* Description */}
            <p className="text-secondary" style={{ fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "1rem" }}>
              {listing.description}
            </p>

            {/* Skills */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {listing.skills.map((skill) => (
                <span key={skill} className="skill-chip" style={{ cursor: "default" }}>
                  {skill}
                </span>
              ))}
            </div>

            {/* Mint Result */}
            {mintResult[listing.id] && (
              <div style={{
                padding: "0.75rem",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: 8,
                marginBottom: "1rem",
                fontSize: "0.75rem",
              }}>
                <div style={{ color: "#22c55e", fontWeight: 700, marginBottom: 4 }}>✅ Minted Successfully!</div>
                <div>Token ID: <strong>#{mintResult[listing.id]!.tokenId}</strong></div>
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${mintResult[listing.id]!.txHash}`}
                  target="_blank"
                  rel="noopener"
                  style={{ color: "#06b6d4", textDecoration: "none" }}
                >
                  🔗 View on Explorer →
                </a>
              </div>
            )}

            {/* Stats & Action */}
            <div className="flex-between">
              <div className="flex gap-md">
                <span className="text-small" style={{ color: "#f59e0b" }}>
                  ⭐ {listing.rating}
                </span>
                <span className="text-small text-muted">
                  📦 {listing.sales} sold
                </span>
              </div>
              {mintResult[listing.id] ? (
                <span className="btn btn-secondary btn-sm" style={{ opacity: 0.7, cursor: "default" }}>
                  ✅ Owned
                </span>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  id={`buy-${listing.id}`}
                  onClick={() => handleMint(listing)}
                  disabled={mintingId === listing.id}
                  style={mintingId === listing.id ? { opacity: 0.7, cursor: "wait" } : {}}
                >
                  {mintingId === listing.id ? "⏳ Minting..." : "🎭 Mint INFT"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="card-glass" style={{ marginTop: "2rem", padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
        <span style={{ fontSize: "2rem" }}>🎭</span>
        <div>
          <h4 style={{ marginBottom: "0.25rem" }}>Powered by ERC-7857 INFTs on 0G Chain</h4>
          <p className="text-secondary text-small">
            Every agent is minted as an INFT directly to your wallet. You sign the transaction with MetaMask — no intermediaries. The agent&apos;s intelligence (skills, persona, memory) is encrypted and stored on-chain. You own the INFT and can transfer or clone it.
          </p>
        </div>
      </div>
    </div>
  );
}
