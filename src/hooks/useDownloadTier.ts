import type { Api } from '@jellyfin/sdk';
import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

export const QUERY_KEY = 'DownloadTier';

/** A tier as a user sees it. The file name suffix is the admin's business and is not sent. */
export interface DownloadTierInfo {
    /** What a choice is made and stored by, so that renaming a tier does not lose it. */
    Id: string;
    /** Admin-supplied, so it is shown as-is rather than translated. */
    Name: string;
    Description?: string | null;
}

/** The tiers a user may choose from, and the one they are on. */
export interface DownloadTierOptions {
    /** The tiers the admin has enabled, in the order they arranged them. */
    Tiers: DownloadTierInfo[];
    /** What a user who has not chosen gets, or null when the admin has enabled none. */
    DefaultTierId: string | null;
    /** Whether the original file is offered alongside the tiers, chosen as `ORIGINAL_TIER_ID`. */
    OriginalAvailable: boolean;
    /** This user's own choice - a tier id, `ORIGINAL_TIER_ID`, or null when they follow the default. */
    TierId: string | null;
}

/** The choice meaning "the original file". Mirrors the server's `DownloadTiers.OriginalId`. */
export const ORIGINAL_TIER_ID = 'original';

const fetchDownloadTier = async (api: Api, options?: AxiosRequestConfig) => {
    const response = await api.axiosInstance.get<DownloadTierOptions>(
        api.getUri('/Downloads/Tier'),
        { ...options, headers: { Authorization: api.authorizationHeader } }
    );

    return response.data;
};

export const setDownloadTier = async (api: Api, tierId: string | null) => {
    await api.axiosInstance.post(
        api.getUri('/Downloads/Tier'),
        { TierId: tierId },
        { headers: { Authorization: api.authorizationHeader } }
    );
};

export const useDownloadTier = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchDownloadTier(api!, { signal }),
        enabled: !!api
    });
};
