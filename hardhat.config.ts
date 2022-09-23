import * as dotenv from 'dotenv';

import { BigNumber, BigNumberish, constants, utils } from 'ethers';
import { HardhatUserConfig, task, types } from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import { isBytes, isHexString } from '@ethersproject/bytes';
import { GameContext, RockPaperScissors } from './typechain-types/contracts';
import { RockPaperScissors__factory } from './typechain-types/factories/contracts/RockPaperScissors__factory';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';

dotenv.config();

// validate is value if positive BigNumber
const isBigNumberish = (value: any): value is BigNumberish => {
    return (value != null) && (
        BigNumber.isBigNumber(value) ||
        (typeof (value) === 'number' && (value % 1) === 0) ||
        (typeof (value) === 'string' && !!value.match(/^[0-9]+$/)) ||
        isHexString(value) ||
        (typeof (value) === 'bigint') ||
        isBytes(value)
    );
}

// truncate wrapper object for easier reading
const truncateWrapper = (wrapper: RockPaperScissors.GameWrapperStructOutput) => {
    const challenger = {
        adr: wrapper.game.challenger.adr,
        score: wrapper.game.challenger.score,
        hashedMove: wrapper.game.challenger.hashedMove,
        move: wrapper.game.challenger.move
    };

    const opponent = {
        adr: wrapper.game.opponent.adr,
        score: wrapper.game.opponent.score,
        hashedMove: wrapper.game.opponent.hashedMove,
        move: wrapper.game.opponent.move
    };

    const context = {
        waitingForOpponentTimeout: wrapper.context.waitingForOpponentTimeout,
        moveTimeout: wrapper.context.moveTimeout,
        scoreThreshold: wrapper.context.scoreThreshold,
        roundThreshold: wrapper.context.roundThreshold,
        ownerTipRate: wrapper.context.ownerTipRate,
        referralTipRate: wrapper.context.referralTipRate,
        claimTimeout: wrapper.context.claimTimeout
    }

    const game = {
        challenger,
        opponent,
        pot: wrapper.game.pot,
        updateTimestamp: wrapper.game.updateTimestamp,
        acceptBlockNumber: wrapper.game.acceptBlockNumber,
        validateBlockNumber: wrapper.game.validateBlockNumber,
        passwordHash: wrapper.game.passwordHash,
        state: wrapper.game.state,
        round: wrapper.game.round,
        referral: wrapper.game.referral,
        winner: wrapper.game.winner,
        contextIndex: wrapper.game.contextIndex
    }

    return {
        game,
        context,
        timestamp: wrapper.timestamp,
    }
}

const defaultContractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (args, hre) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
        const { address } = account;
        const balance = await account.getBalance();
        console.log(address, utils.formatEther(balance));
    }

    console.log(args);
});

task('deploy', 'deploy contract')
    .setAction(async (args, hre) => {
        const [deployer] = await hre.ethers.getSigners();
        const context = {
            waitingForOpponentTimeout: 1200,
            moveTimeout: 90,
            scoreThreshold: 3,
            roundThreshold: 5,
            ownerTipRate: 300,
            referralTipRate: 200,
            claimTimeout: 259200
        }

        const contractFactory = await hre.ethers.getContractFactory('RockPaperScissors', deployer);
        const contract = await contractFactory.deploy(context);
        await contract.deployed();

        console.log(`RockPaperScissors deployed on address: ${contract.address}`);
    });

task('read-game', 'read specified rock-paper-scissors game')
    .addParam('address', 'address of the rock paper scissors contract', defaultContractAddress, types.string, true)
    .addParam('id', 'id of the game', undefined, types.string, false)
    .setAction(async (args, hre) => {
        if (!hre.ethers.utils.isAddress(args.address))
            throw new Error('Provided input was not an address');

        if (!isBigNumberish(args.id))
            throw new Error('Provided input was not a BigNumber');

        const [deployer] = await hre.ethers.getSigners();

        const contract = RockPaperScissors__factory.connect(args.address, deployer);

        const game = await contract.getGame(args.id);

        console.log(truncateWrapper(game));
    })

task('new-game', 'creates a new rock-paper-scissors game')
    .addParam('address', 'address of the rock paper scissors contract', defaultContractAddress, types.string, true)
    .addParam('referral', 'address of a referral', constants.AddressZero, types.string, true)
    .addParam('password', 'password of the game', undefined, types.string, true)
    .addParam('pot', 'initial pot', '0.01', types.string, true)
    .setAction(async (args, hre) => {
        if (!hre.ethers.utils.isAddress(args.referral))
            throw new Error('Provided input was not an address');

        if (!hre.ethers.utils.isAddress(args.address))
            throw new Error('Provided input was not an address');
        
        const passwordHash = args.password ? keccak256(toUtf8Bytes(args.password)) : constants.HashZero;

        const [deployer] = await hre.ethers.getSigners();

        const contractFactory = await hre.ethers.getContractFactory('RockPaperScissors', deployer);
        const contract = contractFactory.attach(args.address) as RockPaperScissors;

        const tx = await contract.startNewGame(
            args.referral,
            passwordHash,
            { value: hre.ethers.utils.parseEther(args.pot) }
        );

        const receipt = await tx.wait();

        if (receipt.events && receipt.events.length > 0)
            console.log(receipt.events);
        else
            throw new Error('no events found');
    });

task('update-context', 'updates context for future games')
    .addParam('address', 'address of the rock paper scissors contract', defaultContractAddress, types.string, true)
    .addParam('waitingforopponenttimeout', 'time for opponent to accept a game', undefined, types.int, true)
    .addParam('movetimeout', 'time for a player to submit/validate move', undefined, types.int, true)
    .addParam('scorethreshold', 'score value which would trigger game resolution', undefined, types.int, true)
    .addParam('roundthreshold', 'round count which would trigger game resolution', undefined, types.int, true)
    .addParam('ownertipRate', 'owner tip rate in basis points', undefined, types.int, true)
    .addParam('referraltiprate', 'referral tip rate in basis points', undefined, types.int, true)
    .addParam('claimtimeout', 'time after anyone could claim game\'s pot', undefined, types.int, true)
    .setAction(async (args, hre) => {
        const defaults: GameContext.ContextDataStruct = {
            waitingForOpponentTimeout: 1800,
            moveTimeout: 120,
            scoreThreshold: 3,
            roundThreshold: 5,
            ownerTipRate: 300,
            referralTipRate: 200,
            claimTimeout: 259200
        }

        const newContext: GameContext.ContextDataStruct = {
            waitingForOpponentTimeout: args.waitingforopponenttimeout ?? defaults.waitingForOpponentTimeout,
            moveTimeout: args.movetimeout ?? defaults.moveTimeout,
            scoreThreshold: args.scorethreshold ?? defaults.scoreThreshold,
            roundThreshold: args.roundthreshold ?? defaults.roundThreshold,
            ownerTipRate: args.ownertipRate ?? defaults.ownerTipRate,
            referralTipRate: args.referraltiprate ?? defaults.referralTipRate,
            claimTimeout: args.claimtimeout ?? defaults.claimTimeout
        }

        const [deployer] = await hre.ethers.getSigners();

        const contractFactory = await hre.ethers.getContractFactory('RockPaperScissors', deployer);
        const contract = contractFactory.attach(args.address) as RockPaperScissors;

        const tx = await contract.updateContext(newContext);
        const receipt = await tx.wait();

        if (receipt.events && receipt.events.length > 0)
            console.log(receipt.events);
        else
            throw new Error('no events found');
    });

// don't worry it is first four default hardhat private keys
const accounts = [
    {
        privateKey: 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        balance: utils.parseEther('100').toString()
    },
    {
        privateKey: '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        balance: utils.parseEther('100').toString()
    },
    {
        privateKey: '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
        balance: utils.parseEther('100').toString()
    },
    {
        privateKey: '7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
        balance: utils.parseEther('100').toString()
    }
];

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const getMiningSettings = (mine: boolean) => {
    return mine ? { auto: false, interval: 3000 } : undefined;
}

const config: HardhatUserConfig = {
    solidity: {
        version: '0.8.14',
        settings: {
            optimizer: {
                enabled: true,
                runs: 1000
            }
        }
    },
    defaultNetwork: 'hardhat',
    networks: {
        hardhat: {
            accounts,
            chainId: 31337,
            mining: getMiningSettings(process.env.MINE === 'true')
        },
        localhost: {
            url: 'http://localhost:8545',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : accounts.map(account => account.privateKey),
        },
        bscTestnet: {
            url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
            chainId: 97,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        bscMainnet: {
            url: 'https://bsc-dataseed.binance.org/',
            chainId: 56,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: 'USD',
    }
};

export default config;
