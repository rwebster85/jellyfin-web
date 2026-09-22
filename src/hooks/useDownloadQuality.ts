import type { Api } from '@jellyfin/sdk';
import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

export const QUERY_KEY = 'DownloadQuality';

/** The tiers a user may choose from, and the one they are on. */
export interface DownloadQualityOptions {
    /** The tiers the admin has enabled, best first. */
    Qualities: string[];
    /** What a user who has not chosen a tier gets, or null when the admin has enabled none. */
    DefaultQuality: string | null;
    /** This user's own choice, or null when they follow the default. */
    Quality: string | null;
}

const fetchDownloadQuality = async (api: Api, options?: AxiosRequestConfig) => {
    const response = await api.axiosInstance.get<DownloadQualityOptions>(
        api.getUri('/Downloads/Quality'),
        { ...options, headers: { Authorization: api.authorizationHeader } }
    );

    return response.data;
};

export const setDownloadQuality = async (api: Api, quality: string | null) => {
    await api.axiosInstance.post(
        api.getUri('/Downloads/Quality'),
        { Quality: quality },
        { headers: { Authorization: api.authorizationHeader } }
    );
};

export const useDownloadQuality = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchDownloadQuality(api!, { signal }),
        enabled: !!api
    });
};
