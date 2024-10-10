const { expect } = require("chai");
const hre = require("hardhat");
const { solidityPacked, parseEther, ethers } = require("ethers");
const keccak256 = require("keccak256");
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

async function signState(signer: any, stateHash: string): Promise<string[]> {
  const signature = await signer.signMessage(stateHash);

  const r = signature.slice(0, 66);
  const s = "0x" + signature.slice(66, 130);
  const v = "0x" + signature.slice(130, 132);

  return [v, r, s];
}

describe("Airdrop Contract", function () {
  let stateChannel: any;
  let participantA: any, participantB: any, participantC: any;

  beforeEach(async () => {
    [participantA, participantB, participantC] = await hre.ethers.getSigners();

    const StateChannel = await hre.ethers.getContractFactory("StateChannel");

    stateChannel = await StateChannel.deploy(participantB.address, 60, {
      value: parseEther("10"),
    });
  });

  it("should initialize the channel with correct balances", async function () {
    let stateBalanceA = await stateChannel.balanceA();
    let stateBalanceB = await stateChannel.balanceB();

    expect(stateBalanceA).to.be.equal(parseEther("10"));
    expect(stateBalanceB).to.be.equal(parseEther("0"));
  });

  it("should allow participants to update state with valid signatures ", async function () {
    let newBalanceA = parseEther("20");
    let newBalanceB = parseEther("10");
    const nonce = 1;

    const state = {
      balanceA: newBalanceA,
      balanceB: newBalanceB,
      nonce: nonce,
    };

    // Hash the new state
    const stateHash = keccak256(
      solidityPacked(
        ["uint256", "uint256", "uint256"],
        [state.balanceA, state.balanceB, state.nonce]
      )
    );

    const signatureA = await signState(participantA, stateHash);
    const signatureB = await signState(participantB, stateHash);

    // Update the state on-chain with valid signatures
    await stateChannel.updateState(
      newBalanceA,
      newBalanceB,
      nonce,
      signatureA[0],
      signatureA[1],
      signatureA[2],
      signatureB[0],
      signatureB[1],
      signatureB[2]
    );

    // Check that the contract state is updated
    expect(await stateChannel.balanceA()).to.equal(newBalanceA);
    expect(await stateChannel.balanceB()).to.equal(newBalanceB);
  });

  it("should allow participants to settle the channel with correct state", async function () {
    const finalBalanceA = parseEther("7"); // Final balance
    const finalBalanceB = parseEther("3");
    const nonce = 2;

    const state = {
      balanceA: finalBalanceA,
      balanceB: finalBalanceB,
      nonce: nonce,
    };

    const stateHash = keccak256(
      solidityPacked(
        ["uint256", "uint256", "uint256"],
        [state.balanceA, state.balanceB, state.nonce]
      )
    );

    const signatureA = await signState(participantA, stateHash);
    const signatureB = await signState(participantB, stateHash);

    // Close the channel with final state
    await stateChannel.closeChannel(
      finalBalanceA,
      finalBalanceB,
      nonce,
      signatureA[0],
      signatureA[1],
      signatureA[2],
      signatureB[0],
      signatureB[1],
      signatureB[2]
    );

    // Check if the channel is marked as closed
    expect(await stateChannel.channelClosed()).to.be.true;

    // Check balances after settlement
    const balanceAAfter = await stateChannel.balanceA();
    const balanceBAfter = await stateChannel.balanceB();

    expect(balanceAAfter).to.be.equal(finalBalanceA, parseEther("0"));
    expect(balanceBAfter).to.be.equal(finalBalanceB, parseEther("0"));
  });

  it("should not allow participants to update the state with incorrect signature", async function () {
    const finalBalanceA = parseEther("7"); // Final balance
    const finalBalanceB = parseEther("3");
    const nonce = 2;

    const state = {
      balanceA: finalBalanceA,
      balanceB: finalBalanceB,
      nonce: nonce,
    };

    const stateHash = keccak256(
      solidityPacked(
        ["uint256", "uint256", "uint256"],
        [state.balanceA, state.balanceB, state.nonce]
      )
    );

    const signatureA = await signState(participantC, stateHash);
    const signatureB = await signState(participantB, stateHash);

    await expect(
      stateChannel.closeChannel(
        finalBalanceA,
        finalBalanceB,
        nonce,
        signatureA[0],
        signatureA[1],
        signatureA[2],
        signatureB[0],
        signatureB[1],
        signatureB[2]
      )
    ).to.be.revertedWith("Invalid signature from A");
  });

  it("should allow a participant to force close the channel in case of dispute", async function () {
    const disputedBalanceA = parseEther("6"); // Disputed balance
    const disputedBalanceB = parseEther("4");
    const nonce = 3;

    const state = {
      balanceA: disputedBalanceA,
      balanceB: disputedBalanceB,
      nonce: nonce,
    };

    const stateHash = keccak256(
      solidityPacked(
        ["uint256", "uint256", "uint256"],
        [state.balanceA, state.balanceB, state.nonce]
      )
    );

    const signatureA = await signState(participantA, stateHash);

    await time.increase(61);

    await stateChannel.forceClose(
      disputedBalanceA,
      disputedBalanceB,
      nonce,
      signatureA[0],
      signatureA[1],
      signatureA[2]
    );

    // Check if the channel is marked as closed
    expect(await stateChannel.channelClosed()).to.be.true;

    // Check balances after force settlement
    const balanceAAfter = await stateChannel.balanceA();
    const balanceBAfter = await stateChannel.balanceB();

    expect(balanceAAfter).to.be.equal(disputedBalanceA, parseEther("0.01"));
    expect(balanceBAfter).to.be.equal(disputedBalanceB, parseEther("0.01"));
  });
});
