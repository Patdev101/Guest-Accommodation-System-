import { Link, usePage } from '@inertiajs/react';
import { CalendarCheck, ChevronDown, LayoutGrid } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { AutoRefresh } from '@/components/auto-refresh';
import { LoginDialog } from '@/components/login-dialog';
import { GuestBell } from '@/components/public/guest-bell';
import { RegisterDialog } from '@/components/register-dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { dashboard, home } from '@/routes';
import { home as guestHome } from '@/routes/guest';
import { onAccountDialog } from '@/lib/account-dialog';
import { index as roomsIndex } from '@/routes/rooms';
import type { User } from '@/types';

/**
 * The public side: a top bar and a footer, no staff sidebar. Visitors see
 * "Log in" and "Create account"; a signed-in guest sees their account menu.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
    const page = usePage();
    const { auth, name, site } = page.props;
    const onList = page.component === 'public/rooms';
    // Which account pop-up is open: log in, create account, or neither.
    const [account, setAccount] = useState<'login' | 'register' | null>(null);
    // Where to go after signing in, when a page asked for the pop-up (e.g. "Request to book").
    const [intended, setIntended] = useState<string | undefined>(undefined);

    useEffect(
        () =>
            onAccountDialog((request) => {
                setIntended(request.intended);
                setAccount(request.mode);
            }),
        [],
    );
    // Nobody is signed in on most public visits.
    const user = auth.user as User | null;
    const staff = user?.role === 'admin' || user?.role === 'reception';

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
                    <Link
                        href={home()}
                        className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-5" />
                        </span>
                        <span className="grid min-w-0 text-left leading-tight">
                            <span className="truncate text-sm font-semibold">
                                {name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                Mindoro Marine
                            </span>
                        </span>
                    </Link>

                    <nav className="flex items-center gap-1 sm:gap-2">
                        <Button
                            variant="ghost"
                            asChild
                            className="hidden sm:inline-flex"
                        >
                            {/* On the list itself, "Rooms" jumps down to the rooms. */}
                            {onList ? (
                                <a href="#rooms">Rooms</a>
                            ) : (
                                <Link href={`${roomsIndex().url}#rooms`}>
                                    Rooms
                                </Link>
                            )}
                        </Button>
                        {user ? (
                            <>
                                {user.role === 'guest' && (
                                    <Button
                                        variant={
                                            page.component === 'guest/home'
                                                ? 'secondary'
                                                : 'ghost'
                                        }
                                        asChild
                                    >
                                        <Link href={guestHome()}>
                                            <CalendarCheck />
                                            My bookings
                                        </Link>
                                    </Button>
                                )}
                                <GuestBell />
                                {staff && (
                                    <Button variant="outline" asChild>
                                        <Link href={dashboard()}>
                                            <LayoutGrid />
                                            Dashboard
                                        </Link>
                                    </Button>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="max-w-44"
                                        >
                                            <span className="truncate">
                                                {user.name}
                                            </span>
                                            <ChevronDown />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-56"
                                    >
                                        <UserMenuContent user={user} />
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setIntended(undefined);
                                        setAccount('login');
                                    }}
                                >
                                    Log in
                                </Button>
                                <Button
                                    onClick={() => {
                                        setIntended(undefined);
                                        setAccount('register');
                                    }}
                                >
                                    Create account
                                </Button>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            <AutoRefresh />
            <main className="flex flex-1 flex-col">{children}</main>

            {!user && (
                <>
                    <LoginDialog
                        open={account === 'login'}
                        onOpenChange={(open) => !open && setAccount(null)}
                        onSignUp={() => setAccount('register')}
                        intended={intended}
                    />
                    <RegisterDialog
                        open={account === 'register'}
                        onOpenChange={(open) => !open && setAccount(null)}
                        onLogIn={() => setAccount('login')}
                        intended={intended}
                    />
                </>
            )}

            <footer className="border-t bg-background print:hidden">
                <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
                    <span>{name} · Mindoro Marine Manufacturing Corp.</span>
                    {/* How to reach the front desk, once the Admin has filled it in. */}
                    {site.phone || site.email || site.address ? (
                        <span className="flex flex-wrap gap-x-4 gap-y-1">
                            {site.address && <span>{site.address}</span>}
                            {site.phone && (
                                <a
                                    href={`tel:${site.phone.replace(/[^0-9+]/g, '')}`}
                                    className="underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    {site.phone}
                                </a>
                            )}
                            {site.email && (
                                <a
                                    href={`mailto:${site.email}`}
                                    className="underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    {site.email}
                                </a>
                            )}
                        </span>
                    ) : (
                        <span>
                            Every booking is confirmed by our front desk.
                        </span>
                    )}
                </div>
            </footer>
        </div>
    );
}
