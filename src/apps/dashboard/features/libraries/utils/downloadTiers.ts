import type { DownloadTier } from 'scripts/downloadSettings';

/**
 * Generates a tier id in the server's format (32 hex characters), so a new tier can be made the
 * default before it is saved. Not `crypto.randomUUID`, which needs HTTPS.
 *
 * @returns A new tier id.
 */
export function newTierId(): string {
    const bytes = new Uint8Array(16);
    // Available in every browser the dashboard supports.
    /* eslint-disable-next-line compat/compat */
    crypto.getRandomValues(bytes);

    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Keeps the default on an enabled tier, which the server requires: disabling or deleting the default
 * moves it to the first enabled one.
 *
 * @param tiers The tiers as they now stand.
 * @param current The default tier's id before this edit.
 * @returns The default tier's id after it, or `''` when no tier is enabled.
 */
export function pickDefault(tiers: DownloadTier[], current: string): string {
    return tiers.some(tier => tier.Enabled && tier.Id === current) ?
        current :
        tiers.find(tier => tier.Enabled)?.Id || '';
}

/**
 * Finds what the server would refuse about a tier table, so the page can say so before saving.
 *
 * @param tiers The tiers as they now stand.
 * @param defaultTierId The default tier's id, or `''` for none.
 * @returns The translation key of the problem, or `null` when the table can be saved.
 */
export function findTierProblem(tiers: DownloadTier[], defaultTierId: string): string | null {
    const suffixes = tiers.map(tier => tier.Suffix.trim().toLowerCase());

    if (suffixes.some(suffix => suffix.length === 0)) {
        return 'DownloadTierSuffixRequired';
    }

    if (new Set(suffixes).size !== suffixes.length) {
        return 'DownloadTierSuffixDuplicate';
    }

    // With no tier enabled there is nothing to be default.
    if (tiers.some(tier => tier.Enabled) && !defaultTierId) {
        return 'DownloadTierDefaultRequired';
    }

    return null;
}
