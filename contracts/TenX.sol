// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * BNB testnet address :- 0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526
 * busd testnet address :- 0x9331b55D9830EF609A2aBCfAc0FBCE050A52fdEa
 * BNB mainnet address :- 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE
 * busd mainnet address :- 0xcBb98864Ef56E9042e7d2efef76141f15731B82f
 */

contract TenX is Ownable {
    using SafeERC20 for IERC20;
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

    constructor(
        address[] memory _shareHolderWallet,
        uint256[] memory _shareHolderPercentage,
        address _reinvestmentWallet,
        uint256 _referralLevel,
        uint256[] memory _referralPercentage,
        uint256[] memory months,
        uint256[] memory pricing
    ) {
        require(
            _shareHolderPercentage.length == _shareHolderWallet.length,
            "TenX: share holder length mismatch"
        );
        require(
            _referralLevel == _referralPercentage.length,
            "TenX: referral length mismatch"
        );
        require(
            months.length == pricing.length,
            "TenX: pricing length mismatch"
        );

        shareHolderWallet = _shareHolderWallet;
        shareHolderPercentage = _shareHolderPercentage;
        reInvestmentWallet = _reinvestmentWallet;
        referralLevels = _referralLevel;

        for (uint256 i; i < referralLevels; i++) {
            referralPercentage[i] = _referralPercentage[i];
        }

        addpricing(months, pricing);
    }

    function addpricing(uint256[] memory months, uint256[] memory pricing)
        internal
    {
        for (uint256 i; i < pricing.length; i++) {
            subscriptionPlans[months[i]] = SubscriptionPlan(
                pricing[i],
                months[i] * 30 days,
                true
            );
        }
    }

    function addPaymentToken(address paymentToken, address priceFeed)
        external
        onlyOwner
    {
        require(
            !paymentTokens[paymentToken].exist,
            "TenX: paymentToken already added"
        );
        require(priceFeed != address(0), "TenX: priceFeed address zero");

        paymentTokens[paymentToken] = PaymentToken(priceFeed, true);
        emit AddPaymentToken(paymentToken);
    }

    function removePaymentToken(address paymentToken) external onlyOwner {
        require(
            paymentTokens[paymentToken].exist,
            "TenX: paymentToken not added"
        );

        delete paymentTokens[paymentToken];
        emit RemovePaymentToken(paymentToken);
    }

    function changePriceFeed(address paymentToken, address priceFeed)
        external
        onlyOwner
    {
        require(
            paymentTokens[paymentToken].exist,
            "TenX: paymentToken not added"
        );

        require(priceFeed != address(0), "TenX: priceFeed address zero");
        paymentTokens[paymentToken].priceFeed = priceFeed;
    }

    function addSubscriptionPlan(uint256 months, uint256 price)
        external
        onlyOwner
    {
        require(months > 0 && price > 0, "TenX: month or price zero");

        subscriptionPlans[months] = SubscriptionPlan(
            price,
            months * 30 days,
            true
        );
    }

    function changeSubscriptionPricing(uint256 newPrice, uint256 months)
        external
        onlyOwner
    {
        require(
            subscriptionPlans[months].exist,
            "TenX: invalid subscription plan"
        );
        subscriptionPlans[months].price = newPrice;
    }

    function removeSubscriptionPlan(uint256 months) external onlyOwner {
        require(
            subscriptionPlans[months].exist,
            "TenX: invalid subscription plan"
        );
        delete subscriptionPlans[months];
    }

    function getUserReferralId() internal returns (uint256) {
        return ++totalReferralIds;
    }

    function createUser(address userAddress, uint256 referredBy)
        internal
        returns (uint256 userReferralId)
    {
        userReferralId = getUserReferralId();
        users[userAddress] = User(userReferralId, referredBy, 0);
        referralIdToUser[userReferralId] = userAddress;
        emit CreateUser(userAddress, userReferralId, referredBy);
    }

    function subscribe(
        uint256 amount,
        uint120 months,
        uint256 referredBy,
        address paymentToken
    ) external payable {
        require(
            subscriptionPlans[months].exist,
            "TenX: subscription plan doesn't exist"
        );
        require(
            true || getSubscriptionAmount(months, paymentToken) <= amount,
            "TenX: amount paid less. increase slippage"
        );
        if (referredBy != 0)
            require(
                referralIdToUser[referredBy] != address(0),
                "TenX: invalid referredBy"
            );

        if (paymentToken != address(0)) {
            require(
                IERC20(paymentToken).allowance(msg.sender, address(this)) >=
                    amount,
                "TenX: insufficient allowance"
            );
            require(msg.value == 0, "TenX: msg.value not zero");
        } else require(amount == msg.value, "TenX: msg.value not equal amount");

        uint256 amountAfterReferrals = amount;

        User memory user = users[msg.sender];
        if (user.referralId == 0) {
            createUser(msg.sender, referredBy);
            amountAfterReferrals -= processReferrals(
                referredBy,
                amount,
                paymentToken
            );
        }

        processPayment(amountAfterReferrals, paymentToken);
        uint256 subscriptionValidity = block.timestamp +
            subscriptionPlans[months].duration;
        users[msg.sender].subscriptionValidity = subscriptionValidity;

        emit Subscription(
            amount,
            months,
            msg.sender,
            paymentToken
        );
    }

    function calculatePercentage(uint256 amount, uint256 percentage)
        internal
        pure
        returns (uint256 shareAmount)
    {
        shareAmount = (amount * percentage) / 10_000;
    }

    function transferTokens(
        address from,
        address to,
        uint256 amount,
        address paymentToken
    ) internal {
        if (amount > 0 && to != address(0)) {
            if (paymentToken != address(0)) {
                if (from == address(this))
                    IERC20(paymentToken).safeTransfer(to, amount);
                else IERC20(paymentToken).safeTransferFrom(from, to, amount);
            } else {
                (bool success, ) = payable(to).call{value: amount}("");
                if (!success) {
                    BNBFromFailedTransfers += amount;
                    emit TransferOfBNBFail(to, amount);
                }
            }
        }
    }

    function processReferrals(
        uint256 referredBy,
        uint256 amount,
        address paymentToken
    ) internal returns (uint256 totalReferralRewards) {
        if (referredBy != 0) {
            (address[] memory referralList, uint256 count) = getReferralList(
                referredBy
            );
            for (uint256 i; i < count; i++) {
                uint256 referralReward = calculatePercentage(
                    amount,
                    referralPercentage[i]
                );
                totalReferralRewards += referralReward;
                transferTokens(
                    msg.sender,
                    referralList[i],
                    referralReward,
                    paymentToken
                );
            }
        }
    }

    function getReferralList(uint256 referredBy)
        internal
        view
        returns (address[] memory, uint256)
    {
        uint256 currentReferralId = referredBy;
        address[] memory referralList = new address[](referralLevels);
        uint256 count;

        for (uint256 i; i < referralLevels; i++) {
            referralList[i] = referralIdToUser[currentReferralId];
            currentReferralId = users[referralList[i]].referredBy;
            count++;
            if (currentReferralId == 0) break;
        }
        return (referralList, count);
    }

    function processPayment(uint256 amount, address paymentToken) internal {
        // Share Holder Payments
        uint256 totalShareHolderAmount;
        for (uint256 i; i < shareHolderPercentage.length; i++) {
            uint256 shareHolderAmount = calculatePercentage(
                amount,
                shareHolderPercentage[i]
            );
            totalShareHolderAmount += shareHolderAmount;
            transferTokens(
                msg.sender,
                shareHolderWallet[i],
                shareHolderAmount,
                paymentToken
            );
        }
        // Re Investment Wallet Payments
        transferTokens(
            msg.sender,
            reInvestmentWallet,
            amount - totalShareHolderAmount,
            paymentToken
        );
    }

    function getSubscriptionAmount(uint256 months, address paymentToken)
        public
        view
        returns (uint256 subscriptionAmount)
    {
        require(
            subscriptionPlans[months].exist,
            "TenX: invalid subscription plan"
        );
        require(
            paymentTokens[paymentToken].exist,
            "TenX: paymentToken not added"
        );

        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            paymentTokens[paymentToken].priceFeed
        );

        (, int256 price, , , ) = priceFeed.latestRoundData();
        uint256 decimals = uint256(priceFeed.decimals());

        subscriptionAmount = paymentToken != address(0)
            ? ((subscriptionPlans[months].price *
                10**(decimals + IERC20Metadata(paymentToken).decimals())) /
                uint256(price))
            : ((subscriptionPlans[months].price * 10**(decimals + 18)) /
                uint256(price));
    }

    function changeShareHolder(address _shareHolderWallet, uint128 index)
        external
        onlyOwner
    {
        require(index < shareHolderWallet.length, "invalid index");
        require(
            _shareHolderWallet != address(0),
            "TenX: _shareHolderWallet wallet zero"
        );
        shareHolderWallet[index] = _shareHolderWallet;
        emit SetShareHolder(_shareHolderWallet, index);
    }

    /**
     * @param _shareHolderPercentage always be multiplied by 100
     * For example 9 % should be added as 900 which is 9 * 100
     */
    function changeShareHolderPercentage(
        uint256 _shareHolderPercentage,
        uint128 index
    ) external onlyOwner {
        require(index < shareHolderPercentage.length, "TenX: invalid index");
        shareHolderPercentage[index] = _shareHolderPercentage;
        emit SetShareHolderPercentage(_shareHolderPercentage, index);
    }

    function changeReInvestmentWallet(address _reInvestmentWallet)
        external
        onlyOwner
    {
        require(
            _reInvestmentWallet != address(0),
            "TenX: _reInvestmentWallet zero"
        );
        reInvestmentWallet = _reInvestmentWallet;
        emit SetReInvestmentWallet(_reInvestmentWallet);
    }

    /**
     * @param _referralPercentage always be multiplied by 100
     * For example 9 % should be added as 900 which is 9 * 100
     */

    function changeReferralPercentage(
        uint256 _referralPercentage,
        uint128 index
    ) external onlyOwner {
        require(index < referralLevels, "TenX: invalid index");
        referralPercentage[index] = _referralPercentage;
        emit SetReferralPercentage(_referralPercentage, index);
    }

    /**
     * @notice This method is to collect any BNB left from failed transfers.
     * @dev This method can only be called by the contract owner
     */
    function collectBNBFromFailedTransfers() external onlyOwner {
        uint256 bnbToSend = BNBFromFailedTransfers;
        BNBFromFailedTransfers = 0;
        (bool success, ) = payable(owner()).call{value: bnbToSend}("");
        require(success, "TenX: BNB transfer failed");
    }
}
