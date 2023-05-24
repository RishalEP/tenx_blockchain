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

        const [deployer, subscriber1, subscriber2] = await ethers.getSigners();

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

        await tenX.setReferralPercentages(
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

        await tenX.setShareHolders(
            shareHoldersInfo.names,
            shareHoldersInfo.address,
            shareHoldersInfo.percentage
        );

        for(const scheme of subscriptionSchemes) {
            await tenX.addSubscriptionPlan(
                scheme.month,
                scheme.price
            );
        }

        const updatedPaymentTokens = [
            ...paymentTokens[0],
            {
                address:busd.address,
                priceFeed:paymentTokens[1].priceFeed
            }
        ]

        for(const token of updatedPaymentTokens) {
            await tenX.addPaymentToken(
                token.address,
                token.priceFeed
            );
        }

        return {
            deployer,
            newManager,
            tenxV1,
            subscriber1,
            subscriber2,
            paymentTokenBnb:updatedPaymentTokens[0],
            paymentTokenBusd:updatedPaymentTokens[1],
            shareHolderWallets:shareHoldersInfo.address
        };
    }

    describe("Subscription Using BNB", async () => {

        it("Should be able subscribe using BNB", async () => {
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
});