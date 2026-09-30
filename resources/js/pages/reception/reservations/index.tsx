import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarCheck,
    ChevronRight,
    LogIn,
    Plus,
    Search,
} from 'lucide-react';
import { useRef, useState } from 'react';
import CheckInController from '@/actions/App/Http/Controllers/Reception/CheckInController';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { Pager } from '@/components/pager';
import {
    PaymentStatusBadge,
    ReservationStatusBadge,
} from '@/components/reception/badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDayTime, formatPeso, plural, todayIso } from '@/lib/format';
import {
    create as reservationsCreate,
    index as reservationsIndex,
    show as reservationsShow,
} from '@/routes/reception/reservations';
import type { Paginated, ReservationRow } from '@/types';

type Props = {
    reservations: Paginated<ReservationRow>;
    filters: { show: string; search: string };
    filterOptions: { value: string; label: string }[];
};

export default function Reservations({
    reservations,
    filters,
    filterOptions,
}: Props) {
    const [search, setSearch] = useState(filters.search);
    const today = todayIso();
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const visit = (params: { show?: string; search?: string }) =>
        router.get(
            reservationsIndex().url,
            {
                show: params.show ?? filters.show,
                search: (params.search ?? search) || undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    // Search as the user types, after a short pause.
    const changeSearch = (value: string) => {
        setSearch(value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => visit({ search: value }), 300);
    };

    const filtering = filters.search !== '' || filters.show !== 'upcoming';

    return (
        <>
            <Head title="Reservations" />
            <Page>
                <PageHeader
                    title="Reservations"
                    description="Bookings for the front desk. Open one to take a payment, cancel it or mark a no-show."
                    actions={
                        <Button asChild>
                            <Link href={reservationsCreate()}>
                                <Plus />
                                New reservation
                            </Link>
                        </Button>
                    }
                />

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            value={search}
                            onChange={(event) =>
                                changeSearch(event.target.value)
                            }
                            placeholder="Name, number, company or room"
                            aria-label="Search reservations"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={filters.show}
                        onValueChange={(show) => visit({ show })}
                    >
                        <SelectTrigger
                            className="w-full sm:w-48"
                            aria-label="Show"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {filterOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {filtering && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSearch('');
                                router.get(
                                    reservationsIndex().url,
                                    {},
                                    { preserveState: true, replace: true },
                                );
                            }}
                        >
                            Clear filters
                        </Button>
                    )}
                    <span className="ml-auto text-sm text-muted-foreground">
                        {plural(reservations.total, 'reservation')}
                    </span>
                </div>

                {reservations.data.length === 0 ? (
                    <EmptyState
                        icon={filtering ? Search : CalendarCheck}
                        title={
                            filtering
                                ? 'No reservations match'
                                : 'No upcoming reservations'
                        }
                        description={
                            filtering
                                ? 'Try another name or show all reservations.'
                                : 'Book a room for a guest who calls ahead or cannot check in yet.'
                        }
                        action={
                            <Button asChild>
                                <Link href={reservationsCreate()}>
                                    <Plus />
                                    New reservation
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <Card className="gap-0 overflow-hidden py-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">
                                        Arrival
                                    </TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        Rooms
                                    </TableHead>
                                    <TableHead className="hidden text-right sm:table-cell">
                                        Guests
                                    </TableHead>
                                    <TableHead className="hidden lg:table-cell">
                                        Payment
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-10">
                                        <span className="sr-only">Open</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reservations.data.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            router.visit(
                                                reservationsShow(row.id),
                                            )
                                        }
                                    >
                                        <TableCell className="pl-4">
                                            <div className="font-medium tabular-nums">
                                                {formatDayTime(row.starts_at)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                until{' '}
                                                {formatDayTime(row.ends_at)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={reservationsShow(row.id)}
                                                className="font-medium underline-offset-4 hover:underline"
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                {row.contact_name}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">
                                                {row.company ??
                                                    row.contact_number}
                                            </div>
                                            <div className="text-xs text-muted-foreground md:hidden">
                                                {row.rooms.join(', ')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <div>{row.rooms.join(', ')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {row.location}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                                            {row.pax}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="tabular-nums">
                                                    {formatPeso(row.total)}
                                                </span>
                                                <PaymentStatusBadge
                                                    status={row.payment_status}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <ReservationStatusBadge
                                                    status={row.status}
                                                    label={row.status_label}
                                                />
                                                {row.overdue && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                                        <AlertTriangle className="size-3.5" />
                                                        Not arrived
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="pr-4 text-right text-muted-foreground">
                                            {row.status === 'active' &&
                                            row.starts_at.slice(0, 10) <=
                                                today ? (
                                                <Button
                                                    size="sm"
                                                    asChild
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                >
                                                    <Link
                                                        href={CheckInController.create(
                                                            row.id,
                                                        )}
                                                    >
                                                        <LogIn />
                                                        Check in
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <ChevronRight className="ml-auto size-4" />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                <Pager page={reservations} />
            </Page>
        </>
    );
}

Reservations.layout = {
    breadcrumbs: [
        {
            title: 'Reservations',
            href: reservationsIndex(),
        },
    ],
};
