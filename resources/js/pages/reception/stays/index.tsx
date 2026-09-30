import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, BedDouble, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { Pager } from '@/components/pager';
import { StayStateBadge } from '@/components/reception/badges';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDayTime, formatPeso } from '@/lib/format';
import {
    index as staysIndex,
    show as staysShow,
} from '@/routes/reception/stays';
import type { Paginated, StayRow } from '@/types';

type Props = {
    stays: Paginated<StayRow>;
    show: string;
    filterOptions: { value: string; label: string }[];
};

export default function Stays({ stays, show, filterOptions }: Props) {
    return (
        <>
            <Head title="In house" />
            <Page>
                <PageHeader
                    title="In house"
                    description="Checked-in bookings. Open one to extend, check out, inspect the rooms, settle the bill and return the ID."
                />

                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={show}
                    onValueChange={(value) =>
                        value &&
                        router.get(
                            staysIndex().url,
                            value === 'in_house' ? {} : { show: value },
                            { preserveState: true, replace: true },
                        )
                    }
                    className="w-fit flex-wrap"
                >
                    {filterOptions.map((option) => (
                        <ToggleGroupItem
                            key={option.value}
                            value={option.value}
                            className="px-4"
                        >
                            {option.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>

                {stays.data.length === 0 ? (
                    <EmptyState
                        icon={BedDouble}
                        title={
                            show === 'in_house'
                                ? 'Nobody is checked in'
                                : 'Nothing here'
                        }
                        description="Checked-in bookings appear here. Check guests in from their reservation."
                    />
                ) : (
                    <Card className="gap-0 overflow-hidden py-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">
                                        Guests
                                    </TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        Rooms
                                    </TableHead>
                                    <TableHead>Check-out</TableHead>
                                    <TableHead className="hidden text-right sm:table-cell">
                                        Balance
                                    </TableHead>
                                    <TableHead className="hidden lg:table-cell">
                                        ID
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-10">
                                        <span className="sr-only">Open</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stays.data.map((stay) => (
                                    <TableRow
                                        key={stay.id}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            router.visit(staysShow(stay.id))
                                        }
                                    >
                                        <TableCell className="pl-4">
                                            <Link
                                                href={staysShow(stay.id)}
                                                className="font-medium underline-offset-4 hover:underline"
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                {stay.contact_name}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">
                                                {stay.company ??
                                                    stay.contact_number}{' '}
                                                · {stay.pax} guests
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {stay.rooms.join(', ')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="tabular-nums">
                                                {formatDayTime(
                                                    stay.checked_out_at ??
                                                        stay.expected_check_out_at,
                                                )}
                                            </div>
                                            {stay.overdue && (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                                                    <AlertTriangle className="size-3.5" />
                                                    Past check-out time
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                                            {Number(stay.balance) > 0
                                                ? formatPeso(stay.balance)
                                                : 'Paid'}
                                        </TableCell>
                                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                                            {stay.id_status ?? '—'}
                                        </TableCell>
                                        <TableCell>
                                            <StayStateBadge
                                                state={stay.state}
                                            />
                                        </TableCell>
                                        <TableCell className="pr-4 text-muted-foreground">
                                            <ChevronRight className="size-4" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                <Pager page={stays} />
            </Page>
        </>
    );
}

Stays.layout = {
    breadcrumbs: [{ title: 'In house', href: staysIndex() }],
};
