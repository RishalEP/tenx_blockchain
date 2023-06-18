const { ethers } = require('hardhat');
const hre = require("hardhat");
const saveToConfig = require('../utils/saveToConfig');
const { MAINNET_VALUES, TESTNET_VALUES } = require('../config');

async function main() {
    const chainCheck = hre.network.config.chainId == 56
    const {
        shareHolders,
        subscriptionSchemes,
        referalPercantage,
        reinvestmentWallet,
        paymentTokens,
        shareHolderLimit,
        referalLimit
   } = chainCheck ? MAINNET_VALUES : TESTNET_VALUES
    const TENX = await ethers.getContractFactory("TenxUpgradableV1");
    const TenXABI = (await artifacts.readArtifact('TenxUpgradableV1')).abi
    await saveToConfig('TenxUpgradableV1', 'ABI', TenXABI)
    const tenX = await upgrades.deployProxy(
        TENX,
        [
          [shareHolders.length,shareHolderLimit],
          [referalPercantage.length, referalLimit],
          reinvestmentWallet
        ],
        { initializer: "initialize" }
    );
    await saveToConfig('TenxUpgradableV1', 'ADDRESS', tenX.address)
    await saveToConfig('TenxUpgradableV1', 'CHAINID', hre.network.config.chainId)
    console.log(`TenxUpgradableV1:- ${tenX.address} `);

    const setReferalPercantage = await tenX.setReferralPercentages(
        referalPercantage
    );
        console.log("Set Referal Percants Hash" , " :-", setReferalPercantage.hash);
    
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
    const addShareHolder = await tenX.setShareHolders(
        shareHoldersInfo.names,
        shareHoldersInfo.address,
        shareHoldersInfo.percentage
    );
        console.log("Add Share Holders Hash :-", addShareHolder.hash);
    
    for(const scheme of subscriptionSchemes) {
        const addScheme = await tenX.addSubscriptionPlan(
            scheme.month,
            scheme.price
        );
        console.log("Add Scheme Hash for Month", scheme.month, " :-", addScheme.hash);
    }

    for(const token of paymentTokens) {
        const addPaymentToken = await tenX.addPaymentToken(
            token.address,
            token.priceFeed
        );
        console.log("Add Token Hash for Token", token.address, " :-", addPaymentToken.hash);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

