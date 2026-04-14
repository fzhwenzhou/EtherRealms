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

        // Generate on-chain SVG with procedurally generated avatar
        string memory avatarSvg = _generateAvatarSvg(tokenId, c.name);

        string memory json = string.concat(
            '{"name":"', c.name,
            '","description":"EtherRealms Character NFT",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(avatarSvg)),
            '"}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
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

    function _getAvatar(uint256 tokenId) internal pure returns (string memory) {
        // Array of avatar emojis
        string[10] memory avatars = [
            unicode'⚔️',  // Sword
            unicode'🛡️',  // Shield
            unicode'🗡️',  // Dagger
            unicode'🏹',  // Bow
            unicode'👑',  // Crown
            unicode'🐉',  // Dragon
            unicode'🦁',  // Lion
            unicode'⚡',  // Lightning
            unicode'🔥',  // Fire
            unicode'❄️'   // Frost
        ];
        
        // Pseudo-random selection based on tokenId
        uint256 index = tokenId % 10;
        return avatars[index];
    }

    function _generateAvatarSvg(uint256 tokenId, string memory charName) internal pure returns (string memory) {
        // Generate colors from tokenId
        string memory bgColor = _getColorFromSeed(tokenId, 0);
        string memory primaryColor = _getColorFromSeed(tokenId, 1);
        string memory accentColor = _getColorFromSeed(tokenId, 2);
        
        // Start building SVG
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420" style="background:#0f1419">',
            '<defs>',
            '<linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#1a2f4d;stop-opacity:1" />',
            '<stop offset="100%" style="stop-color:#0f1419;stop-opacity:1" />',
            '</linearGradient>',
            '</defs>',
            '<rect width="320" height="420" fill="url(#bgGrad)"/>',
            '<rect width="320" height="420" rx="20" fill="none" stroke="#3b82f6" stroke-width="3" opacity="0.6"/>'
        );
        
        // Add avatar circle with background color
        svg = string.concat(
            svg,
            '<circle cx="160" cy="120" r="70" fill="', bgColor, '" opacity="0.9"/>',
            '<circle cx="160" cy="120" r="70" fill="none" stroke="', primaryColor, '" stroke-width="3" opacity="0.5"/>'
        );
        
        // Generate improved pixel pattern grid
        svg = string.concat(svg, _generatePixelPattern(tokenId, primaryColor, accentColor, 75, 35, 17));
        
        // Add character name at bottom
        svg = string.concat(
            svg,
            '<text x="160" y="350" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#e0e7ff">',
            charName,
            '</text>'
        );
        
        svg = string.concat(svg, '</svg>');
        
        return svg;
    }

    function _generatePixelPattern(uint256 seed, string memory color1, string memory color2, uint256 startX, uint256 startY, uint256 blockSize) internal pure returns (string memory) {
        string memory pattern = '';
        uint256 hash = uint256(keccak256(abi.encodePacked(seed)));
        
        // 6x6 grid with symmetry for better aesthetics
        for (uint256 row = 0; row < 6; row++) {
            for (uint256 col = 0; col < 6; col++) {
                uint256 bitIndex = (row * 6 + col);
                uint256 bit = (hash >> (bitIndex % 256)) & 1;
                
                // Create symmetry (mirror left-right for better appearance)
                if (col > 2) {
                    bit = (hash >> ((row * 6 + (5 - col)) % 256)) & 1;
                }
                
                // Skip center rows for face area
                if ((row == 2 || row == 3) && (col == 2 || col == 3)) continue;
                
                string memory fillColor = bit == 1 ? color1 : color2;
                uint256 x = startX + (col * blockSize);
                uint256 y = startY + (row * blockSize);
                uint256 opacity = bit == 1 ? 90 : 45;
                
                pattern = string.concat(
                    pattern,
                    '<rect x="', Strings.toString(x), '" y="', Strings.toString(y), 
                    '" width="', Strings.toString(blockSize), '" height="', Strings.toString(blockSize),
                    '" fill="', fillColor, '" opacity="0.', Strings.toString(opacity), '" rx="2"/>'
                );
            }
        }
        
        // Add improved facial features
        pattern = string.concat(
            pattern,
            '<circle cx="145" cy="118" r="4" fill="#ffd700" opacity="0.9"/>',
            '<circle cx="175" cy="118" r="4" fill="#ffd700" opacity="0.9"/>',
            '<circle cx="145" cy="118" r="2.5" fill="#000"/>',
            '<circle cx="175" cy="118" r="2.5" fill="#000"/>',
            '<path d="M 145 135 Q 160 143 175 135" stroke="#ff69b4" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
        );
        
        return pattern;
    }

    function _getColorFromSeed(uint256 seed, uint256 offset) internal pure returns (string memory) {
        // Array of nice colors for avatars
        string[12] memory colors = [
            '#FF6B6B',  // Red
            '#4ECDC4',  // Teal
            '#45B7D1',  // Blue
            '#FFA07A',  // Light Salmon
            '#98D8C8',  // Mint
            '#F7DC6F',  // Yellow
            '#BB8FCE',  // Purple
            '#85C1E2',  // Light Blue
            '#F8B739',  // Gold
            '#52C779',  // Green
            '#FF85B3',  // Pink
            '#C3F0CA'   // Light Green
        ];
        
        uint256 hash = uint256(keccak256(abi.encodePacked(seed, offset)));
        uint256 colorIndex = hash % 12;
        
        return colors[colorIndex];
    }
}
