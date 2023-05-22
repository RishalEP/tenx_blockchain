// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @author  Rishal EP
 * @title   Tenx Subscription contract
 * @dev     This contract is used for splitting 
 *          users subscribtions to affiliates and shareholders
 */

contract TenxUpgradableV1 is AccessControlUpgradeable, PausableUpgradeable {

    using SafeERC20Upgradeable for IERC20Upgradeable;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /**
     * @dev Struct defining the parameters of a Subscription scheme.
     * @param price is the dollar price for this Subscription.
     * @param lockingPeriod is the Subscription plan (duration) in seconds.
     * @param active is a boolean indicating whether this scheme is currently active or not.
     */
    struct SubscribtionScheme {
        uint256 price;
        uint256 lockingPeriod;
        bool active;
    }

    /**
     * @dev Struct representing data associated with a particular user.
     * @param referralId is users unique id.
     * @param plan is the Subscription plan (duration) in seconds.
     * @param active is a boolean indicating whether this scheme is currently active or not.
     */
    struct User {
        uint256 referralId;
        uint256 referredBy;
        uint256 subscriptionValidity;
    }

    /**
     * @dev Struct representing data associated with a payment token.
     * @param priceFeed is price feed address of the token.
     * @param active is a boolean indicating whether this scheme is currently active or not.
     */
    struct PaymentToken {
        address priceFeed;
        bool active;
    }

     /**
     * @dev Struct representing each shareholder details.
     * @param name is name of share holder.
     * @param holderAddress is address of share holder.
     * @param sharePercentage is percantage share for share holder
     * @param active is a boolean indicating whether this holder is currently active or not.
     */
    struct ShareHolder {
        string name;
        address holderAddress;
        uint256 sharePercentage;
        bool active;
    }

    /**
     * @dev Struct representing shareholder and affiliates detail in common.
     * @param totalLevels is the total number of share holders/affiliates.
     * @param totalShare is total percantage of share for all the shareholders/affiliates.
     */
    struct Shares {
        uint256 totalLevels;
        uint256 totalShare;
    }

    /// Constant representing the manager role.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// Variable to store failed transaction BNB.
    uint256 internal BNBFromFailedTransfers_;

    /// Counter to keep track of the total users.
    CountersUpgradeable.Counter internal userID_;
    
    /// Variable to store re investment wallet.
    address internal reInvestmentWallet_;

    /// Mapping to store all the users created.
    mapping(address => User) internal users_;

    /// Mapping to store the users referalId to address
    mapping(uint256 => address) public usersReferalId_; 
    
    /// Mapping to payment all the payment tokens created.
    mapping(address => PaymentToken) internal paymentTokens_;

    /// Mapping to save all share holders details.
    mapping(uint256 => ShareHolder) internal shareHolders_;

    /// Mapping to store all the schemes created.
    mapping(uint256 => SubscribtionScheme) internal subscribtionSchemes_;
    
    /// Mapping to store referal percentages for all levels.
    mapping(uint256 => uint256) public referalPercentages_;

    /// Variable store the referal level info in detail.
    Shares internal referalShares_;

    /// Variable store the shareHolder info in detail.
    Shares internal holderShares_;

    // Add Events Here


    /**
     * @dev modifier to check if msg.sender address is manager or admin.
     */
    modifier isManager() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
                hasRole(MANAGER_ROLE, msg.sender),
            "KyotoStake: Not Admin or Manager"
        );
        _;
    }

    /**
     * @dev Initializes the contract.
     * This function is used to set initial values for certain variables/parameters when the contract is first deployed.
     */
    function initialize(
        Shares memory _shareHolderDetail, 
        Shares memory _referralDetail,
        address _reinvestmentWallet
    ) external initializer {
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(MANAGER_ROLE, _msgSender());

        _setShareHolderDetail(_shareHolderDetail);
        _setReferalLevelDetail(_referralDetail);
        _setReinvestmentWallet(_reinvestmentWallet);
    }

    /**
     * @dev Pauses the contract, disabling interaction with it.
     *
     * Requirements:
     * - Only the admin or manager can call this function.
     */
    function pause() external isManager {
        _pause();
    }

    /**
     * @dev Unpauses the contract, allowing interaction with it.
     *
     * Requirements:
     * - Only the admin or manager can call this function.
     */
    function unpause() external isManager {
        _unpause();
    }


    /**
     * @dev Updates the Total Share holder Levels and Percentage.
     * @param _names The Array of share holder names.   
     * @param _userAddresses The Array of share holder Addresses.   
     * @param _sharePercants The Array of share holder shares .   
     */
    function setShareHolders(
        string[] memory _names, 
        address[] memory _userAddresses, 
        uint256[] memory _sharePercants
    ) external isManager {
        require(
            _names.length ==
            _userAddresses.length && 
            _sharePercants.length == 
            holderShares_.totalLevels &&
            _sharePercants.length == 
            _userAddresses.length,
            "Tenx: Share Holder Level Mismsatch in Inputs"
        );

        require(
            !_isShareExceedsLimit(
                holderShares_.totalShare,
                _sharePercants
                ),
            "Tenx: Total Share Exceeds Limit"
        );

        for (uint256 i=0; i < holderShares_.totalLevels; i++) {
            _setShareHolder(
                i,
                _names[i],
                _userAddresses[i],
                _sharePercants[i]
            );        
        }
    }

    /**
     * @dev set Referral Percentages for the affiliates.
     * @param _sharePercant The Array of referal percentages.   
     */

    function setReferralPercentages(
        uint256[] memory _sharePercant
    ) external isManager {
         require(
            referalShares_.totalLevels ==
            _sharePercant.length,
            "Tenx: Input Length Mismatch"
        );

        require(
            !_isShareExceedsLimit(
                referalShares_.totalShare,
                _sharePercant
                ),
            "Tenx: Total Share Exceeds Limit"
        );

        for (uint256 i=0; i < _sharePercant.length; i++) {
            referalPercentages_[i+1] = _sharePercant[i];
        }
    }


    /**
     * @dev Updates Reinvestment wallet address.
     * @param _reInvestmentWallet The Reinvestmentwallet Address.   
     */

    function updateReinvestmentWallet(
        address _reInvestmentWallet
    ) external isManager {
         require(
            _reInvestmentWallet != address(this) &&
            _reInvestmentWallet != address(0),
            "Tenx: Address Should not be this contract"
        );
        _setReinvestmentWallet(_reInvestmentWallet);
    }

    /**
     * @dev To add the payment token.
     * @param _paymentToken The Payment token.  
     * @param _priceFeed The Price feed addresss for the payment token.   
     */

    function addPaymentToken(address _paymentToken, address _priceFeed) 
        external isManager 
    {
        require(
            paymentTokens_[_paymentToken].priceFeed == address(0),
            "TenX: paymentToken already added"
        );
        require(_priceFeed != address(0), "TenX: priceFeed address could not be zero");
        paymentTokens_[_paymentToken] = PaymentToken(_priceFeed, true);
    }

    /**
     * @dev To disable the payment token.
     * @param _paymentToken The Payment token address.  
     */

    function disablePaymentToken(address _paymentToken) external isManager {
        require(
            paymentTokens_[_paymentToken].priceFeed != address(0) &&
            paymentTokens_[_paymentToken].active,
            "TenX: PaymentToken not added or already disabled"
        );

        paymentTokens_[_paymentToken].active = false;
    }

    /**
     * @dev To enable the payment token.
     * @param _paymentToken The Payment token address.  
     */
    function enablePaymentToken(address _paymentToken) external isManager {
        require(
            paymentTokens_[_paymentToken].priceFeed != address(0) &&
            !paymentTokens_[_paymentToken].active,
            "TenX: PaymentToken not added or already active"
        );

        paymentTokens_[_paymentToken].active = true;
    }

    /**
     * @dev To change the price feed of payment token.
     * @param _paymentToken The Payment token address.  
     */
    function changePriceFeed(address _paymentToken, address _priceFeed)
        external
        isManager
    {
       require(
            paymentTokens_[_paymentToken].priceFeed != address(0) &&
            paymentTokens_[_paymentToken].active,
            "TenX: PaymentToken not added or disabled"
        );

        require(_priceFeed != address(0), "TenX: priceFeed address zero");
        paymentTokens_[_paymentToken].priceFeed = _priceFeed;
    }


    /**
     * @dev To add a new subscription plan.
     * @param _months The Number of months for the plan.  
     * @param _price The price of the plan.  
     */

    function addSubscriptionPlan(uint256 _months, uint256 _price)
        external
        isManager
    {
        require(_months > 0 && _price > 0, "TenX: month or price zero");
        require(
            !subscribtionSchemes_[_months].active &&
            subscribtionSchemes_[_months].lockingPeriod == 0,
            "TenX: Plan Already Exists"
        );

        subscribtionSchemes_[_months] = SubscribtionScheme(
            _price,
            _months * 30 days,
            true
        );
    }

    /**
     * @dev To change an subscription plans price.
     * @param _months The Number of months for the plan.  
     * @param _newPrice The price of the plan.  
     */

    function changeSubscriptionPricing(uint256 _months, uint256 _newPrice)
        external
        isManager
    {
        require(_months > 0 && _newPrice > 0, "TenX: month or price zero");
        require(
            subscribtionSchemes_[_months].active &&
            subscribtionSchemes_[_months].lockingPeriod != 0,
            "TenX: Plan Does not Exists or Disabled"
        );
        require(
            _newPrice !=
            subscribtionSchemes_[_months].price,
            "TenX: Try a different price"
        );

        subscribtionSchemes_[_months].price = _newPrice;
    }

    /**
     * @dev To disable a subscripion plan.
     * @param _months The plans duration in months.  
     */
    
    function disableSubscribtionPlan(uint256 _months)
        external
        isManager
    {
        require(
            subscribtionSchemes_[_months].active &&
            subscribtionSchemes_[_months].lockingPeriod != 0,
            "TenX: Plan Does not Exists or Already Disabled"
        );
        subscribtionSchemes_[_months].active = false;
    }

    /**
     * @dev To enable a subscripion plan.
     * @param _months The plans duration in months.  
     */
    function enableSubscribtionPlan(uint256 _months)
        external
        isManager
    {
        require(
            subscribtionSchemes_[_months].active,
            "TenX: Plan Already Active"
        );
        subscribtionSchemes_[_months].active = true;
    }

    /**
     * @dev To subscribe a plan for the user.
     * @param _amount The amount send to subscribe.  
     * @param _months The plans duration in months.  
     * @param _referredBy The Id of the user who referes.  
     * @param _paymentToken payment token address.  
     * @param _discountPercant the discount percentage.  

     */
    function subscribe(
        uint256 _amount,
        uint256 _months,
        uint256 _referredBy,
        address _paymentToken,
        uint256 _discountPercant
    ) external payable {
        require(
            subscribtionSchemes_[_months].active,
            "TenX: Subscription plan not active"
        );
        require(
            _getSubscriptionAmount(
                _months, _paymentToken, _discountPercant) <= _amount,
            "TenX: amount paid less. increase slippage"
        );
        if (_referredBy != 0){
            require(
                _referredBy <= userID_.current(),
                "TenX: Invalid referredBy"
            );
        }
        if (_paymentToken != address(0)) {
            require(
                IERC20Upgradeable(_paymentToken).allowance(msg.sender, address(this)) >=
                    _amount,
                "TenX: Insufficient Token Allowance"
            );
            require(msg.value == 0, "TenX: Not Required to transfer BNB");
        } else require(_amount == msg.value, "TenX: Mismatch in Amount send ");

        uint256 amountAfterReferals = _amount;
        User memory user = users_[msg.sender];

        if (user.referralId == 0) {
            _createUser(msg.sender, _referredBy);
            amountAfterReferals -= _processReferrals(
                _referredBy,
                _amount,
                _paymentToken
            );
        }

        _processPayment(amountAfterReferals, _paymentToken);

        uint256 subscriptionValidity = 
            users_[msg.sender].subscriptionValidity > block.timestamp ?
            users_[msg.sender].subscriptionValidity + subscribtionSchemes_[_months].lockingPeriod :
            block.timestamp + subscribtionSchemes_[_months].lockingPeriod;
        
        users_[msg.sender].subscriptionValidity = subscriptionValidity;
    }

    /**
     * @dev To subscribe a plan for the user, initiated by manager.
     * @param _userAddress The users address to subscribe the plan.  
     * @param _months The plans duration in months.  
     * @param _referredBy The Id of the user who referes. 

     */
    
    function addSubscriptionForUser(
        address _userAddress, 
        uint256 _months, 
        uint256 _referredBy
    ) external isManager {
        require(
            subscribtionSchemes_[_months].active,
            "TenX: Subscription plan not active"
        );
        
        if (_referredBy != 0){
            require(
                _referredBy <= userID_.current(),
                "TenX: Invalid referredBy"
            );
        }

        User memory user = users_[_userAddress];

        if (user.referralId == 0) {
            _createUser(_userAddress, _referredBy);
        }

        uint256 subscriptionValidity = 
            users_[msg.sender].subscriptionValidity > block.timestamp ?
            users_[msg.sender].subscriptionValidity + subscribtionSchemes_[_months].lockingPeriod :
            block.timestamp + subscribtionSchemes_[_months].lockingPeriod;
        
        users_[msg.sender].subscriptionValidity = subscriptionValidity;
    }

    /**
     * @dev To process the referal paymentss.
     * @param _amount The total amount received.  
     * @param _paymentToken Payment token received.  
     */

    function _processPayment(uint256 _amount, address _paymentToken) 
        internal 
    {
        // Share Holder Payments
        uint256 totalShareHolderAmount;
        for (uint256 i; i < holderShares_.totalLevels; i++) {
            uint256 shareHolderAmount = _calculatePercentage(
                _amount,
                shareHolders_[i].sharePercentage
            );
            totalShareHolderAmount += shareHolderAmount;
            _transferTokens(
                msg.sender,
                shareHolders_[i].holderAddress,
                shareHolderAmount,
                _paymentToken
            );
        }
        // Re Investment Wallet Payments
        _transferTokens(
            msg.sender,
            reInvestmentWallet_,
            _amount - totalShareHolderAmount,
            _paymentToken
        );
    }

    /**
     * @dev To create a new user.
     * @param _userAddress The total amount received.  
     * @param _referredBy Id of the user who referred.  
     */

    function _createUser(address _userAddress, uint256 _referredBy)
        internal
        returns (uint256 userReferralId)
    {
        userID_.increment();
        userReferralId = userID_.current();
        users_[_userAddress] = User(userReferralId, _referredBy, 0);
        // referralIdToUser[userReferralId] = userAddress;
    }

    /**
     * @dev To process the referal payouts.
     * @param _referredBy Id of the user who referred.  
     * @param _amount The total amount received.  
     * @param _paymentToken The Payment token fro payment received.  
     */

    function _processReferrals(
        uint256 _referredBy,
        uint256 _amount,
        address _paymentToken
    ) internal returns (uint256 totalReferralRewards) {
        if (_referredBy != 0) {
            (address[] memory referralList, uint256 count) = _getReferralList(
                _referredBy
            );
            for (uint256 i; i < count; i++) {
                uint256 referralReward = _calculatePercentage(
                    _amount,
                    referalPercentages_[i]
                );
                totalReferralRewards += referralReward;

                address to = 
                    users_[referralList[i]].subscriptionValidity > block.timestamp ?
                    referralList[i] :
                    reInvestmentWallet_;

                _transferTokens(
                    msg.sender,
                    to,
                    referralReward,
                    _paymentToken
                );
            }
        }
    }

    /**
     * @dev To transfer the tokens.
     * @param _from address of transaction initiated.  
     * @param _to the address to receive payment tokens.  
     * @param _amount The total amount received.  
     * @param _paymentToken The Payment token fro payment received.  
     */
    function _transferTokens(
        address _from,
        address _to,
        uint256 _amount,
        address _paymentToken
    ) internal {
        if (_amount > 0 && _to != address(0)) {
            if (_paymentToken != address(0)) {
                if (_from == address(this))
                    IERC20Upgradeable(_paymentToken).safeTransfer(_to, _amount);
                else IERC20Upgradeable(_paymentToken).safeTransferFrom(_from, _to, _amount);
            } else {
                (bool success, ) = payable(_to).call{value: _amount}("");
                if (!success) {
                    BNBFromFailedTransfers_ += _amount;
                    // emit TransferOfBNBFail(to, amount);
                }
            }
        }
    }

    /**
     * @dev To calculate the percentages.
     * @param _amount The total amount received.  
     * @param _percentage The percentage to calculate with the amount.  
     */
    function _calculatePercentage(uint256 _amount, uint256 _percentage)
        internal
        pure
        returns (uint256 shareAmount)
    {
        shareAmount = (_amount * _percentage) / 10000;
    }


    /**
     * @dev To fetch the referal list of a user.
     * @param _referredBy The id of user who refferd .  
     */

    function _getReferralList(uint256 _referredBy)
        internal
        view
        returns (address[] memory, uint256)
    {
        uint256 currentReferralId = _referredBy;
        address[] memory referralList = new address[](referalShares_.totalLevels);
        uint256 count;

        for (uint256 i; i < referalShares_.totalLevels; i++) {
            referralList[i] = usersReferalId_[currentReferralId];
            currentReferralId = users_[referralList[i]].referredBy;
            count++;
            if (currentReferralId == 0) break;
        }
        return (referralList, count);
    }

    /**
     * @dev To fetch the subscribtion amount for a plan.
     * @param _months The months for the plan .  
     * @param _paymentToken The token used for payments .  
     * @param _discountPercant percentage of discount to apply .  
     */

    function _getSubscriptionAmount(
        uint256 _months, 
        address _paymentToken, 
        uint256 _discountPercant
    )
        internal
        view
        returns (uint256 subscriptionAmount)
    {
        require(
            subscribtionSchemes_[_months].active,
            "TenX: Subscrription Plan Not Active"
        );
        require(
            paymentTokens_[_paymentToken].active,
            "TenX: Payment Token Not Active"
        );

        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            paymentTokens_[_paymentToken].priceFeed
        );

        (, int256 price, , , ) = priceFeed.latestRoundData();
        uint256 decimals = uint256(priceFeed.decimals());

        uint256 totalAmount = _paymentToken != address(0)
            ? ((subscribtionSchemes_[_months].price *
                10**(decimals + IERC20MetadataUpgradeable(_paymentToken).decimals())) /
                uint256(price))
            : ((subscribtionSchemes_[_months].price * 10**(decimals + 18)) /
                uint256(price));

        subscriptionAmount = 
            _discountPercant > 0 ?
            (totalAmount * _discountPercant) / 10000 :
            totalAmount;
    }




    /**
     * @dev Check if share exceeds the limit.
     * @param _limit The Share Holders total limit.  
     * @param _sharePercant The Share Holders share percentages.   
     */

    function _isShareExceedsLimit(
        uint256 _limit,
        uint256[] memory _sharePercant
    ) internal pure returns (bool) {
        uint256 accumulatedShare;
        for (uint256 i = 0; i < _sharePercant.length; i++) {
            accumulatedShare = accumulatedShare + _sharePercant[i];
        }
        return accumulatedShare > _limit;
    }

    
    /**
     * @dev Set a single share holder details.
     * @param _id Id of the share holder. usually from 0 to levels.  
     * @param _name The share holder name.   
     * @param _userAddress Theshare holder Address.   
     * @param _share The share holder share Percanetage .   
     */
    function _setShareHolder(
        uint256 _id,
        string memory _name,
        address _userAddress,
        uint256 _share
    ) internal {
        shareHolders_[_id] = ShareHolder(
            _name,
            _userAddress,
            _share,
            true
        );
    }

    /**
     * @dev Updates the Total Share holder Levels and Percentage.
     * @param _shareHolderDetail The Share Holders Details to be updated.   
     */
    function _setShareHolderDetail(Shares memory _shareHolderDetail) internal {
        require(
            _shareHolderDetail.totalShare > 0 &&
                _shareHolderDetail.totalShare < 10000,
            "Tenx: Total Percentage should be betweeen 0 to 100"
        );

        require(
            _shareHolderDetail.totalLevels > 0,
            "Tenx: Total Levels should be non zero"
        );

       holderShares_ = _shareHolderDetail;
    }

    /**
     * @dev Updates the Total referral Levels and Percentage.
     * @param _referralDetail The Share Holders Details to be updated.   
     */
    function _setReferalLevelDetail(Shares memory _referralDetail) internal {
        require(
            _referralDetail.totalShare > 0 &&
                _referralDetail.totalShare < 10000,
            "Tenx: Total Percentage should be betweeen 0 to 100"
        );

        require(
            _referralDetail.totalLevels > 0,
            "Tenx: Total Levels should be non zero"
        );

       referalShares_ = _referralDetail;
    }

     /**
     * @dev Updates the re investment wallet address.
     * @param _reInvestmentWallet The reinvestment wallet address.   
     */
    function _setReinvestmentWallet(address _reInvestmentWallet) internal {
        reInvestmentWallet_ = _reInvestmentWallet;
    }

}
