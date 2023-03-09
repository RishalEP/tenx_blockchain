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
    pricing
} = require('./helper/arguments')


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
    console.log(`TENX:- ${tenX.address} `);

    if(!chainCheck){
        const BUSD = await ethers.getContractFactory("BUSD");
        const BUSDABI = (await artifacts.readArtifact('BUSD')).abi
        await saveToConfig('BUSD', 'ABI', BUSDABI)
        const busd = await BUSD.deploy();
        await saveToConfig('BUSD', 'ADDRESS', busd.address)
        console.log(`BUSD:- ${busd.address} `);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

