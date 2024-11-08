// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDiamondCut} from "./interfaces/IDiamondCut.sol";
import {LibDiamond} from "./libraries/LibDiamond.sol";

/**
 * @title Diamond
 * @dev Implementation of the Diamond Standard (EIP-2535)
 * @notice This contract acts as a proxy that delegates calls to facets (implementation contracts)
 * @custom:security-contact security@satusky.com
 */
contract Diamond {
    error FunctionNotFound(bytes4 functionSelector);
    error DelegateCallFailed(address facetAddress, bytes data);
    error InvalidInitialization();

    /**
     * @dev Initializes the diamond with an owner
     * @param _contractOwner Address that will own the diamond
     */
    constructor(address _contractOwner) payable {
        if (_contractOwner == address(0)) revert InvalidInitialization();

        LibDiamond.setContractOwner(_contractOwner);
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Initialize diamond cut interface
        ds.supportsInterface[type(IDiamondCut).interfaceId] = true;
    }

    /**
     * @dev Fallback function that delegates calls to facets
     * @notice This function handles all calls to the diamond
     */
    fallback() external payable virtual {
        // Optimize storage loading
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Get facet address from function selector
        address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        if (facet == address(0)) {
            revert FunctionNotFound(msg.sig);
        }

        // Execute external function from facet using delegatecall
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    /**
     * @dev Accepts ETH transfers
     * @notice Required to receive ETH
     */
    receive() external payable virtual {}
}
