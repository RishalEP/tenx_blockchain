const { ethers } = require('hardhat');
const hre = require("hardhat");
const saveToConfig = require('../utils/saveToConfig')

async function main() {

        const USDT = await ethers.getContractFactory("ERC20Token");
        const ERC20TokenABI = (await artifacts.readArtifact('BUSD')).abi
        await saveToConfig('ERC20', 'ABI', ERC20TokenABI)
        const busd = await USDT.deploy('USDT Token', 'USDT');
        await saveToConfig('USDT', 'ADDRESS', USDT.address)
        await saveToConfig('USDT', 'CHAINID', hre.network.config.chainId)
        console.log(`USDT:- ${USDT.address} `);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

