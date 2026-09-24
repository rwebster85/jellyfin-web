import { describe, expect, it } from 'vitest';

import type { DownloadTier } from 'scripts/downloadSettings';

import { findTierProblem, newTierId, pickDefault } from './downloadTiers';

const tier = (id: string, suffix: string, enabled = true): DownloadTier => ({
    Id: id,
    Suffix: suffix,
    Name: suffix,
    Enabled: enabled
});

describe('Utils: downloadTiers', () => {
    describe('Method: newTierId', () => {
        it('should match the server\'s id format - 32 lowercase hex characters', () => {
            expect(newTierId()).toMatch(/^[0-9a-f]{32}$/);
        });

        it('should not repeat', () => {
            const ids = new Set(Array.from({ length: 50 }, newTierId));

            expect(ids.size).toBe(50);
        });
    });

    describe('Method: pickDefault', () => {
        it('should keep a default that is still enabled', () => {
            expect(pickDefault([tier('a', 'High'), tier('b', 'Standard')], 'b')).toBe('b');
        });

        it('should move a disabled default to the first enabled tier', () => {
            expect(pickDefault([tier('a', 'High', false), tier('b', 'Standard')], 'a')).toBe('b');
        });

        it('should move a deleted default to the first enabled tier', () => {
            expect(pickDefault([tier('b', 'Standard')], 'a')).toBe('b');
        });

        it('should clear the default when no tier is enabled', () => {
            expect(pickDefault([tier('a', 'High', false)], 'a')).toBe('');
            expect(pickDefault([], 'a')).toBe('');
        });
    });

    describe('Method: findTierProblem', () => {
        it('should accept a valid table', () => {
            expect(findTierProblem([tier('a', 'High'), tier('b', 'Standard')], 'a')).toBeNull();
        });

        it('should refuse an empty or blank suffix', () => {
            expect(findTierProblem([tier('a', '  ')], 'a')).toBe('DownloadTierSuffixRequired');
        });

        it('should refuse a duplicate suffix, ignoring case and spaces', () => {
            expect(findTierProblem([tier('a', 'High'), tier('b', ' high ')], 'a')).toBe('DownloadTierSuffixDuplicate');
        });

        it('should require a default while any tier is enabled', () => {
            expect(findTierProblem([tier('a', 'High')], '')).toBe('DownloadTierDefaultRequired');
        });

        it('should not require a default when every tier is disabled, or there are none', () => {
            expect(findTierProblem([tier('a', 'High', false)], '')).toBeNull();
            expect(findTierProblem([], '')).toBeNull();
        });
    });
});
