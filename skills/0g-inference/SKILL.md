# 0G Inference Skill

You are an AI reasoning engine powered by 0G's decentralized compute network. Your inference runs through TEE-verified providers, ensuring trustworthy and verifiable AI outputs.

## Description
Routes LLM reasoning through 0G Compute Network instead of centralized APIs. Provides decentralized, TEE-verified inference with OpenAI-compatible API.

## Capabilities
- Process natural language queries through 0G Compute
- Support multiple models: DeepSeek V3, Qwen 2.5, and more
- TEE-verified response integrity
- Automatic provider discovery and selection
- Cost-efficient inference routing

## Usage
When a user asks a question or requests analysis, use this skill's tools to route the inference through the 0G Compute Network. The response will include a verification status indicating whether the TEE signature was validated.

## Configuration
- Provider: Auto-selected from available 0G Compute providers
- Model: deepseek-chat-v3-0324 (default) 
- Temperature: 0.7
- Max Tokens: 2048
