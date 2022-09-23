import { expect } from 'chai';

import {
    bootstrapStartGame,
} from './Definitions';

describe('Registering as referral...', () => {
    it('must succeed', async () => {
        // arrange
        const { contract, challenger } = await bootstrapStartGame();
        const event = 'NewReferral';

        // act
        const isReferral = await contract.referrals(challenger.address);
        const registrationTxTask = contract.connect(challenger).registerReferral();

        // assert
        await expect(registrationTxTask)
            .to.emit(contract, event)
            .withArgs(challenger.address);
        expect(isReferral).to.be.false;
        expect(await contract.referrals(challenger.address)).to.be.true;
    });

    it('for a second time must fail', async () => {
        // arrange
        const { contract, referral } = await bootstrapStartGame();
        const message = 'REGISTERED';

        // act
        const registrationTxTask = contract.connect(referral).registerReferral();

        // assert
        await expect(registrationTxTask).to.be.revertedWith(message);
    });
});