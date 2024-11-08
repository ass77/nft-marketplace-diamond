// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDiamondCut} from "../interfaces/IDiamondCut.sol";

/**
 * @title LibDiamond
 * @dev Core library for diamond proxy pattern implementation
 * @notice Manages diamond storage, facet management, and ownership functionality
 * @custom:security-contact security@satusky.com
 */
library LibDiamond {
    bytes32 public constant DIAMOND_STORAGE_POSITION =
        keccak256("diamond.standard.diamond.storage");

    // Custom errors for gas-efficient error handling
    error InvalidOwner();
    error NotContractOwner();
    error NoSelectorsGivenToAdd();
    error NoSelectorsProvidedForFacetForCut();
    error CannotAddSelectorsToZeroAddress();
    error NoBytecodeAtAddress();
    error CannotAddFunctionToDiamondThatAlreadyExists();
    error CannotReplaceFunctionsFromFacetWithZeroAddress();
    error CannotReplaceImmutableFunction();
    error CannotReplaceFunctionWithTheSameFunctionFromTheSameFacet();
    error CannotReplaceFunctionThatDoesNotExists();
    error RemoveFacetAddressMustBeZeroAddress();
    error CannotRemoveFunctionThatDoesNotExist();
    error CannotRemoveImmutableFunction();
    error InitializationFunctionReverted();
    error InvalidFacetCutAction();

    /**
     * @dev Struct to store facet address and its position in the selectors array
     * @param facetAddress Address of the facet contract
     * @param functionSelectorPosition Position in facetFunctionSelectors.functionSelectors array
     */
    struct FacetAddressAndPosition {
        address facetAddress;
        uint96 functionSelectorPosition;
    }

    /**
     * @dev Struct to store function selectors for a facet
     * @param functionSelectors Array of function selectors supported by the facet
     * @param facetAddressPosition Position of facet address in facetAddresses array
     */
    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;
        uint256 facetAddressPosition;
    }

    /**
     * @dev Main storage struct for the diamond contract
     * @notice Contains mappings for selectors, facets, and contract ownership
     */
    struct DiamondStorage {
        // maps function selector to the facet address and
        // the position of the selector in the facetFunctionSelectors.selectors array
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        // maps facet addresses to function selectors
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        // facet addresses
        address[] facetAddresses;
        // Used to query if a contract implements an interface.
        // Used to implement ERC-165.
        mapping(bytes4 => bool) supportsInterface;
        // owner of the contract
        address contractOwner;
    }

    /**
     * @dev Returns the diamond storage
     * @return ds Storage pointer to the diamond storage struct
     */
    function diamondStorage()
        internal
        pure
        returns (DiamondStorage storage ds)
    {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    /**
     * @dev Sets a new contract owner
     * @param _newOwner Address of the new owner
     */
    function setContractOwner(address _newOwner) internal {
        if (_newOwner == address(0)) revert InvalidOwner();
        DiamondStorage storage ds = diamondStorage();
        ds.contractOwner = _newOwner;
    }

    /**
     * @dev Returns the current contract owner
     * @return Address of the contract owner
     */
    function contractOwner() internal view returns (address) {
        return diamondStorage().contractOwner;
    }

    /**
     * @dev Ensures the caller is the contract owner
     * @notice Reverts if called by any account other than the owner
     */
    function enforceIsContractOwner() internal view {
        if (msg.sender != diamondStorage().contractOwner)
            revert NotContractOwner();
    }

    // Diamond cut action values
    uint8 internal constant ADD = 0;
    uint8 internal constant REPLACE = 1;
    uint8 internal constant REMOVE = 2;

    /**
     * @dev Adds/replaces/removes multiple functions and facets
     * @param _diamondCut Array of FacetCut structs containing cut data
     * @param _init Address of the contract to execute _calldata
     * @param _calldata Function call data to execute on _init contract
     */
    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        // Validate inputs first
        if (_diamondCut.length == 0) revert NoSelectorsGivenToAdd();

        for (uint256 i; i < _diamondCut.length; i++) {
            IDiamondCut.FacetCut memory cut = _diamondCut[i];
            if (cut.functionSelectors.length == 0)
                revert NoSelectorsProvidedForFacetForCut();

            if (cut.action == IDiamondCut.FacetCutAction.Add) {
                if (cut.facetAddress == address(0))
                    revert CannotAddSelectorsToZeroAddress();
                addFunctions(cut.facetAddress, cut.functionSelectors);
            } else if (cut.action == IDiamondCut.FacetCutAction.Replace) {
                if (cut.facetAddress == address(0))
                    revert CannotReplaceFunctionsFromFacetWithZeroAddress();
                replaceFunctions(cut.facetAddress, cut.functionSelectors);
            } else if (cut.action == IDiamondCut.FacetCutAction.Remove) {
                if (cut.facetAddress != address(0))
                    revert RemoveFacetAddressMustBeZeroAddress();
                removeFunctions(cut.facetAddress, cut.functionSelectors);
            } else {
                revert InvalidFacetCutAction();
            }
        }

        emit DiamondCut(_diamondCut, _init, _calldata);

        initializeDiamondCut(_init, _calldata);
    }

    /**
     * @dev Adds new functions to the diamond
     * @param _facetAddress Address of the facet containing functions
     * @param _selectors Array of function selectors to add
     */
    function addFunctions(
        address _facetAddress,
        bytes4[] memory _selectors
    ) internal {
        if (_selectors.length == 0) revert NoSelectorsGivenToAdd();
        if (_facetAddress == address(0))
            revert CannotAddSelectorsToZeroAddress();

        DiamondStorage storage ds = diamondStorage();
        uint96 selectorPosition = uint96(
            ds.facetFunctionSelectors[_facetAddress].functionSelectors.length
        );

        // Add new facet address if it does not exist
        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }

        for (uint256 i; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            if (
                ds.selectorToFacetAndPosition[selector].facetAddress !=
                address(0)
            ) revert CannotAddFunctionToDiamondThatAlreadyExists();

            addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    /**
     * @dev Replaces functions with new implementations
     * @param _facetAddress Address of the facet containing new implementations
     * @param _selectors Array of function selectors to replace
     */
    function replaceFunctions(
        address _facetAddress,
        bytes4[] memory _selectors
    ) internal {
        if (_selectors.length == 0) revert NoSelectorsProvidedForFacetForCut();
        if (_facetAddress == address(0))
            revert CannotReplaceFunctionsFromFacetWithZeroAddress();

        DiamondStorage storage ds = diamondStorage();
        uint96 selectorPosition = uint96(
            ds.facetFunctionSelectors[_facetAddress].functionSelectors.length
        );

        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }

        for (uint256 i; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            address oldFacetAddress = ds
                .selectorToFacetAndPosition[selector]
                .facetAddress;
            if (oldFacetAddress == address(0))
                revert CannotReplaceFunctionThatDoesNotExists();

            removeFunction(ds, oldFacetAddress, selector);
            addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    /**
     * @dev Removes functions from the diamond
     * @param _facetAddress Must be zero address
     * @param _selectors Array of function selectors to remove
     */
    function removeFunctions(
        address _facetAddress,
        bytes4[] memory _selectors
    ) internal {
        if (_selectors.length == 0) revert NoSelectorsProvidedForFacetForCut();
        if (_facetAddress != address(0))
            revert RemoveFacetAddressMustBeZeroAddress();

        DiamondStorage storage ds = diamondStorage();

        for (uint256 i; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            address oldFacetAddress = ds
                .selectorToFacetAndPosition[selector]
                .facetAddress;
            if (oldFacetAddress == address(0))
                revert CannotRemoveFunctionThatDoesNotExist();

            removeFunction(ds, oldFacetAddress, selector);
        }
    }

    /**
     * @dev Internal function to add a new facet
     * @param ds Diamond storage pointer
     * @param _facetAddress Address of the facet to add
     */
    function addFacet(
        DiamondStorage storage ds,
        address _facetAddress
    ) internal {
        enforceHasContractCode(_facetAddress);
        ds.facetFunctionSelectors[_facetAddress].facetAddressPosition = ds
            .facetAddresses
            .length;
        ds.facetAddresses.push(_facetAddress);
    }

    /**
     * @dev Internal function to add a function to a facet
     * @param ds Diamond storage pointer
     * @param _selector Function selector to add
     * @param _selectorPosition Position in the selectors array
     * @param _facetAddress Address of the facet
     */
    function addFunction(
        DiamondStorage storage ds,
        bytes4 _selector,
        uint96 _selectorPosition,
        address _facetAddress
    ) internal {
        ds.selectorToFacetAndPosition[_selector] = FacetAddressAndPosition(
            _facetAddress,
            _selectorPosition
        );
        ds.facetFunctionSelectors[_facetAddress].functionSelectors.push(
            _selector
        );
    }

    /**
     * @dev Internal function to remove a function from a facet
     * @param ds Diamond storage pointer
     * @param _facetAddress Address of the facet
     * @param _selector Function selector to remove
     */
    function removeFunction(
        DiamondStorage storage ds,
        address _facetAddress,
        bytes4 _selector
    ) internal {
        // Get index of selector in function selectors array
        uint256 selectorPosition = ds
            .selectorToFacetAndPosition[_selector]
            .functionSelectorPosition;
        uint256 lastSelectorPosition = ds
            .facetFunctionSelectors[_facetAddress]
            .functionSelectors
            .length - 1;

        // Replace selector with last selector and delete last selector
        if (selectorPosition != lastSelectorPosition) {
            bytes4 lastSelector = ds
                .facetFunctionSelectors[_facetAddress]
                .functionSelectors[lastSelectorPosition];
            ds.facetFunctionSelectors[_facetAddress].functionSelectors[
                selectorPosition
            ] = lastSelector;
            ds
                .selectorToFacetAndPosition[lastSelector]
                .functionSelectorPosition = uint96(selectorPosition);
        }

        // Delete last selector
        ds.facetFunctionSelectors[_facetAddress].functionSelectors.pop();
        delete ds.selectorToFacetAndPosition[_selector];
    }

    /**
     * @dev Ensures the target address contains contract code
     * @param _contract Address to check for code
     */
    function enforceHasContractCode(address _contract) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        if (contractSize == 0) revert NoBytecodeAtAddress();
    }

    /**
     * @dev Initializes the diamond cut if initialization parameters are provided
     * @param _init Address of initialization contract
     * @param _calldata Initialization function call data
     */
    function initializeDiamondCut(
        address _init,
        bytes memory _calldata
    ) internal {
        if (_init == address(0)) {
            return;
        }
        enforceHasContractCode(_init);
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) {
            if (error.length > 0) {
                // bubble up the error
                revert InitializationFunctionReverted();
            }
            revert InitializationFunctionReverted();
        }
    }

    // Events
    event DiamondCut(
        IDiamondCut.FacetCut[] _diamondCut,
        address _init,
        bytes _calldata
    );
}
