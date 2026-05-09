const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DripBase", function () {
  let dripBase;
  let sender, recipient, other;

  beforeEach(async function () {
    [sender, recipient, other] = await ethers.getSigners();

    const DripBase = await ethers.getContractFactory("DripBase");
    dripBase = await DripBase.deploy();
  });

  // ---------------------------------------------------------------------------
  // tip()
  // ---------------------------------------------------------------------------

  describe("tip()", function () {
    it("should transfer ETH from sender to recipient", async function () {
      const tipAmount = ethers.parseEther("0.01");

      const recipientBefore = await ethers.provider.getBalance(recipient.address);

      await dripBase
        .connect(sender)
        .tip(recipient.address, "gm!", { value: tipAmount });

      const recipientAfter = await ethers.provider.getBalance(recipient.address);
      expect(recipientAfter - recipientBefore).to.equal(tipAmount);
    });

    it("should emit a TipSent event with correct arguments", async function () {
      const tipAmount = ethers.parseEther("0.005");
      const message = "great work ser";

      await expect(
        dripBase.connect(sender).tip(recipient.address, message, { value: tipAmount })
      )
        .to.emit(dripBase, "TipSent")
        .withArgs(sender.address, recipient.address, tipAmount, message);
    });

    it("should allow an empty message", async function () {
      await expect(
        dripBase
          .connect(sender)
          .tip(recipient.address, "", { value: ethers.parseEther("0.001") })
      ).to.not.be.reverted;
    });

    it("should revert with TipAmountZero when msg.value is 0", async function () {
      await expect(
        dripBase.connect(sender).tip(recipient.address, "test", { value: 0 })
      ).to.be.revertedWithCustomError(dripBase, "TipAmountZero");
    });

    it("should revert with InvalidRecipient when recipient is zero address", async function () {
      await expect(
        dripBase
          .connect(sender)
          .tip(ethers.ZeroAddress, "test", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(dripBase, "InvalidRecipient");
    });

    it("should revert with CannotTipSelf when sender tips themselves", async function () {
      await expect(
        dripBase
          .connect(sender)
          .tip(sender.address, "test", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(dripBase, "CannotTipSelf");
    });

    it("should not hold any ETH in the contract after a tip", async function () {
      await dripBase
        .connect(sender)
        .tip(recipient.address, "no funds left behind", {
          value: ethers.parseEther("0.01"),
        });

      const contractBalance = await ethers.provider.getBalance(
        await dripBase.getAddress()
      );
      expect(contractBalance).to.equal(0n);
    });
  });
});
