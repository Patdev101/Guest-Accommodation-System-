import { Head, Link, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Camera,
    Check,
    Plus,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import CheckInController from '@/actions/App/Http/Controllers/Reception/CheckInController';
import { DateTimeInput } from '@/components/date-time-input';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import InputError from '@/components/input-error';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { StatusDot } from '@/components/room-status-badge';
import {
    formatDateTime,
    formatDayTime,
    formatLocal,
    formatMinutes,
    localToMs,
    plural,
    todayIso,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    index as reservationsIndex,
    show as reservationsShow,
} from '@/routes/reception/reservations';
import type { RoomStatusGroup } from '@/types';

type Room = {
    id: number;
    name: string;
    location: string;
    pax: number;
    pax_capacity: number;
    status_label: string;
    group: RoomStatusGroup;
    problem: string | null;
    next_booking: {
        starts_at: string;
        /** The next booking's start minus the cleaning buffer. */
        latest_check_out: string;
        label: string;
    } | null;
};

type Props = {
    reservation: {
        id: number;
        contact_name: string;
        contact_number: string;
        email: string | null;
        company: string | null;
        purpose: string | null;
        starts_at: string;
        ends_at: string;
    };
    rooms: Room[];
    idTypes: { id: number; name: string }[];
    checkOut: string;
    maxPhotoMb: number;
    reminderMinutes: number;
};

type GuestRow = {
    name: string;
    address: string;
    contact_number: string;
    room_id: number;
};

type CheckInForm = {
    contact_name: string;
    contact_number: string;
    email: string;
    company: string;
    purpose: string;
    expected_check_out_at: string;
    guests: GuestRow[];
    verification: 'passed' | 'failed';
    verification_notes: string;
    id_type_id: string;
    id_number: string;
    id_photo: File | null;
    id_collected: boolean;
};

/** One empty row per booked guest, already placed in their rooms. */
function startingGuests(props: Props): GuestRow[] {
    const rows = props.rooms.flatMap((room) =>
        Array.from({ length: room.pax }, () => ({
            name: '',
            address: '',
            contact_number: '',
            room_id: room.id,
        })),
    );

    if (rows[0]) {
        rows[0] = {
            ...rows[0],
            name: props.reservation.contact_name,
            contact_number: props.reservation.contact_number,
        };
    }

    return rows;
}

export default function CheckIn(props: Props) {
    const {
        reservation,
        rooms,
        idTypes,
        checkOut,
        maxPhotoMb,
        reminderMinutes,
    } = props;

    const form = useForm<CheckInForm>({
        contact_name: reservation.contact_name,
        contact_number: reservation.contact_number,
        email: reservation.email ?? '',
        company: reservation.company ?? '',
        purpose: reservation.purpose ?? '',
        expected_check_out_at: checkOut,
        guests: startingGuests(props),
        verification: 'passed',
        verification_notes: '',
        id_type_id: '',
        id_number: '',
        id_photo: null,
        id_collected: false,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const passed = form.data.verification === 'passed';

    // Preview of the ID photo; the object URL is freed when it changes.
    const preview = useMemo(
        () =>
            form.data.id_photo ? URL.createObjectURL(form.data.id_photo) : null,
        [form.data.id_photo],
    );
    useEffect(
        () => () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        },
        [preview],
    );

    const guests = form.data.guests;
    const perRoom = (roomId: number) =>
        guests.filter((guest) => guest.room_id === roomId).length;
    const overfull = rooms.filter(
        (room) => perRoom(room.id) > room.pax_capacity,
    );
    const blocked = rooms.filter(
        (room) => room.problem !== null && perRoom(room.id) > 0,
    );
    const unused = rooms.filter((room) => perRoom(room.id) === 0);

    // The chosen check-out must leave time to clean before a room's next booking.
    const checkOutMs = localToMs(form.data.expected_check_out_at);
    const tooLate = rooms.flatMap((room) =>
        perRoom(room.id) > 0 &&
        room.next_booking &&
        checkOutMs > Date.parse(room.next_booking.latest_check_out)
            ? [{ room, next: room.next_booking }]
            : [],
    );

    const steps: Step[] = [
        {
            id: 'details',
            label: 'Booking details',
            state:
                form.data.company.trim() &&
                form.data.contact_name.trim() &&
                form.data.contact_number.trim()
                    ? 'done'
                    : 'todo',
        },
        {
            id: 'check-out',
            label: 'Check-out time',
            state:
                !Number.isNaN(checkOutMs) &&
                checkOutMs > Date.now() &&
                tooLate.length === 0
                    ? 'done'
                    : 'todo',
        },
        {
            id: 'guests',
            label: 'Guest list',
            state:
                guests.every(
                    (guest) => guest.name.trim() && guest.address.trim(),
                ) &&
                overfull.length === 0 &&
                blocked.length === 0
                    ? 'done'
                    : 'todo',
        },
        {
            id: 'verification',
            label: 'Verification',
            state: passed ? 'done' : 'failed',
        },
        {
            id: 'valid-id',
            label: 'Valid ID',
            state: !passed
                ? 'skipped'
                : form.data.id_type_id &&
                    form.data.id_number.trim() &&
                    form.data.id_photo &&
                    form.data.id_collected
                  ? 'done'
                  : 'todo',
        },
    ];
    const stepNumber = (id: string) =>
        steps.findIndex((step) => step.id === id) + 1;
    const stepState = (id: string) =>
        steps.find((step) => step.id === id)?.state ?? 'todo';
    const done = steps.filter((step) => step.state === 'done').length;

    // What stops a (passed) check-in from being saved, if anything.
    const names = (list: { name: string }[]) =>
        list.map((room) => room.name).join(', ');
    const stopper = !passed
        ? null
        : blocked.length > 0
          ? `${names(blocked)} cannot take guests yet (see above).`
          : overfull.length > 0
            ? `Too many guests in ${names(overfull)}.`
            : tooLate.length > 0
              ? `Check-out is too late for ${names(tooLate.map(({ room }) => room))} (see above).`
              : null;

    const updateGuest = (index: number, patch: Partial<GuestRow>) =>
        form.setData(
            'guests',
            guests.map((guest, i) =>
                i === index ? { ...guest, ...patch } : guest,
            ),
        );

    const addGuest = () => {
        const room =
            rooms.find((item) => perRoom(item.id) < item.pax_capacity) ??
            rooms[0];

        form.setData('guests', [
            ...guests,
            { name: '', address: '', contact_number: '', room_id: room.id },
        ]);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(CheckInController.store.url(reservation.id), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={`Check in ${reservation.contact_name}`} />
            <Page className="max-w-6xl">
                <PageHeader
                    title="Check in"
                    description={`Reservation #${reservation.id} · reserved ${formatDateTime(reservation.starts_at)} to ${formatDateTime(reservation.ends_at)}`}
                />

                <form
                    onSubmit={submit}
                    className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start"
                >
                    <div className="min-w-0 space-y-6">
                        <Card id="details" className="scroll-mt-4">
                            <CardHeader>
                                <SectionTitle
                                    number={stepNumber('details')}
                                    state={stepState('details')}
                                >
                                    Booking details
                                </SectionTitle>
                                <CardDescription>
                                    From the reservation. Correct anything that
                                    has changed.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-6 sm:grid-cols-2">
                                <FormField
                                    label="Company"
                                    htmlFor="company"
                                    error={errors.company}
                                >
                                    <Input
                                        id="company"
                                        value={form.data.company}
                                        onChange={(event) =>
                                            form.setData(
                                                'company',
                                                event.target.value,
                                            )
                                        }
                                        required={passed}
                                    />
                                </FormField>
                                <FormField
                                    label="Purpose of stay"
                                    htmlFor="purpose"
                                    optional
                                    error={errors.purpose}
                                >
                                    <Input
                                        id="purpose"
                                        value={form.data.purpose}
                                        onChange={(event) =>
                                            form.setData(
                                                'purpose',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </FormField>
                                <h3 className="border-t pt-6 text-sm font-semibold sm:col-span-2">
                                    Contact person
                                </h3>
                                <FormField
                                    label="Name"
                                    htmlFor="contact_name"
                                    error={errors.contact_name}
                                >
                                    <Input
                                        id="contact_name"
                                        value={form.data.contact_name}
                                        onChange={(event) =>
                                            form.setData(
                                                'contact_name',
                                                event.target.value,
                                            )
                                        }
                                        required={passed}
                                    />
                                </FormField>
                                <FormField
                                    label="Email"
                                    htmlFor="email"
                                    optional
                                    error={errors.email}
                                >
                                    <Input
                                        id="email"
                                        type="email"
                                        value={form.data.email}
                                        onChange={(event) =>
                                            form.setData(
                                                'email',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </FormField>
                                <FormField
                                    label="Contact number"
                                    htmlFor="contact_number"
                                    error={errors.contact_number}
                                >
                                    <Input
                                        id="contact_number"
                                        type="tel"
                                        value={form.data.contact_number}
                                        onChange={(event) =>
                                            form.setData(
                                                'contact_number',
                                                event.target.value,
                                            )
                                        }
                                        required={passed}
                                    />
                                </FormField>
                            </CardContent>
                        </Card>

                        <Card id="check-out" className="scroll-mt-4">
                            <CardHeader>
                                <SectionTitle
                                    number={stepNumber('check-out')}
                                    state={stepState('check-out')}
                                >
                                    Check-in and check-out
                                </SectionTitle>
                                <CardDescription>
                                    Check-in is recorded as now. The expected
                                    check-out is required.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    label="Expected check-out"
                                    htmlFor="check_out_date"
                                    hint={
                                        reminderMinutes > 0
                                            ? `The desk is alerted to call the guest ${formatMinutes(reminderMinutes)} before this time.`
                                            : undefined
                                    }
                                    error={errors.expected_check_out_at}
                                    className="max-w-md"
                                >
                                    <DateTimeInput
                                        id="check_out_date"
                                        label="Check-out"
                                        value={form.data.expected_check_out_at}
                                        min={todayIso()}
                                        onChange={(value) =>
                                            form.setData(
                                                'expected_check_out_at',
                                                value,
                                            )
                                        }
                                        required={passed}
                                    />
                                </FormField>
                                {tooLate.map(({ room, next }) => (
                                    <div
                                        key={room.id}
                                        role="alert"
                                        className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                                    >
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                                        <p>
                                            {room.name} is booked again from{' '}
                                            {formatDayTime(next.starts_at)}.
                                            Check out by{' '}
                                            {formatDayTime(
                                                next.latest_check_out,
                                            )}{' '}
                                            so there is time to clean it.
                                        </p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card id="guests" className="scroll-mt-4">
                            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1.5">
                                    <SectionTitle
                                        number={stepNumber('guests')}
                                        state={stepState('guests')}
                                    >
                                        Guest list
                                    </SectionTitle>
                                    <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                                        {rooms.map((room) => (
                                            <span
                                                key={room.id}
                                                className={cn(
                                                    'inline-flex items-center gap-1.5',
                                                    perRoom(room.id) >
                                                        room.pax_capacity &&
                                                        'font-medium text-red-600 dark:text-red-400',
                                                )}
                                            >
                                                <Users className="size-3.5" />
                                                {room.name}: {perRoom(room.id)}{' '}
                                                of {room.pax_capacity}
                                            </span>
                                        ))}
                                    </CardDescription>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={addGuest}
                                    disabled={!passed}
                                >
                                    <Plus />
                                    Add guest
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {rooms
                                    .filter((room) => room.problem !== null)
                                    .map((room) => (
                                        <div
                                            key={room.id}
                                            role="alert"
                                            className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
                                        >
                                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                                            <p>{room.problem}</p>
                                        </div>
                                    ))}

                                <ul className="divide-y rounded-lg border">
                                    {guests.map((guest, index) => (
                                        <li
                                            key={index}
                                            className="grid gap-3 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.3fr)_9rem_8rem_auto] sm:items-start"
                                        >
                                            <span className="pt-2 text-sm text-muted-foreground tabular-nums">
                                                {index + 1}.
                                            </span>
                                            <div className="grid gap-1">
                                                <Input
                                                    value={guest.name}
                                                    onChange={(event) =>
                                                        updateGuest(index, {
                                                            name: event.target
                                                                .value,
                                                        })
                                                    }
                                                    placeholder="Full name"
                                                    aria-label={`Guest ${index + 1} name`}
                                                    required={passed}
                                                />
                                                <InputError
                                                    message={
                                                        errors[
                                                            `guests.${index}.name`
                                                        ]
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Input
                                                    value={guest.address}
                                                    onChange={(event) =>
                                                        updateGuest(index, {
                                                            address:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    placeholder="Address"
                                                    aria-label={`Guest ${index + 1} address`}
                                                    required={passed}
                                                />
                                                <InputError
                                                    message={
                                                        errors[
                                                            `guests.${index}.address`
                                                        ]
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Input
                                                    type="tel"
                                                    value={guest.contact_number}
                                                    onChange={(event) =>
                                                        updateGuest(index, {
                                                            contact_number:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                    placeholder="Contact (optional)"
                                                    aria-label={`Guest ${index + 1} contact number`}
                                                />
                                                <InputError
                                                    message={
                                                        errors[
                                                            `guests.${index}.contact_number`
                                                        ]
                                                    }
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Select
                                                    value={String(
                                                        guest.room_id,
                                                    )}
                                                    onValueChange={(value) =>
                                                        updateGuest(index, {
                                                            room_id:
                                                                Number(value),
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger
                                                        aria-label={`Guest ${index + 1} room`}
                                                        className="w-full"
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {rooms.map((room) => (
                                                            <SelectItem
                                                                key={room.id}
                                                                value={String(
                                                                    room.id,
                                                                )}
                                                            >
                                                                {room.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <InputError
                                                    message={
                                                        errors[
                                                            `guests.${index}.room_id`
                                                        ]
                                                    }
                                                />
                                            </div>
                                            <IconButton
                                                type="button"
                                                label={`Remove guest ${index + 1}`}
                                                className="text-muted-foreground hover:text-destructive"
                                                disabled={guests.length === 1}
                                                disabledReason="A check-in needs at least one guest"
                                                onClick={() =>
                                                    form.setData(
                                                        'guests',
                                                        guests.filter(
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
                                <InputError message={errors.guests} />
                                {unused.length > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        {unused
                                            .map((room) => room.name)
                                            .join(', ')}{' '}
                                        {unused.length === 1 ? 'has' : 'have'}{' '}
                                        no guests, so{' '}
                                        {unused.length === 1
                                            ? 'it is'
                                            : 'they are'}{' '}
                                        not checked in and become free for
                                        others.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card id="verification" className="scroll-mt-4">
                            <CardHeader>
                                <SectionTitle
                                    number={stepNumber('verification')}
                                    state={stepState('verification')}
                                >
                                    Verification
                                </SectionTitle>
                                <CardDescription>
                                    The internal check before a room is given. A
                                    failed verification is recorded and stops
                                    the check-in; no ID is taken.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <fieldset className="grid gap-2 sm:grid-cols-2">
                                    <legend className="sr-only">
                                        Verification result
                                    </legend>
                                    {(
                                        [
                                            [
                                                'passed',
                                                'Passed',
                                                'Continue to the ID.',
                                            ],
                                            [
                                                'failed',
                                                'Failed',
                                                'Record it and stop here.',
                                            ],
                                        ] as const
                                    ).map(([value, label, description]) => (
                                        <label
                                            key={value}
                                            className={cn(
                                                'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60',
                                                'has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="verification"
                                                value={value}
                                                checked={
                                                    form.data.verification ===
                                                    value
                                                }
                                                onChange={() =>
                                                    form.setData(
                                                        'verification',
                                                        value,
                                                    )
                                                }
                                                className="mt-0.5 size-4 accent-primary"
                                            />
                                            <span className="grid gap-0.5">
                                                <span className="text-sm font-medium">
                                                    {label}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {description}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </fieldset>
                                <FormField
                                    label={
                                        passed ? 'Notes' : 'Why did it fail?'
                                    }
                                    htmlFor="verification_notes"
                                    optional={passed}
                                    error={errors.verification_notes}
                                >
                                    <Textarea
                                        id="verification_notes"
                                        rows={2}
                                        value={form.data.verification_notes}
                                        onChange={(event) =>
                                            form.setData(
                                                'verification_notes',
                                                event.target.value,
                                            )
                                        }
                                        required={!passed}
                                    />
                                </FormField>
                            </CardContent>
                        </Card>

                        {passed && (
                            <Card id="valid-id" className="scroll-mt-4">
                                <CardHeader>
                                    <SectionTitle
                                        number={stepNumber('valid-id')}
                                        state={stepState('valid-id')}
                                    >
                                        Valid ID
                                    </SectionTitle>
                                    <CardDescription>
                                        One ID for the booking, from the contact
                                        person. It is held until everything is
                                        settled.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-6 sm:grid-cols-2">
                                    <div className="grid content-start gap-6">
                                        <FormField
                                            label="ID type"
                                            htmlFor="id_type_id"
                                            error={errors.id_type_id}
                                        >
                                            <Select
                                                value={form.data.id_type_id}
                                                onValueChange={(value) =>
                                                    form.setData(
                                                        'id_type_id',
                                                        value,
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="id_type_id"
                                                    className="w-full"
                                                >
                                                    <SelectValue placeholder="Choose the ID" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {idTypes.map((type) => (
                                                        <SelectItem
                                                            key={type.id}
                                                            value={String(
                                                                type.id,
                                                            )}
                                                        >
                                                            {type.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormField>
                                        <FormField
                                            label="ID number"
                                            htmlFor="id_number"
                                            error={errors.id_number}
                                        >
                                            <Input
                                                id="id_number"
                                                value={form.data.id_number}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'id_number',
                                                        event.target.value,
                                                    )
                                                }
                                                autoComplete="off"
                                                required
                                            />
                                        </FormField>
                                        <div className="grid gap-1">
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id="id_collected"
                                                    checked={
                                                        form.data.id_collected
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        form.setData(
                                                            'id_collected',
                                                            checked === true,
                                                        )
                                                    }
                                                />
                                                <Label
                                                    htmlFor="id_collected"
                                                    className="leading-snug font-normal"
                                                >
                                                    I have received the ID from{' '}
                                                    {form.data.contact_name ||
                                                        'the contact person'}
                                                    .
                                                </Label>
                                            </div>
                                            <InputError
                                                message={errors.id_collected}
                                            />
                                        </div>
                                    </div>
                                    <FormField
                                        label="Photo of the ID"
                                        htmlFor="id_photo"
                                        hint={`JPG, PNG or WebP, up to ${maxPhotoMb} MB. On a phone this opens the camera.`}
                                        error={errors.id_photo}
                                    >
                                        <label
                                            htmlFor="id_photo"
                                            className="flex aspect-[3/2] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
                                        >
                                            {preview ? (
                                                <img
                                                    src={preview}
                                                    alt="The ID photo to be saved"
                                                    className="size-full object-contain"
                                                />
                                            ) : (
                                                <span className="flex flex-col items-center gap-2">
                                                    <Camera className="size-6" />
                                                    Take or choose a photo
                                                </span>
                                            )}
                                            <input
                                                id="id_photo"
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                capture="environment"
                                                className="sr-only"
                                                onChange={(event) =>
                                                    form.setData(
                                                        'id_photo',
                                                        event.target
                                                            .files?.[0] ?? null,
                                                    )
                                                }
                                            />
                                        </label>
                                    </FormField>
                                </CardContent>
                            </Card>
                        )}

                        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
                            <p
                                role="status"
                                className={cn(
                                    'flex flex-wrap items-center gap-2 text-sm',
                                    form.hasErrors || stopper
                                        ? 'font-medium text-red-600 dark:text-red-400'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {form.hasErrors
                                    ? 'Not checked in. Check the highlighted fields above.'
                                    : !passed
                                      ? 'The failed verification will be recorded. Nobody is checked in.'
                                      : (stopper ??
                                        `${done} of ${steps.length} steps done · ${rooms
                                            .filter(
                                                (room) => perRoom(room.id) > 0,
                                            )
                                            .map(
                                                (room) =>
                                                    `${room.name}: ${plural(perRoom(room.id), 'guest')}`,
                                            )
                                            .join(' · ')}`)}
                            </p>
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" asChild>
                                    <Link
                                        href={reservationsShow(reservation.id)}
                                    >
                                        Cancel
                                    </Link>
                                </Button>
                                <Button
                                    type="submit"
                                    variant={passed ? 'default' : 'destructive'}
                                    disabled={
                                        form.processing || stopper !== null
                                    }
                                >
                                    {form.processing && <Spinner />}
                                    {passed
                                        ? 'Check in'
                                        : 'Record failed verification'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <aside className="grid gap-4 lg:sticky lg:top-4">
                        <Card className="gap-4 py-5">
                            <CardHeader className="px-5">
                                <CardTitle className="text-base">
                                    Progress
                                </CardTitle>
                                <CardDescription>
                                    {done} of {steps.length} done
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 px-5">
                                <div
                                    role="progressbar"
                                    aria-label="Check-in progress"
                                    aria-valuemin={0}
                                    aria-valuemax={steps.length}
                                    aria-valuenow={done}
                                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                                >
                                    <div
                                        className="h-full rounded-full bg-primary transition-[width]"
                                        style={{
                                            width: `${(done / steps.length) * 100}%`,
                                        }}
                                    />
                                </div>
                                <ol className="-mx-2 grid gap-0.5">
                                    {steps.map((step, index) => (
                                        <li key={step.id}>
                                            <a
                                                href={`#${step.id}`}
                                                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                            >
                                                <StepMark
                                                    number={index + 1}
                                                    state={step.state}
                                                />
                                                <span
                                                    className={cn(
                                                        'flex-1',
                                                        step.state === 'todo' ||
                                                            step.state ===
                                                                'skipped'
                                                            ? 'text-muted-foreground'
                                                            : 'font-medium',
                                                    )}
                                                >
                                                    {step.label}
                                                </span>
                                                <span className="sr-only">
                                                    {stepStateLabel[step.state]}
                                                </span>
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </CardContent>
                        </Card>

                        <Card className="gap-4 py-5">
                            <CardHeader className="px-5">
                                <CardTitle className="text-base">
                                    This stay
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 px-5 text-sm">
                                <dl className="grid gap-2">
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-muted-foreground">
                                            Check-in
                                        </dt>
                                        <dd>Now, on saving</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-muted-foreground">
                                            Check-out
                                        </dt>
                                        <dd className="text-right">
                                            {form.data.expected_check_out_at
                                                ? formatLocal(
                                                      form.data
                                                          .expected_check_out_at,
                                                  )
                                                : 'Not set'}
                                        </dd>
                                    </div>
                                    {checkOutMs > Date.now() && (
                                        <div className="flex justify-between gap-3">
                                            <dt className="text-muted-foreground">
                                                Length
                                            </dt>
                                            <dd>
                                                {formatMinutes(
                                                    (checkOutMs - Date.now()) /
                                                        60000,
                                                )}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                                <ul className="grid gap-3 border-t pt-4">
                                    {rooms.map((room) => (
                                        <li
                                            key={room.id}
                                            className="grid gap-0.5"
                                        >
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="flex min-w-0 items-center gap-2 font-medium">
                                                    <StatusDot
                                                        group={room.group}
                                                    />
                                                    <span className="truncate">
                                                        {room.name}
                                                    </span>
                                                </span>
                                                <span
                                                    className={cn(
                                                        'shrink-0 tabular-nums',
                                                        perRoom(room.id) >
                                                            room.pax_capacity
                                                            ? 'font-medium text-red-600 dark:text-red-400'
                                                            : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {perRoom(room.id)}/
                                                    {room.pax_capacity} guests
                                                </span>
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {room.location} ·{' '}
                                                {room.status_label}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {room.next_booking
                                                    ? `Booked again ${formatDayTime(room.next_booking.starts_at)}`
                                                    : 'No booking after this stay'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </aside>
                </form>
            </Page>
        </>
    );
}

type StepState = 'todo' | 'done' | 'failed' | 'skipped';

type Step = { id: string; label: string; state: StepState };

const stepStateLabel: Record<StepState, string> = {
    todo: '(to do)',
    done: '(done)',
    failed: '(failed)',
    skipped: '(not needed)',
};

/** The step's number, or a tick once it is done. */
function StepMark({ number, state }: { number: number; state: StepState }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                state === 'done' &&
                    'border-primary bg-primary text-primary-foreground',
                state === 'failed' &&
                    'border-destructive bg-destructive text-white',
                state === 'skipped' && 'border-dashed text-muted-foreground',
                state === 'todo' && 'text-muted-foreground',
            )}
        >
            {state === 'done' ? (
                <Check className="size-3.5" />
            ) : state === 'failed' ? (
                <X className="size-3.5" />
            ) : (
                number
            )}
        </span>
    );
}

function SectionTitle({
    number,
    state,
    children,
}: {
    number: number;
    state: StepState;
    children: ReactNode;
}) {
    return (
        <CardTitle className="flex items-center gap-2.5">
            <StepMark number={number} state={state} />
            {children}
            <span className="sr-only">{stepStateLabel[state]}</span>
        </CardTitle>
    );
}

CheckIn.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Reservations', href: reservationsIndex() },
        {
            title: `#${props.reservation.id} ${props.reservation.contact_name}`,
            href: reservationsShow(props.reservation.id),
        },
        {
            title: 'Check in',
            href: CheckInController.create(props.reservation.id),
        },
    ],
});
