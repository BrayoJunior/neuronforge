# NeuronForge 🧠⚡

> **OpenClaw-powered decentralized agent infrastructure on 0G**

Build, orchestrate, persist, and trade autonomous AI agents using OpenClaw as the runtime, 0G as the decentralized backend, and INFTs (ERC-7857) for agent portability.

## Overview

### What is NeuronForge?

NeuronForge is an **open-source agent infrastructure platform** that bridges [OpenClaw](https://openclaw.ai) — the open-source autonomous agent framework — with [0G Network](https://0g.ai) — the decentralized AI operating system. It enables anyone to:

1. **🔨 Build** — Create AI agents with composable Skills through a visual builder
2. **🔄 Orchestrate** — Run agents in OpenClaw's ReAct loop with 0G Compute for inference
3. **💾 Persist** — Store agent memory and state on 0G Storage for cross-session continuity
4. **🎭 Tokenize** — Mint agents as INFTs (ERC-7857) with encrypted intelligence transfer
5. **🛒 Trade** — Buy, sell, and compose agents in a decentralized marketplace

### Why NeuronForge?

Today's AI agents are ephemeral — they lose memory between sessions, run on centralized infrastructure, and can't be owned, transferred, or composed. NeuronForge solves this by giving agents:

- **Persistent, decentralized memory** via 0G Storage
- **Verifiable reasoning** via 0G Compute's TEE-verified inference
- **True ownership** via ERC-7857 INFTs on 0G Chain
- **Composable capabilities** via OpenClaw's modular Skill system

### 0G Integration

| Component | Usage |
|---|---|
| **0G Compute** | LLM inference via OpenAI-compatible broker (DeepSeek V3, Qwen 2.5) |
| **0G Storage** | Agent memory, state snapshots, skill packages |
| **0G Chain** | Smart contracts for agent registry, skill registry, marketplace |
| **INFTs (ERC-7857)** | Tokenize agents with encrypted intelligence transfer |
| **0G DA** | Verifiable audit trails for agent state changes |

### Custom OpenClaw Skills

| Skill | Function |
|---|---|
| `0g-inference` | Routes LLM reasoning through 0G Compute Network |
| `0g-memory` | Persists agent memory to 0G Storage |
| `0g-wallet` | On-chain interactions via 0G Chain |
| `0g-publish` | Packages & mints agents as INFTs |

## 🚀 Quick Start

### Prerequisites
- Node.js >= 22.0.0
- Docker (for OpenClaw)
- MetaMask wallet with 0G testnet tokens

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/neuronforge.git
cd neuronforge

# Install dependencies
npm install --prefix frontend
npm install --prefix backend
npm install --prefix contracts
npm install --prefix skills

# Configure environment
cp .env.example .env
# Add your PRIVATE_KEY and other config

# Deploy contracts (testnet)
cd contracts && npx hardhat run scripts/deploy.js --network testnet

# Start backend
cd ../backend && npm run dev

# Start frontend
cd ../frontend && npm run dev
```

## 📁 Project Structure

```
neuronforge/
├── frontend/          # Next.js web application
├── backend/           # Node.js API server
│   └── src/
│       ├── services/  # 0G Storage, Compute, Chain, DA
│       ├── openclaw/  # OpenClaw runtime bridge
│       └── routes/    # API endpoints
├── contracts/         # Solidity smart contracts (Hardhat)
├── skills/            # Custom OpenClaw Skills
│   ├── 0g-inference/
│   ├── 0g-memory/
│   ├── 0g-wallet/
│   └── 0g-publish/
└── docs/              # Architecture diagrams & documentation
```

## 🗺️ Roadmap

- [x] Core agent builder & skill composer
- [x] 0G Compute integration (TEE-verified inference)
- [x] 0G Storage integration (persistent memory)
- [x] Smart contracts (AgentRegistry, NeuronForgeINFT)
- [x] 4 custom OpenClaw skills
- [ ] OpenClaw runtime bridge
- [ ] INFT marketplace (on-chain listings)
- [ ] 0G DA integration (verifiable audit trails)
- [ ] Multi-agent collaboration
- [ ] Agent fine-tuning via 0G Compute

## 🔗 Links

- **Live Demo**: [Coming Soon]
- **Documentation**: [Coming Soon]
- **0G Explorer**: [Coming Soon]

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

## 📄 License

MIT
