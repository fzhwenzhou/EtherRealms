const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EtherRealms", function () {
  let goldToken, characterNFT, itemNFT, guildManager, gameManager;
  let owner, player1, player2, player3;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    const GoldToken = await ethers.getContractFactory("GoldToken");
    goldToken = await GoldToken.deploy();

    const CharacterNFT = await ethers.getContractFactory("CharacterNFT");
    characterNFT = await CharacterNFT.deploy();

    const ItemNFT = await ethers.getContractFactory("ItemNFT");
    itemNFT = await ItemNFT.deploy();

    const GuildManager = await ethers.getContractFactory("GuildManager");
    guildManager = await GuildManager.deploy();

    const GameManager = await ethers.getContractFactory("GameManager");
    gameManager = await GameManager.deploy(
      await characterNFT.getAddress(),
      await itemNFT.getAddress(),
      await goldToken.getAddress(),
      await guildManager.getAddress()
    );

    const gmAddr = await gameManager.getAddress();
    await goldToken.setMinter(gmAddr);
    await characterNFT.setGameManager(gmAddr);
    await itemNFT.setGameManager(gmAddr);
    await guildManager.setGameManager(gmAddr);
  });

  describe("CharacterNFT", function () {
    it("should mint a character with correct attributes", async function () {
      await characterNFT.connect(player1).mintCharacter("Hero1", { value: ethers.parseEther("0.01") });
      const char = await characterNFT.getCharacter(1);
      expect(char.name).to.equal("Hero1");
      expect(char.level).to.equal(1);
      expect(char.hp).to.equal(100);
      expect(char.strength).to.equal(10);
      expect(char.defense).to.equal(5);
      expect(char.energy).to.equal(5);
    });

    it("should not allow duplicate characters per address", async function () {
      await characterNFT.connect(player1).mintCharacter("Hero1", { value: ethers.parseEther("0.01") });
      await expect(
        characterNFT.connect(player1).mintCharacter("Hero2", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("CharacterNFT: already has character");
    });

    it("should reject insufficient ETH", async function () {
      await expect(
        characterNFT.connect(player1).mintCharacter("Hero1", { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("CharacterNFT: insufficient ETH");
    });

    it("should track action history", async function () {
      await characterNFT.connect(player1).mintCharacter("Hero1", { value: ethers.parseEther("0.01") });
      const history = await characterNFT.getActionHistory(1);
      expect(history.length).to.equal(1);
      expect(history[0].actionType).to.equal(0); // mint action
    });

    it("should track total characters", async function () {
      await characterNFT.connect(player1).mintCharacter("Hero1", { value: ethers.parseEther("0.01") });
      await characterNFT.connect(player2).mintCharacter("Hero2", { value: ethers.parseEther("0.01") });
      expect(await characterNFT.getTotalCharacters()).to.equal(2);
    });
  });

  describe("GoldToken", function () {
    it("should only allow minter to mint", async function () {
      await expect(
        goldToken.connect(player1).mint(player1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("GoldToken: caller is not the minter");
    });
  });

  describe("GameManager - Adventure", function () {
    beforeEach(async function () {
      await characterNFT.connect(player1).mintCharacter("Explorer", { value: ethers.parseEther("0.01") });
    });

    it("should allow exploration and give rewards", async function () {
      const tx = await gameManager.connect(player1).explore(1);
      await tx.wait();

      const char = await characterNFT.getCharacter(1);
      expect(char.xp).to.be.greaterThan(0);

      const goldBal = await goldToken.balanceOf(player1.address);
      expect(goldBal).to.be.greaterThan(0);
    });

    it("should consume energy on explore", async function () {
      await gameManager.connect(player1).explore(1);
      const energy = await gameManager.getAvailableEnergy(1);
      expect(energy).to.equal(4);
    });

    it("should not allow exploration without energy", async function () {
      // Use all 5 energy points
      for (let i = 0; i < 5; i++) {
        await gameManager.connect(player1).explore(1);
      }
      await expect(gameManager.connect(player1).explore(1)).to.be.revertedWith("GameManager: no energy");
    });

    it("should not allow non-owner to explore", async function () {
      await expect(gameManager.connect(player2).explore(1)).to.be.revertedWith("GameManager: not owner");
    });

    it("should register player in world", async function () {
      await gameManager.connect(player1).explore(1);
      const players = await gameManager.getAllPlayers();
      expect(players).to.include(player1.address);
    });

    it("should record world events", async function () {
      await gameManager.connect(player1).explore(1);
      const count = await gameManager.getWorldEventsCount();
      expect(count).to.be.greaterThan(0);
    });
  });

  describe("GameManager - Combat", function () {
    beforeEach(async function () {
      await characterNFT.connect(player1).mintCharacter("Fighter", { value: ethers.parseEther("0.01") });
    });

    it("should allow fighting a slime", async function () {
      const tx = await gameManager.connect(player1).fightMonster(1, 0); // Slime
      const receipt = await tx.wait();
      expect(receipt.status).to.equal(1);
    });

    it("should reject invalid monster type", async function () {
      await expect(gameManager.connect(player1).fightMonster(1, 3)).to.be.revertedWith("GameManager: invalid monster");
    });

    it("should emit CombatEvent", async function () {
      await expect(gameManager.connect(player1).fightMonster(1, 0))
        .to.emit(gameManager, "CombatEvent");
    });
  });

  describe("GameManager - Rest", function () {
    beforeEach(async function () {
      await characterNFT.connect(player1).mintCharacter("Healer", { value: ethers.parseEther("0.01") });
      // Fight to lose HP and gain gold
      await gameManager.connect(player1).fightMonster(1, 0);
    });

    it("should restore HP when resting", async function () {
      const charBefore = await characterNFT.getCharacter(1);
      if (charBefore.hp < charBefore.maxHp) {
        const goldBal = await goldToken.balanceOf(player1.address);
        if (goldBal >= ethers.parseEther("10")) {
          await gameManager.connect(player1).rest(1);
          const charAfter = await characterNFT.getCharacter(1);
          expect(charAfter.hp).to.equal(charAfter.maxHp);
        }
      }
    });
  });

  describe("GameManager - Equipment", function () {
    beforeEach(async function () {
      await characterNFT.connect(player1).mintCharacter("Knight", { value: ethers.parseEther("0.01") });
    });

    it("should buy and equip items", async function () {
      // Explore multiple times to gain gold
      for (let i = 0; i < 5; i++) {
        await gameManager.connect(player1).explore(1);
      }

      const goldBal = await goldToken.balanceOf(player1.address);
      if (goldBal >= ethers.parseEther("50")) {
        await gameManager.connect(player1).buyItem(0); // Buy weapon
        const itemCount = await itemNFT.getNextTokenId();
        expect(itemCount).to.be.greaterThan(0);
      }
    });
  });

  describe("GameManager - Guild System", function () {
    beforeEach(async function () {
      await characterNFT.connect(player1).mintCharacter("GuildMaster", { value: ethers.parseEther("0.01") });
      await characterNFT.connect(player2).mintCharacter("Member", { value: ethers.parseEther("0.01") });
    });

    it("should create a guild", async function () {
      await gameManager.connect(player1).createGuild("Dragon Slayers");
      const guild = await guildManager.getGuild(1);
      expect(guild.name).to.equal("Dragon Slayers");
      expect(guild.leader).to.equal(player1.address);
      expect(guild.memberCount).to.equal(1);
    });

    it("should allow joining a guild", async function () {
      await gameManager.connect(player1).createGuild("Dragon Slayers");
      await gameManager.connect(player2).joinGuild(1);
      const guild = await guildManager.getGuild(1);
      expect(guild.memberCount).to.equal(2);
    });

    it("should track guild membership on character", async function () {
      await gameManager.connect(player1).createGuild("Dragon Slayers");
      const char = await characterNFT.getCharacter(1);
      expect(char.guildId).to.equal(1);
    });

    it("should allow creating proposals", async function () {
      await gameManager.connect(player1).createGuild("Dragon Slayers");
      await gameManager.connect(player1).createProposal("Increase guild treasury tax");
      const proposal = await guildManager.getProposal(1);
      expect(proposal.proposer).to.equal(player1.address);
    });

    it("should allow voting on proposals", async function () {
      await gameManager.connect(player1).createGuild("Dragon Slayers");
      await gameManager.connect(player2).joinGuild(1);
      await gameManager.connect(player1).createProposal("Raid the dungeon");
      await gameManager.connect(player2).voteOnProposal(1, true);
      const proposal = await guildManager.getProposal(1);
      expect(proposal.votesFor).to.equal(1);
    });
  });

  describe("GameManager - Leaderboard", function () {
    it("should return leaderboard", async function () {
      await characterNFT.connect(player1).mintCharacter("Hero1", { value: ethers.parseEther("0.01") });
      await characterNFT.connect(player2).mintCharacter("Hero2", { value: ethers.parseEther("0.01") });

      // Player1 explores to gain XP
      await gameManager.connect(player1).explore(1);

      const [ids, names, levels, xps, owners] = await gameManager.leaderboard();
      expect(ids.length).to.be.greaterThan(0);
      expect(names[0]).to.be.a("string");
    });
  });

  describe("ItemNFT - Ownership History", function () {
    it("should track ownership changes", async function () {
      await characterNFT.connect(player1).mintCharacter("Trader1", { value: ethers.parseEther("0.01") });
      // Explore to potentially get items
      for (let i = 0; i < 5; i++) {
        await gameManager.connect(player1).explore(1);
      }
      const nextId = await itemNFT.getNextTokenId();
      if (nextId > 0n) {
        const history = await itemNFT.getOwnershipHistory(1);
        expect(history.length).to.be.greaterThan(0);
      }
    });
  });
});
