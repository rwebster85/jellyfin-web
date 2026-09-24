import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

import { appHost } from 'components/apphost';
import { AppFeature } from 'constants/appFeature';
import { fetchDownloadBehaviour, QUERY_KEY } from 'hooks/useDownloadBehaviour';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { queryClient } from 'utils/query/queryClient';

import { canHaveOptimisedCopy, offersSeparateOptimisedAction } from './downloadSettings';
import shell from './shell';

/** The item context menu's id for Optimised Download. */
export const OPTIMISED_DOWNLOAD_COMMAND_ID = 'optimiseddownload';

/**
 * The Optimised Download entry for an item's context menu, or `null` when it should not be offered:
 * the item is not a video (optimised copies only exist for video), the admin has not chosen a
 * separate action, or this client cannot honour it - a shell that builds its own download URL must
 * understand the optimised flag, or it would quietly fetch the original.
 *
 * @param item The item the menu is for.
 * @returns The menu command, or `null`.
 */
export async function getOptimisedDownloadCommand(item: BaseItemDto) {
    // Checked first, so music and books never cost a request.
    if (!canHaveOptimisedCopy(item)) return null;

    const api = ServerConnections.getApi(item.ServerId ?? undefined);
    if (!api) return null;

    let behaviour = null;
    try {
        // Cached under the same key as useDownloadBehaviour, so not a request per menu.
        behaviour = await queryClient.fetchQuery({
            queryKey: [QUERY_KEY],
            queryFn: ({ signal }) => fetchDownloadBehaviour(api, { signal })
        });
    } catch (err) {
        console.error('[optimisedDownloadCommand] could not read the download behaviour', err);
        return null;
    }

    const canHonour = shell.supportsDownloadUrl() || appHost.supports(AppFeature.OptimisedDownload);

    return offersSeparateOptimisedAction(behaviour) && canHonour ?
        { name: globalize.translate('OptimisedDownload'), id: OPTIMISED_DOWNLOAD_COMMAND_ID, icon: 'file_download' } :
        null;
}

/**
 * Runs Optimised Download for an item. The downloader is loaded only when it is used.
 *
 * @param item The item to download.
 */
export async function runOptimisedDownload(item: BaseItemDto) {
    const api = ServerConnections.getApi(item.ServerId ?? undefined);
    if (!api) return;

    try {
        const { downloadOptimised } = await import('./optimisedDownloader');
        await downloadOptimised(api, item);
    } catch (err) {
        console.error('[optimisedDownloadCommand] error downloading the optimised file', err);
    }
}
