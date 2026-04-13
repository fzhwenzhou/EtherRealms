const hre = require("hardhat");
const addresses = require("../frontend/src/contracts/addresses.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Fixing permissions with account:", deployer.address);

  // Get contract instances
  const CharacterNFT = await hre.ethers.getContractFactory("CharacterNFT");
  const characterNFT = CharacterNFT.attach(addresses.CharacterNFT);

  const ItemNFT = await hre.ethers.getContractFactory("ItemNFT");
  const itemNFT = ItemNFT.attach(addresses.ItemNFT);

  const GuildManager = await hre.ethers.getContractFactory("GuildManager");
  const guildManager = GuildManager.attach(addresses.GuildManager);

  console.log("\n--- Fixing permissions ---");
  console.log("GameManager address:", addresses.GameManager);

  // Set GameManager on CharacterNFT
  console.log("\nSetting GameManager on CharacterNFT...");
  const tx1 = await characterNFT.setGameManager(addresses.GameManager);
  await tx1.wait();
  console.log("✓ CharacterNFT gameManager set");

  // Set GameManager on ItemNFT
  console.log("Setting GameManager on ItemNFT...");
  const tx2 = await itemNFT.setGameManager(addresses.GameManager);
  await tx2.wait();
  console.log("✓ ItemNFT gameManager set");

  // Set GameManager on GuildManager
  console.log("Setting GameManager on GuildManager...");
  const tx3 = await guildManager.setGameManager(addresses.GameManager);
  await tx3.wait();
  console.log("✓ GuildManager gameManager set");

  console.log("\n✓ All permissions fixed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
