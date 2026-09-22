import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY, setDownloadQuality, useDownloadQuality } from 'hooks/useDownloadQuality';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

/** The dropdown value standing for "no choice" - follow whatever the admin made the default. */
const FOLLOW_DEFAULT = '';

export default function UserDownloadPreferences() {
    const { api } = useApi();
    const { data: options, isPending, isError } = useDownloadQuality();
    const [quality, setQuality] = useState<string>(FOLLOW_DEFAULT);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (options) {
            // A tier the admin has since turned off is not on the menu, so it cannot be the value.
            const stored = options.Quality;
            setQuality(stored && options.Qualities.includes(stored) ? stored : FOLLOW_DEFAULT);
        }
    }, [options]);

    const onQualityChange = useCallback((event: SelectChangeEvent) => {
        setQuality(event.target.value);
        setIsSaved(false);
    }, []);

    const onSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!api) return;

        setIsSaving(true);
        setDownloadQuality(api, quality === FOLLOW_DEFAULT ? null : quality)
            .then(() => {
                setIsSaved(true);
                return queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
            })
            .catch(err => {
                console.error('[downloadPreferences] error saving the download quality', err);
            })
            .finally(() => {
                setIsSaving(false);
            });
    }, [api, quality]);

    if (isPending) {
        return <Loading />;
    }

    const enabled = options?.Qualities ?? [];
    // Nothing to choose between: one tier is the same as no tier from the user's side.
    const hasChoice = enabled.length > 1;

    return (
        <Page
            id='downloadPreferencesPage'
            className='mainAnimatedPage libraryPage userPreferencesPage noSecondaryNavPage'
            title={globalize.translate('TabDownloads')}
        >
            <Box className='padded-left padded-right padded-bottom-page padded-top'>
                <Box className='readOnlyContent' style={{ margin: '0 auto' }}>
                    <form onSubmit={onSubmit}>
                        <Stack spacing={3}>
                            <Typography variant='h1'>{globalize.translate('TabDownloads')}</Typography>

                            {isError && (
                                <Alert severity='error'>{globalize.translate('DownloadsLoadError')}</Alert>
                            )}

                            {!isError && enabled.length === 0 && (
                                <Alert severity='info'>{globalize.translate('NoDownloadQualitiesForUser')}</Alert>
                            )}

                            {!isError && enabled.length > 0 && (
                                <>
                                    {isSaved && (
                                        <Alert severity='success'>{globalize.translate('SettingsSaved')}</Alert>
                                    )}

                                    <FormControl fullWidth>
                                        <InputLabel id='downloadQualityLabel'>
                                            {globalize.translate('LabelDownloadQuality')}
                                        </InputLabel>
                                        <Select
                                            labelId='downloadQualityLabel'
                                            id='downloadQuality'
                                            value={quality}
                                            label={globalize.translate('LabelDownloadQuality')}
                                            disabled={!hasChoice}
                                            onChange={onQualityChange}
                                        >
                                            <MenuItem value={FOLLOW_DEFAULT}>
                                                {options?.DefaultQuality ?
                                                    globalize.translate(
                                                        'DownloadQualityServerDefault',
                                                        globalize.translate(`DownloadQuality${options.DefaultQuality}`)
                                                    ) :
                                                    globalize.translate('DownloadQualityServerDefaultUnset')}
                                            </MenuItem>
                                            {enabled.map(tier => (
                                                <MenuItem key={tier} value={tier}>
                                                    {globalize.translate(`DownloadQuality${tier}`)}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        <FormHelperText>
                                            {hasChoice ?
                                                globalize.translate('LabelDownloadQualityHelp') :
                                                globalize.translate('LabelDownloadQualityOnlyOne')}
                                        </FormHelperText>
                                    </FormControl>

                                    {hasChoice && (
                                        <Box>
                                            <Button type='submit' size='large' disabled={isSaving}>
                                                {globalize.translate('Save')}
                                            </Button>
                                        </Box>
                                    )}
                                </>
                            )}
                        </Stack>
                    </form>
                </Box>
            </Box>
        </Page>
    );
}
