# NFT Marketplace with Diamond Standard (EIP-2535)

> **⚠️ DISCLAIMER: LEARNING PURPOSE ONLY**  
> This project is intended for educational purposes and should not be used in production without thorough security audits and proper testing. While it implements best practices and security measures, it serves primarily as a learning resource for understanding NFT marketplace development and the Diamond Standard (EIP-2535).

A robust, upgradeable NFT marketplace built using the Diamond Standard (EIP-2535), enabling modular functionality and gas-efficient upgrades. The marketplace supports ERC-721 NFTs with ERC-20 token payments.

## Features

- 💎 **Diamond Standard Implementation**: Fully compliant with EIP-2535
- 🔄 **Upgradeable Architecture**: Add/remove/replace functionality without disrupting existing features
- 💰 **Flexible Payments**: Configurable ERC-20 token for marketplace transactions
- 🏷️ **Fee Management**: Adjustable marketplace fees with dedicated recipient
- 📊 **Statistics Tracking**: Track seller and buyer activities
- 🔒 **Security Features**: Reentrancy protection and ownership controls
- ⚡ **Gas Optimized**: Efficient storage layout and operation batching

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Smart Contract Architecture](#smart-contract-architecture)
  - [Diamond Standard](#diamond-standard)
  - [Facets](#facets)
  - [Libraries](#libraries)
- [Deployment Guide](#deployment-guide)
- [Testing](#testing)
- [Scripts](#scripts)
- [Development and Contribution](#development-and-contribution)

## Overview

The NFT Marketplace allows users to:

- **List** ERC-721 NFTs for sale at a specified price (in wei).
- **Buy** NFTs using an ERC-20 payment token.
- **Remove** NFT listings if the seller decides to delist.

The marketplace is built using the Diamond Standard (EIP-2535), which means it is composed of modular "facets," each implementing specific functionality. This architecture enables smooth upgrades and maintenance without disrupting existing data or functionality.

## Project Structure

The project is organized as follows:

```plaintext
NFTMarketplace/
├── contracts/
│   ├── diamond/
│   │   ├── Diamond.sol                       # Core diamond contract implementing EIP-2535
│   │   ├── facets/
│   │   │   ├── AdminFacet.sol                # Admin functions, including payment token management
│   │   │   ├── ListingFacet.sol              # NFT listing functionality
│   │   │   ├── PurchaseFacet.sol             # NFT buying functionality
│   │   │   └── RemoveListingFacet.sol        # NFT listing removal functionality
│   │   ├── interfaces/
│   │   │   └── IDiamondCut.sol               # DiamondCut interface for EIP-2535 compliance
│   │   │   └── IMarketplace.sol              # Marketplace interface
│   │   └── libraries/
│   │       ├── LibDiamond.sol                # Diamond Standard library for core functions
│   │       ├── LibMarketplace.sol            # Marketplace storage and helpers
│   └── test/
│       ├── Marketplace.test.js               # Main tests for NFT Marketplace
│       ├── DiamondCut.test.js                # DiamondCut and upgrades testing
│       └── helpers/
│           └── deployDiamond.js              # Helper to deploy diamond with facets
├── scripts/
│   ├── deploy.js                             # Script to deploy marketplace on multiple networks
├── test/
│   ├── helpers/
│       └── testHelpers.js                    # Helper functions for testing
│   ├── AdminFacet.test.js                    # Tests for AdminFacet
│   ├── ListingFacet.test.js                  # Tests for ListingFacet
│   └── Marketplace.test.js                   # Main tests for NFT Marketplace
│   ├── PurchaseFacet.test.js                 # Tests for PurchaseFacet
│   ├── RemoveListingFacet.test.js            # Tests for RemoveListingFacet
└── README.md                                 # Project documentation
└── hardhat.config.js                         # Hardhat configuration
```

### Key Directories

- **contracts/diamond**: Contains the core diamond contract, facets for different marketplace functionalities, and libraries.
- **scripts/**: Deployment and setup scripts for configuring the marketplace on different networks.
- **test/**: Comprehensive tests for each facet and the diamond standard implementation.

## Smart Contract Architecture

### Diamond Standard

The **Diamond Standard** (EIP-2535) allows multiple contracts, called "facets," to be added, replaced, or removed in a single contract called a "diamond." This makes our contract upgradable and highly modular.

The `Diamond.sol` contract implements the fallback function, which dynamically delegates function calls to the appropriate facet based on the function selector.

### Facets

The marketplace implements the following facets:

1. **DiamondCutFacet**: Core facet for diamond standard operations

   - Adding new facets
   - Replacing existing facets
   - Removing facets
   - Emitting DiamondCut events

2. **AdminFacet**: Administrative functionality

   - Payment token configuration
   - Fee management
   - Fee recipient management
   - Access control

3. **ListingFacet**: NFT listing management

   - Create listings
   - Price setting
   - NFT transfers
   - Listing state management

4. **PurchaseFacet**: Purchase functionality

   - Buy NFTs
   - Handle payments
   - Distribute fees
   - Transfer NFTs

5. **RemoveListingFacet**: Listing removal
   - Remove active listings
   - Return NFTs to sellers
   - Update listing states

### Libraries

- **LibDiamond.sol**: Contains core storage and helper functions required by the Diamond Standard.
- **LibMarketplace.sol**: Manages the marketplace’s storage and includes helpers for payment token configuration and listings.

## Deployment Guide

### Prerequisites

1. **Node.js** (>= 20.x.x) and **npm**
2. **Dependencies**: Install project dependencies:
   ```bash
   npm install
   ```

### Hardhat Configuration

```javascript
module.exports = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    localhost: {
      url: process.env.LOCALHOST_RPC_URL,
    },
    testnet: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.SEPOLIA_PRIVATE_KEY],
    },
    mainnet: {
      chainId: process.env.MAINNET_CHAIN_ID,
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    coverage: './coverage',
    artifacts: './artifacts',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
  },
};
```

### Deploying the Contracts

1. **Localhost**:

   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

2. **Testnet (Sepolia)**:

   ```bash
   npx hardhat run scripts/deploy.js --network testnet
   ```

3. **Mainnet (Polygon)**:
   ```bash
   npx hardhat run scripts/deploy.js --network mainnet
   ```

## Testing

Run tests to verify each part of the marketplace using the Hardhat framework:

```bash
npm run test
```

### Testing Structure

1. **DiamondCut.test.js**: Tests for diamond upgrades and facet management, including:

   - Adding new facets
   - Replacing existing facet functions
   - Removing facet functions
   - Diamond loupe functionality
   - Access control verification
   - Invalid operation handling

2. **AdminFacet.test.js**: Tests for administrative functions:

   - Payment token management
   - Fee management
   - Fee recipient management
   - Access control verification

3. **ListingFacet.test.js**: Tests for NFT listing functionality:

   - NFT listing creation
   - Price validation
   - Ownership verification
   - Approval checks

4. **PurchaseFacet.test.js**: Tests for NFT purchase operations:

   - NFT buying process
   - Payment handling
   - Fee distribution
   - Token transfers

5. **RemoveListingFacet.test.js**: Tests for listing removal:
   - Listing removal by seller
   - NFT return process
   - State updates

## Scripts

- **deploy.js**: Deploys the diamond and facets on specified networks.

```bash
npx hardhat run scripts/deploy.js --network testnet
```

## Contribution

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on development and contribution.

### Security Considerations

Check the [SECURITY.md](SECURITY.md) file for more information.

### Additional Resources

- **[EIP-2535: Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)**: For more information on the Diamond Standard.
- **OpenZeppelin**: Utilized for ERC-20 and ERC-721 interfaces and libraries.
