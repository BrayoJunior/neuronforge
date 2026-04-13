/**
 * NeuronForge — Skills API Routes
 */

import { Router, Request, Response } from 'express';
import { uploadSkillPackage } from '../services/storage.js';

export const skillRoutes = Router();

// Built-in 0G Skills registry
const skills = [
  {
    id: '0g-inference',
    name: '0G Inference',
    description: 'Routes LLM reasoning through 0G Compute Network for decentralized, TEE-verified inference.',
    category: 'core',
    version: '1.0.0',
    author: 'NeuronForge',
    ogComponent: '0G Compute',
    installed: true,
  },
  {
    id: '0g-memory',
    name: '0G Memory',
    description: 'Persists agent memory and conversation history to 0G Storage for cross-session continuity.',
    category: 'core',
    version: '1.0.0',
    author: 'NeuronForge',
    ogComponent: '0G Storage',
    installed: true,
  },
  {
    id: '0g-wallet',
    name: '0G Wallet',
    description: 'Enables agents to interact with 0G Chain — check balances, read contracts, execute transactions.',
    category: 'core',
    version: '1.0.0',
    author: 'NeuronForge',
    ogComponent: '0G Chain',
    installed: true,
  },
  {
    id: '0g-publish',
    name: '0G Publish',
    description: 'Packages agent state and mints as an INFT (ERC-7857) for ownership transfer and trading.',
    category: 'core',
    version: '1.0.0',
    author: 'NeuronForge',
    ogComponent: '0G Chain + INFTs',
    installed: true,
  },
  {
    id: 'web-browser',
    name: 'Web Browser',
    description: 'Browse the web, extract data, fill forms, and interact with websites.',
    category: 'utility',
    version: '1.0.0',
    author: 'OpenClaw',
    ogComponent: null,
    installed: false,
  },
  {
    id: 'file-system',
    name: 'File System',
    description: 'Read, write, and manage files on the agent\'s host system.',
    category: 'utility',
    version: '1.0.0',
    author: 'OpenClaw',
    ogComponent: null,
    installed: false,
  },
];

/**
 * GET /api/skills — List all available skills
 */
skillRoutes.get('/', (_req: Request, res: Response) => {
  res.json({ skills });
});

/**
 * GET /api/skills/:id — Get skill details
 */
skillRoutes.get('/:id', (req: Request, res: Response) => {
  const skill = skills.find(s => s.id === req.params.id);
  if (!skill) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }
  res.json({ skill });
});

/**
 * POST /api/skills/publish — Publish a custom skill to 0G Storage
 */
skillRoutes.post('/publish', async (req: Request, res: Response) => {
  try {
    const { name, description, version, skillMd, toolsCode } = req.body;
    
    if (!name || !skillMd) {
      res.status(400).json({ error: 'name and skillMd are required' });
      return;
    }

    const skillId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const result = await uploadSkillPackage(skillId, {
      name,
      description: description || '',
      version: version || '1.0.0',
      skillMd,
      toolsCode: toolsCode || '',
    });

    // Add to local registry
    skills.push({
      id: skillId,
      name,
      description: description || '',
      category: 'community',
      version: version || '1.0.0',
      author: 'Community',
      ogComponent: null,
      installed: false,
    });

    res.status(201).json({
      skillId,
      storageHash: result.rootHash,
      txHash: result.txHash,
    });
  } catch (error) {
    console.error('Skill publish error:', error);
    res.status(500).json({ error: 'Failed to publish skill' });
  }
});
