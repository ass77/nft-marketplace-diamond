const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployTestTokens, deployDiamond } = require('./helpers/testHelpers');

describe('NFT Marketplace Integration', function () {
  let marketplace;
  let owner, seller, buyer, feeRecipient;
  const LISTING_PRICE = ethers.parseEther('1');

  beforeEach(async function () {
    [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy all contracts
    const contracts = await deployDiamond();
    const { paymentToken, mockNFT } = await deployTestTokens();

    marketplace = {
      ...contracts,
      paymentToken,
      mockNFT,
    };

    // Setup marketplace
    await marketplace.adminFacet.setPaymentToken(await paymentToken.getAddress());
    await marketplace.adminFacet.setMarketplaceFee(250); // 2.5%
    await marketplace.adminFacet.setFeeRecipient(feeRecipient.address);

    // Setup buyer
    await marketplace.paymentToken.transfer(buyer.address, ethers.parseEther('10'));
    await marketplace.paymentToken
      .connect(buyer)
      .approve(marketplace.diamond.getAddress(), ethers.MaxUint256);
  });

  describe('Full Marketplace Flow', function () {
    it('Should handle complete listing and purchase cycle', async function () {
      // Test listing
      const tokenId = await marketplace.mockNFT.connect(seller).mint(seller.address);
      await marketplace.mockNFT
        .connect(seller)
        .setApprovalForAll(marketplace.diamond.getAddress(), true);
      await marketplace.listingFacet
        .connect(seller)
        .listNFT(marketplace.mockNFT.address, tokenId, LISTING_PRICE);

      // Verify listing
      const listing = await marketplace.purchaseFacet.getListing(
        marketplace.mockNFT.address,
        tokenId,
      );
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(LISTING_PRICE);
      expect(listing.active).to.be.true;

      // Purchase NFT
      await marketplace.purchaseFacet
        .connect(buyer)
        .purchaseNFT(marketplace.mockNFT.address, tokenId);

      // Verify purchase
      expect(await marketplace.mockNFT.ownerOf(tokenId)).to.equal(buyer.address);

      // Verify listing is inactive
      const listingAfter = await marketplace.purchaseFacet.getListing(
        marketplace.mockNFT.address,
        tokenId,
      );
      expect(listingAfter.active).to.be.false;
    });

    it('Should handle pagination of listings correctly', async function () {
      // Create multiple listings
      const listings = [];
      for (let i = 0; i < 5; i++) {
        const tokenId = await marketplace.mockNFT.connect(seller).mint(seller.address);
        await marketplace.mockNFT
          .connect(seller)
          .setApprovalForAll(marketplace.diamond.getAddress(), true);
        await marketplace.listingFacet
          .connect(seller)
          .listNFT(marketplace.mockNFT.address, tokenId, LISTING_PRICE);
        listings.push(tokenId);
      }

      // Test pagination
      const pageSize = 3;
      const firstPage = await marketplace.listingFacet.getListings(0, pageSize);
      const secondPage = await marketplace.listingFacet.getListings(pageSize, pageSize);

      expect(firstPage.length).to.equal(pageSize);
      expect(secondPage.length).to.equal(2); // Remaining listings
    });

    it('Should track seller and buyer statistics correctly', async function () {
      // Create and purchase multiple listings
      for (let i = 0; i < 2; i++) {
        const tokenId = await marketplace.mockNFT.connect(seller).mint(seller.address);
        await marketplace.mockNFT
          .connect(seller)
          .setApprovalForAll(marketplace.diamond.getAddress(), true);
        await marketplace.listingFacet
          .connect(seller)
          .listNFT(marketplace.mockNFT.address, tokenId, LISTING_PRICE);
        await marketplace.purchaseFacet
          .connect(buyer)
          .purchaseNFT(marketplace.mockNFT.address, tokenId);
      }

      // Verify statistics
      const sellerStats = await marketplace.listingFacet.getUserStats(seller.address);
      const buyerStats = await marketplace.listingFacet.getUserStats(buyer.address);

      expect(sellerStats.totalSales).to.equal(LISTING_PRICE.mul(2));
      expect(buyerStats.totalPurchases).to.equal(LISTING_PRICE.mul(2));
    });

    it('Should handle seller listings retrieval', async function () {
      // Create multiple listings for the seller
      const tokenIds = [];
      for (let i = 0; i < 3; i++) {
        const tokenId = await marketplace.mockNFT.connect(seller).mint(seller.address);
        await marketplace.mockNFT
          .connect(seller)
          .setApprovalForAll(marketplace.diamond.getAddress(), true);
        await marketplace.listingFacet
          .connect(seller)
          .listNFT(marketplace.mockNFT.address, tokenId, LISTING_PRICE);
        tokenIds.push(tokenId);
      }

      // Get seller's listings
      const sellerListings = await marketplace.listingFacet.getSellerListings(seller.address);
      expect(sellerListings.length).to.equal(3);

      // Verify listing details
      for (let listing of sellerListings) {
        expect(listing.seller).to.equal(seller.address);
        expect(listing.price).to.equal(LISTING_PRICE);
        expect(listing.active).to.be.true;
      }
    });

    it('Should handle marketplace fees correctly', async function () {
      // Create and sell an NFT
      const tokenId = await marketplace.mockNFT.connect(seller).mint(seller.address);
      await marketplace.mockNFT
        .connect(seller)
        .setApprovalForAll(marketplace.diamond.getAddress(), true);
      await marketplace.listingFacet
        .connect(seller)
        .listNFT(marketplace.mockNFT.address, tokenId, LISTING_PRICE);

      // Get initial balances
      const initialFeeRecipientBalance = await marketplace.paymentToken.balanceOf(
        feeRecipient.address,
      );
      const initialSellerBalance = await marketplace.paymentToken.balanceOf(seller.address);

      // Purchase NFT
      await marketplace.purchaseFacet
        .connect(buyer)
        .purchaseNFT(marketplace.mockNFT.address, tokenId);

      // Calculate expected fee
      const expectedFee = LISTING_PRICE.mul(250).div(10000); // 2.5% fee
      const expectedSellerAmount = LISTING_PRICE.sub(expectedFee);

      // Verify balances
      const finalFeeRecipientBalance = await marketplace.paymentToken.balanceOf(
        feeRecipient.address,
      );
      const finalSellerBalance = await marketplace.paymentToken.balanceOf(seller.address);

      expect(finalFeeRecipientBalance.sub(initialFeeRecipientBalance)).to.equal(expectedFee);
      expect(finalSellerBalance.sub(initialSellerBalance)).to.equal(expectedSellerAmount);
    });

    it('Should validate listing ownership correctly', async function () {
      // Try to list an NFT not owned by the seller
      const tokenId = await marketplace.mockNFT.connect(owner).mint(owner.address);

      // Attempt to list someone else's NFT should fail
      await expect(
        marketplace.listingFacet
          .connect(seller)
          .listNFT(marketplace.mockNFT.address, tokenId, LISTING_PRICE),
      ).to.be.revertedWith('Not token owner');
    });
  });
});
