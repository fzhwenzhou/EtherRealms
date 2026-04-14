const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy GoldToken
  const GoldToken = await hre.ethers.getContractFactory("GoldToken");
  const goldToken = await GoldToken.deploy();
  await goldToken.waitForDeployment();
  const goldTokenAddr = await goldToken.getAddress();
  console.log("GoldToken deployed to:", goldTokenAddr);

  // 2. Deploy CharacterNFT
  const CharacterNFT = await hre.ethers.getContractFactory("CharacterNFT");
  const characterNFT = await CharacterNFT.deploy();
  await characterNFT.waitForDeployment();
  const characterNFTAddr = await characterNFT.getAddress();
  console.log("CharacterNFT deployed to:", characterNFTAddr);

  // 3. Deploy ItemNFT
  const ItemNFT = await hre.ethers.getContractFactory("ItemNFT");
  const itemNFT = await ItemNFT.deploy();
  await itemNFT.waitForDeployment();
  const itemNFTAddr = await itemNFT.getAddress();
  console.log("ItemNFT deployed to:", itemNFTAddr);

  // 4. Deploy GuildManager
  const GuildManager = await hre.ethers.getContractFactory("GuildManager");
  const guildManager = await GuildManager.deploy();
  await guildManager.waitForDeployment();
  const guildManagerAddr = await guildManager.getAddress();
  console.log("GuildManager deployed to:", guildManagerAddr);

  // 5. Deploy GameManager
  const GameManager = await hre.ethers.getContractFactory("GameManager");
  const gameManager = await GameManager.deploy(
    characterNFTAddr,
    itemNFTAddr,
    goldTokenAddr,
    guildManagerAddr
  );
  await gameManager.waitForDeployment();
  const gameManagerAddr = await gameManager.getAddress();
  console.log("GameManager deployed to:", gameManagerAddr);

  // 6. Set permissions
  console.log("\nSetting up permissions...");
  await goldToken.setMinter(gameManagerAddr);
  console.log("GoldToken minter set to GameManager");

  await characterNFT.setGameManager(gameManagerAddr);
  console.log("CharacterNFT gameManager set");

  await itemNFT.setGameManager(gameManagerAddr);
  console.log("ItemNFT gameManager set");

  await guildManager.setGameManager(gameManagerAddr);
  console.log("GuildManager gameManager set");

  // 7. Deploy Marketplace
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(itemNFTAddr, goldTokenAddr);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("Marketplace deployed to:", marketplaceAddr);

  // 8. Authorize Marketplace on GoldToken
  await goldToken.setAuthorized(marketplaceAddr, true);
  console.log("Marketplace authorized on GoldToken");

  // 9. Wire marketplace references for auto-unequip flow
  await marketplace.setCharacterNFT(characterNFTAddr);
  await marketplace.setGameManager(gameManagerAddr);
  await gameManager.setMarketplace(marketplaceAddr);
  console.log("Marketplace and GameManager references configured");

  console.log("\n--- Deployment Complete ---");
  console.log("Contract Addresses:");
  console.log(`  GoldToken:     ${goldTokenAddr}`);
  console.log(`  CharacterNFT:  ${characterNFTAddr}`);
  console.log(`  ItemNFT:       ${itemNFTAddr}`);
  console.log(`  GuildManager:  ${guildManagerAddr}`);
  console.log(`  GameManager:   ${gameManagerAddr}`);
  console.log(`  Marketplace:   ${marketplaceAddr}`);

  // Write addresses to a JSON file for frontend
  const fs = require("fs");
  const addresses = {
    GoldToken: goldTokenAddr,
    CharacterNFT: characterNFTAddr,
    ItemNFT: itemNFTAddr,
    GuildManager: guildManagerAddr,
    GameManager: gameManagerAddr,
    Marketplace: marketplaceAddr,
  };
  fs.writeFileSync(
    "frontend/src/contracts/addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses written to frontend/src/contracts/addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
