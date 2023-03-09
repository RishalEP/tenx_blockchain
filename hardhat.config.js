require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-waffle");
require("ethereum-waffle");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-ethers");

const {
  CUSTOM_RPC_URL,
  TESTNET_RPC_URL,
  ADMIN_PRIVATE_KEY,
  ETHERSCAN_API_KEY,
} = require("./config/index");
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true, // use this for this Error -> InvalidInputError: Transaction gas limit is 9999024856 and exceeds block gas limit of 30000000
    },
    custom: {
      url: CUSTOM_RPC_URL || "",
      accounts: [ADMIN_PRIVATE_KEY],
    },
    testnet: {
      url: TESTNET_RPC_URL,
      accounts: [ADMIN_PRIVATE_KEY],
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: ETHERSCAN_API_KEY,
  },
};
