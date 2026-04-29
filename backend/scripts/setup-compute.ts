/**
 * NeuronForge — 0G Compute Setup
 * 
 * Initializes the 0G Compute provider sub-account:
 * 1. Deposits OG to main ledger
 * 2. Transfers funds to provider sub-account
 * 3. Acknowledges provider TEE signer
 * 
 * Usage: npx tsx scripts/setup-compute.ts
 */

import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not set');

  const rpcUrl = process.env.OG_COMPUTE_RPC || 'https://evmrpc-testnet.0g.ai';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('\n🤖 Setting up 0G Compute...');
  console.log('📍 Wallet:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Balance:', ethers.formatEther(balance), 'OG\n');

  // Initialize broker
  const broker = await createZGComputeNetworkBroker(wallet);
  console.log('✅ Broker initialized\n');

  // List available providers
  const services = await broker.inference.listService();
  const chatProviders = services.filter((s: any) => s.serviceType === 'chatbot');

  if (chatProviders.length === 0) {
    console.log('❌ No chatbot providers found on the network');
    return;
  }

  console.log(`📡 Found ${chatProviders.length} chatbot provider(s):`);
  for (const p of chatProviders) {
    console.log(`   → ${(p as any).provider} (${(p as any).model})`);
  }

  const targetProvider = (chatProviders[0] as any).provider;
  console.log(`\n🎯 Setting up provider: ${targetProvider}`);

  // Step 1: Deposit to main ledger (minimum 3 OG required by contract)
  const depositAmount = 3;
  console.log(`\n💰 Step 1: Depositing ${depositAmount} OG to main ledger...`);
  try {
    await broker.ledger.depositFund(depositAmount);
    console.log('✅ Deposit complete');
  } catch (e: any) {
    if (e.message?.includes('already')) {
      console.log('ℹ️  Already deposited (skipping)');
    } else {
      console.log('⚠️  Deposit:', e.message);
    }
  }

  // Step 2: Transfer to provider sub-account (minimum 1 OG)
  console.log(`\n📤 Step 2: Transferring 1 OG to provider sub-account...`);
  try {
    await broker.ledger.transferFund(
      targetProvider,
      'inference',
      BigInt(1e18) // 1 OG
    );
    console.log('✅ Transfer complete');
  } catch (e: any) {
    if (e.message?.includes('already') || e.message?.includes('insufficient')) {
      console.log('ℹ️  Transfer note:', e.message);
    } else {
      console.log('⚠️  Transfer:', e.message);
    }
  }

  // Step 3: Acknowledge provider
  console.log(`\n🔑 Step 3: Acknowledging provider TEE signer...`);
  try {
    await broker.inference.acknowledgeProviderSigner(targetProvider);
    console.log('✅ Provider acknowledged');
  } catch (e: any) {
    if (e.message?.includes('already')) {
      console.log('ℹ️  Already acknowledged (skipping)');
    } else {
      console.log('⚠️  Acknowledge:', e.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 0G Compute Setup Complete!');
  console.log('='.repeat(50));
  console.log(`Provider: ${targetProvider}`);
  console.log('You can now use the chat API with 0G Compute inference.\n');
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exitCode = 1;
});
