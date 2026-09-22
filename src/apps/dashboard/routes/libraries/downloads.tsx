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
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
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
import {
    DOWNLOAD_CONFIG_KEY,
    DownloadBehaviour,
    type DownloadOptions
} from 'scripts/downloadSettings';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

const CONFIG_KEY = DOWNLOAD_CONFIG_KEY;

/**
 * The quality tiers, best first. The first enabled tier is the server default - what a user who has
 * not chosen one for themselves gets - and a tier with no file for an item falls back to the others.
 */
const QUALITIES = ['High', 'Standard'];

/**
 * Prefixes each tier's checkbox field name. The form reads the submitted values back by these
 * prefixed names, while the component's state holds bare tier names, so anything reading
 * `event.target.name` has to strip this first.
 */
const QUALITY_FIELD_PREFIX = 'Quality-';

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();

    const newConfig: DownloadOptions = {
        Enabled: formData.get('Enabled') !== null,
        Locations: (formData.get('Locations')?.toString() || '').split('\n').filter(location => location.length > 0),
        Qualities: QUALITIES.filter(quality => formData.get(`${QUALITY_FIELD_PREFIX}${quality}`) !== null),
        Behaviour: formData.get('Behaviour')?.toString() === DownloadBehaviour.Substitute ?
            DownloadBehaviour.Substitute :
            DownloadBehaviour.SeparateAction
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
    const [enabled, setEnabled] = useState(false);
    const [locations, setLocations] = useState<string[]>([]);
    const [qualities, setQualities] = useState<string[]>([]);
    const [behaviour, setBehaviour] = useState<DownloadBehaviour>(DownloadBehaviour.SeparateAction);

    useEffect(() => {
        if (config) {
            setEnabled(config.Enabled === true);
            setLocations(config.Locations || []);
            setQualities(config.Qualities || []);
            setBehaviour(config.Behaviour || DownloadBehaviour.SeparateAction);
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

    const onEnabledChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setEnabled(event.target.checked);
    }, []);

    const onBehaviourChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setBehaviour(event.target.value as DownloadBehaviour);
    }, []);

    const onQualityChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;

        // The field name carries QUALITY_FIELD_PREFIX; the state holds bare tier names. Comparing
        // the two directly never matches, which left both ticking and unticking doing nothing.
        const changed = name.slice(QUALITY_FIELD_PREFIX.length);

        setQualities(current => (
            checked ?
                QUALITIES.filter(quality => quality === changed || current.includes(quality)) :
                current.filter(quality => quality !== changed)
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
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            name='Enabled'
                                            checked={enabled}
                                            onChange={onEnabledChange}
                                        />
                                    }
                                    label={globalize.translate('EnableOptimisedDownloads')}
                                />
                                <Typography>{globalize.translate('EnableOptimisedDownloadsHelp')}</Typography>
                            </Stack>

                            {/*
                              * Hidden rather than unmounted, so stored values aren't wiped.
                              */}
                            <Box sx={{ display: enabled ? 'block' : 'none' }}>
                                <Stack spacing={3}>
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
                                                            name={`${QUALITY_FIELD_PREFIX}${quality}`}
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

                                    <Stack spacing={1}>
                                        <Typography variant='h2'>{globalize.translate('HeaderDownloadBehaviour')}</Typography>
                                        <Typography>{globalize.translate('HeaderDownloadBehaviourHelp')}</Typography>
                                        <RadioGroup
                                            name='Behaviour'
                                            value={behaviour}
                                            onChange={onBehaviourChange}
                                        >
                                            <FormControlLabel
                                                value={DownloadBehaviour.SeparateAction}
                                                control={<Radio />}
                                                label={globalize.translate('DownloadBehaviourSeparateAction')}
                                            />
                                            <Typography variant='body2'>
                                                {globalize.translate('DownloadBehaviourSeparateActionHelp')}
                                            </Typography>
                                            <FormControlLabel
                                                value={DownloadBehaviour.Substitute}
                                                control={<Radio />}
                                                label={globalize.translate('DownloadBehaviourSubstitute')}
                                            />
                                            <Typography variant='body2'>
                                                {globalize.translate('DownloadBehaviourSubstituteHelp')}
                                            </Typography>
                                        </RadioGroup>
                                    </Stack>
                                </Stack>
                            </Box>

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
