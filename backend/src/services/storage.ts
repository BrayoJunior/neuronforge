/**
 * NeuronForge — 0G Storage Service
 * 
 * Handles all interactions with 0G decentralized storage:
 * - Agent memory persistence
 * - State snapshots
 * - Skill package storage
 * - INFT metadata storage
 */

import { Indexer, ZgFile, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const RPC_URL = process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai';
const INDEXER_RPC = process.env.OG_STORAGE_INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai';

let indexer: Indexer | null = null;
let signer: ethers.Wallet | null = null;

/**
 * Initialize the 0G Storage client
 */
export function initStorageService(): { indexer: Indexer; signer: ethers.Wallet } {
  if (indexer && signer) return { indexer, signer };

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not set in environment');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  signer = new ethers.Wallet(privateKey, provider);
  indexer = new Indexer(INDEXER_RPC);

  console.log('💾 0G Storage service initialized');
  return { indexer, signer };
}

/**
 * Upload in-memory data to 0G Storage
 * Used for agent memory, state, and config
 */
export async function uploadData(data: string | object): Promise<{ rootHash: string; txHash: string }> {
  const { indexer: idx, signer: sgn } = initStorageService();

  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const encoded = new TextEncoder().encode(content);
  const memData = new MemData(encoded);

  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

  const rootHash = tree!.rootHash();
  console.log(`📤 Uploading to 0G Storage | Root Hash: ${rootHash}`);

  const [tx, uploadErr] = await idx.upload(memData, RPC_URL, sgn);
  if (uploadErr !== null) throw new Error(`Upload error: ${uploadErr}`);

  const result = 'rootHash' in tx! 
    ? { rootHash: tx.rootHash, txHash: tx.txHash }
    : { rootHash: tx.rootHashes[0], txHash: tx.txHashes[0] };

  console.log(`✅ Upload complete | TX: ${result.txHash}`);
  return result;
}

/**
 * Download data from 0G Storage by root hash
 */
export async function downloadData(rootHash: string, outputPath: string): Promise<void> {
  const { indexer: idx } = initStorageService();

  console.log(`📥 Downloading from 0G Storage | Root Hash: ${rootHash}`);
  const err = await idx.download(rootHash, outputPath, true);
  if (err !== null) throw new Error(`Download error: ${err}`);

  console.log(`✅ Download complete | Saved to: ${outputPath}`);
}

/**
 * Upload agent memory snapshot
 */
export async function uploadAgentMemory(
  agentId: string,
  memory: {
    conversations: Array<{ role: string; content: string; timestamp: number }>;
    preferences: Record<string, unknown>;
    context: string;
  }
): Promise<{ rootHash: string; txHash: string }> {
  const payload = {
    agentId,
    timestamp: Date.now(),
    type: 'memory_snapshot',
    memory,
  };
  return uploadData(payload);
}

/**
 * Upload agent state (skills config, persona, etc.)
 */
export async function uploadAgentState(
  agentId: string,
  state: {
    persona: string;
    skills: string[];
    config: Record<string, unknown>;
    version: number;
  }
): Promise<{ rootHash: string; txHash: string }> {
  const payload = {
    agentId,
    timestamp: Date.now(),
    type: 'agent_state',
    state,
  };
  return uploadData(payload);
}

/**
 * Upload skill package to 0G Storage
 */
export async function uploadSkillPackage(
  skillId: string,
  skillData: {
    name: string;
    description: string;
    version: string;
    skillMd: string;
    toolsCode: string;
  }
): Promise<{ rootHash: string; txHash: string }> {
  const payload = {
    skillId,
    timestamp: Date.now(),
    type: 'skill_package',
    ...skillData,
  };
  return uploadData(payload);
}
