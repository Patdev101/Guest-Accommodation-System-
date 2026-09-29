import { Form, Head, Link } from '@inertiajs/react';
import { ArrowRight, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import LocationController from '@/actions/App/Http/Controllers/Admin/LocationController';
import { ConfirmDelete } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import { Page, PageHeader } from '@/components/page';
import { StatusDot } from '@/components/room-status-badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
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
import { replaceQuery, useInitialQuery } from '@/lib/query';
import { index as locationsIndex } from '@/routes/admin/locations';
import { index as roomsIndex } from '@/routes/admin/rooms';
import type { RoomStatusGroup, StatusGroupOption } from '@/types';

type LocationItem = {
    id: number;
    name: string;
    description: string | null;
    rooms_count: number;
    capacity: number;
    groups: Record<RoomStatusGroup, number>;
};

type Props = {
    locations: LocationItem[];
    statusGroups: StatusGroupOption[];
};

type DialogState =
    | { mode: 'create' }
    | { mode: 'edit'; location: LocationItem };

export default function Locations({ locations, statusGroups }: Props) {
    const query = useInitialQuery();
    const [dialog, setDialog] = useState<DialogState | null>(() =>
        query.has('create') ? { mode: 'create' } : null,
    );
    const [deleting, setDeleting] = useState<LocationItem | null>(null);

    const closeDialog = () => {
        setDialog(null);
        replaceQuery({ create: null });
    };

    return (
        <>
            <Head title="Locations" />
            <Page>
                <PageHeader
                    title="Locations"
                    description="Places with rooms, such as Guest Villa or Barracks. Add as many as you need."
                    actions={
                        locations.length > 0 && (
                            <Button
                                onClick={() => setDialog({ mode: 'create' })}
                            >
                                <Plus />
                                Add location
                            </Button>
                        )
                    }
                />

                {locations.length === 0 ? (
                    <EmptyState
                        icon={MapPin}
                        title="No locations yet"
                        description="Add your first location, for example Guest Villa or Barracks. Rooms are added under a location."
                        action={
                            <Button
                                onClick={() => setDialog({ mode: 'create' })}
                            >
                                <Plus />
                                Add location
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {locations.map((location) => (
                            <Card key={location.id} className="gap-4 py-5">
                                <CardHeader className="flex flex-row items-start gap-3 px-5">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                        <MapPin className="size-4" />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <CardTitle className="truncate leading-snug">
                                            {location.name}
                                        </CardTitle>
                                        <CardDescription className="line-clamp-2">
                                            {location.description ??
                                                'No description'}
                                        </CardDescription>
                                    </div>
                                    <div className="-mt-1 -mr-2 flex shrink-0">
                                        <IconButton
                                            label={`Edit ${location.name}`}
                                            onClick={() =>
                                                setDialog({
                                                    mode: 'edit',
                                                    location,
                                                })
                                            }
                                        >
                                            <Pencil />
                                        </IconButton>
                                        <IconButton
                                            label={`Delete ${location.name}`}
                                            className="text-muted-foreground hover:text-destructive"
                                            disabled={location.rooms_count > 0}
                                            disabledReason="Remove its rooms before deleting"
                                            onClick={() =>
                                                setDeleting(location)
                                            }
                                        >
                                            <Trash2 />
                                        </IconButton>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4 px-5">
                                    <dl className="grid grid-cols-2 gap-4">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">
                                                Rooms
                                            </dt>
                                            <dd className="text-xl font-semibold">
                                                {location.rooms_count}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">
                                                Capacity
                                            </dt>
                                            <dd className="text-xl font-semibold">
                                                {location.capacity} pax
                                            </dd>
                                        </div>
                                    </dl>

                                    {location.rooms_count > 0 && (
                                        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                                            {statusGroups
                                                .filter(
                                                    (group) =>
                                                        location.groups[
                                                            group.value
                                                        ] > 0,
                                                )
                                                .map((group) => (
                                                    <li
                                                        key={group.value}
                                                        className="flex items-center gap-1.5"
                                                    >
                                                        <StatusDot
                                                            group={group.value}
                                                        />
                                                        <span className="font-medium">
                                                            {
                                                                location.groups[
                                                                    group.value
                                                                ]
                                                            }
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {group.label.toLowerCase()}
                                                        </span>
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </CardContent>

                                <CardFooter className="mt-auto border-t px-5 pt-4 [.border-t]:pt-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-3"
                                        asChild
                                    >
                                        <Link
                                            href={
                                                location.rooms_count > 0
                                                    ? roomsIndex({
                                                          query: {
                                                              location:
                                                                  location.id,
                                                          },
                                                      })
                                                    : roomsIndex({
                                                          query: {
                                                              create: 1,
                                                              location:
                                                                  location.id,
                                                          },
                                                      })
                                            }
                                        >
                                            {location.rooms_count > 0
                                                ? `View ${plural(location.rooms_count, 'room')}`
                                                : 'Add the first room'}
                                            <ArrowRight />
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </Page>

            <LocationDialog
                state={dialog}
                onOpenChange={(open) => !open && closeDialog()}
            />

            {deleting && (
                <ConfirmDelete
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={`Delete ${deleting.name}?`}
                    description="The location is removed for good. This cannot be undone."
                    url={LocationController.destroy.url(deleting.id)}
                />
            )}
        </>
    );
}

function LocationDialog({
    state,
    onOpenChange,
}: {
    state: DialogState | null;
    onOpenChange: (open: boolean) => void;
}) {
    const location = state?.mode === 'edit' ? state.location : null;

    return (
        <Dialog open={state !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {location ? 'Edit location' : 'Add location'}
                    </DialogTitle>
                    <DialogDescription>
                        {location
                            ? 'Rename it or change its description.'
                            : 'You add rooms to it on the next step.'}
                    </DialogDescription>
                </DialogHeader>

                <Form
                    key={location?.id ?? 'new'}
                    {...(location
                        ? LocationController.update.form(location.id)
                        : LocationController.store.form())}
                    options={{ preserveScroll: true }}
                    onSuccess={() => onOpenChange(false)}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <FormField
                                label="Name"
                                htmlFor="location-name"
                                error={errors.name}
                            >
                                <Input
                                    id="location-name"
                                    name="name"
                                    defaultValue={location?.name}
                                    placeholder="e.g. Guest Villa"
                                    required
                                    autoFocus
                                />
                            </FormField>
                            <FormField
                                label="Description"
                                htmlFor="location-description"
                                optional
                                error={errors.description}
                            >
                                <Textarea
                                    id="location-description"
                                    name="description"
                                    defaultValue={location?.description ?? ''}
                                    placeholder="Where it is and who usually stays there"
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
                                    {location ? 'Save changes' : 'Add location'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

Locations.layout = {
    breadcrumbs: [
        {
            title: 'Locations',
            href: locationsIndex(),
        },
    ],
};
