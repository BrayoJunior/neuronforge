/**
 * NeuronForge — 0G Compute Service
 * 
 * Handles AI inference through 0G's decentralized compute network.
 * Provides an OpenAI-compatible interface for agent reasoning.
 */

import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';


const RPC_URL = process.env.OG_COMPUTE_RPC || 'https://evmrpc-testnet.0g.ai';

let broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;

/**
 * Initialize the 0G Compute broker
 */
export async function initComputeService() {
  if (broker) return broker;

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not set in environment');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  broker = await createZGComputeNetworkBroker(wallet);
  console.log('🤖 0G Compute service initialized');
  return broker;
}

/**
 * List available inference providers on the network
 */
export async function listProviders() {
  const b = await initComputeService();
  const services = await b.inference.listService();
  
  return services.map((s: any) => ({
    provider: s.provider,
    model: s.model,
    serviceType: s.serviceType,
    url: s.url,
    inputPrice: s.inputPrice,
    outputPrice: s.outputPrice,
  }));
}

/**
 * Get chatbot providers specifically
 */
export async function getChatProviders() {
  const providers = await listProviders();
  return providers.filter((p: any) => p.serviceType === 'chatbot');
}

/**
 * Run a chat completion through 0G Compute
 */
export async function chatCompletion(
  providerAddress: string,
  messages: Array<{ role: string; content: string }>,
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }
): Promise<{
  content: string;
  model: string;
  verified: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}> {
  const b = await initComputeService();

  // Get service metadata
  const { endpoint, model } = await b.inference.getServiceMetadata(providerAddress);

  // Generate auth headers
  const headers = await b.inference.getRequestHeaders(providerAddress);

  // Make inference request
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`0G Compute inference failed: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  const content = data.choices[0].message.content;

  // Verify response integrity via TEE signature
  let verified = false;
  const chatID = response.headers.get('ZG-Res-Key') || data.id;
  if (chatID) {
    try {
      verified = !!(await b.inference.processResponse(providerAddress, chatID));
    } catch (e) {
      console.warn('⚠️ Response verification skipped:', (e as Error).message);
    }
  }

  return {
    content,
    model,
    verified,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
    } : undefined,
  };
}

/**
 * Fund a specific compute provider
 */
export async function fundProvider(providerAddress: string, amount: number) {
  const b = await initComputeService();
  
  // Deposit to main ledger
  await b.ledger.depositFund(amount);
  
  // Transfer to provider sub-account
  await b.ledger.transferFund(
    providerAddress,
    'inference',
    BigInt(amount) * BigInt(10 ** 18)
  );
  
  console.log(`💰 Funded provider ${providerAddress} with ${amount} OG`);
}
