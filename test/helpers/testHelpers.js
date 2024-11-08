const { ethers } = require('hardhat');
const { getSelectors } = require('../../scripts/helpers/getSelectors');

async function deployTestTokens() {
  const MockERC20 = await ethers.getContractFactory('MockERC20');
  const paymentToken = await MockERC20.deploy('Test Token', 'TEST');
  await paymentToken.waitForDeployment();

  const MockNFT = await ethers.getContractFactory('MockNFT');
  const mockNFT = await MockNFT.deploy('Test NFT', 'TNFT');
  await mockNFT.waitForDeployment();

  return { paymentToken, mockNFT };
}

async function deployDiamond() {
  const [contractOwner] = await ethers.getSigners();

  // Deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond');
  const diamond = await Diamond.deploy(contractOwner.address);
  await diamond.waitForDeployment();

  // Deploy facets
  const FacetNames = [
    'AdminFacet',
    'DiamondCutFacet',
    'ListingFacet',
    'PurchaseFacet',
    'RemoveListingFacet',
  ];

  const cut = [];
  const facets = {};

  for (const FacetName of FacetNames) {
    const Facet = await ethers.getContractFactory(FacetName);
    const facet = await Facet.deploy();
    await facet.waitForDeployment();

    // Store facet instance
    facets[FacetName.charAt(0).toLowerCase() + FacetName.slice(1)] = await ethers.getContractAt(
      FacetName,
      diamond.target,
    );

    cut.push({
      facetAddress: facet.target,
      action: 0, // Add
      functionSelectors: getSelectors(facet),
    });
  }

  return {
    diamond,
    diamondCutFacet: facets.diamondCutFacet,
    adminFacet: facets.adminFacet,
    listingFacet: facets.listingFacet,
    purchaseFacet: facets.purchaseFacet,
    removeListingFacet: facets.removeListingFacet,
  };
}

module.exports = {
  deployTestTokens,
  deployDiamond,
};
