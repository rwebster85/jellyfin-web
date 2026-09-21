import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Delete from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import React, { useCallback, useEffect, useState } from 'react';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

const CONFIG_KEY = 'downloads';

interface DownloadOptions {
    Locations: string[];
    Quality: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();

    const newConfig: DownloadOptions = {
        Locations: (formData.get('Locations')?.toString() || '').split('\n').filter(location => location.length > 0),
        Quality: formData.get('Quality')?.toString() || 'High'
    };

    await getSystemApi(api)
        .updateNamedConfiguration({ key: CONFIG_KEY, body: newConfig });

    void queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, CONFIG_KEY]
    });

    return {
        isSaved: true
    };
};

export const Component = () => {
    const {
        data: config,
        isPending: isConfigPending,
        isError: isConfigError
    } = useNamedConfiguration<DownloadOptions>(CONFIG_KEY);
    const navigation = useNavigation();
    const actionData = useActionData() as ActionData | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const [locations, setLocations] = useState<string[]>([]);

    useEffect(() => {
        if (config) {
            setLocations(config.Locations || []);
        }
    }, [config]);

    const onAddClick = useCallback(() => {
        const picker = new DirectoryBrowser();

        picker.show({
            includeDirectories: true,
            header: globalize.translate('HeaderSelectPath'),
            callback: function (path: string) {
                if (path) {
                    setLocations(current => current.includes(path) ? current : [...current, path]);
                }

                picker.close();
            }
        });
    }, []);

    const onRemoveClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        const path = event.currentTarget.dataset.path;
        setLocations(current => current.filter(location => location !== path));
    }, []);

    if (isConfigPending) {
        return <Loading />;
    }

    return (
        <Page
            id='downloadsPage'
            title={globalize.translate('TabDownloads')}
            className='type-interior mainAnimatedPage'
        >
            <Box className='content-primary'>
                {isConfigError ? (
                    <Alert severity='error'>{globalize.translate('DownloadsLoadError')}</Alert>
                ) : (
                    <Form method='POST'>
                        <Stack spacing={3}>
                            {!isSubmitting && actionData?.isSaved && (
                                <Alert severity='success'>
                                    {globalize.translate('SettingsSaved')}
                                </Alert>
                            )}
                            <Typography variant='h1'>{globalize.translate('TabDownloads')}</Typography>
                            <Typography>{globalize.translate('HeaderDownloadFoldersHelp')}</Typography>

                            <Stack spacing={1}>
                                <Typography variant='h2'>{globalize.translate('HeaderDownloadFolders')}</Typography>
                                {locations.length > 0 ? (
                                    <List disablePadding>
                                        {locations.map(location => (
                                            <ListItem
                                                key={location}
                                                disableGutters
                                                secondaryAction={
                                                    <IconButton
                                                        data-path={location}
                                                        title={globalize.translate('ButtonRemove')}
                                                        onClick={onRemoveClick}
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                }
                                            >
                                                <ListItemText primary={location} />
                                            </ListItem>
                                        ))}
                                    </List>
                                ) : (
                                    <Typography>{globalize.translate('NoDownloadFolders')}</Typography>
                                )}
                                <Box>
                                    <Button variant='outlined' onClick={onAddClick}>
                                        {globalize.translate('Add')}
                                    </Button>
                                </Box>
                            </Stack>

                            <input type='hidden' readOnly name='Locations' value={locations.join('\n')} />
                            <input type='hidden' readOnly name='Quality' value={config.Quality || 'High'} />

                            <Button type='submit' size='large'>
                                {globalize.translate('Save')}
                            </Button>
                        </Stack>
                    </Form>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'DownloadsPage';
