import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    BedDouble,
    ChevronRight,
    MapPin,
    Plus,
    Search,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { RoomFormDialog } from '@/components/admin/room-form-dialog';
import { EmptyState } from '@/components/empty-state';
import { Page, PageHeader } from '@/components/page';
import { RoomStatusBadge, StatusDot } from '@/components/room-status-badge';
import { RoomThumb } from '@/components/room-thumb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatPeso, plural } from '@/lib/format';
import { replaceQuery, useInitialQuery } from '@/lib/query';
import { index as locationsIndex } from '@/routes/admin/locations';
import { index as roomsIndex, show as roomsShow } from '@/routes/admin/rooms';
import type {
    LocationOption,
    RoomStatus,
    RoomStatusGroup,
    RoomSummary,
    StatusGroupOption,
} from '@/types';

type RoomRow = RoomSummary & {
    rates_count: number;
    has_extension_rate: boolean;
    from_price: string | null;
    from_unit: string | null;
    inclusions_count: number;
};

type Props = {
    rooms: RoomRow[];
    locations: LocationOption[];
    statuses: { value: RoomStatus; label: string; group: RoomStatusGroup }[];
    statusGroups: StatusGroupOption[];
};

type Missing = '' | 'rates' | 'extension';

const ALL = 'all';

export default function Rooms({ rooms, locations, statuses }: Props) {
    const query = useInitialQuery();
    const [search, setSearch] = useState(() => query.get('search') ?? '');
    const [location, setLocation] = useState(
        () => query.get('location') ?? ALL,
    );
    const [status, setStatus] = useState(() => query.get('status') ?? ALL);
    const [missing, setMissing] = useState<Missing>(
        () => (query.get('missing') as Missing | null) ?? '',
    );
    const [creating, setCreating] = useState(
        () => query.has('create') && locations.length > 0,
    );

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        return rooms.filter(
            (room) =>
                (term === '' ||
                    room.name.toLowerCase().includes(term) ||
                    (room.location ?? '').toLowerCase().includes(term)) &&
                (location === ALL || String(room.location_id) === location) &&
                (status === ALL || room.status === status) &&
                (missing !== 'rates' || room.rates_count === 0) &&
                (missing !== 'extension' || !room.has_extension_rate),
        );
    }, [rooms, search, location, status, missing]);

    const filtering =
        search !== '' || location !== ALL || status !== ALL || missing !== '';

    const update = (key: string, value: string) => {
        replaceQuery({ [key]: value === ALL ? null : value });
    };

    const clearFilters = () => {
        setSearch('');
        setLocation(ALL);
        setStatus(ALL);
        setMissing('');
        replaceQuery({
            search: null,
            location: null,
            status: null,
            missing: null,
        });
    };

    const closeCreate = () => {
        setCreating(false);
        replaceQuery({ create: null });
    };

    const defaultLocationId =
        location !== ALL
            ? Number(location)
            : Number(query.get('location')) || null;

    return (
        <>
            <Head title="Rooms" />
            <Page>
                <PageHeader
                    title="Rooms"
                    description={
                        rooms.length > 0
                            ? `${plural(rooms.length, 'room')} across ${plural(locations.length, 'location')}. Open a room to set its rates, inclusions and status.`
                            : 'Every room guests can stay in, grouped by location.'
                    }
                    actions={
                        locations.length > 0 &&
                        rooms.length > 0 && (
                            <Button onClick={() => setCreating(true)}>
                                <Plus />
                                Add room
                            </Button>
                        )
                    }
                />

                {locations.length === 0 ? (
                    <EmptyState
                        icon={MapPin}
                        title="Add a location first"
                        description="Rooms belong to a location such as Guest Villa or Barracks."
                        action={
                            <Button asChild>
                                <Link
                                    href={locationsIndex({
                                        query: { create: 1 },
                                    })}
                                >
                                    <Plus />
                                    Add location
                                </Link>
                            </Button>
                        }
                    />
                ) : rooms.length === 0 ? (
                    <EmptyState
                        icon={BedDouble}
                        title="No rooms yet"
                        description="Add your first room. You can set its rates and inclusions right after."
                        action={
                            <Button onClick={() => setCreating(true)}>
                                <Plus />
                                Add room
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-64">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        update('search', event.target.value);
                                    }}
                                    placeholder="Search rooms"
                                    aria-label="Search rooms"
                                    className="pl-9"
                                />
                            </div>
                            <Select
                                value={location}
                                onValueChange={(value) => {
                                    setLocation(value);
                                    update('location', value);
                                }}
                            >
                                <SelectTrigger
                                    className="w-full sm:w-44"
                                    aria-label="Location"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>
                                        All locations
                                    </SelectItem>
                                    {locations.map((item) => (
                                        <SelectItem
                                            key={item.id}
                                            value={String(item.id)}
                                        >
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={status}
                                onValueChange={(value) => {
                                    setStatus(value);
                                    update('status', value);
                                }}
                            >
                                <SelectTrigger
                                    className="w-full sm:w-48"
                                    aria-label="Status"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>
                                        All statuses
                                    </SelectItem>
                                    {statuses.map((item) => (
                                        <SelectItem
                                            key={item.value}
                                            value={item.value}
                                        >
                                            <StatusDot group={item.group} />
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {missing !== '' && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setMissing('');
                                        update('missing', '');
                                    }}
                                >
                                    {missing === 'rates'
                                        ? 'Without a price'
                                        : 'Without an extension rate'}
                                    <X />
                                </Button>
                            )}
                            {filtering && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                >
                                    Clear filters
                                </Button>
                            )}
                            <span className="ml-auto text-sm text-muted-foreground">
                                {filtering
                                    ? `${filtered.length} of ${rooms.length}`
                                    : plural(rooms.length, 'room')}
                            </span>
                        </div>

                        {filtered.length === 0 ? (
                            <EmptyState
                                icon={Search}
                                title="No rooms match these filters"
                                action={
                                    <Button
                                        variant="outline"
                                        onClick={clearFilters}
                                    >
                                        Clear filters
                                    </Button>
                                }
                            />
                        ) : (
                            <Card className="gap-0 overflow-hidden py-0">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="pl-4">
                                                Room
                                            </TableHead>
                                            <TableHead className="hidden md:table-cell">
                                                Location
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Pax
                                            </TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead className="hidden text-right lg:table-cell">
                                                Inclusions
                                            </TableHead>
                                            <TableHead className="w-10">
                                                <span className="sr-only">
                                                    Open
                                                </span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((room) => (
                                            <TableRow
                                                key={room.id}
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    router.visit(
                                                        roomsShow(room.id),
                                                    )
                                                }
                                            >
                                                <TableCell className="pl-4">
                                                    <div className="flex items-center gap-3">
                                                        <RoomThumb
                                                            url={room.cover_url}
                                                        />
                                                        <div>
                                                            <Link
                                                                href={roomsShow(
                                                                    room.id,
                                                                )}
                                                                className="font-medium underline-offset-4 hover:underline"
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                            >
                                                                {room.name}
                                                            </Link>
                                                            <p className="text-xs text-muted-foreground md:hidden">
                                                                {room.location}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden text-muted-foreground md:table-cell">
                                                    {room.location}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {room.pax_capacity}
                                                </TableCell>
                                                <TableCell>
                                                    <RoomStatusBadge
                                                        group={room.group}
                                                        label={
                                                            room.status_label
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {room.from_price ? (
                                                        <div>
                                                            <span className="tabular-nums">
                                                                {room.rates_count >
                                                                    1 &&
                                                                    'from '}
                                                                {formatPeso(
                                                                    room.from_price,
                                                                )}
                                                            </span>
                                                            <span className="text-muted-foreground">
                                                                {' '}
                                                                /{' '}
                                                                {room.from_unit?.toLowerCase()}
                                                            </span>
                                                            {!room.has_extension_rate && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    No extension
                                                                    rate
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                                            <AlertTriangle className="size-3.5" />
                                                            No price yet
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="hidden text-right text-muted-foreground tabular-nums lg:table-cell">
                                                    {room.inclusions_count ||
                                                        '—'}
                                                </TableCell>
                                                <TableCell className="pr-4 text-muted-foreground">
                                                    <ChevronRight className="size-4" />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        )}
                    </>
                )}
            </Page>

            <RoomFormDialog
                open={creating}
                onOpenChange={(open) =>
                    open ? setCreating(true) : closeCreate()
                }
                locations={locations}
                defaultLocationId={defaultLocationId}
            />
        </>
    );
}

Rooms.layout = {
    breadcrumbs: [
        {
            title: 'Rooms',
            href: roomsIndex(),
        },
    ],
};
