// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibMarketplace} from "../libraries/LibMarketplace.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ListingFacet
 * @dev Handles NFT listing functionality in the marketplace
 * @notice This facet manages the creation and querying of NFT listings
 * @custom:security-contact security@satusky.com
 */
contract ListingFacet {
    /**
     * @dev Emitted when an NFT is listed for sale
     * @param seller Address of the NFT owner
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the listed NFT
     * @param price Listing price in payment token
     */
    event NFTListed(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 price
    );

    // Custom errors for gas-efficient error handling
    error ZeroPrice();
    error NotTokenOwner();
    error NFTNotApproved();
    error ListingAlreadyExists();
    error InvalidNFTContract();
    error InvalidTokenId();

    /**
     * @dev Lists an NFT for sale in the marketplace
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT to list
     * @param price Listing price in payment token
     * @notice Requires NFT approval for the marketplace contract
     */
    function listNFT(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external {
        // Input validation
        if (price == 0) revert ZeroPrice();
        if (nftContract == address(0)) revert InvalidNFTContract();

        // Validate ownership and approval
        if (!LibMarketplace.validateListing(nftContract, tokenId, msg.sender)) {
            revert NotTokenOwner();
        }

        IERC721 nft = IERC721(nftContract);
        if (!nft.isApprovedForAll(msg.sender, address(this))) {
            revert NFTNotApproved();
        }

        emit NFTListed(msg.sender, nftContract, tokenId, price);
    }

    /**
     * @dev Retrieves listing details by NFT contract and token ID
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @return seller Address of the seller
     * @return price Listing price
     * @return active Whether the listing is active
     * @return listedAt Timestamp when the NFT was listed
     */
    function getListing(
        address nftContract,
        uint256 tokenId
    )
        external
        view
        returns (address seller, uint256 price, bool active, uint256 listedAt)
    {
        bytes32 listingHash = LibMarketplace.createListingHash(
            nftContract,
            tokenId
        );
        LibMarketplace.Listing storage listing = LibMarketplace
            .marketplaceStorage()
            .listings[listingHash];
        return (
            listing.seller,
            listing.price,
            listing.active,
            listing.listedAt
        );
    }

    /**
     * @dev Retrieves listing details by listing hash
     * @param listingHash Hash of the listing
     * @return seller Address of the seller
     * @return nftContract Address of the NFT contract
     * @return tokenId Token ID of the NFT
     * @return price Listing price
     * @return active Whether the listing is active
     * @return listedAt Timestamp when the NFT was listed
     */
    function getListingByHash(
        bytes32 listingHash
    )
        external
        view
        returns (
            address seller,
            address nftContract,
            uint256 tokenId,
            uint256 price,
            bool active,
            uint256 listedAt
        )
    {
        LibMarketplace.Listing storage listing = LibMarketplace
            .marketplaceStorage()
            .listings[listingHash];
        return (
            listing.seller,
            listing.nftContract,
            listing.tokenId,
            listing.price,
            listing.active,
            listing.listedAt
        );
    }

    // Add new query functions
    function getSellerListings(
        address seller
    ) external view returns (bytes32[] memory) {
        return LibMarketplace.getSellerListings(seller);
    }

    function getListingsPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (LibMarketplace.Listing[] memory listings) {
        return LibMarketplace.getListingsPaginated(offset, limit);
    }

    function getUserStats(
        address user
    ) external view returns (uint256 totalSales, uint256 totalPurchases) {
        return LibMarketplace.getStats(user);
    }
}
