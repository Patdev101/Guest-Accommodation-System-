import { Form, Head, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Info, Pencil, Plus, Trash2 } from 'lucide-react';
import RateUnitController from '@/actions/App/Http/Controllers/Admin/RateUnitController';
import SettingsController from '@/actions/App/Http/Controllers/Admin/SettingsController';
import InputError from '@/components/input-error';
import { ConfirmDelete } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
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
import { Spinner } from '@/components/ui/spinner';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { edit as settingsEdit } from '@/routes/admin/settings';

type Refund = 'full' | 'partial' | 'none';

type Settings = {
    cleaning_buffer_minutes: number;
    no_show_grace_minutes: number;
    checkout_reminder_minutes: number;
    no_show_refund: Refund;
    no_show_refund_percent: number;
};

type Unit = { id: number; name: string; rates_count: number };

type Props = {
    settings: Settings;
    rateUnits: Unit[];
    lastSaved: string | null;
};

const refundOptions: { value: Refund; label: string; description: string }[] = [
    {
        value: 'full',
        label: 'Full refund',
        description: 'Return everything the guest paid. The current default.',
    },
    {
        value: 'partial',
        label: 'Partial refund',
        description: 'Return a percentage of what the guest paid.',
    },
    {
        value: 'none',
        label: 'No refund',
        description: 'Keep what the guest paid.',
    },
];

const savedAt = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function SystemSettings({
    settings,
    rateUnits,
    lastSaved,
}: Props) {
    const form = useForm<Settings>(settings);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(SettingsController.update.url(), {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };

    return (
        <>
            <Head title="System settings" />
            <Page className="max-w-4xl">
                <PageHeader
                    title="System settings"
                    description="The rules reception works by. Changes apply as soon as you save."
                />

                <form onSubmit={submit} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Room turnover</CardTitle>
                            <CardDescription>
                                After check-out a room is inspected and cleaned
                                before the next guest.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                label="Cleaning buffer"
                                htmlFor="cleaning_buffer_minutes"
                                hint="Added after the expected check-out to estimate when a room is ready again. Leave it at 0 until the real time is known."
                                error={form.errors.cleaning_buffer_minutes}
                                className="max-w-md"
                            >
                                <MinutesInput
                                    id="cleaning_buffer_minutes"
                                    value={form.data.cleaning_buffer_minutes}
                                    onChange={(value) =>
                                        form.setData(
                                            'cleaning_buffer_minutes',
                                            value,
                                        )
                                    }
                                />
                            </FormField>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Reservations and reminders</CardTitle>
                            <CardDescription>
                                How long a reserved room is held, and when the
                                guest is reminded to check out.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 sm:grid-cols-2">
                            <FormField
                                label="No-show grace period"
                                htmlFor="no_show_grace_minutes"
                                hint="How long after the reserved time the room is held before reception may release it."
                                error={form.errors.no_show_grace_minutes}
                            >
                                <MinutesInput
                                    id="no_show_grace_minutes"
                                    value={form.data.no_show_grace_minutes}
                                    onChange={(value) =>
                                        form.setData(
                                            'no_show_grace_minutes',
                                            value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Check-out reminder"
                                htmlFor="checkout_reminder_minutes"
                                hint="How long before check-out the guest is notified and reception is asked to call."
                                error={form.errors.checkout_reminder_minutes}
                            >
                                <MinutesInput
                                    id="checkout_reminder_minutes"
                                    value={form.data.checkout_reminder_minutes}
                                    min={5}
                                    suffix="minutes before"
                                    onChange={(value) =>
                                        form.setData(
                                            'checkout_reminder_minutes',
                                            value,
                                        )
                                    }
                                />
                            </FormField>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>No-show refunds</CardTitle>
                            <CardDescription>
                                What happens to payments when a guest does not
                                arrive within the grace period.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-3 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                                <Info className="mt-0.5 size-4 shrink-0" />
                                <p>
                                    The final policy is still to be decided.
                                    Until then, guests get a full refund.
                                </p>
                            </div>
                            <fieldset className="grid gap-2 sm:grid-cols-3">
                                <legend className="sr-only">
                                    No-show refund
                                </legend>
                                {refundOptions.map((option) => (
                                    <label
                                        key={option.value}
                                        className={cn(
                                            'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60',
                                            'has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="no_show_refund"
                                            value={option.value}
                                            checked={
                                                form.data.no_show_refund ===
                                                option.value
                                            }
                                            onChange={() =>
                                                form.setData(
                                                    'no_show_refund',
                                                    option.value,
                                                )
                                            }
                                            className="mt-0.5 size-4 accent-primary"
                                        />
                                        <span className="grid gap-0.5">
                                            <span className="text-sm font-medium">
                                                {option.label}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {option.description}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                            <InputError message={form.errors.no_show_refund} />

                            {form.data.no_show_refund === 'partial' && (
                                <FormField
                                    label="Refund percentage"
                                    htmlFor="no_show_refund_percent"
                                    error={form.errors.no_show_refund_percent}
                                    className="max-w-xs"
                                >
                                    <SuffixInput suffix="%">
                                        <Input
                                            id="no_show_refund_percent"
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            max={99}
                                            value={
                                                form.data
                                                    .no_show_refund_percent ||
                                                ''
                                            }
                                            onChange={(event) =>
                                                form.setData(
                                                    'no_show_refund_percent',
                                                    Number(event.target.value),
                                                )
                                            }
                                            className="pr-10"
                                        />
                                    </SuffixInput>
                                </FormField>
                            )}
                        </CardContent>
                    </Card>

                    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <p
                            role="status"
                            className={cn(
                                'text-sm',
                                form.hasErrors
                                    ? 'font-medium text-red-600 dark:text-red-400'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {form.hasErrors
                                ? 'Not saved. Check the highlighted fields above.'
                                : form.isDirty
                                  ? 'You have unsaved changes.'
                                  : lastSaved
                                    ? `Last saved ${savedAt.format(new Date(lastSaved))}.`
                                    : 'Showing the defaults. Save once to confirm them.'}
                        </p>
                        <div className="flex gap-2">
                            {form.isDirty && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        form.reset();
                                        form.clearErrors();
                                    }}
                                >
                                    Discard
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    (!form.isDirty && lastSaved !== null)
                                }
                            >
                                {form.processing && <Spinner />}
                                {form.isDirty || lastSaved
                                    ? 'Save changes'
                                    : 'Confirm settings'}
                            </Button>
                        </div>
                    </div>
                </form>

                <RateUnits units={rateUnits} />
            </Page>
        </>
    );
}

function SuffixInput({
    suffix,
    children,
}: {
    suffix: string;
    children: ReactNode;
}) {
    return (
        <div className="relative">
            {children}
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                {suffix}
            </span>
        </div>
    );
}

function MinutesInput({
    id,
    value,
    onChange,
    min = 0,
    suffix = 'minutes',
}: {
    id: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    suffix?: string;
}) {
    return (
        <SuffixInput suffix={suffix}>
            <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={min}
                max={1440}
                value={Number.isNaN(value) ? '' : value}
                onChange={(event) => onChange(event.target.valueAsNumber)}
                className="pr-32"
                required
            />
        </SuffixInput>
    );
}

function RateUnits({ units }: { units: Unit[] }) {
    const [editing, setEditing] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<Unit | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Rate units</CardTitle>
                <CardDescription>
                    What a room price is charged per. Per hour, Overnight and
                    Day tour come built in; add your own, such as Per week.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ul className="divide-y rounded-lg border">
                    {units.map((unit) => (
                        <li
                            key={unit.id}
                            className="flex min-h-12 items-center gap-3 py-1.5 pr-1.5 pl-3"
                        >
                            {editing === unit.id ? (
                                <Form
                                    {...RateUnitController.update.form(unit.id)}
                                    options={{ preserveScroll: true }}
                                    onSuccess={() => setEditing(null)}
                                    className="flex flex-1 flex-wrap items-center gap-2"
                                >
                                    {({ errors, processing }) => (
                                        <>
                                            <Input
                                                name="name"
                                                defaultValue={unit.name}
                                                aria-label="Unit name"
                                                className="h-8 max-w-60 flex-1"
                                                required
                                                autoFocus
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditing(null)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="submit"
                                                size="sm"
                                                disabled={processing}
                                            >
                                                Save
                                            </Button>
                                            <InputError
                                                message={errors.name}
                                                className="w-full"
                                            />
                                        </>
                                    )}
                                </Form>
                            ) : (
                                <>
                                    <span className="flex-1 text-sm font-medium">
                                        {unit.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {unit.rates_count > 0
                                            ? `Used by ${plural(unit.rates_count, 'rate')}`
                                            : 'Not used yet'}
                                    </span>
                                    <IconButton
                                        label={`Rename ${unit.name}`}
                                        onClick={() => setEditing(unit.id)}
                                    >
                                        <Pencil />
                                    </IconButton>
                                    <IconButton
                                        label={`Delete ${unit.name}`}
                                        className="text-muted-foreground hover:text-destructive"
                                        disabled={unit.rates_count > 0}
                                        disabledReason="In use by rates, so it cannot be deleted"
                                        onClick={() => setDeleting(unit)}
                                    >
                                        <Trash2 />
                                    </IconButton>
                                </>
                            )}
                        </li>
                    ))}
                </ul>

                <Form
                    {...RateUnitController.store.form()}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    className="space-y-2"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="flex max-w-md gap-2">
                                <Input
                                    name="name"
                                    placeholder="New unit, e.g. Per week"
                                    aria-label="New unit name"
                                    required
                                />
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={processing}
                                >
                                    <Plus />
                                    Add unit
                                </Button>
                            </div>
                            <InputError message={errors.name} />
                        </>
                    )}
                </Form>
            </CardContent>

            {deleting && (
                <ConfirmDelete
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={`Delete “${deleting.name}”?`}
                    description="It will no longer be offered when setting room rates."
                    url={RateUnitController.destroy.url(deleting.id)}
                />
            )}
        </Card>
    );
}

SystemSettings.layout = {
    breadcrumbs: [
        {
            title: 'System settings',
            href: settingsEdit(),
        },
    ],
};
