import type { Api } from '@jellyfin/sdk';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';

import { QUERY_KEY } from 'hooks/useNamedConfiguration';
import { queryClient } from 'utils/query/queryClient';

/**
 * The server's named configuration key: the file name (`optimised-downloads.xml`) and the route
 * segment. Must match the server's `DownloadConfigurationStore.StoreKey`.
 */
export const DOWNLOAD_CONFIG_KEY = 'optimised-downloads';

/**
 * Which download behaviour the server offers, mirroring the server's `DownloadBehaviour` enum.
 * The values are the names the server serialises, not numbers.
 */
export enum DownloadBehaviour {
    /** The plain download serves the item's own file; the optimised copy is a separate action. */
    SeparateAction = 'SeparateAction',
    /** The plain download serves the optimised copy, and no separate action is offered. */
    Substitute = 'Substitute'
}

/** A download tier, mirroring the server's `DownloadTier`. */
export interface DownloadTier {
    /** What a user's stored choice and `DefaultTierId` point at. Empty on a tier not yet saved. */
    Id: string;
    /** The file name suffix this tier is matched by: `<source stem> - <Suffix>.<ext>`. */
    Suffix: string;
    /** The label users see. Admin-supplied, so it is never translated. */
    Name: string;
    Description?: string | null;
    Enabled: boolean;
}

/** The download settings, mirroring the server's `DownloadOptions`. */
export interface DownloadOptions {
    Enabled: boolean;
    Locations: string[];
    Tiers: DownloadTier[];
    DefaultTierId?: string | null;
    Behaviour: DownloadBehaviour;
    /** Whether users may choose the original file instead. Only offered under `Substitute`. */
    AllowOriginal: boolean;
}

/**
 * Reads the download settings outside of a React component. Uses `useNamedConfiguration`'s query key,
 * so it shares that hook's cache and sees the dashboard's saves without a reload.
 *
 * @param api The Api client.
 * @returns The settings, or `null` when they cannot be read.
 */
export async function getDownloadSettings(api: Api): Promise<DownloadOptions | null> {
    try {
        return await queryClient.fetchQuery({
            queryKey: [QUERY_KEY, DOWNLOAD_CONFIG_KEY],
            queryFn: async ({ signal }) => {
                const response = await getSystemApi(api)
                    .getNamedConfiguration({ key: DOWNLOAD_CONFIG_KEY }, { signal });

                // The generated client types a named configuration as File.
                return response.data as unknown as DownloadOptions;
            }
        });
    } catch (err) {
        console.error('[downloadSettings] could not read the download settings', err);
        return null;
    }
}

/**
 * Whether the server wants the optimised copy offered as its own action, rather than served in
 * place of the item's own file.
 *
 * @param settings The download settings, or `null` when they could not be read.
 * @returns `true` when a separate action should be offered.
 */
export function offersSeparateOptimisedAction(settings: DownloadOptions | null): boolean {
    return settings?.Enabled === true && settings.Behaviour === DownloadBehaviour.SeparateAction;
}
