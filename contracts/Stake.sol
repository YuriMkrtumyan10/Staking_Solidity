// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;
// 1. Custom types struct/enum
// 2. state variables
// 3. data structures
// 4. events
// 5. constructor
// 6. modifiers
// 7. view/pure~
// 8. external
// 9. public
// 10. internal
// 11. private
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakeToken.sol";
import "hardhat/console.sol";

contract Stake is Ownable {
    enum Status {
        DEPOSITED,
        WITHDRAWED
    }

    struct User {
        uint256 id;
        uint256 tokenAmount;
        uint256 etherAmount;
        uint256 depositTime;
        Status status;
    }
    uint256 public ownerFee;
    uint256 public ownerProfitToken;
    uint256 public ownerProfitEth;
    uint256 public stakersNumber;
    StakeToken public token;

    mapping(address => User) public stakes;

    event Deposited(address _who, uint256 _tokenAmount);
    event UserWithdraw(address _who, uint256 _tokenAmount);
    event OwnerWithdraw(address _who, uint256 _tokenAmount);
    event EtherDeposited(address _who, uint256 _tokenAmount);

    constructor(uint256 _ownerFee) {
        require(_ownerFee <= 5 && _ownerFee >= 2, "Stake: Invalid owner fee");
        ownerFee = _ownerFee;
        token = new StakeToken();
    }

    //for testing
    function profit() public view returns (uint256) {
        return
            stakes[msg.sender].tokenAmount +
            (stakes[msg.sender].tokenAmount *
                ((block.number - stakes[msg.sender].depositTime) / 10) *
                10) /
            100;
    }

    function depositEth() public payable {
        require(msg.value > 0, "Stake: Submit ether");
        require(
            address(msg.sender).balance >= msg.value,
            "Stake: not enough ether"
        );

        stakersNumber++;
        stakes[msg.sender] = User(
            stakersNumber,
            0,
            msg.value,
            block.number,
            Status.DEPOSITED
        );

        ownerProfitEth = (msg.value * ownerFee) / 100;

        emit EtherDeposited(msg.sender, msg.value);
    }

    function deposit(uint256 _depAmount) public {
        require(_depAmount > 0, "Stake: Submit tokens");
        require(
            IERC20(address(token)).balanceOf(msg.sender) >= _depAmount,
            "Stake: not enough tokens"
        );
        require(
            IERC20(address(token)).allowance(msg.sender, address(this)) >=
                _depAmount,
            "Stake: Not enough allowance"
        );

        IERC20(address(token)).transferFrom(
            msg.sender,
            address(this),
            _depAmount
        );

        stakersNumber++;
        stakes[msg.sender] = User(
            stakersNumber,
            _depAmount,
            0,
            block.number,
            Status.DEPOSITED
        );

        ownerProfitToken = (_depAmount * ownerFee) / 100;

        emit Deposited(msg.sender, _depAmount);
    }

    function withdrawUserEth(uint256 _id) public payable {
        require(_id > 0 && _id <= stakes[msg.sender].id, "Stake: Invalid ID");
        require(
            block.number >= stakes[msg.sender].depositTime + 10,
            "Stake: You should wait"
        );
        require(
            stakes[msg.sender].etherAmount > 0,
            "Stake: You dont have ether"
        );
        require(
            address(this).balance >=
                stakes[msg.sender].etherAmount +
                    (stakes[msg.sender].etherAmount *
                        ((block.number - stakes[msg.sender].depositTime) / 10) *
                        10) /
                    100,
            "Stake: not enough ether in the contract"
        );
        uint256 transferAmount = stakes[msg.sender].etherAmount;
        stakes[msg.sender].etherAmount = 0;

        payable(msg.sender).transfer(
            transferAmount +
                (transferAmount *
                    ((block.number - stakes[msg.sender].depositTime) / 10) *
                    10) /
                100
        );

        stakes[msg.sender].status == Status.WITHDRAWED;

        emit UserWithdraw(
            msg.sender,
            transferAmount +
                (transferAmount *
                    ((block.number - stakes[msg.sender].depositTime) / 10) *
                    10) /
                100
        );
    }

    function withdrawUser(uint256 _id) public {
        require(_id > 0 && _id <= stakes[msg.sender].id, "Stake: Invalid ID");
        require(
            block.number >= stakes[msg.sender].depositTime + 10,
            "Stake: You should wait"
        );
        require(
            IERC20(address(token)).balanceOf(address(this)) >=
                stakes[msg.sender].tokenAmount +
                    (stakes[msg.sender].tokenAmount *
                        ((block.number - stakes[msg.sender].depositTime) / 10) *
                        10) /
                    100,
            "Stake: not enough tokens"
        );

        require(
            IERC20(address(token)).allowance(address(this), msg.sender) ==
                stakes[msg.sender].tokenAmount +
                    (stakes[msg.sender].tokenAmount *
                        ((block.number - stakes[msg.sender].depositTime) / 10) *
                        10) /
                    100,
            "Stake: Not enough allowance"
        );

        IERC20(address(token)).transferFrom(
            address(this),
            msg.sender,
            stakes[msg.sender].tokenAmount +
                (stakes[msg.sender].tokenAmount *
                    ((block.number - stakes[msg.sender].depositTime) / 10) *
                    10) /
                100
        );

        stakes[msg.sender].status == Status.WITHDRAWED;

        emit UserWithdraw(
            msg.sender,
            stakes[msg.sender].tokenAmount +
                (stakes[msg.sender].tokenAmount *
                    ((block.number - stakes[msg.sender].depositTime) / 10) *
                    10) /
                100
        );
    }

    function withdrawOwner(uint256 _amount) public onlyOwner {
        require(
            IERC20(address(token)).balanceOf(address(this)) >= _amount,
            "Stake: Not enought tokens"
        );
        require(
            _amount <= ownerProfitToken,
            "Stake: Too much token withdrawal"
        );

        IERC20(address(token)).transferFrom(address(this), msg.sender, _amount);

        emit OwnerWithdraw(msg.sender, _amount);
    }

    function withdrawOwnerEth(uint256 _amountEth) public onlyOwner {
        require(
            address(this).balance >= _amountEth,
            "Stake: Not enought ether"
        );
        require(
            _amountEth <= ownerProfitEth,
            "Stake: Too much ether withdrawal"
        );

        payable(msg.sender).transfer(_amountEth);

        emit OwnerWithdraw(msg.sender, _amountEth);
    }
}
