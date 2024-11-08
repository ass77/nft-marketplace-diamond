const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployTestTokens, deployDiamond } = require('./helpers/testHelpers');

describe('PurchaseFacet', function () {
  let diamond;
  let adminFacet;
  let listingFacet;
  let purchaseFacet;
  let mockNFT;
  let paymentToken;
  let seller;
  let buyer;
  let feeRecipient;
  let tokenId;

  const LISTING_PRICE = ethers.parseEther('1');
  const MARKETPLACE_FEE = 250n; // 2.5%

  beforeEach(async function () {
    [, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy contracts
    const deployment = await deployDiamond();
    diamond = deployment.diamond;
    const diamondAddress = await diamond.getAddress();

    adminFacet = await ethers.getContractAt('AdminFacet', diamondAddress);
    listingFacet = await ethers.getContractAt('ListingFacet', diamondAddress);
    purchaseFacet = await ethers.getContractAt('PurchaseFacet', diamondAddress);

    // Deploy and setup tokens
    const tokens = await deployTestTokens();
    paymentToken = tokens.paymentToken;
    mockNFT = tokens.mockNFT;

    // Setup marketplace
    await adminFacet.setPaymentToken(await paymentToken.getAddress());
    await adminFacet.setMarketplaceFee(MARKETPLACE_FEE);
    await adminFacet.setFeeRecipient(feeRecipient.address);

    // Setup NFT and listing
    tokenId = await mockNFT.connect(seller).mint(seller.address);
    await mockNFT.connect(seller).setApprovalForAll(diamondAddress, true);
    await listingFacet.connect(seller).listNFT(await mockNFT.getAddress(), tokenId, LISTING_PRICE);

    // Setup payment token balances and approvals
    await paymentToken.transfer(buyer.address, ethers.parseEther('10'));
    await paymentToken.connect(buyer).approve(diamondAddress, ethers.MaxUint256);
  });

  describe('NFT Purchase', function () {
    it('Should successfully purchase NFT', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const buyerBalanceBefore = await paymentToken.balanceOf(buyer.address);
      const sellerBalanceBefore = await paymentToken.balanceOf(seller.address);
      const feeRecipientBalanceBefore = await paymentToken.balanceOf(feeRecipient.address);

      await expect(purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenId))
        .to.emit(purchaseFacet, 'NFTPurchased')
        .withArgs(buyer.address, seller.address, mockNFTAddress, tokenId, LISTING_PRICE);

      // Verify NFT ownership
      expect(await mockNFT.ownerOf(tokenId)).to.equal(buyer.address);

      // Verify payment distributions
      const fee = (LISTING_PRICE * MARKETPLACE_FEE) / 10000n;
      const sellerAmount = LISTING_PRICE - fee;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(
        buyerBalanceBefore - LISTING_PRICE,
      );
      expect(await paymentToken.balanceOf(seller.address)).to.equal(
        sellerBalanceBefore + sellerAmount,
      );
      expect(await paymentToken.balanceOf(feeRecipient.address)).to.equal(
        feeRecipientBalanceBefore + fee,
      );
    });

    it('Should revert when buying non-existent listing', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const nonExistentTokenId = 999n;
      await expect(
        purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, nonExistentTokenId),
      ).to.be.revertedWithCustomError(purchaseFacet, 'ListingNotActive');
    });

    it('Should revert when buying own NFT', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await expect(
        purchaseFacet.connect(seller).purchaseNFT(mockNFTAddress, tokenId),
      ).to.be.revertedWithCustomError(purchaseFacet, 'CannotBuyOwnNFT');
    });

    it('Should revert when buyer has insufficient balance', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      const poorBuyer = (await ethers.getSigners())[4];
      await paymentToken.connect(poorBuyer).approve(await diamond.getAddress(), ethers.MaxUint256);

      await expect(
        purchaseFacet.connect(poorBuyer).purchaseNFT(mockNFTAddress, tokenId),
      ).to.be.revertedWithCustomError(purchaseFacet, 'InvalidPaymentAmount');
    });

    it('Should handle multiple purchases correctly', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      // Create and list second NFT
      const tokenId2 = await mockNFT.connect(seller).mint(seller.address);
      await listingFacet.connect(seller).listNFT(mockNFTAddress, tokenId2, LISTING_PRICE);

      // Purchase both NFTs
      await purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenId);
      await purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenId2);

      expect(await mockNFT.ownerOf(tokenId)).to.equal(buyer.address);
      expect(await mockNFT.ownerOf(tokenId2)).to.equal(buyer.address);
    });

    it('Should update buyer and seller statistics', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      await purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenId);

      const buyerStats = await purchaseFacet.getUserStats(buyer.address);
      const sellerStats = await purchaseFacet.getUserStats(seller.address);

      expect(buyerStats.totalPurchases).to.equal(LISTING_PRICE);
      expect(sellerStats.totalSales).to.equal(LISTING_PRICE);
    });

    it('Should handle failed transfers gracefully', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      // Revoke approval to simulate failed transfer
      await mockNFT.connect(seller).setApprovalForAll(await diamond.getAddress(), false);

      await expect(
        purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenId),
      ).to.be.revertedWithCustomError(purchaseFacet, 'NFTTransferFailed');
    });

    it('Should verify payment token approval', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      // Revoke payment token approval
      await paymentToken.connect(buyer).approve(await diamond.getAddress(), 0);

      await expect(
        purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenId),
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });
  });

  describe('Purchase Validation', function () {
    it('Should validate NFT contract address', async function () {
      await expect(
        purchaseFacet.connect(buyer).purchaseNFT(ethers.ZeroAddress, tokenId),
      ).to.be.revertedWithCustomError(purchaseFacet, 'InvalidNFTContract');
    });

    it('Should validate listing exists', async function () {
      const mockNFTAddress = await mockNFT.getAddress();
      // Remove listing first
      await listingFacet.connect(seller).removeListing(mockNFTAddress, tokenId);

      await expect(
        purchaseFacet.connect(buyer).purchaseNFT(mockNFTAddress, tokenId),
      ).to.be.revertedWithCustomError(purchaseFacet, 'ListingNotActive');
    });
  });
});
