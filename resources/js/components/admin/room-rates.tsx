import { Form, Link } from '@inertiajs/react';
import { Clock, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import RoomRateController from '@/actions/App/Http/Controllers/Admin/RoomRateController';
import { ConfirmDelete } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { FormField } from '@/components/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatPeso } from '@/lib/format';
import { edit as settingsEdit } from '@/routes/admin/settings';
import type { RateUnitOption, RoomRate } from '@/types';

type DialogState = { rate: RoomRate | null; extension: boolean };

export function RoomRates({
    roomId,
    rates,
    rateUnits,
}: {
    roomId: number;
    rates: RoomRate[];
    rateUnits: RateUnitOption[];
}) {
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [deleting, setDeleting] = useState<RoomRate | null>(null);
    const hasExtensionRate = rates.some((rate) => rate.is_extension_rate);

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
                <div className="min-w-0 space-y-1.5">
                    <CardTitle>Rates</CardTitle>
                    <CardDescription>
                        Prices you set for this room. Guests book standard
                        rates; the extension rate applies when a stay runs
                        longer.
                    </CardDescription>
                </div>
                {rates.length > 0 && (
                    <Button
                        size="sm"
                        onClick={() =>
                            setDialog({ rate: null, extension: false })
                        }
                    >
                        <Plus />
                        Add rate
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {rates.length === 0 ? (
                    <EmptyState
                        icon={Tag}
                        title="No rates yet"
                        description="Add at least one price, for example Overnight or Day tour. Guests cannot book the room without one."
                        className="py-8"
                        action={
                            <Button
                                onClick={() =>
                                    setDialog({ rate: null, extension: false })
                                }
                            >
                                <Plus />
                                Add rate
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-0">Name</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">
                                        Price
                                    </TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="w-20">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rates.map((rate) => (
                                    <TableRow key={rate.id}>
                                        <TableCell className="pl-0 font-medium">
                                            {rate.name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {rate.unit}
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatPeso(rate.price)}
                                        </TableCell>
                                        <TableCell>
                                            {rate.is_extension_rate ? (
                                                <Badge variant="outline">
                                                    <Clock />
                                                    Extension
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    Standard
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-0 text-right">
                                            <IconButton
                                                label={`Edit ${rate.name}`}
                                                onClick={() =>
                                                    setDialog({
                                                        rate,
                                                        extension:
                                                            rate.is_extension_rate,
                                                    })
                                                }
                                            >
                                                <Pencil />
                                            </IconButton>
                                            <IconButton
                                                label={`Delete ${rate.name}`}
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() =>
                                                    setDeleting(rate)
                                                }
                                            >
                                                <Trash2 />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {!hasExtensionRate && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
                                <span className="text-muted-foreground">
                                    No extension rate yet. Reception needs it
                                    when a guest extends their stay.
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setDialog({
                                            rate: null,
                                            extension: true,
                                        })
                                    }
                                >
                                    <Clock />
                                    Add extension rate
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            <RateDialog
                roomId={roomId}
                state={dialog}
                rateUnits={rateUnits}
                onOpenChange={(open) => !open && setDialog(null)}
            />

            {deleting && (
                <ConfirmDelete
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={`Delete the ${deleting.name} rate?`}
                    description={`${formatPeso(deleting.price)} per ${deleting.unit.toLowerCase()} will no longer be offered for this room.`}
                    url={RoomRateController.destroy.url({
                        room: roomId,
                        rate: deleting.id,
                    })}
                />
            )}
        </Card>
    );
}

function RateDialog({
    roomId,
    state,
    rateUnits,
    onOpenChange,
}: {
    roomId: number;
    state: DialogState | null;
    rateUnits: RateUnitOption[];
    onOpenChange: (open: boolean) => void;
}) {
    const rate = state?.rate ?? null;
    // New extension rates are usually per hour; standard rates per night.
    const suggestedName = state?.extension ? 'per hour' : 'overnight';
    const suggestedUnit = rateUnits
        .find((unit) => unit.name.toLowerCase() === suggestedName)
        ?.id.toString();

    return (
        <Dialog open={state !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {rate
                            ? 'Edit rate'
                            : state?.extension
                              ? 'Add extension rate'
                              : 'Add rate'}
                    </DialogTitle>
                    <DialogDescription>
                        Prices are entered by you; the system does not work them
                        out.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    key={rate?.id ?? `new-${state?.extension}`}
                    {...(rate
                        ? RoomRateController.update.form({
                              room: roomId,
                              rate: rate.id,
                          })
                        : RoomRateController.store.form(roomId))}
                    options={{ preserveScroll: true }}
                    onSuccess={() => onOpenChange(false)}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <FormField
                                label="Name"
                                htmlFor="rate-name"
                                error={errors.name}
                            >
                                <Input
                                    id="rate-name"
                                    name="name"
                                    defaultValue={
                                        rate?.name ??
                                        (state?.extension ? 'Extension' : '')
                                    }
                                    placeholder="e.g. Overnight stay"
                                    required
                                    autoFocus
                                />
                            </FormField>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    label="Price"
                                    htmlFor="rate-price"
                                    error={errors.price}
                                >
                                    <div className="relative">
                                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm leading-none text-muted-foreground">
                                            ₱
                                        </span>
                                        <Input
                                            id="rate-price"
                                            name="price"
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="0.01"
                                            defaultValue={rate?.price}
                                            placeholder="0.00"
                                            className="pl-7"
                                            required
                                        />
                                    </div>
                                </FormField>
                                <FormField
                                    label="Per"
                                    htmlFor="rate-unit"
                                    error={errors.rate_unit_id}
                                    hint={
                                        <Link
                                            href={settingsEdit()}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            Add or rename units
                                        </Link>
                                    }
                                >
                                    <Select
                                        name="rate_unit_id"
                                        defaultValue={
                                            rate
                                                ? String(rate.rate_unit_id)
                                                : suggestedUnit
                                        }
                                        required
                                    >
                                        <SelectTrigger
                                            id="rate-unit"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Choose a unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rateUnits.map((unit) => (
                                                <SelectItem
                                                    key={unit.id}
                                                    value={String(unit.id)}
                                                >
                                                    {unit.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormField>
                            </div>

                            <div className="flex items-start gap-3 rounded-lg border p-3">
                                <Checkbox
                                    id="rate-extension"
                                    name="is_extension_rate"
                                    value="1"
                                    defaultChecked={
                                        rate?.is_extension_rate ??
                                        state?.extension
                                    }
                                    className="mt-0.5"
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="rate-extension">
                                        Extension rate
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Charged when a guest extends their stay,
                                        not offered when booking.
                                    </p>
                                </div>
                            </div>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    {rate ? 'Save changes' : 'Add rate'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
