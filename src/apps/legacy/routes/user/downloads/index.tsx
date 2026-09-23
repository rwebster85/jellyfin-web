import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { ORIGINAL_TIER_ID, QUERY_KEY, setDownloadTier, useDownloadTier } from 'hooks/useDownloadTier';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

/** The dropdown value standing for "no choice" - follow whatever the admin made the default. */
const FOLLOW_DEFAULT = '';

export default function UserDownloadPreferences() {
    const { api } = useApi();
    const { data: options, isPending, isError } = useDownloadTier();
    const [tierId, setTierId] = useState<string>(FOLLOW_DEFAULT);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (options) {
            // A stored choice that is not on the menu - a disabled tier, or Original when it is not
            // offered - shows as the default.
            const stored = options.TierId;
            const onMenu = stored === ORIGINAL_TIER_ID ?
                options.OriginalAvailable :
                options.Tiers.some(tier => tier.Id === stored);
            setTierId(stored && onMenu ? stored : FOLLOW_DEFAULT);
        }
    }, [options]);

    const onTierChange = useCallback((event: SelectChangeEvent) => {
        setTierId(event.target.value);
        setIsSaved(false);
    }, []);

    const onSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!api) return;

        setIsSaving(true);
        setDownloadTier(api, tierId === FOLLOW_DEFAULT ? null : tierId)
            .then(() => {
                setIsSaved(true);
                return queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
            })
            .catch(err => {
                console.error('[downloadPreferences] error saving the download tier', err);
            })
            .finally(() => {
                setIsSaving(false);
            });
    }, [api, tierId]);

    if (isPending) {
        return <Loading />;
    }

    const tiers = options?.Tiers ?? [];
    const originalAvailable = options?.OriginalAvailable === true;
    // One tier is no choice at all; Original is a choice even with no tiers.
    const hasChoice = tiers.length > 1 || originalAvailable;
    const defaultTier = tiers.find(tier => tier.Id === options?.DefaultTierId);

    return (
        <Page
            id='downloadPreferencesPage'
            className='mainAnimatedPage libraryPage userPreferencesPage noSecondaryNavPage'
            title={globalize.translate('TabOptimisedDownloads')}
        >
            <Box className='padded-left padded-right padded-bottom-page padded-top'>
                <Box className='readOnlyContent' style={{ margin: '0 auto' }}>
                    <form onSubmit={onSubmit}>
                        <Stack spacing={3}>
                            <Typography variant='h1'>{globalize.translate('TabOptimisedDownloads')}</Typography>

                            {isError && (
                                <Alert severity='error'>{globalize.translate('DownloadsLoadError')}</Alert>
                            )}

                            {/*
                              * Nothing to decide, so no control. Optimised copies are still
                              * served - the server just decides which.
                              */}
                            {!isError && !hasChoice && (
                                <Alert severity='info'>{globalize.translate('DownloadTierNoChoice')}</Alert>
                            )}

                            {!isError && hasChoice && (
                                <>
                                    {isSaved && (
                                        <Alert severity='success'>{globalize.translate('SettingsSaved')}</Alert>
                                    )}

                                    <FormControl fullWidth>
                                        <InputLabel id='downloadTierLabel'>
                                            {globalize.translate('LabelDownloadTier')}
                                        </InputLabel>
                                        <Select
                                            labelId='downloadTierLabel'
                                            id='downloadTier'
                                            value={tierId}
                                            label={globalize.translate('LabelDownloadTier')}
                                            onChange={onTierChange}
                                        >
                                            <MenuItem value={FOLLOW_DEFAULT}>
                                                {defaultTier ?
                                                    globalize.translate('DownloadTierServerDefault', defaultTier.Name) :
                                                    globalize.translate('DownloadTierServerDefaultUnset')}
                                            </MenuItem>
                                            {/* Admin-supplied, so shown as given, not translated. */}
                                            {tiers.map(tier => (
                                                <MenuItem key={tier.Id} value={tier.Id}>
                                                    <ListItemText
                                                        primary={tier.Name}
                                                        secondary={tier.Description || null}
                                                    />
                                                </MenuItem>
                                            ))}
                                            {/* Last: the optimised sizes, then the way out of them. */}
                                            {originalAvailable && (
                                                <MenuItem value={ORIGINAL_TIER_ID}>
                                                    <ListItemText
                                                        primary={globalize.translate('DownloadTierOriginal')}
                                                        secondary={globalize.translate('DownloadTierOriginalHelp')}
                                                    />
                                                </MenuItem>
                                            )}
                                        </Select>
                                        <FormHelperText>
                                            {globalize.translate('LabelDownloadTierHelp')}
                                        </FormHelperText>
                                    </FormControl>

                                    <Box>
                                        <Button type='submit' size='large' disabled={isSaving}>
                                            {globalize.translate('Save')}
                                        </Button>
                                    </Box>
                                </>
                            )}
                        </Stack>
                    </form>
                </Box>
            </Box>
        </Page>
    );
}
