import { randomBytes } from 'crypto';
import type { RockPaperScissors } from '../typechain-types/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { hexlify, keccak256 } from 'ethers/lib/utils';
import { constants } from 'ethers/lib/ethers';

export const CONTRACT = 'RockPaperScissors';
export const DEFAULT_REFERRAL = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
export const DEFAULT_BET = ethers.utils.parseEther('1');
export const DEFAULT_PASSWORD = 'test';
export const DEFAULT_PASSWORD_HASH = constants.HashZero;
export const DEFAULT_WAITINGFOROPPONENT_TIMEOUT = 600;
export const DEFAULT_MOVE_TIMEOUT = 60;
export const DEFAULT_SCORE_THRESHOLD = 3;
export const DEFAULT_ROUND_THRESHOLD = 5;
export const DEFAULT_OWNER_TIP_RATE = 300;
export const DEFAULT_REFERRAL_TIP_RATE = 200;
export const DEFAULT_CLAIM_TIMEOUT = 60 * 60 * 24 * 3;


interface IContext {
    contract: RockPaperScissors;
    owner: SignerWithAddress;
    challenger: SignerWithAddress;
    opponent: SignerWithAddress;
    referral: SignerWithAddress;
}

interface IGameContext extends IContext {
    gameId: BigNumber;
}

export interface Moves {
    challenger: Move;
    opponent: Move;
}

export const bootstrapContract = async (
    waitingForOpponentTimeout: number = DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    moveTimeout: number = DEFAULT_MOVE_TIMEOUT,
    scoreThreshold: number = DEFAULT_SCORE_THRESHOLD,
    roundThreshold: number = DEFAULT_ROUND_THRESHOLD,
    ownerTipRate: number = DEFAULT_OWNER_TIP_RATE,
    referralTipRate: number = DEFAULT_REFERRAL_TIP_RATE,
    claimTimeout: number = DEFAULT_CLAIM_TIMEOUT
): Promise<IContext> => {
    // arrange
    const [owner, challenger, opponent, referral] = await ethers.getSigners();
    const definitions = {
        waitingForOpponentTimeout,
        moveTimeout,
        scoreThreshold,
        roundThreshold,
        ownerTipRate,
        referralTipRate,
        claimTimeout
    }

    // deploy
    const factory = await ethers.getContractFactory(CONTRACT, owner);
    const contract = await factory.deploy(definitions) as RockPaperScissors;
    await contract.deployed();

    // register referral
    const registrationTx = await contract.connect(referral).registerReferral();
    await registrationTx.wait();

    return { contract, owner, challenger, opponent, referral };
}

export const bootstrapStartGame = async (
    referralAddress: string = DEFAULT_REFERRAL,
    bet: BigNumber = DEFAULT_BET,
    password: string = DEFAULT_PASSWORD,
    startTimeout: number = DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    moveTimeout: number = DEFAULT_MOVE_TIMEOUT,
    scoreThreshold: number = DEFAULT_SCORE_THRESHOLD,
    roundThreshold: number = DEFAULT_ROUND_THRESHOLD,
    ownerTipRate: number = DEFAULT_OWNER_TIP_RATE,
    referralTipRate: number = DEFAULT_REFERRAL_TIP_RATE,
    claimTimeout: number = DEFAULT_CLAIM_TIMEOUT
): Promise<IGameContext> => {
    // arrange
    const {
        contract,
        owner,
        challenger,
        opponent,
        referral
    } = await bootstrapContract(
        startTimeout,
        moveTimeout,
        scoreThreshold,
        roundThreshold,
        ownerTipRate,
        referralTipRate,
        claimTimeout
    );
    const initialWalletBalance = await challenger.getBalance();
    const initialContractBalance = await contract.provider.getBalance(contract.address);
    const event = 'GameUpdated';

    const hash = keccak256(ethers.utils.toUtf8Bytes(password));
    const startGameTxTask = contract.connect(challenger)
        .startNewGame(referralAddress, hash, { value: bet });
    const startGameTx = await startGameTxTask;
    const receipt = await startGameTx.wait();

    const block = await contract.provider.getBlock(receipt.blockHash);
    const diff = receipt.gasUsed.mul(receipt.effectiveGasPrice).add(bet);
    const currentWalletBalance = await challenger.getBalance();
    const currentContractBalance = await contract.provider.getBalance(contract.address);

    // assert
    const gameId = BigNumber.from(0);
    const { game } = await contract.getGame(gameId);
    await expect(startGameTxTask).to.emit(contract, event)
        .withArgs(gameId, GameState.WaitingForOpponent);
    expect(initialContractBalance).to.be.equal(currentContractBalance.sub(bet), 'Initial and current contract balances must match after adjustment');
    expect(initialWalletBalance).to.be.equal(currentWalletBalance.add(diff), 'Initial and current wallet balances must match after adjustment');
    expect(game.challenger.adr).to.be.equal(challenger.address, 'Addresses must match');
    expect(game.pot).to.be.equal(bet, 'Bet and pot must match');
    expect(game.state).to.be.equal(GameState.WaitingForOpponent, 'State must be WaitingForOpponent');
    expect(game.referral).to.be.equal(referralAddress, 'Referrals must match');
    expect(game.passwordHash).to.be.equal(hash, 'Provided string must produce matching hashes');
    expect(game.updateTimestamp).to.be.equal(block.timestamp, 'Timestamp must be updated');

    return {
        contract,
        owner,
        challenger,
        opponent,
        referral,
        gameId
    };
}

export const bootstrapAcceptedGame = async (
    referralAddress: string = DEFAULT_REFERRAL,
    bet: BigNumber = DEFAULT_BET,
    password: string = DEFAULT_PASSWORD,
    startTimeout: number = DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    moveTimeout: number = DEFAULT_MOVE_TIMEOUT,
    scoreThreshold: number = DEFAULT_SCORE_THRESHOLD,
    roundThreshold: number = DEFAULT_ROUND_THRESHOLD,
    ownerTipRate: number = DEFAULT_OWNER_TIP_RATE,
    referralTipRate: number = DEFAULT_REFERRAL_TIP_RATE,
    claimTimeout: number = DEFAULT_CLAIM_TIMEOUT
): Promise<IGameContext> => {
    // arrange
    const {
        contract,
        owner,
        challenger,
        opponent,
        referral,
        gameId
    } = await bootstrapStartGame(
        referralAddress,
        bet,
        password,
        startTimeout,
        moveTimeout,
        scoreThreshold,
        roundThreshold,
        ownerTipRate,
        referralTipRate,
        claimTimeout
    );
    const initialWalletBalance = await opponent.getBalance();
    const initialContractBalance = await contract.provider.getBalance(contract.address);
    const adr = opponent.address;
    const acceptGameTxTask = contract.connect(opponent)
        .acceptGame(gameId, password, { value: bet });
    const acceptGameTx = await acceptGameTxTask;
    const receipt = await acceptGameTx.wait();
    const { game } = await contract.getGame(gameId);
    const currentWalletBalance = await opponent.getBalance();
    const currentContractBalance = await contract.provider.getBalance(contract.address);
    const diff = receipt.gasUsed.mul(receipt.effectiveGasPrice).add(bet);

    // assert event
    await expect(acceptGameTxTask, 'Accepting game must emit \'GameUpdated\' event')
        .to.emit(contract, 'GameUpdated')
        .withArgs(gameId, GameState.PendingMoves);

    // assert balances
    expect(initialContractBalance).to.be.equal(currentContractBalance.sub(bet), 'initial and current contract balances must match after adjustment');
    expect(initialWalletBalance).to.be.equal(currentWalletBalance.add(diff), 'initial and current wallet balances must match after adjustment');   // assert balance

    // assert game
    expect(game.pot).to.be.equal(bet.mul(2), 'game pot value must be double of min bet');
    expect(game.state).to.be.equal(1, 'game state must be \'PendingMoves\'');
    expect(game.opponent.adr).to.be.equal(adr, 'addresses must match');
    expect(game.acceptBlockNumber).to.be.equal(receipt.blockNumber, 'must be updated');

    return {
        contract,
        owner,
        challenger,
        opponent,
        referral,
        gameId
    };
}

export const boostrapMovedGame = async (
    moves: Moves[] = [],
    referralAddress: string = DEFAULT_REFERRAL,
    bet: BigNumber = DEFAULT_BET,
    password: string = DEFAULT_PASSWORD,
    startTimeout: number = DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    moveTimeout: number = DEFAULT_MOVE_TIMEOUT,
    scoreThreshold: number = DEFAULT_SCORE_THRESHOLD,
    roundThreshold: number = DEFAULT_ROUND_THRESHOLD,
    ownerTipRate: number = DEFAULT_OWNER_TIP_RATE,
    referralTipRate: number = DEFAULT_REFERRAL_TIP_RATE,
    claimTimeout: number = DEFAULT_CLAIM_TIMEOUT
): Promise<IGameContext> => {
    const {
        contract,
        owner,
        challenger,
        opponent,
        referral,
        gameId
    } = await bootstrapAcceptedGame(
        referralAddress,
        bet,
        password,
        startTimeout,
        moveTimeout,
        scoreThreshold,
        roundThreshold,
        ownerTipRate,
        referralTipRate,
        claimTimeout
    );

    for (let index = 0; index < moves.length; index++)
    {
        const move = moves[index];

        const challengerMove = wrapMove(move.challenger);
        const opponentMove = wrapMove(move.opponent);

        await submitHashedMoves(
            contract,
            gameId,
            challenger,
            challengerMove.hashedMove,
            opponent,
            opponentMove.hashedMove
        );

        await submitMoves(
            contract,
            gameId,
            challenger,
            challengerMove.unhashedMove,
            opponent,
            opponentMove.unhashedMove
        );
    }

    return {
        contract,
        owner,
        challenger,
        opponent,
        referral,
        gameId
    };
}

export const bootstrapFinishedGame = async (
    moves: Moves[],
    referralAddress: string = DEFAULT_REFERRAL,
    bet: BigNumber = DEFAULT_BET,
    password: string = DEFAULT_PASSWORD,
    startTimeout: number = DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    moveTimeout: number = DEFAULT_MOVE_TIMEOUT,
    scoreThreshold: number = DEFAULT_SCORE_THRESHOLD,
    roundThreshold: number = DEFAULT_ROUND_THRESHOLD,
    ownerTipRate: number = DEFAULT_OWNER_TIP_RATE,
    referralTipRate: number = DEFAULT_REFERRAL_TIP_RATE,
    claimTimeout: number = DEFAULT_CLAIM_TIMEOUT
) => {
    const {
        contract,
        owner,
        challenger,
        opponent,
        referral,
        gameId
    } = await boostrapMovedGame(
        moves,
        referralAddress,
        bet,
        password,
        startTimeout,
        moveTimeout,
        scoreThreshold,
        roundThreshold,
        ownerTipRate,
        referralTipRate,
        claimTimeout
    );

    const { game } = await contract.getGame(gameId);
    expect(game.state).to.be.equal(GameState.Finished, 'must be finished');
    expect(game.winner).to.be.not.equal(constants.AddressZero, 'winner must be assigned');

    return {
        contract,
        owner,
        challenger,
        opponent,
        referral,
        gameId
    };
}

export const submitHashedMoves = async (
    contract: RockPaperScissors,
    gameId: BigNumber,
    challenger: SignerWithAddress,
    challengerMove: string,
    opponent: SignerWithAddress,
    opponentMove: string
) => {
    const challengerSubmitHashedMoveTx = await contract.connect(challenger).submitHashedMove(gameId, challengerMove);
    await challengerSubmitHashedMoveTx.wait();
    
    const opponentSubmitHashedMoveTx = await contract.connect(opponent).submitHashedMove(gameId, opponentMove);
    await opponentSubmitHashedMoveTx.wait();
}

export const submitMoves = async (
    contract: RockPaperScissors,
    gameId: BigNumber,
    challenger: SignerWithAddress,
    challengerUnhashedMove: string,
    opponent: SignerWithAddress,
    opponentUnhashedMove: string,
) => {
    const challengerSubmitMoveTx = await contract.connect(challenger).submitMove(gameId, challengerUnhashedMove);
    await challengerSubmitMoveTx.wait();

    const opponentSubmitMoveTx = await contract.connect(opponent).submitMove(gameId, opponentUnhashedMove);
    await opponentSubmitMoveTx.wait();
}

export enum Move {
    Illegal,
    Rock,
    Paper,
    Scissors
}

export enum GameState {
    WaitingForOpponent,
    PendingMoves,
    ValidatingMoves,
    Finished
}

export const wrapMove = (move: Move): { 
    unhashedMove: string,
    hashedMove: string 
} => {
    const buffer = randomBytes(32);
    buffer[31] = buffer[31] & 0xFC | move;
    return {
        unhashedMove: hexlify(Uint8Array.from(buffer)),
        hashedMove: keccak256(buffer)
    }
}

export const parseMove = (hash: string): Move => {
    if (hash.length != 66)
        console.error(`Unexpected length of hash: ${hash}, expected 66, got ${hash.length}`);

    const byte = parseInt(hash.slice(-2), 16) & 0x03;

    switch (byte) {
        case 0:
            return Move.Illegal
        case 1:
            return Move.Rock;
        case 2:
            return Move.Paper;
        case 3:
            return Move.Scissors;
        default:
            console.error('Unexpected byte encountered', byte);
            return Move.Illegal;
    }
}

export const calculateRewards = (pot: BigNumber, ownerTip: number, referralTip: number) => {
    const basis = BigNumber.from(10000);
    const owner = pot.mul(ownerTip).div(basis);
    const referral = pot.mul(referralTip).div(basis);
    const winner = pot.sub(owner).sub(referral);

    return { winner, owner, referral }
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));