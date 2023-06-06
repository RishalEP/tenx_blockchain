const { ethers } = require('hardhat');
const hre = require("hardhat");
const saveToConfig = require('../utils/saveToConfig')

async function main() {

        const BUSD = await ethers.getContractFactory("ERC20Token");
        const ERC20TokenABI = (await artifacts.readArtifact('ERC20Token')).abi
        await saveToConfig('ERC20', 'ABI', ERC20TokenABI)
        const busd = await BUSD.deploy('BUSD Token', 'BUSD');
        await saveToConfig('BUSD', 'ADDRESS', busd.address)
        await saveToConfig('BUSD', 'CHAINID', hre.network.config.chainId)
        console.log(`BUSD:- ${busd.address} `);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

