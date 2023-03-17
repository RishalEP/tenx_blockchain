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

    const tokensToAdd = paymentTokens[hre.network.config.chainId]

    if(tokensToAdd !== undefined){
        const addNativeToken = await tenX.addPaymentToken(
            tokensToAdd.nativeToken.address,
            tokensToAdd.nativeToken.priceFeed
        )
        
        console.log(`TENX:- Native token added Hash - ${addNativeToken.hash} `);

        const addCustomToken = await tenX.addPaymentToken(
            tokensToAdd.customToken.address,
            tokensToAdd.customToken.priceFeed
        )

        await saveToConfig('BUSD', 'ADDRESS', tokensToAdd.customToken.address)
        console.log(`TENX:- Custom token added Hash - ${addCustomToken.hash} `);
    }
    else{
        console.log(`Payment Tokens and Pricefeeds for the selected network is not added`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

