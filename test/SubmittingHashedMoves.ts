import { expect } from 'chai';
import { constants, BigNumber } from 'ethers';

import {
    bootstrapAcceptedGame,
    calculateRewards,
    DEFAULT_BET,
    DEFAULT_OWNER_TIP_RATE,
    DEFAULT_PASSWORD,
    DEFAULT_REFERRAL,
    DEFAULT_REFERRAL_TIP_RATE,
    DEFAULT_ROUND_THRESHOLD,
    DEFAULT_SCORE_THRESHOLD,
    DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    GameState,
    Move,
    sleep,
    wrapMove,
} from './Definitions';

describe('When waiting for hashed move submissions...', () => {
    it('aborting game must fail', async () => {
        // arrange
        const { contract, challenger, gameId } = await bootstrapAcceptedGame();
        const message = 'UNELIGIBLE';

        // act
        const abortGameTxTask = contract.connect(challenger).abortGame(gameId);

        // assert
        await expect(abortGameTxTask).to.be.revertedWith(message);
    });

    it('accepting game must fail', async () => {
        // arrange
        const { contract, opponent, gameId } = await bootstrapAcceptedGame(DEFAULT_REFERRAL, DEFAULT_BET, DEFAULT_PASSWORD);
        const message = 'UNELIGIBLE';

        // act
        const secondAcceptTxTask = contract.connect(opponent).acceptGame(gameId, DEFAULT_PASSWORD, { value: DEFAULT_BET });

        // assert
        await expect(secondAcceptTxTask).to.be.revertedWith(message);
    });

    describe('submitting hashed move/-s...', () => {
        it('as challenger must succeed', async () => {
            // arrange
            const { contract, challenger, gameId } = await bootstrapAcceptedGame();
            const { hashedMove } = wrapMove(Move.Paper);

            // act
            const submitHashedMoveTxTask = contract.connect(challenger).submitHashedMove(gameId, hashedMove);
            const submitHashedMoveTx = await submitHashedMoveTxTask;
            await submitHashedMoveTx.wait();
            const { game } = await contract.getGame(gameId);

            // assert
            expect(game.state).to.be.equal(GameState.PendingMoves, 'After first move submission state must not change');
            expect(game.challenger.hashedMove).to.be.equal(hashedMove, 'Submitted move by challenger must be updated');
            expect(game.opponent.hashedMove).to.be.equal(constants.HashZero, 'Submitted move by challenger must not update one belonging to opponent');
        });

        it('as opponent after challenger must succeed', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const { hashedMove: hashedChallengerMove } = wrapMove(Move.Paper);
            const { hashedMove: hashedOpponentMove } = wrapMove(Move.Paper);

            // act
            const submitChallengerHashedMoveTx = await contract.connect(challenger).submitHashedMove(gameId, hashedChallengerMove);
            await submitChallengerHashedMoveTx.wait();
            const submitOpponentHashedMoveTxTask = contract.connect(opponent).submitHashedMove(gameId, hashedOpponentMove);
            const submitOpponentHashedMoveTx = await submitOpponentHashedMoveTxTask;
            const receipt = await submitOpponentHashedMoveTx.wait();
            const block = await contract.provider.getBlock(receipt.blockHash);
            const { game } = await contract.getGame(gameId);

            // assert
            expect(game.state).to.be.equal(GameState.ValidatingMoves, 'After both move submissions state must change');
            expect(game.challenger.hashedMove).to.be.equal(hashedChallengerMove, 'Submitted move by challenger must be updated');
            expect(game.opponent.hashedMove).to.be.equal(hashedOpponentMove, 'Submitted move by opponent must be updated');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'After submitting both hashed moves related timestamp must be updated');
        });

        it('as challenger for a second time must fail', async () => {
            // arrange
            const { contract, challenger, gameId } = await bootstrapAcceptedGame();
            const moves = wrapMove(Move.Paper);
            const message = 'SUBMITTED';

            // act
            const submitHashedMoveTx = await contract.connect(challenger).submitHashedMove(gameId, moves.hashedMove);
            await submitHashedMoveTx.wait();
            const secondSubmitHashedMoveTx = contract.connect(challenger).submitHashedMove(gameId, moves.hashedMove);

            // assert
            await expect(secondSubmitHashedMoveTx)
                .to.be.revertedWith(message);
        });

        it('as opponent must succeed', async () => {
            // arrange
            const { contract, opponent, gameId } = await bootstrapAcceptedGame();
            const { hashedMove } = wrapMove(Move.Paper);

            // act
            const submitHashedMoveTxTask = contract.connect(opponent).submitHashedMove(gameId, hashedMove);
            const submitHashedMoveTx = await submitHashedMoveTxTask;
            await submitHashedMoveTx.wait();
            const { game } = await contract.getGame(gameId);

            // assert
            expect(game.state).to.be.equal(GameState.PendingMoves, 'After first move submission state must not change');
            expect(game.opponent.hashedMove).to.be.equal(hashedMove, 'Submitted move by opponent must be updated');
            expect(game.challenger.hashedMove).to.be.equal(constants.HashZero, 'Submitted move by opponent must not update one belonging to opponent');
        });


        it('as challenger after opponent must succeed', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const { hashedMove: hashedChallengerMove } = wrapMove(Move.Rock);
            const { hashedMove: hashedOpponentMove } = wrapMove(Move.Scissors);

            // act
            const submitOpponentHashedMoveTx = await contract.connect(opponent).submitHashedMove(gameId, hashedOpponentMove);
            await submitOpponentHashedMoveTx.wait();
            const submitChallengerHashedMoveTxTask = contract.connect(challenger).submitHashedMove(gameId, hashedChallengerMove);
            const submitChallengerHashedMoveTx = await submitChallengerHashedMoveTxTask;
            const receipt = await submitChallengerHashedMoveTx.wait();
            const block = await contract.provider.getBlock(receipt.blockHash);
            const { game, context } = await contract.getGame(gameId);

            // assert
            expect(game.state).to.be.equal(GameState.ValidatingMoves, 'After both move submissions state must change');
            expect(game.challenger.hashedMove).to.be.equal(hashedChallengerMove, 'Submitted move by challenger must be updated');
            expect(game.opponent.hashedMove).to.be.equal(hashedOpponentMove, 'Submitted move by opponent must be updated');
            expect(game.updateTimestamp).to.be.equal(BigNumber.from(block.timestamp), 'After submitting both hashed moves related timestamp must be updated');
        });

        it('as opponent for a second time must fail', async () => {
            // arrange
            const { contract, opponent, gameId } = await bootstrapAcceptedGame();
            const message = 'SUBMITTED';
            const moves = wrapMove(Move.Paper);

            // act
            const submitHashedMoveTx = await contract.connect(opponent).submitHashedMove(gameId, moves.hashedMove);
            await submitHashedMoveTx.wait();
            const secondSubmitHashedMoveTxTask = contract.connect(opponent).submitHashedMove(gameId, moves.hashedMove);

            // assert
            await expect(secondSubmitHashedMoveTxTask)
                .to.be.revertedWith(message);
        });

        it('as a not involved address must fail', async () => {
            // arrange
            const { contract, referral, gameId } = await bootstrapAcceptedGame();
            const message = 'ADDRESS';
            const moves = wrapMove(Move.Rock);

            // act
            const submitHashedMoveTxTask = contract.connect(referral).submitHashedMove(gameId, moves.hashedMove);

            // assert
            await expect(submitHashedMoveTxTask)
                .to.be.revertedWith(message);
        });
    });

    it('submitting unhashed move must fail', async () => {
        // arrange
        const { contract, opponent, gameId } = await bootstrapAcceptedGame();
        const moves = wrapMove(Move.Scissors);

        // act
        const submitHashedMoveTxTask = contract.connect(opponent).submitMove(gameId, moves.unhashedMove);

        // assert
        await expect(submitHashedMoveTxTask)
            .to.be.revertedWith('UNELIGIBLE');
    });

    describe('surrendering...', () => {
        it('as challenger must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame();
            const event = 'GameUpdated';
            const { game: oldGame, context } = await contract.getGame(gameId);
            const output = calculateRewards(oldGame.pot, context.ownerTipRate, context.referralTipRate);
            const oldOpponentBalance = await contract.balances(opponent.address);
            const oldOwnerBalance = await contract.balances(owner.address);
            const oldReferralBalance = await contract.balances(referral.address);

            // act
            const surrenderTxTask = contract.connect(challenger).surrenderGame(gameId);
            const surrenderTx = await surrenderTxTask;
            const tx = await surrenderTx.wait();
            const block = await contract.provider.getBlock(tx.blockHash);
            const { game } = await contract.getGame(gameId);
            const opponentBalance = await contract.balances(opponent.address);
            const ownerBalance = await contract.balances(owner.address);
            const referralBalance = await contract.balances(referral.address);


            // assert
            await expect(surrenderTxTask)
                .to.emit(contract, event)
                .withArgs(gameId, GameState.Finished);
            expect(game.state).to.be.equal(GameState.Finished, 'Game must be finished');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'Timestamp must be updated');
            expect(oldOpponentBalance.add(output.winner)).to.be.equal(opponentBalance, 'Adjusted opponent balance must match');
            expect(oldOwnerBalance.add(output.owner)).to.be.equal(ownerBalance, 'Adjusted owner balance must match');
            expect(oldReferralBalance.add(output.referral)).to.be.equal(referralBalance, 'Adjusted referral balance must match');
        });


        it('as opponent must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame();
            const event = 'GameUpdated';
            const { game: oldGame, context } = await contract.getGame(gameId);
            const output = calculateRewards(oldGame.pot, context.ownerTipRate, context.referralTipRate);
            const oldChallengerBalance = await contract.balances(challenger.address);
            const oldOwnerBalance = await contract.balances(owner.address);
            const oldReferralBalance = await contract.balances(referral.address);

            // act
            const surrenderTxTask = contract.connect(opponent).surrenderGame(gameId);
            const surrenderTx = await surrenderTxTask;
            const tx = await surrenderTx.wait();
            const block = await contract.provider.getBlock(tx.blockHash);
            const { game } = await contract.getGame(gameId);
            const challengerBalance = await contract.balances(challenger.address);
            const ownerBalance = await contract.balances(owner.address);
            const referralBalance = await contract.balances(referral.address);

            // assert
            await expect(surrenderTxTask)
                .to.emit(contract, event)
                .withArgs(gameId, GameState.Finished);
            expect(game.state).to.be.equal(GameState.Finished, 'Game must be finished');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'Timestamp must be updated');
            expect(oldChallengerBalance.add(output.winner)).to.be.equal(challengerBalance, 'Adjusted challenger balance must match');
            expect(oldOwnerBalance.add(output.owner)).to.be.equal(ownerBalance, 'Adjusted owner balance must match');
            expect(oldReferralBalance.add(output.referral)).to.be.equal(referralBalance, 'Adjusted referral balance must match');
        });


        it('as a not involved address must fail', async () => {
            // arrange
            const { contract, referral, gameId } = await bootstrapAcceptedGame();
            const message = 'ADDRESS';

            // act
            const acceptGameTxTask = contract.connect(referral).surrenderGame(gameId);

            // assert
            await expect(acceptGameTxTask)
                .to.be.revertedWith(message);
        });
    });

    describe('claiming pot...', () => {
        it('as a not involved address before move timeout must fail', async () => {
            // arrange
            const { contract, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame();
            const message = 'UNELIGIBLE';
            const { game: oldGame } = await contract.getGame(gameId);

            // act
            const claimAsChallengerTxTask = contract.connect(challenger).claimPot(gameId);
            const claimAsOpponentTxTask = contract.connect(opponent).claimPot(gameId);
            const claimAsReferralTxTask = contract.connect(referral).claimPot(gameId);

            // assert
            await expect(claimAsChallengerTxTask)
                .to.be.revertedWith(message);
            await expect(claimAsOpponentTxTask)
                .to.be.revertedWith(message);
            await expect(claimAsReferralTxTask)
                .to.be.revertedWith(message);
            const { game } = await contract.getGame(gameId);
            expect(oldGame.pot).to.be.equal(game.pot, 'pot must not change');
        });

        it('as challenger after move timeout when only challenger made a move must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame(
                DEFAULT_REFERRAL,
                DEFAULT_BET,
                DEFAULT_PASSWORD,
                DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
                1
            );
            const message = 'ADDRESS';
            const event = 'GameUpdated';
            const challengerMove = wrapMove(Move.Paper);
            const { game: initialGame, context } = await contract.getGame(gameId);
            const initialContractBalance = await contract.provider.getBalance(contract.address);
            const initialChallengerBalance = await contract.balances(challenger.address);
            const initialOpponentBalance = await contract.balances(opponent.address);
            const initialOwnerBalance = await contract.balances(owner.address);
            const initialReferralBalance = await contract.balances(referral.address);
            const rewards = calculateRewards(initialGame.pot, context.ownerTipRate, context.referralTipRate);

            // act
            const challengerHashedMoveTx = await contract.connect(challenger).submitHashedMove(gameId, challengerMove.hashedMove);
            await challengerHashedMoveTx.wait();
            await sleep(1000);

            const opponentClaimTxTask = contract.connect(opponent).claimPot(gameId);
            await expect(opponentClaimTxTask).to.be.revertedWith(message);
            const referralClaimTxTask = contract.connect(referral).claimPot(gameId);
            await expect(referralClaimTxTask).to.be.revertedWith(message);
            const challengerClaimTxTask = contract.connect(challenger).claimPot(gameId);
            const challengerClaimTx = await challengerClaimTxTask;
            const reciept = await challengerClaimTx.wait();
            const block = await contract.provider.getBlock(reciept.blockHash);
            const { game } = await contract.getGame(gameId);

            const contractBalance = await contract.provider.getBalance(contract.address);
            const challengerBalance = await contract.balances(challenger.address);
            const opponentBalance = await contract.balances(opponent.address);
            const ownerBalance = await contract.balances(owner.address);
            const referralBalance = await contract.balances(referral.address);

            // assert
            await expect(challengerClaimTxTask)
                .to.emit(contract, event)
                .withArgs(gameId, GameState.Finished);
            expect(game.state).to.be.equal(GameState.Finished, 'Must be finished');
            expect(game.winner).to.be.equal(challenger.address, 'Challenger must be winner');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'Timestamp must be updated');
            expect(initialContractBalance).to.be.equal(contractBalance, 'Contract balances must match');
            expect(initialChallengerBalance.add(rewards.winner)).to.be.equal(challengerBalance, 'Adjusted winner/challenger balances must match');
            expect(initialOpponentBalance).to.be.equal(opponentBalance, 'Opponent/loser balances must match');
            expect(initialOwnerBalance.add(rewards.owner)).to.be.equal(ownerBalance, 'Adjusted owner balances must match');
            expect(initialReferralBalance.add(rewards.referral)).to.be.equal(referralBalance, 'Adjusted referral balances must match');
        });

        it('as opponent after move timeout when only opponent made a move must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame(
                DEFAULT_REFERRAL,
                DEFAULT_BET,
                DEFAULT_PASSWORD,
                DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
                1
            );
            const message = 'ADDRESS';
            const event = 'GameUpdated';
            const challengerMove = wrapMove(Move.Paper);
            const { game: initialGame, context } = await contract.getGame(gameId);
            const initialContractBalance = await contract.provider.getBalance(contract.address);
            const initialChallengerBalance = await contract.balances(challenger.address);
            const initialOpponentBalance = await contract.balances(opponent.address);
            const initialOwnerBalance = await contract.balances(owner.address);
            const initialReferralBalance = await contract.balances(referral.address);
            const rewards = calculateRewards(initialGame.pot, context.ownerTipRate, context.referralTipRate);

            // act
            const opponentHashedMoveTx = await contract.connect(opponent).submitHashedMove(gameId, challengerMove.hashedMove);
            await opponentHashedMoveTx.wait();
            await sleep(1000);

            const challengerClaimTxTask = contract.connect(challenger).claimPot(gameId);
            await expect(challengerClaimTxTask).to.be.revertedWith(message);
            const referralClaimTxTask = contract.connect(referral).claimPot(gameId);
            await expect(referralClaimTxTask).to.be.revertedWith(message);
            const opponentClaimTxTask = contract.connect(opponent).claimPot(gameId);
            const opponentClaimTx = await opponentClaimTxTask;
            const reciept = await opponentClaimTx.wait();
            const block = await contract.provider.getBlock(reciept.blockHash);
            const { game } = await contract.getGame(gameId);

            const contractBalance = await contract.provider.getBalance(contract.address);
            const challengerBalance = await contract.balances(challenger.address);
            const opponentBalance = await contract.balances(opponent.address);
            const ownerBalance = await contract.balances(owner.address);
            const referralBalance = await contract.balances(referral.address);

            // assert
            await expect(opponentClaimTxTask)
                .to.emit(contract, event)
                .withArgs(gameId, GameState.Finished);
            expect(game.state).to.be.equal(GameState.Finished, 'must be finished');
            expect(game.winner).to.be.equal(opponent.address, 'opponent must be winner');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'timestmaps must match');
            expect(initialContractBalance).to.be.equal(contractBalance, 'contract balances must match');
            expect(initialChallengerBalance).to.be.equal(challengerBalance, 'loser/challenger balances must match');
            expect(initialOpponentBalance.add(rewards.winner)).to.be.equal(opponentBalance, 'adjusted opponent/winner balances must match');
            expect(initialOwnerBalance.add(rewards.owner)).to.be.equal(ownerBalance, 'adjusted owner balances must match');
            expect(initialReferralBalance.add(rewards.referral)).to.be.equal(referralBalance, 'adjusted referral balances must match');
        });

        it('as a not involved address after claim timeout must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame(
                DEFAULT_REFERRAL,
                DEFAULT_BET,
                DEFAULT_PASSWORD,
                DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
                0,
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