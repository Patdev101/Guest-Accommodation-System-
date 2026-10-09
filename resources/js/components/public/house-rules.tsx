import { usePage } from '@inertiajs/react';
import {
    Building2,
    CalendarX,
    Clock,
    HandCoins,
    IdCard,
    ShieldCheck,
} from 'lucide-react';
import { formatClock, formatMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * What a guest should know before booking. The times come from the Admin's
 * system settings, so this never disagrees with what the front desk does.
 */
export function HouseRules({
    compact = false,
    className,
}: {
    /** A plain list for a side panel, instead of the grid of cards. */
    compact?: boolean;
    className?: string;
}) {
    const { site } = usePage().props;

    const rules = [
        {
            icon: Clock,
            title: 'Check-in and check-out',
            text: `Check-in is from ${formatClock(site.check_in)} and check-out is by ${formatClock(site.check_out)}.`,
        },
        {
            icon: ShieldCheck,
            title: 'We confirm every booking',
            text: `A request holds the room for up to ${site.hold_hours} hours while our front desk answers it.`,
        },
        {
            icon: IdCard,
            title: 'Bring one valid ID',
            text: 'We keep it at the desk during your stay and return it when the bill is fully paid.',
        },
        {
            icon: Building2,
            title: 'Bookings are for a company',
            text: 'Tell us the company you are visiting or working with when you book.',
        },
        {
            icon: CalendarX,
            title: 'If you do not arrive',
            text:
                site.grace_minutes > 0
                    ? `We hold your room for ${formatMinutes(site.grace_minutes)} after your arrival time. After that it may be released.`
                    : 'Your room may be released once your arrival time has passed.',
        },
        {
            icon: HandCoins,
            title: 'Paying and cancelling',
            text: 'You pay at the front desk, not online. You can cancel any time; money already paid is refunded by the front desk.',
        },
    ];

    if (compact) {
        return (
            <ul className={cn('space-y-3 text-sm', className)}>
                {rules.map((rule) => (
                    <li key={rule.title} className="flex items-start gap-2.5">
                        <rule.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>
                            <b className="font-medium">{rule.title}.</b>{' '}
                            <span className="text-muted-foreground">
                                {rule.text}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <ul
            className={cn(
                'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
                className,
            )}
        >
            {rules.map((rule) => (
                <li
                    key={rule.title}
                    className="flex items-start gap-3 rounded-xl border bg-card p-4"
                >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <rule.icon className="size-4" />
                    </span>
                    <span>
                        <span className="block font-semibold">
                            {rule.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                            {rule.text}
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** How to reach the front desk; nothing is shown until the Admin fills it in. */
export function ContactLine({ className }: { className?: string }) {
    const { site } = usePage().props;

    if (!site.phone && !site.email) {
        return null;
    }

    return (
        <p className={cn('text-sm text-muted-foreground', className)}>
            Questions? Reach our front desk
            {site.phone && (
                <>
                    {' '}
                    at{' '}
                    <a
                        href={`tel:${site.phone.replace(/[^0-9+]/g, '')}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                        {site.phone}
                    </a>
                </>
            )}
            {site.email && (
                <>
                    {site.phone ? ' or ' : ' at '}
                    <a
                        href={`mailto:${site.email}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                        {site.email}
                    </a>
                </>
            )}
            .
        </p>
    );
}
