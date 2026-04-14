// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

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

    // ─── Token URI (on-chain SVG) ────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId <= _nextTokenId, "CharacterNFT: invalid id");
        CharacterStats memory c = characters[tokenId];

        // Generate on-chain SVG
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" style="background:#1a2332">',
            '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#fbbf24"/><stop offset="100%" style="stop-color:#f97316"/></linearGradient></defs>',
            '<rect width="300" height="400" rx="12" fill="#1a2332" stroke="#3b82f6" stroke-width="2"/>',
            '<text x="150" y="40" text-anchor="middle" fill="url(#g)" font-size="20" font-weight="bold" font-family="serif">',
            c.name,
            '</text>',
            '<text x="150" y="65" text-anchor="middle" fill="#8b5cf6" font-size="14" font-family="sans-serif">Level ',
            Strings.toString(c.level),
            '</text>',
            _generateCharSvgBody(c, tokenId),
            '</svg>'
        );

        string memory json = string.concat(
            '{"name":"', c.name,
            '","description":"EtherRealms Character NFT - Level ', Strings.toString(c.level),
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","attributes":[',
            '{"trait_type":"Level","value":', Strings.toString(c.level), '},',
            '{"trait_type":"HP","value":', Strings.toString(c.hp), '},',
            '{"trait_type":"Max HP","value":', Strings.toString(c.maxHp), '},',
            '{"trait_type":"Strength","value":', Strings.toString(c.strength), '},',
            '{"trait_type":"Defense","value":', Strings.toString(c.defense), '},',
            '{"trait_type":"XP","value":', Strings.toString(c.xp), '}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _generateCharSvgBody(CharacterStats memory c, uint256 tokenId) internal pure returns (string memory) {
        uint256 hpPct = (uint256(c.hp) * 200) / uint256(c.maxHp);
        return string.concat(
            // Character pixel art body
            '<rect x="125" y="90" width="50" height="50" rx="25" fill="#8b5cf6"/>',
            '<text x="150" y="122" text-anchor="middle" font-size="30">',
            unicode'⚔️',
            '</text>',
            '<rect x="115" y="150" width="70" height="80" rx="8" fill="#3b82f6"/>',
            // HP bar
            '<text x="40" y="270" fill="#94a3b8" font-size="12" font-family="sans-serif">HP</text>',
            '<rect x="40" y="278" width="220" height="12" rx="6" fill="#0a0e17"/>',
            '<rect x="40" y="278" width="', Strings.toString(hpPct),
            '" height="12" rx="6" fill="#10b981"/>',
            // Stats
            '<text x="40" y="320" fill="#ef4444" font-size="13" font-family="sans-serif">STR: ', Strings.toString(c.strength), '</text>',
            '<text x="160" y="320" fill="#3b82f6" font-size="13" font-family="sans-serif">DEF: ', Strings.toString(c.defense), '</text>',
            '<text x="40" y="345" fill="#f59e0b" font-size="13" font-family="sans-serif">XP: ', Strings.toString(c.xp), '</text>',
            '<text x="40" y="370" fill="#94a3b8" font-size="11" font-family="sans-serif">Token #', Strings.toString(tokenId), '</text>'
        );
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
