import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, History, Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { index as activityIndex } from '@/routes/admin/activity';

type Entry = {
    id: number;
    when: string;
    who: string | null;
    action: 'created' | 'updated' | 'deleted';
    type: string;
    description: string;
    changes: Record<string, [unknown, unknown]> | null;
    ip_address: string | null;
};

type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type Filters = {
    user: number | null;
    type: string | null;
    search: string;
    from: string;
    to: string;
};

type Props = {
    entries: Paginated<Entry>;
    filters: Filters;
    users: { id: number; name: string }[];
    types: { value: string; label: string }[];
};

const ALL = 'all';

const actionLabel: Record<Entry['action'], string> = {
    created: 'Added',
    updated: 'Changed',
    deleted: 'Deleted',
};

const when = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

/** "under_maintenance" → "under maintenance", booleans → Yes/No, empty → —. */
function show(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    const text =
        typeof value === 'object'
            ? JSON.stringify(value)
            : String(value as string | number);

    return text.replaceAll('_', ' ');
}

function field(name: string): string {
    const words = name.replace(/_id$/, '').replaceAll('_', ' ');

    return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function ActivityLog({ entries, filters, users, types }: Props) {
    const [search, setSearch] = useState(filters.search);

    const apply = (changes: Partial<Filters>) =>
        router.get(
            activityIndex.url(),
            Object.fromEntries(
                Object.entries({ ...filters, search, ...changes }).filter(
                    ([, value]) => value !== null && value !== '',
                ),
            ),
            { preserveState: true, preserveScroll: true, replace: true },
        );

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        apply({ search });
    };

    const filtering =
        filters.user !== null ||
        filters.type !== null ||
        filters.search !== '' ||
        filters.from !== '' ||
        filters.to !== '';

    return (
        <>
            <Head title="Activity log" />
            <Page>
                <PageHeader
                    title="Activity log"
                    description="Every change made in the admin screens: who did it, when, and what changed."
                />

                <div className="flex flex-wrap items-end gap-2">
                    <form
                        onSubmit={submitSearch}
                        className="grid w-full gap-1 sm:w-64"
                    >
                        <Label htmlFor="activity-search" className="text-xs">
                            Search
                        </Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="activity-search"
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="e.g. A-104 or Overnight"
                                className="pl-9"
                            />
                        </div>
                    </form>
                    <div className="grid gap-1">
                        <Label className="text-xs">Who</Label>
                        <Select
                            value={filters.user ? String(filters.user) : ALL}
                            onValueChange={(value) =>
                                apply({
                                    user: value === ALL ? null : Number(value),
                                })
                            }
                        >
                            <SelectTrigger className="w-44" aria-label="Who">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Everyone</SelectItem>
                                {users.map((user) => (
                                    <SelectItem
                                        key={user.id}
                                        value={String(user.id)}
                                    >
                                        {user.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs">What</Label>
                        <Select
                            value={filters.type ?? ALL}
                            onValueChange={(value) =>
                                apply({ type: value === ALL ? null : value })
                            }
                        >
                            <SelectTrigger className="w-40" aria-label="What">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Everything</SelectItem>
                                {types.map((type) => (
                                    <SelectItem
                                        key={type.value}
                                        value={type.value}
                                    >
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1">
                        <Label htmlFor="activity-from" className="text-xs">
                            From
                        </Label>
                        <Input
                            id="activity-from"
                            type="date"
                            value={filters.from}
                            onChange={(event) =>
                                apply({ from: event.target.value })
                            }
                            className="w-40"
                        />
                    </div>
                    <div className="grid gap-1">
                        <Label htmlFor="activity-to" className="text-xs">
                            To
                        </Label>
                        <Input
                            id="activity-to"
                            type="date"
                            value={filters.to}
                            onChange={(event) =>
                                apply({ to: event.target.value })
                            }
                            className="w-40"
                        />
                    </div>
                    {filtering && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setSearch('');
                                router.get(
                                    activityIndex.url(),
                                    {},
                                    { preserveScroll: true, replace: true },
                                );
                            }}
                        >
                            Clear filters
                        </Button>
                    )}
                </div>

                {entries.data.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title={
                            filtering
                                ? 'Nothing matches these filters'
                                : 'No activity yet'
                        }
                        description={
                            filtering
                                ? 'Try another person, type or date range.'
                                : 'Changes to rooms, rates, settings and accounts will appear here.'
                        }
                    />
                ) : (
                    <Card className="gap-0 py-0">
                        <ol className="divide-y">
                            {entries.data.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="grid gap-2 px-4 py-3 sm:grid-cols-[11rem_1fr]"
                                >
                                    <div className="text-sm">
                                        <p className="font-medium">
                                            {entry.who ?? 'System'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {when.format(
                                                new Date(
                                                    entry.when.replace(
                                                        ' ',
                                                        'T',
                                                    ),
                                                ),
                                            )}
                                        </p>
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant={
                                                    entry.action === 'deleted'
                                                        ? 'destructive'
                                                        : 'secondary'
                                                }
                                            >
                                                {actionLabel[entry.action]}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {entry.type}
                                            </span>
                                        </div>
                                        <p className="text-sm">
                                            {entry.description}
                                        </p>
                                        {entry.changes && (
                                            <dl className="grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
                                                {Object.entries(
                                                    entry.changes,
                                                ).map(
                                                    ([
                                                        name,
                                                        [before, after],
                                                    ]) => (
                                                        <div
                                                            key={name}
                                                            className="contents"
                                                        >
                                                            <dt className="text-muted-foreground">
                                                                {field(name)}
                                                            </dt>
                                                            <dd>
                                                                <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                                                                    {show(
                                                                        before,
                                                                    )}
                                                                </span>{' '}
                                                                →{' '}
                                                                <span className="font-medium">
                                                                    {show(
                                                                        after,
                                                                    )}
                                                                </span>
                                                            </dd>
                                                        </div>
                                                    ),
                                                )}
                                            </dl>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </Card>
                )}

                {entries.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                            Showing {entries.from}–{entries.to} of{' '}
                            {entries.total}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                                disabled={!entries.prev_page_url}
                            >
                                {entries.prev_page_url ? (
                                    <Link
                                        href={entries.prev_page_url}
                                        preserveScroll
                                    >
                                        <ChevronLeft />
                                        Newer
                                    </Link>
                                ) : (
                                    <span
                                        aria-disabled
                                        className="pointer-events-none opacity-50"
                                    >
                                        <ChevronLeft />
                                        Newer
                                    </span>
                                )}
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                {entries.next_page_url ? (
                                    <Link
                                        href={entries.next_page_url}
                                        preserveScroll
                                    >
                                        Older
                                        <ChevronRight />
                                    </Link>
                                ) : (
                                    <span
                                        aria-disabled
                                        className="pointer-events-none opacity-50"
                                    >
                                        Older
                                        <ChevronRight />
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </Page>
        </>
    );
}

ActivityLog.layout = {
    breadcrumbs: [
        {
            title: 'Activity log',
            href: activityIndex(),
        },
    ],
};
