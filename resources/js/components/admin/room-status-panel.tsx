import { Form } from '@inertiajs/react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import RoomStatusController from '@/actions/App/Http/Controllers/Admin/RoomStatusController';
import { FormField } from '@/components/form-field';
import { RoomStatusBadge, StatusDot } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { plural } from '@/lib/format';
import type { RoomStatus, RoomStatusGroup, RoomSummary } from '@/types';

export type Transition = {
    value: RoomStatus;
    label: string;
    description: string;
    group: RoomStatusGroup;
};

export const actionLabel: Partial<Record<RoomStatus, string>> = {
    available: 'Mark as available',
    cleaning: 'Send to cleaning',
    under_maintenance: 'Set under maintenance',
    out_of_service: 'Take out of service',
};

export function RoomStatusPanel({
    room,
    statusDescription,
    transitions,
    upcomingReservations,
}: {
    room: RoomSummary;
    statusDescription: string;
    transitions: Transition[];
    upcomingReservations: number;
}) {
    const [target, setTarget] = useState<Transition | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>{statusDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <RoomStatusBadge
                    group={room.group}
                    label={room.status_label}
                    className="px-3 py-1 text-sm"
                />

                {transitions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        This status changes through check-in and check-out.
                    </p>
                ) : (
                    <div className="grid gap-2">
                        {transitions.map((transition) => (
                            <Button
                                key={transition.value}
                                variant="outline"
                                className="justify-between"
                                onClick={() => setTarget(transition)}
                            >
                                <span className="flex items-center gap-2">
                                    <StatusDot group={transition.group} />
                                    {actionLabel[transition.value] ??
                                        transition.label}
                                </span>
                                <ArrowRight className="text-muted-foreground" />
                            </Button>
                        ))}
                    </div>
                )}
            </CardContent>

            <StatusDialog
                room={room}
                target={target}
                form={RoomStatusController.form(room.id)}
                upcomingReservations={upcomingReservations}
                onOpenChange={(open) => !open && setTarget(null)}
            />
        </Card>
    );
}

/**
 * Confirms a manual status change. `form` is the route to send it to: the
 * Admin's room page or reception's room board.
 */
export function StatusDialog({
    room,
    target,
    form,
    upcomingReservations,
    onOpenChange,
}: {
    room: RoomSummary;
    target: Transition | null;
    form: ReturnType<typeof RoomStatusController.form>;
    upcomingReservations: number;
    onOpenChange: (open: boolean) => void;
}) {
    const closingRepair =
        room.status === 'under_maintenance' && target?.value === 'available';

    return (
        <Dialog open={target !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                {target && (
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                {actionLabel[target.value] ?? target.label}:{' '}
                                {room.name}
                            </DialogTitle>
                            <DialogDescription>
                                {target.description}
                            </DialogDescription>
                        </DialogHeader>

                        <Form
                            key={target.value}
                            {...form}
                            options={{ preserveScroll: true }}
                            onSuccess={() => onOpenChange(false)}
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <input
                                        type="hidden"
                                        name="status"
                                        value={target.value}
                                    />

                                    {target.group === 'unavailable' &&
                                        upcomingReservations > 0 && (
                                            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                                <p>
                                                    This room has{' '}
                                                    {plural(
                                                        upcomingReservations,
                                                        'upcoming reservation',
                                                    )}
                                                    . Those guests will need
                                                    another room.
                                                </p>
                                            </div>
                                        )}

                                    {target.value === 'under_maintenance' && (
                                        <FormField
                                            label="What needs fixing?"
                                            htmlFor="status-issue"
                                            hint="Added to the room’s maintenance log."
                                            error={errors.issue}
                                        >
                                            <Textarea
                                                id="status-issue"
                                                name="issue"
                                                placeholder="e.g. Aircon not cooling"
                                                rows={3}
                                                required
                                                autoFocus
                                            />
                                        </FormField>
                                    )}

                                    {closingRepair && (
                                        <>
                                            <FormField
                                                label="What was done?"
                                                htmlFor="status-action"
                                                optional
                                                hint="Completes the open maintenance record."
                                                error={errors.action_taken}
                                            >
                                                <Textarea
                                                    id="status-action"
                                                    name="action_taken"
                                                    placeholder="e.g. Replaced the capacitor"
                                                    rows={2}
                                                    autoFocus
                                                />
                                            </FormField>
                                            <FormField
                                                label="Done by"
                                                htmlFor="status-done-by"
                                                optional
                                                error={errors.done_by}
                                            >
                                                <Input
                                                    id="status-done-by"
                                                    name="done_by"
                                                    placeholder="Name or team"
                                                />
                                            </FormField>
                                        </>
                                    )}

                                    {errors.status && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {errors.status}
                                        </p>
                                    )}

                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            {actionLabel[target.value] ??
                                                target.label}
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
