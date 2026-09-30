import { Form, router, useForm } from '@inertiajs/react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import ChargeController from '@/actions/App/Http/Controllers/Reception/ChargeController';
import ExtensionController from '@/actions/App/Http/Controllers/Reception/ExtensionController';
import InspectionController from '@/actions/App/Http/Controllers/Reception/InspectionController';
import StayController from '@/actions/App/Http/Controllers/Reception/StayController';
import StayPaymentController from '@/actions/App/Http/Controllers/Reception/StayPaymentController';
import { DateTimeInput } from '@/components/date-time-input';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import InputError from '@/components/input-error';
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
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatLocal, formatPeso } from '@/lib/format';
import { suggestPrice } from '@/lib/pricing';
import { cn } from '@/lib/utils';

export type BilledTo = 'company' | 'guest';

export type StayRoomItem = {
    id: number;
    room_id: number;
    name: string;
    location: string;
    pax: number;
    status_label: string;
    group: 'available' | 'in_use' | 'turnover' | 'unavailable';
    inspected_at: string | null;
    inspected_by: string | null;
    extension_rate: { name: string; price: string; unit: string } | null;
};

export type Conflict = {
    reservation_room_id: number;
    reservation_id: number;
    guest: string;
    contact_number: string;
    room: string;
    pax: number;
    starts_at: string;
    ends_at: string;
    alternatives: {
        id: number;
        name: string;
        location: string;
        pax_capacity: number;
    }[];
};

export type ExtensionItem = {
    id: number;
    old_check_out_at: string;
    new_check_out_at: string;
    price: string | null;
    status: 'pending_consent' | 'approved' | 'denied';
    status_label: string;
    denial_reason: string | null;
    requested_by: string;
    moves: {
        id: number;
        consent_status: 'pending' | 'agreed' | 'declined';
        contact_number: string;
        guest: string;
        from: string;
        to: string | null;
        consent: string;
    }[];
};

/** "2026-10-03T12:00:00+08:00" (Manila) → "2026-10-03T12:00". */
export function isoToLocal(iso: string): string {
    return iso.slice(0, 16);
}

function addOneDay(local: string): string {
    const [date, time] = local.split('T');
    const [year, month, day] = date.split('-').map(Number);

    return `${new Date(Date.UTC(year, month - 1, day + 1))
        .toISOString()
        .slice(0, 10)}T${time}`;
}

function BilledToSelect({
    id,
    name,
    defaultValue,
    value,
    onChange,
}: {
    id: string;
    name?: string;
    defaultValue?: BilledTo;
    value?: BilledTo;
    onChange?: (value: BilledTo) => void;
}) {
    return (
        <Select
            name={name}
            defaultValue={defaultValue}
            value={value}
            onValueChange={(next) => onChange?.(next as BilledTo)}
        >
            <SelectTrigger id={id} className="w-full">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
            </SelectContent>
        </Select>
    );
}

function Choice({
    name,
    value,
    checked,
    onChange,
    label,
    description,
}: {
    name: string;
    value: string;
    checked: boolean;
    onChange: () => void;
    label: string;
    description?: ReactNode;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60',
                'has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
            )}
        >
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={onChange}
                className="mt-0.5 size-4 accent-primary"
            />
            <span className="grid gap-0.5">
                <span className="text-sm font-medium">{label}</span>
                {description && (
                    <span className="text-xs text-muted-foreground">
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}

type Damage = {
    description: string;
    amount: string;
    billed_to: BilledTo;
};

/** Rule 22: after check-out, record damages and send the room on. */
export function InspectDialog({
    stayId,
    room,
    defaultBilledTo,
    onClose,
}: {
    stayId: number;
    room: StayRoomItem | null;
    defaultBilledTo: BilledTo;
    onClose: () => void;
}) {
    const form = useForm<{
        damages: Damage[];
        outcome: 'cleaning' | 'maintenance';
        issue: string;
    }>({
        damages: [],
        outcome: 'cleaning',
        issue: '',
    });

    const errors = form.errors as Record<string, string | undefined>;

    const close = () => {
        form.reset();
        form.clearErrors();
        onClose();
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!room) {
            return;
        }

        form.post(InspectionController.store.url([stayId, room.id]), {
            preserveScroll: true,
            onSuccess: close,
        });
    };

    const damages = form.data.damages;

    const setDamage = (index: number, patch: Partial<Damage>) =>
        form.setData(
            'damages',
            damages.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );

    return (
        <Dialog open={room !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent className="sm:max-w-xl">
                {room && (
                    <form onSubmit={submit} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>Inspect {room.name}</DialogTitle>
                            <DialogDescription>
                                Charge any damage, then send the room to
                                cleaning or for repair.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">Damages</p>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        form.setData('damages', [
                                            ...damages,
                                            {
                                                description: '',
                                                amount: '',
                                                billed_to: defaultBilledTo,
                                            },
                                        ])
                                    }
                                >
                                    <Plus />
                                    Add damage
                                </Button>
                            </div>

                            {damages.length === 0 ? (
                                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                                    No damage found.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {damages.map((damage, index) => (
                                        <li
                                            key={index}
                                            className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_7rem_7.5rem_auto] sm:items-start"
                                        >
                                            <div className="grid gap-1">
                                                <Input
                                                    value={damage.description}
                                                    onChange={(event) =>
                                                        setDamage(index, {
                                                            description:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    placeholder="e.g. Broken lamp"
                                                    aria-label={`Damage ${index + 1}`}
                                                    required
                                                />

                                                <InputError
                                                    message={
                                                        errors[
                                                            `damages.${index}.description`
                                                        ]
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-1">
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0.01}
                                                    step="0.01"
                                                    value={damage.amount}
                                                    onChange={(event) =>
                                                        setDamage(index, {
                                                            amount: event.target
                                                                .value,
                                                        })
                                                    }
                                                    placeholder="₱"
                                                    aria-label={`Damage ${index + 1} amount`}
                                                    required
                                                />

                                                <InputError
                                                    message={
                                                        errors[
                                                            `damages.${index}.amount`
                                                        ]
                                                    }
                                                />
                                            </div>

                                            <BilledToSelect
                                                id={`damage-${index}-billed`}
                                                value={damage.billed_to}
                                                onChange={(value) =>
                                                    setDamage(index, {
                                                        billed_to: value,
                                                    })
                                                }
                                            />

                                            <IconButton
                                                type="button"
                                                label={`Remove damage ${index + 1}`}
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() =>
                                                    form.setData(
                                                        'damages',
                                                        damages.filter(
                                                            (_, i) =>
                                                                i !== index,
                                                        ),
                                                    )
                                                }
                                            >
                                                <Trash2 />
                                            </IconButton>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <fieldset className="grid gap-2 sm:grid-cols-2">
                            <legend className="mb-2 text-sm font-medium">
                                Then
                            </legend>

                            <Choice
                                name="outcome"
                                value="cleaning"
                                checked={form.data.outcome === 'cleaning'}
                                onChange={() =>
                                    form.setData('outcome', 'cleaning')
                                }
                                label="Send to cleaning"
                                description="The room is fine to use again."
                            />

                            <Choice
                                name="outcome"
                                value="maintenance"
                                checked={form.data.outcome === 'maintenance'}
                                onChange={() =>
                                    form.setData('outcome', 'maintenance')
                                }
                                label="Needs repair"
                                description="Sets it under maintenance."
                            />
                        </fieldset>

                        {form.data.outcome === 'maintenance' && (
                            <FormField
                                label="What needs repair?"
                                htmlFor="inspect_issue"
                                hint="Added to the room’s maintenance log."
                                error={errors.issue}
                            >
                                <Textarea
                                    id="inspect_issue"
                                    rows={2}
                                    value={form.data.issue}
                                    onChange={(event) =>
                                        form.setData(
                                            'issue',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                            </FormField>
                        )}

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>

                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Spinner />}
                                Finish inspection
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** An extra (e.g. laundry) or a damage found later, and who pays it. */
export function ChargeDialog({
    stayId,
    open,
    defaultBilledTo,
    onClose,
}: {
    stayId: number;
    open: boolean;
    defaultBilledTo: BilledTo;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a charge</DialogTitle>
                    <DialogDescription>
                        Charges go to the company by default; switch to the
                        guest when they pay it themselves.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...ChargeController.store.form(stayId)}
                    options={{ preserveScroll: true }}
                    onSuccess={onClose}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    label="Kind"
                                    htmlFor="charge_type"
                                    error={errors.type}
                                >
                                    <Select name="type" defaultValue="extra">
                                        <SelectTrigger
                                            id="charge_type"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>

                                        <SelectContent>
                                            <SelectItem value="extra">
                                                Extra
                                            </SelectItem>
                                            <SelectItem value="damage">
                                                Damage
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormField>

                                <FormField
                                    label="Billed to"
                                    htmlFor="charge_billed_to"
                                    error={errors.billed_to}
                                >
                                    <BilledToSelect
                                        id="charge_billed_to"
                                        name="billed_to"
                                        defaultValue={defaultBilledTo}
                                    />
                                </FormField>

                                <FormField
                                    label="Description"
                                    htmlFor="charge_description"
                                    error={errors.description}
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="charge_description"
                                        name="description"
                                        placeholder="e.g. Laundry, extra mattress"
                                        required
                                    />
                                </FormField>

                                <FormField
                                    label="Amount"
                                    htmlFor="charge_amount"
                                    error={errors.amount}
                                >
                                    <Input
                                        id="charge_amount"
                                        name="amount"
                                        type="number"
                                        inputMode="decimal"
                                        min={0.01}
                                        step="0.01"
                                        required
                                    />
                                </FormField>
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>

                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Add charge
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export function StayPaymentDialog({
    stayId,
    open,
    balance,
    defaultPaidBy,
    paymentMethods,
    onClose,
}: {
    stayId: number;
    open: boolean;
    balance: string;
    defaultPaidBy: BilledTo;
    paymentMethods: string[];
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Record a payment</DialogTitle>
                    <DialogDescription>
                        Balance {formatPeso(balance)}.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...StayPaymentController.store.form(stayId)}
                    options={{ preserveScroll: true }}
                    onSuccess={onClose}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    label="Amount"
                                    htmlFor="stay_pay_amount"
                                    error={errors.amount}
                                >
                                    <Input
                                        id="stay_pay_amount"
                                        name="amount"
                                        type="number"
                                        inputMode="decimal"
                                        min={0.01}
                                        max={balance}
                                        step="0.01"
                                        defaultValue={balance}
                                        required
                                    />
                                </FormField>

                                <FormField
                                    label="Paid with"
                                    htmlFor="stay_pay_method"
                                    error={errors.method}
                                >
                                    <Select name="method" required>
                                        <SelectTrigger
                                            id="stay_pay_method"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Choose" />
                                        </SelectTrigger>

                                        <SelectContent>
                                            {paymentMethods.map((method) => (
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
                                    label="Paid by"
                                    htmlFor="stay_pay_by"
                                    error={errors.paid_by}
                                >
                                    <BilledToSelect
                                        id="stay_pay_by"
                                        name="paid_by"
                                        defaultValue={defaultPaidBy}
                                    />
                                </FormField>

                                <FormField
                                    label="Receipt number"
                                    htmlFor="stay_pay_receipt"
                                    optional
                                    error={errors.receipt_number}
                                >
                                    <Input
                                        id="stay_pay_receipt"
                                        name="receipt_number"
                                    />
                                </FormField>
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>

                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Record payment
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

type Answer = {
    to_room_id: number | null;
    consent: 'pending' | 'agreed' | 'declined';
};

/**
 * Rules 20 and 21:
 * Choose the new check-out; when a room is reserved next,
 * offer Guest B another room and record their answer.
 */
export function ExtendDialog({
    stayId,
    open,
    expectedCheckOut,
    rooms,
    check,
    onClose,
}: {
    stayId: number;
    open: boolean;
    expectedCheckOut: string;
    rooms: StayRoomItem[];
    check: { new_check_out_at: string; conflicts: Conflict[] } | null;
    onClose: () => void;
}) {
    const current = isoToLocal(expectedCheckOut);

    const [value, setValue] = useState(() => addOneDay(current));
    const [price, setPrice] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<number, Answer>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    /*
     * Keep track of the latest availability check.

     * This prevents an older request from being treated as the current
     * availability result if the receptionist changes the date quickly.
     */
    const checkRequestRef = useRef(0);
    // The time the server last finished answering for, and a retry counter.
    const [answered, setAnswered] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    const suggested = rooms.reduce(
        (sum, room) =>
            sum +
            (room.extension_rate
                ? suggestPrice(
                      room.extension_rate.price,
                      room.extension_rate.unit,
                      current,
                      value,
                  ).total
                : 0),
        0,
    );

    const missingRates = rooms.filter((room) => !room.extension_rate);

    const conflicts = check?.new_check_out_at === value ? check.conflicts : [];

    /*
     * The important fix:
     *
     * We no longer depend on Dialog.onOpenChange() to start the check.
     * The availability request is automatically triggered whenever:
     *
     * - the dialog opens
     * - the selected extension date changes
     *
     * This fixes the initial "Checking the rooms…" spinner.
     */
    useEffect(() => {
        if (!open || value <= current) {
            return;
        }

        const requestId = ++checkRequestRef.current;

        router.get(
            StayController.show.url(stayId),
            { extend_to: value },
            {
                only: ['extensionCheck'],
                preserveState: true,
                preserveScroll: true,
                replace: true,

                /*
                 * Only the newest request may end the wait. If it fails,
                 * or the server has no answer for this time, the dialog
                 * offers "Check again" instead of spinning forever.
                 */
                onFinish: () => {
                    if (requestId === checkRequestRef.current) {
                        setAnswered(value);
                    }
                },
            },
        );
    }, [open, stayId, value, current, attempt]);

    /*
     * The server sends extensionCheck as a partial prop.
     *
     * If the date currently selected in the form does not match the
     * server's result, the rooms are not checked for it (yet).
     */
    const checking =
        open && value > current && check?.new_check_out_at !== value;
    const checkFailed = checking && answered === value;

    const look = (next: string) => {
        setValue(next);
        setPrice(null);

        /*
         * Clear answers belonging to the previous date.
         * A room move chosen for one extension date should never
         * accidentally be submitted for another extension date.
         */
        setAnswers({});
        setErrors({});
    };

    const answer = (id: number, patch: Partial<Answer>) =>
        setAnswers((all) => ({
            ...all,
            [id]: {
                ...(all[id] ?? {
                    to_room_id: null,
                    consent: 'pending',
                }),
                ...patch,
            },
        }));

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (value <= current || checking) {
            return;
        }

        router.post(
            ExtensionController.store.url(stayId),
            {
                new_check_out_at: value,
                price: price ?? String(suggested),
                moves: conflicts.map((conflict) => ({
                    reservation_room_id: conflict.reservation_room_id,
                    to_room_id:
                        answers[conflict.reservation_room_id]?.to_room_id ??
                        null,
                    consent:
                        answers[conflict.reservation_room_id]?.consent ??
                        'pending',
                })),
            },
            {
                preserveScroll: true,

                onStart: () => {
                    setProcessing(true);
                    setErrors({});
                },

                onFinish: () => {
                    setProcessing(false);
                },

                onError: (errs) => {
                    setErrors(errs as Record<string, string>);
                },

                onSuccess: onClose,
            },
        );
    };

    /*
     * When the dialog is opened for a different stay/check-out,
     * make sure the default date is recalculated.
     */
    useEffect(() => {
        if (!open) {
            return;
        }

        const nextDefault = addOneDay(current);

        setValue((existing) => (existing > current ? existing : nextDefault));
    }, [open, current]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-2xl">
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>Extend stay</DialogTitle>

                        <DialogDescription>
                            Now due out {formatLocal(current)}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                            label="New check-out"
                            htmlFor="extend_to"
                            error={errors.new_check_out_at}
                        >
                            <DateTimeInput
                                id="extend_to"
                                label="New check-out"
                                value={value}
                                min={current.slice(0, 10)}
                                onChange={look}
                                required
                            />
                        </FormField>

                        <FormField
                            label="Extension price"
                            htmlFor="extend_price"
                            hint={
                                missingRates.length > 0
                                    ? `${missingRates
                                          .map((room) => room.name)
                                          .join(', ')} ${
                                          missingRates.length === 1
                                              ? 'has'
                                              : 'have'
                                      } no extension rate; add the amount yourself.`
                                    : 'Suggested from each room’s extension rate.'
                            }
                            error={errors.price}
                        >
                            <Input
                                id="extend_price"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                value={price ?? String(suggested)}
                                onChange={(event) =>
                                    setPrice(event.target.value)
                                }
                                required
                            />
                        </FormField>
                    </div>

                    {checkFailed ? (
                        <div
                            role="alert"
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground"
                        >
                            <span>
                                The rooms could not be checked for this time.
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setAnswered(null);
                                    setAttempt((count) => count + 1);
                                }}
                            >
                                Check again
                            </Button>
                        </div>
                    ) : checking ? (
                        <div
                            role="status"
                            className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground"
                        >
                            <Spinner />
                            <span>Checking room availability…</span>
                        </div>
                    ) : conflicts.length === 0 ? (
                        value > current && (
                            <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                                The rooms are free until then. The extension can
                                be approved at once.
                            </p>
                        )
                    ) : (
                        <div className="space-y-3">
                            <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />

                                <p>
                                    Reserved next by another booking. Call the
                                    next guest, offer another room, and record
                                    their answer. If they decline, or no room
                                    fits, the extension is denied (rule 20).
                                </p>
                            </div>

                            {conflicts.map((conflict) => {
                                const given =
                                    answers[conflict.reservation_room_id];

                                return (
                                    <div
                                        key={conflict.reservation_room_id}
                                        className="space-y-3 rounded-lg border p-3"
                                    >
                                        <p className="text-sm">
                                            <span className="font-medium">
                                                {conflict.room}
                                            </span>{' '}
                                            is reserved for{' '}
                                            <span className="font-medium">
                                                {conflict.guest}
                                            </span>{' '}
                                            ({conflict.pax} guests),{' '}
                                            {formatDateTime(conflict.starts_at)}{' '}
                                            to{' '}
                                            {formatDateTime(conflict.ends_at)}.{' '}
                                            <a
                                                href={`tel:${conflict.contact_number}`}
                                                className="font-medium underline-offset-4 hover:underline"
                                            >
                                                {conflict.contact_number}
                                            </a>
                                        </p>

                                        {conflict.alternatives.length === 0 ? (
                                            <p className="text-sm text-red-600 dark:text-red-400">
                                                No other room can take them, so
                                                the extension will be denied.
                                            </p>
                                        ) : (
                                            <>
                                                <FormField
                                                    label="Offer them"
                                                    htmlFor={`move-${conflict.reservation_room_id}`}
                                                >
                                                    <Select
                                                        value={
                                                            given?.to_room_id
                                                                ? String(
                                                                      given.to_room_id,
                                                                  )
                                                                : undefined
                                                        }
                                                        onValueChange={(room) =>
                                                            answer(
                                                                conflict.reservation_room_id,
                                                                {
                                                                    to_room_id:
                                                                        Number(
                                                                            room,
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id={`move-${conflict.reservation_room_id}`}
                                                            className="w-full"
                                                        >
                                                            <SelectValue placeholder="Choose a room" />
                                                        </SelectTrigger>

                                                        <SelectContent>
                                                            {conflict.alternatives.map(
                                                                (room) => (
                                                                    <SelectItem
                                                                        key={
                                                                            room.id
                                                                        }
                                                                        value={String(
                                                                            room.id,
                                                                        )}
                                                                    >
                                                                        {
                                                                            room.name
                                                                        }{' '}
                                                                        ·{' '}
                                                                        {
                                                                            room.location
                                                                        }{' '}
                                                                        · up to{' '}
                                                                        {
                                                                            room.pax_capacity
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </FormField>

                                                <fieldset className="grid gap-2 sm:grid-cols-3">
                                                    <legend className="sr-only">
                                                        {conflict.guest}’s
                                                        answer
                                                    </legend>

                                                    {(
                                                        [
                                                            [
                                                                'agreed',
                                                                'Agreed',
                                                            ],
                                                            [
                                                                'declined',
                                                                'Declined',
                                                            ],
                                                            [
                                                                'pending',
                                                                'Not reached yet',
                                                            ],
                                                        ] as const
                                                    ).map(
                                                        ([consent, label]) => (
                                                            <Choice
                                                                key={consent}
                                                                name={`consent-${conflict.reservation_room_id}`}
                                                                value={consent}
                                                                checked={
                                                                    (given?.consent ??
                                                                        'pending') ===
                                                                    consent
                                                                }
                                                                onChange={() =>
                                                                    answer(
                                                                        conflict.reservation_room_id,
                                                                        {
                                                                            consent,
                                                                        },
                                                                    )
                                                                }
                                                                label={label}
                                                            />
                                                        ),
                                                    )}
                                                </fieldset>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <InputError message={errors.extension} />

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>

                        <Button
                            type="submit"
                            disabled={
                                processing || checking || value <= current
                            }
                        >
                            {processing && <Spinner />}
                            {conflicts.length === 0 ? 'Extend stay' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Record the next guest's answer for an extension that is waiting on them. */
export function DecideDialog({
    extension,
    onClose,
}: {
    extension: ExtensionItem | null;
    onClose: () => void;
}) {
    const [answers, setAnswers] = useState<
        Record<number, 'agreed' | 'declined'>
    >({});

    const [processing, setProcessing] = useState(false);

    const pending =
        extension?.moves.filter((move) => move.consent_status === 'pending') ??
        [];

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!extension) {
            return;
        }

        router.patch(
            ExtensionController.decide.url(extension.id),
            { answers },
            {
                preserveScroll: true,

                onStart: () => setProcessing(true),

                onFinish: () => setProcessing(false),

                onSuccess: onClose,
            },
        );
    };

    return (
        <Dialog
            open={extension !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {extension && (
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Next guest’s answer</DialogTitle>

                            <DialogDescription>
                                Extension to{' '}
                                {formatDateTime(extension.new_check_out_at)}.
                            </DialogDescription>
                        </DialogHeader>

                        {pending.map((move) => (
                            <div
                                key={move.id}
                                className="space-y-2 rounded-lg border p-3"
                            >
                                <p className="text-sm">
                                    Move{' '}
                                    <span className="font-medium">
                                        {move.guest}
                                    </span>{' '}
                                    from {move.from} to {move.to}?{' '}
                                    <a
                                        href={`tel:${move.contact_number}`}
                                        className="font-medium underline-offset-4 hover:underline"
                                    >
                                        {move.contact_number}
                                    </a>
                                </p>

                                <fieldset className="grid gap-2 sm:grid-cols-2">
                                    <legend className="sr-only">
                                        {move.guest}’s answer
                                    </legend>

                                    {(
                                        [
                                            ['agreed', 'Agreed'],
                                            ['declined', 'Declined'],
                                        ] as const
                                    ).map(([consent, label]) => (
                                        <Choice
                                            key={consent}
                                            name={`decide-${move.id}`}
                                            value={consent}
                                            checked={
                                                answers[move.id] === consent
                                            }
                                            onChange={() =>
                                                setAnswers((all) => ({
                                                    ...all,
                                                    [move.id]: consent,
                                                }))
                                            }
                                            label={label}
                                        />
                                    ))}
                                </fieldset>
                            </div>
                        ))}

                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </DialogClose>

                            <Button
                                type="submit"
                                disabled={
                                    processing ||
                                    pending.some((move) => !answers[move.id])
                                }
                            >
                                {processing && <Spinner />}
                                Save answer
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
