/**
 * 0G Inference Skill — Tool Implementation
 * 
 * Routes LLM inference through 0G's decentralized Compute Network
 * with TEE-verified responses.
 */

import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

interface InferenceConfig {
  rpcUrl: string;
  privateKey: string;
  defaultModel?: string;
}

interface InferenceResult {
  content: string;
  model: string;
  verified: boolean;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

let broker: any = null;

/**
 * Initialize the 0G Compute broker
 */
async function initBroker(config: InferenceConfig) {
  if (broker) return broker;

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  broker = await createZGComputeNetworkBroker(wallet);
  
  return broker;
}

/**
 * Tool: 0g_inference
 * 
 * Run an inference query through 0G Compute Network
 */
export async function inference(
  query: string,
  config: InferenceConfig,
  options?: {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    providerAddress?: string;
  }
): Promise<InferenceResult> {
  const b = await initBroker(config);

  // Find a provider if not specified
  let providerAddress = options?.providerAddress;
  if (!providerAddress) {
    const services = await b.inference.listService();
    const chatServices = services.filter((s: any) => s.serviceType === 'chatbot');
    if (chatServices.length === 0) {
      throw new Error('No 0G Compute chat providers available');
    }
    providerAddress = chatServices[0].provider;
  }

  // Get service metadata
  const { endpoint, model } = await b.inference.getServiceMetadata(providerAddress);

  // Build messages
  const messages = [];
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: query });

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
      model: config.defaultModel || model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`0G Compute inference failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Verify TEE signature
  let verified = false;
  const chatID = response.headers.get('ZG-Res-Key') || data.id;
  if (chatID) {
    try {
      verified = await b.inference.processResponse(providerAddress, chatID);
    } catch (e) {
      console.warn('Response verification skipped:', (e as Error).message);
    }
  }

  return {
    content,
    model: config.defaultModel || model,
    verified,
    provider: providerAddress!,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
    } : undefined,
  };
}

/**
 * Tool: list_providers
 * 
 * List available 0G Compute inference providers
 */
export async function listProviders(config: InferenceConfig) {
  const b = await initBroker(config);
  const services = await b.inference.listService();
  
  return services.map((s: any) => ({
    provider: s.provider,
    model: s.model,
    serviceType: s.serviceType,
    url: s.url,
  }));
}
