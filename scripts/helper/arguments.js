
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
  pricing : [199, 538, 1194, 2388]
}

