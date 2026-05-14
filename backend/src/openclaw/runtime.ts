/**
 * NeuronForge — OpenClaw-Compatible Agent Runtime
 * 
 * A lightweight agent runtime implementing a ReAct (Reason + Act) loop
 * compatible with OpenClaw's Skill/Tool architecture.
 * 
 * Architecture:
 *   User Message → Context Assembly → LLM Reasoning (0G Compute)
 *     → Tool Selection → Tool Execution → Response
 *     → Memory Persistence (0G Storage)
 */

import { chatCompletion, getChatProviders } from '../services/compute.js';
import { uploadAgentMemory, uploadAgentState } from '../services/storage.js';
import type { AgentInstance, AgentConfig, ChatMessage, ToolCall, ToolDefinition, ReActStep } from './types.js';

// ---- Agent Store ----
const agents: Map<string, AgentInstance> = new Map();

/**
 * Create a new agent instance with the ReAct runtime
 */
export async function createAgent(config: AgentConfig): Promise<AgentInstance> {
  const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Auto-discover 0G Compute provider if not specified
  let providerAddress = config.providerAddress || '';
  if (!providerAddress) {
    try {
      const providers = await getChatProviders();
      if (providers.length > 0) {
        providerAddress = providers[0].provider;
        console.log(`🤖 Auto-selected provider: ${providerAddress}`);
      }
    } catch (e) {
      console.warn('⚠️ No 0G Compute providers available, running in fallback mode');
    }
  }

  const agent: AgentInstance = {
    id,
    name: config.name,
    persona: config.persona || 'You are a helpful autonomous AI agent powered by NeuronForge.',
    skills: config.skills || [],
    model: config.model || 'deepseek-chat-v3-0324',
    providerAddress,
    tools: new Map(),
    conversations: [],
    memoryHashes: [],
    stateHash: '',
    createdAt: Date.now(),
    status: 'idle',
  };

  // Register built-in tools based on selected skills
  registerBuiltinTools(agent);

  agents.set(id, agent);
  console.log(`⚡ Agent "${agent.name}" created [${id}] with skills: ${agent.skills.join(', ')}`);

  // Persist initial state to 0G Storage (non-blocking)
  uploadAgentState(id, {
    persona: agent.persona,
    skills: agent.skills,
    config: { model: agent.model, providerAddress: agent.providerAddress },
    version: 1,
  }).then(result => {
    agent.stateHash = result.rootHash;
    console.log(`💾 Initial state persisted: ${result.rootHash}`);
  }).catch(e => {
    console.warn('⚠️ State persistence skipped:', (e as Error).message);
  });

  return agent;
}

/**
 * Get an agent instance by ID
 */
export function getAgent(id: string): AgentInstance | undefined {
  return agents.get(id);
}

/**
 * List all agents
 */
export function listAgents(): AgentInstance[] {
  return Array.from(agents.values());
}

/**
 * Run the ReAct loop for a given user message
 * 
 * ReAct Loop:
 * 1. REASON — LLM analyzes the message + context and decides next action
 * 2. ACT    — Execute the chosen tool (or respond directly)
 * 3. OBSERVE — Feed tool results back into context
 * 4. Repeat until the agent has a final answer
 */
export async function chat(
  agentId: string,
  userMessage: string
): Promise<{
  response: string;
  model: string;
  verified: boolean;
  steps: ReActStep[];
  memoryHash?: string;
}> {
  const agent = agents.get(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  agent.status = 'thinking';

  // Add user message to history
  agent.conversations.push({
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
  });

  const steps: ReActStep[] = [];
  let finalResponse = '';
  let model = agent.model;
  let verified = false;

  // Build the system prompt with tool definitions
  const systemPrompt = buildSystemPrompt(agent);
  const MAX_REACT_STEPS = 5;

  // Working context for this turn
  const workingMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    // Include last 20 conversation messages for context
    ...agent.conversations.slice(-20).map(c => ({
      role: c.role,
      content: c.content,
    })),
  ];

  for (let step = 0; step < MAX_REACT_STEPS; step++) {
    try {
      // REASON — Send to 0G Compute for inference
      const result = await chatCompletion(
        agent.providerAddress,
        workingMessages,
        { temperature: 0.7, maxTokens: 2048 }
      );

      model = result.model;
      verified = result.verified;

      const llmResponse = result.content;

      // Check if the LLM wants to use a tool
      const toolCall = parseToolCall(llmResponse);

      if (toolCall) {
        // ACT — Execute the tool
        steps.push({
          type: 'thought',
          content: `I need to use the "${toolCall.tool}" tool to ${toolCall.reasoning || 'complete this task'}.`,
        });

        const toolResult = await executeTool(agent, toolCall);

        steps.push({
          type: 'action',
          tool: toolCall.tool,
          input: toolCall.params,
          output: toolResult,
        });

        // OBSERVE — Add tool result to working context
        workingMessages.push({
          role: 'assistant',
          content: llmResponse,
        });
        workingMessages.push({
          role: 'user',
          content: `[Tool Result from "${toolCall.tool}"]: ${typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)}`,
        });

      } else {
        // No tool call — this is the final response
        finalResponse = llmResponse;
        steps.push({
          type: 'response',
          content: finalResponse,
        });
        break;
      }
    } catch (e) {
      // Inference failed — return error gracefully
      const errorMsg = (e as Error).message;
      console.error(`ReAct step ${step} error:`, errorMsg);

      finalResponse = `I encountered an issue while processing your request. ${errorMsg.includes('provider')
          ? 'The 0G Compute network is currently unavailable. Please check your provider configuration.'
          : `Error: ${errorMsg}`
        }`;
      steps.push({ type: 'error', content: errorMsg });
      break;
    }
  }

  // If we hit max steps without a final response
  if (!finalResponse) {
    finalResponse = 'I completed the requested actions. Let me know if you need anything else.';
    steps.push({ type: 'response', content: finalResponse });
  }

  // Add assistant response to conversation history
  agent.conversations.push({
    role: 'assistant',
    content: finalResponse,
    timestamp: Date.now(),
  });

  agent.status = 'idle';

  // Auto-persist memory every 10 messages
  let memoryHash: string | undefined;
  if (agent.conversations.length % 10 === 0) {
    memoryHash = await persistMemory(agentId);
  }

  return { response: finalResponse, model, verified, steps, memoryHash };
}

/**
 * Persist agent memory to 0G Storage
 */
export async function persistMemory(agentId: string): Promise<string | undefined> {
  const agent = agents.get(agentId);
  if (!agent) return undefined;

  try {
    const result = await uploadAgentMemory(agentId, {
      conversations: agent.conversations,
      preferences: {},
      context: `Memory snapshot for ${agent.name} — ${agent.conversations.length} messages`,
    });
    agent.memoryHashes.push(result.rootHash);
    console.log(`💾 Memory persisted for "${agent.name}": ${result.rootHash}`);
    return result.rootHash;
  } catch (e) {
    console.warn('⚠️ Memory persistence failed:', (e as Error).message);
    return undefined;
  }
}

// ---- Internal Helpers ----

/**
 * Build the system prompt with persona + tool definitions
 */
function buildSystemPrompt(agent: AgentInstance): string {
  const tools = Array.from(agent.tools.values());

  let prompt = `${agent.persona}

You are "${agent.name}", an autonomous AI agent running on NeuronForge.
Your inference runs through 0G's decentralized compute network.
Your memory persists on 0G's decentralized storage.

Current capabilities (skills): ${agent.skills.join(', ') || 'general knowledge'}`;

  if (tools.length > 0) {
    prompt += `

## Available Tools
You can use the following tools by responding with a JSON tool call block.
When you need to use a tool, respond with ONLY a JSON block in this exact format:
\`\`\`tool_call
{"tool": "tool_name", "params": {"param1": "value1"}, "reasoning": "why you chose this tool"}
\`\`\`

Available tools:
${tools.map(t => `- **${t.name}**: ${t.description}
  Parameters: ${JSON.stringify(t.parameters)}`).join('\n')}

IMPORTANT:
- Only use a tool when the user's request specifically requires it.
- For general conversation, respond normally without tool calls.
- After receiving a tool result, synthesize it into a helpful response.`;
  }

  return prompt;
}

/**
 * Parse a tool call from LLM output
 */
function parseToolCall(response: string): ToolCall | null {
  // Strategy 1: ```tool_call ... ``` block (with closing fence)
  const match1 = response.match(/```tool_call\s*\n?([\s\S]*?)\n?```/);
  if (match1) {
    try {
      const parsed = JSON.parse(match1[1].trim());
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, params: parsed.params || {}, reasoning: parsed.reasoning || '' };
      }
    } catch { }
  }

  // Strategy 2: ```tool_call ... (NO closing fence — LLM often omits it)
  // Also handles multiple tool calls by extracting just the first one
  const match1b = response.match(/```tool_call\s*\n?([\s\S]+)/);
  if (match1b) {
    let jsonStr = match1b[1].replace(/```\s*$/, '').trim();

    // Try parsing as-is first
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, params: parsed.params || {}, reasoning: parsed.reasoning || '' };
      }
      // Handle array of tool calls
      if (Array.isArray(parsed) && parsed[0]?.tool) {
        return { tool: parsed[0].tool, params: parsed[0].params || {}, reasoning: parsed[0].reasoning || '' };
      }
    } catch { }

    // Multiple JSON objects comma-separated: extract first { ... }
    let depth = 0, start = -1;
    for (let i = 0; i < jsonStr.length; i++) {
      if (jsonStr[i] === '{') { if (depth === 0) start = i; depth++; }
      if (jsonStr[i] === '}') {
        depth--; if (depth === 0 && start >= 0) {
          try {
            const parsed = JSON.parse(jsonStr.substring(start, i + 1));
            if (parsed.tool && typeof parsed.tool === 'string') {
              return { tool: parsed.tool, params: parsed.params || {}, reasoning: parsed.reasoning || '' };
            }
          } catch { }
          break;
        }
      }
    }
  }

  // Strategy 3: ```json ... ``` block containing a tool call
  const match2 = response.match(/```json\s*\n?([\s\S]*?)\n?```/);
  if (match2) {
    try {
      const parsed = JSON.parse(match2[1].trim());
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, params: parsed.params || {}, reasoning: parsed.reasoning || '' };
      }
    } catch { }
  }

  // Strategy 4: Entire response is JSON with a "tool" field (no markdown wrapper)
  const trimmed = response.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, params: parsed.params || {}, reasoning: parsed.reasoning || '' };
      }
    } catch { }
  }

  // Strategy 5: JSON embedded somewhere in the text
  const jsonMatch = response.match(/\{[^{}]*"tool"\s*:\s*"[^"]+?"[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, params: parsed.params || {}, reasoning: parsed.reasoning || '' };
      }
    } catch { }
  }

  return null;
}

/**
 * Execute a tool
 */
async function executeTool(
  agent: AgentInstance,
  toolCall: ToolCall
): Promise<unknown> {
  const tool = agent.tools.get(toolCall.tool);
  if (!tool) {
    return { error: `Unknown tool: ${toolCall.tool}` };
  }

  try {
    console.log(`🔧 Executing tool "${toolCall.tool}" for agent "${agent.name}"`);
    const result = await tool.execute(toolCall.params, agent);
    console.log(`✅ Tool "${toolCall.tool}" completed`);
    return result;
  } catch (e) {
    console.error(`❌ Tool "${toolCall.tool}" failed:`, (e as Error).message);
    return { error: (e as Error).message };
  }
}

/**
 * Register built-in 0G tools based on selected skills
 * 
 * All tools perform REAL on-chain operations against the 0G Galileo Testnet.
 */
function registerBuiltinTools(agent: AgentInstance) {

  // ═══════════════════════════════════════════════
  // 0G-MEMORY SKILL — Persistent Decentralized Memory
  // ═══════════════════════════════════════════════
  if (agent.skills.includes('0g-memory')) {
    agent.tools.set('save_memory', {
      name: 'save_memory',
      description: 'Save the current conversation and agent memory to 0G decentralized storage for permanent persistence. Use this when the user asks you to remember something or save progress.',
      parameters: { note: '(Optional) A note to include with the memory snapshot' },
      execute: async (params: Record<string, unknown>) => {
        const hash = await persistMemory(agent.id);
        return {
          success: true,
          rootHash: hash,
          note: params.note || 'Memory saved',
          storage: '0G Decentralized Storage',
          totalSnapshots: agent.memoryHashes.length,
          conversationsSaved: agent.conversations.length,
        };
      },
    });

    agent.tools.set('recall_memory', {
      name: 'recall_memory',
      description: 'Search through past conversations stored in memory. Use this to find previous discussions, facts the user shared, or decisions made.',
      parameters: { query: 'Keywords or topic to search for in memory' },
      execute: async (params: Record<string, unknown>) => {
        const query = (params.query as string || '').toLowerCase();
        const words = query.split(/\s+/).filter(w => w.length > 2);

        // Score each conversation message by keyword relevance
        const scored = agent.conversations
          .filter(c => c.role !== 'system')
          .map((c, idx) => {
            const text = c.content.toLowerCase();
            const score = words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
            return { ...c, score, index: idx };
          })
          .filter(c => c.score > 0)
          .sort((a, b) => b.score - a.score);

        return {
          query,
          found: scored.length,
          results: scored.slice(0, 8).map(c => ({
            role: c.role,
            content: c.content.substring(0, 300),
            relevance: c.score,
            timestamp: new Date(c.timestamp).toISOString(),
          })),
          totalMemorySnapshots: agent.memoryHashes.length,
          totalConversations: agent.conversations.length,
        };
      },
    });
  }

  // ═══════════════════════════════════════════════
  // 0G-WALLET SKILL — Real On-Chain Operations
  // ═══════════════════════════════════════════════
  if (agent.skills.includes('0g-wallet')) {
    agent.tools.set('check_balance', {
      name: 'check_balance',
      description: 'Check the OG token balance of any wallet on 0G Chain. If no address is given, checks the agent\'s own wallet.',
      parameters: { address: '(Optional) A valid 0x... wallet address. Leave empty to check the agent wallet.' },
      execute: async (params: Record<string, unknown>) => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');

        let address = (params.address as string) || '';
        if (!address || !address.startsWith('0x') || address.length !== 42) {
          address = process.env.PRIVATE_KEY
            ? new ethers.Wallet(process.env.PRIVATE_KEY).address
            : '0x0000000000000000000000000000000000000000';
        }

        const balance = await provider.getBalance(address);
        return {
          address,
          balance: ethers.formatEther(balance) + ' OG',
          balanceWei: balance.toString(),
          network: '0G Galileo Testnet',
          chainId: 16602,
        };
      },
    });

    agent.tools.set('send_og', {
      name: 'send_og',
      description: 'Send OG tokens from the agent wallet to another address on 0G Chain. Maximum 0.01 OG per transaction for safety. Use this when the user asks to transfer or send tokens.',
      parameters: {
        to: 'Recipient wallet address (0x...)',
        amount: 'Amount of OG to send (e.g., "0.001"). Max 0.01 OG.',
      },
      execute: async (params: Record<string, unknown>) => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');

        if (!process.env.PRIVATE_KEY) throw new Error('Agent wallet not configured');
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        const to = params.to as string;
        const amount = params.amount as string;

        if (!to || !to.startsWith('0x') || to.length !== 42) {
          throw new Error('Invalid recipient address. Must be a valid 0x... address.');
        }

        const amountFloat = parseFloat(amount);
        if (isNaN(amountFloat) || amountFloat <= 0) {
          throw new Error('Invalid amount. Must be a positive number.');
        }
        if (amountFloat > 0.01) {
          throw new Error('Safety limit: Maximum 0.01 OG per transaction. Requested: ' + amount);
        }

        const tx = await wallet.sendTransaction({
          to,
          value: ethers.parseEther(amount),
        });

        const receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('tx_timeout')), 30000))
        ]).catch(() => null);

        return {
          success: true,
          txHash: tx.hash,
          from: wallet.address,
          to,
          amount: amount + ' OG',
          blockNumber: (receipt as any)?.blockNumber || 'pending',
          explorer: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
        };
      },
    });

    agent.tools.set('get_block', {
      name: 'get_block',
      description: 'Get the latest block information from 0G Chain, including block number, timestamp, and transaction count.',
      parameters: {},
      execute: async () => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');
        const block = await provider.getBlock('latest');
        return {
          number: block?.number,
          timestamp: block?.timestamp,
          date: block?.timestamp ? new Date(block.timestamp * 1000).toISOString() : null,
          hash: block?.hash,
          parentHash: block?.parentHash,
          transactions: block?.transactions?.length || 0,
          gasUsed: block?.gasUsed?.toString(),
          network: '0G Galileo Testnet',
        };
      },
    });

    agent.tools.set('get_transaction', {
      name: 'get_transaction',
      description: 'Look up a transaction on 0G Chain by its hash. Returns sender, recipient, value, status, and block details.',
      parameters: { txHash: 'The transaction hash to look up (0x...)' },
      execute: async (params: Record<string, unknown>) => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');

        const txHash = params.txHash as string;
        if (!txHash || !txHash.startsWith('0x')) {
          throw new Error('Invalid transaction hash');
        }

        const tx = await provider.getTransaction(txHash);
        if (!tx) throw new Error('Transaction not found');

        const receipt = await provider.getTransactionReceipt(txHash);

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value) + ' OG',
          status: receipt?.status === 1 ? 'confirmed' : receipt?.status === 0 ? 'failed' : 'pending',
          blockNumber: receipt?.blockNumber || 'pending',
          gasUsed: receipt?.gasUsed?.toString(),
          explorer: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
        };
      },
    });

    agent.tools.set('get_wallet_info', {
      name: 'get_wallet_info',
      description: 'Get comprehensive information about the agent\'s wallet: address, balance, transaction count (nonce), and network details.',
      parameters: {},
      execute: async () => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');

        if (!process.env.PRIVATE_KEY) throw new Error('Agent wallet not configured');
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        const [balance, nonce, network, block] = await Promise.all([
          provider.getBalance(wallet.address),
          provider.getTransactionCount(wallet.address),
          provider.getNetwork(),
          provider.getBlock('latest'),
        ]);

        return {
          address: wallet.address,
          balance: ethers.formatEther(balance) + ' OG',
          transactionCount: nonce,
          network: '0G Galileo Testnet',
          chainId: Number(network.chainId),
          latestBlock: block?.number,
          explorer: `https://chainscan-galileo.0g.ai/address/${wallet.address}`,
        };
      },
    });

    agent.tools.set('get_transactions', {
      name: 'get_transactions',
      description: 'Get recent transaction history for the agent wallet. Returns the last few transactions involving this wallet on 0G Chain, including sent and received OG transfers.',
      parameters: { count: '(Optional) Number of recent transactions to return (default: 5, max: 10)' },
      execute: async (params: Record<string, unknown>) => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');
        
        if (!process.env.PRIVATE_KEY) throw new Error('Agent wallet not configured');
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const walletAddr = wallet.address.toLowerCase();
        const maxCount = Math.min(parseInt(params.count as string) || 5, 10);
        
        const [latestBlock, nonce, balance] = await Promise.all([
          provider.getBlockNumber(),
          provider.getTransactionCount(wallet.address),
          provider.getBalance(wallet.address),
        ]);
        
        const txs: any[] = [];

        // Fast approach: scan a small window of recent blocks (200) sequentially
        // but only fetch block headers first, then full blocks only for non-empty ones
        const scanWindow = 200;
        const startBlock = Math.max(0, latestBlock - scanWindow);
        
        const scanPromises = [];
        for (let b = latestBlock; b >= startBlock; b--) {
          scanPromises.push(
            provider.getBlock(b, true).then(block => {
              if (!block || !block.prefetchedTransactions) return;
              for (const tx of block.prefetchedTransactions) {
                if (tx.from.toLowerCase() === walletAddr || tx.to?.toLowerCase() === walletAddr) {
                  txs.push({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to || 'Contract Creation',
                    value: ethers.formatEther(tx.value) + ' OG',
                    direction: tx.from.toLowerCase() === walletAddr ? 'sent' : 'received',
                    status: 'confirmed',
                    blockNumber: block.number,
                    timestamp: block.timestamp,
                    date: new Date(block.timestamp * 1000).toISOString(),
                    explorer: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
                  });
                }
              }
            }).catch(() => {})
          );
          // Process in batches of 20 to avoid overwhelming RPC
          if (scanPromises.length >= 20) {
            await Promise.all(scanPromises);
            scanPromises.length = 0;
            if (txs.length >= maxCount) break;
          }
        }
        // Flush remaining
        if (scanPromises.length > 0) await Promise.all(scanPromises);

        // Sort by block number descending and limit
        txs.sort((a, b) => b.blockNumber - a.blockNumber);
        const limited = txs.slice(0, maxCount);
        
        return {
          address: wallet.address,
          balance: ethers.formatEther(balance) + ' OG',
          transactions: limited,
          count: limited.length,
          totalSent: nonce,
          blocksScanned: scanWindow,
          latestBlock,
          network: '0G Galileo Testnet',
          explorer: `https://chainscan-galileo.0g.ai/address/${wallet.address}`,
          note: limited.length === 0
            ? `No transactions found in the last ${scanWindow} blocks. This wallet has sent ${nonce} total transactions on-chain. View full history on the explorer.`
            : undefined,
        };
      },
    });
  }

  // ═══════════════════════════════════════════════
  // 0G-PUBLISH SKILL — Agent Tokenization as INFT
  // ═══════════════════════════════════════════════
  if (agent.skills.includes('0g-publish')) {
    agent.tools.set('publish_agent', {
      name: 'publish_agent',
      description: 'Package this agent\'s current state (persona, skills, memory) and mint it as an INFT (ERC-7857) on 0G Chain. This tokenizes the agent on the blockchain.',
      parameters: {},
      execute: async () => {
        // Step 1: Persist current state to 0G Storage
        const memHash = await persistMemory(agent.id);

        // Step 2: Upload agent config to 0G Storage
        const stateResult = await uploadAgentState(agent.id, {
          persona: agent.persona,
          skills: agent.skills,
          config: { model: agent.model },
          version: 1,
        });

        // Step 3: Attempt INFT mint on 0G Chain
        let mintResult = { tokenId: 'not_minted', txHash: '' };
        try {
          const { mintINFT, getWalletAddress } = await import('../services/chain.js');
          const walletAddress = getWalletAddress();
          mintResult = await mintINFT(
            walletAddress,
            stateResult.rootHash,
            JSON.stringify({
              agentId: agent.id,
              name: agent.name,
              skills: agent.skills,
              memoryHashes: agent.memoryHashes,
              stateHash: stateResult.rootHash,
            })
          );
        } catch (e) {
          console.warn('⚠️ INFT mint via tool skipped:', (e as Error).message);
        }

        return {
          agentId: agent.id,
          name: agent.name,
          skills: agent.skills,
          memoryHash: memHash,
          stateHash: stateResult.rootHash,
          tokenId: mintResult.tokenId,
          txHash: mintResult.txHash,
          conversations: agent.conversations.length,
          status: mintResult.txHash ? 'minted_as_inft' : 'state_saved',
          explorer: mintResult.txHash ? `https://chainscan-galileo.0g.ai/tx/${mintResult.txHash}` : null,
        };
      },
    });
  }

  // ═══════════════════════════════════════════════
  // 0G-INFERENCE SKILL — The engine itself
  // ═══════════════════════════════════════════════
  // Note: 0g-inference doesn't register tools — it IS the agent's brain.
  // Every ReAct reasoning step runs through 0G Compute automatically.
}

