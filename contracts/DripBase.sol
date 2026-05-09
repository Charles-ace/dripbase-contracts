// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title DripBase
 * @notice A minimal onchain tipping contract.
 *         Send ETH tips to any address with an optional message.
 * @dev Deployed on Base (OP Stack / EVM-compatible).
 */
contract DripBase {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted whenever a tip is successfully sent.
     * @param sender    The address that sent the tip.
     * @param recipient The address that received the tip.
     * @param amount    The amount of ETH sent, in wei.
     * @param message   An optional message or username tag from the sender.
     */
    event TipSent(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string message
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Reverts when the tip amount is zero.
    error TipAmountZero();

    /// @notice Reverts when tipping yourself.
    error CannotTipSelf();

    /// @notice Reverts when the recipient address is the zero address.
    error InvalidRecipient();

    // -------------------------------------------------------------------------
    // Core Function
    // -------------------------------------------------------------------------

    /**
     * @notice Send an ETH tip to a recipient with an optional message.
     * @param recipient The wallet address to receive the tip.
     * @param message   A short note or username tag (can be empty string "").
     *
     * @dev - msg.value is the tip amount (must be > 0).
     *      - ETH is forwarded directly to the recipient.
     *      - No funds are held by this contract.
     */
    function tip(address recipient, string calldata message) external payable {
        if (msg.value == 0) revert TipAmountZero();
        if (recipient == address(0)) revert InvalidRecipient();
        if (recipient == msg.sender) revert CannotTipSelf();

        // Forward the ETH directly to the recipient.
        (bool success, ) = recipient.call{value: msg.value}("");
        require(success, "DripBase: transfer failed");

        emit TipSent(msg.sender, recipient, msg.value, message);
    }
}
