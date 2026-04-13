/**
 * 0G Memory Skill — Tool Implementation
 * 
 * Persists agent memory to 0G decentralized storage
 * for cross-session continuity.
 */

import { Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

interface MemoryConfig {
  rpcUrl: string;
  indexerRpc: string;
  privateKey: string;
}

interface MemorySnapshot {
  agentId: string;
  timestamp: number;
  conversations: Array<{ role: string; content: string; timestamp: number }>;
  preferences: Record<string, unknown>;
  context: string;
  version: number;
}

interface SaveResult {
  rootHash: string;
  txHash: string;
  size: number;
}

let indexer: Indexer | null = null;
let signer: ethers.Wallet | null = null;

function init(config: MemoryConfig) {
  if (indexer && signer) return { indexer, signer };
  
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  signer = new ethers.Wallet(config.privateKey, provider);
  indexer = new Indexer(config.indexerRpc);
  
  return { indexer, signer };
}

/**
 * Tool: save_memory
 * 
 * Save agent memory snapshot to 0G Storage
 */
export async function saveMemory(
  snapshot: MemorySnapshot,
  config: MemoryConfig
): Promise<SaveResult> {
  const { indexer: idx, signer: sgn } = init(config);

  const content = JSON.stringify(snapshot, null, 2);
  const encoded = new TextEncoder().encode(content);
  const memData = new MemData(encoded);

  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

  const rootHash = tree!.rootHash();

  const [tx, uploadErr] = await idx.upload(memData, config.rpcUrl, sgn);
  if (uploadErr !== null) throw new Error(`Upload error: ${uploadErr}`);

  const result = 'rootHash' in tx!
    ? { rootHash: tx.rootHash, txHash: tx.txHash }
    : { rootHash: tx.rootHashes[0], txHash: tx.txHashes[0] };

  return {
    rootHash: result.rootHash,
    txHash: result.txHash,
    size: encoded.length,
  };
}

/**
 * Tool: load_memory
 * 
 * Load agent memory from 0G Storage by root hash
 */
export async function loadMemory(
  rootHash: string,
  config: MemoryConfig
): Promise<MemorySnapshot> {
  const { indexer: idx } = init(config);
  
  // Download to temp path
  const tmpPath = `/tmp/memory_${Date.now()}.json`;
  const err = await idx.download(rootHash, tmpPath, true);
  if (err !== null) throw new Error(`Download error: ${err}`);

  // Read and parse
  const fs = await import('fs');
  const content = fs.readFileSync(tmpPath, 'utf-8');
  fs.unlinkSync(tmpPath); // Clean up
  
  return JSON.parse(content) as MemorySnapshot;
}

/**
 * Tool: list_memory_hashes
 * 
 * Returns stored memory hashes for an agent
 * (In production, this would query an on-chain registry)
 */
export function listMemoryHashes(agentId: string): string[] {
  // This would query the AgentRegistry contract for stored state hashes
  console.log(`Listing memory hashes for agent ${agentId}`);
  return [];
}
