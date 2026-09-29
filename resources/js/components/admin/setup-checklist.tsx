import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index as locationsIndex } from '@/routes/admin/locations';
import { index as roomsIndex, show as roomsShow } from '@/routes/admin/rooms';
import { edit as settingsEdit } from '@/routes/admin/settings';
import type { RoomSummary } from '@/types';

export type Checklist = {
    locations: number;
    rooms: number;
    roomsWithoutRates: RoomSummary[];
    roomsWithoutRatesCount: number;
    roomsWithoutExtensionRate: number;
    settingsReviewed: boolean;
};

type Step = {
    title: string;
    description: string;
    done: boolean;
    action: string;
    href: NonNullable<InertiaLinkProps['href']>;
};

function steps(checklist: Checklist): Step[] {
    const {
        locations,
        rooms,
        roomsWithoutRates,
        roomsWithoutRatesCount,
        roomsWithoutExtensionRate,
    } = checklist;

    const hasOrHave = (count: number) => (count === 1 ? 'has' : 'have');

    return [
        {
            title: 'Add a location',
            description: 'Guest Villa, Barracks or any other place with rooms.',
            done: locations > 0,
            action: 'Add location',
            href: locationsIndex({ query: { create: 1 } }),
        },
        {
            title: 'Add rooms',
            description: 'Name, pax capacity and description for each room.',
            done: rooms > 0,
            action: 'Add room',
            href: roomsIndex({ query: { create: 1 } }),
        },
        {
            title: 'Set room rates',
            description:
                rooms > 0 && roomsWithoutRatesCount > 0
                    ? `${plural(roomsWithoutRatesCount, 'room')} ${hasOrHave(roomsWithoutRatesCount)} no price yet.`
                    : 'Every room needs at least one price, e.g. per night.',
            done: rooms > 0 && roomsWithoutRatesCount === 0,
            action: 'Set rates',
            href:
                roomsWithoutRates.length > 0
                    ? roomsShow(roomsWithoutRates[0].id)
                    : roomsIndex(),
        },
        {
            title: 'Set extension rates',
            description:
                rooms > 0 && roomsWithoutExtensionRate > 0
                    ? `The price when a guest extends. ${plural(roomsWithoutExtensionRate, 'room')} ${hasOrHave(roomsWithoutExtensionRate)} none.`
                    : 'The price charged when a guest extends a stay.',
            done: rooms > 0 && roomsWithoutExtensionRate === 0,
            action: 'Set extension rates',
            href: roomsIndex({ query: { missing: 'extension' } }),
        },
        {
            title: 'Review system settings',
            description:
                'Cleaning buffer, no-show grace period and refund policy.',
            done: checklist.settingsReviewed,
            action: 'Review settings',
            href: settingsEdit(),
        },
    ];
}

/** Shown until the Admin has finished the one-time setup. */
export function SetupChecklist({ checklist }: { checklist: Checklist }) {
    const items = steps(checklist);
    const doneCount = items.filter((step) => step.done).length;
    const next = items.findIndex((step) => !step.done);

    if (next === -1) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <CardTitle>Finish setting up</CardTitle>
                    <CardDescription>
                        {doneCount} of {items.length} done
                    </CardDescription>
                </div>
                <div
                    role="progressbar"
                    aria-label="Setup progress"
                    aria-valuemin={0}
                    aria-valuemax={items.length}
                    aria-valuenow={doneCount}
                    className="h-1.5 overflow-hidden rounded-full bg-primary/15"
                >
                    <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{
                            width: `${(doneCount / items.length) * 100}%`,
                        }}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <ol className="divide-y">
                    {items.map((step, index) => (
                        <li
                            key={step.title}
                            className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                        >
                            <span
                                className={cn(
                                    'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                                    step.done &&
                                        'border-transparent bg-brand text-background',
                                    index === next &&
                                        'border-primary text-primary',
                                )}
                            >
                                {step.done ? (
                                    <Check className="size-4" />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p
                                    className={cn(
                                        'text-sm font-medium',
                                        step.done &&
                                            'text-muted-foreground line-through decoration-muted-foreground/50',
                                    )}
                                >
                                    {step.title}
                                </p>
                                {!step.done && (
                                    <p className="text-xs text-muted-foreground">
                                        {step.description}
                                    </p>
                                )}
                            </div>
                            {!step.done && (
                                <Button
                                    asChild
                                    size="sm"
                                    variant={
                                        index === next ? 'default' : 'outline'
                                    }
                                    className="shrink-0"
                                >
                                    <Link href={step.href}>
                                        {step.action}
                                        {index === next && <ArrowRight />}
                                    </Link>
                                </Button>
                            )}
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}
