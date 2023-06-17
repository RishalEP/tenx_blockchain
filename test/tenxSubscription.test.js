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
        
        const zeroAddress = ethers.constants.AddressZero;
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

        const Busd = await ethers.getContractFactory("ERC20Token");
        const busd = await Busd.deploy('BUSD Token', 'BUSD'); 

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
            zeroAddress,
            paymentTokenBnb:updatedPaymentTokens[0],
            paymentTokenBusd:updatedPaymentTokens[1],
            shareHolderWallets:shareHoldersInfo.address,
            busd
        };
    }

    describe("Subscription Using BNB", async () => {

        it("Should be able subscribe using BNB and emit events", async () => {
            const { tenxV1, subscriber, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
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
                    zeroAddress,
                    validity,
                    paymentTokenBnb.address,
                    subscriptionAmount);

            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('referedBy')
                .to.be.equal(zeroAddress)
        });

        it("Should revert on subscription if plan is inactive ", async () => {
            const { tenxV1, subscriber, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.disableSubscribtionPlan(subscriptionSchemes[0].month);
            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: Subscription plan not active");
        });

        it("Should revert on subscription if Payment token is inactive ", async () => {
            const { tenxV1, subscriber, paymentTokenBnb, zeroAddress} = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.disablePaymentToken(paymentTokenBnb.address);
            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: Payment Token not active");
        });

        it("Should revert on subscription if Amount Payed is less ", async () => {
            const { tenxV1, subscriber, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            const amountToSend = subscriptionAmount.sub(10)
            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                amountToSend,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: amount paid less. increase slippage");
            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(amountToSend) }
            )).to.be.revertedWith("TenX: Mismatch in Amount send");
        });
     
        it("Should revert on subscription if referred User is not registered", async () => {
            const { tenxV1, subscriber, subscriber1, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                subscriber1.address,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: Refered By User Not Onboarded Yet");
        });

        it("Should revert on subscription if referred User is the subscriber", async () => {
            const { tenxV1, subscriber, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                subscriber.address,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: Subscriber cant be the referer");
        });

        it("Should able to refer a user and subscribe", async () => {
            const { tenxV1, subscriber1, subscriber2, zeroAddress, paymentTokenBnb } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.connect(subscriber1).subscribe(                
                subscriber1.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
            const subscribe = await tenxV1.connect(subscriber2).subscribe(                
                subscriber2.address,
                subscriber1.address,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
        
            expect(subscribe).to.have.property('hash')
            const subscriber2Info = await tenxV1.getUserInfo(subscriber2.address)
            expect(subscriber2Info).to.have.property('referedBy')
                .to.be.equal(subscriber1.address)
        });

        it("Should able to subscribe more than once", async () => {
            const { tenxV1, subscriber, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            const initialSubscription = await tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
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
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
            expect(subscribe).to.have.property('hash')

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    zeroAddress,
                    initialSubscriptionValidity.add(schemeValidity),
                    paymentTokenBnb.address,
                    subscriptionAmount);
        });

        it("Should be able to subscribe on discount if applicable ", async () => {
            const { tenxV1, subscriber, zeroAddress, paymentTokenBnb } = await loadFixture(deployTenxFixture);
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
            expect(discountedSubscriptionAmount).to.be.equal(originalSubscriptionAmount.sub(expectedDiscount))
            const subscribe = await tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                discountedSubscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount,
                { value: ethers.BigNumber.from(discountedSubscriptionAmount) }
            )
            expect(subscribe).to.have.property('hash')
        });

        it("Should be able to subscribe for others", async () => {
            const { tenxV1, subscriber, subscriber1, zeroAddress, paymentTokenBnb } = await loadFixture(deployTenxFixture);

            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0
            )
            const subscribe = await tenxV1.connect(subscriber).subscribe(                
                subscriber1.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            expect(subscribe).to.have.property('hash')
            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + (subscriptionSchemes[0].month * 30 * 24 * 60 * 60);

            const subscriber1Info = await tenxV1.getUserInfo(subscriber1.address)
            expect(subscriber1Info).to.have.property('subscriptionValidity')
                .to.be.equal(validity)
            expect(subscriber1Info).to.have.property('isSubscriptionActive')
                .to.be.true
        });

        it("Should split the total amount among all affiliates and share holders correctly", async () => {
            const { 
                tenxV1, 
                subscriber, 
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4, 
                zeroAddress,
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
            let referrer = zeroAddress;
            for(const referral of referrals) {
                await tenxV1.connect(referral).subscribe(                
                    referral.address,
                    referrer,
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    paymentTokenBnb.address,
                    discount,
                    { value: ethers.BigNumber.from(subscriptionAmount) }
                )
                referrer = referral.address
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
                subscriber.address,
                referrer,
                subscriptionAmount,
                subscriptionSchemes[0].month,
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
                zeroAddress,
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
            let referrer = zeroAddress
            for(const referral of referrals) {
                await tenxV1.connect(referral).subscribe(                
                    referral.address,
                    referrer,
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    paymentTokenBnb.address,
                    discount,
                    { value: ethers.BigNumber.from(subscriptionAmount) }
                )
                referrer = referral.address
            }

            const timesToAdd = subscriptionSchemes[0].month * 31 * 24 * 60 * 60; // Assuming 30 days in a month

            await ethers.provider.send("evm_increaseTime", [timesToAdd]);
            await ethers.provider.send("evm_mine");

            const renewedReferals = [subscriber2,subscriber4]

            for(const referral of renewedReferals) {
                await tenxV1.connect(referral).subscribe(                
                    referral.address,
                    zeroAddress,
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
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
                subscriber.address,
                referrer,
                subscriptionAmount,
                subscriptionSchemes[0].month,
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

    describe("Subscription Using BUSD/USDT", async () => {

        it("Should be able subscribe using BNB and emit events", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, zeroAddress, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)

            const subscribe = await tenxV1.connect(subscriber).subscribe(
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            expect(subscribe).to.have.property('hash')

            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + (subscriptionSchemes[0].month * 30 * 24 * 60 * 60);

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    zeroAddress,
                    validity,
                    paymentTokenBusd.address,
                    subscriptionAmount);

            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('referedBy')
                .to.be.equal(zeroAddress)
        });

        it("Should revert on subscription if Payment token is inactive ", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, zeroAddress, busd} = await loadFixture(deployTenxFixture);
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
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )).to.be.revertedWith("TenX: Payment Token not active");
        });

        it("Should revert on subscription if Amount Payed is less ", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, zeroAddress, busd } = await loadFixture(deployTenxFixture);
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
                subscriber.address,
                zeroAddress,
                amountToSend,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )).to.be.revertedWith("TenX: amount paid less. increase slippage");

            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )).to.be.revertedWith("TenX: Insufficient Token Allowance");
        });

        it("Should able to refer a user and subscribe", async () => {
            const { tenxV1, subscriber1, subscriber2, zeroAddress, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )

            await busd.mint(subscriber1.address,1000)
            await busd.connect(subscriber1).approve(tenxV1.address,subscriptionAmount)

            await tenxV1.connect(subscriber1).subscribe(                
                subscriber1.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )

            await busd.mint(subscriber2.address,1000)
            await busd.connect(subscriber2).approve(tenxV1.address,subscriptionAmount)

            const subscribe = await tenxV1.connect(subscriber2).subscribe(                
                subscriber2.address,
                subscriber1.address,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
        
            expect(subscribe).to.have.property('hash')
            const subscriber2Info = await tenxV1.getUserInfo(subscriber2.address)
            expect(subscriber2Info).to.have.property('referedBy')
                .to.be.equal(subscriber1.address)
        });

        it("Should able to subscribe more than once", async () => {
            const { tenxV1, subscriber, paymentTokenBusd, zeroAddress, busd } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)
            const initialSubscription = await tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
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
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            expect(subscribe).to.have.property('hash')

            await expect(subscribe)
                .to.emit(tenxV1, "Subscription")
                .withArgs(
                    subscriber.address,
                    zeroAddress,
                    initialSubscriptionValidity.add(schemeValidity),
                    paymentTokenBusd.address,
                    subscriptionAmount);
        });

        it("Should be able to subscribe on discount if applicable ", async () => {
            const { tenxV1, subscriber, zeroAddress, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);
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
            expect(discountedSubscriptionAmount).to.be.equal(originalSubscriptionAmount.sub(expectedDiscount))
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,discountedSubscriptionAmount)
            const subscribe = await tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                discountedSubscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                discount
            )
            expect(subscribe).to.have.property('hash')
        });

        it("Should be able to subscribe for others", async () => {
            const { tenxV1, subscriber, subscriber1, zeroAddress, paymentTokenBusd, busd } = await loadFixture(deployTenxFixture);

            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                0
            )
            await busd.mint(subscriber.address,1000)
            await busd.connect(subscriber).approve(tenxV1.address,subscriptionAmount)
            const subscribe = await tenxV1.connect(subscriber).subscribe(                
                subscriber1.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBusd.address,
                0
            )

            expect(subscribe).to.have.property('hash')
            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + (subscriptionSchemes[0].month * 30 * 24 * 60 * 60);

            const subscriber1Info = await tenxV1.getUserInfo(subscriber1.address)
            expect(subscriber1Info).to.have.property('subscriptionValidity')
                .to.be.equal(validity)
            expect(subscriber1Info).to.have.property('isSubscriptionActive')
                .to.be.true
        });

        it("Should split the total amount among all affiliates and share holders correctly", async () => {
            const { 
                tenxV1, 
                subscriber, 
                subscriber1,
                subscriber2,
                subscriber3,
                subscriber4, 
                zeroAddress,
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
            let referrer = zeroAddress;
            for(const referral of referrals) {
                await busd.mint(referral.address,1000)
                await busd.connect(referral).approve(tenxV1.address,subscriptionAmount)
                await tenxV1.connect(referral).subscribe(                
                    referral.address,
                    referrer,
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    paymentTokenBusd.address,
                    discount
                )
                referrer = referral.address
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
                subscriber.address,
                referrer,
                subscriptionAmount,
                subscriptionSchemes[0].month,
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
                zeroAddress,
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
            let referrer = zeroAddress
            for(const referral of referrals) {
                await busd.mint(referral.address,1000)
                await busd.connect(referral).approve(tenxV1.address,subscriptionAmount)
                await tenxV1.connect(referral).subscribe(                
                    referral.address,
                    referrer,
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
                    paymentTokenBusd.address,
                    discount
                )
                referrer = referral.address
            }

            const timesToAdd = subscriptionSchemes[0].month * 31 * 24 * 60 * 60; // Assuming 30 days in a month

            await ethers.provider.send("evm_increaseTime", [timesToAdd]);
            await ethers.provider.send("evm_mine");

            const renewedReferals = [subscriber2,subscriber4]

            for(const referral of renewedReferals) {
                await busd.mint(referral.address,1000)
                await busd.connect(referral).approve(tenxV1.address,subscriptionAmount)
                await tenxV1.connect(referral).subscribe(                
                    referral.address,
                    zeroAddress,
                    subscriptionAmount,
                    subscriptionSchemes[0].month,
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
                subscriber.address,
                referrer,
                subscriptionAmount,
                subscriptionSchemes[0].month,
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

    describe("Give/Cancel  Subscription Initiated by Manager", async () => {
        
        it("Should be able for manager to give free subscription to user and emit event", async () => {
            const { tenxV1, subscriber, zeroAddress } = await loadFixture(deployTenxFixture);

            const oneDay = 1 * 24 * 60 * 60;

            const subscribe = await tenxV1.addSubscriptionForUser(
                subscriber.address,
                zeroAddress,
                oneDay
            )
            expect(subscribe).to.have.property('hash')

            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + oneDay;

            await expect(subscribe)
                .to.emit(tenxV1, "FreeSubscription")
                .withArgs(
                    subscriber.address,
                    zeroAddress,
                    validity
                    );
    
            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('referedBy')
                .to.be.equal(zeroAddress)

            await ethers.provider.send("evm_increaseTime", [oneDay + 1000]);
            await ethers.provider.send("evm_mine");
            
            const userSubscriptionAfter = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscriptionAfter).to.have.property('isSubscriptionActive')
                .to.be.false
        });

        it("Should be able for manager to give free subscription to user with referals and emit event", async () => {
            const { tenxV1, subscriber, subscriber1, zeroAddress } = await loadFixture(deployTenxFixture);
            const oneDay = 1 * 24 * 60 * 60;

            await tenxV1.addSubscriptionForUser(
                subscriber1.address,
                zeroAddress,
                oneDay
            )
            
            const initialSubscriber = await tenxV1.getUserInfo(subscriber1.address) 
            expect(initialSubscriber).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(initialSubscriber).to.have.property('referedBy')
                .to.be.equal(zeroAddress)

            const subscribe = await tenxV1.addSubscriptionForUser(
                subscriber.address,
                subscriber1.address,
                oneDay
            )
            expect(subscribe).to.have.property('hash')

            const receipt = await subscribe.wait();
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            const validity = block.timestamp + oneDay;

            await expect(subscribe)
                .to.emit(tenxV1, "FreeSubscription")
                .withArgs(
                    subscriber.address,
                    subscriber1.address,
                    validity
                    );
    
            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('subscriptionValidity')
                .to.be.equal(validity)
            expect(userSubscription).to.have.property('referedBy')
                .to.be.equal(subscriber1.address)
        });

        it("Should recieve affiliate share for manager subscribed users", async () => {
            const { tenxV1, subscriber, subscriber1, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const oneDay = 1 * 24 * 60 * 60;

            await tenxV1.addSubscriptionForUser(
                subscriber1.address,
                zeroAddress,
                oneDay
            )
            
            const refererInitialBalance = await ethers.provider.getBalance(subscriber1.address)
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
                subscriber.address,
                subscriber1.address,
                subscriptionAmount,
                subscriptionSchemes[0].month,
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

        it("Should be able for manager to cancel subscription of user and emit event", async () => {
            const { tenxV1, subscriber, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            
            const cancelSubscription = await tenxV1.cancelSubscriptionForUser(subscriber.address)
            expect(cancelSubscription).to.have.property('hash')
            const cancelReceipt = await cancelSubscription.wait();
            const block = await ethers.provider.getBlock(cancelReceipt.blockNumber);

            await expect(cancelSubscription)
            .to.emit(tenxV1, "CancelSubscription")
            .withArgs(
                subscriber.address,
                block.timestamp);

            const userSubscriptionAfter = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscriptionAfter).to.have.property('isSubscriptionActive')
                .to.be.false
        });
    })

    describe("Suspend Subscribers", async () => {
        
        it("Should be able to suspend and activate a subscriber and emit event", async () => {
            const { tenxV1, subscriber, zeroAddress } = await loadFixture(deployTenxFixture);

            const validity = subscriptionSchemes[0].month * 30 * 24 * 60 * 60

            const subscribe = await tenxV1.addSubscriptionForUser(
                subscriber.address,
                zeroAddress,
                validity
            )
            expect(subscribe).to.have.property('hash')
    
            const userSubscription = await tenxV1.getUserInfo(subscriber.address) 
            expect(userSubscription).to.have.property('isSubscriptionActive')
                .to.be.true
            expect(userSubscription).to.have.property('suspended')
                .to.be.false

            const suspend = await tenxV1.disableUser(subscriber.address)
            expect(suspend).to.have.property('hash')

            await expect(suspend)
            .to.emit(tenxV1, "EnableDisableSubscriber")
            .withArgs(
                subscriber.address,
                false
            );

            const enable = await tenxV1.enableUser(subscriber.address)
            expect(enable).to.have.property('hash')

            await expect(enable)
            .to.emit(tenxV1, "EnableDisableSubscriber")
            .withArgs(
                subscriber.address,
                true
            );
        });

        it("Should revert if already suspended or active", async () => {
            const { tenxV1, subscriber, zeroAddress } = await loadFixture(deployTenxFixture);
            const validity = subscriptionSchemes[0].month * 30 * 24 * 60 * 60

            await tenxV1.addSubscriptionForUser(
                subscriber.address,
                zeroAddress,
                validity
            )    
            
            await expect(tenxV1.enableUser(subscriber.address))
                .to.be.revertedWith("TenX: User Already Active");
        
            await tenxV1.disableUser(subscriber.address)

            await expect(tenxV1.disableUser(subscriber.address))
                .to.be.revertedWith("TenX: User Already Suspended or not onboarded");
        });

        it("Should revert if suspended users subscribe", async () => {
            const { tenxV1, subscriber, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            const suspend = await tenxV1.disableUser(subscriber.address)
            expect(suspend).to.have.property('hash')

            await expect(tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )).to.be.revertedWith("TenX: User suspended");
        });

        it("Should not receive referal percentage for suspended users", async () => {
            const { tenxV1, subscriber, subscriber1, paymentTokenBnb, zeroAddress } = await loadFixture(deployTenxFixture);
            const discount = 0
            const subscriptionAmount = await tenxV1.getSubscriptionAmount(
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                discount
            )
            await tenxV1.connect(subscriber).subscribe(                
                subscriber.address,
                zeroAddress,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )

            await tenxV1.disableUser(subscriber.address)
            const refererInitialBalance = await ethers.provider.getBalance(subscriber.address)

            await tenxV1.connect(subscriber1).subscribe(   
                subscriber1.address,             
                subscriber.address,
                subscriptionAmount,
                subscriptionSchemes[0].month,
                paymentTokenBnb.address,
                0,
                { value: ethers.BigNumber.from(subscriptionAmount) }
            )
            const refererFinalBalance = await ethers.provider.getBalance(subscriber.address)
            expect(refererInitialBalance).to.be.equal(refererFinalBalance)
        });
    })
});