import { Form } from '@inertiajs/react';
import RoomController from '@/actions/App/Http/Controllers/Admin/RoomController';
import { FormField } from '@/components/form-field';
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
import type { LocationOption } from '@/types';

export type EditableRoom = {
    id: number;
    name: string;
    location_id: number;
    pax_capacity: number;
    description: string | null;
};

/** Add a room, or edit one when `room` is given. */
export function RoomFormDialog({
    open,
    onOpenChange,
    locations,
    room,
    defaultLocationId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locations: LocationOption[];
    room?: EditableRoom;
    defaultLocationId?: number | null;
}) {
    const initialLocation =
        room?.location_id ??
        defaultLocationId ??
        (locations.length === 1 ? locations[0].id : undefined);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{room ? 'Edit room' : 'Add room'}</DialogTitle>
                    <DialogDescription>
                        {room
                            ? 'Change the room’s name, location, capacity or description.'
                            : 'Rates and inclusions are added on the room’s page next.'}
                    </DialogDescription>
                </DialogHeader>

                <Form
                    key={room?.id ?? 'new'}
                    {...(room
                        ? RoomController.update.form(room.id)
                        : RoomController.store.form())}
                    options={{ preserveScroll: true }}
                    onSuccess={() => onOpenChange(false)}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <FormField
                                label="Location"
                                htmlFor="room-location"
                                error={errors.location_id}
                            >
                                <Select
                                    name="location_id"
                                    defaultValue={
                                        initialLocation
                                            ? String(initialLocation)
                                            : undefined
                                    }
                                    required
                                >
                                    <SelectTrigger
                                        id="room-location"
                                        className="w-full"
                                    >
                                        <SelectValue placeholder="Choose a location" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map((location) => (
                                            <SelectItem
                                                key={location.id}
                                                value={String(location.id)}
                                            >
                                                {location.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                                <FormField
                                    label="Room name or number"
                                    htmlFor="room-name"
                                    error={errors.name}
                                >
                                    <Input
                                        id="room-name"
                                        name="name"
                                        defaultValue={room?.name}
                                        placeholder="e.g. Villa 3"
                                        required
                                        autoFocus
                                    />
                                </FormField>
                                <FormField
                                    label="Pax capacity"
                                    htmlFor="room-pax"
                                    error={errors.pax_capacity}
                                >
                                    <Input
                                        id="room-pax"
                                        name="pax_capacity"
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={100}
                                        defaultValue={room?.pax_capacity ?? 2}
                                        required
                                    />
                                </FormField>
                            </div>
                            <p className="-mt-2 text-xs text-muted-foreground">
                                Pax is the most people allowed in one booking. A
                                room is never shared between separate guests.
                            </p>

                            <FormField
                                label="Description"
                                htmlFor="room-description"
                                optional
                                error={errors.description}
                            >
                                <Textarea
                                    id="room-description"
                                    name="description"
                                    defaultValue={room?.description ?? ''}
                                    placeholder="Beds, view, floor, anything guests should know"
                                    rows={3}
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
                                    {room ? 'Save changes' : 'Add room'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
