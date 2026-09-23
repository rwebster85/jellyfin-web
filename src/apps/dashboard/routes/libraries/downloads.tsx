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
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
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

/**
 * Ids are generated here rather than left to the server so that a tier can be made the default in
 * the same edit that creates it.
 *
 * `crypto.randomUUID` is deliberately not used: it needs a secure context, and plenty of servers are
 * reached over plain HTTP. `getRandomValues` has no such restriction. The format matches the ids the
 * server generates - 32 hex characters, no dashes.
 *
 * @returns A new tier id.
 */
function newTierId(): string {
    const bytes = new Uint8Array(16);
    // The compat plugin's browser floor predates the dashboard's; getRandomValues has been in every
    // browser this page loads in for well over a decade.
    /* eslint-disable-next-line compat/compat */
    crypto.getRandomValues(bytes);

    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Keeps the default pointing at a tier users can actually be given - the server refuses to store one
 * that does not. Disabling or deleting the default tier moves it to the first enabled one, rather
 * than blocking a save over something the administrator has already said.
 *
 * @param tiers The tiers as they now stand.
 * @param current The default tier's id before this edit.
 * @returns The default tier's id after it.
 */
function pickDefault(tiers: DownloadTier[], current: string): string {
    return tiers.some(tier => tier.Enabled && tier.Id === current) ?
        current :
        tiers.find(tier => tier.Enabled)?.Id || '';
}

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
            const stored = config.Tiers ?? [];

            setTiers(stored);
            // Run the stored default through the same rule an edit would, so a configuration whose
            // default is missing or points at a disabled tier opens with a button selected rather
            // than in a state the page will not let anyone save.
            setDefaultTierId(pickDefault(stored, config.DefaultTierId || ''));
            setBehaviour(config.Behaviour || DownloadBehaviour.SeparateAction);
            // Absent from a configuration served by a build that predates the option, which is
            // the server's own default - on.
            setAllowOriginal(config.AllowOriginal !== false);
        }
    }, [config]);

    const hasEnabledTier = useMemo(() => tiers.some(tier => tier.Enabled), [tiers]);

    // Every edit to the table goes through here, so that the default is never left naming a tier
    // that has just been disabled or deleted.
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

    // The field name carries the tier's id and which field it is, since one handler serves every
    // text box in the table.
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

    /**
     * The two things the server refuses outright, caught here so the page can name the problem
     * rather than turning a save into a failed request.
     */
    const tierError = useMemo(() => {
        const suffixes = tiers.map(tier => tier.Suffix.trim().toLowerCase());

        if (suffixes.some(suffix => suffix.length === 0)) {
            return globalize.translate('DownloadTierSuffixRequired');
        }

        if (new Set(suffixes).size !== suffixes.length) {
            return globalize.translate('DownloadTierSuffixDuplicate');
        }

        // Only meaningful while there is something to be default. An administrator who has turned
        // every tier off, or deleted them all, has nothing to pick and saves freely.
        if (tiers.some(tier => tier.Enabled) && !defaultTierId) {
            return globalize.translate('DownloadTierDefaultRequired');
        }

        return null;
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
                                          * Only means anything under Substitute: otherwise the plain
                                          * Download already serves the original. Hidden rather than
                                          * unmounted, like the section above, so switching
                                          * behaviour back and forth keeps the stored value.
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
