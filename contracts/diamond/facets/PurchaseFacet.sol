// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibMarketplace} from "../libraries/LibMarketplace.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PurchaseFacet
 * @dev Handles NFT purchase functionality in the marketplace
 */
contract PurchaseFacet is ReentrancyGuard {
    event NFTPurchased(
        address indexed buyer,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );

    error ListingNotActive();
    error CannotBuyOwnNFT();
    error PaymentToSellerFailed();
    error FeePaymentFailed();
    error NFTTransferFailed();
    error InvalidNFTContract();
    error InvalidPaymentAmount();

    /**
     * @dev Purchase a listed NFT
     * @param nftContract The address of the NFT contract
     * @param tokenId The token ID of the NFT
     */
    function purchaseNFT(
        address nftContract,
        uint256 tokenId
    ) external nonReentrant {
        if (nftContract == address(0)) revert InvalidNFTContract();

        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace
            .marketplaceStorage();
        bytes32 listingHash = LibMarketplace.createListingHash(
            nftContract,
            tokenId
        );
        LibMarketplace.Listing storage listing = ms.listings[listingHash];

        if (!listing.active) revert ListingNotActive();
        if (listing.seller == msg.sender) revert CannotBuyOwnNFT();

        uint256 price = listing.price;
        address seller = listing.seller;

        // Calculate fees
        uint256 feeAmount = LibMarketplace.calculateFee(price);
        uint256 sellerAmount = price - feeAmount;

        // Transfer payment to seller
        if (!ms.paymentToken.transferFrom(msg.sender, seller, sellerAmount)) {
            revert PaymentToSellerFailed();
        }

        // Transfer fee to recipient if applicable
        if (feeAmount > 0) {
            if (
                !ms.paymentToken.transferFrom(
                    msg.sender,
                    ms.feeRecipient,
                    feeAmount
                )
            ) {
                revert FeePaymentFailed();
            }
        }

        // Transfer NFT to buyer
        try IERC721(nftContract).safeTransferFrom(seller, msg.sender, tokenId) {
            // Update listing status
            listing.active = false;

            // Update statistics
            LibMarketplace.updateBuyerStats(msg.sender, price);
            LibMarketplace.updateSellerStats(seller, price);

            emit NFTPurchased(msg.sender, seller, nftContract, tokenId, price);
        } catch {
            revert NFTTransferFailed();
        }
    }

    /**
     * @dev Get listing details
     * @param nftContract The address of the NFT contract
     * @param tokenId The token ID of the NFT
     * @return seller The address of the seller
     * @return price The listing price
     * @return active Whether the listing is active
     * @return listedAt When the NFT was listed
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
}
