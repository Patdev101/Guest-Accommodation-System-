import { usePoll } from '@inertiajs/react';

/** How often an open screen asks the server for fresh data. */
export const REFRESH_MS = 10_000;

/**
 * Keeps whatever screen is open up to date without a manual reload (owner,
 * 9 Oct 2026): when a guest sends a request, Reception sees it within a few
 * seconds, and the guest sees the answer the same way. Only the data is
 * refreshed; what someone is typing, an open pop-up and the scroll position
 * stay as they are. A tab in the background is checked far less often.
 */
export function AutoRefresh() {
    usePoll(REFRESH_MS);

    return null;
}
