const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployTestTokens, deployDiamond } = require('./helpers/testHelpers');

describe('AdminFacet', function () {
  let diamond;
  let adminFacet;
  let paymentToken;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy test tokens
    const tokenResult = await deployTestTokens();
    paymentToken = tokenResult.paymentToken;

    // Deploy contracts
    const deployResult = await deployDiamond();
    diamond = deployResult.diamond;
    adminFacet = await ethers.getContractAt('AdminFacet', await diamond.getAddress());
  });

  describe('Payment Token Management', function () {
    it('Should set payment token', async function () {
      const paymentTokenAddress = await paymentToken.getAddress();
      await adminFacet.setPaymentToken(paymentTokenAddress);
      expect(await adminFacet.getPaymentToken()).to.equal(paymentTokenAddress);
    });

    it('Should revert when non-owner tries to set payment token', async function () {
      const paymentTokenAddress = await paymentToken.getAddress();
      await expect(
        adminFacet.connect(addr1).setPaymentToken(paymentTokenAddress),
      ).to.be.revertedWithCustomError(adminFacet, 'NotOwner');
    });

    it('Should revert when setting zero address as payment token', async function () {
      await expect(adminFacet.setPaymentToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        adminFacet,
        'InvalidPaymentToken',
      );
    });
  });

  describe('Fee Management', function () {
    it('Should set marketplace fee', async function () {
      const fee = 250n; // 2.5%
      await adminFacet.setMarketplaceFee(fee);
      expect(await adminFacet.getMarketplaceFee()).to.equal(fee);
    });

    it('Should revert when fee exceeds 10%', async function () {
      const invalidFee = 1001n; // 10.01%
      await expect(adminFacet.setMarketplaceFee(invalidFee)).to.be.revertedWithCustomError(
        adminFacet,
        'FeeExceedsMaximum',
      );
    });

    it('Should emit FeeUpdated event', async function () {
      const newFee = 300n; // 3%
      await expect(adminFacet.setMarketplaceFee(newFee))
        .to.emit(adminFacet, 'MarketplaceFeeUpdated')
        .withArgs(0n, newFee); // Assuming initial fee is 0
    });
  });

  describe('Fee Recipient Management', function () {
    it('Should set fee recipient', async function () {
      await adminFacet.setFeeRecipient(addr1.address);
      expect(await adminFacet.getFeeRecipient()).to.equal(addr1.address);
    });

    it('Should revert when setting zero address as fee recipient', async function () {
      await expect(adminFacet.setFeeRecipient(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        adminFacet,
        'InvalidFeeRecipient',
      );
    });

    it('Should emit FeeRecipientUpdated event', async function () {
      const oldRecipient = await adminFacet.getFeeRecipient();
      await expect(adminFacet.setFeeRecipient(addr1.address))
        .to.emit(adminFacet, 'FeeRecipientUpdated')
        .withArgs(oldRecipient, addr1.address);
    });
  });

  describe('Access Control', function () {
    it('Should confirm owner has correct permissions', async function () {
      expect(await adminFacet.owner()).to.equal(owner.address);
    });

    it('Should prevent non-owner from accessing admin functions', async function () {
      await expect(adminFacet.connect(addr1).setMarketplaceFee(250n)).to.be.revertedWithCustomError(
        adminFacet,
        'NotOwner',
      );

      await expect(
        adminFacet.connect(addr1).setFeeRecipient(addr2.address),
      ).to.be.revertedWithCustomError(adminFacet, 'NotOwner');
    });
  });
});
