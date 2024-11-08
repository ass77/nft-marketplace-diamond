// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibMarketplace} from "../libraries/LibMarketplace.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AdminFacet
 * @dev Handles administrative functions for the marketplace
 * @notice This facet manages the configuration and settings of the marketplace
 * @custom:security-contact security@satusky.com
 */
contract AdminFacet {
    event PaymentTokenUpdated(
        address indexed oldToken,
        address indexed newToken
    );
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    error NotOwner();
    error InvalidPaymentToken();
    error InvalidFeeRecipient();
    error FeeExceedsMaximum();

    modifier onlyOwner() {
        if (msg.sender != LibDiamond.contractOwner()) revert NotOwner();
        _;
    }

    function setPaymentToken(address _paymentToken) external onlyOwner {
        if (_paymentToken == address(0)) revert InvalidPaymentToken();
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace
            .marketplaceStorage();
        address oldToken = address(ms.paymentToken);
        ms.paymentToken = IERC20(_paymentToken);
        emit PaymentTokenUpdated(oldToken, _paymentToken);
    }

    function setMarketplaceFee(uint256 _fee) external onlyOwner {
        if (_fee > 1000) revert FeeExceedsMaximum();
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace
            .marketplaceStorage();
        uint256 oldFee = ms.marketplaceFee;
        ms.marketplaceFee = _fee;
        emit MarketplaceFeeUpdated(oldFee, _fee);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace
            .marketplaceStorage();
        address oldRecipient = ms.feeRecipient;
        ms.feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
    }

    function getPaymentToken() external view returns (address) {
        return address(LibMarketplace.marketplaceStorage().paymentToken);
    }

    function getMarketplaceFee() external view returns (uint256) {
        return LibMarketplace.marketplaceStorage().marketplaceFee;
    }

    function getFeeRecipient() external view returns (address) {
        return LibMarketplace.marketplaceStorage().feeRecipient;
    }
}
