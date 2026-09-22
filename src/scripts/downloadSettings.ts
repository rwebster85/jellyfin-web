import type { Api } from '@jellyfin/sdk';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';

import { QUERY_KEY } from 'hooks/useNamedConfiguration';
import { queryClient } from 'utils/query/queryClient';

/** The server's named configuration holding the download settings. */
export const DOWNLOAD_CONFIG_KEY = 'downloads';

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

/** The download settings, mirroring the server's `DownloadOptions`. */
export interface DownloadOptions {
    Enabled: boolean;
    Locations: string[];
    Qualities: string[];
    Behaviour: DownloadBehaviour;
}

/**
 * Reads the download settings outside of a React component.
 *
 * Goes through queryClient under the same query key `useNamedConfiguration` uses, so it shares that
 * hook's cache entry and the invalidation the dashboard page fires on save - which means the context
 * menu reflects a settings change without a reload, and without a request per menu opening. The key
 * is what ties the two together, so the request itself is made here rather than reaching into the
 * hook for it.
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

                // The generated client types a named configuration as File, since the endpoint is
                // declared as returning an opaque document.
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
