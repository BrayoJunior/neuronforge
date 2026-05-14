"use client";

import { useState } from "react";

interface Listing {
  id: string;
  name: string;
  description: string;
  price: string;
  skills: string[];
  creator: string;
  rating: number;
  sales: number;
}

const DEMO_LISTINGS: Listing[] = [
  {
    id: "1",
    name: "Alpha Hunter",
    description: "Autonomous DeFi agent specialized in yield farming optimization. Monitors 50+ protocols and executes position management with verified inference.",
    price: "2.5",
    skills: ["0g-inference", "0g-wallet", "0g-memory"],
    creator: "0x8a3f...d42e",
    rating: 4.8,
    sales: 24,
  },
  {
    id: "2",
    name: "Research Oracle",
    description: "Deep research agent that browses the web, synthesizes information, and persists findings to 0G Storage. Perfect for market research and competitive analysis.",
    price: "1.8",
    skills: ["0g-inference", "0g-memory", "web-browser"],
    creator: "0xf2b1...7a9c",
    rating: 4.6,
    sales: 18,
  },
  {
    id: "3",
    name: "Data Cruncher",
    description: "Specialized data analysis agent with persistent memory. Processes CSV, JSON, and API data. Generates charts, summaries, and actionable insights.",
    price: "1.2",
    skills: ["0g-inference", "0g-memory", "file-system"],
    creator: "0xb4c2...1e5f",
    rating: 4.9,
    sales: 31,
  },
  {
    id: "4",
    name: "Smart Contract Auditor",
    description: "Security-focused agent that reads and analyzes smart contracts on 0G Chain. Identifies common vulnerabilities and generates audit reports.",
    price: "3.0",
    skills: ["0g-inference", "0g-wallet", "0g-memory"],
    creator: "0x5d91...c3a8",
    rating: 4.7,
    sales: 12,
  },
  {
    id: "5",
    name: "Content Strategist",
    description: "Creative writing and content strategy agent. Generates blog posts, social media content, and marketing copy with brand voice consistency.",
    price: "0.8",
    skills: ["0g-inference", "0g-memory"],
    creator: "0x7e24...f6b3",
    rating: 4.5,
    sales: 42,
  },
  {
    id: "6",
    name: "Portfolio Manager",
    description: "Full-suite portfolio management agent. Tracks positions across DeFi protocols, rebalances based on strategy, and provides real-time P&L reporting.",
    price: "5.0",
    skills: ["0g-inference", "0g-wallet", "0g-memory", "web-browser"],
    creator: "0xa3f8...2d91",
    rating: 4.9,
    sales: 8,
  },
];

export default function MarketplacePage() {
  const [listings] = useState<Listing[]>(DEMO_LISTINGS);
  const [sortBy, setSortBy] = useState<"price" | "rating" | "sales">("rating");

  const sorted = [...listings].sort((a, b) => {
    if (sortBy === "price") return parseFloat(a.price) - parseFloat(b.price);
    if (sortBy === "rating") return b.rating - a.rating;
    return b.sales - a.sales;
  });

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <div className="flex-between" style={{ marginBottom: "2rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.5rem" }}>
            <span className="text-gradient">🛒 Agent Marketplace</span>
          </h1>
          <p className="text-secondary">
            Browse and buy agent INFTs with verified capabilities
          </p>
        </div>
        <a href="/forge" className="btn btn-primary">
          ⚡ Create & List
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
                  {listing.price} OG
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
              <button className="btn btn-primary btn-sm" id={`buy-${listing.id}`}>
                Buy INFT
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="card-glass" style={{ marginTop: "2rem", padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
        <span style={{ fontSize: "2rem" }}>🎭</span>
        <div>
          <h4 style={{ marginBottom: "0.25rem" }}>Powered by ERC-7857 INFTs</h4>
          <p className="text-secondary text-small">
            Every agent on the marketplace is tokenized as an INFT on 0G Chain. When you buy an agent, you receive its full encrypted intelligence — Skills, memory, persona, and config — transferred atomically via TEE-verified re-encryption.
          </p>
        </div>
      </div>
    </div>
  );
}
