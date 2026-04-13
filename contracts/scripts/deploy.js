const hre = require("hardhat");

async function main() {
  console.log("\n🧠 Deploying NeuronForge contracts to 0G Chain...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "OG\n");

  // Deploy AgentRegistry
  console.log("📝 Deploying AgentRegistry...");
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const registryAddress = await agentRegistry.getAddress();
  console.log("✅ AgentRegistry deployed to:", registryAddress);

  // Deploy NeuronForgeINFT
  console.log("\n📝 Deploying NeuronForgeINFT...");
  const NeuronForgeINFT = await hre.ethers.getContractFactory("NeuronForgeINFT");
  const neuronForgeINFT = await NeuronForgeINFT.deploy();
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
