// TODO: This seems like a good candidate for deprecation
export default {
    enableFullscreen: function() {
        if (window.NativeShell?.enableFullscreen) {
            window.NativeShell.enableFullscreen();
        }
    },
    disableFullscreen: function() {
        if (window.NativeShell?.disableFullscreen) {
            window.NativeShell.disableFullscreen();
        }
    },
    openClientSettings: () => {
        if (window.NativeShell?.openClientSettings) {
            window.NativeShell.openClientSettings();
        }
    },
    openDownloadManager: () => {
        if (window.NativeShell?.openDownloadManager) {
            window.NativeShell.openDownloadManager();
        }
    },
    openUrl: function(url, target) {
        if (window.NativeShell?.openUrl) {
            window.NativeShell.openUrl(url, target);
        } else {
            window.open(url, target || '_blank');
        }
    },
    updateMediaSession(mediaInfo) {
        if (window.NativeShell?.updateMediaSession) {
            window.NativeShell.updateMediaSession(mediaInfo);
        }
    },
    hideMediaSession() {
        if (window.NativeShell?.hideMediaSession) {
            window.NativeShell.hideMediaSession();
        }
    },
    /**
     * Notify the NativeShell about volume level changes.
     * Useful for e.g. remote playback.
     */
    updateVolumeLevel(volume) {
        if (window.NativeShell?.updateVolumeLevel) {
            window.NativeShell.updateVolumeLevel(volume);
        }
    },
    /**
     * Download specified files with NativeShell if possible
     *
     * @returns true on success
     */
    downloadFiles(items) {
        if (window.NativeShell?.downloadFiles) {
            window.NativeShell.downloadFiles(items);
            return true;
        }
        if (window.NativeShell?.downloadFile) {
            items.forEach(item => {
                window.NativeShell.downloadFile(item);
            });
            return true;
        }
        return false;
    },
    /**
     * Whether a download will use the URL it is given. A NativeShell such as the Android app builds its
     * own from the item id instead.
     *
     * @returns true when a download URL other than the item's own will be used
     */
    supportsDownloadUrl() {
        return !window.NativeShell?.downloadFiles && !window.NativeShell?.downloadFile;
    }
};
