import { expect } from 'chai';
import { constants, BigNumber } from 'ethers';

import {
    bootstrapAcceptedGame,
    DEFAULT_BET,
    DEFAULT_PASSWORD,
    DEFAULT_REFERRAL,
    GameState,
    submitHashedMoves,
    Move,
    wrapMove,
    calculateRewards,
    DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
    sleep,
    DEFAULT_SCORE_THRESHOLD,
    DEFAULT_ROUND_THRESHOLD,
    DEFAULT_OWNER_TIP_RATE,
    DEFAULT_REFERRAL_TIP_RATE,
    DEFAULT_MOVE_TIMEOUT
} from './Definitions';

describe('When waiting for unhashed move submissons...', () => {
    it('aborting game must fail', async () => {
        // arrange
        const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
        const challengerMoves = wrapMove(Move.Rock);
        const opponentMoves = wrapMove(Move.Scissors);
        await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
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

    it('submitting a hashed move must fail', async () => {
        // arrange
        const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
        const challengerMoves = wrapMove(Move.Paper);
        const opponentMoves = wrapMove(Move.Scissors);
        await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
        const message = 'UNELIGIBLE';

        // act
        const submitHashedMoveTxTask = contract.connect(challenger).submitHashedMove(gameId, challengerMoves.hashedMove);

        // assert
        await expect(submitHashedMoveTxTask).to.be.revertedWith(message);
    });

    describe('submitting unhashed move/-s...', () => {
        it('as challenger must succeed', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Scissors);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);

            // act
            const submitMoveTxTask = contract.connect(challenger).submitMove(gameId, challengerMoves.unhashedMove);
            const submitMoveTx = await submitMoveTxTask;
            await submitMoveTx.wait();
            const { game } = await contract.getGame(gameId);

            // assert
            expect(game.state).to.be.equal(GameState.ValidatingMoves, 'After first move submission state must not change');
            expect(game.challenger.move).to.be.equal(challengerMoves.unhashedMove, 'Submitted move by challenger must be updated');
            expect(game.opponent.move).to.be.equal(constants.HashZero, 'Opponent\'s move must not be updated');
        });

        it('as opponent after challenger must succeed', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const { game: oldGame } = await contract.getGame(gameId);
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Scissors);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
            const GAME_UPDATED = 'GameUpdated';
            const VALIDATED_MOVES = 'ValidatedMoves';

            // act
            const submitChallengerMoveTx = await contract.connect(challenger).submitMove(gameId, challengerMoves.unhashedMove);
            await submitChallengerMoveTx.wait();
            const submitOpponentMoveTxTask = contract.connect(opponent).submitMove(gameId, opponentMoves.unhashedMove);
            const submitOpponentMoveTx = await submitOpponentMoveTxTask;
            const receipt = await submitOpponentMoveTx.wait();
            const block = await contract.provider.getBlock(receipt.blockHash);
            const { game } = await contract.getGame(gameId);

            // assert
            await expect(submitOpponentMoveTxTask)
                .to.emit(contract, GAME_UPDATED)
                .withArgs(gameId, GameState.PendingMoves);
            await expect(submitOpponentMoveTxTask)
                .to.emit(contract, VALIDATED_MOVES)
                .withArgs(gameId, oldGame.round, Move.Rock, Move.Scissors);
            expect(game.state).to.be.equal(GameState.PendingMoves, 'After both move submissions state must change');
            expect(game.challenger.move).to.be.equal(constants.HashZero, 'Submitted move by challenger must be reset');
            expect(game.opponent.move).to.be.equal(constants.HashZero, 'Submitted move by opponent must be reset');
            expect(game.challenger.hashedMove).to.be.equal(constants.HashZero, 'Submitted hashed move by challenger must be reset');
            expect(game.opponent.hashedMove).to.be.equal(constants.HashZero, 'Submitted hashed move by opponent must be reset');
            expect(game.updateTimestamp).to.be.equal(BigNumber.from(block.timestamp), 'Timestamp must be updated');
            expect(game.round).to.be.equal(oldGame.round + 1, 'round index must incrase');
        });

        it('as challenger for a second time must fail', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Scissors);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
            const message = 'SUBMITTED';

            // act
            const submitMoveTx = await contract.connect(challenger).submitMove(gameId, challengerMoves.unhashedMove);
            await submitMoveTx.wait();
            const secondSubmitMoveTxTask = contract.connect(challenger).submitMove(gameId, challengerMoves.unhashedMove);

            // assert
            await expect(secondSubmitMoveTxTask)
                .to.be.revertedWith(message);
        });

        it('as opponent must succeed', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Scissors);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);

            // act
            const submitMoveTxTask = contract.connect(opponent).submitMove(gameId, opponentMoves.unhashedMove);
            const submitMoveTx = await submitMoveTxTask;
            await submitMoveTx.wait();
            const { game } = await contract.getGame(gameId);

            // assert
            expect(game.state).to.be.equal(GameState.ValidatingMoves, 'After first move submission state must not change');
            expect(game.opponent.move).to.be.equal(opponentMoves.unhashedMove, 'Submitted move by opponent must be updated');
            expect(game.challenger.move).to.be.equal(constants.HashZero, 'Opponent\'s move must not be updated');
        });

        it('as opponent after challenger must succeed', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const { game: oldGame } = await contract.getGame(gameId);
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Scissors);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
            const GAME_UPDATED = 'GameUpdated';
            const VALIDATED_MOVES = 'ValidatedMoves';

            // act
            const submitChallengerMoveTx = await contract.connect(challenger).submitMove(gameId, challengerMoves.unhashedMove);
            await submitChallengerMoveTx.wait();
            const submitOpponentMoveTxTask = contract.connect(opponent).submitMove(gameId, opponentMoves.unhashedMove);
            const submitOpponentMoveTx = await submitOpponentMoveTxTask;
            const receipt = await submitOpponentMoveTx.wait();
            const block = await contract.provider.getBlock(receipt.blockHash);
            const { game, context } = await contract.getGame(gameId);

            // assert
            await expect(submitOpponentMoveTxTask)
                .to.emit(contract, GAME_UPDATED)
                .withArgs(gameId, GameState.PendingMoves);
            await expect(submitOpponentMoveTxTask)
                .to.emit(contract, VALIDATED_MOVES)
                .withArgs(gameId, oldGame.round, Move.Rock, Move.Scissors);
            expect(game.state).to.be.equal(GameState.PendingMoves, 'state must be updated');
            expect(game.challenger.move).to.be.equal(constants.HashZero, 'challenger move must be reset');
            expect(game.opponent.move).to.be.equal(constants.HashZero, 'opponent move must be reset');
            expect(game.challenger.hashedMove).to.be.equal(constants.HashZero, 'challenger hashed move must be reset');
            expect(game.opponent.hashedMove).to.be.equal(constants.HashZero, 'opponent hashed move must be reset');
            expect(game.updateTimestamp).to.be.equal(BigNumber.from(block.timestamp), 'Timestamp must match');
            expect(game.round).to.be.equal(oldGame.round + 1, 'round index must incrase');
        });

        it('as opponent for a second time must fail', async () => {
            // arrange
            const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Scissors);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
            const message = 'SUBMITTED';

            // act
            const submitMoveTx = await contract.connect(opponent).submitMove(gameId, opponentMoves.unhashedMove);
            await submitMoveTx.wait();
            const secondSubmitMoveTxTask = contract.connect(opponent).submitMove(gameId, opponentMoves.unhashedMove);

            // assert
            await expect(secondSubmitMoveTxTask)
                .to.be.revertedWith(message);
        });

        it('must result in challenger\'s score increase', async () => {
            const roundMovePairs = [
                { challenger: Move.Rock, opponent: Move.Illegal },
                { challenger: Move.Paper, opponent: Move.Illegal },
                { challenger: Move.Scissors, opponent: Move.Illegal },
                { challenger: Move.Rock, opponent: Move.Scissors },
                { challenger: Move.Paper, opponent: Move.Rock },
                { challenger: Move.Scissors, opponent: Move.Paper }
            ];

            for (const roundMovePair of roundMovePairs) {
                // arrange
                const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
                const { game: oldGame } = await contract.getGame(gameId);
                const challengerMove = wrapMove(roundMovePair.challenger);
                const opponentMove = wrapMove(roundMovePair.opponent)
                const event = 'ValidatedMoves';

                // act
                const challengerHashedMoveTx = await contract.connect(challenger).submitHashedMove(gameId, challengerMove.hashedMove);
                await challengerHashedMoveTx.wait();
                const opponentHashedMoveTx = await contract.connect(opponent).submitHashedMove(gameId, opponentMove.hashedMove);
                await opponentHashedMoveTx.wait();

                const challengerMoveTx = await contract.connect(challenger).submitMove(gameId, challengerMove.unhashedMove);
                await challengerMoveTx.wait();
                const opponentMoveTxTask = contract.connect(opponent).submitMove(gameId, opponentMove.unhashedMove);
                const opponentMoveTx = await opponentMoveTxTask;
                const receipt = await opponentMoveTx.wait();

                const { game } = await contract.getGame(gameId);

                // assert
                await expect(opponentMoveTxTask, 'moves must match')
                    .to.emit(contract, event)
                    .withArgs(gameId, oldGame.round, roundMovePair.challenger, roundMovePair.opponent);
                expect(oldGame.challenger.score + 1).to.be.equal(game.challenger.score, 'adjusted challenger score must match');
                expect(oldGame.opponent.score).to.be.equal(game.opponent.score, 'opponent score must match');
                expect(game.validateBlockNumber).to.be.equal(receipt.blockNumber, 'block numbers must match');
            }
        });

        it('must result in opponent\'s score increase', async () => {
            const roundMovePairs = [
                { challenger: Move.Illegal, opponent: Move.Rock },
                { challenger: Move.Illegal, opponent: Move.Paper },
                { challenger: Move.Illegal, opponent: Move.Scissors },
                { challenger: Move.Scissors, opponent: Move.Rock },
                { challenger: Move.Rock, opponent: Move.Paper },
                { challenger: Move.Paper, opponent: Move.Scissors }
            ];

            for (const roundMovePair of roundMovePairs) {
                // arrange
                const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
                const { game: oldGame } = await contract.getGame(gameId);
                const challengerMove = wrapMove(roundMovePair.challenger);
                const opponentMove = wrapMove(roundMovePair.opponent)
                const event = 'ValidatedMoves';

                // act
                const challengerHashedMoveTx = await contract.connect(challenger).submitHashedMove(gameId, challengerMove.hashedMove);
                await challengerHashedMoveTx.wait();
                const opponentHashedMoveTx = await contract.connect(opponent).submitHashedMove(gameId, opponentMove.hashedMove);
                await opponentHashedMoveTx.wait();

                const challengerMoveTx = await contract.connect(challenger).submitMove(gameId, challengerMove.unhashedMove);
                await challengerMoveTx.wait();
                const opponentMoveTxTask = contract.connect(opponent).submitMove(gameId, opponentMove.unhashedMove);
                const opponentMoveTx = await opponentMoveTxTask;
                const receipt = await opponentMoveTx.wait();

                const { game } = await contract.getGame(gameId);

                // assert
                await expect(opponentMoveTxTask, 'moves must match')
                    .to.emit(contract, event)
                    .withArgs(gameId, oldGame.round, roundMovePair.challenger, roundMovePair.opponent);
                expect(oldGame.challenger.score).to.be.equal(game.challenger.score, 'challenger score must match');
                expect(oldGame.opponent.score + 1).to.be.equal(game.opponent.score, 'adjusted opponent score must match');
                expect(game.validateBlockNumber).to.be.equal(receipt.blockNumber, 'block numbers must match');
            }
        });

        it('must result in draw', async () => {
            const roundMovePairs = [
                { challenger: Move.Illegal, opponent: Move.Illegal },
                { challenger: Move.Rock, opponent: Move.Rock },
                { challenger: Move.Paper, opponent: Move.Paper },
                { challenger: Move.Scissors, opponent: Move.Scissors },
            ];

            for (const roundMovePair of roundMovePairs) {
                // arrange
                const { contract, challenger, opponent, gameId } = await bootstrapAcceptedGame();
                const { game: oldGame } = await contract.getGame(gameId);
                const challengerMove = wrapMove(roundMovePair.challenger);
                const opponentMove = wrapMove(roundMovePair.opponent)
                const event = 'ValidatedMoves';

                // act
                const challengerHashedMoveTx = await contract.connect(challenger).submitHashedMove(gameId, challengerMove.hashedMove);
                await challengerHashedMoveTx.wait();
                const opponentHashedMoveTx = await contract.connect(opponent).submitHashedMove(gameId, opponentMove.hashedMove);
                await opponentHashedMoveTx.wait();

                const challengerMoveTx = await contract.connect(challenger).submitMove(gameId, challengerMove.unhashedMove);
                await challengerMoveTx.wait();
                const opponentMoveTxTask = contract.connect(opponent).submitMove(gameId, opponentMove.unhashedMove);
                const opponentMoveTx = await opponentMoveTxTask;
                const receipt = await opponentMoveTx.wait();

                const { game } = await contract.getGame(gameId);

                // assert
                await expect(opponentMoveTxTask, 'moves must match')
                    .to.emit(contract, event)
                    .withArgs(gameId, oldGame.round, roundMovePair.challenger, roundMovePair.opponent);
                expect(oldGame.challenger.score).to.be.equal(game.challenger.score, 'challenger score must match');
                expect(oldGame.opponent.score).to.be.equal(game.opponent.score, 'opponent score must match');
                expect(game.validateBlockNumber).to.be.equal(receipt.blockNumber, 'block numbers must match');
            }
        });
    });

    describe('surrendering...', () => {
        it('as challenger must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame();
            const challengerMoves = wrapMove(Move.Scissors);
            const opponentMoves = wrapMove(Move.Paper);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
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
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'Timestamp must match');
            expect(oldOpponentBalance.add(output.winner)).to.be.equal(opponentBalance, 'Adjusted opponent balance must match');
            expect(oldOwnerBalance.add(output.owner)).to.be.equal(ownerBalance, 'Adjusted owner balance must match');
            expect(oldReferralBalance.add(output.referral)).to.be.equal(referralBalance, 'Adjusted referral balance must match');
        });


        it('as opponent must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame();
            const challengerMoves = wrapMove(Move.Scissors);
            const opponentMoves = wrapMove(Move.Paper);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
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
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'Timestamps must match');
            expect(oldChallengerBalance.add(output.winner)).to.be.equal(challengerBalance, 'Adjusted challenger balance must match');
            expect(oldOwnerBalance.add(output.owner)).to.be.equal(ownerBalance, 'Adjusted owner balance must match');
            expect(oldReferralBalance.add(output.referral)).to.be.equal(referralBalance, 'Adjusted referral balance must match');
        });


        it('as a not involved player must fail', async () => {
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
            const challengerMoves = wrapMove(Move.Scissors);
            const opponentMoves = wrapMove(Move.Paper);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
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
                2
            );
            const challengerMoves = wrapMove(Move.Paper);
            const opponentMoves = wrapMove(Move.Scissors);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
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
            const challengerMoveTx = await contract.connect(challenger).submitMove(gameId, challengerMove.unhashedMove);
            await challengerMoveTx.wait();
            await sleep(2000);

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
            expect(game.state).to.be.equal(GameState.Finished, 'must be finished');
            expect(game.winner).to.be.equal(challenger.address, 'challenger must be winner');
            expect(game.updateTimestamp).to.be.equal(block.timestamp, 'timestmaps must match');
            expect(initialContractBalance).to.be.equal(contractBalance, 'contract balances must match');
            expect(initialChallengerBalance.add(rewards.winner)).to.be.equal(challengerBalance, 'adjusted winner/challenger balances must match');
            expect(initialOpponentBalance).to.be.equal(opponentBalance, 'opponent/loser balances must match');
            expect(initialOwnerBalance.add(rewards.owner)).to.be.equal(ownerBalance, 'adjusted owner balances must match');
            expect(initialReferralBalance.add(rewards.referral)).to.be.equal(referralBalance, 'adjusted referral balances must match');
        });

        it('as opponent after move timeout when only opponent made a move must succeed', async () => {
            // arrange
            const { contract, owner, challenger, opponent, referral, gameId } = await bootstrapAcceptedGame(
                DEFAULT_REFERRAL,
                DEFAULT_BET,
                DEFAULT_PASSWORD,
                DEFAULT_WAITINGFOROPPONENT_TIMEOUT,
                2
            );
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Paper);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
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
            const opponentMoveTx = await contract.connect(opponent).submitMove(gameId, challengerMove.unhashedMove);
            await opponentMoveTx.wait();
            await sleep(2000);

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
                2,
                DEFAULT_SCORE_THRESHOLD,
                DEFAULT_ROUND_THRESHOLD,
                DEFAULT_OWNER_TIP_RATE,
                DEFAULT_REFERRAL_TIP_RATE,
                0
            );
            const challengerMoves = wrapMove(Move.Rock);
            const opponentMoves = wrapMove(Move.Paper);
            await submitHashedMoves(contract, gameId, challenger, challengerMoves.hashedMove, opponent, opponentMoves.hashedMove);
            const event = 'GameUpdated';
            const { game: initialGame, context } = await contract.getGame(gameId);
            const initialContractBalance = await contract.provider.getBalance(contract.address);
            const initialChallengerBalance = await contract.balances(challenger.address);
            const initialOpponentBalance = await contract.balances(opponent.address);
            const initialOwnerBalance = await contract.balances(owner.address);
            const initialReferralBalance = await contract.balances(referral.address);
            const rewards = calculateRewards(initialGame.pot, context.ownerTipRate, context.referralTipRate);

            // act
            await sleep(3000);
            const referralClaimTxTask = await contract.connect(referral).claimPot(gameId);
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