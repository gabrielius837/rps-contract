import { expect } from 'chai';

import { 
    bootstrapContract
} from './Definitions';

describe("Deploying contract...", () => {
    it("must succeed", async () => {
        // arrange
        const { contract, owner } = await bootstrapContract();

        // act
        const ownerAdr = await contract.owner();
        const signerAdr = await owner.getAddress();

        // assert deployment/ownership
        expect(ownerAdr).to.be.equal(signerAdr, 'owner and signer addresses must match');
    })
});