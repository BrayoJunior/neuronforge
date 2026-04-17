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

  // Persist initial state to 0G Storage
  try {
    const result = await uploadAgentState(id, {
      persona: agent.persona,
      skills: agent.skills,
      config: { model: agent.model, providerAddress: agent.providerAddress },
      version: 1,
    });
    agent.stateHash = result.rootHash;
    console.log(`💾 Initial state persisted: ${result.rootHash}`);
  } catch (e) {
    console.warn('⚠️ State persistence skipped:', (e as Error).message);
  }

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
      
      finalResponse = `I encountered an issue while processing your request. ${
        errorMsg.includes('provider') 
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
  // Look for ```tool_call ... ``` block
  const match = response.match(/```tool_call\s*\n?([\s\S]*?)\n?```/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed.tool && typeof parsed.tool === 'string') {
      return {
        tool: parsed.tool,
        params: parsed.params || {},
        reasoning: parsed.reasoning || '',
      };
    }
  } catch {
    // Not valid JSON — not a tool call
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
 */
function registerBuiltinTools(agent: AgentInstance) {
  if (agent.skills.includes('0g-memory')) {
    agent.tools.set('save_memory', {
      name: 'save_memory',
      description: 'Save the current conversation and agent memory to 0G decentralized storage for permanent persistence.',
      parameters: { note: 'Optional note to include with the memory snapshot' },
      execute: async (params: Record<string, unknown>) => {
        const hash = await persistMemory(agent.id);
        return {
          success: true,
          rootHash: hash,
          note: params.note || 'Memory saved',
          storage: '0G Decentralized Storage',
        };
      },
    });

    agent.tools.set('recall_memory', {
      name: 'recall_memory',
      description: 'Recall information from past conversations stored in memory.',
      parameters: { query: 'What to search for in memory' },
      execute: async (params: Record<string, unknown>) => {
        // Search through conversation history
        const query = (params.query as string || '').toLowerCase();
        const relevant = agent.conversations.filter(c =>
          c.content.toLowerCase().includes(query)
        );
        return {
          found: relevant.length,
          results: relevant.slice(-5).map(c => ({
            role: c.role,
            content: c.content.substring(0, 200),
            timestamp: new Date(c.timestamp).toISOString(),
          })),
          totalMemoryHashes: agent.memoryHashes.length,
        };
      },
    });
  }

  if (agent.skills.includes('0g-wallet')) {
    agent.tools.set('check_balance', {
      name: 'check_balance',
      description: 'Check the OG token balance of a wallet address on 0G Chain.',
      parameters: { address: 'Wallet address to check (optional, defaults to agent wallet)' },
      execute: async (params: Record<string, unknown>) => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');
        const address = (params.address as string) || (process.env.PRIVATE_KEY
          ? new ethers.Wallet(process.env.PRIVATE_KEY).address
          : '0x0000000000000000000000000000000000000000');
        const balance = await provider.getBalance(address);
        return {
          address,
          balance: ethers.formatEther(balance) + ' OG',
          network: '0G Galileo Testnet',
          chainId: 16601,
        };
      },
    });

    agent.tools.set('get_block', {
      name: 'get_block',
      description: 'Get the latest block information from 0G Chain.',
      parameters: {},
      execute: async () => {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');
        const block = await provider.getBlock('latest');
        return {
          number: block?.number,
          timestamp: block?.timestamp,
          hash: block?.hash,
          transactions: block?.transactions?.length || 0,
        };
      },
    });
  }

  if (agent.skills.includes('0g-publish')) {
    agent.tools.set('publish_agent', {
      name: 'publish_agent',
      description: 'Package this agent\'s current state (persona, skills, memory) and prepare it for INFT minting on 0G Chain.',
      parameters: {},
      execute: async () => {
        // Persist current state
        const memHash = await persistMemory(agent.id);
        return {
          agentId: agent.id,
          name: agent.name,
          skills: agent.skills,
          memoryHash: memHash,
          stateHash: agent.stateHash,
          conversations: agent.conversations.length,
          status: 'ready_for_minting',
          note: 'Agent state packaged. Use the INFT minting endpoint to tokenize this agent on 0G Chain.',
        };
      },
    });
  }
}
