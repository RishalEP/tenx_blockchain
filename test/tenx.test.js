const {
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const chai = require("chai");
const { BN } = require('@openzeppelin/test-helpers');
const chaiBN = require('chai-bn');
chai.use(chaiBN(BN));
const { 
    shareHolderPercant, 
    referalPercantage, 
    months, 
    pricing 
} = require("../helper/arguments");
const { ethers } = require("hardhat");

const nativePriceFeed = '0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada'
const busdPriceFeed = '0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0'
  
  describe("TenX Smart Contract Test-Cases", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployTenxFixture() {

      // Contracts are deployed using the first signer/account by default
      const [owner, holder1, holder2, holder3, holder4, reinvest, tempWallet, user1, user2, user3, user4] = await ethers.getSigners();
      const shareHolderWallets = [holder1.address, holder2.address, holder3.address, holder4.address]
      const referalUsers = [user1, user2, user3, user4]
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
  
      return { tenX, busd, shareHolderWallets, owner, reinvest, tempWallet, user1, user2, referalUsers };
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
        const { tenX, owner, tempWallet } = await loadFixture(deployTenxFixture);
        expect(await tenX.owner()).to.equal(owner.address);
        await tenX.transferOwnership(tempWallet.address)
        expect(await tenX.owner()).to.equal(tempWallet.address);
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
        const { tenX, tempWallet, shareHolderWallets } = await loadFixture(
          deployTenxFixture
        );
        expect(await tenX.shareHolderWallet(0)).to.equal(shareHolderWallets[0])
        await tenX.changeShareHolder(tempWallet.address,0)
        expect(await tenX.shareHolderWallet(0)).to.equal(tempWallet.address)
      });

      it("Should change reinvestment wallet", async function () {
        const { tenX, tempWallet, reinvest } = await loadFixture(
          deployTenxFixture
        );
        expect(await tenX.reInvestmentWallet()).to.equal(reinvest.address)
        await tenX.changeReInvestmentWallet(tempWallet.address)
        expect(await tenX.reInvestmentWallet()).to.equal(tempWallet.address)
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

      it("Should subscribe by a new user with a valid referal", async function () {
        const { tenX,user1,user2 } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );
        await tenX.connect(user1).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          months[0],
          0,
          ethers.constants.AddressZero,
          { value: ethers.BigNumber.from(subscriptionAmount) })

        const { referralId } = await tenX.users(user1.address)

        await expect(tenX.connect(user2).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          months[0],
          referralId,
          ethers.constants.AddressZero,
          { value: ethers.BigNumber.from(subscriptionAmount) })
        ).to.emit(tenX, "Subscription").withArgs(
          subscriptionAmount,
          months[0],
          user2.address,
          ethers.constants.AddressZero);
      });

      it("Should revert if the referred by is not valid", async function () {
        const { tenX,user2 } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );

        await expect(tenX.connect(user2).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          months[0],
          1,
          ethers.constants.AddressZero,
          { value: ethers.BigNumber.from(subscriptionAmount) })
        ).to.be.revertedWith("TenX: invalid referredBy");
      });

      it("Should revert if there is an amount mismatch", async function () {
        const { tenX,user2 } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );

        await expect(tenX.connect(user2).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          months[0],
          0,
          ethers.constants.AddressZero,
          { value: '1' })
        ).to.be.revertedWith("TenX: msg.value not equal amount");
      });
      
      it("Should revert if the plan does not exists", async function () {
        const { tenX,user2 } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );

        await expect(tenX.connect(user2).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          2,
          0,
          ethers.constants.AddressZero,
          { value: ethers.BigNumber.from(subscriptionAmount) })
        ).to.be.revertedWith("TenX: subscription plan doesn't exist");
      });
    });

    describe("Subscription using BUSD",  function () {

      it("Should subscribe by a new user without referals", async function () {
        const { tenX,user1,busd } = await loadFixture(deployTenxFixture);
        const decimals = await busd.decimals()
        await busd.mint(user1.address,5000)
        await busd.connect(user1).approve(tenX.address,1000 * Math.pow(10,decimals))
        await tenX.addPaymentToken(busd.address,busdPriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          busd.address
        );

        await expect(tenX.connect(user1).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          months[0],
          0,
          busd.address
          )).to.emit(tenX, "Subscription").withArgs(
          subscriptionAmount,
          months[0],
          user1.address,
          busd.address);
      });

      it("Should subscribe by a new user with a valid referal", async function () {
        const { tenX,user1,user2,busd } = await loadFixture(deployTenxFixture);
        const decimals = await busd.decimals()
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        await busd.mint(user2.address,5000)
        await busd.connect(user2).approve(tenX.address,1000 * Math.pow(10,decimals))
        await tenX.addPaymentToken(busd.address,busdPriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );
        await tenX.connect(user1).subscribe(
          ethers.BigNumber.from(subscriptionAmount),
          months[0],
          0,
          ethers.constants.AddressZero,
          { value: ethers.BigNumber.from(subscriptionAmount) })

        const { referralId } = await tenX.users(user1.address)

        const busdSubscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          busd.address
        );

        await expect(tenX.connect(user2).subscribe(
          ethers.BigNumber.from(busdSubscriptionAmount),
          months[0],
          referralId,
          busd.address
          )).to.emit(tenX, "Subscription").withArgs(
          busdSubscriptionAmount,
          months[0],
          user2.address,
          busd.address);
      });

      it("Should revert if there is an amount mismatch", async function () {
        const { tenX,user2,busd } = await loadFixture(deployTenxFixture);
        const decimals = await busd.decimals()
        await busd.mint(user2.address,5000)
        await busd.connect(user2).approve(tenX.address,1000 * Math.pow(10,decimals))
        await tenX.addPaymentToken(busd.address,busdPriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          busd.address
        );

        await expect(tenX.connect(user2).subscribe(
          1,
          months[0],
          0,
          ethers.constants.AddressZero)).to.be.revertedWith("TenX: msg.value not equal amount");
      }); 
    });

    describe("Payment Splits on Subscriptions using BNB", function () {
      it("Should split the payments among the share holders and reinvestor correctly for no referals", async function () {
        const { tenX,user1,shareHolderWallets,reinvest } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );

        let shareHoldersPreviousBalance = []
        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderBalance = await ethers.provider.getBalance(holder);
          shareHoldersPreviousBalance.push(shareHolderBalance)
        }

        const reinvestorPreviousBalance = await ethers.provider.getBalance(reinvest.address)

       await tenX.connect(user1).subscribe(
        ethers.BigNumber.from(subscriptionAmount),
        months[0],
        0,
        ethers.constants.AddressZero,
        { value: ethers.BigNumber.from(subscriptionAmount) })

        let totalShareHolderAmount = 0

        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderNewBalance = await ethers.provider.getBalance(holder);
          const amountToBeUpdated = subscriptionAmount.mul(shareHolderPercant[index]).div(10000)
          totalShareHolderAmount =  amountToBeUpdated.add(totalShareHolderAmount)
          expect(shareHolderNewBalance)
          .to.be.equal(shareHoldersPreviousBalance[index].add(amountToBeUpdated))     
        }
        const reinvestAmountToUpdate = subscriptionAmount.sub(totalShareHolderAmount)
        const reinvestorNewBalance = await ethers.provider.getBalance(reinvest.address);
        expect(reinvestorNewBalance)
          .to.be.equal(reinvestorPreviousBalance.add(reinvestAmountToUpdate))
      });

      it("Should split the payments among the share holders, reinvestors and referals correctly", async function () {
        const { tenX,
                referalUsers,
                tempWallet,
                shareHolderWallets,
                reinvest } = await loadFixture(deployTenxFixture);
                
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);

        let referalUserPreviousBalance = {}
        let mainReferalId = 0

        for (const [index, user] of referalUsers.entries()) {
          let referalId = 0
          const subscriptionAmount = await tenX.getSubscriptionAmount(
            months[0],
            ethers.constants.AddressZero
          );

          if(index > 0){
            const userInfo = await tenX.users(referalUsers[index-1].address)
            referalId = Number(userInfo.referralId)
          }

          await tenX.connect(user).subscribe(
            ethers.BigNumber.from(subscriptionAmount),
            months[0],
            referalId,
            ethers.constants.AddressZero,
            { value: ethers.BigNumber.from(subscriptionAmount) })
            
            const userBalance = await ethers.provider.getBalance(user.address);
            referalUserPreviousBalance = {...referalUserPreviousBalance,...{[user.address]:userBalance}}

            if(index === referalUsers.length-1){
              const userInfo = await tenX.users(user.address)
              mainReferalId = Number(userInfo.referralId)
            }
        }

        let shareHoldersPreviousBalance = []
        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderBalance = await ethers.provider.getBalance(holder);
          shareHoldersPreviousBalance.push(shareHolderBalance)
        }

        const reinvestorPreviousBalance = await ethers.provider.getBalance(reinvest.address)
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          ethers.constants.AddressZero
        );

       await tenX.connect(tempWallet).subscribe(
        ethers.BigNumber.from(subscriptionAmount),
        months[0],
        mainReferalId,
        ethers.constants.AddressZero,
        { value: ethers.BigNumber.from(subscriptionAmount) })

        let totalReferalAmount = 0

        const subscriberInfo = await tenX.users(tempWallet.address)
        fetchReferalId = Number(subscriberInfo.referredBy)

        for (const [index, value] of referalPercantage.entries()) {
          if(fetchReferalId !== 0){
            const referalUser = await tenX.referralIdToUser(fetchReferalId)
            const referalUserNewBalance = await ethers.provider.getBalance(referalUser);
            const amountToBeUpdated = subscriptionAmount.mul(value).div(10000)        
            totalReferalAmount = amountToBeUpdated.add(totalReferalAmount)

            expect(Number(referalUserNewBalance))
              .to.be.greaterThanOrEqual(Number(referalUserPreviousBalance[referalUser].add(amountToBeUpdated)))
            const subscriberInfo = await tenX.users(referalUser)
            fetchReferalId = Number(subscriberInfo.referredBy)
          }
        }

        let totalShareHolderAmount = 0
        let remainingSubscriptionAmount = subscriptionAmount.sub(totalReferalAmount)        

        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderNewBalance = await ethers.provider.getBalance(holder);
          const amountToBeUpdated = remainingSubscriptionAmount.mul(shareHolderPercant[index]).div(10000)
          totalShareHolderAmount = amountToBeUpdated.add(totalShareHolderAmount)
          expect(shareHolderNewBalance)
          .to.be.equal(shareHoldersPreviousBalance[index].add(amountToBeUpdated))     
        }

        const reinvestAmountToUpdate = subscriptionAmount.sub(totalShareHolderAmount.add(totalReferalAmount))
        const reinvestorNewBalance = await ethers.provider.getBalance(reinvest.address);
        expect(reinvestorNewBalance)
          .to.be.equal(reinvestorPreviousBalance.add(reinvestAmountToUpdate))
        });
    });

    describe("Payment Splits on Subscriptions using BUSD", function () {
      it("Should split the payments among the share holders and reinvestor correctly for no referals", async function () {
        const { tenX,busd,user1,shareHolderWallets,reinvest } = await loadFixture(deployTenxFixture);
        await tenX.addPaymentToken(busd.address,busdPriceFeed);
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          busd.address
        );

        let shareHoldersPreviousBalance = []
        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderBalance = await busd.balanceOf(holder);
          shareHoldersPreviousBalance.push(shareHolderBalance)
        }

      const reinvestorPreviousBalance = await busd.balanceOf(reinvest.address)
      const decimals = await busd.decimals()

      await busd.mint(user1.address,5000)
      await busd.connect(user1).approve(tenX.address,1000 * Math.pow(10,decimals))

      await tenX.connect(user1).subscribe(
        ethers.BigNumber.from(subscriptionAmount),
        months[0],
        0,
        busd.address)

        let totalShareHolderAmount = 0

        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderNewBalance = await busd.balanceOf(holder);
          const amountToBeUpdated = subscriptionAmount.mul(shareHolderPercant[index]).div(10000)
          totalShareHolderAmount =  amountToBeUpdated.add(totalShareHolderAmount)
          expect(shareHolderNewBalance)
          .to.be.equal(shareHoldersPreviousBalance[index].add(amountToBeUpdated))     
        }
        const reinvestAmountToUpdate = subscriptionAmount.sub(totalShareHolderAmount)
        const reinvestorNewBalance = await busd.balanceOf(reinvest.address);
        expect(reinvestorNewBalance)
          .to.be.equal(reinvestorPreviousBalance.add(reinvestAmountToUpdate))
      });

      it("Should split the payments among the share holders, reinvestors and referals correctly", async function () {
        const { tenX,
                busd,
                referalUsers,
                tempWallet,
                shareHolderWallets,
                reinvest } = await loadFixture(deployTenxFixture);
                
        await tenX.addPaymentToken(ethers.constants.AddressZero,nativePriceFeed);
        await tenX.addPaymentToken(busd.address,busdPriceFeed);

        let referalUserPreviousBalance = {}
        let mainReferalId = 0

        for (const [index, user] of referalUsers.entries()) {
          let referalId = 0
          const subscriptionAmount = await tenX.getSubscriptionAmount(
            months[0],
            ethers.constants.AddressZero
          );

          if(index > 0){
            const userInfo = await tenX.users(referalUsers[index-1].address)
            referalId = Number(userInfo.referralId)
          }

          await tenX.connect(user).subscribe(
            ethers.BigNumber.from(subscriptionAmount),
            months[0],
            referalId,
            ethers.constants.AddressZero,
            { value: ethers.BigNumber.from(subscriptionAmount) })
            
            const userBalance = await busd.balanceOf(user.address);
            referalUserPreviousBalance = {...referalUserPreviousBalance,...{[user.address]:userBalance}}

            if(index === referalUsers.length-1){
              const userInfo = await tenX.users(user.address)
              mainReferalId = Number(userInfo.referralId)
            }
        }

        let shareHoldersPreviousBalance = []
        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderBalance = await busd.balanceOf(holder);
          shareHoldersPreviousBalance.push(shareHolderBalance)
        }

        const reinvestorPreviousBalance = await busd.balanceOf(reinvest.address)
        const subscriptionAmount = await tenX.getSubscriptionAmount(
          months[0],
          busd.address
        );

      const decimals = await busd.decimals()

      await busd.mint(tempWallet.address,5000)
      await busd.connect(tempWallet).approve(tenX.address,1000 * Math.pow(10,decimals))

      await tenX.connect(tempWallet).subscribe(
        ethers.BigNumber.from(subscriptionAmount),
        months[0],
        mainReferalId,
        busd.address)

        let totalReferalAmount = 0

        const subscriberInfo = await tenX.users(tempWallet.address)
        fetchReferalId = Number(subscriberInfo.referredBy)

        for (const [index, value] of referalPercantage.entries()) {
          if(fetchReferalId !== 0){
            const referalUser = await tenX.referralIdToUser(fetchReferalId)
            const referalUserNewBalance = await busd.balanceOf(referalUser);
            const amountToBeUpdated = subscriptionAmount.mul(value).div(10000)        
            totalReferalAmount = amountToBeUpdated.add(totalReferalAmount)
            expect(referalUserNewBalance)
              .to.be.equal(referalUserPreviousBalance[referalUser].add(amountToBeUpdated))
            const subscriberInfo = await tenX.users(referalUser)
            fetchReferalId = Number(subscriberInfo.referredBy)
          }
        }

        let totalShareHolderAmount = 0
        let remainingSubscriptionAmount = subscriptionAmount.sub(totalReferalAmount)        

        for (const [index, holder] of shareHolderWallets.entries()) {
          const shareHolderNewBalance = await busd.balanceOf(holder);
          const amountToBeUpdated = remainingSubscriptionAmount.mul(shareHolderPercant[index]).div(10000)
          totalShareHolderAmount = amountToBeUpdated.add(totalShareHolderAmount)
          expect(shareHolderNewBalance)
          .to.be.equal(shareHoldersPreviousBalance[index].add(amountToBeUpdated))     
        }

        const reinvestAmountToUpdate = subscriptionAmount.sub(totalShareHolderAmount.add(totalReferalAmount))
        const reinvestorNewBalance = await busd.balanceOf(reinvest.address);
        expect(reinvestorNewBalance)
          .to.be.equal(reinvestorPreviousBalance.add(reinvestAmountToUpdate))
        });
    });
  });
