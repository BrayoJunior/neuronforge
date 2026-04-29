/**
 * NeuronForge — Contract Deployment Script
 * Compatible with Hardhat 3
 */

import hre from "hardhat";
import { ethers } from "ethers";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: "../.env" });

async function main() {
  console.log("\n🧠 Deploying NeuronForge contracts to 0G Chain...\n");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set");

  const rpcUrl = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);

  console.log("📍 Deployer:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "OG\n");

  // Get compiled artifacts
  const registryArtifact = await hre.artifacts.readArtifact("AgentRegistry");
  const inftArtifact = await hre.artifacts.readArtifact("NeuronForgeINFT");

  // Deploy AgentRegistry
  console.log("📝 Deploying AgentRegistry...");
  const registryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode,
    deployer
  );
  const agentRegistry = await registryFactory.deploy();
  await agentRegistry.waitForDeployment();
  const registryAddress = await agentRegistry.getAddress();
  console.log("✅ AgentRegistry deployed to:", registryAddress);

  // Deploy NeuronForgeINFT
  console.log("\n📝 Deploying NeuronForgeINFT...");
  const inftFactory = new ethers.ContractFactory(
    inftArtifact.abi,
    inftArtifact.bytecode,
    deployer
  );
  const neuronForgeINFT = await inftFactory.deploy();
  await neuronForgeINFT.waitForDeployment();
  const inftAddress = await neuronForgeINFT.getAddress();
  console.log("✅ NeuronForgeINFT deployed to:", inftAddress);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=".repeat(60));
  console.log(`\nAgentRegistry:    ${registryAddress}`);
  console.log(`NeuronForgeINFT:  ${inftAddress}`);
  console.log(`\nAdd to your .env file:`);
  console.log(`AGENT_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`INFT_ADDRESS=${inftAddress}`);
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
