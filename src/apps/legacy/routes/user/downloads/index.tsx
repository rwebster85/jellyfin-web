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
import { QUERY_KEY, setDownloadTier, useDownloadTier } from 'hooks/useDownloadTier';
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
            // A tier the admin has since turned off is not on the menu, so it cannot be the value.
            const stored = options.TierId;
            setTierId(stored && options.Tiers.some(tier => tier.Id === stored) ? stored : FOLLOW_DEFAULT);
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
    // Nothing to choose between: one tier is the same as no tier from the user's side.
    const hasChoice = tiers.length > 1;
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
                              * No tiers, or only one, comes to the same thing from here: there is
                              * no decision for the user to make, so the control is not shown at all
                              * rather than shown inert. It does not mean downloads are unavailable -
                              * optimised copies are still served, the server just decides which.
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
                                            {/*
                                              * Names and descriptions are the administrator's own
                                              * words, so they are rendered as given rather than
                                              * looked up - there is no string to translate.
                                              */}
                                            {tiers.map(tier => (
                                                <MenuItem key={tier.Id} value={tier.Id}>
                                                    <ListItemText
                                                        primary={tier.Name}
                                                        secondary={tier.Description || null}
                                                    />
                                                </MenuItem>
                                            ))}
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
