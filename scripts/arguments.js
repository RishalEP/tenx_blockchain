const hre = require("hardhat")

const args = [
    "0x1eCFA121274A0b1209041115AfE949BDA10F37A5",
    [
        "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8",
        "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8",
        "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8",
        "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8"
    ],
    [3000, 3000, 1200, 800],
    2000,
    "0xB4A9bAc7533168b71913e2adAb6453030ca0c9d8",
    4,
    [1000, 800, 600, 300],
    "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",
    "0x9331b55D9830EF609A2aBCfAc0FBCE050A52fdEa",
    [1, 3, 6, 12],
    [199, 538, 1194, 2388]
]

// const APIKEY = "Z8TXJAUMJ5FC7JR2W6HCYGAZEEXX4HY7J6";

async function main() {
    await hre.run("verify:verify", {
      address: "0xcE5Ed94f681eA40860887E1E71376fEff950bAbe",
      constructorArguments: args,
    })
  }

  main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
// npx hardhat verify --constructor-args arguments.ts 0xcE5Ed94f681eA40860887E1E71376fEff950bAbe --network mumbai
