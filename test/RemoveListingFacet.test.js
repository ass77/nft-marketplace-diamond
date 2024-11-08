const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployTestTokens, deployDiamond } = require('./helpers/testHelpers');

describe('RemoveListingFacet', function () {
  let diamond;
  let listingFacet;
  let removeFacet;
  let purchaseFacet;
  let mockNFT;
  let seller;
  let buyer;
  let tokenIds;

  const LISTING_PRICE = ethers.parseEther('1');
  const MAX_BULK_REMOVALS = 20;

  beforeEach(async function () {
    [, seller, buyer] = await ethers.getSigners();

    // Deploy contracts
    const deployment = await deployDiamond();
    diamond = deployment.diamond;
    const diamondAddress = await diamond.getAddress();

    listingFacet = await ethers.getContractAt('ListingFacet', diamondAddress);
    removeFacet = await ethers.getContractAt('RemoveListingFacet', diamondAddress);
    purchaseFacet = await ethers.getContractAt('PurchaseFacet', diamondAddress);

    // Deploy test tokens
    const { mockNFT: nft } = await deployTestTokens();
    mockNFT = nft;
    const mockNFTAddress = await mockNFT.getAddress();

    // Mint and list multiple NFTs
    tokenIds = [];
    for (let i = 0; i < 3; i++) {
      const tokenId = await mockNFT.connect(seller).mint(seller.address);
      tokenIds.push(tokenId);
    }
    await mockNFT.connect(seller).setApprovalForAll(diamondAddress, true);

    // List all NFTs
    for (const tokenId of tokenIds) {
      await listingFacet.connect(seller).listNFT(mockNFTAddress, tokenId, LISTING_PRICE);
    }
  });

  describe('Remove Single Listing', function () {
    it('Should successfully remove a single listing', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await expect(removeFacet.connect(seller).removeListing(mockNFTAddress, tokenIds[0]))
        .to.emit(removeFacet, 'ListingRemoved')
        .withArgs(seller.address, mockNFTAddress, tokenIds[0]);

      // Verify listing is removed
      const listing = await purchaseFacet.getListing(mockNFTAddress, tokenIds[0]);
      expect(listing.active).to.be.false;
    });

    it('Should revert when non-seller tries to remove listing', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await expect(
        removeFacet.connect(buyer).removeListing(mockNFTAddress, tokenIds[0]),
      ).to.be.revertedWithCustomError(removeFacet, 'NotSeller');
    });

    it('Should revert when removing non-existent listing', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const nonExistentTokenId = 999n;
      await expect(
        removeFacet.connect(seller).removeListing(mockNFTAddress, nonExistentTokenId),
      ).to.be.revertedWithCustomError(removeFacet, 'ListingNotActive');
    });

    it('Should revert when removing already removed listing', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await removeFacet.connect(seller).removeListing(mockNFTAddress, tokenIds[0]);

      await expect(
        removeFacet.connect(seller).removeListing(mockNFTAddress, tokenIds[0]),
      ).to.be.revertedWithCustomError(removeFacet, 'ListingNotActive');
    });
  });

  describe('Bulk Remove Listings', function () {
    it('Should successfully remove multiple listings', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const nftAddresses = Array(tokenIds.length).fill(mockNFTAddress);

      await expect(removeFacet.connect(seller).bulkRemoveListing(nftAddresses, tokenIds))
        .to.emit(removeFacet, 'ListingRemoved')
        .withArgs(seller.address, mockNFTAddress, tokenIds[0])
        .to.emit(removeFacet, 'ListingRemoved')
        .withArgs(seller.address, mockNFTAddress, tokenIds[1])
        .to.emit(removeFacet, 'ListingRemoved')
        .withArgs(seller.address, mockNFTAddress, tokenIds[2]);

      // Verify all listings are removed
      for (const tokenId of tokenIds) {
        const listing = await purchaseFacet.getListing(mockNFTAddress, tokenId);
        expect(listing.active).to.be.false;
      }
    });

    it('Should revert when arrays have different lengths', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const nftAddresses = Array(tokenIds.length + 1).fill(mockNFTAddress);

      await expect(
        removeFacet.connect(seller).bulkRemoveListing(nftAddresses, tokenIds),
      ).to.be.revertedWithCustomError(removeFacet, 'ArrayLengthMismatch');
    });

    it('Should revert when exceeding max bulk removal limit', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const exceedingTokenIds = Array(MAX_BULK_REMOVALS + 1)
        .fill(0)
        .map((_, i) => BigInt(i));
      const nftAddresses = Array(exceedingTokenIds.length).fill(mockNFTAddress);

      await expect(
        removeFacet.connect(seller).bulkRemoveListing(nftAddresses, exceedingTokenIds),
      ).to.be.revertedWithCustomError(removeFacet, 'MaxBulkLimitExceeded');
    });

    it('Should handle empty arrays', async function () {
      await expect(
        removeFacet.connect(seller).bulkRemoveListing([], []),
      ).to.be.revertedWithCustomError(removeFacet, 'EmptyArrays');
    });
  });

  describe('Post-Removal Verification', function () {
    it('Should prevent purchase of removed listing', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await removeFacet.connect(seller).removeListing(mockNFTAddress, tokenIds[0]);

      await expect(
        purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenIds[0]),
      ).to.be.revertedWithCustomError(purchaseFacet, 'ListingNotActive');
    });

    it('Should allow relisting of removed NFT', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await removeFacet.connect(seller).removeListing(mockNFTAddress, tokenIds[0]);

      await expect(listingFacet.connect(seller).listNFT(mockNFTAddress, tokenIds[0], LISTING_PRICE))
        .to.emit(listingFacet, 'NFTListed')
        .withArgs(seller.address, mockNFTAddress, tokenIds[0], LISTING_PRICE);

      const listing = await purchaseFacet.getListing(mockNFTAddress, tokenIds[0]);
      expect(listing.active).to.be.true;
    });
  });
});
