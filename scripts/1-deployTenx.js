import hre, { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    let [owner] = await ethers.getSigners();
    let Aryan =  "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8"
    let Ashay =  "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8"
    let iman =  "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8"
    let mahta =  "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8"
    let reinvest = "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8"

    let bnbPriceFeed = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526";
    let busdPriceFeed = "0x9331b55D9830EF609A2aBCfAc0FBCE050A52fdEa";
    let busdAddress;
    console.log();
    if (hre.config.networks.hardhat.chainId == 56) {
        bnbPriceFeed = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE";
        busdPriceFeed = "0xcBb98864Ef56E9042e7d2efef76141f15731B82f";
        Aryan = "0x178836771Bcd4C780e7d899219B2677c2A9C0D64";
        Ashay = "0x13e7bdF72AB88A1A3887f441aA9c280989A91206";
        iman = "0xD1c586849c6c64EE261EaF58F5E5a2DB8aF90969";
        mahta = "0x58c8d84861E6134649ccfd64dD294Cb4f7350B51";
        reinvest = "0x6346305D4D3c46611ba512ae69FA11DAcFCD79f5";
        busdAddress = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
    } else {
        // const BUSD: BUSD__factory = await ethers.getContractFactory("BUSD");
        // const busd: BUSD = await BUSD.deploy();
        busdAddress = "0x1eCFA121274A0b1209041115AfE949BDA10F37A5";
    }


    const TENX = await ethers.getContractFactory("TenX");
    const tenX =
        await TENX.deploy(
            busdAddress,
            [
                Aryan,
                Ashay,
                iman,
                mahta
            ],
            [
                3000,
                3000,
                1200,
                800
            ],
            reinvest,
            4,
            [
                1000,
                800,
                600,
                300
            ],
            bnbPriceFeed,
            busdPriceFeed,
            [
                1,
                3,
                6,
                12
            ],
            [
                199,
                538,
                1194,
                2388 
            ]
        );

    // await tenX.wait();
    console.log(`TENX:- ${await tenX.address} `);    
    console.log(`BUSD:- ${busdAddress} `);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

