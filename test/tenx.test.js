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
  
  describe.only("TenX Smart Contract Test-Cases", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployTenxFixture() {

      // Contracts are deployed using the first signer/account by default
      const [owner, holder1, holder2, holder3, holder4, reinvest, tempAddress, user1, user2] = await ethers.getSigners();
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
  
      return { tenX, busd, shareHolderWallets, owner, reinvest, tempAddress, user1, user2 };
    }
  
    describe("Contract Deployment", function () {

      it("Should return token symbol for custom Busd Token", async function () {
        const { busd } = await loadFixture(
          deployTenxFixture
        );

        expect(await busd.symbol()).to.equal('BUSD')

      });

      it("Should return Failed Transaction token amount as zero", async function () {
        const { tenX } = await loadFixture(
          deployTenxFixture
        );

        expect(Number(await tenX.BNBFromFailedTransfers())).to.equal(0)

      });

    });

    describe("Contract OwnerShip", function () {

      it("Should fetch the right owner for TenX", async function () {
        const { tenX, owner } = await loadFixture(deployTenxFixture);
        expect(await tenX.owner()).to.equal(owner.address);
      });

      it("Should change the ownership correctly", async function () {
        const { tenX, owner, tempAddress } = await loadFixture(deployTenxFixture);
        expect(await tenX.owner()).to.equal(owner.address);
        await tenX.transferOwnership(tempAddress.address)
        expect(await tenX.owner()).to.equal(tempAddress.address);
      });

    });

    describe("ShareHolders & Reinvestment Wallets", function () {

      it("Should return reinvestment Wallet", async function () {
        const { tenX, reinvest } = await loadFixture(
          deployTenxFixture
        );
        expect(await tenX.reInvestmentWallet()).to.equal(reinvest.address)
      });

      it("Should return Share Holder Wallets and Percantage", async function () {
        const { tenX, shareHolderWallets } = await loadFixture(
          deployTenxFixture
        );
        for (const [index, holder] of shareHolderWallets.entries()) {
            expect(await tenX.shareHolderWallet(index)).to.equal(holder)
            expect(Number(await tenX.shareHolderPercentage(index)))
              .to.equal(shareHolderPercant[index])
        }
      });

      it("Should change share holder", async function () {
        const { tenX, tempAddress, shareHolderWallets } = await loadFixture(
          deployTenxFixture
        );
        expect(await tenX.shareHolderWallet(0)).to.equal(shareHolderWallets[0])
        await tenX.changeShareHolder(tempAddress.address,0)
        expect(await tenX.shareHolderWallet(0)).to.equal(tempAddress.address)
      });

      it("Should change reinvestment wallet", async function () {
        const { tenX, tempAddress, reinvest } = await loadFixture(
          deployTenxFixture
        );
        expect(await tenX.reInvestmentWallet()).to.equal(reinvest.address)
        await tenX.changeReInvestmentWallet(tempAddress.address)
        expect(await tenX.reInvestmentWallet()).to.equal(tempAddress.address)
      });

    });

    describe("Payment Tokens", function () {

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

        it("Should remove a payment token", async function () {
          const { tenX, busd } = await loadFixture(deployTenxFixture);
          await tenX.addPaymentToken(busd.address,busdPriceFeed);
          await tenX.removePaymentToken(busd.address);
          const paymentToken = await tenX.paymentTokens(busd.address);
          expect(paymentToken)
            .to.have.property("exist")
            .to.equal(false);
        });
    });

    describe("Subscription Plans and Amounts", function () {

      it("Should return Subscription Plans", async function () {
        const { tenX } = await loadFixture(
          deployTenxFixture
        );
        for (const [index, month] of months.entries()) {
           const subscriptionPlan = await tenX.subscriptionPlans(month)
           expect(subscriptionPlan).to.have.property("exist").to.equal(true);
           expect(subscriptionPlan).to.have.property("price")
            .to.equal(pricing[index]);
        }
      });

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

      it("Should add a new Subscription Plan", async function () {
        const { tenX } = await loadFixture(deployTenxFixture);
        await tenX.addSubscriptionPlan(18, 5)
        const subscriptionPlan = await tenX.subscriptionPlans(18);
        expect(subscriptionPlan).to.have.property("exist").to.equal(true);
        expect(subscriptionPlan).to.have.property("price").to.equal(5);    
      });

      it("Should change an existing Subscription Plan", async function () {
        const { tenX } = await loadFixture(deployTenxFixture);

        await expect(tenX.changeSubscriptionPricing(6,18))
          .to.be.revertedWith("TenX: invalid subscription plan");

        await tenX.addSubscriptionPlan(18, 5)
        expect(await tenX.subscriptionPlans(18)).to.have.property("price").to.equal(5);    

        await tenX.changeSubscriptionPricing(6,18)
        expect(await tenX.subscriptionPlans(18)).to.have.property("price").to.equal(6);    

      });

      it("Should remove an existing Subscription Plan", async function () {
        const { tenX } = await loadFixture(deployTenxFixture);

        await expect(tenX.removeSubscriptionPlan(18))
          .to.be.revertedWith("TenX: invalid subscription plan");

        await tenX.addSubscriptionPlan(18, 5)
        expect(await tenX.subscriptionPlans(18)).to.have.property("price").to.equal(5);    

        await tenX.removeSubscriptionPlan(18)
        expect(await tenX.subscriptionPlans(18)).to.have.property("exist").to.equal(false);    

      });

    });

    describe("Referals", function () {

      it("Should fetch the referal levels for TenX", async function () {
        const { tenX } = await loadFixture(deployTenxFixture);
        expect(await tenX.referralLevels()).to.equal(referalPercantage.length);
      });

      it("Should fetch the total referal users for TenX Correctly", async function () {
        const { tenX } = await loadFixture(deployTenxFixture);
        expect(await tenX.totalReferralIds()).to.equal(0);
      });

    });

    describe("Subscription using BNB",  function () {

      it("Should subscribe by a new user without referals", async function () {
        const { tenX,user1 } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );
        await expect(tenX.connect(user1).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          months[0],
          0,
          ethers.constants.AddressZero,
          { value: ethers.BigNumber.from(subscriptionAmount) })
        ).to.emit(tenX, "Subscription").withArgs(
          subscriptionAmount,
          months[0],
          user1.address,
          ethers.constants.AddressZero);
      });

    });

    describe("Payment Splits on Subscription", function () {
    });

  });
