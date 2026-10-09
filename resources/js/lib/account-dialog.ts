/**
 * Lets any public page open the log-in or create-account pop-up that lives in
 * the public layout, and say where to go once the visitor is signed in.
 */
export type AccountDialogRequest = {
    mode: 'login' | 'register';
    /** A guest-only address to open after signing in. */
    intended?: string;
};

const EVENT = 'guest-accommodation:account-dialog';

export function openAccountDialog(request: AccountDialogRequest): void {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: request }));
}

/** Call `handler` whenever a page asks for the pop-up; returns the clean-up. */
export function onAccountDialog(
    handler: (request: AccountDialogRequest) => void,
): () => void {
    const listener = (event: Event) =>
        handler((event as CustomEvent<AccountDialogRequest>).detail);

    window.addEventListener(EVENT, listener);

    return () => window.removeEventListener(EVENT, listener);
}
