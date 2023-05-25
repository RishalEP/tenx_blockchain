
const {
    loadFixture,
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

describe("Tenx Contract Configuration", async () => {
    async function deployTenxFixture() {

        const [deployer, newManager] = await ethers.getSigners();

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

        return {
            deployer,
            newManager,
            tenxV1
        };
    }

    describe("Manager Role", async () => {

        it("Should be able to check the role", async () => {
            const { tenxV1, deployer } = await loadFixture(deployTenxFixture);
            const managerRole = await tenxV1.MANAGER_ROLE();
            const isManager = await tenxV1.hasRole(managerRole, deployer.address);
            expect(isManager).to.be.true;
        });

        it("Should be able to add new manager successfully", async () => {
            const { newManager, tenxV1 } = await loadFixture(deployTenxFixture);
            const managerRole = await tenxV1.MANAGER_ROLE();
            await tenxV1.grantRole(managerRole, newManager.address);
            const isManager = await tenxV1.hasRole(managerRole, newManager.address);
            expect(isManager).to.be.true;
        });

        it("Should revert for unauthorized wallet", async () => {
            const { newManager, tenxV1 } = await loadFixture(deployTenxFixture);
            await expect(tenxV1.connect(newManager).pause()
            ).to.be.revertedWith("Tenx: Not Admin or Manager");
        });
    });

    describe("Pause and Unpause", async () => {
        it("Should Pause the contract", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            expect(await tenxV1.paused()).to.be.equal(false);
            await tenxV1.pause();
            expect(await tenxV1.paused()).to.be.equal(true);
        });

        it("Should UnPause the contract", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.pause();
            expect(await tenxV1.paused()).to.be.equal(true);
            await tenxV1.unpause();
            expect(await tenxV1.paused()).to.be.equal(false);
        });
    });

    describe("Reinvestment, ShareHolders and Affiliates", async () => {

        it("Should be able to Fetch ReinvestMent Wallet", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            const getReinvestment = await tenxV1.getReinvestmentWallet();
            expect(getReinvestment).to.equal(reinvestmentWallet);
        });

        it("Should be able to Fetch ShareHolders and Affiliates info", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.getShareAndReferalInfo();
            expect(await tenxV1.getShareAndReferalInfo())
                .to.have.property('totalShareHolders')
                .to.equal(shareHolders.length);
            expect(await tenxV1.getShareAndReferalInfo())
                .to.have.property('totalReferalLevels')
                .to.equal(referalPercantage.length);
        });

        it("Should be able to update Reinvestment Wallet and emit event", async () => {
            const { tenxV1, newManager } = await loadFixture(deployTenxFixture);
            const updateReinvest = await tenxV1.updateReinvestmentWallet(newManager.address);
            const receipt = await updateReinvest.wait();
            expect(updateReinvest).to.have.property('hash')
            const event = receipt.events.find((event) =>
                event.event === 'ReInvestmentWalletUpdate'
                );
            expect(event).to.not.be.undefined;
            expect(event.args.reinvestWallet).to.equal(newManager.address);
            expect(await tenxV1.getReinvestmentWallet()).to.equal(newManager.address);
        });

        it("Should be able to set Affiliate Percentages", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.setReferralPercentages(referalPercantage);
            for (const [index, level] of referalPercantage.entries()) {
                expect(await tenxV1.getReferalPercentage(index))
                    .to.equal(level);
            }
        });

        it("Should be able to set ShareHolders", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
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
            for (const [index, holder] of shareHolders.entries()) {
                const getHolder = await tenxV1.getShareHolder(index)
                expect(getHolder).to.have.property('name').to.equal(holder.name);
                expect(getHolder).to.have.property('walletAddress')
                    .to.equal(holder.address);
                expect(getHolder).to.have.property('sharePercentage')
                    .to.equal(holder.percentage);
                expect(getHolder).to.have.property('status')
                    .to.be.true;
            }
        });

        it("Should be able to update Referal Limit/Levels and the percentages", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            const toUpdatePercentage = [...referalPercantage,200]
            const newLimit = referalLimit + 200
            const updateInfo = await tenxV1.setReferralInfo(
                [toUpdatePercentage.length,newLimit],
                toUpdatePercentage
            )
            expect(updateInfo).to.have.property('hash')
            expect(await tenxV1.getShareAndReferalInfo())
                .to.have.property('totalReferalLevels')
                .to.equal(toUpdatePercentage.length);
            expect(await tenxV1.getShareAndReferalInfo())
                .to.have.property('percantReferalLimit')
                .to.equal(newLimit);
            for (const [index, level] of toUpdatePercentage.entries()) {
                expect(await tenxV1.getReferalPercentage(index))
                    .to.equal(level);
            }
        });

        it("Should be able to update Share Holders Limit/Levels and the other holder informations", async () => {
            const { tenxV1,newManager } = await loadFixture(deployTenxFixture);
            const toUpdateShareHolders = [
                ...shareHolders,
                {
                "name":"Sanjay",
                "address":newManager.address,
                "percentage":500
                }]
            const newLimit = shareHolderLimit + 500
            let shareHoldersInfo = {
                names:[],
                address:[],
                percentage:[]
            }
            for(const holder of toUpdateShareHolders) {
                shareHoldersInfo = {
                    names:[...shareHoldersInfo.names,holder.name],
                    address:[...shareHoldersInfo.address,holder.address],
                    percentage:[...shareHoldersInfo.percentage,holder.percentage]
                }
            }
            const updateInfo = await tenxV1.setShareHolderInfo(
                [toUpdateShareHolders.length,newLimit],
                shareHoldersInfo.names,
                shareHoldersInfo.address,
                shareHoldersInfo.percentage
            )
            expect(updateInfo).to.have.property('hash')
            expect(await tenxV1.getShareAndReferalInfo())
                .to.have.property('totalShareHolders')
                .to.equal(toUpdateShareHolders.length);
            expect(await tenxV1.getShareAndReferalInfo())
                .to.have.property('percantShareLimit')
                .to.equal(newLimit);
            for (const [index, holder] of toUpdateShareHolders.entries()) {
                const getHolder = await tenxV1.getShareHolder(index)
                expect(getHolder).to.have.property('name').to.equal(holder.name);
                expect(getHolder).to.have.property('walletAddress')
                    .to.equal(holder.address);
                expect(getHolder).to.have.property('sharePercentage')
                    .to.equal(holder.percentage);
                expect(getHolder).to.have.property('status')
                    .to.be.true;
            }
        });

    });

    describe("Subscription Plans", async () => {

        it("Should be able to set all initial plans and emit event", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            for(const scheme of subscriptionSchemes) {
                const addScheme = await tenxV1.addSubscriptionPlan(
                    scheme.month,
                    scheme.price
                );
                const receipt = await addScheme.wait();
                expect(addScheme).to.have.property('hash')
                const event = receipt.events.find((event) =>
                    event.event === 'AddEditSubscriptionScheme'
                    );
                expect(event).to.not.be.undefined;
                expect(event.args.months).to.equal(scheme.month);
                expect(event.args.price).to.equal(scheme.price);
                const schemePlan = await tenxV1.getSchemePlanInfo(scheme.month)
                expect(schemePlan).to.have.property('price').to.equal(scheme.price)
                expect(schemePlan).to.have.property('status').to.be.true
            }
        });

        it("Should revert if price or plan is zero", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await expect(tenxV1.addSubscriptionPlan(0,1))
                .to.be.revertedWith("TenX: month or price zero");
            await expect(tenxV1.addSubscriptionPlan(1,0))
                .to.be.revertedWith("TenX: month or price zero");           
        });

        it("Should revert if a plan already exists", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            await expect(tenxV1.addSubscriptionPlan(1,1))
                .to.be.revertedWith("TenX: Plan Already Exists");
        });

        it("Should able to disable/enable a scheme and emit event", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            const disable = await tenxV1.disableSubscribtionPlan(1);
            const receiptDisable = await disable.wait();
            expect(disable).to.have.property('hash')
            const eventDisable = receiptDisable.events.find((event) =>
                event.event === 'EnableDisableSubscriprionScheme'
                );
            expect(eventDisable).to.not.be.undefined;
            expect(eventDisable.args.months).to.equal(1);
            expect(eventDisable.args.status).to.be.false;

            expect(await tenxV1.getSchemePlanInfo(1))
                .to.have.property('status').to.be.false 
            
            const enable = await tenxV1.enableSubscribtionPlan(1);
            const receiptEnable = await enable.wait();
            expect(enable).to.have.property('hash')
            const eventEnable = receiptEnable.events.find((event) =>
                event.event === 'EnableDisableSubscriprionScheme'
                );
            expect(eventEnable).to.not.be.undefined;
            expect(eventEnable.args.months).to.equal(1);
            expect(eventEnable.args.status).to.be.true;
            expect(await tenxV1.getSchemePlanInfo(1))
                .to.have.property('status').to.be.true 
        });

        it("Should revert if already disable/enabled", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            await expect(tenxV1.enableSubscribtionPlan(1))
                .to.be.revertedWith("TenX: Plan Already Active");
            await tenxV1.disableSubscribtionPlan(1);
            await expect(tenxV1.disableSubscribtionPlan(1))
                .to.be.revertedWith("TenX: Plan Does not Exists or Already Disabled");
        });

        it("Should able to change subscription plan's price if not disabled and emit event", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            const setPrice = await tenxV1.changeSubscriptionPricing(1,2);
            const receipt = await setPrice.wait();
            expect(setPrice).to.have.property('hash')
            const event = receipt.events.find((event) =>
                event.event === 'AddEditSubscriptionScheme'
                );
            expect(event).to.not.be.undefined;
            expect(event.args.months).to.equal(1);
            expect(event.args.price).to.equal(2);
            const schemePlan = await tenxV1.getSchemePlanInfo(1)
            expect(schemePlan).to.have.property('price').to.equal(2)
            await expect(tenxV1.changeSubscriptionPricing(1,2))
                .to.be.revertedWith("TenX: Try a different price");
            await tenxV1.disableSubscribtionPlan(1);
            await expect(tenxV1.changeSubscriptionPricing(1,3))
                .to.be.revertedWith("TenX: Plan Does not Exists or Disabled");
        });
    });

    describe("Payment Tokens", async () => {

        it("Should be able to add payment tokens and emit event", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            for(const token of paymentTokens) {
                const addPaymentToken = await tenxV1.addPaymentToken(
                    token.address,
                    token.priceFeed
                );
                expect(addPaymentToken).to.have.property('hash')
                const receipt = await addPaymentToken.wait();
                const event = receipt.events.find((event) =>
                    event.event === 'AddEditPaymentToken'
                    );
                expect(event).to.not.be.undefined;
                expect(event.args.paymentToken).to.equal(token.address);
                expect(event.args.priceFeed).to.equal(token.priceFeed);
                expect(await tenxV1.getPaymentTokenInfo(token.address))
                    .to.have.property('priceFeed').to.equal(token.priceFeed)
                expect(await tenxV1.getPaymentTokenInfo(token.address))
                    .to.have.property('status').to.be.true
            }
        });

        it("Should able to update the pricefeed if payment token is added and active", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addPaymentToken(
                paymentTokens[0].address,
                paymentTokens[0].priceFeed
            );
            const changeFeed = await tenxV1.changePriceFeed(
                paymentTokens[0].address,
                paymentTokens[1].priceFeed
            );
            expect(changeFeed).to.have.property('hash')
                const receipt = await changeFeed.wait();
                const event = receipt.events.find((event) =>
                    event.event === 'AddEditPaymentToken'
                    );
            expect(event).to.not.be.undefined;
            expect(event.args.paymentToken).to.equal(paymentTokens[0].address);
            expect(event.args.priceFeed).to.equal(paymentTokens[1].priceFeed);
            expect(await tenxV1.getPaymentTokenInfo(paymentTokens[0].address))
                .to.have.property('priceFeed').to.equal(paymentTokens[1].priceFeed)
            await expect(tenxV1.changePriceFeed(
                paymentTokens[1].address,paymentTokens[1].priceFeed))
                .to.be.revertedWith("TenX: PaymentToken not added or disabled");
        });
    
        it("Should able to disable/enable a payment token and emit event", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addPaymentToken(paymentTokens[0].address,paymentTokens[0].priceFeed);
            const disable = await tenxV1.disablePaymentToken(paymentTokens[0].address);
            const receiptDisable = await disable.wait();
            expect(disable).to.have.property('hash')
            const eventDisable = receiptDisable.events.find((event) =>
                event.event === 'EnableDisablePaymentToken'
                );
            expect(eventDisable).to.not.be.undefined;
            expect(eventDisable.args.paymentToken).to.equal(paymentTokens[0].address);
            expect(eventDisable.args.status).to.be.false;
            expect(await tenxV1.getPaymentTokenInfo(paymentTokens[0].address))
                .to.have.property('status').to.be.false 

            const enable = await tenxV1.enablePaymentToken(paymentTokens[0].address);
            const receiptEnable = await enable.wait();
            expect(enable).to.have.property('hash')
            const eventEnable = receiptEnable.events.find((event) =>
                event.event === 'EnableDisablePaymentToken'
                );
            expect(eventEnable).to.not.be.undefined;
            expect(eventEnable.args.paymentToken).to.equal(paymentTokens[0].address);
            expect(eventEnable.args.status).to.be.true;
            expect(await tenxV1.getPaymentTokenInfo(paymentTokens[0].address))
                .to.have.property('status').to.be.true 
        });

        it("Should revert if already disable/enabled", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addPaymentToken(paymentTokens[0].address,paymentTokens[0].priceFeed);
            await expect(tenxV1.enablePaymentToken(paymentTokens[0].address))
                .to.be.revertedWith("TenX: PaymentToken already active");
            await tenxV1.disablePaymentToken(paymentTokens[0].address);
            await expect(tenxV1.disablePaymentToken(paymentTokens[0].address))
                .to.be.revertedWith("TenX: PaymentToken not added or already disabled");
        });
    });
});
