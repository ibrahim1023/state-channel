// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract StateChannel {
    address public participantA;
    address public participantB;

    uint256 public timeout;
    uint256 public expiry;
    uint256 public balanceA;
    uint256 public balanceB;

    bytes32 public currentStateHash;
    bool public channelClosed;

    struct State {
        uint256 balanceA;
        uint256 balanceB;
        uint256 nonce;
    }

    constructor(address _participantB, uint256 _timeout) payable {
        participantA = msg.sender;
        participantB = _participantB;
        timeout = _timeout;
        expiry = block.timestamp + timeout;
        channelClosed = false;

        // Initial Balances
        balanceA = msg.value;
        balanceB = 0;
    }

    modifier onlyParticipants() {
        require(
            msg.sender == participantA || msg.sender == participantB,
            "Only participants allowed!"
        );
        _;
    }

    function hashState(State memory state) public pure returns (bytes32) {
        return
            keccak256(abi.encode(state.balanceA, state.balanceB, state.nonce));
    }

    function verifySignature(
        bytes32 stateHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address participant
    ) public pure returns (bool) {
        bytes32 message = prefixed(stateHash);
        return ecrecover(message, v, r, s) == participant;
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    // Off-chain state update: both participants sign the new state
    function updateState(
        uint256 newBalanceA,
        uint256 newBalanceB,
        uint256 nonce,
        uint8 vA,
        bytes32 rA,
        bytes32 sA,
        uint8 vB,
        bytes32 rB,
        bytes32 sB
    ) external onlyParticipants {
        require(!channelClosed, "Channel already closed");

        // Create the new state
        State memory newState = State({
            balanceA: newBalanceA,
            balanceB: newBalanceB,
            nonce: nonce
        });

        bytes32 newStateHash = hashState(newState);

        // Verify both signatures
        require(
            verifySignature(newStateHash, vA, rA, sA, participantA),
            "Invalid signature from A"
        );
        require(
            verifySignature(newStateHash, vB, rB, sB, participantB),
            "Invalid signature from B"
        );

        // Update state and reset expiry
        currentStateHash = newStateHash;
        balanceA = newBalanceA;
        balanceB = newBalanceB;
        expiry = block.timestamp + timeout;
    }

    // Final settlement: participants agree on the final state
    function closeChannel(
        uint256 finalBalanceA,
        uint256 finalBalanceB,
        uint256 nonce,
        uint8 vA,
        bytes32 rA,
        bytes32 sA,
        uint8 vB,
        bytes32 rB,
        bytes32 sB
    ) external onlyParticipants {
        require(!channelClosed, "Channel already closed");

        // Create the final state
        State memory finalState = State({
            balanceA: finalBalanceA,
            balanceB: finalBalanceB,
            nonce: nonce
        });

        bytes32 finalStateHash = hashState(finalState);

        // Verify signatures from both participants
        require(
            verifySignature(finalStateHash, vA, rA, sA, participantA),
            "Invalid signature from A"
        );
        require(
            verifySignature(finalStateHash, vB, rB, sB, participantB),
            "Invalid signature from B"
        );

        // Update the contract state
        channelClosed = true;
        balanceA = finalBalanceA;
        balanceB = finalBalanceB;

        // Settle: Transfer funds accordingly
        settleBalances();
    }

    function settle() external onlyParticipants {
        require(block.timestamp >= expiry, "Channel has not expired yet");
        require(!channelClosed, "Channel already settled");

        channelClosed = true;
        settleBalances();
    }

    function settleBalances() internal {
        payable(participantA).transfer(balanceA);
        payable(participantB).transfer(balanceB);
    }

    // Force close the channel in case of a dispute or timeout
    function forceClose(
        uint256 disputedBalanceA,
        uint256 disputedBalanceB,
        uint256 nonce,
        uint8 vA,
        bytes32 rA,
        bytes32 sA
    ) external onlyParticipants {
        require(block.timestamp >= expiry, "Timeout not reached yet");
        require(!channelClosed, "Channel already settled");

        // Dispute: Allow one participant to force close the channel by providing their version of the state
        State memory disputedState = State({
            balanceA: disputedBalanceA,
            balanceB: disputedBalanceB,
            nonce: nonce
        });

        bytes32 disputedStateHash = hashState(disputedState);

        // Verify the signature of the submitting participant
        require(
            verifySignature(disputedStateHash, vA, rA, sA, participantA),
            "Invalid signature"
        );

        // Force closing the channel
        currentStateHash = disputedStateHash;
        balanceA = disputedBalanceA;
        balanceB = disputedBalanceB;
        channelClosed = true;

        // Settle based on the disputed state
        settleBalances();
    }
}
