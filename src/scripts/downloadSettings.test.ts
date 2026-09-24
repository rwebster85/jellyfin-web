import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import { describe, expect, it } from 'vitest';

import { canHaveOptimisedCopy, DownloadBehaviour, offersSeparateOptimisedAction } from './downloadSettings';

describe('Scripts: downloadSettings', () => {
    describe('Method: canHaveOptimisedCopy', () => {
        it('should allow video - films and episodes alike', () => {
            expect(canHaveOptimisedCopy({ MediaType: MediaType.Video })).toBe(true);
        });

        it.each([MediaType.Audio, MediaType.Book, MediaType.Photo, MediaType.Unknown, undefined])(
            'should not allow %s',
            mediaType => {
                expect(canHaveOptimisedCopy({ MediaType: mediaType })).toBe(false);
            }
        );
    });

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
