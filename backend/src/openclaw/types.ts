/**
 * NeuronForge — OpenClaw Type Definitions
 * 
 * Type definitions for the agent runtime, tools, and messaging
 */

export interface AgentConfig {
  name: string;
  persona?: string;
  skills?: string[];
  model?: string;
  providerAddress?: string;
}

export interface AgentInstance {
  id: string;
  name: string;
  persona: string;
  skills: string[];
  model: string;
  providerAddress: string;
  tools: Map<string, ToolDefinition>;
  conversations: ChatMessage[];
  memoryHashes: string[];
  stateHash: string;
  createdAt: number;
  status: 'idle' | 'thinking' | 'acting' | 'error';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, agent: AgentInstance) => Promise<unknown>;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  reasoning?: string;
}

export interface ReActStep {
  type: 'thought' | 'action' | 'response' | 'error';
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: unknown;
}

export interface AgentSummary {
  id: string;
  name: string;
  persona: string;
  skills: string[];
  model: string;
  status: string;
  conversationCount: number;
  memoryHashes: string[];
  stateHash: string;
  createdAt: number;
}
