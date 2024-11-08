const fs = require('fs');
const { ethers } = require('hardhat');
const { getSelectors } = require('./helpers/getSelectors');

async function deployTokens() {
  console.log('Deploying tokens...');

  // Deploy ERC20
  const MockERC20 = await ethers.getContractFactory('MockERC20');
  const paymentToken = await MockERC20.deploy('Mock Token', 'MOCK');
  await paymentToken.waitForDeployment();
  const paymentTokenAddress = await paymentToken.getAddress();
  console.log('Payment Token (ERC20) deployed to:', paymentTokenAddress);

  // Deploy NFT
  const MockNFT = await ethers.getContractFactory('MockNFT');
  const nftToken = await MockNFT.deploy('Test NFT', 'TNFT');
  await nftToken.waitForDeployment();
  const nftTokenAddress = await nftToken.getAddress();
  console.log('NFT Token (ERC721) deployed to:', nftTokenAddress);

  return { paymentToken: paymentTokenAddress, nftToken: nftTokenAddress };
}

async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log('Deploying contracts with account:', deployer.address);

    // Deploy Tokens first
    const tokens = await deployTokens();

    // Deploy Diamond
    console.log('Deploying Diamond...');
    const Diamond = await ethers.getContractFactory('Diamond');
    const diamond = await Diamond.deploy(deployer.address);
    await diamond.waitForDeployment();
    const diamondAddress = await diamond.getAddress();
    console.log('Diamond deployed to:', diamondAddress);

    // Deploy facets
    console.log('Deploying facets...');
    const facetNames = [
      'AdminFacet',
      'DiamondCutFacet',
      'ListingFacet',
      'PurchaseFacet',
      'RemoveListingFacet',
    ];
    const deployedFacets = [];

    for (const facetName of facetNames) {
      console.log(`Deploying ${facetName}...`);
      const Facet = await ethers.getContractFactory(facetName);
      const facet = await Facet.deploy();
      await facet.waitForDeployment();
      const facetAddress = await facet.getAddress();

      deployedFacets.push({
        name: facetName,
        address: facetAddress,
        contract: facet,
      });

      console.log(`${facetName} deployed to:`, facetAddress);
    }

    // Prepare diamond cut
    console.log('Preparing diamond cut...');
    const cut = [];

    for (const { contract, address } of deployedFacets) {
      cut.push({
        facetAddress: address,
        action: 0, // Add
        functionSelectors: getSelectors(contract),
      });
    }

    console.log('Cut:', cut);

    // Verify deployment
    const deployment = {
      diamond: diamondAddress,
      tokens: tokens,
      facets: deployedFacets.reduce((acc, { name, address }) => {
        acc[name] = address;
        return acc;
      }, {}),
    };

    console.log('Deployment completed successfully');
    // Save deployment addresses
    const deploymentPath = './deployments';
    if (!fs.existsSync(deploymentPath)) {
      fs.mkdirSync(deploymentPath);
    }

    fs.writeFileSync(`${deploymentPath}/deployment.json`, JSON.stringify(deployment, null, 2));

    console.log('Deployment addresses saved to deployments/deployment.json');

    // TODO: verify deployment on etherscan and verify facets
    return deployment;
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

// Execute deployment if script is run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Deployment error:', error);
      process.exit(1);
    });
}

module.exports = { main };
