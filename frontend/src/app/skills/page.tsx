"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  ogComponent: string | null;
  installed: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  core: "⚡",
  utility: "🔧",
  community: "👥",
};

const OG_ICONS: Record<string, string> = {
  "0G Compute": "🤖",
  "0G Storage": "💾",
  "0G Chain": "⛓️",
  "0G Chain + INFTs": "🎭",
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishDesc, setPublishDesc] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/skills`);
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills);
      }
    } catch {
      // Use default skills for demo
      setSkills([
        { id: "0g-inference", name: "0G Inference", description: "Routes LLM reasoning through 0G Compute Network for decentralized, TEE-verified inference. Supports DeepSeek V3, Qwen 2.5, and more.", category: "core", version: "1.0.0", author: "NeuronForge", ogComponent: "0G Compute", installed: true },
        { id: "0g-memory", name: "0G Memory", description: "Persists agent memory and conversation history to 0G Storage for cross-session continuity. Agents remember everything.", category: "core", version: "1.0.0", author: "NeuronForge", ogComponent: "0G Storage", installed: true },
        { id: "0g-wallet", name: "0G Wallet", description: "Enables agents to interact with 0G Chain — check balances, read contract state, execute transactions autonomously.", category: "core", version: "1.0.0", author: "NeuronForge", ogComponent: "0G Chain", installed: true },
        { id: "0g-publish", name: "0G Publish", description: "Packages agent state (skills, memory, persona) and mints as an INFT (ERC-7857) for ownership transfer and trading.", category: "core", version: "1.0.0", author: "NeuronForge", ogComponent: "0G Chain + INFTs", installed: true },
        { id: "web-browser", name: "Web Browser", description: "Browse the web, extract data, fill forms, and interact with websites. Essential for research agents.", category: "utility", version: "1.0.0", author: "OpenClaw", ogComponent: null, installed: false },
        { id: "file-system", name: "File System", description: "Read, write, and manage files on the agent's host system. Useful for data processing workflows.", category: "utility", version: "1.0.0", author: "OpenClaw", ogComponent: null, installed: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (skillId: string) => {
    setInstallingId(skillId);
    // Simulate install
    await new Promise(r => setTimeout(r, 1500));
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, installed: true } : s));
    setInstallingId(null);
  };

  const handlePublish = async () => {
    if (!publishName.trim() || !publishDesc.trim()) return;
    setPublishing(true);

    // Simulate publishing to 0G Storage
    await new Promise(r => setTimeout(r, 2000));
    const hash = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

    // Add the new skill to the list
    const newSkill: Skill = {
      id: publishName.toLowerCase().replace(/\s+/g, "-"),
      name: publishName,
      description: publishDesc,
      category: "community",
      version: "1.0.0",
      author: "You",
      ogComponent: null,
      installed: true,
    };
    setSkills(prev => [...prev, newSkill]);
    setPublishSuccess(hash);
    setPublishing(false);
  };

  const filtered = filter === "all" ? skills : skills.filter((s) => s.category === filter);
  const categories = ["all", ...new Set(skills.map((s) => s.category))];

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>
          <span className="text-gradient">🔧 Skills Explorer</span>
        </h1>
        <p className="text-secondary">
          Browse, install, and compose OpenClaw Skills for your agents
        </p>
      </div>

      {/* Category Filters */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`btn ${filter === cat ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilter(cat)}
          >
            {cat === "all" ? "📋 All" : `${CATEGORY_ICONS[cat] || "📦"} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="text-center text-muted" style={{ padding: "3rem" }}>
          Loading skills...
        </div>
      ) : (
        <div className="grid grid-2">
          {filtered.map((skill) => (
            <div key={skill.id} className="card" id={`skill-card-${skill.id}`}>
              <div className="flex-between" style={{ marginBottom: "1rem" }}>
                <div className="flex gap-sm" style={{ alignItems: "center" }}>
                  <span style={{ fontSize: "1.5rem" }}>
                    {skill.ogComponent ? OG_ICONS[skill.ogComponent] || "📦" : "🔧"}
                  </span>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", margin: 0 }}>{skill.name}</h3>
                    <span className="text-muted text-small">v{skill.version} by {skill.author}</span>
                  </div>
                </div>
                <div className="flex gap-sm" style={{ alignItems: "center" }}>
                  {skill.ogComponent && <span className="og-badge">{skill.ogComponent}</span>}
                  {skill.installed ? (
                    <span className="badge badge-green">Installed</span>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleInstall(skill.id)}
                      disabled={installingId === skill.id}
                    >
                      {installingId === skill.id ? "⏳ Installing..." : "Install"}
                    </button>
                  )}
                </div>
              </div>

              <p className="text-secondary" style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
                {skill.description}
              </p>

              <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                <span className={`badge ${skill.category === "core" ? "badge-cyan" : skill.category === "community" ? "badge-purple" : "badge-amber"}`}>
                  {CATEGORY_ICONS[skill.category]} {skill.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish CTA */}
      <div className="card-glass text-center" style={{ marginTop: "3rem", padding: "2rem" }}>
        {!showPublish && !publishSuccess && (
          <>
            <h3 style={{ marginBottom: "0.5rem" }}>Build Your Own Skill</h3>
            <p className="text-secondary" style={{ marginBottom: "1rem" }}>
              Create custom OpenClaw Skills and publish them to 0G Storage for the community.
            </p>
            <button className="btn btn-primary" onClick={() => setShowPublish(true)}>
              🚀 Publish a Skill
            </button>
          </>
        )}

        {showPublish && !publishSuccess && (
          <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "left" }}>
            <h3 style={{ marginBottom: "1rem", textAlign: "center" }}>🚀 Publish New Skill</h3>
            <div className="input-group" style={{ marginBottom: "1rem" }}>
              <label className="input-label">Skill Name *</label>
              <input
                className="input"
                placeholder="e.g., Token Analyzer, MEV Detector"
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: "1.5rem" }}>
              <label className="input-label">Description *</label>
              <textarea
                className="input"
                placeholder="What does this skill do? What tools does it provide?"
                value={publishDesc}
                onChange={(e) => setPublishDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowPublish(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePublish}
                disabled={!publishName.trim() || !publishDesc.trim() || publishing}
                style={publishing ? { opacity: 0.7, cursor: "wait" } : {}}
              >
                {publishing ? "⏳ Publishing to 0G Storage..." : "🚀 Publish Skill"}
              </button>
            </div>
          </div>
        )}

        {publishSuccess && (
          <div>
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>✅</div>
            <h3 style={{ color: "#22c55e", marginBottom: "0.5rem" }}>Skill Published!</h3>
            <p className="text-secondary" style={{ marginBottom: "0.5rem" }}>
              Your skill <strong>{publishName}</strong> is now available on 0G Storage.
            </p>
            <code style={{ fontSize: "0.7rem", color: "var(--accent-primary)", wordBreak: "break-all" }}>
              Storage Hash: {publishSuccess}
            </code>
            <div style={{ marginTop: "1rem" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowPublish(false);
                  setPublishSuccess(null);
                  setPublishName("");
                  setPublishDesc("");
                }}
              >
                Publish Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
