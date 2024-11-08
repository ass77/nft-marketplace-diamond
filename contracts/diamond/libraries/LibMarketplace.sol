// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title LibMarketplace
 * @dev Core library for NFT marketplace functionality
 * @notice Handles marketplace storage and core business logic
 */
library LibMarketplace {
    /// @dev Storage position in the EIP-2535 Diamond Storage pattern
    bytes32 private constant STORAGE_POSITION =
        keccak256("marketplace.storage");

    /**
     * @dev Events emitted from library functions
     * @param listingHash Unique identifier for the listing
     * @param isActive Current status of the listing
     */
    event ListingStatusChanged(bytes32 indexed listingHash, bool isActive);

    /**
     * @dev Event emitted when user stats are updated
     * @param user Address of the user whose stats were updated
     * @param isSeller Boolean indicating if the user is a seller
     * @param newTotal Updated total value for the user's stats
     */
    event StatsUpdated(address indexed user, bool isSeller, uint256 newTotal);

    /**
     * @dev Struct representing an NFT listing
     * @param seller Address of the NFT seller
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the listed NFT
     * @param price Listing price in payment token
     * @param active Whether the listing is currently active
     * @param listedAt Timestamp when the NFT was listed
     */
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
        uint256 listedAt;
    }

    /**
     * @dev Main storage struct for the marketplace
     * @notice Uses Diamond Storage pattern for upgradeable storage
     */
    struct MarketplaceStorage {
        IERC20 paymentToken; // Token used for payments
        mapping(bytes32 => Listing) listings; // Hash to Listing mapping
        mapping(address => mapping(uint256 => bytes32)) tokenIdToListingHash; // NFT to listing hash mapping
        uint256 marketplaceFee; // Fee in basis points (e.g., 250 = 2.5%)
        address feeRecipient; // Address receiving marketplace fees
        mapping(address => uint256) sellerTotalSales; // Total sales per seller
        mapping(address => uint256) buyerTotalPurchases; // Total purchases per buyer
        mapping(address => bytes32[]) sellerListings; // All listings by a seller
        uint256 totalListings; // Total number of listings ever created
        mapping(uint256 => bytes32) listingsByIndex; // Index to listing hash mapping for pagination
    }

    /**
     * @dev Retrieves marketplace storage
     * @return ms Storage pointer to MarketplaceStorage
     */
    function marketplaceStorage()
        internal
        pure
        returns (MarketplaceStorage storage ms)
    {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    /**
     * @dev Creates a unique hash for a listing based on NFT contract and token ID
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @return bytes32 Unique hash identifying the listing
     */
    function createListingHash(
        address nftContract,
        uint256 tokenId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(nftContract, tokenId));
    }

    /**
     * @dev Updates seller statistics when a sale occurs
     * @param seller Address of the seller
     * @param amount Sale amount to add to total
     */
    function updateSellerStats(address seller, uint256 amount) internal {
        MarketplaceStorage storage ms = marketplaceStorage();
        ms.sellerTotalSales[seller] += amount;
        emit StatsUpdated(seller, true, ms.sellerTotalSales[seller]);
    }

    /**
     * @dev Updates buyer statistics when a purchase occurs
     * @param buyer Address of the buyer
     * @param amount Purchase amount to add to total
     */
    function updateBuyerStats(address buyer, uint256 amount) internal {
        MarketplaceStorage storage ms = marketplaceStorage();
        ms.buyerTotalPurchases[buyer] += amount;
        emit StatsUpdated(buyer, false, ms.buyerTotalPurchases[buyer]);
    }

    /**
     * @dev Calculates marketplace fee for a given amount
     * @param amount Amount to calculate fee from
     * @return uint256 Fee amount
     */
    function calculateFee(uint256 amount) internal view returns (uint256) {
        MarketplaceStorage storage ms = marketplaceStorage();
        return (amount * ms.marketplaceFee) / 10000;
    }

    /**
     * @dev Creates a new listing in the marketplace
     * @param seller Address of the seller
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @param price Listing price
     * @return listingHash Unique identifier for the created listing
     */
    function createListing(
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) internal returns (bytes32 listingHash) {
        MarketplaceStorage storage ms = marketplaceStorage();

        listingHash = createListingHash(nftContract, tokenId);

        ms.listings[listingHash] = Listing({
            seller: seller,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true,
            listedAt: block.timestamp
        });

        ms.tokenIdToListingHash[nftContract][tokenId] = listingHash;
        ms.sellerListings[seller].push(listingHash);

        ms.listingsByIndex[ms.totalListings] = listingHash;
        ms.totalListings++;

        return listingHash;
    }

    /**
     * @dev Deactivates a listing
     * @param listingHash Hash of the listing to deactivate
     */
    function deactivateListing(bytes32 listingHash) internal {
        MarketplaceStorage storage ms = marketplaceStorage();
        ms.listings[listingHash].active = false;
        emit ListingStatusChanged(listingHash, false);
    }

    /**
     * @dev Retrieves all listings for a seller
     * @param seller Address of the seller
     * @return bytes32[] Array of listing hashes
     */
    function getSellerListings(
        address seller
    ) internal view returns (bytes32[] memory) {
        return marketplaceStorage().sellerListings[seller];
    }

    /**
     * @dev Retrieves paginated listings
     * @param offset Starting index
     * @param limit Maximum number of listings to return
     * @return Listing[] Array of listings
     */
    function getListingsPaginated(
        uint256 offset,
        uint256 limit
    ) internal view returns (Listing[] memory) {
        MarketplaceStorage storage ms = marketplaceStorage();

        if (limit == 0) {
            limit = 10; // Default limit
        }

        uint256 end = offset + limit;
        if (end > ms.totalListings) {
            end = ms.totalListings;
        }

        Listing[] memory results = new Listing[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            bytes32 listingHash = ms.listingsByIndex[i];
            results[i - offset] = ms.listings[listingHash];
        }

        return results;
    }

    /**
     * @dev Validates listing ownership
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @param seller Address claiming to be the owner
     * @return bool True if the seller owns the NFT
     */
    function validateListing(
        address nftContract,
        uint256 tokenId,
        address seller
    ) internal view returns (bool) {
        IERC721 nft = IERC721(nftContract);
        return nft.ownerOf(tokenId) == seller;
    }

    /**
     * @dev Retrieves user statistics
     * @param user Address of the user
     * @return totalSales Total sales amount for the user
     * @return totalPurchases Total purchases amount for the user
     */
    function getStats(
        address user
    ) internal view returns (uint256 totalSales, uint256 totalPurchases) {
        MarketplaceStorage storage ms = marketplaceStorage();
        return (ms.sellerTotalSales[user], ms.buyerTotalPurchases[user]);
    }
}
