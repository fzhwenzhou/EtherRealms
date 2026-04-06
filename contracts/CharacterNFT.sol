// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CharacterNFT
 * @notice ERC-721 characters for EtherRealms.
 *         Stores on-chain attributes, level progression, equipment slots,
 *         and a traceable action history per character (addressing PoC feedback).
 */
contract CharacterNFT is ERC721, Ownable {
    uint256 private _nextTokenId;
    address public gameManager;

    struct CharacterStats {
        string name;
        uint8  level;
        uint32 xp;
        uint16 hp;
        uint16 maxHp;
        uint16 strength;
        uint16 defense;
        uint256 equippedWeapon;
        uint256 equippedArmor;
        uint256 guildId;
        uint64 lastActionTime;
        uint8  energy;
    }

    struct ActionRecord {
        uint64  timestamp;
        uint8   actionType; // 0=mint, 1=explore, 2=combat, 3=equip, 4=guild
        int16   hpChange;
        uint32  xpGained;
        uint256 goldGained;
    }

    mapping(uint256 => CharacterStats) public characters;
    mapping(uint256 => ActionRecord[]) public actionHistory;
    mapping(address => uint256) public playerCharacter; // one character per address

    uint256 public totalCharacters;

    event CharacterMinted(address indexed owner, uint256 indexed tokenId, string name);
    event StatsUpdated(uint256 indexed tokenId, uint8 level, uint32 xp, uint16 hp);
    event ActionRecorded(uint256 indexed tokenId, uint8 actionType, uint64 timestamp);

    modifier onlyGameManager() {
        require(msg.sender == gameManager, "CharacterNFT: caller is not GameManager");
        _;
    }

    constructor() ERC721("EtherRealms Character", "ERCHAR") Ownable(msg.sender) {}

    function setGameManager(address _gm) external onlyOwner {
        require(_gm != address(0), "CharacterNFT: zero address");
        gameManager = _gm;
    }

    /**
     * @notice Mint a new character. Costs 0.01 ETH. One character per address.
     */
    function mintCharacter(string calldata _name) external payable returns (uint256) {
        require(msg.value >= 0.01 ether, "CharacterNFT: insufficient ETH");
        require(playerCharacter[msg.sender] == 0, "CharacterNFT: already has character");
        require(bytes(_name).length > 0 && bytes(_name).length <= 32, "CharacterNFT: invalid name");

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        _safeMint(msg.sender, tokenId);

        characters[tokenId] = CharacterStats({
            name: _name,
            level: 1,
            xp: 0,
            hp: 100,
            maxHp: 100,
            strength: 10,
            defense: 5,
            equippedWeapon: 0,
            equippedArmor: 0,
            guildId: 0,
            lastActionTime: uint64(block.timestamp),
            energy: 5
        });

        playerCharacter[msg.sender] = tokenId;
        totalCharacters++;

        _recordAction(tokenId, 0, 0, 0, 0);

        emit CharacterMinted(msg.sender, tokenId, _name);
        return tokenId;
    }

    // ─── GameManager helpers ──────────────────────────

    function updateStats(
        uint256 tokenId,
        uint8 level,
        uint32 xp,
        uint16 hp,
        uint16 maxHp,
        uint16 strength,
        uint16 defense
    ) external onlyGameManager {
        CharacterStats storage c = characters[tokenId];
        c.level = level;
        c.xp = xp;
        c.hp = hp;
        c.maxHp = maxHp;
        c.strength = strength;
        c.defense = defense;
        emit StatsUpdated(tokenId, level, xp, hp);
    }

    function setEnergy(uint256 tokenId, uint8 energy, uint64 lastAction) external onlyGameManager {
        characters[tokenId].energy = energy;
        characters[tokenId].lastActionTime = lastAction;
    }

    function equipWeapon(uint256 tokenId, uint256 itemId) external onlyGameManager {
        characters[tokenId].equippedWeapon = itemId;
    }

    function equipArmor(uint256 tokenId, uint256 itemId) external onlyGameManager {
        characters[tokenId].equippedArmor = itemId;
    }

    function setGuild(uint256 tokenId, uint256 guildId) external onlyGameManager {
        characters[tokenId].guildId = guildId;
    }

    function recordAction(
        uint256 tokenId,
        uint8 actionType,
        int16 hpChange,
        uint32 xpGained,
        uint256 goldGained
    ) external onlyGameManager {
        _recordAction(tokenId, actionType, hpChange, xpGained, goldGained);
    }

    // ─── View helpers ─────────────────────────────────

    function getCharacter(uint256 tokenId) external view returns (CharacterStats memory) {
        require(tokenId > 0 && tokenId <= _nextTokenId, "CharacterNFT: invalid id");
        return characters[tokenId];
    }

    function getActionHistory(uint256 tokenId) external view returns (ActionRecord[] memory) {
        return actionHistory[tokenId];
    }

    function getActionHistoryLength(uint256 tokenId) external view returns (uint256) {
        return actionHistory[tokenId].length;
    }

    function getTotalCharacters() external view returns (uint256) {
        return totalCharacters;
    }

    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // ─── Internal ─────────────────────────────────────

    function _recordAction(
        uint256 tokenId,
        uint8 actionType,
        int16 hpChange,
        uint32 xpGained,
        uint256 goldGained
    ) internal {
        actionHistory[tokenId].push(ActionRecord({
            timestamp: uint64(block.timestamp),
            actionType: actionType,
            hpChange: hpChange,
            xpGained: xpGained,
            goldGained: goldGained
        }));
        emit ActionRecorded(tokenId, actionType, uint64(block.timestamp));
    }
}
