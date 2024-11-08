const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployDiamond, getSelectors } = require('./helpers/testHelpers');

describe('DiamondCut', function () {
  let diamond;
  let diamondCutFacet;
  let addr1;
  let newFacet;

  beforeEach(async function () {
    [addr1] = await ethers.getSigners();

    // Deploy the diamond with initial facets
    const deployment = await deployDiamond();
    diamond = deployment.diamond;
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', await diamond.getAddress());
  });

  describe('Diamond Cut Operations', function () {
    it('Should add a new facet', async function () {
      // Deploy a new test facet
      const TestFacet = await ethers.getContractFactory('TestFacet');
      newFacet = await TestFacet.deploy();
      await newFacet.waitForDeployment();
      const newFacetAddress = await newFacet.getAddress();

      // Prepare the cut data
      const selectors = getSelectors(newFacet);
      const cut = [
        {
          facetAddress: newFacetAddress,
          action: 0, // Add = 0
          functionSelectors: selectors,
        },
      ];

      // Execute the cut
      await expect(diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, '0x'))
        .to.emit(diamond, 'DiamondCut')
        .withArgs(cut, ethers.ZeroAddress, '0x');

      // Verify the facet was added
      const testFacet = await ethers.getContractAt('TestFacet', await diamond.getAddress());
      expect(await testFacet.testFunction()).to.equal(true);
    });

    it('Should replace a facet function', async function () {
      // Deploy a new version of an existing facet
      const NewAdminFacet = await ethers.getContractFactory('AdminFacet');
      const newAdminFacet = await NewAdminFacet.deploy();
      await newAdminFacet.waitForDeployment();
      const newAdminAddress = await newAdminFacet.getAddress();

      // Get the function selector to replace
      const functionSelector = newAdminFacet.interface.getSighash('setPaymentToken(address)');

      const cut = [
        {
          facetAddress: newAdminAddress,
          action: 1, // Replace = 1
          functionSelectors: [functionSelector],
        },
      ];

      await expect(diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, '0x'))
        .to.emit(diamond, 'DiamondCut')
        .withArgs(cut, ethers.ZeroAddress, '0x');
    });

    it('Should remove a facet function', async function () {
      const AdminFacet = await ethers.getContractFactory('AdminFacet');
      const functionSelector = AdminFacet.interface.getSighash('setPaymentToken(address)');

      const cut = [
        {
          facetAddress: ethers.ZeroAddress,
          action: 2, // Remove = 2
          functionSelectors: [functionSelector],
        },
      ];

      await expect(diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, '0x'))
        .to.emit(diamond, 'DiamondCut')
        .withArgs(cut, ethers.ZeroAddress, '0x');

      // Verify the function is removed
      const adminFacet = await ethers.getContractAt('AdminFacet', await diamond.getAddress());
      await expect(adminFacet.setPaymentToken(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        diamond,
        'FunctionNotFound',
      );
    });

    it('Should revert when non-owner tries to cut', async function () {
      const cut = [
        {
          facetAddress: ethers.ZeroAddress,
          action: 2,
          functionSelectors: ['0x12345678'],
        },
      ];

      await expect(
        diamondCutFacet.connect(addr1).diamondCut(cut, ethers.ZeroAddress, '0x'),
      ).to.be.revertedWithCustomError(diamondCutFacet, 'NotContractOwner');
    });

    it('Should revert with invalid facet cut action', async function () {
      const cut = [
        {
          facetAddress: ethers.ZeroAddress,
          action: 3, // Invalid action (only 0,1,2 are valid)
          functionSelectors: ['0x12345678'],
        },
      ];

      await expect(
        diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, '0x'),
      ).to.be.revertedWithCustomError(diamondCutFacet, 'InvalidFacetCutAction');
    });
  });

  describe('Diamond Loupe', function () {
    it('Should return all facet addresses', async function () {
      const facetAddresses = await diamond.facetAddresses();
      expect(facetAddresses.length).to.be.gt(0);
    });

    it('Should return all facet function selectors', async function () {
      const facetAddresses = await diamond.facetAddresses();
      for (const address of facetAddresses) {
        const selectors = await diamond.facetFunctionSelectors(address);
        expect(selectors.length).to.be.gt(0);
      }
    });

    it('Should return correct facet address for function selector', async function () {
      const adminFacet = await ethers.getContractAt('AdminFacet', await diamond.getAddress());
      const selector = adminFacet.interface.getFunction('setPaymentToken').selector;
      const facetAddress = await diamond.facetAddress(selector);
      expect(facetAddress).to.not.equal(ethers.ZeroAddress);
    });

    it('Should return zero address for non-existent function', async function () {
      const nonExistentSelector = '0x12345678';
      const facetAddress = await diamond.facetAddress(nonExistentSelector);
      expect(facetAddress).to.equal(ethers.ZeroAddress);
    });
  });

  describe('Diamond Storage', function () {
    it('Should maintain storage between upgrades', async function () {
      // Set initial value through admin facet
      const adminFacet = await ethers.getContractAt('AdminFacet', await diamond.getAddress());
      const initialFee = 250n;
      await adminFacet.setMarketplaceFee(initialFee);

      // Deploy new version of admin facet
      const NewAdminFacet = await ethers.getContractFactory('AdminFacet');
      const newAdminFacet = await NewAdminFacet.deploy();
      await newAdminFacet.waitForDeployment();
      const newAdminAddress = await newAdminFacet.getAddress();

      // Replace the facet
      const selector = newAdminFacet.interface.getSighash('getMarketplaceFee()');
      const cut = [
        {
          facetAddress: newAdminAddress,
          action: 1, // Replace
          functionSelectors: [selector],
        },
      ];

      await diamondCutFacet.diamondCut(cut, ethers.ZeroAddress, '0x');

      // Verify storage was maintained
      const upgradedAdminFacet = await ethers.getContractAt(
        'AdminFacet',
        await diamond.getAddress(),
      );
      expect(await upgradedAdminFacet.getMarketplaceFee()).to.equal(initialFee);
    });
  });
});
