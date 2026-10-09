import type { Auth } from '@/types/auth';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

/** What the public and guest screens show everywhere. */
export type SiteInfo = {
    phone: string | null;
    email: string | null;
    address: string | null;
    check_in: string;
    check_out: string;
    grace_minutes: number;
    hold_hours: number;
};

/** One message under the guest's bell. */
export type GuestNotice = {
    id: string;
    title: string;
    body: string;
    url: string;
    at: string | null;
    read: boolean;
};

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            site: SiteInfo;
            /** Null unless a guest is signed in. */
            notices: { unread: number; items: GuestNotice[] } | null;
            [key: string]: unknown;
        };
    }
}
