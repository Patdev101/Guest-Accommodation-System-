import { Form } from '@inertiajs/react';
import { CheckCircle2, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useState } from 'react';
import MaintenanceRecordController from '@/actions/App/Http/Controllers/Admin/MaintenanceRecordController';
import { ConfirmDelete } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import { Badge } from '@/components/ui/badge';
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
import { formatDate, todayIso } from '@/lib/format';
import type { MaintenanceRecord } from '@/types';

type DialogState = { record: MaintenanceRecord | null };

export function RoomMaintenance({
    roomId,
    records,
}: {
    roomId: number;
    records: MaintenanceRecord[];
}) {
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [deleting, setDeleting] = useState<MaintenanceRecord | null>(null);

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
                <div className="min-w-0 space-y-1.5">
                    <CardTitle>Maintenance log</CardTitle>
                    <CardDescription>
                        Issues found in this room and what was done about them.
                    </CardDescription>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ record: null })}
                >
                    <Plus />
                    Add record
                </Button>
            </CardHeader>
            <CardContent>
                {records.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing recorded. Setting the room to Under maintenance
                        adds an entry here automatically.
                    </p>
                ) : (
                    <ol className="divide-y">
                        {records.map((record) => {
                            const resolved = record.action_taken !== null;

                            return (
                                <li
                                    key={record.id}
                                    className="group flex gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                    {resolved ? (
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                    ) : (
                                        <Wrench className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    )}
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-medium">
                                                {record.issue}
                                            </p>
                                            {!resolved && (
                                                <Badge variant="outline">
                                                    Open
                                                </Badge>
                                            )}
                                        </div>
                                        {resolved && (
                                            <p className="text-sm text-muted-foreground">
                                                {record.action_taken}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {[
                                                formatDate(record.performed_on),
                                                record.done_by &&
                                                    `Done by ${record.done_by}`,
                                                record.recorded_by &&
                                                    `Logged by ${record.recorded_by}`,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-start">
                                        <IconButton
                                            label="Edit record"
                                            onClick={() =>
                                                setDialog({ record })
                                            }
                                        >
                                            <Pencil />
                                        </IconButton>
                                        <IconButton
                                            label="Delete record"
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => setDeleting(record)}
                                        >
                                            <Trash2 />
                                        </IconButton>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </CardContent>

            <MaintenanceDialog
                roomId={roomId}
                state={dialog}
                onOpenChange={(open) => !open && setDialog(null)}
            />

            {deleting && (
                <ConfirmDelete
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title="Delete this maintenance record?"
                    description={`“${deleting.issue}” will be removed from the log.`}
                    url={MaintenanceRecordController.destroy.url({
                        room: roomId,
                        maintenanceRecord: deleting.id,
                    })}
                />
            )}
        </Card>
    );
}

function MaintenanceDialog({
    roomId,
    state,
    onOpenChange,
}: {
    roomId: number;
    state: DialogState | null;
    onOpenChange: (open: boolean) => void;
}) {
    const record = state?.record ?? null;

    return (
        <Dialog open={state !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {record
                            ? 'Edit maintenance record'
                            : 'Add maintenance record'}
                    </DialogTitle>
                    <DialogDescription>
                        Leave “What was done” empty while the issue is still
                        open.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    key={record?.id ?? 'new'}
                    {...(record
                        ? MaintenanceRecordController.update.form({
                              room: roomId,
                              maintenanceRecord: record.id,
                          })
                        : MaintenanceRecordController.store.form(roomId))}
                    options={{ preserveScroll: true }}
                    onSuccess={() => onOpenChange(false)}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <FormField
                                label="Date"
                                htmlFor="maintenance-date"
                                error={errors.performed_on}
                                className="sm:max-w-48"
                            >
                                <Input
                                    id="maintenance-date"
                                    name="performed_on"
                                    type="date"
                                    defaultValue={
                                        record?.performed_on ?? todayIso()
                                    }
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Issue"
                                htmlFor="maintenance-issue"
                                error={errors.issue}
                            >
                                <Textarea
                                    id="maintenance-issue"
                                    name="issue"
                                    defaultValue={record?.issue}
                                    placeholder="e.g. Aircon not cooling"
                                    rows={2}
                                    required
                                    autoFocus
                                />
                            </FormField>
                            <FormField
                                label="What was done"
                                htmlFor="maintenance-action"
                                optional
                                error={errors.action_taken}
                            >
                                <Textarea
                                    id="maintenance-action"
                                    name="action_taken"
                                    defaultValue={record?.action_taken ?? ''}
                                    placeholder="e.g. Cleaned filter and recharged"
                                    rows={2}
                                />
                            </FormField>
                            <FormField
                                label="Done by"
                                htmlFor="maintenance-done-by"
                                optional
                                error={errors.done_by}
                            >
                                <Input
                                    id="maintenance-done-by"
                                    name="done_by"
                                    defaultValue={record?.done_by ?? ''}
                                    placeholder="Name or team"
                                />
                            </FormField>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    {record ? 'Save changes' : 'Add record'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
