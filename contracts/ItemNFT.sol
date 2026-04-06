// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
