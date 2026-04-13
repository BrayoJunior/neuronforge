/**
 * NeuronForge — Agent API Routes
 * 
 * CRUD operations for agents + OpenClaw integration
 */

import { Router, Request, Response } from 'express';
import { uploadAgentMemory, uploadAgentState } from '../services/storage.js';
import { chatCompletion, getChatProviders } from '../services/compute.js';
import { registerAgent, mintINFT, getWalletAddress } from '../services/chain.js';

export const agentRoutes = Router();

// In-memory agent store (would use a real DB in production)
const agents: Map<string, {
  id: string;
  name: string;
  persona: string;
  skills: string[];
  model: string;
  providerAddress: string;
  memoryHash?: string;
  stateHash?: string;
  inftTokenId?: string;
  createdAt: number;
  conversations: Array<{ role: string; content: string; timestamp: number }>;
}> = new Map();

/**
 * GET /api/agents — List all agents
 */
agentRoutes.get('/', (_req: Request, res: Response) => {
  const agentList = Array.from(agents.values()).map(a => ({
    id: a.id,
    name: a.name,
    persona: a.persona,
    skills: a.skills,
    model: a.model,
    inftTokenId: a.inftTokenId,
    createdAt: a.createdAt,
    conversationCount: a.conversations.length,
  }));
  res.json({ agents: agentList });
});

/**
 * POST /api/agents — Create a new agent
 */
agentRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { name, persona, skills, model, providerAddress } = req.body;
    
    if (!name || !persona) {
      res.status(400).json({ error: 'name and persona are required' });
      return;
    }

    const id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const agent = {
      id,
      name,
      persona: persona || 'You are a helpful autonomous agent.',
      skills: skills || [],
      model: model || 'deepseek-chat-v3-0324',
      providerAddress: providerAddress || '',
      createdAt: Date.now(),
      conversations: [],
    };

    agents.set(id, agent);

    // Upload initial state to 0G Storage
    try {
      const stateResult = await uploadAgentState(id, {
        persona: agent.persona,
        skills: agent.skills,
        config: { model: agent.model },
        version: 1,
      });
      agent.stateHash = stateResult.rootHash;
    } catch (e) {
      console.warn('⚠️ Failed to upload initial state to 0G Storage:', (e as Error).message);
    }

    res.status(201).json({ agent: { ...agent, conversations: undefined } });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

/**
 * GET /api/agents/:id — Get agent details
 */
agentRoutes.get('/:id', (req: Request, res: Response) => {
  const agent = agents.get(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ agent });
});

/**
 * POST /api/agents/:id/chat — Chat with an agent
 */
agentRoutes.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const agent = agents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    // Add user message to conversation history
    agent.conversations.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    // Build message context with persona and conversation history
    const systemMessage = {
      role: 'system',
      content: `${agent.persona}\n\nYou are an agent named "${agent.name}". You have the following skills: ${agent.skills.join(', ') || 'general knowledge'}. Be helpful, concise, and proactive.`,
    };

    const messages = [
      systemMessage,
      ...agent.conversations.slice(-20).map(c => ({
        role: c.role,
        content: c.content,
      })),
    ];

    // Route through 0G Compute if provider is configured
    let response: { content: string; model: string; verified: boolean };
    
    if (agent.providerAddress) {
      response = await chatCompletion(agent.providerAddress, messages);
    } else {
      // Fallback: try to find a provider
      const providers = await getChatProviders();
      if (providers.length === 0) {
        res.status(503).json({ error: 'No 0G Compute providers available' });
        return;
      }
      agent.providerAddress = providers[0].provider;
      response = await chatCompletion(agent.providerAddress, messages);
    }

    // Add assistant response to history
    agent.conversations.push({
      role: 'assistant',
      content: response.content,
      timestamp: Date.now(),
    });

    // Persist memory to 0G Storage every 10 messages
    if (agent.conversations.length % 10 === 0) {
      try {
        const memResult = await uploadAgentMemory(agent.id, {
          conversations: agent.conversations,
          preferences: {},
          context: `Agent ${agent.name} memory snapshot`,
        });
        agent.memoryHash = memResult.rootHash;
        console.log(`💾 Memory persisted for ${agent.name} | Hash: ${memResult.rootHash}`);
      } catch (e) {
        console.warn('⚠️ Failed to persist memory:', (e as Error).message);
      }
    }

    res.json({
      response: response.content,
      model: response.model,
      verified: response.verified,
      memoryHash: agent.memoryHash,
      conversationLength: agent.conversations.length,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

/**
 * POST /api/agents/:id/mint — Mint agent as INFT
 */
agentRoutes.post('/:id/mint', async (req: Request, res: Response) => {
  try {
    const agent = agents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Upload full agent state to 0G Storage first
    const stateResult = await uploadAgentState(agent.id, {
      persona: agent.persona,
      skills: agent.skills,
      config: { model: agent.model },
      version: 1,
    });

    // Mint as INFT on 0G Chain
    const walletAddress = getWalletAddress();
    const inftResult = await mintINFT(
      walletAddress,
      stateResult.rootHash, // IPFS-style reference to 0G Storage
      JSON.stringify({
        agentId: agent.id,
        name: agent.name,
        memoryHash: agent.memoryHash,
        stateHash: stateResult.rootHash,
      })
    );

    agent.inftTokenId = inftResult.tokenId;

    res.json({
      tokenId: inftResult.tokenId,
      txHash: inftResult.txHash,
      stateHash: stateResult.rootHash,
    });
  } catch (error) {
    console.error('Mint error:', error);
    res.status(500).json({ error: 'Failed to mint INFT' });
  }
});

/**
 * POST /api/agents/:id/persist — Manually persist agent memory
 */
agentRoutes.post('/:id/persist', async (req: Request, res: Response) => {
  try {
    const agent = agents.get(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const memResult = await uploadAgentMemory(agent.id, {
      conversations: agent.conversations,
      preferences: {},
      context: `Manual persist for ${agent.name}`,
    });

    agent.memoryHash = memResult.rootHash;

    res.json({
      memoryHash: memResult.rootHash,
      txHash: memResult.txHash,
      conversationsCount: agent.conversations.length,
    });
  } catch (error) {
    console.error('Persist error:', error);
    res.status(500).json({ error: 'Failed to persist memory' });
  }
});

/**
 * GET /api/agents/providers/list — List available 0G Compute providers
 */
agentRoutes.get('/providers/list', async (_req: Request, res: Response) => {
  try {
    const providers = await getChatProviders();
    res.json({ providers });
  } catch (error) {
    console.error('Provider list error:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});
