/**
 * NeuronForge — 0G Chain Service
 * 
 * Handles all on-chain interactions:
 * - Agent registration
 * - Skill registration
 * - INFT minting & transfers
 * - Marketplace operations
 */

import { ethers } from 'ethers';


const RPC_URL = process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai';

let provider: ethers.JsonRpcProvider | null = null;
let signer: ethers.Wallet | null = null;

// Contract addresses — read lazily so dotenv has time to load
function getContractAddresses() {
  return {
    agentRegistry: process.env.AGENT_REGISTRY_ADDRESS || '',
    skillRegistry: process.env.SKILL_REGISTRY_ADDRESS || '',
    neuronForgeINFT: process.env.INFT_ADDRESS || '',
    marketplace: process.env.MARKETPLACE_ADDRESS || '',
  };
}

/**
 * Initialize the 0G Chain service
 */
export function initChainService(): { provider: ethers.JsonRpcProvider; signer: ethers.Wallet } {
  if (provider && signer) return { provider, signer };

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not set in environment');

  provider = new ethers.JsonRpcProvider(RPC_URL);
  signer = new ethers.Wallet(privateKey, provider);

  console.log('⛓️ 0G Chain service initialized');
  return { provider, signer };
}

/**
 * Get the wallet address
 */
export function getWalletAddress(): string {
  const { signer: sgn } = initChainService();
  return sgn.address;
}

/**
 * Get the wallet balance
 */
export async function getBalance(): Promise<string> {
  const { provider: prov, signer: sgn } = initChainService();
  const balance = await prov.getBalance(sgn.address);
  return ethers.formatEther(balance);
}

/**
 * Deploy a contract to 0G Chain
 */
export async function deployContract(
  abi: ethers.InterfaceAbi,
  bytecode: string,
  constructorArgs: unknown[] = []
): Promise<{ address: string; txHash: string }> {
  const { signer: sgn } = initChainService();

  const factory = new ethers.ContractFactory(abi, bytecode, sgn);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash || '';

  console.log(`📝 Contract deployed at: ${address}`);
  console.log(`🔗 TX: ${txHash}`);

  return { address, txHash };
}

/**
 * Get a contract instance
 */
export function getContract(
  address: string,
  abi: ethers.InterfaceAbi
): ethers.Contract {
  const { signer: sgn } = initChainService();
  return new ethers.Contract(address, abi, sgn);
}

/**
 * Register an agent on-chain
 */
export async function registerAgent(
  metadataHash: string,
  skillHashes: string[],
  name: string
): Promise<{ tokenId: string; txHash: string }> {
  if (!getContractAddresses().agentRegistry) {
    throw new Error('AgentRegistry contract not deployed');
  }

  const contract = getContract(getContractAddresses().agentRegistry, [
    'function registerAgent(string metadataHash, string[] skillHashes, string name) returns (uint256)',
    'event AgentRegistered(uint256 indexed tokenId, address indexed creator, string name)',
  ]);

  const tx = await contract.registerAgent(metadataHash, skillHashes, name);
  const receipt = await tx.wait();

  const event = receipt.logs.find(
    (log: any) => log.fragment?.name === 'AgentRegistered'
  );
  const tokenId = event?.args?.[0]?.toString() || '0';

  return { tokenId, txHash: tx.hash };
}

/**
 * Mint an agent as an INFT (ERC-7857)
 */
export async function mintINFT(
  to: string,
  metadataURI: string,
  encryptedIntelligence: string
): Promise<{ tokenId: string; txHash: string }> {
  if (!getContractAddresses().neuronForgeINFT) {
    throw new Error('NeuronForgeINFT contract not deployed');
  }

  const contract = getContract(getContractAddresses().neuronForgeINFT, [
    'function mintAgent(address to, string metadataURI, bytes encryptedIntelligence) returns (uint256)',
    'event AgentMinted(uint256 indexed tokenId, address indexed to, string metadataURI)',
  ]);

  const tx = await contract.mintAgent(
    to,
    metadataURI,
    ethers.toUtf8Bytes(encryptedIntelligence)
  );
  const receipt = await tx.wait();

  const event = receipt.logs.find(
    (log: any) => log.fragment?.name === 'AgentMinted'
  );
  const tokenId = event?.args?.[0]?.toString() || '0';

  return { tokenId, txHash: tx.hash };
}

/**
 * List an agent on the marketplace
 */
export async function listOnMarketplace(
  tokenId: string,
  priceInOG: string
): Promise<{ txHash: string }> {
  if (!getContractAddresses().marketplace) {
    throw new Error('Marketplace contract not deployed');
  }

  const contract = getContract(getContractAddresses().marketplace, [
    'function listAgent(uint256 tokenId, uint256 price)',
  ]);

  const priceWei = ethers.parseEther(priceInOG);
  const tx = await contract.listAgent(tokenId, priceWei);
  await tx.wait();

  return { txHash: tx.hash };
}

export { getContractAddresses as CONTRACT_ADDRESSES };
