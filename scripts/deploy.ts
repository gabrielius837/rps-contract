// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from 'hardhat';

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run('compile');

    const context = {
        waitingForOpponentTimeout: 1200,
        moveTimeout: 90,
        scoreThreshold: 3,
        roundThreshold: 5,
        ownerTipRate: 300,
        referralTipRate: 200,
        claimTimeout: 259200
    }

    // We get the contract to deploy
    const contractFactory = await ethers.getContractFactory('RockPaperScissors');
    const contract = await contractFactory.deploy(context);

    await contract.deployed();

    console.log('RockPaperScissors deployed to:', contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
