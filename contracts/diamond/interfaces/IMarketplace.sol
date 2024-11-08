// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IMarketplace
 * @dev Interface for the NFT marketplace functionality
 * @notice Defines core marketplace operations and events
 * @custom:security-contact security@satusky.com
 */
interface IMarketplace {
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

    /**
     * @dev Emitted when an NFT is purchased
     * @param buyer Address of the NFT purchaser
     * @param seller Address of the NFT seller
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the purchased NFT
     * @param price Purchase price in payment token
     */
    event NFTPurchased(
        address indexed buyer,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 price
    );

    /**
     * @dev Emitted when an NFT listing is removed
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
     * @dev Emitted when the payment token is updated
     * @param oldToken Address of the previous payment token
     * @param newToken Address of the new payment token
     */
    event PaymentTokenUpdated(
        address indexed oldToken,
        address indexed newToken
    );

    /**
     * @dev Emitted when the marketplace fee is updated
     * @param oldFee Previous fee percentage
     * @param newFee New fee percentage
     */
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);

    /**
     * @dev Emitted when the fee recipient is updated
     * @param oldRecipient Address of the previous fee recipient
     * @param newRecipient Address of the new fee recipient
     */
    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    /**
     * @dev Lists an NFT for sale in the marketplace
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT to list
     * @param price Listing price in payment token
     */
    function listNFT(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external;

    /**
     * @dev Purchases a listed NFT
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT to purchase
     */
    function purchaseNFT(address nftContract, uint256 tokenId) external;

    /**
     * @dev Removes an NFT listing from the marketplace
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT to remove
     */
    function removeListing(address nftContract, uint256 tokenId) external;

    /**
     * @dev Retrieves listing details for an NFT
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @return seller Address of the seller
     * @return price Listing price in payment token
     * @return active Whether the listing is currently active
     */
    function getListing(
        address nftContract,
        uint256 tokenId
    ) external view returns (address seller, uint256 price, bool active);
}
