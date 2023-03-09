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
const { ethers } = require("hardhat");

const nativePriceFeed = '0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada'
const busdPriceFeed = '0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0'
  
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

      it("Should fetch the referal levels for TenX", async function () {
        const { tenX } = await loadFixture(deployTenxFixture);
        expect(await tenX.referralLevels()).to.equal(referalPercantage.length);
      });

      it("Should return token symbol for custom Busd Token", async function () {
        const { busd } = await loadFixture(
          deployTenxFixture
        );

        expect(await busd.symbol()).to.equal('BUSD')

      });

    });

    describe("Payment Token", function () {

        it("Should add the native token as payment token", async function () {
          const { tenX } = await loadFixture(deployTenxFixture);
          await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
          const paymentToken = await tenX.paymentTokens(ethers.constants.AddressZero);
          expect(paymentToken)
            .to.have.property("priceFeed")
            .to.equal(nativePriceFeed);
        });
  
        it("Should add BUSD as payment token", async function () {
          const { tenX, busd } = await loadFixture(deployTenxFixture);
          await tenX.addPaymentToken(busd.address,busdPriceFeed);
          const paymentToken = await tenX.paymentTokens(busd.address);
          expect(paymentToken)
            .to.have.property("priceFeed")
            .to.equal(busdPriceFeed);
        });

    });

    describe("Get Subscription Amount", function () {

      it("Should get the subscription amount in native token", async function () {
        const { tenX } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );
        expect(Number(subscriptionAmount)).to.be.greaterThan(0)     
      });

      it("Should get subscription Amount in BUSD", async function () {
        const { tenX, busd } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(busd.address,busdPriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          busd.address
        );
        expect(Number(subscriptionAmount)).to.be.greaterThan(0)    
      });
  });
  });
