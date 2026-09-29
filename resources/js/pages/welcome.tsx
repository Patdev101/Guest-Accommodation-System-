import { Head, Link, usePage } from '@inertiajs/react';
import { BedDouble } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';

export default function Welcome() {
    const { auth, name } = usePage().props;

    return (
        <>
            <Head title="Welcome" />
            <div className="flex min-h-screen flex-col bg-background text-foreground">
                <header className="flex items-center justify-between px-4 py-4 sm:px-8">
                    <span className="text-sm font-semibold">{name}</span>
                    <nav className="flex items-center gap-2">
                        {auth.user ? (
                            <Button asChild variant="outline">
                                <Link href={dashboard()}>Dashboard</Link>
                            </Button>
                        ) : (
                            <>
                                <Button asChild variant="ghost">
                                    <Link href={login()}>Log in</Link>
                                </Button>
                                <Button asChild>
                                    <Link href={register()}>
                                        Create account
                                    </Link>
                                </Button>
                            </>
                        )}
                    </nav>
                </header>

                <main className="flex flex-1 items-center justify-center px-4 pb-16">
                    <div className="max-w-xl text-center">
                        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                            <BedDouble className="size-7" />
                        </div>
                        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                            Mindoro Marine Manufacturing Corporation
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                            Guest Accommodation
                        </h1>
                        <p className="mt-4 text-muted-foreground">
                            Reserve a room at the Guest Villas, Barracks or
                            another company location, and follow your
                            reservations, bills and check-out reminders online.
                        </p>
                        {!auth.user && (
                            <div className="mt-8 flex flex-wrap justify-center gap-3">
                                <Button asChild size="lg">
                                    <Link href={register()}>
                                        Create a guest account
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href={login()}>Log in</Link>
                                </Button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
