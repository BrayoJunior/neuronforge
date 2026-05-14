/**
 * NeuronForge — Standalone Mainnet Deploy Script
 * Uses solc + ethers directly (no Hardhat needed)
 */

import { readFileSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { ethers } from 'ethers';
import solc from 'solc';

dotenvConfig({ path: '../.env' });

function compileSolidity(contractName, source) {
  const input = {
    language: 'Solidity',
    sources: { [`${contractName}.sol`]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Compilation errors:', errors.map(e => e.message).join('\n'));
      process.exit(1);
    }
  }

  const contract = output.contracts[`${contractName}.sol`][contractName];
  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
  };
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not set in .env');

  // Connect to 0G Mainnet
  const rpcUrl = 'https://evmrpc.0g.ai';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);

  console.log('\n🧠 Deploying NeuronForge contracts to 0G MAINNET...\n');
  console.log('📍 Deployer:', deployer.address);
  
  const balance = await provider.getBalance(deployer.address);
  console.log('💰 Balance:', ethers.formatEther(balance), 'OG\n');

  if (balance < ethers.parseEther('0.05')) {
    console.error('❌ Insufficient balance. Need at least 0.05 OG for deployment.');
    process.exit(1);
  }

  // Read and compile contracts
  console.log('📦 Compiling contracts...');
  const registrySrc = readFileSync('./contracts/AgentRegistry.sol', 'utf8');
  const inftSrc = readFileSync('./contracts/NeuronForgeINFT.sol', 'utf8');

  const registry = compileSolidity('AgentRegistry', registrySrc);
  const inft = compileSolidity('NeuronForgeINFT', inftSrc);
  console.log('✅ Compilation successful\n');

  // Deploy AgentRegistry
  console.log('📝 Deploying AgentRegistry...');
  const registryFactory = new ethers.ContractFactory(registry.abi, registry.bytecode, deployer);
  const agentRegistry = await registryFactory.deploy();
  await agentRegistry.waitForDeployment();
  const registryAddress = await agentRegistry.getAddress();
  console.log('✅ AgentRegistry deployed to:', registryAddress);

  // Deploy NeuronForgeINFT
  console.log('\n📝 Deploying NeuronForgeINFT...');
  const inftFactory = new ethers.ContractFactory(inft.abi, inft.bytecode, deployer);
  const neuronForgeINFT = await inftFactory.deploy();
  await neuronForgeINFT.waitForDeployment();
  const inftAddress = await neuronForgeINFT.getAddress();
  console.log('✅ NeuronForgeINFT deployed to:', inftAddress);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 MAINNET Deployment Complete!');
  console.log('='.repeat(60));
  console.log(`\nAgentRegistry:    ${registryAddress}`);
  console.log(`NeuronForgeINFT:  ${inftAddress}`);
  console.log(`\n🔗 Explorer links:`);
  console.log(`AgentRegistry:    https://chainscan.0g.ai/address/${registryAddress}`);
  console.log(`NeuronForgeINFT:  https://chainscan.0g.ai/address/${inftAddress}`);
  console.log('='.repeat(60) + '\n');

  // Check remaining balance
  const remainingBalance = await provider.getBalance(deployer.address);
  console.log('💰 Remaining balance:', ethers.formatEther(remainingBalance), 'OG');
  console.log('⛽ Gas used:', ethers.formatEther(balance - remainingBalance), 'OG\n');
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error.message);
  process.exitCode = 1;
});
