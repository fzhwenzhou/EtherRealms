// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CharacterNFT.sol";
import "./ItemNFT.sol";
import "./GoldToken.sol";
import "./GuildManager.sol";

/**
 * @title GameManager
 * @notice Central game logic for EtherRealms PoC.
 *         Coordinates adventure, combat, equipment, economy, and guild systems.
 *         Implements a persistent shared world with traceable asset histories
 *         and guild governance (addressing PoC reviewer feedback).
 */
contract GameManager is Ownable {
    CharacterNFT public characterNFT;
    ItemNFT      public itemNFT;
    GoldToken    public goldToken;
    GuildManager public guildManager;

    uint8 public constant MAX_ENERGY = 5;
    uint256 public constant ENERGY_REGEN_TIME = 10; // 10s for PoC (24h in prod)
    uint256 public constant ITEM_COST = 50 ether;     // 50 ERGOLD (18 decimals)

    // Monster definitions
    struct Monster {
        string name;
        uint16 hp;
        uint16 attack;
        uint16 defense;
        uint32 xpReward;
        uint256 goldReward;
    }

    Monster[3] public monsters;

    // Shared world event log
    struct WorldEvent {
        address player;
        uint256 characterId;
        uint8   eventType; // 0=explore, 1=combat_win, 2=combat_lose, 3=item_drop, 4=level_up, 5=guild
        string  message;
        uint64  timestamp;
    }

    WorldEvent[] public worldEvents;
    address[] public playerList;
    mapping(address => bool) public isRegistered;

    // XP table: XP needed to reach level N (index = level)
    uint32[11] public xpTable;

    event AdventureEvent(address indexed player, uint256 indexed characterId, uint32 xpGained, uint256 goldGained, bool itemDropped);
    event CombatEvent(address indexed player, uint256 indexed characterId, uint8 monsterType, bool victory, uint32 xpGained, uint256 goldGained);
    event LevelUp(address indexed player, uint256 indexed characterId, uint8 newLevel);
    event ItemEquipped(address indexed player, uint256 indexed characterId, uint256 itemId);
    event WorldEventEmitted(uint256 indexed eventIndex, address indexed player, uint8 eventType);

    constructor(
        address _characterNFT,
        address _itemNFT,
        address _goldToken,
        address _guildManager
    ) Ownable(msg.sender) {
        characterNFT = CharacterNFT(_characterNFT);
        itemNFT = ItemNFT(_itemNFT);
        goldToken = GoldToken(_goldToken);
        guildManager = GuildManager(_guildManager);

        // Init monsters
        monsters[0] = Monster("Slime",       30,  5,  2, 20, 10 ether);
        monsters[1] = Monster("Goblin",      60, 12,  5, 50, 25 ether);
        monsters[2] = Monster("Dark Knight", 120, 25, 15, 120, 60 ether);

        // XP table (level 1-10)
        xpTable[0] = 0;
        xpTable[1] = 0;
        xpTable[2] = 100;
        xpTable[3] = 250;
        xpTable[4] = 500;
        xpTable[5] = 900;
        xpTable[6] = 1500;
        xpTable[7] = 2400;
        xpTable[8] = 3800;
        xpTable[9] = 5800;
        xpTable[10] = 8500;
    }

    // ─── Registration ─────────────────────────────────

    function registerPlayer() internal {
        if (!isRegistered[msg.sender]) {
            isRegistered[msg.sender] = true;
            playerList.push(msg.sender);
        }
    }

    // ─── Energy System ────────────────────────────────
    // Fix me
    function getAvailableEnergy(uint256 charId) public view returns (uint8) {
        CharacterNFT.CharacterStats memory c = characterNFT.getCharacter(charId);
        uint256 elapsed = block.timestamp - c.lastActionTime;
        uint256 regenned = elapsed / ENERGY_REGEN_TIME;
        uint256 total = uint256(c.energy) + regenned;
        if (total > MAX_ENERGY) return MAX_ENERGY;
        return uint8(total);
    }

    function _consumeEnergy(uint256 charId) internal {
        uint8 energy = getAvailableEnergy(charId);
        require(energy > 0, "GameManager: no energy");
        characterNFT.setEnergy(charId, energy - 1, uint64(block.timestamp));
    }

    // ─── Adventure ────────────────────────────────────

    /**
     * @notice Explore the world. Consumes 1 energy. Rewards XP, gold, possible item drop.
     */
    function explore(uint256 charId) external {
        require(characterNFT.ownerOf(charId) == msg.sender, "GameManager: not owner");
        registerPlayer();
        _consumeEnergy(charId);

        CharacterNFT.CharacterStats memory c = characterNFT.getCharacter(charId);

        // Pseudo-random
        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1), block.timestamp, msg.sender, charId
        )));

        // XP reward: 10-30
        uint32 xpGain = uint32(10 + (seed % 21));
        seed = seed >> 8;

        // Gold reward: 5-20 ERGOLD
        uint256 goldGain = (5 + (seed % 16)) * 1 ether;
        seed = seed >> 8;

        // Item drop chance: 15%
        bool itemDrop = (seed % 100) < 15;
        seed = seed >> 8;

        // Apply rewards
        uint32 newXp = c.xp + xpGain;
        uint8 newLevel = c.level;
        uint16 newMaxHp = c.maxHp;
        uint16 newStr = c.strength;
        uint16 newDef = c.defense;

        // Check level up
        if (newLevel < 10 && newXp >= xpTable[newLevel + 1]) {
            newLevel++;
            newMaxHp += 10;
            newStr += 3;
            newDef += 2;
            _addWorldEvent(msg.sender, charId, 4, string.concat(c.name, " reached level ", _uint2str(newLevel)));
            emit LevelUp(msg.sender, charId, newLevel);
        }

        characterNFT.updateStats(charId, newLevel, newXp, c.hp, newMaxHp, newStr, newDef);
        goldToken.mint(msg.sender, goldGain);

        if (itemDrop) {
            _mintRandomItem(msg.sender, seed);
            _addWorldEvent(msg.sender, charId, 3, string.concat(c.name, " found an item while exploring!"));
        }

        characterNFT.recordAction(charId, 1, 0, xpGain, goldGain);
        _addWorldEvent(msg.sender, charId, 0, string.concat(c.name, " explored the wilderness"));

        emit AdventureEvent(msg.sender, charId, xpGain, goldGain, itemDrop);
    }

    // ─── Combat ───────────────────────────────────────

    /**
     * @notice Fight a monster. Turn-based PvE combat resolved on-chain.
     * @param monsterType 0=Slime, 1=Goblin, 2=Dark Knight
     */
    function fightMonster(uint256 charId, uint8 monsterType) external {
        require(characterNFT.ownerOf(charId) == msg.sender, "GameManager: not owner");
        require(monsterType < 3, "GameManager: invalid monster");
        registerPlayer();
        _consumeEnergy(charId);

        CharacterNFT.CharacterStats memory c = characterNFT.getCharacter(charId);
        Monster memory m = monsters[monsterType];

        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1), block.timestamp, msg.sender, charId, monsterType
        )));

        // Calculate effective stats with equipment
        uint16 totalStr = c.strength;
        uint16 totalDef = c.defense;
        if (c.equippedWeapon != 0) {
            try itemNFT.getItem(c.equippedWeapon) returns (ItemNFT.Item memory weapon) {
                totalStr += weapon.power;
            } catch {}
        }
        if (c.equippedArmor != 0) {
            try itemNFT.getItem(c.equippedArmor) returns (ItemNFT.Item memory armor) {
                totalDef += armor.power;
            } catch {}
        }

        // Simple combat: compare strength vs monster defense, monster attack vs player defense
        uint16 playerDmg = totalStr > m.defense ? totalStr - m.defense : 1;
        uint16 monsterDmg = m.attack > totalDef ? m.attack - totalDef : 1;

        // Turns to kill monster
        uint16 turnsToKill = (m.hp + playerDmg - 1) / playerDmg;
        uint256 damageTaken = uint256(monsterDmg) * (turnsToKill > 1 ? turnsToKill - 1 : 0);

        // Add randomness factor (±20%)
        uint16 randomFactor = uint16(80 + (seed % 41)); // 80-120
        damageTaken = (damageTaken * randomFactor) / 100;

        bool victory;
        uint16 newHp;
        uint32 xpGain = 0;
        uint256 goldGain = 0;

        if (damageTaken < c.hp) {
            // Victory
            victory = true;
            newHp = c.hp - uint16(damageTaken);
            xpGain = m.xpReward;
            goldGain = m.goldReward;

            uint32 newXp = c.xp + xpGain;
            uint8 newLevel = c.level;
            uint16 newMaxHp = c.maxHp;
            uint16 newStr = c.strength;
            uint16 newDef = c.defense;

            if (newLevel < 10 && newXp >= xpTable[newLevel + 1]) {
                newLevel++;
                newMaxHp += 10;
                newStr += 3;
                newDef += 2;
                _addWorldEvent(msg.sender, charId, 4, string.concat(c.name, " reached level ", _uint2str(newLevel)));
                emit LevelUp(msg.sender, charId, newLevel);
            }

            characterNFT.updateStats(charId, newLevel, newXp, newHp, newMaxHp, newStr, newDef);
            goldToken.mint(msg.sender, goldGain);

            // 25% chance of item drop on victory
            seed = seed >> 8;
            if ((seed % 100) < 25) {
                _mintRandomItem(msg.sender, seed >> 8);
                _addWorldEvent(msg.sender, charId, 3, string.concat(c.name, " looted an item from ", m.name));
            }

            _addWorldEvent(msg.sender, charId, 1, string.concat(c.name, " defeated ", m.name));
        } else {
            // Defeat
            victory = false;
            newHp = 1; // Don't kill the character, leave at 1 HP
            characterNFT.updateStats(charId, c.level, c.xp, newHp, c.maxHp, c.strength, c.defense);
            _addWorldEvent(msg.sender, charId, 2, string.concat(c.name, " was defeated by ", m.name));
        }

        int16 hpChange = int16(uint16(newHp)) - int16(c.hp);
        characterNFT.recordAction(charId, 2, hpChange, xpGain, goldGain);

        emit CombatEvent(msg.sender, charId, monsterType, victory, xpGain, goldGain);
    }

    // ─── Rest (heal) ──────────────────────────────────

    /**
     * @notice Rest to recover HP. Costs 10 ERGOLD.
     */
    function rest(uint256 charId) external {
        require(characterNFT.ownerOf(charId) == msg.sender, "GameManager: not owner");
        CharacterNFT.CharacterStats memory c = characterNFT.getCharacter(charId);
        require(c.hp < c.maxHp, "GameManager: full HP");

        uint256 cost = 10 ether; // 10 ERGOLD
        require(goldToken.balanceOf(msg.sender) >= cost, "GameManager: insufficient gold");

        goldToken.burnFrom(msg.sender, cost);
        characterNFT.updateStats(charId, c.level, c.xp, c.maxHp, c.maxHp, c.strength, c.defense);
    }

    // ─── Equipment ────────────────────────────────────

    /**
     * @notice Equip an item to a character.
     */
    function equipItem(uint256 charId, uint256 itemId) external {
        require(characterNFT.ownerOf(charId) == msg.sender, "GameManager: not char owner");
        require(itemNFT.ownerOf(itemId) == msg.sender, "GameManager: not item owner");

        ItemNFT.Item memory item = itemNFT.getItem(itemId);
        require(item.itemType != ItemNFT.ItemType.Potion, "GameManager: cannot equip potion");

        if (item.itemType == ItemNFT.ItemType.Weapon) {
            characterNFT.equipWeapon(charId, itemId);
        } else {
            characterNFT.equipArmor(charId, itemId);
        }

        characterNFT.recordAction(charId, 3, 0, 0, 0);
        emit ItemEquipped(msg.sender, charId, itemId);
    }

    /**
     * @notice Use a potion to heal.
     */
    function usePotion(uint256 charId, uint256 itemId) external {
        require(characterNFT.ownerOf(charId) == msg.sender, "GameManager: not char owner");
        require(itemNFT.ownerOf(itemId) == msg.sender, "GameManager: not item owner");

        ItemNFT.Item memory item = itemNFT.getItem(itemId);
        require(item.itemType == ItemNFT.ItemType.Potion, "GameManager: not a potion");

        CharacterNFT.CharacterStats memory c = characterNFT.getCharacter(charId);
        uint16 newHp = c.hp + item.power;
        if (newHp > c.maxHp) newHp = c.maxHp;

        characterNFT.updateStats(charId, c.level, c.xp, newHp, c.maxHp, c.strength, c.defense);
        itemNFT.consumeItem(itemId);
    }

    /**
     * @notice Buy an item from the shop using gold.
     */
    function buyItem(uint8 itemType) external {
        require(itemType <= 2, "GameManager: invalid type");
        require(goldToken.balanceOf(msg.sender) >= ITEM_COST, "GameManager: insufficient gold");

        goldToken.burnFrom(msg.sender, ITEM_COST);

        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1), block.timestamp, msg.sender
        )));

        _mintSpecificItem(msg.sender, ItemNFT.ItemType(itemType), seed);
    }

    // ─── Guild Functions ──────────────────────────────

    function createGuild(string calldata name) external {
        uint256 charId = characterNFT.playerCharacter(msg.sender);
        require(charId != 0, "GameManager: no character");
        uint256 guildId = guildManager.createGuild(name, msg.sender);
        characterNFT.setGuild(charId, guildId);
        characterNFT.recordAction(charId, 4, 0, 0, 0);
        _addWorldEvent(msg.sender, charId, 5, string.concat("Guild '", name, "' was founded!"));
    }

    function joinGuild(uint256 guildId) external {
        uint256 charId = characterNFT.playerCharacter(msg.sender);
        require(charId != 0, "GameManager: no character");
        guildManager.joinGuild(guildId, msg.sender);
        characterNFT.setGuild(charId, guildId);
        characterNFT.recordAction(charId, 4, 0, 0, 0);
    }

    function leaveGuild() external {
        uint256 charId = characterNFT.playerCharacter(msg.sender);
        require(charId != 0, "GameManager: no character");
        guildManager.leaveGuild(msg.sender);
        characterNFT.setGuild(charId, 0);
    }

    function donateToGuild(uint256 amount) external {
        uint256 guildId = guildManager.playerGuild(msg.sender);
        require(guildId != 0, "GameManager: not in guild");
        require(goldToken.balanceOf(msg.sender) >= amount, "GameManager: insufficient gold");
        goldToken.burnFrom(msg.sender, amount);
        guildManager.donateToTreasury(guildId, amount, msg.sender);
    }

    function createProposal(string calldata description) external returns (uint256) {
        uint256 guildId = guildManager.playerGuild(msg.sender);
        require(guildId != 0, "GameManager: not in guild");
        return guildManager.createProposal(guildId, description, msg.sender);
    }

    function voteOnProposal(uint256 proposalId, bool support) external {
        guildManager.vote(proposalId, msg.sender, support);
    }

    // ─── View Functions (Shared World) ────────────────

    function getAllPlayers() external view returns (address[] memory) {
        return playerList;
    }

    function getPlayerCount() external view returns (uint256) {
        return playerList.length;
    }

    /**
     * @notice Returns top 10 highest-level characters.
     */
    function leaderboard() external view returns (
        uint256[] memory ids,
        string[] memory names,
        uint8[] memory levels,
        uint32[] memory xps,
        address[] memory owners
    ) {
        uint256 total = characterNFT.getTotalCharacters();
        uint256 count = total > 10 ? 10 : total;

        ids = new uint256[](count);
        names = new string[](count);
        levels = new uint8[](count);
        xps = new uint32[](count);
        owners = new address[](count);

        // Simple selection sort for top N
        bool[] memory used = new bool[](total + 1);
        for (uint256 i = 0; i < count; i++) {
            uint256 bestId = 0;
            uint32 bestXp = 0;
            uint8 bestLevel = 0;
            for (uint256 j = 1; j <= total; j++) {
                if (!used[j]) {
                    CharacterNFT.CharacterStats memory c = characterNFT.getCharacter(j);
                    if (c.level > bestLevel || (c.level == bestLevel && c.xp > bestXp)) {
                        bestId = j;
                        bestLevel = c.level;
                        bestXp = c.xp;
                    }
                }
            }
            if (bestId > 0) {
                used[bestId] = true;
                ids[i] = bestId;
                CharacterNFT.CharacterStats memory bc = characterNFT.getCharacter(bestId);
                names[i] = bc.name;
                levels[i] = bc.level;
                xps[i] = bc.xp;
                owners[i] = characterNFT.ownerOf(bestId);
            }
        }
    }

    function getWorldEventsCount() external view returns (uint256) {
        return worldEvents.length;
    }

    /**
     * @notice Get recent world events (last N).
     */
    function getRecentWorldEvents(uint256 count) external view returns (WorldEvent[] memory) {
        uint256 total = worldEvents.length;
        uint256 start = total > count ? total - count : 0;
        uint256 len = total - start;

        WorldEvent[] memory events = new WorldEvent[](len);
        for (uint256 i = 0; i < len; i++) {
            events[i] = worldEvents[start + i];
        }
        return events;
    }

    // ─── Internal Helpers ─────────────────────────────

    function _mintRandomItem(address to, uint256 seed) internal {
        uint256 typeRoll = seed % 100;
        ItemNFT.ItemType iType;
        if (typeRoll < 40) iType = ItemNFT.ItemType.Weapon;
        else if (typeRoll < 75) iType = ItemNFT.ItemType.Armor;
        else iType = ItemNFT.ItemType.Potion;

        _mintSpecificItem(to, iType, seed >> 8);
    }

    function _mintSpecificItem(address to, ItemNFT.ItemType iType, uint256 seed) internal {
        // Rarity roll
        uint8 rarity;
        uint256 rarityRoll = seed % 100;
        if (rarityRoll < 50) rarity = 1;      // Common 50%
        else if (rarityRoll < 80) rarity = 2;  // Uncommon 30%
        else if (rarityRoll < 93) rarity = 3;  // Rare 13%
        else if (rarityRoll < 99) rarity = 4;  // Epic 6%
        else rarity = 5;                       // Legendary 1%

        uint16 power = uint16(5 * rarity + (seed >> 8) % (3 * rarity + 1));

        string memory name;
        if (iType == ItemNFT.ItemType.Weapon) {
            if (rarity <= 2) name = "Iron Sword";
            else if (rarity <= 4) name = "Steel Blade";
            else name = "Dragon Slayer";
        } else if (iType == ItemNFT.ItemType.Armor) {
            if (rarity <= 2) name = "Leather Armor";
            else if (rarity <= 4) name = "Chain Mail";
            else name = "Mythril Plate";
        } else {
            if (rarity <= 2) name = "Minor Potion";
            else if (rarity <= 4) name = "Greater Potion";
            else name = "Elixir of Life";
        }

        itemNFT.mintItem(to, name, iType, power, rarity);
    }

    function _addWorldEvent(
        address player,
        uint256 charId,
        uint8 eventType,
        string memory message
    ) internal {
        worldEvents.push(WorldEvent({
            player: player,
            characterId: charId,
            eventType: eventType,
            message: message,
            timestamp: uint64(block.timestamp)
        }));
        emit WorldEventEmitted(worldEvents.length - 1, player, eventType);
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
