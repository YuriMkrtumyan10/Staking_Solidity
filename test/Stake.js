const {
    time,
    loadFixture,
    mine
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Stake", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployStake() {
        const [owner, caller, otherAccount] = await ethers.getSigners();

        const Stake = await ethers.getContractFactory("Stake");
        const stake = await Stake.deploy(5);

        const stakeTokenAddress = await stake.token();
        const stakeToken = await ethers.getContractAt("StakeToken", stakeTokenAddress);



        return { stake, owner, caller, stakeToken, stakeTokenAddress, otherAccount };
    }

    describe("Initial State", function () {
        it("Should initialize with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            expect(await stake.ownerFee()).to.equal(5);
        })
    })


    describe("Deposit", function () {
        it("Should call the function with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));

            await stake.deposit(depAmount);
            const user = await stake.stakes(owner.address);

            expect(await user.id, 1);
            expect(await user.tokenAmount, depAmount);
            expect(await user.etherAmount, 0);
            expect(await user.depositTime, await ethers.provider.getBlockNumber());
            expect(await user.status, 0);
            expect(await stake.ownerProfitToken(), (depAmount * await stake.ownerFee()) / 100);
        })

        it("Should transfer tokens correctly after deposit: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));

            await expect(() => stake.deposit(depAmount))
                .to.changeTokenBalances(stakeToken, [owner, stake], [-1000, 1000]);
        })


        it("Should emit Deposited event with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));

            await expect(stake.deposit(depAmount))
                .to.emit(stake, 'Deposited')
                .withArgs(owner.address, depAmount);
        })

        //requires

        it("Should revert when the deposit amount is <= 0: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("0");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));

            await expect(stake.deposit(depAmount))
                .to.be.revertedWith("Stake: Submit tokens");
        })

        it("Should revert when the user's balance is < deposit amount: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("500"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));

            await expect(stake.deposit(depAmount))
                .to.be.revertedWith("Stake: not enough tokens");
        })


        it("Should revert when there is no allowance for a contract on msg.sender balance: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));

            await expect(stake.deposit(depAmount))
                .to.be.revertedWith("Stake: Not enough allowance");
        })

    })
    describe("DepositEth", function () {
        it("Should call the function with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);

            await stake.depositEth({ value: 1000 });

            const user = await stake.stakes(owner.address);

            expect(await user.id, 1);
            expect(await user.tokenAmount, 0);
            expect(await user.etherAmount, 1000);
            expect(await user.depositTime, await ethers.provider.getBlockNumber());
            expect(await user.status, 0);
            expect(await stake.ownerProfitEth(), (await user.etherAmount * await stake.ownerFee()) / 100);
        })

        it("Should transfer ether correctly after deposit: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);

            await expect(() => stake.depositEth({ value: 1000 }))
                .to.changeEtherBalances([owner, stake], [-1000, 1000]);
        })

        it("Should emit EtherDeposited correctly after deposit: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);


            await expect(stake.depositEth({ value: 1000 }))
                .to.emit(stake, 'EtherDeposited')
                .withArgs(owner.address, 1000)
        });

        //requires
        it("Should revert when the user did not submit ether: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);

            await expect(stake.depositEth({ value: 0 }))
                .to.be.revertedWith("Stake: Submit ether");
        })

    })
    describe("Withdraw-User", function () {
        it("Should call the function with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stakeToken.mint(caller.address, ethers.BigNumber.from("1000"));
            await stakeToken.connect(caller).approve(stake.address, ethers.BigNumber.from("1000"));

            await stake.connect(caller).deposit(depAmount)
            await stake.deposit(depAmount);

            expect(await stake.stakes(owner.address).status, 1);
            await mine(14);


            await stake.withdrawUser();


        })

        it("Should emit UserWithdraw event with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stakeToken.mint(caller.address, ethers.BigNumber.from("1000"));
            await stakeToken.connect(caller).approve(stake.address, ethers.BigNumber.from("1000"));

            await stake.connect(caller).deposit(depAmount)
            await stake.deposit(depAmount);
            await mine(14);

            await expect(stake.withdrawUser())
                .to.emit(stake, 'UserWithdraw')
                .withArgs(owner.address, await stake.profit());
        })

        //requires

        it("Should revert when wants to withdraw before 10 blocks passed: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stakeToken.mint(caller.address, ethers.BigNumber.from("1000"));
            await stakeToken.connect(caller).approve(stake.address, ethers.BigNumber.from("1000"));

            await stake.connect(caller).deposit(depAmount)
            await stake.deposit(depAmount);

            await expect(stake.withdrawUser())
                .to.be.revertedWith("Stake: You should wait");
        })

        it("Should revert when the contract does not have enough tokens to withdraw: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stake.deposit(depAmount);

            await mine(15);

            await expect(stake.withdrawUser())
                .to.be.revertedWith("Stake: not enough tokens");
        })

    })
    describe("Withdraw-User-Ether", function () {
        it("Should call the function with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            await stake.connect(caller).depositEth({ value: 1000 });
            await stake.depositEth({ value: 1000 });
            await mine(10);
            await stake.withdrawUserEth();

            expect(await stake.stakes(owner.address).status, 1)
            expect(await stake.stakes(owner.address).etherAmount, 0)

        })

        it("Should emit UserWithdraw event with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            await stake.connect(caller).depositEth({ value: 1000 }); // deposited by caller in order to have some ether on contract
            await stake.depositEth({ value: 1000 });
            await mine(10);

            await expect(stake.withdrawUserEth())
                .to.emit(stake, 'UserWithdraw')
                .withArgs(owner.address, 1100);
        })

        //requires



        it("Should revert when wants to withdraw before 10 blocks passed: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);

            await stake.depositEth({ value: 1000 });
            await mine(5);

            await expect(stake.withdrawUserEth())
                .to.be.revertedWith("Stake: You should wait");
        })

        it("Should revert when wants to withdraw twice in order: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            await stake.connect(caller).depositEth({ value: 1000 });// for testing: increase contract ethbalance
            await stake.depositEth({ value: 1000 });
            await mine(15);
            await stake.withdrawUserEth();

            await expect(stake.withdrawUserEth())
                .to.be.revertedWith("Stake: You dont have ether");
        })

        it("Should revert when the contract does not have enough ether to withdraw: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            await stake.depositEth({ value: 1000 });
            await mine(15);

            await expect(stake.withdrawUserEth())
                .to.be.revertedWith("Stake: not enough ether in the contract");
        })

    })


    describe("Withdraw-Owner", function () {
        it("Should transfer tokens with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stake.deposit(depAmount);

            await expect(() => stake.withdrawOwner(50))
                .to.changeTokenBalances(stakeToken, [stake, owner], [-50, 50]);
        })

        //requires 

        it("Should revert when the contract does not have enough tokens to withdraw: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stake.deposit(depAmount);
            await mine(10);
            await stakeToken.mint(stake.address, ethers.BigNumber.from("1000"));

            await expect(stake.withdrawOwner(10000))
                .to.be.revertedWith("Stake: Not enought tokens");
        })

        it("Should revert when the owner wants to withdraw more tokens than it is allowed: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stake.deposit(depAmount);
            await mine(10);
            await stakeToken.mint(stake.address, ethers.BigNumber.from("1000"));

            await expect(stake.withdrawOwner(100))
                .to.be.revertedWith("Stake: Too much token withdrawal");
        })

        it("Should emit OwnerWithdraw event with correct args: ", async function () {
            const { stake, owner, caller, stakeToken, otherAccount } = await loadFixture(deployStake);
            const depAmount = ethers.BigNumber.from("1000");
            await stakeToken.mint(owner.address, ethers.BigNumber.from("1000"));
            await stakeToken.approve(stake.address, ethers.BigNumber.from("1000"));
            await stakeToken.mint(caller.address, ethers.BigNumber.from("1000"));
            await stakeToken.connect(caller).approve(stake.address, ethers.BigNumber.from("1000"));

            await stake.connect(caller).deposit(depAmount)
            await stake.deposit(depAmount);
            await mine(14);


            await expect(stake.withdrawOwner(50))
                .to.emit(stake, 'OwnerWithdraw')
                .withArgs(owner.address, 50);
        })
    })
})  