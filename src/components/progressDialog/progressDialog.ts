import dialogHelper from '../dialogHelper/dialogHelper';
import layoutManager from '../layoutManager';

import '../loading/loading.scss';
import '../formdialog.scss';
import '../../styles/flexstyles.scss';

interface DialogOptions {
    autoFocus?: boolean;
    enableHistory?: boolean;
    removeOnClose?: boolean;
    scrollY?: boolean;
    size?: string;
}

export interface ProgressDialog {
    /** Closes the dialog. Closing one that is already closed does nothing. */
    close: () => void;
}

/** One layer of the spinner. The animation is four of these, offset against each other. */
const SPINNER_LAYER = '<div class="mdl-spinner__circle-clipper mdl-spinner__left"><div class="mdl-spinner__circle mdl-spinner__circleLeft"></div></div><div class="mdl-spinner__circle-clipper mdl-spinner__right"><div class="mdl-spinner__circle mdl-spinner__circleRight"></div></div>';

function getSpinnerHtml() {
    return [1, 2, 3, 4]
        .map(layer => `<div class="mdl-spinner__layer mdl-spinner__layer-${layer}">${SPINNER_LAYER}</div>`)
        .join('');
}

/**
 * Shows a modal dialog with a message and a spinner, and no buttons - the caller closes it when
 * whatever it is waiting for is done.
 * @param text The message to show.
 * @returns A handle for closing the dialog.
 */
export function show(text: string): ProgressDialog {
    const dialogOptions: DialogOptions = {
        removeOnClose: true,
        scrollY: false,
        autoFocus: false,
        // Closed by the caller, not the user, so kept out of the history.
        enableHistory: false
    };

    if (layoutManager.tv) {
        dialogOptions.size = 'fullscreen';
    }

    const dlg = dialogHelper.createDialog(dialogOptions);

    dlg.classList.add('formDialog');
    dlg.classList.add('align-items-center');
    dlg.classList.add('justify-content-center');

    dlg.innerHTML = `<div class="formDialogContent no-grow">
    <div class="dialogContentInner dialog-content-centered" style="padding: 2em; text-align: center;">
        <div class="mdl-spinner mdlSpinnerActive" dir="ltr" style="width: 3em; height: 3em;">${getSpinnerHtml()}</div>
        <div class="progressDialogText" style="margin-top: 1.5em;"></div>
    </div>
</div>`;

    const textElement = dlg.querySelector<HTMLElement>('.progressDialogText');
    if (textElement) {
        textElement.innerText = text;
    }

    dialogHelper.open(dlg).catch(err => {
        console.error('[progressDialog] error opening dialog', err);
    });

    let closed = false;

    return {
        close: () => {
            if (!closed) {
                closed = true;
                dialogHelper.close(dlg);
            }
        }
    };
}

export default {
    show
};
