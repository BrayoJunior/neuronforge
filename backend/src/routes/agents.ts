/**
 * NeuronForge — Agent API Routes (v2)
 * 
 * Wired to the OpenClaw-compatible agent runtime with
 * ReAct loop, 0G Compute inference, and 0G Storage persistence.
 */

import { Router, Request, Response } from 'express';
import { createAgent, getAgent, listAgents, chat, persistMemory } from '../openclaw/runtime.js';
import { mintINFT, getWalletAddress } from '../services/chain.js';
import { uploadAgentState } from '../services/storage.js';

export const agentRoutes = Router();

/**
 * GET /api/agents — List all agents
 */
agentRoutes.get('/', (_req: Request, res: Response) => {
  const agents = listAgents().map(a => ({
    id: a.id,
    name: a.name,
    persona: a.persona,
    skills: a.skills,
    model: a.model,
    status: a.status,
    conversationCount: a.conversations.length,
    memoryHashes: a.memoryHashes,
    stateHash: a.stateHash,
    createdAt: a.createdAt,
  }));
  res.json({ agents });
});

/**
 * POST /api/agents — Create a new agent
 */
agentRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const { name, persona, skills, model, providerAddress } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const agent = await createAgent({
      name,
      persona,
      skills,
      model,
      providerAddress,
    });

    res.status(201).json({
      agent: {
        id: agent.id,
        name: agent.name,
        persona: agent.persona,
        skills: agent.skills,
        model: agent.model,
        status: agent.status,
        stateHash: agent.stateHash,
        tools: Array.from(agent.tools.keys()),
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    console.error('Agent creation error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

/**
 * GET /api/agents/:id — Get agent details
 */
agentRoutes.get('/:id', (req: Request, res: Response) => {
  const agent = getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json({
    agent: {
      id: agent.id,
      name: agent.name,
      persona: agent.persona,
      skills: agent.skills,
      model: agent.model,
      status: agent.status,
      conversationCount: agent.conversations.length,
      conversations: agent.conversations.slice(-50), // Last 50 messages
      memoryHashes: agent.memoryHashes,
      stateHash: agent.stateHash,
      tools: Array.from(agent.tools.keys()),
      createdAt: agent.createdAt,
    },
  });
});

/**
 * POST /api/agents/:id/chat — Chat with an agent (runs ReAct loop)
 */
agentRoutes.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    // Run the ReAct loop
    const result = await chat(req.params.id, message);

    res.json({
      response: result.response,
      model: result.model,
      verified: result.verified,
      steps: result.steps,
      memoryHash: result.memoryHash,
      conversationLength: agent.conversations.length,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * POST /api/agents/:id/persist — Manually persist agent memory to 0G Storage
 */
agentRoutes.post('/:id/persist', async (req: Request, res: Response) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const hash = await persistMemory(req.params.id);

    res.json({
      memoryHash: hash || 'persistence_skipped',
      conversationsCount: agent.conversations.length,
      totalSnapshots: agent.memoryHashes.length,
    });
  } catch (error) {
    console.error('Persist error:', error);
    res.status(500).json({ error: 'Failed to persist memory' });
  }
});

/**
 * POST /api/agents/:id/mint — Mint agent as INFT on 0G Chain
 */
agentRoutes.post('/:id/mint', async (req: Request, res: Response) => {
  try {
    const agent = getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Persist final state to 0G Storage
    const stateResult = await uploadAgentState(agent.id, {
      persona: agent.persona,
      skills: agent.skills,
      config: { model: agent.model },
      version: 1,
    });

    // Persist memory
    await persistMemory(agent.id);

    // Mint INFT on 0G Chain
    const walletAddress = getWalletAddress();
    const inftResult = await mintINFT(
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

    res.json({
      tokenId: inftResult.tokenId,
      txHash: inftResult.txHash,
      stateHash: stateResult.rootHash,
      memoryHashes: agent.memoryHashes,
    });
  } catch (error) {
    console.error('Mint error:', error);
    res.status(500).json({ error: 'Failed to mint INFT' });
  }
});

/**
 * GET /api/agents/:id/tools — List agent's registered tools
 */
agentRoutes.get('/:id/tools', (req: Request, res: Response) => {
  const agent = getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const tools = Array.from(agent.tools.values()).map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  res.json({ tools, count: tools.length });
});

/**
 * GET /api/providers — List available 0G Compute providers
 */
agentRoutes.get('/providers/list', async (_req: Request, res: Response) => {
  try {
    const { getChatProviders } = await import('../services/compute.js');
    const providers = await getChatProviders();
    res.json({ providers });
  } catch (error) {
    console.error('Provider list error:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});
