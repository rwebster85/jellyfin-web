import { describe, expect, it } from 'vitest';

import { DownloadBehaviour, offersSeparateOptimisedAction } from './downloadSettings';

describe('Scripts: downloadSettings', () => {
    describe('Method: offersSeparateOptimisedAction', () => {
        it('should offer the action when the feature is on and the behaviour is SeparateAction', () => {
            expect(offersSeparateOptimisedAction({ Enabled: true, Behaviour: DownloadBehaviour.SeparateAction })).toBe(true);
        });

        it('should not offer it under Substitute, where Download already serves the optimised copy', () => {
            expect(offersSeparateOptimisedAction({ Enabled: true, Behaviour: DownloadBehaviour.Substitute })).toBe(false);
        });

        it('should not offer it while the feature is off', () => {
            expect(offersSeparateOptimisedAction({ Enabled: false, Behaviour: DownloadBehaviour.SeparateAction })).toBe(false);
        });

        it('should not offer it when the behaviour could not be read', () => {
            expect(offersSeparateOptimisedAction(null)).toBe(false);
            expect(offersSeparateOptimisedAction(undefined)).toBe(false);
        });
    });
});
