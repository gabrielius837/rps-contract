import { expect } from "chai";
import { boostrapMovedGame, DEFAULT_ROUND_THRESHOLD, DEFAULT_SCORE_THRESHOLD, Move, Moves } from "./Definitions";

describe('resolving game...', () => {
    it('when resolution is triggered by challenger\'s score reaching treshold must result in challenger winning', async () => {
        // arrange
        const moves = Array(DEFAULT_SCORE_THRESHOLD)
            .fill({ challenger: Move.Paper, opponent: Move.Rock });

        // act
        const { contract, gameId, challenger } = await boostrapMovedGame(moves);
        const { game } = await contract.getGame(gameId);

        // assert
        expect(game.winner).to.be.equal(challenger.address, 'challenger must be winner');
    });

    it('when resolution is triggered by round count reaching treshold and challenger has lead must result in challenger winning', async () => {
        // arrange
        const moves: Moves[] = Array(DEFAULT_ROUND_THRESHOLD)
            .fill({ challenger: Move.Paper, opponent: Move.Rock }, 0, DEFAULT_SCORE_THRESHOLD - 1)
            .fill({ challenger: Move.Paper, opponent: Move.Paper }, DEFAULT_SCORE_THRESHOLD - 1, DEFAULT_ROUND_THRESHOLD);

        // act
        const { contract, gameId, challenger } = await boostrapMovedGame(moves);
        const { game } = await contract.getGame(gameId);

        // assert
        expect(game.winner).to.be.equal(challenger.address, 'challenger must be winner');
    });

    it('when resolution is triggered by opponent\'s score reaching treshold must result in opponent winning', async () => {
        // arrange
        const moves = Array(DEFAULT_SCORE_THRESHOLD)
            .fill({ challenger: Move.Scissors, opponent: Move.Rock });

        // act
        const { contract, gameId, opponent } = await boostrapMovedGame(moves);
        const { game } = await contract.getGame(gameId);

        // assert
        expect(game.winner).to.be.equal(opponent.address, 'opponent must be winner');
    });

    it('when resolution is triggered by round count reaching treshold and opponent has lead must result in opponent winning', async () => {
        // arrange
        const moves: Moves[] = Array(DEFAULT_ROUND_THRESHOLD)
            .fill({ challenger: Move.Scissors, opponent: Move.Rock }, 0, DEFAULT_SCORE_THRESHOLD - 1)
            .fill({ challenger: Move.Paper, opponent: Move.Paper }, DEFAULT_SCORE_THRESHOLD - 1, DEFAULT_ROUND_THRESHOLD);

        // act
        const { contract, gameId, opponent } = await boostrapMovedGame(moves);
        const { game } = await contract.getGame(gameId);

        // assert
        expect(game.winner).to.be.equal(opponent.address, 'opponent must be winner');
    });

    it('when resolution is triggered by challenger\'s score reaching treshold must result in challenger winning', async () => {
        // arrange
        const moves = Array(DEFAULT_ROUND_THRESHOLD)
            .fill({ challenger: Move.Paper, opponent: Move.Paper });

        // act
        const { contract, gameId, challenger } = await boostrapMovedGame(moves);
        const { game } = await contract.getGame(gameId);

        // assert
        expect(game.winner).to.be.equal(challenger.address, 'challenger must be winner');
    });
});
