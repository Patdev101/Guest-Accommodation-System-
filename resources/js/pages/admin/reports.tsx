import { Head, router } from '@inertiajs/react';
import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { StatTile } from '@/components/admin/stat-tile';
import { FormField } from '@/components/form-field';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDate, formatDateTime, formatPeso, plural } from '@/lib/format';
import { index as reportsIndex } from '@/routes/admin/reports';

type Props = {
    from: string;
    to: string;
    guestLog: {
        stay_id: number;
        guest: string;
        company: string | null;
        contact_number: string;
        rooms: string;
        pax: number;
        checked_in_at: string;
        checked_out_at: string | null;
        expected_check_out_at: string;
        id_type: string | null;
        id_status: string | null;
    }[];
    idsHeld: {
        stay_id: number;
        guest: string;
        company: string | null;
        rooms: string;
        id_type: string;
        status: string;
        received_by: string;
        since: string;
        checked_out: boolean;
    }[];
    unpaid: {
        company: string;
        stays: number;
        balance: number;
        oldest: string;
    }[];
    occupancy: {
        rooms: number;
        nights_available: number;
        nights_used: number;
        percent: number;
        locations: {
            location: string;
            rooms: number;
            nights_used: number;
            percent: number;
        }[];
    };
    income: {
        received: number;
        refunded: number;
        net: number;
        payments: number;
        charged: number;
        by_method: { method: string; count: number; amount: number }[];
        by_type: { type: string; amount: number }[];
    };
};

type Export = 'guest_log' | 'ids_held' | 'unpaid' | 'income';

export default function Reports({
    from,
    to,
    guestLog,
    idsHeld,
    unpaid,
    occupancy,
    income,
}: Props) {
    const [range, setRange] = useState({ from, to });
    const period = `${formatDate(from)} to ${formatDate(to)}`;
    const owed = unpaid.reduce((sum, row) => sum + row.balance, 0);

    const exportUrl = (report: Export) =>
        reportsIndex({ query: { from, to, export: report } }).url;

    return (
        <>
            <Head title="Reports" />
            <Page>
                <PageHeader
                    title="Reports"
                    description={`Figures for ${period}. Held IDs and unpaid bills show everything that is open now.`}
                    actions={
                        <Button
                            variant="outline"
                            className="print:hidden"
                            onClick={() => window.print()}
                        >
                            <Printer />
                            Print
                        </Button>
                    }
                />

                <form
                    className="flex flex-wrap items-end gap-3 print:hidden"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.get(reportsIndex().url, range, {
                            preserveScroll: true,
                        });
                    }}
                >
                    <FormField label="From" htmlFor="report_from">
                        <Input
                            id="report_from"
                            type="date"
                            value={range.from}
                            max={range.to}
                            onChange={(event) =>
                                setRange({ ...range, from: event.target.value })
                            }
                            required
                        />
                    </FormField>
                    <FormField label="To" htmlFor="report_to">
                        <Input
                            id="report_to"
                            type="date"
                            value={range.to}
                            min={range.from}
                            onChange={(event) =>
                                setRange({ ...range, to: event.target.value })
                            }
                            required
                        />
                    </FormField>
                    <Button type="submit">Show</Button>
                </form>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        label="Net income"
                        value={formatPeso(income.net)}
                        detail={`${formatPeso(income.received)} received, ${formatPeso(income.refunded)} refunded`}
                    />
                    <StatTile
                        label="Occupancy"
                        value={`${occupancy.percent}%`}
                        detail={`${occupancy.nights_used} of ${occupancy.nights_available} room-nights used`}
                    />
                    <StatTile
                        label="Stays in the period"
                        value={guestLog.length}
                        detail={`${plural(
                            guestLog.reduce((sum, row) => sum + row.pax, 0),
                            'guest',
                        )} in total`}
                    />
                    <StatTile
                        label="Unpaid bills now"
                        value={formatPeso(owed)}
                        detail={`${plural(unpaid.length, 'company', 'companies')} · ${plural(idsHeld.length, 'ID')} held`}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Report
                        title="Income"
                        description="Payments received in the period, by method."
                        exportUrl={exportUrl('income')}
                        empty={
                            income.by_method.length === 0
                                ? 'No payments in this period.'
                                : null
                        }
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Method</TableHead>
                                    <TableHead className="text-right">
                                        Payments
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Amount
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {income.by_method.map((row) => (
                                    <TableRow key={row.method}>
                                        <TableCell>{row.method}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {row.count}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatPeso(row.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-medium">
                                    <TableCell>
                                        Net (after {formatPeso(income.refunded)}{' '}
                                        refunded)
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {income.payments}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatPeso(income.net)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        {income.by_type.length > 0 && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Charged in the period:{' '}
                                {income.by_type
                                    .map(
                                        (row) =>
                                            `${row.type} ${formatPeso(row.amount)}`,
                                    )
                                    .join(' · ')}
                            </p>
                        )}
                    </Report>

                    <Report
                        title="Occupancy"
                        description="Share of room-nights that had guests, by location."
                        empty={
                            occupancy.rooms === 0
                                ? 'No rooms set up yet.'
                                : null
                        }
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="text-right">
                                        Rooms
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Nights used
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Occupancy
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {occupancy.locations.map((row) => (
                                    <TableRow key={row.location}>
                                        <TableCell>{row.location}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {row.rooms}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {row.nights_used}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {row.percent}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-medium">
                                    <TableCell>All locations</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {occupancy.rooms}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {occupancy.nights_used}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {occupancy.percent}%
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </Report>
                </div>

                <Report
                    title="Unpaid bills by company"
                    description="Stays that still owe money, whatever the date."
                    exportUrl={exportUrl('unpaid')}
                    empty={unpaid.length === 0 ? 'Every bill is paid.' : null}
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead className="text-right">
                                    Stays
                                </TableHead>
                                <TableHead>Oldest stay</TableHead>
                                <TableHead className="text-right">
                                    Balance
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {unpaid.map((row) => (
                                <TableRow key={row.company}>
                                    <TableCell className="font-medium">
                                        {row.company}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {row.stays}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(row.oldest)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {formatPeso(row.balance)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Report>

                <Report
                    title="IDs held"
                    description="IDs reception is holding right now."
                    exportUrl={exportUrl('ids_held')}
                    empty={idsHeld.length === 0 ? 'No IDs are held.' : null}
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Guest</TableHead>
                                <TableHead>Rooms</TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Held since</TableHead>
                                <TableHead>Received by</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {idsHeld.map((row) => (
                                <TableRow key={row.stay_id}>
                                    <TableCell>
                                        <span className="font-medium">
                                            {row.guest}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {row.company ?? '—'}
                                        </span>
                                    </TableCell>
                                    <TableCell>{row.rooms}</TableCell>
                                    <TableCell>{row.id_type}</TableCell>
                                    <TableCell>
                                        {row.status}
                                        {row.checked_out && (
                                            <span className="block text-xs text-muted-foreground">
                                                guest has checked out
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(row.since)}
                                    </TableCell>
                                    <TableCell>{row.received_by}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Report>

                <Report
                    title="Guest log"
                    description={`Everyone who stayed during ${period}.`}
                    exportUrl={exportUrl('guest_log')}
                    empty={
                        guestLog.length === 0
                            ? 'No stays in this period.'
                            : null
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Guest</TableHead>
                                <TableHead>Rooms</TableHead>
                                <TableHead className="text-right">
                                    Guests
                                </TableHead>
                                <TableHead>Checked in</TableHead>
                                <TableHead>Checked out</TableHead>
                                <TableHead>ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {guestLog.map((row) => (
                                <TableRow key={row.stay_id}>
                                    <TableCell>
                                        <span className="font-medium">
                                            {row.guest}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            {row.company ?? '—'} ·{' '}
                                            {row.contact_number}
                                        </span>
                                    </TableCell>
                                    <TableCell>{row.rooms}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {row.pax}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(row.checked_in_at)}
                                    </TableCell>
                                    <TableCell>
                                        {row.checked_out_at
                                            ? formatDateTime(row.checked_out_at)
                                            : `In house, due ${formatDateTime(row.expected_check_out_at)}`}
                                    </TableCell>
                                    <TableCell>
                                        {row.id_type
                                            ? `${row.id_type} (${row.id_status})`
                                            : '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Report>
            </Page>
        </>
    );
}

/** One report: a card with its export button at the top right. */
function Report({
    title,
    description,
    exportUrl,
    empty,
    children,
}: {
    title: string;
    description: string;
    exportUrl?: string;
    empty: string | null;
    children: ReactNode;
}) {
    return (
        <Card className="break-inside-avoid">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                {exportUrl && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="print:hidden"
                        asChild
                    >
                        {/* A file download, so a plain link and not an in-app visit. */}
                        <a href={exportUrl}>
                            <Download />
                            Export CSV
                        </a>
                    </Button>
                )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
                {empty ? (
                    <p className="text-sm text-muted-foreground">{empty}</p>
                ) : (
                    children
                )}
            </CardContent>
        </Card>
    );
}

Reports.layout = {
    breadcrumbs: [{ title: 'Reports', href: reportsIndex() }],
};
