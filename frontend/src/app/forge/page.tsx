"use client";

import { useState, useRef, useEffect } from "react";
import { ethers } from "ethers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Contract addresses (same on testnet and mainnet)
const INFT_ADDRESS = "0xEC301d01Cf816010A2f1c4f8ef05726405277fA9";
const REGISTRY_ADDRESS = "0x956Bc852B2242cF75939185aA58dA4ae165b6B4D";

// Minimal ABIs for client-side interaction
const INFT_ABI = [
  "function mintAgent(address to, string metadataURI, bytes encryptedIntelligence) external returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokensOfOwner(address owner) view returns (uint256[])",
  "function getTokenData(uint256 tokenId) view returns (address owner, string metadataURI, address creator, uint256 createdAt)",
  "event AgentMinted(uint256 indexed tokenId, address indexed to, string metadataURI)",
];
const REGISTRY_ABI = [
  "function registerAgent(string name, string metadataHash, string[] skills) external returns (uint256)",
  "function totalAgents() view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string name)",
];

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
  tools?: string[];
}

interface ReActStep {
  type: "thought" | "action" | "response" | "error";
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: unknown;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  verified?: boolean;
  model?: string;
  steps?: ReActStep[];
}

// ── Suggested demo prompts ──
const DEMO_PROMPTS = [
  { label: "💰 Check Balance", prompt: "Check my wallet balance" },
  { label: "📤 Send 0.001 OG", prompt: "Send 0.001 OG to 0x000000000000000000000000000000000000dEaD" },
  { label: "🔍 Wallet Info", prompt: "Show me my full wallet info" },
  { label: "📜 Recent Txns", prompt: "Show my last 5 transactions" },
  { label: "🧱 Latest Block", prompt: "What's the latest block on 0G chain?" },
  { label: "💾 Save Memory", prompt: "Save this conversation to memory" },
];

// ── Rich Tool Output Renderer ──
function ToolOutput({ tool, output }: { tool: string; output: any }) {
  if (!output || typeof output !== "object") {
    return <span style={{ color: "#22c55e" }}>{JSON.stringify(output)}</span>;
  }

  const linkStyle: React.CSSProperties = { color: "#06b6d4", textDecoration: "none", fontSize: "0.7rem" };
  const labelStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.7rem", minWidth: 90, display: "inline-block" };
  const valueStyle: React.CSSProperties = { color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" };
  const rowStyle: React.CSSProperties = { display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0" };
  const cardStyle: React.CSSProperties = {
    padding: "0.6rem 0.75rem",
    background: "rgba(6, 182, 212, 0.06)",
    border: "1px solid rgba(6, 182, 212, 0.15)",
    borderRadius: 8,
    marginTop: 6,
  };

  // ── send_og — Transfer receipt ──
  if (tool === "send_og" && output.txHash) {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#22c55e", marginBottom: 6, fontSize: "0.8rem" }}>
          ✅ Transfer Successful
        </div>
        <div style={rowStyle}><span style={labelStyle}>From</span><span style={valueStyle}>{output.from}</span></div>
        <div style={rowStyle}><span style={labelStyle}>To</span><span style={valueStyle}>{output.to}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Amount</span><span style={{ ...valueStyle, color: "#f59e0b", fontWeight: 700 }}>{output.amount}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Block</span><span style={valueStyle}>{output.blockNumber}</span></div>
        <div style={{ marginTop: 6 }}>
          <a href={output.explorer} target="_blank" rel="noopener" style={linkStyle}>🔗 View on 0G Explorer →</a>
        </div>
      </div>
    );
  }

  // ── check_balance — Balance card ──
  if (tool === "check_balance") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#06b6d4", marginBottom: 6, fontSize: "0.8rem" }}>
          💰 Wallet Balance
        </div>
        <div style={rowStyle}><span style={labelStyle}>Address</span><span style={valueStyle}>{output.address}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Balance</span><span style={{ ...valueStyle, color: "#22c55e", fontWeight: 700, fontSize: "0.9rem" }}>{output.balance}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Network</span><span style={valueStyle}>{output.network}</span></div>
      </div>
    );
  }

  // ── get_wallet_info — Full wallet card ──
  if (tool === "get_wallet_info") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#8b5cf6", marginBottom: 6, fontSize: "0.8rem" }}>
          ⛓️ Wallet Details
        </div>
        <div style={rowStyle}><span style={labelStyle}>Address</span><span style={valueStyle}>{output.address}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Balance</span><span style={{ ...valueStyle, color: "#22c55e", fontWeight: 700 }}>{output.balance}</span></div>
        <div style={rowStyle}><span style={labelStyle}>TX Count</span><span style={valueStyle}>{output.transactionCount}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Chain ID</span><span style={valueStyle}>{output.chainId}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Latest Block</span><span style={valueStyle}>{output.latestBlock}</span></div>
        {output.explorer && <div style={{ marginTop: 6 }}><a href={output.explorer} target="_blank" rel="noopener" style={linkStyle}>🔗 View on 0G Explorer →</a></div>}
      </div>
    );
  }

  // ── get_transaction — TX receipt ──
  if (tool === "get_transaction") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: 6, fontSize: "0.8rem" }}>
          📋 Transaction Details
        </div>
        <div style={rowStyle}><span style={labelStyle}>Hash</span><span style={{ ...valueStyle, fontSize: "0.65rem" }}>{output.hash}</span></div>
        <div style={rowStyle}><span style={labelStyle}>From</span><span style={valueStyle}>{output.from}</span></div>
        <div style={rowStyle}><span style={labelStyle}>To</span><span style={valueStyle}>{output.to}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Value</span><span style={{ ...valueStyle, color: "#22c55e", fontWeight: 700 }}>{output.value}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Status</span>
          <span style={{ ...valueStyle, color: output.status === "confirmed" ? "#22c55e" : "#f59e0b", fontWeight: 700 }}>
            {output.status === "confirmed" ? "✅ " : "⏳ "}{output.status}
          </span>
        </div>
        <div style={rowStyle}><span style={labelStyle}>Block</span><span style={valueStyle}>{output.blockNumber}</span></div>
        {output.explorer && <div style={{ marginTop: 6 }}><a href={output.explorer} target="_blank" rel="noopener" style={linkStyle}>🔗 View on 0G Explorer →</a></div>}
      </div>
    );
  }

  // ── get_block — Block info ──
  if (tool === "get_block") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#06b6d4", marginBottom: 6, fontSize: "0.8rem" }}>
          🧱 Block #{output.number}
        </div>
        <div style={rowStyle}><span style={labelStyle}>Timestamp</span><span style={valueStyle}>{output.date || output.timestamp}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Hash</span><span style={{ ...valueStyle, fontSize: "0.65rem" }}>{output.hash}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Transactions</span><span style={valueStyle}>{output.transactions}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Gas Used</span><span style={valueStyle}>{output.gasUsed}</span></div>
      </div>
    );
  }

  // ── save_memory — Storage confirmation ──
  if (tool === "save_memory") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#22c55e", marginBottom: 6, fontSize: "0.8rem" }}>
          💾 Memory Saved to 0G Storage
        </div>
        <div style={rowStyle}><span style={labelStyle}>Root Hash</span><span style={{ ...valueStyle, fontSize: "0.65rem" }}>{output.rootHash}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Messages</span><span style={valueStyle}>{output.conversationsSaved} saved</span></div>
        <div style={rowStyle}><span style={labelStyle}>Snapshots</span><span style={valueStyle}>{output.totalSnapshots} total</span></div>
      </div>
    );
  }

  // ── recall_memory — Search results ──
  if (tool === "recall_memory") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#8b5cf6", marginBottom: 6, fontSize: "0.8rem" }}>
          🔍 Memory Search: "{output.query}"
        </div>
        <div style={rowStyle}><span style={labelStyle}>Found</span><span style={valueStyle}>{output.found} messages</span></div>
        {output.results?.slice(0, 3).map((r: any, i: number) => (
          <div key={i} style={{ padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: 4, marginTop: 4, fontSize: "0.7rem" }}>
            <span style={{ color: "#64748b" }}>[{r.role}]</span> {r.content?.substring(0, 120)}...
          </div>
        ))}
      </div>
    );
  }

  // ── publish_agent — INFT mint result ──
  if (tool === "publish_agent") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#f43f5e", marginBottom: 6, fontSize: "0.8rem" }}>
          🎭 Agent {output.status === "minted_as_inft" ? "Minted as INFT!" : "State Saved"}
        </div>
        <div style={rowStyle}><span style={labelStyle}>Agent</span><span style={valueStyle}>{output.name}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Token ID</span><span style={{ ...valueStyle, color: "#f59e0b", fontWeight: 700 }}>{output.tokenId}</span></div>
        <div style={rowStyle}><span style={labelStyle}>State Hash</span><span style={{ ...valueStyle, fontSize: "0.65rem" }}>{output.stateHash}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Skills</span><span style={valueStyle}>{output.skills?.join(", ")}</span></div>
        {output.explorer && <div style={{ marginTop: 6 }}><a href={output.explorer} target="_blank" rel="noopener" style={linkStyle}>🔗 View on 0G Explorer →</a></div>}
      </div>
    );
  }

  // ── get_transactions — Transaction history ──
  if (tool === "get_transactions") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "#06b6d4", marginBottom: 6, fontSize: "0.8rem" }}>
          📜 Transaction History ({output.count} found)
        </div>
        {output.transactions?.map((tx: any, i: number) => (
          <div key={i} style={{
            padding: "6px 8px",
            background: "rgba(0,0,0,0.15)",
            borderRadius: 6,
            marginTop: 6,
            fontSize: "0.7rem",
            borderLeft: `3px solid ${tx.direction === "sent" ? "#f59e0b" : "#22c55e"}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: tx.direction === "sent" ? "#f59e0b" : "#22c55e" }}>
                {tx.direction === "sent" ? "↑ Sent" : "↓ Received"}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>
                {tx.value}
              </span>
            </div>
            <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
              {tx.direction === "sent" ? `To: ${tx.to}` : `From: ${tx.from}`}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={{ color: "var(--text-muted)" }}>Block {tx.blockNumber}</span>
              <a href={tx.explorer} target="_blank" rel="noopener" style={{ ...linkStyle, fontSize: "0.65rem" }}>View →</a>
            </div>
          </div>
        ))}
        {output.count === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", padding: "8px 0" }}>
            No transactions found in the last ~5000 blocks. Try a wider search.
          </div>
        )}
        {output.explorer && <div style={{ marginTop: 8 }}><a href={output.explorer} target="_blank" rel="noopener" style={linkStyle}>🔗 View full history on 0G Explorer →</a></div>}
      </div>
    );
  }

  // ── Fallback — formatted JSON ──
  if (output.error) {
    return (
      <div style={{ ...cardStyle, borderColor: "rgba(244, 63, 94, 0.3)" }}>
        <span style={{ color: "#f43f5e" }}>❌ {output.error}</span>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, maxHeight: 120, overflow: "auto" }}>
      <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "#22c55e", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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
        steps: data.steps,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm currently running in demo mode. Start the backend server (`npm run dev` in `/backend`) and configure your 0G Compute provider to enable live inference.\n\nOnce connected, I'll reason through 0G's decentralized compute network with TEE verification!",
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
        const explorerBase = "https://chainscan-galileo.0g.ai";
        const txLine = data.txHash && data.txHash !== 'undefined'
          ? `🔗 TX: [\`${data.txHash.slice(0, 16)}...\`](${explorerBase}/tx/${data.txHash})`
          : "📡 Stored via 0G Storage SDK (off-chain indexer)";
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `💾 **Memory persisted to 0G Storage!**\n\n📦 Root Hash: \`${data.memoryHash}\`\n${txLine}\n💬 ${data.conversationsCount} messages saved\n\nYour memory is now permanently stored on 0G's decentralized storage network.`,
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
    
    // Check MetaMask
    const eth = (window as any).ethereum;
    if (!eth) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "❌ MetaMask not found. Please install MetaMask to mint your agent as an INFT.",
        timestamp: Date.now(),
      }]);
      return;
    }

    setIsMinting(true);
    try {
      // Get user's wallet
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const userAddress = accounts[0];
      
      // Create provider and signer from MetaMask
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      
      // Connect to INFT contract
      const inftContract = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);
      
      // Prepare metadata (agent state as JSON)
      const metadataURI = `0g-storage://${agent.id}/${Date.now()}`;
      const intelligenceData = JSON.stringify({
        agentId: agent.id,
        name: agent.name,
        persona: agent.persona,
        skills: agent.skills,
        model: agent.model,
        conversations: messages.length,
      });
      const encryptedIntelligence = ethers.toUtf8Bytes(intelligenceData);

      setMessages(prev => [...prev, {
        role: "assistant",
        content: "🎭 **Minting INFT...** Please confirm the transaction in MetaMask.",
        timestamp: Date.now(),
      }]);

      // Call mintAgent — MetaMask will pop up for user to sign!
      const tx = await inftContract.mintAgent(userAddress, metadataURI, encryptedIntelligence);
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⏳ **Transaction submitted!** Waiting for confirmation...\n\nTX: \`${tx.hash}\``,
        timestamp: Date.now(),
      }]);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      // Parse the AgentMinted event to get tokenId
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = inftContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          return parsed?.name === "AgentMinted";
        } catch { return false; }
      });
      
      let tokenId = "N/A";
      if (mintEvent) {
        const parsed = inftContract.interface.parseLog({ topics: mintEvent.topics as string[], data: mintEvent.data });
        tokenId = parsed?.args[0]?.toString() || "N/A";
      }

      const explorerBase = "https://chainscan-galileo.0g.ai";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `🎭 **Minted as INFT (ERC-7857)!** ✅\n\n🆔 Token ID: \`${tokenId}\`\n👤 Owner: \`${userAddress}\`\n📦 Metadata: \`${metadataURI}\`\n🔗 TX: [\`${tx.hash.slice(0, 20)}...\`](${explorerBase}/tx/${tx.hash})\n⛽ Gas Used: ${receipt.gasUsed.toString()}\n\n[🔗 View on Explorer →](${explorerBase}/tx/${tx.hash})\n\nYour agent is now tokenized on 0G Chain! You own this INFT and can transfer, clone, or list it.`,
        timestamp: Date.now(),
      }]);
    } catch (e: any) {
      const errorMsg = e.code === 4001
        ? "Transaction cancelled by user."
        : e.reason || e.message || "Unknown error";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ **Mint Failed:** ${errorMsg}\n\nMake sure you're connected to the 0G network and have enough OG for gas.`,
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
          {/* Step Progress */}
          <div className="step-progress">
            <div className="step-item active"><span className="step-num">1</span> Configure</div>
            <div className="step-connector" />
            <div className="step-item"><span className="step-num">2</span> Skills</div>
            <div className="step-connector" />
            <div className="step-item"><span className="step-num">3</span> Deploy</div>
          </div>

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
            style={isPersisting ? { opacity: 0.7, cursor: "wait" } : {}}
          >
            {isPersisting ? "⏳ Persisting..." : "💾 Persist Memory"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={mintAsINFT}
            disabled={isMinting}
            style={isMinting ? { opacity: 0.7, cursor: "wait" } : {}}
          >
            {isMinting ? "⏳ Minting..." : "🎭 Mint INFT"}
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-container" style={{ flex: 1 }}>
        <div className="chat-messages" id="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              {/* Hide raw text if it contains tool_call syntax and we have steps */}
              {(!(msg.steps && msg.steps.length > 0 && msg.content.includes('tool_call')) &&
                !(msg.steps && msg.steps.length > 0 && msg.content.includes('"tool"')) &&
                msg.content) && (
                  <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                )}

              {/* ReAct Steps Visualization */}
              {msg.steps && msg.steps.length > 0 && (
                <div style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  borderLeft: "2px solid var(--accent-primary)",
                }}>
                  <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "var(--accent-primary)" }}>
                    🔄 ReAct Reasoning Chain
                  </div>
                  {msg.steps.map((step, j) => (
                    <div key={j} style={{ marginBottom: "0.4rem", paddingLeft: "0.5rem" }}>
                      {step.type === "thought" && (
                        <div style={{ color: "var(--accent-secondary)" }}>
                          💭 <em>{step.content}</em>
                        </div>
                      )}
                      {step.type === "action" && (
                        <div>
                          <div style={{ color: "#f59e0b" }}>
                            🔧 Tool: <strong>{step.tool}</strong>
                          </div>
                          {step.output != null && (
                            <ToolOutput tool={step.tool || ""} output={step.output} />
                          )}
                        </div>
                      )}
                      {step.type === "error" && (
                        <div style={{ color: "var(--accent-tertiary)" }}>
                          ❌ {step.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {msg.verified !== undefined && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", opacity: 0.7 }}>
                  {msg.verified ? "✅ TEE Verified" : "⚠️ Unverified"} • {msg.model} • via 0G Compute
                </div>
              )}
            </div>
          ))}
          {isSending && (
            <div className="chat-message assistant">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Reasoning via 0G Compute...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        {/* Demo Prompt Suggestions */}
        {messages.length <= 1 && !isSending && (
          <div style={{
            padding: "0.5rem 1rem",
            display: "flex",
            gap: "0.4rem",
            flexWrap: "wrap",
            borderTop: "1px solid var(--border-subtle)",
          }}>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", alignSelf: "center", marginRight: 4 }}>Try:</span>
            {DEMO_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => { setChatInput(p.prompt); }}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.7rem",
                  background: "rgba(6, 182, 212, 0.08)",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  borderRadius: "999px",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "var(--font-sans)",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.background = "rgba(6, 182, 212, 0.15)";
                  (e.target as HTMLElement).style.color = "var(--accent-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background = "rgba(6, 182, 212, 0.08)";
                  (e.target as HTMLElement).style.color = "var(--text-secondary)";
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

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
