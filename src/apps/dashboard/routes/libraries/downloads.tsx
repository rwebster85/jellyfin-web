import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import Add from '@mui/icons-material/Add';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import Delete from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { findTierProblem, newTierId, pickDefault } from 'apps/dashboard/features/libraries/utils/downloadTiers';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { QUERY_KEY as DOWNLOAD_BEHAVIOUR_QUERY_KEY } from 'hooks/useDownloadBehaviour';
import { QUERY_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';
import {
    DOWNLOAD_CONFIG_KEY,
    DownloadBehaviour,
    type DownloadOptions,
    type DownloadTier
} from 'scripts/downloadSettings';
import { ActionData } from 'types/actionData';
import { queryClient } from 'utils/query/queryClient';

const CONFIG_KEY = DOWNLOAD_CONFIG_KEY;

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();
    const tiers = JSON.parse(formData.get('Tiers')?.toString() || '[]') as DownloadTier[];

    const newConfig: DownloadOptions = {
        Enabled: formData.get('Enabled') !== null,
        Locations: (formData.get('Locations')?.toString() || '').split('\n').filter(location => location.length > 0),
        Tiers: tiers,
        DefaultTierId: formData.get('DefaultTierId')?.toString() || null,
        Behaviour: formData.get('Behaviour')?.toString() === DownloadBehaviour.Substitute ?
            DownloadBehaviour.Substitute :
            DownloadBehaviour.SeparateAction,
        AllowOriginal: formData.get('AllowOriginal') !== null
    };

    await getSystemApi(api)
        .updateNamedConfiguration({ key: CONFIG_KEY, body: newConfig });

    void queryClient.invalidateQueries({
        queryKey: [QUERY_KEY, CONFIG_KEY]
    });
    // The item context menu reads the behaviour through its own query.
    void queryClient.invalidateQueries({
        queryKey: [DOWNLOAD_BEHAVIOUR_QUERY_KEY]
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
    const [tiers, setTiers] = useState<DownloadTier[]>([]);
    const [defaultTierId, setDefaultTierId] = useState('');
    const [behaviour, setBehaviour] = useState<DownloadBehaviour>(DownloadBehaviour.SeparateAction);
    const [allowOriginal, setAllowOriginal] = useState(true);

    useEffect(() => {
        if (config) {
            setEnabled(config.Enabled === true);
            setLocations(config.Locations || []);
            // Rows are keyed by id, so a hand-written tier without one gets one here.
            const stored = (config.Tiers ?? []).map(tier => (tier.Id ? tier : { ...tier, Id: newTierId() }));

            setTiers(stored);
            // Same rule as an edit, so a missing or disabled default opens with one selected.
            setDefaultTierId(pickDefault(stored, config.DefaultTierId || ''));
            setBehaviour(config.Behaviour || DownloadBehaviour.SeparateAction);
            setAllowOriginal(config.AllowOriginal);
        }
    }, [config]);

    const hasEnabledTier = useMemo(() => tiers.some(tier => tier.Enabled), [tiers]);

    // Every table edit goes through here, so the default never names a disabled or deleted tier.
    const updateTiers = useCallback((update: (current: DownloadTier[]) => DownloadTier[]) => {
        const next = update(tiers);

        setTiers(next);
        setDefaultTierId(pickDefault(next, defaultTierId));
    }, [tiers, defaultTierId]);

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

    const onAllowOriginalChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAllowOriginal(event.target.checked);
    }, []);

    const onAddTierClick = useCallback(() => {
        updateTiers(current => [...current, {
            Id: newTierId(),
            Suffix: '',
            Name: '',
            Description: '',
            Enabled: true
        }]);
    }, [updateTiers]);

    // One handler for every text box: the field name is "<tier id>|<field>".
    const onTierFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const [id, field] = event.target.name.split('|');
        const { value } = event.target;

        updateTiers(current => current.map(tier => (
            tier.Id === id ? { ...tier, [field]: value } : tier
        )));
    }, [updateTiers]);

    const onTierEnabledChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const [id] = event.target.name.split('|');
        const { checked } = event.target;

        updateTiers(current => current.map(tier => (
            tier.Id === id ? { ...tier, Enabled: checked } : tier
        )));
    }, [updateTiers]);

    const onDefaultTierChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setDefaultTierId(event.target.value);
    }, []);

    const onDeleteTierClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        const { id } = event.currentTarget.dataset;
        updateTiers(current => current.filter(tier => tier.Id !== id));
    }, [updateTiers]);

    const onMoveTierClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        const { id, offset } = event.currentTarget.dataset;

        updateTiers(current => {
            const from = current.findIndex(tier => tier.Id === id);
            const to = from + Number(offset);

            if (from < 0 || to < 0 || to >= current.length) {
                return current;
            }

            const next = [...current];
            [next[from], next[to]] = [next[to], next[from]];

            return next;
        });
    }, [updateTiers]);

    /** What the server would refuse, caught here so the page can say what is wrong. */
    const tierError = useMemo(() => {
        const problem = findTierProblem(tiers, defaultTierId);

        return problem ? globalize.translate(problem) : null;
    }, [tiers, defaultTierId]);

    if (isConfigPending) {
        return <Loading />;
    }

    return (
        <Page
            id='downloadsPage'
            title={globalize.translate('TabOptimisedDownloads')}
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
                            <Typography variant='h1'>{globalize.translate('TabOptimisedDownloads')}</Typography>
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
                                        <Typography variant='h2'>{globalize.translate('HeaderDownloadTiers')}</Typography>
                                        <Typography>{globalize.translate('HeaderDownloadTiersHelp')}</Typography>

                                        {tiers.length > 0 && (
                                            <TableContainer>
                                                <Table size='small'>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell />
                                                            <TableCell>{globalize.translate('LabelDownloadTierSuffix')}</TableCell>
                                                            <TableCell>{globalize.translate('LabelDownloadTierName')}</TableCell>
                                                            <TableCell>{globalize.translate('LabelDownloadTierDescription')}</TableCell>
                                                            <TableCell padding='checkbox'>{globalize.translate('LabelDownloadTierEnabled')}</TableCell>
                                                            <TableCell padding='checkbox'>{globalize.translate('LabelDownloadTierDefault')}</TableCell>
                                                            <TableCell />
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {tiers.map((tier, index) => (
                                                            <TableRow key={tier.Id}>
                                                                <TableCell padding='none'>
                                                                    <IconButton
                                                                        size='small'
                                                                        data-id={tier.Id}
                                                                        data-offset={-1}
                                                                        disabled={index === 0}
                                                                        title={globalize.translate('Up')}
                                                                        onClick={onMoveTierClick}
                                                                    >
                                                                        <ArrowUpward fontSize='small' />
                                                                    </IconButton>
                                                                    <IconButton
                                                                        size='small'
                                                                        data-id={tier.Id}
                                                                        data-offset={1}
                                                                        disabled={index === tiers.length - 1}
                                                                        title={globalize.translate('Down')}
                                                                        onClick={onMoveTierClick}
                                                                    >
                                                                        <ArrowDownward fontSize='small' />
                                                                    </IconButton>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <TextField
                                                                        size='small'
                                                                        variant='standard'
                                                                        name={`${tier.Id}|Suffix`}
                                                                        value={tier.Suffix}
                                                                        error={tier.Suffix.trim().length === 0}
                                                                        onChange={onTierFieldChange}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <TextField
                                                                        size='small'
                                                                        variant='standard'
                                                                        name={`${tier.Id}|Name`}
                                                                        value={tier.Name}
                                                                        placeholder={tier.Suffix}
                                                                        onChange={onTierFieldChange}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <TextField
                                                                        size='small'
                                                                        variant='standard'
                                                                        fullWidth
                                                                        name={`${tier.Id}|Description`}
                                                                        value={tier.Description || ''}
                                                                        onChange={onTierFieldChange}
                                                                    />
                                                                </TableCell>
                                                                <TableCell padding='checkbox'>
                                                                    <Checkbox
                                                                        name={`${tier.Id}|Enabled`}
                                                                        checked={tier.Enabled}
                                                                        onChange={onTierEnabledChange}
                                                                    />
                                                                </TableCell>
                                                                <TableCell padding='checkbox'>
                                                                    <Radio
                                                                        name='DefaultTier'
                                                                        value={tier.Id}
                                                                        checked={defaultTierId === tier.Id}
                                                                        disabled={!tier.Enabled}
                                                                        onChange={onDefaultTierChange}
                                                                    />
                                                                </TableCell>
                                                                <TableCell padding='checkbox'>
                                                                    <IconButton
                                                                        size='small'
                                                                        data-id={tier.Id}
                                                                        title={globalize.translate('ButtonRemove')}
                                                                        onClick={onDeleteTierClick}
                                                                    >
                                                                        <Delete fontSize='small' />
                                                                    </IconButton>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        )}

                                        <Box>
                                            <Button
                                                variant='outlined'
                                                startIcon={<Add />}
                                                onClick={onAddTierClick}
                                            >
                                                {globalize.translate('ButtonAddDownloadTier')}
                                            </Button>
                                        </Box>

                                        {tierError && (
                                            <Alert severity='error'>{tierError}</Alert>
                                        )}

                                        {tiers.length === 0 && (
                                            <Alert severity='info'>{globalize.translate('NoDownloadTiers')}</Alert>
                                        )}

                                        {tiers.length > 0 && !hasEnabledTier && (
                                            <Alert severity='warning'>{globalize.translate('NoEnabledDownloadTiers')}</Alert>
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

                                        {/*
                                          * Only under Substitute - otherwise Download already serves
                                          * the original. Hidden rather than unmounted, to keep the value.
                                          */}
                                        <Box sx={{ display: behaviour === DownloadBehaviour.Substitute ? 'block' : 'none', pl: 4 }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        name='AllowOriginal'
                                                        checked={allowOriginal}
                                                        onChange={onAllowOriginalChange}
                                                    />
                                                }
                                                label={globalize.translate('AllowOriginalDownload')}
                                            />
                                            <Typography variant='body2'>
                                                {globalize.translate('AllowOriginalDownloadHelp')}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Stack>
                            </Box>

                            <input type='hidden' readOnly name='Locations' value={locations.join('\n')} />
                            <input type='hidden' readOnly name='Tiers' value={JSON.stringify(tiers)} />
                            <input type='hidden' readOnly name='DefaultTierId' value={defaultTierId} />

                            <Button type='submit' size='large' disabled={tierError !== null}>
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
