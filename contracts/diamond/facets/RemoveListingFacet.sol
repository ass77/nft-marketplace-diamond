// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibMarketplace} from "../libraries/LibMarketplace.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title RemoveListingFacet
 * @dev Handles removal of NFT listings from the marketplace
 * @notice This facet manages the removal of single and bulk NFT listings
 * @custom:security-contact security@satusky.com
 */
contract RemoveListingFacet {
    /**
     * @dev Emitted when a single NFT listing is removed
     * @param seller Address of the listing owner
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the removed listing
     */
    event ListingRemoved(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId
    );

    /**
     * @dev Emitted when multiple listings are removed in bulk
     * @param seller Address of the listing owner
     * @param count Number of listings removed
     */
    event BulkListingsRemoved(address indexed seller, uint256 count);

    // Custom errors for gas-efficient error handling
    error ListingNotActive();
    error NotListingSeller();
    error ArrayLengthMismatch();
    error InvalidNFTContract();
    error EmptyArrays();
    error MaxBulkLimitExceeded();

    /// @dev Maximum number of listings that can be removed in a single bulk operation
    uint256 private constant _MAX_BULK_REMOVALS = 50;

    /**
     * @dev Removes a single NFT listing from the marketplace
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT to remove
     * @notice Only the listing owner can remove their listing
     */
    function removeListing(address nftContract, uint256 tokenId) external {
        if (nftContract == address(0)) revert InvalidNFTContract();

        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace
            .marketplaceStorage();
        bytes32 listingHash = LibMarketplace.createListingHash(
            nftContract,
            tokenId
        );
        LibMarketplace.Listing storage listing = ms.listings[listingHash];

        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotListingSeller();

        // Deactivate listing
        listing.active = false;
        delete ms.tokenIdToListingHash[nftContract][tokenId];

        emit ListingRemoved(msg.sender, nftContract, tokenId);
    }

    /**
     * @dev Removes multiple NFT listings in a single transaction
     * @param nftContracts Array of NFT contract addresses
     * @param tokenIds Array of token IDs to remove
     * @notice Arrays must be of equal length and not exceed _MAX_BULK_REMOVALS
     * @notice Continues processing even if individual removals fail
     */
    function bulkRemoveListing(
        address[] calldata nftContracts,
        uint256[] calldata tokenIds
    ) external {
        if (nftContracts.length != tokenIds.length)
            revert ArrayLengthMismatch();
        if (nftContracts.length == 0) revert EmptyArrays();
        if (nftContracts.length > _MAX_BULK_REMOVALS)
            revert MaxBulkLimitExceeded();

        for (uint256 i = 0; i < nftContracts.length; i++) {
            try this.removeListing(nftContracts[i], tokenIds[i]) {
                // Listing removed successfully
            } catch {
                // Continue with next listing even if one fails
                continue;
            }
        }

        emit BulkListingsRemoved(msg.sender, nftContracts.length);
    }

    /**
     * @dev Returns the maximum number of listings that can be removed in bulk
     * @return Maximum number of allowed bulk removals
     */
    function getMaxBulkRemovals() external pure returns (uint256) {
        return _MAX_BULK_REMOVALS;
    }

    /**
     * @dev Checks if a listing can be removed by the caller
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @return bool True if the listing can be removed by the caller
     * @notice Returns true only if listing is active and caller is the seller
     */
    function isListingRemovable(
        address nftContract,
        uint256 tokenId
    ) external view returns (bool) {
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace
            .marketplaceStorage();
        bytes32 listingHash = LibMarketplace.createListingHash(
            nftContract,
            tokenId
        );
        LibMarketplace.Listing storage listing = ms.listings[listingHash];

        return listing.active && listing.seller == msg.sender;
    }
}
