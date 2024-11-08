require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();
require('solidity-coverage');
require('hardhat-contract-sizer');

const dotenv = require('dotenv');
dotenv.config();

/** @type import('hardhat/config').HardhatUserConfig */
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
    hardhat: {
      chainId: 1337,
    },
    // testnet: {
    //   url: process.env.SEPOLIA_RPC_URL,
    //   accounts: [process.env.SEPOLIA_PRIVATE_KEY],
    // },
    // mainnet: {
    //   chainId: process.env.MAINNET_CHAIN_ID,
    //   url: process.env.MAINNET_RPC_URL,
    //   accounts: [process.env.MAINNET_PRIVATE_KEY],
    // },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
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
