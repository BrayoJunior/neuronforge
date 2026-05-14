/**
 * 0G Publish Skill — Tool Implementation
 * 
 * Packages agent state and mints as an INFT (ERC-7857) on 0G Chain
 */

import { Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

interface PublishConfig {
  rpcUrl: string;
  indexerRpc: string;
  privateKey: string;
  inftContractAddress: string;
}

interface AgentPackage {
  agentId: string;
  name: string;
  persona: string;
  skills: string[];
  memoryHash?: string;
  config: Record<string, unknown>;
}

interface PublishResult {
  storageHash: string;
  tokenId: string;
  txHash: string;
}

// Minimal NeuronForgeINFT ABI
const INFT_ABI = [
  'function mintAgent(address to, string metadataURI, bytes encryptedIntelligence) returns (uint256)',
  'event AgentMinted(uint256 indexed tokenId, address indexed to, string metadataURI)',
];

/**
 * Tool: publish_agent
 * 
 * Package agent state, upload to 0G Storage, and mint as INFT
 */
export async function publishAgent(
  agentPackage: AgentPackage,
  config: PublishConfig
): Promise<PublishResult> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const indexer = new Indexer(config.indexerRpc);

  // Step 1: Package and upload to 0G Storage
  const packagePayload = {
    ...agentPackage,
    timestamp: Date.now(),
    type: 'agent_inft_package',
    version: '1.0.0',
  };

  const content = JSON.stringify(packagePayload, null, 2);
  const encoded = new TextEncoder().encode(content);
  const memData = new MemData(encoded);

  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`Merkle tree error: ${treeErr}`);

  const rootHash = tree!.rootHash();

  const [tx, uploadErr] = await indexer.upload(memData, config.rpcUrl, wallet);
  if (uploadErr !== null) throw new Error(`Upload error: ${uploadErr}`);

  const storageTx = 'rootHash' in tx!
    ? { rootHash: tx.rootHash, txHash: tx.txHash }
    : { rootHash: tx.rootHashes[0], txHash: tx.txHashes[0] };

  // Step 2: Mint INFT on 0G Chain
  const inftContract = new ethers.Contract(
    config.inftContractAddress,
    INFT_ABI,
    wallet
  );

  const encryptedIntelligence = ethers.toUtf8Bytes(JSON.stringify({
    agentId: agentPackage.agentId,
    storageHash: storageTx.rootHash,
    memoryHash: agentPackage.memoryHash || '',
  }));

  const mintTx = await inftContract.mintAgent(
    wallet.address,
    storageTx.rootHash,
    encryptedIntelligence
  );
  const receipt = await mintTx.wait();

  // Extract token ID from event
  const mintEvent = receipt.logs.find(
    (log: any) => {
      try {
        const parsed = inftContract.interface.parseLog(log);
        return parsed?.name === 'AgentMinted';
      } catch { return false; }
    }
  );
  
  const tokenId = mintEvent 
    ? inftContract.interface.parseLog(mintEvent)?.args?.[0]?.toString() || '0'
    : '0';

  return {
    storageHash: storageTx.rootHash,
    tokenId,
    txHash: mintTx.hash,
  };
}

/**
 * Tool: clone_agent
 * 
 * Clone an existing agent INFT
 */
export async function cloneAgent(
  tokenId: string,
  toAddress: string,
  config: PublishConfig
): Promise<{ newTokenId: string; txHash: string }> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);

  const contract = new ethers.Contract(
    config.inftContractAddress,
    ['function cloneAgent(uint256 tokenId, address to) returns (uint256)'],
    wallet
  );

  const tx = await contract.cloneAgent(tokenId, toAddress);
  const receipt = await tx.wait();

  return {
    newTokenId: receipt.logs[0]?.topics?.[1] || '0',
    txHash: tx.hash,
  };
}
