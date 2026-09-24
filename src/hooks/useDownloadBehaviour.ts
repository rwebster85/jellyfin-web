import type { Api } from '@jellyfin/sdk';
import { useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';
import type { DownloadBehaviour } from 'scripts/downloadSettings';

export const QUERY_KEY = 'DownloadBehaviour';

/** Whether optimised downloads are on, and what the plain Download does. Readable by any user. */
export interface DownloadBehaviourInfo {
    Enabled: boolean;
    Behaviour: DownloadBehaviour;
}

export const fetchDownloadBehaviour = async (api: Api, options?: AxiosRequestConfig) => {
    const response = await api.axiosInstance.get<DownloadBehaviourInfo>(
        api.getUri('/Downloads/Behaviour'),
        { ...options, headers: { Authorization: api.authorizationHeader } }
    );

    return response.data;
};

export const useDownloadBehaviour = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [QUERY_KEY],
        queryFn: ({ signal }) => fetchDownloadBehaviour(api!, { signal }),
        enabled: !!api
    });
};
