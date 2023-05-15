// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@chainlink/contracts-upgradeable/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract TenxUpgradable is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Add your contract variables and functions here
    function initialize(
        address[] memory _shareHolderWallet,
        uint256[] memory _shareHolderPercentage,
        address _reinvestmentWallet,
        uint256 _referralLevel,
        uint256[] memory _referralPercentage,
        uint256[] memory months,
        uint256[] memory pricing
    ) external virtual initializer {
        __Ownable_init();
    }

    uint256 public totalReferralIds;
    uint256 public BNBFromFailedTransfers; // BNB left in the contract from failed transfers

    uint256 public referralLevels;
    address public reInvestmentWallet;
    address[] public shareHolderWallet;
    uint256[] public shareHolderPercentage; // percentage should whithout decimal EX:- 33.75 will like 3375
    mapping(uint256 => uint256) public referralPercentage;

    struct SubscriptionPlan {
        uint256 price;
        uint256 duration;
        bool exist;
    }
    mapping(uint256 => SubscriptionPlan) public subscriptionPlans; // months -> plan details

    struct User {
        uint256 referralId;
        uint256 referredBy;
        uint256 subscriptionValidity;
    }
    mapping(address => User) public users; // user address -> User
    mapping(uint256 => address) public referralIdToUser; // referralId -> user address

    struct PaymentToken {
        address priceFeed; // Chainlink price feed
        bool exist;
    }
    mapping(address => PaymentToken) public paymentTokens;

     /* Events */
    event TransferOfBNBFail(address indexed receiver, uint256 indexed amount);
    event SetShareHolder(address indexed shareHolderWallet, uint128 index);
    event SetShareHolderPercentage(
        uint256 indexed shareHolderPercentage,
        uint128 index
    );

    event SetReferralPercentage(uint256 referralPercentage, uint128 index);
    event SetReInvestmentWallet(address indexed reInvestmentWallet);

    event CreateUser(
        address indexed user,
        uint256 indexed referralId,
        uint256 indexed referredBy
    );

    event Subscription(
        uint256 amount,
        uint120 period,
        address indexed subscriber,
        address paymentToken
    );
    event AddPaymentToken(address indexed paymentToken);
    event RemovePaymentToken(address indexed paymentToken);





}
