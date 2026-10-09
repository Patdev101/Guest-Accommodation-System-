import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import PublicLayout from '@/layouts/public-layout';
import { home as guestHome } from '@/routes/guest';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    const { auth } = usePage().props;

    // Guests never get the staff sidebar: their account settings sit inside the
    // same top bar and footer as the rest of their screens.
    if (auth.user?.role === 'guest') {
        return (
            <PublicLayout>
                <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
                    <Link
                        href={guestHome()}
                        className="inline-flex items-center gap-1.5 px-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                        <ArrowLeft className="size-4" />
                        My bookings
                    </Link>
                    {children}
                </div>
            </PublicLayout>
        );
    }

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs}>
            {children}
        </AppLayoutTemplate>
    );
}
