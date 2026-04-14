// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./ItemNFT.sol";
import "./GoldToken.sol";

/**
 * @title Marketplace
 * @notice Decentralized player-to-player item trading for EtherRealms.
 *         Players can list items for sale (priced in ERGOLD) and buy from others.
 *         Supports listing, buying, cancelling, and browsing active listings.
 */
contract Marketplace is Ownable {
    ItemNFT public itemNFT;
    GoldToken public goldToken;

    struct Listing {
        uint256 itemId;
        address seller;
        uint256 price;      // in ERGOLD (18 decimals)
        uint64  listedAt;
        bool    active;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;
    // Track which item is currently listed (itemId => listingId), 0 = not listed
    mapping(uint256 => uint256) public itemToListing;

    // Fee: 2% of sale price goes to contract owner (treasury)
    uint256 public constant FEE_PERCENT = 2;

    event ItemListed(uint256 indexed listingId, uint256 indexed itemId, address indexed seller, uint256 price);
    event ItemSold(uint256 indexed listingId, uint256 indexed itemId, address seller, address buyer, uint256 price);
    event ListingCancelled(uint256 indexed listingId, uint256 indexed itemId, address indexed seller);

    constructor(address _itemNFT, address _goldToken) Ownable(msg.sender) {
        itemNFT = ItemNFT(_itemNFT);
        goldToken = GoldToken(_goldToken);
    }

    /**
     * @notice List an item for sale. Seller must approve this contract first.
     * @param itemId The token ID of the item to sell
     * @param price  The price in ERGOLD (with 18 decimals, e.g. 50 ether = 50 ERGOLD)
     */
    function listItem(uint256 itemId, uint256 price) external {
        require(itemNFT.ownerOf(itemId) == msg.sender, "Marketplace: not item owner");
        require(price > 0, "Marketplace: price must be > 0");
        require(itemToListing[itemId] == 0, "Marketplace: item already listed");

        // Transfer item to marketplace for escrow
        itemNFT.transferFrom(msg.sender, address(this), itemId);

        nextListingId++;
        uint256 listingId = nextListingId;

        listings[listingId] = Listing({
            itemId: itemId,
            seller: msg.sender,
            price: price,
            listedAt: uint64(block.timestamp),
            active: true
        });

        itemToListing[itemId] = listingId;

        emit ItemListed(listingId, itemId, msg.sender, price);
    }

    /**
     * @notice Buy a listed item. Buyer must have enough ERGOLD.
     *         The gold is burned from buyer and minted to seller (minus fee).
     * @param listingId The ID of the listing to buy
     */
    function buyItem(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        require(msg.sender != listing.seller, "Marketplace: cannot buy own item");
        require(goldToken.balanceOf(msg.sender) >= listing.price, "Marketplace: insufficient gold");

        listing.active = false;
        itemToListing[listing.itemId] = 0;

        // Transfer gold: burn from buyer
        goldToken.burnFrom(msg.sender, listing.price);

        // Calculate fee
        uint256 fee = (listing.price * FEE_PERCENT) / 100;
        uint256 sellerAmount = listing.price - fee;

        // Mint gold to seller (minus fee)
        goldToken.mint(listing.seller, sellerAmount);

        // Transfer item from escrow to buyer
        itemNFT.transferFrom(address(this), msg.sender, listing.itemId);

        emit ItemSold(listingId, listing.itemId, listing.seller, msg.sender, listing.price);
    }

    /**
     * @notice Cancel a listing and return the item to the seller.
     * @param listingId The ID of the listing to cancel
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not seller");

        listing.active = false;
        itemToListing[listing.itemId] = 0;

        // Return item to seller
        itemNFT.transferFrom(address(this), msg.sender, listing.itemId);

        emit ListingCancelled(listingId, listing.itemId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /**
     * @notice Get all active listings (up to a maximum count).
     */
    function getActiveListings(uint256 maxCount) external view returns (
        uint256[] memory listingIds,
        uint256[] memory itemIds,
        address[] memory sellers,
        uint256[] memory prices,
        string[] memory itemNames,
        uint8[] memory itemTypes,
        uint16[] memory itemPowers,
        uint8[] memory itemRarities
    ) {
        // First pass: count active listings
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= nextListingId && activeCount < maxCount; i++) {
            if (listings[i].active) activeCount++;
        }

        listingIds = new uint256[](activeCount);
        itemIds = new uint256[](activeCount);
        sellers = new address[](activeCount);
        prices = new uint256[](activeCount);
        itemNames = new string[](activeCount);
        itemTypes = new uint8[](activeCount);
        itemPowers = new uint16[](activeCount);
        itemRarities = new uint8[](activeCount);

        uint256 idx = 0;
        for (uint256 i = 1; i <= nextListingId && idx < activeCount; i++) {
            if (listings[i].active) {
                Listing memory l = listings[i];
                listingIds[idx] = i;
                itemIds[idx] = l.itemId;
                sellers[idx] = l.seller;
                prices[idx] = l.price;

                try itemNFT.getItem(l.itemId) returns (ItemNFT.Item memory item) {
                    itemNames[idx] = item.name;
                    itemTypes[idx] = uint8(item.itemType);
                    itemPowers[idx] = item.power;
                    itemRarities[idx] = item.rarity;
                } catch {}

                idx++;
            }
        }
    }

    function getActiveListingCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i <= nextListingId; i++) {
            if (listings[i].active) count++;
        }
        return count;
    }
}
