
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
    async function deployTokenFixture() {

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

    describe("Check Manager Role", async () => {

        it("Should be able to check the role", async () => {
            const { tenxV1, deployer } = await loadFixture(deployTokenFixture);
            const managerRole = await tenxV1.MANAGER_ROLE();
            const isManager = await tenxV1.hasRole(managerRole, deployer.address);
            expect(isManager).to.be.true;
        });

        it("Should be able to add new manager successfully", async () => {
            const { newManager, tenxV1 } = await loadFixture(deployTokenFixture);
            const managerRole = await tenxV1.MANAGER_ROLE();
            await tenxV1.grantRole(managerRole, newManager.address);
            const isManager = await tenxV1.hasRole(managerRole, newManager.address);
            expect(isManager).to.be.true;
        });

        it("Should revert for unauthorized wallet", async () => {
            const { newManager, tenxV1 } = await loadFixture(deployTokenFixture);
            await expect(tenxV1.connect(newManager).pause()
            ).to.be.revertedWith("Tenx: Not Admin or Manager");
        });
    });

    // describe("Check Scheme configuration", async () => {
    //     it("Should be able to add new Schema", async () => {
    //         const { tenxV1 } = await loadFixture(deployTokenFixture);
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
    //         const { tenxV1 } = await loadFixture(deployTokenFixture);
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
    //         const { tenxV1 } = await loadFixture(deployTokenFixture);
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
    //         const { tenxV1 } = await loadFixture(deployTokenFixture);
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
    //         const { deployer, tenxV1 } = await loadFixture(deployTokenFixture);
    //         await deployer.sendTransaction({ to: tenxV1.address, value: await ethers.utils.parseEther("100.0") })
    //         const balance = await ethers.provider.getBalance(tenxV1.address);
    //         expect(balance).to.be.equal(ethers.utils.parseEther("100.0"));
    //     });
    // });

    // describe("Check Pause and Unpause", async () => {
    //     it("Should Pause the contract", async () => {
    //         const { tenxV1, deployer } = await loadFixture(deployTokenFixture);
    //         expect(await tenxV1.paused()).to.be.equal(false);
    //         await tenxV1.pause();
    //         expect(await tenxV1.paused()).to.be.equal(true);
    //     });

    //     it("Should UnPause the contract", async () => {
    //         const { tenxV1,deployer } = await loadFixture(deployTokenFixture);
    //         await tenxV1.pause();
    //         expect(await tenxV1.paused()).to.be.equal(true);
    //         await tenxV1.unpause();
    //         expect(await tenxV1.paused()).to.be.equal(false);

    //     });
    // });
});
