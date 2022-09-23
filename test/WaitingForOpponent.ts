import { expect } from 'chai';
import { BigNumber, ethers, utils } from 'ethers';

import {
    bootstrapAcceptedGame,
    bootstrapContract,
    bootstrapStartGame,
    calculateRewards,
    DEFAULT_BET,
    DEFAULT_MOVE_TIMEOUT,
    DEFAULT_OWNER_TIP_RATE,
    DEFAULT_PASSWORD,
    DEFAULT_REFERRAL,
    DEFAULT_REFERRAL_TIP_RATE,
    DEFAULT_ROUND_THRESHOLD,
    DEFAULT_SCORE_THRESHOLD,
    DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    GameState,
    Move,
    wrapMove,
} from './Definitions';

describe('When waiting for opponent...', () => {
    describe('aborting game...', () => {
        it('as challenger must succeed', async () => {
            // arrange
            const { contract, challenger, gameId } = await bootstrapStartGame();
            const initialWalletBalance = await challenger.getBalance();
            const initialContractBalance = await contract.provider.getBalance(contract.address);

            // act
            const abortTx = await contract.connect(challenger).abortGame(gameId);
            const receipt = await abortTx.wait();
            const block = await contract.provider.getBlock(receipt.blockHash);
            const { game } = await contract.getGame(gameId);
            const currentWalletBalance = await challenger.getBalance();
            const currentContractBalance = await contract.provider.getBalance(contract.address);
            const diff = receipt.gasUsed.mul(receipt.effectiveGasPrice);

            // assert balance
            expect(initialWalletBalance).to.be.equal(currentWalletBalance.sub(DEFAULT_BET).add(diff), 'Initial and current wallet balance must match after adjustment');
            expect(initialContractBalance).to.be.equal(currentContractBalance.add(DEFAULT_BET), 'Initial and current contract balances must match after adjustment');

            // assert game
            expect(game.state).to.be.equal(GameState.Finished, 'Game state must be Finished');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'Timestamps must match');
        });

        it('as a not involved address must fail', async () => {
            // arrange
            const { contract, challenger } = await bootstrapContract();
            const message = 'REFERRAL';
            const value = utils.parseEther('1');
            // act
            const GameUpdatedTxTask = contract.connect(challenger).startNewGame(challenger.address, ethers.constants.HashZero, { value })
            // assert
            await expect(GameUpdatedTxTask).to.be.revertedWith(message);
        });
    });

    describe('accepting game...', () => {
        it('must succeed', async () => {
            await bootstrapAcceptedGame();
        });

        it('as challenger must fail', async () => {
            // arrange
            const { contract, challenger, gameId } = await bootstrapStartGame(DEFAULT_REFERRAL, DEFAULT_BET, DEFAULT_PASSWORD);
            const message = 'ADDRESS';

            // act
            const acceptGameTxTask = contract.connect(challenger).acceptGame(gameId, DEFAULT_PASSWORD, { value: DEFAULT_BET });

            // assert
            await expect(acceptGameTxTask).to.be.revertedWith(message);
        });

        it('with wrong password must fail', async () => {
            // arrange
            const { contract, opponent, gameId } = await bootstrapStartGame(DEFAULT_REFERRAL, DEFAULT_BET);
            const message = 'PASSWORD';

            // act
            const acceptGameTxTask = contract.connect(opponent).acceptGame(gameId, 'random', { value: DEFAULT_BET });

            // assert
            await expect(acceptGameTxTask).to.be.revertedWith(message);
        });

        it('with wrong value must fail', async () => {
            // arrange
            const { contract, opponent, gameId } = await bootstrapStartGame(DEFAULT_REFERRAL, DEFAULT_BET, DEFAULT_PASSWORD);
            const message = 'VALUE';

            // act
            const acceptGameMinusTxTask = contract.connect(opponent).acceptGame(gameId, DEFAULT_PASSWORD, { value: DEFAULT_BET.sub(1) });
            const acceptGamePlusTxTask = contract.connect(opponent).acceptGame(gameId, DEFAULT_PASSWORD, { value: DEFAULT_BET.add(1) });

            // assert
            await expect(acceptGameMinusTxTask)
                .to.be.revertedWith(message);
            await expect(acceptGamePlusTxTask)
                .to.be.revertedWith(message);
        });

        it('when it is expired must fail', async () => {
            // arrange
            const { contract, opponent, gameId } = await bootstrapStartGame(DEFAULT_REFERRAL, DEFAULT_BET, DEFAULT_PASSWORD, 0);

            // act
            const acceptGameTxTask = contract.connect(opponent).acceptGame(gameId, DEFAULT_PASSWORD, { value: DEFAULT_BET });

            // assert
            await expect(acceptGameTxTask)
                .to.be.revertedWith('UNELIGIBLE');
        });
    })

    it('submitting hashed move must fail', async () => {
        // arrange
        const { contract, opponent, gameId } = await bootstrapStartGame();
        const { hashedMove } = wrapMove(Move.Paper);
        const message = 'UNELIGIBLE';

        // act
        const acceptGameTxTask = contract.connect(opponent).submitHashedMove(gameId, hashedMove);

        // assert
        await expect(acceptGameTxTask)
            .to.be.revertedWith(message);
    });

    it('submitting move must fail', async () => {
        // arrange
        const { contract, opponent, gameId } = await bootstrapStartGame();
        const { unhashedMove } = wrapMove(Move.Paper);
        const message = 'UNELIGIBLE';

        // act
        const acceptGameTxTask = contract.connect(opponent).submitMove(gameId, unhashedMove);

        // assert
        await expect(acceptGameTxTask)
            .to.be.revertedWith(message);
    });

    it('surrendering game must fail', async () => {
        // arrange
        const { contract, opponent, gameId } = await bootstrapStartGame();
        const message = 'UNELIGIBLE';

        // act
        const acceptGameTxTask = contract.connect(opponent).surrenderGame(gameId);

        // assert
        await expect(acceptGameTxTask)
            .to.be.revertedWith(message);
    });

    describe('claiming pot...', () => {
        it('before claim timeout must fail', async () => {
            // arrange
            const { contract, opponent, gameId } = await bootstrapStartGame();
            const message = 'UNELIGIBLE';

            // act
            const acceptGameTxTask = contract.connect(opponent).claimPot(gameId);

            // assert
            await expect(acceptGameTxTask)
                .to.be.revertedWith(message);
        });

        it('after claim timeout must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapStartGame(
                DEFAULT_REFERRAL,
                DEFAULT_BET,
                DEFAULT_PASSWORD,
                0,
                DEFAULT_MOVE_TIMEOUT,
                DEFAULT_SCORE_THRESHOLD,
                DEFAULT_ROUND_THRESHOLD,
                DEFAULT_OWNER_TIP_RATE,
                DEFAULT_REFERRAL_TIP_RATE,
                0
            );

            const event = 'GameUpdated';
            const { game: initialGame, context } = await contract.getGame(gameId);
            const initialContractBalance = await contract.provider.getBalance(contract.address);
            const initialChallengerBalance = await contract.balances(challenger.address);
            const initialOpponentBalance = await contract.balances(opponent.address);
            const initialOwnerBalance = await contract.balances(owner.address);
            const initialReferralBalance = await contract.balances(referral.address);
            const rewards = calculateRewards(initialGame.pot, context.ownerTipRate, context.referralTipRate);

            // act
            const referralClaimTxTask = contract.connect(referral).claimPot(gameId);
            const referralClaimTx = await referralClaimTxTask;
            const reciept = await referralClaimTx.wait();
            const block = await contract.provider.getBlock(reciept.blockHash);
            const { game } = await contract.getGame(gameId);

            const contractBalance = await contract.provider.getBalance(contract.address);
            const challengerBalance = await contract.balances(challenger.address);
            const opponentBalance = await contract.balances(opponent.address);
            const ownerBalance = await contract.balances(owner.address);
            const referralBalance = await contract.balances(referral.address);

            // assert
            await expect(referralClaimTxTask)
                .to.emit(contract, event)
                .withArgs(gameId, GameState.Finished);
            expect(game.state).to.be.equal(GameState.Finished, 'must be finished');
            expect(game.winner).to.be.equal(referral.address, 'refrral must be winner');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'timestmaps must match');
            expect(initialContractBalance).to.be.equal(contractBalance, 'contract balances must match');
            expect(initialChallengerBalance).to.be.equal(challengerBalance, 'loser/challenger balances must match');
            expect(initialOpponentBalance).to.be.equal(opponentBalance, 'opponent/winner balances must match');
            expect(initialOwnerBalance.add(rewards.owner)).to.be.equal(ownerBalance, 'adjusted owner balances must match');
            expect(initialReferralBalance.add(rewards.referral).add(rewards.winner)).to.be.equal(referralBalance, 'adjusted referral balances must match');
        });
    });
});