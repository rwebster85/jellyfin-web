import type { Api } from '@jellyfin/sdk';
import { AUTHORIZATION_PARAMETER } from '@jellyfin/sdk/lib/constants';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

import { download } from './fileDownloader';

function getFileName(path?: string | null) {
    return path?.replace(/^.*[\\/]/, '');
}

function getOptimisedDownloadUrl(api: Api, itemId: string) {
    return api.getUri(`/Items/${itemId}/Download/Optimised`, { [AUTHORIZATION_PARAMETER]: api.accessToken });
}

/**
 * Downloads the optimised copy of an item. Nothing is asked first: the server serves a finished
 * copy, or makes one while it streams, so there is no "is there one?" to check.
 * @param api The Api client.
 * @param item The item to download.
 */
export function downloadOptimised(api: Api, item: BaseItemDto) {
    const itemId = item.Id;
    if (!itemId) {
        return;
    }

    download([{
        url: getOptimisedDownloadUrl(api, itemId),
        item,
        itemId,
        serverId: item.ServerId,
        title: item.Name,
        // A browser takes the name from the server's response; this is for a shell that names it itself.
        filename: getFileName(item.Path),
        // For a shell that builds its own URL from the item id; a browser ignores it.
        optimised: true
    }]);
}

export default {
    downloadOptimised
};
