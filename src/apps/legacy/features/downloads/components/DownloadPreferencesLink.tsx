import React, { type FC } from 'react';

import LinkButton from 'elements/emby-button/LinkButton';
import { useApi } from 'hooks/useApi';
import { useDownloadBehaviour } from 'hooks/useDownloadBehaviour';
import globalize from 'lib/globalize';

interface DownloadPreferencesLinkProps {
    /** The user whose preferences menu this is. */
    userId: string;
}

/**
 * The Downloads entry in the user preferences menu. Hidden while optimised downloads are off, and
 * when an admin is viewing another user's preferences: the page only sets the signed-in user's
 * own tier.
 */
const DownloadPreferencesLink: FC<DownloadPreferencesLinkProps> = ({ userId }) => {
    const { user: currentUser } = useApi();
    const { data: behaviour } = useDownloadBehaviour();

    if (behaviour?.Enabled !== true || userId !== currentUser?.Id) {
        return null;
    }

    return (
        <LinkButton
            href={`#/mypreferencesdownloads?userId=${userId}`}
            className='lnkDownloadPreferences listItem-border'
            style={{
                display: 'block',
                margin: 0,
                padding: 0
            }}
        >
            <div className='listItem'>
                <span className='material-icons listItemIcon listItemIcon-transparent file_download' aria-hidden='true' />
                <div className='listItemBody'>
                    <div className='listItemBodyText'>
                        {globalize.translate('TabOptimisedDownloads')}
                    </div>
                </div>
            </div>
        </LinkButton>
    );
};

export default DownloadPreferencesLink;
