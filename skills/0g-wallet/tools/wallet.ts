/**
 * 0G Wallet Skill — Tool Implementation
 * 
 * On-chain interactions with 0G Chain for autonomous agents
 */

import { ethers } from 'ethers';

interface WalletConfig {
  rpcUrl: string;
  privateKey: string;
}

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;

function init(config: WalletConfig) {
  if (provider && wallet) return { provider, wallet };
  
  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  wallet = new ethers.Wallet(config.privateKey, provider);
  
  return { provider, wallet };
}

/**
 * Tool: get_balance
 * 
 * Check OG token balance for an address
 */
export async function getBalance(
  address: string | undefined,
  config: WalletConfig
): Promise<{ address: string; balance: string; formatted: string }> {
  const { provider: prov, wallet: w } = init(config);
  const addr = address || w.address;
  const balance = await prov.getBalance(addr);
  
  return {
    address: addr,
    balance: balance.toString(),
    formatted: `${ethers.formatEther(balance)} OG`,
  };
}

/**
 * Tool: read_contract
 * 
 * Read data from a smart contract
 */
export async function readContract(
  contractAddress: string,
  abi: string[],
  functionName: string,
  args: unknown[],
  config: WalletConfig
): Promise<unknown> {
  const { provider: prov } = init(config);
  const contract = new ethers.Contract(contractAddress, abi, prov);
  return await contract[functionName](...args);
}

/**
 * Tool: send_transaction
 * 
 * Send a transaction on 0G Chain  
 */
export async function sendTransaction(
  to: string,
  value: string,
  data: string | undefined,
  config: WalletConfig
): Promise<{ hash: string; blockNumber: number }> {
  const { wallet: w } = init(config);
  
  const tx = await w.sendTransaction({
    to,
    value: ethers.parseEther(value),
    data: data || '0x',
  });
  
  const receipt = await tx.wait();
  return {
    hash: tx.hash,
    blockNumber: receipt!.blockNumber,
  };
}

/**
 * Tool: get_wallet_info
 * 
 * Get connected wallet information
 */
export async function getWalletInfo(config: WalletConfig) {
  const { provider: prov, wallet: w } = init(config);
  const balance = await prov.getBalance(w.address);
  const network = await prov.getNetwork();
  
  return {
    address: w.address,
    balance: `${ethers.formatEther(balance)} OG`,
    network: network.name,
    chainId: Number(network.chainId),
  };
}
