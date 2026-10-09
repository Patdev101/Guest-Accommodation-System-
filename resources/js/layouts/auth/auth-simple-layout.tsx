import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 pt-20 md:p-10">
            {/* A way out for someone who changed their mind. */}
            <Button
                variant="ghost"
                asChild
                className="absolute top-4 left-4 md:top-6 md:left-6"
            >
                <Link href={home()}>
                    <ArrowLeft />
                    Back to rooms
                </Link>
            </Button>
            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href={home()}
                            className="flex flex-col items-center gap-2 font-medium"
                        >
                            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                                <AppLogoIcon className="size-6" />
                            </div>
                            <span className="text-sm font-semibold">
                                Guest Accommodation
                            </span>
                        </Link>

                        <div className="space-y-2 text-center">
                            <h1 className="text-xl font-medium">{title}</h1>
                            <p className="text-center text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
