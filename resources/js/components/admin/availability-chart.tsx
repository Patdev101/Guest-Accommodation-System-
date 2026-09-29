import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { StatusDot } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { percent, plural } from '@/lib/format';
import { groupColor } from '@/lib/room-status';
import { cn } from '@/lib/utils';
import type { RoomStatus, RoomStatusGroup } from '@/types';

export type GroupCount = {
    value: RoomStatusGroup;
    label: string;
    description: string;
    count: number;
};

export type StatusCount = {
    value: RoomStatus;
    label: string;
    group: RoomStatusGroup;
    count: number;
};

/**
 * Part-to-whole of room status groups: one thin stacked bar (2px surface gaps,
 * rounded outer ends), a legend that carries every value, and a table view
 * with the individual statuses.
 */
export function AvailabilityChart({
    groups,
    breakdown,
}: {
    groups: GroupCount[];
    breakdown: StatusCount[];
}) {
    const [showTable, setShowTable] = useState(false);
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    const segments = groups.filter((group) => group.count > 0);

    return (
        <figure className="space-y-5">
            <div
                role="group"
                aria-label="Rooms by status group"
                className="flex h-5 w-full gap-0.5"
            >
                {segments.map((group, index) => (
                    <Tooltip key={group.value}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={`${group.label}: ${plural(group.count, 'room')}, ${percent(group.count, total)}`}
                                className={cn(
                                    'h-full min-w-1.5 transition-opacity outline-none hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                    index === 0 && 'rounded-l-[4px]',
                                    index === segments.length - 1 &&
                                        'rounded-r-[4px]',
                                )}
                                style={{
                                    flex: `${group.count} 1 0%`,
                                    backgroundColor: groupColor[group.value],
                                }}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <span className="font-semibold">
                                {plural(group.count, 'room')}
                            </span>{' '}
                            · {group.label} · {percent(group.count, total)}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>

            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {groups.map((group) => (
                    <li key={group.value} className="flex gap-2.5">
                        <span
                            aria-hidden
                            className="mt-1 size-3 shrink-0 rounded-[3px]"
                            style={{ backgroundColor: groupColor[group.value] }}
                        />
                        <div className="min-w-0">
                            <p className="text-sm">
                                <span className="font-medium">
                                    {group.label}
                                </span>{' '}
                                <span className="font-semibold">
                                    {group.count}
                                </span>{' '}
                                <span className="text-muted-foreground">
                                    ({percent(group.count, total)})
                                </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {group.description}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>

            <div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 text-muted-foreground"
                    aria-expanded={showTable}
                    onClick={() => setShowTable((shown) => !shown)}
                >
                    <ChevronDown
                        className={cn(
                            'transition-transform',
                            showTable && 'rotate-180',
                        )}
                    />
                    {showTable ? 'Hide' : 'Show'} every status
                </Button>

                {showTable && (
                    <Table className="mt-2">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Status</TableHead>
                                <TableHead>Group</TableHead>
                                <TableHead className="text-right">
                                    Rooms
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {breakdown.map((status) => (
                                <TableRow key={status.value}>
                                    <TableCell>
                                        <span className="flex items-center gap-2">
                                            <StatusDot group={status.group} />
                                            {status.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {
                                            groups.find(
                                                (group) =>
                                                    group.value ===
                                                    status.group,
                                            )?.label
                                        }
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {status.count}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </figure>
    );
}
