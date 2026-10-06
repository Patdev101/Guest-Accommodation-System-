import { Form } from '@inertiajs/react';
import RefundController from '@/actions/App/Http/Controllers/Reception/RefundController';
import StayToolsController from '@/actions/App/Http/Controllers/Reception/StayToolsController';
import { FormField } from '@/components/form-field';
import type {
    BilledTo,
    StayRoomItem,
} from '@/components/reception/stay-dialogs';
import { Button } from '@/components/ui/button';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { formatPeso } from '@/lib/format';

export type MoveRoomOption = {
    id: number;
    name: string;
    location: string;
    pax_capacity: number;
};

/** Move the guests of one room to another room during the stay. */
export function MoveRoomDialog({
    stayId,
    room,
    options,
    onClose,
}: {
    stayId: number;
    room: StayRoomItem | null;
    options: MoveRoomOption[];
    onClose: () => void;
}) {
    // Only rooms big enough for the guests who are moving.
    const fitting = options.filter(
        (option) => room !== null && option.pax_capacity >= room.pax,
    );

    return (
        <Dialog
            open={room !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {room && (
                    <Form
                        action={StayToolsController.moveRoom.url([
                            stayId,
                            room.id,
                        ])}
                        method="post"
                        options={{ preserveScroll: true }}
                        onSuccess={onClose}
                        className="space-y-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <DialogHeader>
                                    <DialogTitle>
                                        Move the guests out of {room.name}
                                    </DialogTitle>
                                    <DialogDescription>
                                        For example when something in the room
                                        breaks. The bill stays as it is; add a
                                        charge afterwards if the new room costs
                                        more.
                                    </DialogDescription>
                                </DialogHeader>

                                {fitting.length === 0 ? (
                                    <p
                                        role="alert"
                                        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                                    >
                                        No available room can take{' '}
                                        {room.pax === 1
                                            ? 'this guest'
                                            : `these ${room.pax} guests`}{' '}
                                        until their check-out. Mark a room
                                        Available on the dashboard first.
                                    </p>
                                ) : (
                                    <>
                                        <FormField
                                            label="Move to"
                                            htmlFor="to_room_id"
                                            error={errors.to_room_id}
                                        >
                                            <Select name="to_room_id" required>
                                                <SelectTrigger
                                                    id="to_room_id"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Choose an available room" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {fitting.map((option) => (
                                                        <SelectItem
                                                            key={option.id}
                                                            value={String(
                                                                option.id,
                                                            )}
                                                        >
                                                            {option.name} ·{' '}
                                                            {option.location} ·
                                                            up to{' '}
                                                            {
                                                                option.pax_capacity
                                                            }
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormField>
                                        <FormField
                                            label="Reason"
                                            htmlFor="move_reason"
                                            error={errors.reason}
                                        >
                                            <Input
                                                id="move_reason"
                                                name="reason"
                                                placeholder="e.g. Aircon not cooling"
                                                required
                                            />
                                        </FormField>
                                        <FormField
                                            label={`${room.name} afterwards`}
                                            htmlFor="old_room"
                                            hint="Needs repair: the reason is added to the room's maintenance log and the Admin is told."
                                            error={errors.old_room}
                                        >
                                            <Select
                                                name="old_room"
                                                defaultValue="cleaning"
                                            >
                                                <SelectTrigger
                                                    id="old_room"
                                                    className="w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cleaning">
                                                        Send to cleaning
                                                    </SelectItem>
                                                    <SelectItem value="maintenance">
                                                        Needs repair
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormField>
                                    </>
                                )}

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        disabled={
                                            processing || fitting.length === 0
                                        }
                                    >
                                        {processing && <Spinner />}
                                        Move guests
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** A fee for leaving late, without extending the stay. */
export function LateFeeDialog({
    stayId,
    open,
    lateText,
    suggested,
    defaultBilledTo,
    onClose,
}: {
    stayId: number;
    open: boolean;
    lateText: string;
    suggested: string;
    defaultBilledTo: BilledTo;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <Form
                    action={StayToolsController.lateFee.url(stayId)}
                    method="post"
                    options={{ preserveScroll: true }}
                    onSuccess={onClose}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>Late check-out fee</DialogTitle>
                                <DialogDescription>
                                    The guests are {lateText} past their
                                    check-out time. This adds one charge to the
                                    bill; the check-out time is not changed.
                                </DialogDescription>
                            </DialogHeader>
                            <FormField
                                label="Amount"
                                htmlFor="late_fee_amount"
                                hint={
                                    Number(suggested) > 0
                                        ? `Suggested ${formatPeso(suggested)}: each room's hourly extension rate for every started hour.`
                                        : 'No hourly extension rate is set for these rooms; type the amount.'
                                }
                                error={errors.amount}
                            >
                                <Input
                                    id="late_fee_amount"
                                    name="amount"
                                    type="number"
                                    inputMode="decimal"
                                    min={0.01}
                                    step="0.01"
                                    defaultValue={
                                        Number(suggested) > 0 ? suggested : ''
                                    }
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Billed to"
                                htmlFor="late_fee_billed_to"
                                error={errors.billed_to}
                            >
                                <Select
                                    name="billed_to"
                                    defaultValue={defaultBilledTo}
                                >
                                    <SelectTrigger
                                        id="late_fee_billed_to"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="company">
                                            Company
                                        </SelectItem>
                                        <SelectItem value="guest">
                                            Guest
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Add fee to the bill
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Completing a refund: record how the money went back. */
export function RefundedDialog({
    refund,
    methods,
    onClose,
}: {
    refund: { id: number; amount: string; guest: string | null } | null;
    methods: string[];
    onClose: () => void;
}) {
    return (
        <Dialog
            open={refund !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {refund && (
                    <Form
                        action={RefundController.advance.url(refund.id)}
                        method="patch"
                        options={{ preserveScroll: true }}
                        onSuccess={onClose}
                        className="space-y-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <DialogHeader>
                                    <DialogTitle>
                                        Mark {formatPeso(refund.amount)} as
                                        refunded?
                                    </DialogTitle>
                                    <DialogDescription>
                                        Only once {refund.guest ?? 'the guest'}{' '}
                                        has the money back. This cannot be
                                        undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <FormField
                                    label="How was it given back?"
                                    htmlFor="refund_method"
                                    error={errors.method}
                                >
                                    <Select name="method" required>
                                        <SelectTrigger
                                            id="refund_method"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Choose a method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {methods.map((method) => (
                                                <SelectItem
                                                    key={method}
                                                    value={method}
                                                >
                                                    {method}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormField>
                                <FormField
                                    label="Reference number"
                                    htmlFor="refund_reference"
                                    optional
                                    hint="For example the GCash or bank transfer reference."
                                    error={errors.reference}
                                >
                                    <Input
                                        id="refund_reference"
                                        name="reference"
                                        autoComplete="off"
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
                                        Mark refunded
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
