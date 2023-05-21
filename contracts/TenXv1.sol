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
     * @dev Struct defining the parameters of a subscribtion scheme.
     * @param price is the dollar price for this subscribtion.
     * @param plan is the subscribtion plan (duration) in seconds.
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
     * @param plan is the subscribtion plan (duration) in seconds.
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
    mapping(uint256 => User) internal users_;
    
    /// Mapping to payment all the payment tokens created.
    mapping(address => PaymentToken) internal paymentTokens_;

    /// Mapping to save all share holders details.
    mapping(uint256 => ShareHolder) internal shareHolders_;

    /// Mapping to store all the schemes created.
    mapping(uint256 => SubscribtionScheme) internal subscribtionSchemes_;
    
    /// Mapping to store referal percentages for all levels.
    mapping(uint256 => uint256) public referralPercentages_;

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
        Shares memory _referralDetail
    ) external initializer {
        __Pausable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(MANAGER_ROLE, _msgSender());

        _setShareHolderDetail(_shareHolderDetail);
        _setReferalLevelDetail(_referralDetail);
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
                i+1,
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
            referralPercentages_[i+1] = _sharePercant[i];
        }
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

}
