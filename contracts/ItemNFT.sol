// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ItemNFT
 * @notice ERC-721 items (weapons, armor, potions) for EtherRealms.
 *         Items have on-chain stats and traceable ownership history.
 */
contract ItemNFT is ERC721, Ownable {
    uint256 private _nextTokenId;
    address public gameManager;

    enum ItemType { Weapon, Armor, Potion }

    struct Item {
        string   name;
        ItemType itemType;
        uint16   power;      // attack bonus for weapons, defense for armor, heal for potions
        uint8    rarity;     // 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary
        uint64   mintedAt;
        address  originalOwner;
    }

    struct OwnershipRecord {
        address owner;
        uint64  acquiredAt;
    }

    mapping(uint256 => Item) public items;
    mapping(uint256 => OwnershipRecord[]) public ownershipHistory;

    uint256 public totalItems;

    event ItemMinted(address indexed owner, uint256 indexed tokenId, string name, uint8 itemType, uint16 power, uint8 rarity);
    event ItemUsed(uint256 indexed tokenId, address indexed user);

    modifier onlyGameManager() {
        require(msg.sender == gameManager, "ItemNFT: caller is not GameManager");
        _;
    }

    constructor() ERC721("EtherRealms Item", "ERITEM") Ownable(msg.sender) {}

    function setGameManager(address _gm) external onlyOwner {
        require(_gm != address(0), "ItemNFT: zero address");
        gameManager = _gm;
    }

    /**
     * @notice GameManager mints items as adventure/combat rewards.
     */
    function mintItem(
        address to,
        string calldata _name,
        ItemType _type,
        uint16 _power,
        uint8 _rarity
    ) external onlyGameManager returns (uint256) {
        _nextTokenId++;
        uint256 tokenId = _nextTokenId;
        _safeMint(to, tokenId);

        items[tokenId] = Item({
            name: _name,
            itemType: _type,
            power: _power,
            rarity: _rarity,
            mintedAt: uint64(block.timestamp),
            originalOwner: to
        });

        ownershipHistory[tokenId].push(OwnershipRecord({
            owner: to,
            acquiredAt: uint64(block.timestamp)
        }));

        totalItems++;

        emit ItemMinted(to, tokenId, _name, uint8(_type), _power, _rarity);
        return tokenId;
    }

    /**
     * @notice Mark a consumable as used (potions). Burns the NFT.
     */
    function consumeItem(uint256 tokenId) external onlyGameManager {
        require(items[tokenId].itemType == ItemType.Potion, "ItemNFT: not consumable");
        emit ItemUsed(tokenId, ownerOf(tokenId));
        _burn(tokenId);
    }

    // ─── View helpers ─────────────────────────────────

    function getItem(uint256 tokenId) external view returns (Item memory) {
        require(tokenId > 0 && tokenId <= _nextTokenId, "ItemNFT: invalid id");
        return items[tokenId];
    }

    function getOwnershipHistory(uint256 tokenId) external view returns (OwnershipRecord[] memory) {
        return ownershipHistory[tokenId];
    }

    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ─── Token URI (on-chain SVG) ────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId <= _nextTokenId, "ItemNFT: invalid id");
        Item memory item = items[tokenId];

        string memory typeStr = _itemTypeString(item.itemType);
        string memory rarityStr = _rarityString(item.rarity);
        string memory rarityColor = _rarityColor(item.rarity);
        string memory itemEmoji = _itemEmoji(item.itemType);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250" style="background:#1a2332">',
            '<rect width="250" height="250" rx="12" fill="#1a2332" stroke="', rarityColor, '" stroke-width="3"/>',
            '<text x="125" y="80" text-anchor="middle" font-size="60">', itemEmoji, '</text>',
            '<text x="125" y="130" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="bold" font-family="sans-serif">',
            item.name, '</text>',
            '<text x="125" y="155" text-anchor="middle" fill="', rarityColor, '" font-size="13" font-family="sans-serif">',
            rarityStr, ' ', typeStr, '</text>',
            '<text x="125" y="185" text-anchor="middle" fill="#fbbf24" font-size="14" font-family="sans-serif">Power: ',
            Strings.toString(item.power), '</text>',
            '<text x="125" y="230" text-anchor="middle" fill="#64748b" font-size="11" font-family="sans-serif">Token #',
            Strings.toString(tokenId), '</text>',
            '</svg>'
        );

        string memory json = string.concat(
            '{"name":"', item.name,
            '","description":"EtherRealms Item - ', rarityStr, ' ', typeStr,
            '","image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)),
            '","attributes":[',
            '{"trait_type":"Type","value":"', typeStr, '"},',
            '{"trait_type":"Rarity","value":"', rarityStr, '"},',
            '{"trait_type":"Power","value":', Strings.toString(item.power), '}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _itemTypeString(ItemType t) internal pure returns (string memory) {
        if (t == ItemType.Weapon) return "Weapon";
        if (t == ItemType.Armor) return "Armor";
        return "Potion";
    }

    function _rarityString(uint8 r) internal pure returns (string memory) {
        if (r == 1) return "Common";
        if (r == 2) return "Uncommon";
        if (r == 3) return "Rare";
        if (r == 4) return "Epic";
        if (r == 5) return "Legendary";
        return "Unknown";
    }

    function _rarityColor(uint8 r) internal pure returns (string memory) {
        if (r == 1) return "#9ca3af";
        if (r == 2) return "#4ade80";
        if (r == 3) return "#60a5fa";
        if (r == 4) return "#a78bfa";
        if (r == 5) return "#fbbf24";
        return "#9ca3af";
    }

    function _itemEmoji(ItemType t) internal pure returns (string memory) {
        if (t == ItemType.Weapon) return unicode"\u2694";
        if (t == ItemType.Armor) return unicode"\u26E8";
        return unicode"\u2697";
    }

    /**
     * @notice Track transfers for ownership history.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (to != address(0) && from != address(0)) {
            ownershipHistory[tokenId].push(OwnershipRecord({
                owner: to,
                acquiredAt: uint64(block.timestamp)
            }));
        }
        return from;
    }
}
