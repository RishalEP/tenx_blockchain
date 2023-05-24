
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

describe.only("Tenx Contract Configuration", async () => {
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
            const getInfo = await tenxV1.getShareAndReferalInfo();
            expect(getInfo)
                .to.have.property('totalShareHolders')
                .to.equal(shareHolders.length);
        });

        it("Should be able to update Reinvestment Wallet", async () => {
            const { tenxV1, newManager } = await loadFixture(deployTenxFixture);
            await tenxV1.updateReinvestmentWallet(newManager.address);
            expect(await tenxV1.getReinvestmentWallet())
                .to.equal(newManager.address);
        });
        it("Should be able to set Affiliate Percentages", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.updateReinvestmentWallet(newManager.address);
            expect(await tenxV1.getReinvestmentWallet())
                .to.equal(newManager.address);
        });
    });

    describe("Subscription Plans", async () => {

        it("Should be able to set all initial plans", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            for(const scheme of subscriptionSchemes) {
                const addScheme = await tenxV1.addSubscriptionPlan(
                    scheme.month,
                    scheme.price
                );
                expect(addScheme).to.have.property('hash')
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

        it("Should able to disable/enable a scheme", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            await tenxV1.disableSubscribtionPlan(1);
            expect(await tenxV1.getSchemePlanInfo(1))
                .to.have.property('status').to.be.false 
            await tenxV1.enableSubscribtionPlan(1);
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

        it("Should able to change subscription plan's price if not disabled", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            await tenxV1.changeSubscriptionPricing(1,2);
            const schemePlan = await tenxV1.getSchemePlanInfo(1)
            expect(schemePlan).to.have.property('price').to.equal(2)
            await expect(tenxV1.changeSubscriptionPricing(1,2))
                .to.be.revertedWith("TenX: Try a different price");
            await tenxV1.disableSubscribtionPlan(1);
            await expect(tenxV1.changeSubscriptionPricing(1,3))
                .to.be.revertedWith("TenX: Plan Does not Exists or Disabled");
        });

        // it("Should be able to Fetch ShareHolders and Affiliates info", async () => {
        //     const { tenxV1 } = await loadFixture(deployTenxFixture);
        //     const getInfo = await tenxV1.getShareAndReferalInfo();
        //     expect(getInfo)
        //         .to.have.property('totalShareHolders')
        //         .to.equal(shareHolders.length);
        //     expect(getInfo)
        //         .to.have.property('percantShareLimit')
        //         .to.equal(shareHolderLimit);
        //     expect(getInfo)
        //         .to.have.property('totalReferalLevels')
        //         .to.equal(referalPercantage.length);
        //     expect(getInfo)
        //         .to.have.property('percantreferalLimit')
        //         .to.equal(referalLimit);
        // });
    });

    describe("Subscription Plans", async () => {

        it("Should be able to set all initial plans", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            for(const scheme of subscriptionSchemes) {
                const addScheme = await tenxV1.addSubscriptionPlan(
                    scheme.month,
                    scheme.price
                );
                expect(addScheme).to.have.property('hash')
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

        it("Should able to disable/enable a scheme", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            await tenxV1.disableSubscribtionPlan(1);
            expect(await tenxV1.getSchemePlanInfo(1))
                .to.have.property('status').to.be.false 
            await tenxV1.enableSubscribtionPlan(1);
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

        it("Should able to change subscription plan's price if not disabled", async () => {
            const { tenxV1 } = await loadFixture(deployTenxFixture);
            await tenxV1.addSubscriptionPlan(1,1);
            await tenxV1.changeSubscriptionPricing(1,2);
            const schemePlan = await tenxV1.getSchemePlanInfo(1)
            expect(schemePlan).to.have.property('price').to.equal(2)
            await expect(tenxV1.changeSubscriptionPricing(1,2))
                .to.be.revertedWith("TenX: Try a different price");
            await tenxV1.disableSubscribtionPlan(1);
            await expect(tenxV1.changeSubscriptionPricing(1,3))
                .to.be.revertedWith("TenX: Plan Does not Exists or Disabled");
        });

       
    });

    // describe("Fetch Reinvestment wallet", async () => {

    //     it("Should be able to Fetch ReinvestMent Wallet", async () => {
    //         const { tenxV1 } = await loadFixture(deployTenxFixture);
    //         const getReinvestment = await tenxV1.getReinvestmentWallet();
    //         expect(getReinvestment).to.equal(reinvestmentWallet);
    //     });
    // });

    // describe("Check Scheme configuration", async () => {
    //     it("Should be able to add new Schema", async () => {
    //         const { tenxV1 } = await loadFixture(deployTenxFixture);
    //         const stakeYield = ethers.utils.parseUnits(
    //             STAKINGSCHEMAS[0].stakingYield,
    //             18
    //         ) 
    //         await tenxV1.createStakeScheme(
    //                 STAKINGSCHEMAS[0].lockingPeriod,
    //                 stakeYield
    //             );
    //         const response = await tenxV1.getSchemeInfo(1);
    //         const oneMonthInSeconds = 30 * 24 * 60 * 60;

    //         expect(response.stakingYield).to.be.equal(stakeYield);
    //         expect(response.lockingPeriod).to.be.equal(oneMonthInSeconds);
    //         expect(response.currentStake).to.be.equal(0);
    //         expect(response.rewardGenerated).to.be.equal(0);
    //         expect(response.active).to.be.true;
    //     });

    //     it("Should revert if stake scheme already exist", async () => {
    //         const { tenxV1 } = await loadFixture(deployTenxFixture);
    //         const stakeYield = ethers.utils.parseUnits(
    //             STAKINGSCHEMAS[0].stakingYield,
    //             18
    //         ) 
    //         await tenxV1.createStakeScheme(
    //                 STAKINGSCHEMAS[0].lockingPeriod,
    //                 stakeYield
    //             );
    //         await expect(tenxV1.createStakeScheme(
    //                 STAKINGSCHEMAS[0].lockingPeriod,
    //                 stakeYield
    //             )).to.be.revertedWith("Tenx: scheme already exist");
    //     });

    //     it("Should be able to de activate a Schema", async () => {
    //         const { tenxV1 } = await loadFixture(deployTenxFixture);
    //         const stakeYield = ethers.utils.parseUnits(
    //             STAKINGSCHEMAS[0].stakingYield,
    //             18
    //         ) 
    //         await tenxV1.createStakeScheme(
    //                 STAKINGSCHEMAS[0].lockingPeriod,
    //                 stakeYield
    //             );

    //         await tenxV1.disableSchema(1);
    //         const response = await tenxV1.getSchemeInfo(1);
    //         expect(response.active).to.be.false;
    //     });

    //     it("Should be able to activate a Schema", async () => {
    //         const { tenxV1 } = await loadFixture(deployTenxFixture);
    //         const stakeYield = ethers.utils.parseUnits(
    //             STAKINGSCHEMAS[0].stakingYield,
    //             18
    //         ) 
    //         await tenxV1.createStakeScheme(
    //                 STAKINGSCHEMAS[0].lockingPeriod,
    //                 stakeYield
    //             );

    //         await tenxV1.disableSchema(1);
    //         await tenxV1.enableSchema(1);

    //         const response = await tenxV1.getSchemeInfo(1)
    //         expect(response.active).to.be.true;
    //     });
    // });

    // describe("Deposit Native Coin", async () => {
    //     it("Should be able to Deposit Native Coin", async () => {
    //         const { deployer, tenxV1 } = await loadFixture(deployTenxFixture);
    //         await deployer.sendTransaction({ to: tenxV1.address, value: await ethers.utils.parseEther("100.0") })
    //         const balance = await ethers.provider.getBalance(tenxV1.address);
    //         expect(balance).to.be.equal(ethers.utils.parseEther("100.0"));
    //     });
    // });
});
