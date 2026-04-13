"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const AVAILABLE_SKILLS = [
  { id: "0g-inference", name: "0G Inference", icon: "🧠", og: "0G Compute", desc: "TEE-verified LLM reasoning" },
  { id: "0g-memory", name: "0G Memory", icon: "💾", og: "0G Storage", desc: "Persistent agent memory" },
  { id: "0g-wallet", name: "0G Wallet", icon: "⛓️", og: "0G Chain", desc: "On-chain interactions" },
  { id: "0g-publish", name: "0G Publish", icon: "🎭", og: "INFTs", desc: "Mint agents as INFTs" },
  { id: "web-browser", name: "Web Browser", icon: "🌐", og: null, desc: "Browse & scrape the web" },
  { id: "file-system", name: "File System", icon: "📁", og: null, desc: "Read & write files" },
];

const TEMPLATES = [
  { name: "Custom Agent", persona: "", skills: [], icon: "✨" },
  { name: "DeFi Scout", persona: "You are a DeFi analyst agent. You monitor blockchain protocols, track yield opportunities, analyze token metrics, and provide actionable DeFi insights. You are data-driven and concise.", skills: ["0g-inference", "0g-wallet", "0g-memory"], icon: "📈" },
  { name: "Research Agent", persona: "You are a thorough research agent. You browse the web, synthesize information, store findings in persistent memory, and provide well-cited analysis. You prioritize accuracy and depth.", skills: ["0g-inference", "0g-memory", "web-browser"], icon: "🔬" },
  { name: "Data Analyst", persona: "You are a data analysis agent. You process datasets, generate statistical insights, create summaries, and persist your analysis. You communicate findings clearly with supporting data.", skills: ["0g-inference", "0g-memory", "file-system"], icon: "📊" },
];

interface Agent {
  id: string;
  name: string;
  persona: string;
  skills: string[];
  model: string;
  stateHash?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  verified?: boolean;
  model?: string;
}

export default function ForgePage() {
  // Builder state
  const [step, setStep] = useState<"build" | "chat">("build");
  const [agentName, setAgentName] = useState("");
  const [persona, setPersona] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["0g-inference", "0g-memory"]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Chat state
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((s) => s !== skillId)
        : [...prev, skillId]
    );
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    if (template.persona) setPersona(template.persona);
    if (template.skills.length > 0) setSelectedSkills(template.skills);
    if (!agentName && template.name !== "Custom Agent") setAgentName(template.name);
  };

  const createAgent = async () => {
    if (!agentName.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetch(`${API_BASE}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          persona: persona || "You are a helpful autonomous AI agent.",
          skills: selectedSkills,
          model: "deepseek-chat-v3-0324",
        }),
      });

      if (!res.ok) throw new Error("Failed to create agent");
      const data = await res.json();
      setAgent(data.agent);
      setStep("chat");
      
      // Add welcome message
      setMessages([{
        role: "assistant",
        content: `👋 Hello! I'm **${agentName}**, your autonomous AI agent.\n\nI'm running on **0G Compute** with skills: ${selectedSkills.map(s => `\`${s}\``).join(", ")}.\n\nMy memory persists on **0G Storage**, so I'll remember our conversations even across sessions.\n\nHow can I help you today?`,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      console.error("Create error:", error);
      // Demo mode: create locally
      const demoAgent: Agent = {
        id: `agent_${Date.now()}`,
        name: agentName,
        persona: persona || "You are a helpful autonomous AI agent.",
        skills: selectedSkills,
        model: "deepseek-chat-v3-0324",
      };
      setAgent(demoAgent);
      setStep("chat");
      setMessages([{
        role: "assistant",
        content: `👋 Hello! I'm **${agentName}**, your autonomous AI agent.\n\nI'm configured with skills: ${selectedSkills.map(s => `\`${s}\``).join(", ")}.\n\n⚠️ *Running in demo mode — connect backend for full 0G integration.*\n\nHow can I help you today?`,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsCreating(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !agent) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput }),
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: Date.now(),
        verified: data.verified,
        model: data.model,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm currently running in demo mode. Connect the backend server (`npm run dev` in `/backend`) and configure your 0G Compute provider to enable live inference.\n\nOnce connected, I'll reason through 0G's decentralized compute network with TEE verification!",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const persistMemory = async () => {
    if (!agent) return;
    setIsPersisting(true);
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agent.id}/persist`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `💾 **Memory persisted to 0G Storage!**\n\n📦 Root Hash: \`${data.memoryHash}\`\n📝 TX: \`${data.txHash}\`\n💬 ${data.conversationsCount} messages saved\n\nYour memory is now permanently stored on 0G's decentralized storage network.`,
          timestamp: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "💾 **Memory Persist** — Connect backend for 0G Storage integration. Your conversations would be uploaded to 0G's decentralized storage with a merkle root hash.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsPersisting(false);
    }
  };

  const mintAsINFT = async () => {
    if (!agent) return;
    setIsMinting(true);
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agent.id}/mint`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `🎭 **Minted as INFT (ERC-7857)!**\n\n🆔 Token ID: \`${data.tokenId}\`\n📦 State Hash: \`${data.stateHash}\`\n🔗 TX: \`${data.txHash}\`\n\nYour agent is now tokenized on 0G Chain! You can transfer, clone, or list it on the marketplace.`,
          timestamp: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "🎭 **INFT Minting** — Deploy contracts to 0G Chain and connect backend to mint this agent as an ERC-7857 INFT with encrypted intelligence transfer.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsMinting(false);
    }
  };

  // ====== BUILDER VIEW ======
  if (step === "build") {
    return (
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h1 style={{ marginBottom: "0.5rem" }}>
            <span className="text-gradient">⚡ The Forge</span>
          </h1>
          <p className="text-secondary" style={{ marginBottom: "2rem" }}>
            Create a new autonomous AI agent in under 60 seconds
          </p>

          {/* Templates */}
          <div style={{ marginBottom: "2rem" }}>
            <label className="input-label" style={{ marginBottom: "0.75rem", display: "block" }}>
              Quick Templates
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  className="btn btn-secondary btn-sm"
                  onClick={() => applyTemplate(t)}
                >
                  {t.icon} {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Agent Name */}
          <div className="input-group" style={{ marginBottom: "1.5rem" }}>
            <label className="input-label">Agent Name *</label>
            <input
              className="input"
              placeholder="e.g., DeFi Scout, Research Bot, My Assistant"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              id="agent-name-input"
            />
          </div>

          {/* Persona */}
          <div className="input-group" style={{ marginBottom: "1.5rem" }}>
            <label className="input-label">Persona & Instructions</label>
            <textarea
              className="input"
              placeholder="Describe your agent's personality, expertise, and behavior..."
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={4}
              id="agent-persona-input"
            />
          </div>

          {/* Skill Composer */}
          <div style={{ marginBottom: "2rem" }}>
            <label className="input-label" style={{ marginBottom: "0.75rem", display: "block" }}>
              Compose Skills ({selectedSkills.length} selected)
            </label>
            <div className="grid grid-2" style={{ gap: "0.75rem" }}>
              {AVAILABLE_SKILLS.map((skill) => (
                <div
                  key={skill.id}
                  className={`card ${selectedSkills.includes(skill.id) ? "" : ""}`}
                  onClick={() => toggleSkill(skill.id)}
                  style={{
                    padding: "1rem",
                    cursor: "pointer",
                    borderColor: selectedSkills.includes(skill.id) ? "var(--accent-primary)" : undefined,
                    background: selectedSkills.includes(skill.id) ? "rgba(6, 182, 212, 0.05)" : undefined,
                  }}
                  id={`skill-${skill.id}`}
                >
                  <div className="flex-between">
                    <div className="flex gap-sm" style={{ alignItems: "center" }}>
                      <span style={{ fontSize: "1.3rem" }}>{skill.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{skill.name}</div>
                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>{skill.desc}</div>
                      </div>
                    </div>
                    <div>
                      {skill.og && <span className="og-badge">{skill.og}</span>}
                      {selectedSkills.includes(skill.id) && (
                        <span style={{ color: "var(--accent-primary)", marginLeft: "0.5rem", fontWeight: 700 }}>✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Skills Summary */}
          {selectedSkills.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <label className="input-label" style={{ marginBottom: "0.5rem", display: "block" }}>Active Skills</label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {selectedSkills.map((skillId) => {
                  const skill = AVAILABLE_SKILLS.find((s) => s.id === skillId);
                  return (
                    <span key={skillId} className="skill-chip selected">
                      {skill?.icon} {skill?.name}
                      <span className="remove" onClick={(e) => { e.stopPropagation(); toggleSkill(skillId); }}>×</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Create Button */}
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={createAgent}
            disabled={!agentName.trim() || isCreating}
            id="create-agent-btn"
            style={{ opacity: agentName.trim() ? 1 : 0.5 }}
          >
            {isCreating ? "⏳ Forging Agent..." : "⚡ Forge Agent"}
          </button>
        </div>
      </div>
    );
  }

  // ====== CHAT VIEW ======
  return (
    <div className="container" style={{ paddingTop: "1.5rem", paddingBottom: "1.5rem", height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      {/* Chat Header */}
      <div className="flex-between" style={{ marginBottom: "1rem" }}>
        <div className="flex gap-md" style={{ alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep("build")}>
            ← Back
          </button>
          <div>
            <h2 style={{ fontSize: "1.2rem", margin: 0 }}>{agent?.name}</h2>
            <div className="flex gap-sm" style={{ marginTop: "0.25rem" }}>
              {agent?.skills.map((s) => (
                <span key={s} className="og-badge" style={{ fontSize: "0.6rem" }}>{s}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-sm">
          <button
            className="btn btn-secondary btn-sm"
            onClick={persistMemory}
            disabled={isPersisting}
          >
            {isPersisting ? "⏳" : "💾"} Persist Memory
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={mintAsINFT}
            disabled={isMinting}
          >
            {isMinting ? "⏳" : "🎭"} Mint INFT
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-container" style={{ flex: 1 }}>
        <div className="chat-messages" id="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              {msg.verified !== undefined && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", opacity: 0.7 }}>
                  {msg.verified ? "✅ TEE Verified" : "⚠️ Unverified"} • {msg.model}
                </div>
              )}
            </div>
          ))}
          {isSending && (
            <div className="chat-message assistant animate-pulse">
              <span>🧠 Thinking via 0G Compute...</span>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="chat-input-bar">
          <input
            className="input"
            placeholder="Message your agent..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={isSending}
            id="chat-input"
          />
          <button
            className="btn btn-primary"
            onClick={sendMessage}
            disabled={isSending || !chatInput.trim()}
            id="send-message-btn"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
