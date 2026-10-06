import { Head, Link, router } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import { StatTile } from '@/components/admin/stat-tile';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { BillButton, IdPhotoButton } from '@/components/reception/viewers';
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
import { formatDayTime, formatPeso, plural } from '@/lib/format';
import { pending } from '@/routes/reception';
import { show as staysShow } from '@/routes/reception/stays';
import type { StayRow } from '@/types';

type Row = StayRow & {
    owes: number;
    id_held: boolean;
    id_type: string | null;
    id_number: string | null;
    photo_url: string | null;
};

type Props = {
    rows: Row[];
    show: string;
    filterOptions: { value: string; label: string }[];
    totals: { owed: number; unpaid: number; ids_held: number };
};

export default function Pending({ rows, show, filterOptions, totals }: Props) {
    return (
        <>
            <Head title="Unpaid bills and held IDs" />
            <Page>
                <PageHeader
                    title="Unpaid bills and held IDs"
                    description="Stays that still owe money, and the IDs kept at the desk. An ID goes back only when the bill is fully paid."
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatTile
                        label="Still to collect"
                        value={formatPeso(totals.owed)}
                        detail={`from ${plural(totals.unpaid, 'stay')}`}
                    />
                    <StatTile
                        label="Unpaid stays"
                        value={totals.unpaid}
                        detail="Open one to record a payment"
                    />
                    <StatTile
                        label="IDs held"
                        value={totals.ids_held}
                        detail="Kept until the bill is paid"
                    />
                </div>

                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={show}
                    onValueChange={(value) =>
                        value &&
                        router.get(
                            pending().url,
                            value === 'checked_out' ? {} : { show: value },
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

                {rows.length === 0 ? (
                    <EmptyState
                        icon={CheckCircle2}
                        title="Nothing is pending"
                        description="Every bill here is paid and every ID has been returned."
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
                                    <TableHead className="hidden sm:table-cell">
                                        Check-out
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Still to pay
                                    </TableHead>
                                    <TableHead>ID held</TableHead>
                                    <TableHead className="pr-4 text-right">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            router.visit(staysShow(row.id))
                                        }
                                    >
                                        <TableCell className="pl-4">
                                            <Link
                                                href={staysShow(row.id)}
                                                className="font-medium underline-offset-4 hover:underline"
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                {row.contact_name}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">
                                                {row.company ?? 'No company'} ·{' '}
                                                {row.contact_number}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {row.rooms.join(', ')}
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="tabular-nums">
                                                {formatDayTime(
                                                    row.checked_out_at ??
                                                        row.expected_check_out_at,
                                                )}
                                            </div>
                                            {!row.checked_out_at && (
                                                <span className="text-xs text-muted-foreground">
                                                    Still in house
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {row.owes > 0
                                                ? formatPeso(row.owes)
                                                : 'Paid'}
                                        </TableCell>
                                        <TableCell>
                                            {row.id_held ? (
                                                <>
                                                    <div>{row.id_type}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.id_number} ·{' '}
                                                        {row.id_status}
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {row.id_status ?? 'No ID'}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-4">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {row.photo_url && (
                                                    <IdPhotoButton
                                                        url={row.photo_url}
                                                        guest={row.contact_name}
                                                    />
                                                )}
                                                <BillButton
                                                    stayId={row.id}
                                                    guest={row.contact_name}
                                                    size="sm"
                                                    label="Bill"
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}
            </Page>
        </>
    );
}

Pending.layout = {
    breadcrumbs: [{ title: 'Unpaid bills and held IDs', href: pending() }],
};
