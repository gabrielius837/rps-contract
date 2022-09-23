//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract Balance {
    mapping(address => uint256) public balances;

    function withraw() external payable withrawMod() {
        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Withraw(msg.sender, amount);
    }

    modifier withrawMod() {
        require(balances[msg.sender] > 0, "ZERO");
        _;
    }

    event Withraw(address indexed adr, uint256 amount);
}