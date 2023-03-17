const paymentTokens = {
  80001: {
      nativeToken : {
        address:'0x0000000000000000000000000000000000000000',
        priceFeed:'0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada'
      },
      customToken : {
        //custom token deployed - need to change if you deploy new token
        address:'0xb7628D153C0D2B843F2f9EF2Fb3EF118029E0121',
        priceFeed:'0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0'
      }
    },
  97:{
    nativeToken : {
      address:'0x0000000000000000000000000000000000000000',
      priceFeed:'0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526'
    },
    customToken : {
      address:'0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee',
      priceFeed:'0x9331b55D9830EF609A2aBCfAc0FBCE050A52fdEa'
    }
  }
}

const reinvest = {
  mainWallet:'0x6346305D4D3c46611ba512ae69FA11DAcFCD79f5',
  subWallet:'0xCD01461cDfa53EEA6a5F4D2Dd68ADE1A53069a70',
  value:2000
}
const aryan = {
  mainWallet:'0x178836771Bcd4C780e7d899219B2677c2A9C0D64',
  subWallet:'0xCD01461cDfa53EEA6a5F4D2Dd68ADE1A53069a70',
  value:3000
}
const ashay = {
  mainWallet:'0x13e7bdF72AB88A1A3887f441aA9c280989A91206',
  subWallet:'0xCD01461cDfa53EEA6a5F4D2Dd68ADE1A53069a70',
  value:3000
}
const iman = {
  mainWallet:'0xD1c586849c6c64EE261EaF58F5E5a2DB8aF90969',
  subWallet:'0xCD01461cDfa53EEA6a5F4D2Dd68ADE1A53069a70',
  value:1200
}
const mahta = {
  mainWallet:'0x58c8d84861E6134649ccfd64dD294Cb4f7350B51',
  subWallet:'0xCD01461cDfa53EEA6a5F4D2Dd68ADE1A53069a70',
  value:800
}

module.exports = {
  shareHolderMainWallet : [
    aryan.mainWallet,
    ashay.mainWallet,
    iman.mainWallet,
    mahta.mainWallet
  ],
  shareHolderSubWallet : [
    aryan.subWallet,
    ashay.subWallet,
    iman.subWallet,
    mahta.subWallet
  ],
  shareHolderPercant : [
    aryan.value,
    ashay.value,
    iman.value,
    mahta.value
  ],
  reinvestMainWallet : reinvest.mainWallet,
  reinvestSubWallet : reinvest.subWallet,
  referalPercantage : [1000, 800, 600, 300],
  months : [1, 3, 6, 12],
  pricing : [1, 2, 3, 4],
  paymentTokens
}

