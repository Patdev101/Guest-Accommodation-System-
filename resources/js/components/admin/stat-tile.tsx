import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

/**
 * A headline number: label, value and one line of context. Values use
 * proportional figures (no tabular-nums) at this size.
 */
export function StatTile({
    label,
    value,
    detail,
    marker,
}: {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    marker?: ReactNode;
}) {
    return (
        <Card className="gap-1 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {marker}
                <span>{label}</span>
            </div>
            <div className="text-3xl font-semibold tracking-tight">{value}</div>
            {detail && (
                <p className="text-xs text-muted-foreground">{detail}</p>
            )}
        </Card>
    );
}
