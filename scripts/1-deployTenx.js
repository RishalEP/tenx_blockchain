const { ethers } = require('hardhat');
const hre = require("hardhat");
const saveToConfig = require('../utils/saveToConfig')

const {
    shareHolderMainWallet, 
    shareHolderSubWallet,
    shareHolderPercant,
    reinvestMainWallet,
    reinvestSubWallet,
    referalPercantage,
    months,
    pricing,
    nativeToken,
    paymentTokens
} = require('../helper/arguments')


async function main() {
    const chainCheck = (hre.network.config.chainId == 56 || hre.network.config.chainId == 97)

    const TENX = await ethers.getContractFactory("TenX");
    const TenXABI = (await artifacts.readArtifact('TenX')).abi
    await saveToConfig('TenX', 'ABI', TenXABI)
    const tenX = await TENX.deploy(
            chainCheck ? shareHolderMainWallet:shareHolderSubWallet,
            shareHolderPercant,
            chainCheck ? reinvestMainWallet:reinvestSubWallet,
            referalPercantage.length,
            referalPercantage,
            months,
            pricing
        );

    await saveToConfig('TenX', 'ADDRESS', tenX.address)
    await saveToConfig('TenX', 'CHAINID', hre.network.config.chainId)
    console.log(`TENX:- ${tenX.address} `);

    if(!chainCheck){
        const BUSD = await ethers.getContractFactory("BUSD");
        const BUSDABI = (await artifacts.readArtifact('BUSD')).abi
        await saveToConfig('BUSD', 'ABI', BUSDABI)
        const busd = await BUSD.deploy();
        await saveToConfig('BUSD', 'ADDRESS', busd.address)
        await saveToConfig('BUSD', 'CHAINID', hre.network.config.chainId)
        console.log(`BUSD:- ${busd.address} `);
    }

    const tokensToAdd = paymentTokens[hre.network.config.chainId]
    if(tokensToAdd !== undefined){
        const addNativeToken = await tenX.addPaymentToken(
            tokensToAdd.nativeToken.address,
            tokensToAdd.nativeToken.priceFeed
        )

        console.log({addNativeToken})

        const addCustomToken = await tenX.addPaymentToken(
            tokensToAdd.customToken.address,
            tokensToAdd.customToken.priceFeed
        )

        console.log({addCustomToken})
    }
    else{
        console.log(`Payment Tokens and Pricefeeds not added in the list`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

