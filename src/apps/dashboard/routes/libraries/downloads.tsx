import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Delete from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
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
    Qualities: string[];
}

/**
 * The quality tiers, best first. The first enabled tier is the server default - what a user who has
 * not chosen one for themselves gets - and a tier with no file for an item falls back to the others.
 */
const QUALITIES = ['High', 'Standard'];

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();

    const newConfig: DownloadOptions = {
        Locations: (formData.get('Locations')?.toString() || '').split('\n').filter(location => location.length > 0),
        Qualities: QUALITIES.filter(quality => formData.get(`Quality-${quality}`) !== null)
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
    const [qualities, setQualities] = useState<string[]>([]);

    useEffect(() => {
        if (config) {
            setLocations(config.Locations || []);
            setQualities(config.Qualities || []);
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

    const onQualityChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        setQualities(current => (
            checked ?
                QUALITIES.filter(quality => quality === name || current.includes(quality)) :
                current.filter(quality => quality !== name)
        ));
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

                            <Stack spacing={1}>
                                <Typography variant='h2'>{globalize.translate('HeaderDownloadQualities')}</Typography>
                                <Typography>{globalize.translate('HeaderDownloadQualitiesHelp')}</Typography>
                                <FormGroup>
                                    {QUALITIES.map(quality => (
                                        <FormControlLabel
                                            key={quality}
                                            control={
                                                <Checkbox
                                                    name={`Quality-${quality}`}
                                                    checked={qualities.includes(quality)}
                                                    onChange={onQualityChange}
                                                />
                                            }
                                            label={globalize.translate(`DownloadQuality${quality}`)}
                                        />
                                    ))}
                                </FormGroup>
                                {qualities.length === 0 && (
                                    <Alert severity='warning'>{globalize.translate('NoDownloadQualities')}</Alert>
                                )}
                            </Stack>

                            <input type='hidden' readOnly name='Locations' value={locations.join('\n')} />

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
