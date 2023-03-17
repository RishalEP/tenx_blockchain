const { ethers } = require('hardhat');
const hre = require("hardhat");
const saveToConfig = require('../utils/saveToConfig')

async function main() {

        const BUSD = await ethers.getContractFactory("BUSD");
        const BUSDABI = (await artifacts.readArtifact('BUSD')).abi
        await saveToConfig('BUSD', 'ABI', BUSDABI)
        const busd = await BUSD.deploy();
        await saveToConfig('BUSD', 'ADDRESS', busd.address)
        await saveToConfig('BUSD', 'CHAINID', hre.network.config.chainId)
        console.log(`BUSD:- ${busd.address} `);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

