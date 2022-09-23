import { bootstrapContract, DEFAULT_PASSWORD, GameState, Move, wrapMove } from "./Definitions";
import { BigNumber, constants, utils } from 'ethers';
import { expect } from "chai";

describe('While game is not started...', () => {
    it('starting a game and consecutive one would create two seperate games', async () => {
        // arrange
        const { contract, challenger } = await bootstrapContract();
        const event = 'GameUpdated';
        const value = utils.parseEther('1');

        // act
        const firstGameTxTask = contract.connect(challenger).startNewGame(constants.AddressZero, constants.HashZero, { value })
        const secondGameTxTask = contract.connect(challenger).startNewGame(constants.AddressZero, constants.HashZero, { value })

        // assert
        await expect(firstGameTxTask)
            .to.emit(contract, event)
            .withArgs(0, GameState.WaitingForOpponent);
        await expect(secondGameTxTask)
            .to.emit(contract, event)
            .withArgs(1, GameState.WaitingForOpponent);
    });

    it('aborting game must fail', async () => {
        // arrange
        const { contract, challenger } = await bootstrapContract();
        const gameId = BigNumber.from(0);
        const message = 'UNELIGIBLE';

        // act
        const abandonGameTxTask = contract.connect(challenger).abortGame(gameId);

        // assert
        await expect(abandonGameTxTask)
            .to.be.revertedWith(message);
    });

    it('accepting game must fail', async () => {
        // arrange
        const { contract, challenger } = await bootstrapContract();
        const gameId = BigNumber.from(0);
        const message = 'UNELIGIBLE';

        // act
        const acceptGameTxTask = contract.connect(challenger).acceptGame(gameId, DEFAULT_PASSWORD);

        // assert
        await expect(acceptGameTxTask)
            .to.be.revertedWith(message);
    });

    it('submitting hashed move must fail', async () => {
        // arrange
        const { contract, challenger } = await bootstrapContract();
        const gameId = BigNumber.from(0);
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
        const { contract, challenger } = await bootstrapContract();
        const gameId = BigNumber.from(0);
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
        const { contract, challenger } = await bootstrapContract();
        const gameId = BigNumber.from(0);
        const message = 'UNELIGIBLE';

        // act
        const surrenderTxTask = contract.connect(challenger).surrenderGame(gameId);


        // assert
        await expect(surrenderTxTask)
            .to.be.revertedWith(message);
    });

    it('claiming pot must fail', async () => {
        // arrange
        const { contract, challenger } = await bootstrapContract();
        const gameId = BigNumber.from(0);
        const message = 'UNELIGIBLE';

        // act
        const claimTxTask = contract.connect(challenger).claimPot(gameId);

        // assert
        await expect(claimTxTask)
            .to.be.revertedWith(message);
    });
});