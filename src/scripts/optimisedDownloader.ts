import type { Api } from '@jellyfin/sdk';
import { AUTHORIZATION_PARAMETER } from '@jellyfin/sdk/lib/constants';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';

import confirm from '../components/confirm/confirm';
import progressDialog from '../components/progressDialog/progressDialog';
import globalize from '../lib/globalize';

import { download } from './fileDownloader';

function getFileName(path?: string | null) {
    return path?.replace(/^.*[\\/]/, '');
}

/** The server answers 404 when it has no optimised version of an item - that is an answer, not a failure. */
function isNotFound(err: unknown) {
    return (err as { response?: { status?: number } })?.response?.status === 404;
}

function getOptimisedDownloadUrl(api: Api, itemId: string) {
    return api.getUri(`/Items/${itemId}/Download/Optimised`, { [AUTHORIZATION_PARAMETER]: api.accessToken });
}

/**
 * Asks the server to describe the optimised version of an item.
 * @param api The Api client.
 * @param itemId The item id.
 * @returns The optimised version's media source, or null when there isn't one.
 */
async function getOptimisedMediaInfo(api: Api, itemId: string) {
    try {
        const response = await api.axiosInstance.get<MediaSourceInfo>(
            api.getUri(`/Items/${itemId}/Download/Optimised/MediaInfo`),
            { headers: { Authorization: api.authorizationHeader } }
        );

        return response.data;
    } catch (err) {
        if (isNotFound(err)) {
            return null;
        }

        throw err;
    }
}

/**
 * Downloads the optimised version of an item, and offers the item's own file when there isn't one.
 * @param api The Api client.
 * @param item The item to download.
 */
export async function downloadOptimised(api: Api, item: BaseItemDto) {
    const itemId = item.Id;
    if (!itemId) {
        return;
    }

    const searching = progressDialog.show(globalize.translate('SearchingForOptimisedFile'));

    let optimised: MediaSourceInfo | null = null;
    let lookupFailed = false;

    try {
        optimised = await getOptimisedMediaInfo(api, itemId);
    } catch (err) {
        console.error('[optimisedDownloader] error looking for an optimised file', err);
        lookupFailed = true;
    } finally {
        searching.close();
    }

    if (optimised) {
        download([{
            url: getOptimisedDownloadUrl(api, itemId),
            item,
            itemId,
            serverId: item.ServerId,
            title: item.Name,
            // The optimised file is named after itself, not after the item's own file.
            filename: getFileName(optimised.Path) || getFileName(item.Path),
            // For a shell that builds its own URL from the item id; a browser ignores it.
            optimised: true
        }]);

        return;
    }

    try {
        await confirm({
            title: globalize.translate('OptimisedDownload'),
            text: globalize.translate(lookupFailed ? 'OptimisedDownloadFailed' : 'NoOptimisedFileFound'),
            confirmText: globalize.translate('Download')
        });
    } catch {
        // The user declined the original file.
        return;
    }

    // No `optimised` flag: the user has just agreed to the item's own file.
    download([{
        url: getLibraryApi(api).getDownloadUrl({ itemId }),
        item,
        itemId,
        serverId: item.ServerId,
        title: item.Name,
        filename: getFileName(item.Path)
    }]);
}

export default {
    downloadOptimised
};
