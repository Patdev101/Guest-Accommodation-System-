import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * An icon-only button whose label is both its accessible name and a hover
 * tooltip, so nobody has to guess what a pencil or bin does. When it is
 * disabled with a `disabledReason`, the tooltip explains why instead.
 */
export function IconButton({
    label,
    disabledReason,
    className,
    variant = 'ghost',
    disabled,
    ...props
}: Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
    label: string;
    disabledReason?: string;
}) {
    const button = (
        <Button
            variant={variant}
            size="icon"
            aria-label={label}
            className={cn('size-8', className)}
            disabled={disabled}
            {...props}
        />
    );

    // A disabled button gets no pointer events, so the tooltip hangs off a
    // focusable wrapper instead.
    if (disabled && disabledReason) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className="inline-flex"
                        tabIndex={0}
                        aria-label={`${label}: ${disabledReason}`}
                    >
                        {button}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
