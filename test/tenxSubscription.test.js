const {
    loadFixture
  } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { expect } = require("chai");
const { MAINNET_VALUES } = require("../config"); 
const {
    shareHolders,
    subscriptionSchemes,
    referalPercantage,
    reinvestmentWallet,
    paymentTokens,
    shareHolderLimit,
    referalLimit
} = MAINNET_VALUES

describe("Tenx Subscription", async () => {
    
    async function deployTenxFixture() {

        const [
            deployer, 
            subscriber,
            subscriber1, 
            subscriber2, 
            subscriber3, 
            subscriber4
        ] = await ethers.getSigners();

        const TenxV1 = await ethers.getContractFactory("TenxUpgradableV1");
        const tenxV1 = await upgrades.deployProxy(
            TenxV1,
            [
              [shareHolders.length,shareHolderLimit],
              [referalPercantage.length, referalLimit],
              reinvestmentWallet
            ],
            { initializer: "initialize" }
        );

        const Busd = await ethers.getContractFactory("BUSD");
        const busd = await Busd.deploy(); 

        await tenxV1.setReferralPercentages(
            referalPercantage
        );

        let shareHoldersInfo = {
            names:[],
            address:[],
            percentage:[]
        }

        for(const holder of shareHolders) {
            shareHoldersInfo = {
                names:[...shareHoldersInfo.names,holder.name],
                address:[...shareHoldersInfo.address,holder.address],
                percentage:[...shareHoldersInfo.percentage,holder.percentage]
            }
        }

        await tenxV1.setShareHolders(
            shareHoldersInfo.names,
            shareHoldersInfo.address,
            shareHoldersInfo.percentage
        );

        for(const scheme of subscriptionSchemes) {
            await tenxV1.addSubscriptionPlan(
                scheme.month,
                scheme.price
            );
        }

        const updatedPaymentTokens = [
            {
                address:paymentTokens[0].address,
                priceFeed:paymentTokens[0].priceFeed
            },
            {
                address:busd.address,
                priceFeed:paymentTokens[1].priceFeed
            }
        ]

        for(const token of updatedPaymentTokens) {
            await tenxV1.addPaymentToken(
                token.address,
                token.priceFeed
            );
        }

        return {
            deployer,
            tenxV1,
            subscriber,
            subscriber1,
            subscriber2,
            subscriber3,
            subscriber4,
            paymentTokenBnb:updatedPaymentTokens[0],
            paymentTokenBusd:updatedPaymentTokens[1],
            shareHolderWallets:shareHoldersInfo.address,
            busd
        };
    }

    describe("Subscription Using BNB", async () => {

        it("Should be able subscribe using BNB and emit events", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
            expect(subscribe).to.have.property('hash')

            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + (subscriptionSchemes[0].month * 30 * 24 * 60 * 60);

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    1,
                    0,
                    subscriptionSchemes[0].month,
                    validity,
                    paymentTokenBnb.address,
                    subscriptionAmount);

            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('referalId')
                .to.be.not.equal(0)
            expect(userSubscription).to.have.property('referrerId')
                .to.be.equal(0)
        });

        it("Should revert on subscription if plan is inactive ", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.disableSubscribtionPlan(subscriptionSchemes[0].month);
            await expect(tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: Subscription plan not active");
        });

        it("Should revert on subscription if Payment token is inactive ", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.disablePaymentToken(paymentTokenBnb.address);
            await expect(tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: Payment Token not active");
        });

        it("Should revert on subscription if Amount Payed is less ", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            const amountToSend = subscriptionAmount.sub(10)
            await expect(tenxV1.connect(subscriber).subscribe(
                amountToSend,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: amount paid less. increase slippage");
            await expect(tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(amountToSend) }
            )).to.be.revertedWith("TenX: Mismatch in Amount send");
        });
     
        it("Should revert on subscription if referred ID/User is invalid", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await expect(tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                1,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: Invalid referredBy");
        });

        it("Should able to refer a user and subscribe", async () => {
            const { tenxV1, subscriber, subscriber2, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
            const subscriber1Info = await tenxV1.getUserInfo(subscriber.address)
            const subscribe = await tenxV1.connect(subscriber2).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                subscriber1Info.referalId,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
        
            expect(subscribe).to.have.property('hash')
            const subscriber2Info = await tenxV1.getUserInfo(subscriber2.address)
            expect(subscriber2Info).to.have.property('referrerId')
                .to.be.equal(subscriber1Info.referalId)
            expect(subscriber2Info).to.have.property('referrerAddress')
                .to.be.equal(subscriber.address)
        });

        it("Should able to subscribe more than once", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            const initialSubscription = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            expect(initialSubscription).to.have.property('hash')
            const initialReceipt = await initialSubscription.wait();
            const event = initialReceipt.events.find((event) =>
                    event.event === 'Subscription'
                );
            const block = await ethers.provider.getBlock(initialReceipt.blockNumber);
            const schemeValidity = subscriptionSchemes[0].month * 30 * 24 * 60 * 60
            const validity = block.timestamp + schemeValidity;
            expect(event).to.not.be.undefined;
            expect(event.args.subscriptionValidity).to.equal(validity);
           
            const initialSubscriptionValidity = event.args.subscriptionValidity;

            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
            expect(subscribe).to.have.property('hash')

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    1,
                    0,
                    subscriptionSchemes[0].month,
                    initialSubscriptionValidity.add(schemeValidity),
                    paymentTokenBnb.address,
                    subscriptionAmount);
        });

        it("Should be able to subscribe on discount if applicable ", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const originalSubscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0
            )
            const discount = 2000
            const expectedDiscount = originalSubscriptionAmount.mul(discount).div(10000)
            const discountedSubscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            expect(discountedSubscriptionAmount).to.be.equal(expectedDiscount)
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                discountedSubscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(discountedSubscriptionAmount) }
            )
            expect(subscribe).to.have.property('hash')
        });

        it("Should split the total amount among all affiliates and share holders correctly", async () => {
            const { 
                tenxV1, 
                subscriber, 
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4, 
                paymentTokenBnb 
            } = await loadFixture(deployTenxFixture);
            const referrals = [
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4 ]

            const discount = 1000

            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            let referrerId = 0
            for(const referral of referrals) {
                await tenxV1.connect(referral).subscribe(
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    referrerId,
                    paymentTokenBnb.address,
                    discount,
                    { value: ethers.BigNumber.from(subscriptionAmount) }
                )
                referrerId = (await tenxV1.getUserInfo(referral.address)).referalId
            }

            let affiliatesInitialBalance = {}
            let shareHoldersInitialBalance = {}
            const reinvestmentInitialBalance = await ethers.provider.getBalance(reinvestmentWallet)

            for(const referral of referrals) {
                const userBalance = await ethers.provider.getBalance(referral.address);
                affiliatesInitialBalance = 
                    {...affiliatesInitialBalance, ...{[referral.address]:userBalance}}
            }

            for(const holder of shareHolders) {
                const userBalance = await ethers.provider.getBalance(holder.address);
                shareHoldersInitialBalance = 
                    {...shareHoldersInitialBalance, ...{[holder.address]:userBalance}}
            }

            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                referrerId,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            let totalReferals = 0;

            expect(subscribe).to.have.property('hash')
            for(const [index, referral] of referrals.reverse().entries()) {
                const userBalance = await ethers.provider.getBalance(referral.address);
                const expectedShare = subscriptionAmount.mul(referalPercantage[index]).div(10000) 
                expect(userBalance).to.be.equal(
                    affiliatesInitialBalance[referral.address].add(expectedShare))
                totalReferals = expectedShare.add(totalReferals)
            }

            const remainingShare = subscriptionAmount.sub(totalReferals)
            let totalShares = 0;

            for(const holder of shareHolders) {
                const userBalance = await ethers.provider.getBalance(holder.address);
                const expectedShare = remainingShare.mul(holder.percentage).div(10000) 
                expect(userBalance).to.be.equal(
                    shareHoldersInitialBalance[holder.address].add(expectedShare))
                totalShares = expectedShare.add(totalShares)
            }

            const reinvestmentFinalBalance = await ethers.provider.getBalance(reinvestmentWallet);
            const reinvestmentShare = remainingShare.sub(totalShares)
            expect(reinvestmentFinalBalance).to.be.equal(
                reinvestmentInitialBalance.add(reinvestmentShare))
        });

        it("Should not send referals to affiliates whose subscription is expired", async () => {
            const { 
                tenxV1, 
                subscriber, 
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4, 
                paymentTokenBnb 
            } = await loadFixture(deployTenxFixture);
            const referrals = [
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4 ]

            const discount = 1000

            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            let referrerId = 0
            for(const referral of referrals) {
                await tenxV1.connect(referral).subscribe(
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    referrerId,
                    paymentTokenBnb.address,
                    discount,
                    { value: ethers.BigNumber.from(subscriptionAmount) }
                )
                referrerId = (await tenxV1.getUserInfo(referral.address)).referalId
            }

            const timesToAdd = subscriptionSchemes[0].month * 31 * 24 * 60 * 60; // Assuming 30 days in a month

            await ethers.provider.send("evm_increaseTime", [timesToAdd]);
            await ethers.provider.send("evm_mine");

            const renewedReferals = [subscriber2,subscriber4]

            for(const referral of renewedReferals) {
                await tenxV1.connect(referral).subscribe(
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    0,
                    paymentTokenBnb.address,
                    discount,
                    { value: ethers.BigNumber.from(subscriptionAmount) }
                )
            }

            let affiliatesInitialBalance = {}
            let shareHoldersInitialBalance = {}
            const reinvestmentInitialBalance = await ethers.provider.getBalance(reinvestmentWallet)

            for(const referral of referrals) {
                const userBalance = await ethers.provider.getBalance(referral.address);
                affiliatesInitialBalance = 
                    {...affiliatesInitialBalance, ...{[referral.address]:userBalance}}
            }

            for(const holder of shareHolders) {
                const userBalance = await ethers.provider.getBalance(holder.address);
                shareHoldersInitialBalance = 
                    {...shareHoldersInitialBalance, ...{[holder.address]:userBalance}}
            }

            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                referrerId,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            let totalReferals = 0;
            let reinvestmentAffilifateShare = 0;

            expect(subscribe).to.have.property('hash')
            for(const [index, referral] of referrals.reverse().entries()) {
                const userBalance = await ethers.provider.getBalance(referral.address);
                const expectedShare = subscriptionAmount.mul(referalPercantage[index]).div(10000) 

                if(renewedReferals.includes(referral))
                {
                    expect(userBalance).to.be.equal(
                        affiliatesInitialBalance[referral.address].add(expectedShare))
                }
                else {
                    expect(userBalance).to.be.equal(
                        affiliatesInitialBalance[referral.address])
                    reinvestmentAffilifateShare =  expectedShare.add(reinvestmentAffilifateShare)
                }

                totalReferals = expectedShare.add(totalReferals)
            }

            const remainingShare = subscriptionAmount.sub(totalReferals)
            let totalShares = 0;

            for(const holder of shareHolders) {
                const userBalance = await ethers.provider.getBalance(holder.address);
                const expectedShare = remainingShare.mul(holder.percentage).div(10000) 
                expect(userBalance).to.be.equal(
                    shareHoldersInitialBalance[holder.address].add(expectedShare))
                totalShares = expectedShare.add(totalShares)
            }

            const reinvestmentFinalBalance = await ethers.provider.getBalance(reinvestmentWallet);
            const reinvestmentShare = remainingShare.sub(totalShares).add(reinvestmentAffilifateShare)
            expect(reinvestmentFinalBalance).to.be.equal(
                reinvestmentInitialBalance.add(reinvestmentShare))
        });

    });

    describe("Subscription Using BUSD", async () => {

        it("Should be able subscribe using BUSD and emit event", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )

            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)
            
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBusd.address,
                discount,
            )
            expect(subscribe).to.have.property('hash')
            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + (subscriptionSchemes[0].month * 30 * 24 * 60 * 60);

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    1,
                    0,
                    subscriptionSchemes[0].month,
                    validity,
                    paymentTokenBusd.address,
                    subscriptionAmount);
    
            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('referalId')
                .to.be.not.equal(0)
            expect(userSubscription).to.have.property('referrerId')
                .to.be.equal(0)
        });

        it("Should revert on subscription if Payment token is inactive ", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )

            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)

            await tenxV1.disablePaymentToken(paymentTokenBusd.address);
            await expect(tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBusd.address,
                discount
            )).to.be.revertedWith("TenX: Payment Token not active");
        });

        it("Should revert on subscription if Amount Payed is less ", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            await busd.mint(subscriber.address,1000)
            const amountToSend = subscriptionAmount.sub(10)
            await busd.connect(subscriber).approve(tenxV1.address,amountToSend)

            await expect(tenxV1.connect(subscriber).subscribe(
                amountToSend,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBusd.address,
                discount,
            )).to.be.revertedWith("TenX: amount paid less. increase slippage");
        });

        it("Should able to refer a user and subscribe", async () => {
            const { tenxV1, subscriber, subscriber2, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )

            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)

            await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBusd.address,
                discount
            )
            const subscriber1Info = await tenxV1.getUserInfo(subscriber.address)
            await busd.mint(subscriber2.address,1000)
            await busd.connect(subscriber2).approve(tenxV1.address,subscriptionAmount)
            const subscribe = await tenxV1.connect(subscriber2).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                subscriber1Info.referalId,
                paymentTokenBusd.address,
                discount
            )
            expect(subscribe).to.have.property('hash')
            const subscriber2Info = await tenxV1.getUserInfo(subscriber2.address)
            expect(subscriber2Info).to.have.property('referrerId')
                .to.be.equal(subscriber1Info.referalId)
            expect(subscriber2Info).to.have.property('referrerAddress')
                .to.be.equal(subscriber.address)
        });

        it("Should able to subscribe more than once", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)
            const initialSubscription = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBusd.address,
                discount,
            )
            expect(initialSubscription).to.have.property('hash')
            const initialReceipt = await initialSubscription.wait();
            const event = initialReceipt.events.find((event) =>
                    event.event === 'Subscription'
                );
            const block = await ethers.provider.getBlock(initialReceipt.blockNumber);
            const schemeValidity = subscriptionSchemes[0].month * 30 * 24 * 60 * 60
            const validity = block.timestamp + schemeValidity;
            expect(event).to.not.be.undefined;
            expect(event.args.subscriptionValidity).to.equal(validity);
           
            const initialSubscriptionValidity = event.args.subscriptionValidity;
        
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBusd.address,
                discount
            )
            expect(subscribe).to.have.property('hash')
            
            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    1,
                    0,
                    subscriptionSchemes[0].month,
                    initialSubscriptionValidity.add(schemeValidity),
                    paymentTokenBusd.address,
                    subscriptionAmount);
        });

        it("Should be able to subscribe on discount if applicable ", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
            const originalSubscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                0
            )
            const discount = 2000
            const expectedDiscount = originalSubscriptionAmount.mul(discount).div(10000)
            const discountedSubscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            expect(discountedSubscriptionAmount).to.be.equal(expectedDiscount)
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,discountedSubscriptionAmount)
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                discountedSubscriptionAmount,
                subscriptionSchemes[0].month,
                0,
                paymentTokenBusd.address,
                discount
            )
            expect(subscribe).to.have.property('hash')
        });

        it("Should split the total amount among all affiliates and share holders correctly", async () => {
            const { 
                tenxV1, 
                subscriber, 
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4, 
                paymentTokenBusd,
                busd 
            } = await loadFixture(deployTenxFixture);
            const referrals = [
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4 ]

            const discount = 1000

            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            let referrerId = 0
            for(const referral of referrals) {
                await busd.mint(referral.address,1000)
                await busd.connect(referral).approve(tenxV1.address,subscriptionAmount)
                await tenxV1.connect(referral).subscribe(
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    referrerId,
                    paymentTokenBusd.address,
                    discount
                )
                referrerId = (await tenxV1.getUserInfo(referral.address)).referalId
            }

            let affiliatesInitialBalance = {}
            let shareHoldersInitialBalance = {}
            const reinvestmentInitialBalance = await busd.balanceOf(reinvestmentWallet)

            for(const referral of referrals) {
                const userBalance = await busd.balanceOf(referral.address);
                affiliatesInitialBalance = 
                    {...affiliatesInitialBalance, ...{[referral.address]:userBalance}}
            }

            for(const holder of shareHolders) {
                const userBalance = await busd.balanceOf(holder.address);
                shareHoldersInitialBalance = 
                    {...shareHoldersInitialBalance, ...{[holder.address]:userBalance}}
            }
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                referrerId,
                paymentTokenBusd.address,
                discount
            )

            let totalReferals = 0;

            expect(subscribe).to.have.property('hash')
            for(const [index, referral] of referrals.reverse().entries()) {
                const userBalance = await busd.balanceOf(referral.address);
                const expectedShare = subscriptionAmount.mul(referalPercantage[index]).div(10000) 
                expect(userBalance).to.be.equal(
                    affiliatesInitialBalance[referral.address].add(expectedShare))
                totalReferals = expectedShare.add(totalReferals)
            }

            const remainingShare = subscriptionAmount.sub(totalReferals)
            let totalShares = 0;

            for(const holder of shareHolders) {
                const userBalance = await busd.balanceOf(holder.address);
                const expectedShare = remainingShare.mul(holder.percentage).div(10000) 
                expect(userBalance).to.be.equal(
                    shareHoldersInitialBalance[holder.address].add(expectedShare))
                totalShares = expectedShare.add(totalShares)
            }

            const reinvestmentFinalBalance = await busd.balanceOf(reinvestmentWallet);
            const reinvestmentShare = remainingShare.sub(totalShares)
            expect(reinvestmentFinalBalance).to.be.equal(
                reinvestmentInitialBalance.add(reinvestmentShare))
        });

        it("Should not send referals to affiliates whose subscription is expired", async () => {
            const { 
                tenxV1, 
                subscriber, 
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4, 
                paymentTokenBusd,
                busd 
            } = await loadFixture(deployTenxFixture);
            const referrals = [
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4 ]

            const discount = 1000

            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            let referrerId = 0
            for(const referral of referrals) {
                await busd.mint(referral.address,1000)
                await busd.connect(referral).approve(tenxV1.address,subscriptionAmount)
                await tenxV1.connect(referral).subscribe(
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    referrerId,
                    paymentTokenBusd.address,
                    discount
                )
                referrerId = (await tenxV1.getUserInfo(referral.address)).referalId
            }

            const timesToAdd = subscriptionSchemes[0].month * 31 * 24 * 60 * 60; // Assuming 30 days in a month

            await ethers.provider.send("evm_increaseTime", [timesToAdd]);
            await ethers.provider.send("evm_mine");

            const renewedReferals = [subscriber2,subscriber4]

            for(const referral of renewedReferals) {
                await busd.mint(referral.address,1000)
                await busd.connect(referral).approve(tenxV1.address,subscriptionAmount)
                await tenxV1.connect(referral).subscribe(
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    referrerId,
                    paymentTokenBusd.address,
                    discount
                )
            }

            let affiliatesInitialBalance = {}
            let shareHoldersInitialBalance = {}
            const reinvestmentInitialBalance = await busd.balanceOf(reinvestmentWallet)

            for(const referral of referrals) {
                const userBalance = await busd.balanceOf(referral.address);
                affiliatesInitialBalance = 
                    {...affiliatesInitialBalance, ...{[referral.address]:userBalance}}
            }

            for(const holder of shareHolders) {
                const userBalance = await busd.balanceOf(holder.address);
                shareHoldersInitialBalance = 
                    {...shareHoldersInitialBalance, ...{[holder.address]:userBalance}}
            }
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                referrerId,
                paymentTokenBusd.address,
                discount
            )

            let totalReferals = 0;
            let reinvestmentAffilifateShare = 0;

            expect(subscribe).to.have.property('hash')
            for(const [index, referral] of referrals.reverse().entries()) {
                const userBalance = await busd.balanceOf(referral.address);
                const expectedShare = subscriptionAmount.mul(referalPercantage[index]).div(10000) 
                
                if(renewedReferals.includes(referral))
                {
                    expect(userBalance).to.be.equal(
                        affiliatesInitialBalance[referral.address].add(expectedShare))
                }
                else {
                    expect(userBalance).to.be.equal(
                        affiliatesInitialBalance[referral.address])
                    reinvestmentAffilifateShare =  expectedShare.add(reinvestmentAffilifateShare)
                }

                totalReferals = expectedShare.add(totalReferals)
            }

            const remainingShare = subscriptionAmount.sub(totalReferals)
            let totalShares = 0;

            for(const holder of shareHolders) {
                const userBalance = await busd.balanceOf(holder.address);
                const expectedShare = remainingShare.mul(holder.percentage).div(10000) 
                expect(userBalance).to.be.equal(
                    shareHoldersInitialBalance[holder.address].add(expectedShare))
                totalShares = expectedShare.add(totalShares)
            }

            const reinvestmentFinalBalance = await busd.balanceOf(reinvestmentWallet);
            const reinvestmentShare = remainingShare.sub(totalShares).add(reinvestmentAffilifateShare)
            expect(reinvestmentFinalBalance).to.be.equal(
                reinvestmentInitialBalance.add(reinvestmentShare))
        });

    });

    describe("Free Subscription Initiated by Manager", async () => {
        
        it("Should be able for manager to give free subscription to user and emit event", async () => {
            const { tenxV1, subscriber } = await loadFixture(deployTenxFixture);
            const zeroAddress = ethers.constants.AddressZero;

            const subscribe = await tenxV1.addSubscriptionForUser(
                subscriber.address,
                subscriptionSchemes[0].month,
                0
            )
            expect(subscribe).to.have.property('hash')

            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + (subscriptionSchemes[0].month * 30 * 24 * 60 * 60);

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    1,
                    0,
                    subscriptionSchemes[0].month,
                    validity,
                    zeroAddress,
                    0);
    
            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('referalId')
                .to.be.not.equal(0)
            expect(userSubscription).to.have.property('referrerId')
                .to.be.equal(0)
        });

        it("Should be able for manager to give free subscription to user with referals and emit event", async () => {
            const { tenxV1, subscriber, subscriber1 } = await loadFixture(deployTenxFixture);
            const zeroAddress = ethers.constants.AddressZero;

            await tenxV1.addSubscriptionForUser(
                subscriber1.address,
                subscriptionSchemes[0].month,
                0
            )

            
            const initialSubscriber = await tenxV1.getUserInfo(subscriber1.address) 
            expect(initialSubscriber).to.have.property('referalId')
                .to.be.not.equal(0)

            const subscribe = await tenxV1.addSubscriptionForUser(
                subscriber.address,
                subscriptionSchemes[0].month,
                initialSubscriber.referalId
            )
            expect(subscribe).to.have.property('hash')

            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + (subscriptionSchemes[0].month * 30 * 24 * 60 * 60);

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    2,
                    initialSubscriber.referalId,
                    subscriptionSchemes[0].month,
                    validity,
                    zeroAddress,
                    0);
    
            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('referalId')
                .to.be.not.equal(0)
            expect(userSubscription).to.have.property('referrerId')
                .to.be.equal(initialSubscriber.referalId)
        });

        it("Should recieve affiliate share for manager subscribed users", async () => {
            const { tenxV1, subscriber, subscriber1, paymentTokenBnb } = await loadFixture(deployTenxFixture);

            await tenxV1.addSubscriptionForUser(
                subscriber1.address,
                subscriptionSchemes[0].month,
                0
            )
            
            const referalId = (await tenxV1.getUserInfo(subscriber1.address)).referalId
            const refererInitialBalance = await ethers.provider.getBalance(subscriber.address)
            const reinvestmentInitialBalance = await ethers.provider.getBalance(reinvestmentWallet)

            let shareHoldersInitialBalance = {}

            for(const holder of shareHolders) {
                const userBalance = await ethers.provider.getBalance(holder.address);
                shareHoldersInitialBalance = 
                    {...shareHoldersInitialBalance, ...{[holder.address]:userBalance}}
            }

            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0
            )

            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriptionAmount,
                subscriptionSchemes[0].month,
                referalId,
                paymentTokenBnb.address,
                0,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            expect(subscribe).to.have.property('hash')
            
            const refererFinalBalance = await ethers.provider.getBalance(subscriber1.address);
            const expectedRefererShare = subscriptionAmount.mul(referalPercantage[0]).div(10000) 
            expect(refererFinalBalance).to.be.equal(
                refererInitialBalance.add(expectedRefererShare))

            const remainingShare = subscriptionAmount.sub(expectedRefererShare)
            let totalShares = 0;

            for(const holder of shareHolders) {
                const userBalance = await ethers.provider.getBalance(holder.address);
                const expectedShare = remainingShare.mul(holder.percentage).div(10000) 
                expect(userBalance).to.be.equal(
                    shareHoldersInitialBalance[holder.address].add(expectedShare))
                totalShares = expectedShare.add(totalShares)
            }

            const reinvestmentFinalBalance = await ethers.provider.getBalance(reinvestmentWallet);
            const reinvestmentShare = remainingShare.sub(totalShares)
            expect(reinvestmentFinalBalance).to.be.equal(
                reinvestmentInitialBalance.add(reinvestmentShare))
        });
    })
});