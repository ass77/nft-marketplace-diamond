const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployTestTokens, deployDiamond } = require('./helpers/testHelpers');

describe('ListingFacet', function () {
  let diamond;
  let listingFacet;
  let adminFacet;
  let mockNFT;
  let paymentToken;
  let seller;
  let buyer;
  let tokenId;

  const LISTING_PRICE = ethers.parseEther('1');

  beforeEach(async function () {
    [, seller, buyer] = await ethers.getSigners();

    // Deploy contracts
    const deployment = await deployDiamond();
    diamond = deployment.diamond;
    const diamondAddress = await diamond.getAddress();

    listingFacet = await ethers.getContractAt('ListingFacet', diamondAddress);
    adminFacet = await ethers.getContractAt('AdminFacet', diamondAddress);

    // Deploy test tokens
    const tokens = await deployTestTokens();
    mockNFT = tokens.mockNFT;
    paymentToken = tokens.paymentToken;

    // Setup marketplace
    await adminFacet.setPaymentToken(await paymentToken.getAddress());
    await adminFacet.setMarketplaceFee(250n); // 2.5%

    // Mint NFT to seller
    tokenId = await mockNFT.connect(seller).mint(seller.address);
    await mockNFT.connect(seller).setApprovalForAll(diamondAddress, true);
  });

  describe('NFT Listing', function () {
    it('Should list NFT successfully', async function () {
      const mockNFTAddress = await mockNFT.getAddress();

      await expect(listingFacet.connect(seller).listNFT(mockNFTAddress, tokenId, LISTING_PRICE))
        .to.emit(listingFacet, 'NFTListed')
        .withArgs(seller.address, mockNFTAddress, tokenId, LISTING_PRICE);

      const listing = await listingFacet.getListing(mockNFTAddress, tokenId);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LISTING_PRICE);
      expect(listing.active).to.be.true;
    });

    it('Should revert when listing with zero price', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await expect(
        listingFacet.connect(seller).listNFT(mockNFTAddress, tokenId, 0n),
      ).to.be.revertedWithCustomError(listingFacet, 'ZeroPrice');
    });

    it('Should revert when listing without approval', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await mockNFT.connect(seller).setApprovalForAll(await diamond.getAddress(), false);

      await expect(
        listingFacet.connect(seller).listNFT(mockNFTAddress, tokenId, LISTING_PRICE),
      ).to.be.revertedWithCustomError(listingFacet, 'NFTNotApproved');
    });

    it('Should revert when non-owner tries to list', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await expect(
        listingFacet.connect(buyer).listNFT(mockNFTAddress, tokenId, LISTING_PRICE),
      ).to.be.revertedWithCustomError(listingFacet, 'NotTokenOwner');
    });
  });

  describe('Listing Management', function () {
    beforeEach(async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await listingFacet.connect(seller).listNFT(mockNFTAddress, tokenId, LISTING_PRICE);
    });

    it('Should get active listing correctly', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const listing = await listingFacet.getListing(mockNFTAddress, tokenId);

      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LISTING_PRICE);
      expect(listing.active).to.be.true;
    });

    it('Should update listing price', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const newPrice = ethers.parseEther('2');

      await expect(
        listingFacet.connect(seller).updateListingPrice(mockNFTAddress, tokenId, newPrice),
      )
        .to.emit(listingFacet, 'ListingPriceUpdated')
        .withArgs(mockNFTAddress, tokenId, LISTING_PRICE, newPrice);

      const listing = await listingFacet.getListing(mockNFTAddress, tokenId);
      expect(listing.price).to.equal(newPrice);
    });

    it('Should revert when non-seller tries to update price', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const newPrice = ethers.parseEther('2');

      await expect(
        listingFacet.connect(buyer).updateListingPrice(mockNFTAddress, tokenId, newPrice),
      ).to.be.revertedWithCustomError(listingFacet, 'NotSeller');
    });

    it('Should revert when updating inactive listing', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await listingFacet.connect(seller).removeListing(mockNFTAddress, tokenId);

      await expect(
        listingFacet.connect(seller).updateListingPrice(mockNFTAddress, tokenId, LISTING_PRICE),
      ).to.be.revertedWithCustomError(listingFacet, 'ListingNotActive');
    });
  });

  describe('Listing Queries', function () {
    beforeEach(async function () {
      // Create multiple listings
      for (let i = 0; i < 3; i++) {
        const newTokenId = await mockNFT.connect(seller).mint(seller.address);
        await mockNFT.connect(seller).setApprovalForAll(await diamond.getAddress(), true);
        await listingFacet
          .connect(seller)
          .listNFT(await mockNFT.getAddress(), newTokenId, LISTING_PRICE);
      }
    });

    it('Should get all active listings', async function () {
      const listings = await listingFacet.getActiveListings(0, 10);
      expect(listings.length).to.equal(3);

      for (const listing of listings) {
        expect(listing.active).to.be.true;
        expect(listing.price).to.equal(LISTING_PRICE);
        expect(listing.seller).to.equal(seller.address);
      }
    });

    it('Should handle pagination correctly', async function () {
      const pageSize = 2;
      const firstPage = await listingFacet.getActiveListings(0, pageSize);
      const secondPage = await listingFacet.getActiveListings(pageSize, pageSize);

      expect(firstPage.length).to.equal(pageSize);
      expect(secondPage.length).to.equal(1);
    });

    it('Should get seller listings', async function () {
      const sellerListings = await listingFacet.getSellerListings(seller.address);
      expect(sellerListings.length).to.equal(3);

      for (const listing of sellerListings) {
        expect(listing.seller).to.equal(seller.address);
        expect(listing.active).to.be.true;
      }
    });
  });
});
