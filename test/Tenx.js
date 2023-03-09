const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { 
    shareHolderPercant, 
    referalPercantage, 
    months, 
    pricing 
} = require("../helper/arguments");
  
  describe.only("TenX", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployTenxFixture() {

      // Contracts are deployed using the first signer/account by default
      const [owner, holder1, holder2, holder3, holder4, reinvest] = await ethers.getSigners();
      const shareHolderWallets = [holder1.address, holder2.address, holder3.address, holder4.address]

      const Tenx = await ethers.getContractFactory("TenX");
      const tenX = await Tenx.deploy(
            shareHolderWallets,
            shareHolderPercant,
            reinvest.address,
            referalPercantage.length,
            referalPercantage,
            months,
            pricing
        );
    

      const Busd = await ethers.getContractFactory("BUSD");
      const busd = await Busd.deploy();
  
      return { tenX, busd, shareHolderWallets, owner, reinvest };
    }
  
    describe("Deployment", function () {

      it("Should set the right owner for TenX", async function () {
        const { tenX, owner } = await loadFixture(deployTenxFixture);
        expect(await tenX.owner()).to.equal(owner.address);
      });
  
      it("Should return token symbol for custom Busd Token", async function () {
        const { busd } = await loadFixture(
          deployTenxFixture
        );

        expect(await busd.symbol()).to.equal('BUSD')

      });

    });
  
  });
