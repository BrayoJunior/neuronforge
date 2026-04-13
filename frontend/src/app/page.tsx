"use client";

import { useState, useEffect } from "react";

const FEATURES = [
  {
    icon: "🔨",
    title: "Visual Agent Builder",
    desc: "Create AI agents in seconds with a drag-and-drop skill composer. Choose a persona, compose skills, and deploy — no code required.",
    badge: "OpenClaw",
    badgeColor: "badge-purple",
  },
  {
    icon: "🧠",
    title: "0G Compute Inference",
    desc: "All agent reasoning runs through 0G's decentralized compute network with TEE-verified inference. DeepSeek V3, Qwen 2.5, and more.",
    badge: "0G Compute",
    badgeColor: "badge-cyan",
  },
  {
    icon: "💾",
    title: "Persistent Memory",
    desc: "Agent memory, conversation history, and learned preferences persist on 0G Storage. Agents resume exactly where they left off.",
    badge: "0G Storage",
    badgeColor: "badge-green",
  },
  {
    icon: "🎭",
    title: "INFT Tokenization",
    desc: "Mint agents as INFTs (ERC-7857) with encrypted intelligence. Transfer, clone, or trade agents with their full capabilities intact.",
    badge: "ERC-7857",
    badgeColor: "badge-amber",
  },
  {
    icon: "🛒",
    title: "Agent Marketplace",
    desc: "Browse, buy, and sell agent INFTs. Find specialized agents for DeFi, research, automation — or list your own creations.",
    badge: "0G Chain",
    badgeColor: "badge-cyan",
  },
  {
    icon: "🔗",
    title: "Composable Skills",
    desc: "Mix and match OpenClaw Skills to create unique agent capabilities. Inference, memory, wallet, browsing — or build your own.",
    badge: "Skills",
    badgeColor: "badge-rose",
  },
];

const INTEGRATIONS = [
  { name: "0G Compute", icon: "🤖", desc: "TEE-verified LLM inference" },
  { name: "0G Storage", icon: "💾", desc: "Decentralized state persistence" },
  { name: "0G Chain", icon: "⛓️", desc: "Smart contract platform" },
  { name: "INFTs", icon: "🎭", desc: "ERC-7857 agent tokenization" },
  { name: "0G DA", icon: "📊", desc: "Data availability layer" },
  { name: "OpenClaw", icon: "🦀", desc: "Agent orchestration runtime" },
];

const STATS = [
  { value: "5", label: "0G Components" },
  { value: "4", label: "Custom Skills" },
  { value: "∞", label: "Agent Possibilities" },
  { value: "<60s", label: "Agent Creation" },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="animate-fade-in">
            <div style={{ marginBottom: "1rem" }}>
              <span className="badge badge-cyan" style={{ fontSize: "0.8rem", padding: "0.4rem 1rem" }}>
                🚀 Decentralized Agentic Infrastructure — Powered by 0G
              </span>
            </div>
          </div>

          <h1 className="hero-title animate-slide-up stagger-1">
            The Decentralized<br />
            <span className="text-gradient">Agent Factory</span>
          </h1>

          <p className="hero-subtitle animate-slide-up stagger-2">
            Build, orchestrate, persist, and trade autonomous AI agents.
            Powered by <strong>OpenClaw</strong> runtime and <strong>0G Network</strong> infrastructure.
          </p>

          <div className="hero-actions animate-slide-up stagger-3">
            <a href="/forge" className="btn btn-primary btn-lg">
              ⚡ Start Building
            </a>
            <a href="/skills" className="btn btn-secondary btn-lg">
              🔧 Explore Skills
            </a>
          </div>

          {/* Stats Bar */}
          <div className="stats-bar animate-slide-up stagger-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="stat-item">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Strip */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <h2 className="text-center mb-xl" style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Powered by the 0G Ecosystem
          </h2>
          <div className="grid grid-3" style={{ gap: "1rem" }}>
            {INTEGRATIONS.map((item) => (
              <div key={item.name} className="card" style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{item.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="container">
          <div className="text-center mb-xl">
            <h2 style={{ marginBottom: "0.75rem" }}>
              Everything You Need to <span className="text-gradient">Forge Intelligence</span>
            </h2>
            <p className="text-secondary" style={{ maxWidth: 600, margin: "0 auto" }}>
              NeuronForge combines OpenClaw&apos;s agent orchestration with 0G&apos;s decentralized infrastructure to create the most comprehensive agent platform.
            </p>
          </div>

          <div className="grid grid-3">
            {FEATURES.map((feature, i) => (
              <div key={feature.title} className={`card animate-slide-up stagger-${i % 4 + 1}`}>
                <div className="feature-icon">{feature.icon}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <h3 className="feature-title" style={{ margin: 0 }}>{feature.title}</h3>
                </div>
                <span className={`badge ${feature.badgeColor}`} style={{ marginBottom: "0.75rem" }}>
                  {feature.badge}
                </span>
                <p className="feature-desc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section" style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div className="text-center mb-xl">
            <h2 style={{ marginBottom: "0.75rem" }}>
              Agent Creation in <span className="text-gradient-accent">&lt;60 Seconds</span>
            </h2>
            <p className="text-secondary">From idea to autonomous agent in three steps</p>
          </div>

          <div className="grid grid-3">
            {[
              {
                step: "01",
                title: "Define Your Agent",
                desc: "Choose a persona, name your agent, and configure its behavior. Select from templates or start from scratch.",
                icon: "🎯",
              },
              {
                step: "02",
                title: "Compose Skills",
                desc: "Drag and drop OpenClaw Skills — 0G Inference for reasoning, 0G Memory for persistence, 0G Wallet for on-chain actions.",
                icon: "🔧",
              },
              {
                step: "03",
                title: "Deploy & Interact",
                desc: "Your agent is live! Chat with it, watch it learn, persist its memory to 0G Storage, and mint it as an INFT.",
                icon: "🚀",
              },
            ].map((item) => (
              <div key={item.step} className="card text-center" style={{ padding: "2rem" }}>
                <div style={{
                  fontSize: "3rem",
                  fontWeight: 900,
                  background: "var(--gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  marginBottom: "0.5rem",
                  opacity: 0.3,
                }}>
                  {item.step}
                </div>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{item.icon}</div>
                <h3 style={{ marginBottom: "0.5rem" }}>{item.title}</h3>
                <p className="text-secondary" style={{ fontSize: "0.9rem" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container text-center">
          <div className="card-glass" style={{ padding: "3rem", maxWidth: 700, margin: "0 auto" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>
              Ready to <span className="text-gradient">Forge Your First Agent</span>?
            </h2>
            <p className="text-secondary" style={{ marginBottom: "1.5rem" }}>
              Connect your wallet and start building autonomous intelligence on 0G.
            </p>
            <div className="flex-center gap-md">
              <a href="/forge" className="btn btn-primary btn-lg">⚡ Open the Forge</a>
              <a href="https://github.com" target="_blank" className="btn btn-secondary btn-lg">📂 View on GitHub</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "2rem 0",
        borderTop: "1px solid var(--border-subtle)",
        textAlign: "center",
      }}>
        <div className="container">
          <p className="text-muted text-small">
            NeuronForge — The open-source decentralized agent infrastructure platform
          </p>
          <p className="text-muted text-small" style={{ marginTop: "0.5rem" }}>
            OpenClaw × 0G Compute × 0G Storage × 0G Chain × INFTs
          </p>
        </div>
      </footer>
    </>
  );
}
