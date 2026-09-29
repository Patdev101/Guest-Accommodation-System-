import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label, control, hint and validation message, spaced the same everywhere. */
export function FormField({
    label,
    htmlFor,
    hint,
    error,
    optional = false,
    className,
    children,
}: {
    label: string;
    htmlFor: string;
    hint?: ReactNode;
    error?: string;
    optional?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={htmlFor}>
                {label}
                {optional && (
                    <span className="ml-1 font-normal text-muted-foreground">
                        (optional)
                    </span>
                )}
            </Label>
            {children}
            {hint && !error && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
            <InputError message={error} />
        </div>
    );
}
