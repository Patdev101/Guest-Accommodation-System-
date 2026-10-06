import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { formatPeso } from '@/lib/format';

export type TrendData = {
    months: {
        month: string;
        income: number;
        occupancy: number;
        cancelled: number;
        no_shows: number;
    }[];
    companies: { company: string; amount: number }[];
};

/** A row of the table with a plain bar, so the numbers can be compared at a glance. */
function Bar({ share, label }: { share: number; label: string }) {
    return (
        <span className="flex items-center gap-2">
            <span
                aria-hidden
                className="h-2 min-w-0.5 rounded-full bg-primary"
                style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
            />
            <span className="shrink-0 tabular-nums">{label}</span>
        </span>
    );
}

/** The last six months: income, occupancy, cancellations and no-shows, and the top companies. */
export function Trends({ trends }: { trends: TrendData }) {
    const topIncome = Math.max(1, ...trends.months.map((row) => row.income));
    const topCompany = Math.max(
        1,
        ...trends.companies.map((row) => row.amount),
    );

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
                <CardHeader>
                    <CardTitle>Last six months</CardTitle>
                    <CardDescription>
                        Income is payments received less refunds. Occupancy is
                        the share of room-nights that had guests.
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                                <th className="pb-2 font-medium">Month</th>
                                <th className="w-2/5 pb-2 font-medium">
                                    Income
                                </th>
                                <th className="w-1/4 pb-2 font-medium">
                                    Occupancy
                                </th>
                                <th className="pb-2 text-right font-medium">
                                    Cancelled
                                </th>
                                <th className="pb-2 text-right font-medium">
                                    No-shows
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {trends.months.map((row) => (
                                <tr key={row.month} className="border-t">
                                    <td className="py-2 pr-3 whitespace-nowrap">
                                        {row.month}
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Bar
                                            share={
                                                (row.income / topIncome) * 70
                                            }
                                            label={formatPeso(row.income)}
                                        />
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Bar
                                            share={row.occupancy * 0.7}
                                            label={`${row.occupancy}%`}
                                        />
                                    </td>
                                    <td className="py-2 text-right tabular-nums">
                                        {row.cancelled}
                                    </td>
                                    <td className="py-2 text-right tabular-nums">
                                        {row.no_shows}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Top companies</CardTitle>
                    <CardDescription>
                        By the amount charged to their stays in the last six
                        months.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {trends.companies.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No stays have been billed yet.
                        </p>
                    ) : (
                        <ul className="space-y-3 text-sm">
                            {trends.companies.map((row) => (
                                <li key={row.company} className="grid gap-1">
                                    <span className="truncate font-medium">
                                        {row.company}
                                    </span>
                                    <Bar
                                        share={(row.amount / topCompany) * 70}
                                        label={formatPeso(row.amount)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
