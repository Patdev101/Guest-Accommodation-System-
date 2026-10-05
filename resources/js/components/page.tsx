import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The content column every admin page sits in. */
export function Page({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function PageHeader({
    title,
    description,
    actions,
    children,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 basis-64 space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                {description && (
                    <div className="text-sm text-muted-foreground">
                        {description}
                    </div>
                )}
                {children}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}
