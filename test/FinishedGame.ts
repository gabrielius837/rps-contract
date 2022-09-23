import { bootstrapContract, bootstrapFinishedGame, DEFAULT_PASSWORD, GameState, Move, Moves, wrapMove } from "./Definitions";
import { BigNumber, constants, utils } from 'ethers';
import { expect } from "chai";

const defaultMoves: Moves[] = [
    { challenger: Move.Scissors, opponent: Move.Paper },
    { challenger: Move.Scissors, opponent: Move.Paper },
    { challenger: Move.Scissors, opponent: Move.Paper }
]

describe('While game has finished...', () => {
    it('aborting game must fail', async () => {
        // arrange
        const { contract, challenger, gameId } = await bootstrapFinishedGame(defaultMoves);
        const message = 'UNELIGIBLE';

        // act
        const abandonGameTxTask = contract.connect(challenger).abortGame(gameId);

        // assert
        await expect(abandonGameTxTask)
            .to.be.revertedWith(message);
    });

    it('accepting game must fail', async () => {
        // arrange
        const { contract, challenger, gameId } = await bootstrapFinishedGame(defaultMoves);
        const message = 'UNELIGIBLE';

        // act
        const acceptGameTxTask = contract.connect(challenger).acceptGame(gameId, DEFAULT_PASSWORD);

        // assert
        await expect(acceptGameTxTask)
            .to.be.revertedWith(message);
    });

    it('submitting hashed move must fail', async () => {
        // arrange
        const { contract, challenger, gameId } = await bootstrapFinishedGame(defaultMoves);
        const message = 'UNELIGIBLE';
        const move = wrapMove(Move.Rock);

        // act
        const submitHashedMoveTxTask = contract.connect(challenger).submitHashedMove(gameId, move.hashedMove);

        // assert
        await expect(submitHashedMoveTxTask)
            .to.be.revertedWith(message);
    });

    it('submitting move must fail', async () => {
        // arrange
        const { contract, challenger, gameId } = await bootstrapFinishedGame(defaultMoves);
        const message = 'UNELIGIBLE';
        const move = wrapMove(Move.Rock);

        // act
        const submitMoveTxTask = contract.connect(challenger).submitMove(gameId, move.unhashedMove);

        // assert
        await expect(submitMoveTxTask)
            .to.be.revertedWith(message);
    });

    it('surrendering game must fail', async () => {
        // arrange
        const { contract, challenger, gameId } = await bootstrapFinishedGame(defaultMoves);
        const message = 'UNELIGIBLE';

        // act
        const surrenderTxTask = contract.connect(challenger).surrenderGame(gameId);

        // assert
        await expect(surrenderTxTask)
            .to.be.revertedWith(message);
    });

    it('claiming pot must fail', async () => {
        // arrange
        const { contract, challenger, gameId } = await bootstrapFinishedGame(defaultMoves);
        const message = 'UNELIGIBLE';

        // act
        const claimTxTask = contract.connect(challenger).claimPot(gameId);

        // assert
        await expect(claimTxTask)
            .to.be.revertedWith(message);
    });
});