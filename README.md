# State Channel Smart Contract

A Solidity implementation of a state channel, allowing two participants to transact securely off-chain and settle their balances on-chain when the channel is closed. This contract uses cryptographic signatures to verify off-chain state transitions, reducing the need for constant on-chain interactions and thus saving on gas fees.

## Features

- **Off-chain Transactions**: Participants can update their balances off-chain and submit the final state to the blockchain.
- **Signature Verification**: State updates are validated through cryptographic signatures using Ethereum's ecrecover.
- **Dispute Resolution**: In case of a dispute, one party can force close the channel after a timeout.
- **Efficient Gas Usage**: By limiting on-chain interactions to opening and closing channels, this contract reduces gas fees compared to regular transactions.

## Contract Overview

- Participants: Two participants (A and B) who open the state channel by depositing funds and agree on off-chain state updates.
- State Updates: Participants sign off-chain updates that modify their respective balances and submit them to the contract as necessary.
- Dispute Resolution: If one participant stops cooperating, the other can force close the channel and settle the balances after a specified timeout.

## Functions

- hashState(State memory state): Hashes a state using the participants' balances and the nonce.
- verifySignature: Verifies that a state was signed by a given participant.
- updateState: Updates the channel with a new state provided both participants sign off-chain.
- closeChannel: Finalizes the state channel and settles the balances according to the last valid state.
- forceClose: Allows one participant to close the channel in the event of a dispute, after a timeout.

## Usage

1. Open a Channel: One participant deploys the contract, funding it with some amount of Ether.
2. Update State Off-Chain: Participants sign off-chain updates to their balances, reducing the need for on-chain interaction.
3. Close Channel: Either participant can close the channel by submitting the final signed state to the contract.
4. Dispute Resolution: In the event of a dispute, a participant can force close the channel after a timeout.

### Compile the contracts

```
npx hardhat compile
```

### Run the tests

```
npx hardhat test
```

## Tests

```
 StateChannel Contract
    ✔ should initialize the channel with correct balances
    ✔ should allow participants to update state with valid signatures
    ✔ should allow participants to settle the channel with correct state
    ✔ should not allow participants to update the state with incorrect signature
    ✔ should allow a participant to force close the channel in case of dispute
```
