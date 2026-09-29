import { usePage } from '@inertiajs/react';

/**
 * The query string of the page as Inertia loaded it. Read from the page URL,
 * not window.location, so the server render and the browser agree.
 */
export function useInitialQuery(): URLSearchParams {
    const { url } = usePage();

    return new URLSearchParams(url.split('?')[1] ?? '');
}

/**
 * Update query-string values in place (no visit), so filters survive a
 * reload and can be shared. Empty values are removed. Browser only.
 */
export function replaceQuery(params: Record<string, string | null>): void {
    const url = new URL(window.location.href);

    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
    }

    window.history.replaceState(window.history.state, '', url);
}
