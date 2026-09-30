import { Head, Link, router } from '@inertiajs/react';
import { HandCoins } from 'lucide-react';
import { useState } from 'react';
import RefundController from '@/actions/App/Http/Controllers/Reception/RefundController';
import { ConfirmAction } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { Pager } from '@/components/pager';
import { RefundStatusBadge } from '@/components/reception/badges';
import { Button } from '@/components/ui/button';
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
import { formatDateTime, formatPeso, plural } from '@/lib/format';
import { index as refundsIndex } from '@/routes/reception/refunds';
import { show as reservationsShow } from '@/routes/reception/reservations';
import type { Paginated, RefundStatus } from '@/types';

type Refund = {
    id: number;
    reservation_id: number | null;
    guest: string | null;
    contact_number: string | null;
    amount: string;
    reason: string;
    status: RefundStatus;
    status_label: string;
    next_label: string | null;
    requested_by: string;
    requested_at: string;
    processed_by: string | null;
    processing_at: string | null;
    refunded_by: string | null;
    refunded_at: string | null;
};

type Props = {
    refunds: Paginated<Refund>;
    show: 'open' | 'refunded' | 'all';
    openTotal: string;
    openCount: number;
};

const views = [
    { value: 'open', label: 'To process' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'all', label: 'All' },
];

export default function Refunds({
    refunds,
    show,
    openTotal,
    openCount,
}: Props) {
    const [advancing, setAdvancing] = useState<Refund | null>(null);

    return (
        <>
            <Head title="Refunds" />
            <Page>
                <PageHeader
                    title="Refunds"
                    description={
                        openCount > 0
                            ? `${formatPeso(openTotal)} to give back across ${plural(openCount, 'refund')}. Each goes Requested → Processing → Refunded.`
                            : 'Money owed back after cancellations and no-shows. Nothing to process right now.'
                    }
                />

                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={show}
                    onValueChange={(value) =>
                        value &&
                        router.get(
                            refundsIndex().url,
                            value === 'open' ? {} : { show: value },
                            { preserveState: true, replace: true },
                        )
                    }
                    className="w-fit"
                >
                    {views.map((view) => (
                        <ToggleGroupItem
                            key={view.value}
                            value={view.value}
                            className="px-4"
                        >
                            {view.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>

                {refunds.data.length === 0 ? (
                    <EmptyState
                        icon={HandCoins}
                        title={
                            show === 'open'
                                ? 'No refunds to process'
                                : 'No refunds yet'
                        }
                        description="Cancelling a paid reservation, or marking a paid one as a no-show, requests a refund here."
                    />
                ) : (
                    <Card className="gap-0 overflow-hidden py-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">
                                        Guest
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Amount
                                    </TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        Reason
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden lg:table-cell">
                                        History
                                    </TableHead>
                                    <TableHead className="pr-4 text-right">
                                        <span className="sr-only">
                                            Next step
                                        </span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {refunds.data.map((refund) => (
                                    <TableRow key={refund.id}>
                                        <TableCell className="pl-4">
                                            {refund.reservation_id ? (
                                                <Link
                                                    href={reservationsShow(
                                                        refund.reservation_id,
                                                    )}
                                                    className="font-medium underline-offset-4 hover:underline"
                                                >
                                                    {refund.guest}
                                                </Link>
                                            ) : (
                                                <span className="font-medium">
                                                    {refund.guest ?? '—'}
                                                </span>
                                            )}
                                            <div className="text-xs text-muted-foreground">
                                                {refund.contact_number}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatPeso(refund.amount)}
                                        </TableCell>
                                        <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">
                                            {refund.reason}
                                        </TableCell>
                                        <TableCell>
                                            <RefundStatusBadge
                                                status={refund.status}
                                                label={refund.status_label}
                                            />
                                        </TableCell>
                                        <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                                            <div>
                                                Requested by{' '}
                                                {refund.requested_by},{' '}
                                                {formatDateTime(
                                                    refund.requested_at,
                                                )}
                                            </div>
                                            {refund.processing_at && (
                                                <div>
                                                    Processing by{' '}
                                                    {refund.processed_by},{' '}
                                                    {formatDateTime(
                                                        refund.processing_at,
                                                    )}
                                                </div>
                                            )}
                                            {refund.refunded_at && (
                                                <div>
                                                    Refunded by{' '}
                                                    {refund.refunded_by},{' '}
                                                    {formatDateTime(
                                                        refund.refunded_at,
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-4 text-right">
                                            {refund.next_label && (
                                                <Button
                                                    size="sm"
                                                    variant={
                                                        refund.status ===
                                                        'processing'
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    onClick={() =>
                                                        setAdvancing(refund)
                                                    }
                                                >
                                                    {refund.status ===
                                                    'requested'
                                                        ? 'Start processing'
                                                        : 'Mark refunded'}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                <Pager page={refunds} />
            </Page>

            {advancing && (
                <ConfirmAction
                    open
                    onOpenChange={(open) => !open && setAdvancing(null)}
                    title={
                        advancing.status === 'requested'
                            ? `Start processing ${formatPeso(advancing.amount)}?`
                            : `Mark ${formatPeso(advancing.amount)} as refunded?`
                    }
                    description={
                        advancing.status === 'requested'
                            ? `Records that you are now handling the refund to ${advancing.guest}.`
                            : `Only once ${advancing.guest} has the money back. This cannot be undone.`
                    }
                    url={RefundController.advance.url(advancing.id)}
                    method="patch"
                    confirmLabel={
                        advancing.status === 'requested'
                            ? 'Start processing'
                            : 'Mark refunded'
                    }
                />
            )}
        </>
    );
}

Refunds.layout = {
    breadcrumbs: [
        {
            title: 'Refunds',
            href: refundsIndex(),
        },
    ],
};
