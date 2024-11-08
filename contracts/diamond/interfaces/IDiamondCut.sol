// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IDiamondCut
 * @dev Interface for diamond cut functionality in the Diamond Standard
 * @notice Defines the interface for adding, replacing, and removing facets
 * @custom:security-contact security@satusky.com
 */
interface IDiamondCut {
    /**
     * @dev Enum defining the possible actions for a facet cut
     * @notice Add = 0, Replace = 1, Remove = 2
     */
    enum FacetCutAction {
        Add,
        Replace,
        Remove
    }

    /**
     * @dev Struct for diamond cut action parameters
     * @param facetAddress Address of the facet to add/replace/remove
     * @param action The type of action to perform (Add=0, Replace=1, Remove=2)
     * @param functionSelectors Array of function selectors to modify
     */
    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    /**
     * @dev Performs a diamond cut, modifying the facets of the diamond
     * @param _diamondCut Array of FacetCut structs containing modification data
     * @param _init Address of initialization contract
     * @param _calldata Initialization function call data
     * @notice This function modifies the diamond's functionality by adding, replacing, or removing facets
     */
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external;
}
