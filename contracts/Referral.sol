//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract Referral {
    mapping(address => bool) public referrals;

    function registerReferral() external payable referralMod {
        referrals[msg.sender] = true;
        emit NewReferral(msg.sender);
    }

    modifier referralMod() {
        require(!referrals[msg.sender], "REGISTERED");
        _;
    }

    event NewReferral(address indexed ref);
}