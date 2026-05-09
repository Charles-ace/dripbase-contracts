const { ethers } = require("hardhat");

/**
 * Deploys the DripBase contract.
 *
 * Run with:
 *   npx hardhat run scripts/deploy.js --network base-sepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying DripBase...");
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy
  const DripBase = await ethers.getContractFactory("DripBase");
  const dripBase = await DripBase.deploy();
  await dripBase.waitForDeployment();

  const contractAddress = await dripBase.getAddress();

  console.log("DripBase deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log(
    "View on Basescan: https://sepolia.basescan.org/address/" + contractAddress
  );

  // Optional: verify on Basescan if BASESCAN_API_KEY is set
  if (process.env.BASESCAN_API_KEY) {
    console.log("\nWaiting for block confirmations before verification...");
    await dripBase.deploymentTransaction().wait(5);

    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });

    console.log("Contract verified on Basescan!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
