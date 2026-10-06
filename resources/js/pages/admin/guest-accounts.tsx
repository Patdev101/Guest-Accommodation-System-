import { Head, router } from '@inertiajs/react';
import { Ban, KeyRound, Search, UserCheck, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import { ConfirmAction } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { Page, PageHeader } from '@/components/page';
import { Pager } from '@/components/pager';
import { Badge } from '@/components/ui/badge';
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
import { formatDate, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index } from '@/routes/admin/guest-accounts';
import type { Paginated } from '@/types';

type Account = {
    id: number;
    name: string;
    email: string;
    contact_number: string | null;
    is_active: boolean;
    awaits_password: boolean;
    registered_at: string | null;
    deactivated_at: string | null;
};

type Props = {
    accounts: Paginated<Account>;
    show: string;
    search: string;
    filterOptions: { value: string; label: string }[];
    totals: { all: number; deactivated: number };
};

export default function GuestAccounts({
    accounts,
    show,
    search: currentSearch,
    filterOptions,
    totals,
}: Props) {
    const [search, setSearch] = useState(currentSearch);
    const [resetting, setResetting] = useState<Account | null>(null);
    const [toggling, setToggling] = useState<Account | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const visit = (params: { show?: string; search?: string }) =>
        router.get(
            index().url,
            {
                show: params.show ?? show,
                search: (params.search ?? search) || undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    // Search as the user types, after a short pause.
    const changeSearch = (value: string) => {
        setSearch(value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => visit({ search: value }), 300);
    };

    return (
        <>
            <Head title="Guest accounts" />
            <Page>
                <PageHeader
                    title="Guest accounts"
                    description="Accounts guests made for themselves. Deactivate one, or email its owner a link when they cannot get in. Staff accounts are on the Users page."
                />

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            value={search}
                            onChange={(event) =>
                                changeSearch(event.target.value)
                            }
                            placeholder="Name, email or number"
                            aria-label="Search guest accounts"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={show}
                        onValueChange={(value) => visit({ show: value })}
                    >
                        <SelectTrigger
                            className="w-full sm:w-48"
                            aria-label="Show"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {filterOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="ml-auto text-sm text-muted-foreground">
                        {plural(totals.all, 'guest account')},{' '}
                        {totals.deactivated} deactivated
                    </p>
                </div>

                {accounts.data.length === 0 ? (
                    <EmptyState
                        icon={UserRound}
                        title={
                            totals.all === 0
                                ? 'No guest accounts yet'
                                : 'No guest accounts match'
                        }
                        description={
                            totals.all === 0
                                ? 'Guests appear here after they register on the website.'
                                : 'Try another name, or show all accounts.'
                        }
                    />
                ) : (
                    <Card className="gap-0 overflow-hidden py-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="hidden lg:table-cell">
                                        Contact number
                                    </TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        Registered
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-24 pr-4">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accounts.data.map((account) => (
                                    <TableRow
                                        key={account.id}
                                        className={cn(
                                            !account.is_active &&
                                                'text-muted-foreground',
                                        )}
                                    >
                                        <TableCell className="pl-4 font-medium">
                                            {account.name}
                                        </TableCell>
                                        <TableCell>{account.email}</TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            {account.contact_number ?? '—'}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {account.registered_at
                                                ? formatDate(
                                                      account.registered_at,
                                                  )
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {account.is_active ? (
                                                <Badge variant="secondary">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <>
                                                    <Badge variant="outline">
                                                        Deactivated
                                                    </Badge>
                                                    {account.deactivated_at && (
                                                        <span className="block text-xs">
                                                            since{' '}
                                                            {formatDate(
                                                                account.deactivated_at,
                                                            )}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-4 text-right whitespace-nowrap">
                                            <IconButton
                                                label={`Send ${account.name} a password link`}
                                                onClick={() =>
                                                    setResetting(account)
                                                }
                                                disabled={!account.is_active}
                                                disabledReason="Reactivate the account first"
                                            >
                                                <KeyRound />
                                            </IconButton>
                                            {account.is_active ? (
                                                <IconButton
                                                    label={`Deactivate ${account.name}`}
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        setToggling(account)
                                                    }
                                                >
                                                    <Ban />
                                                </IconButton>
                                            ) : (
                                                <IconButton
                                                    label={`Reactivate ${account.name}`}
                                                    onClick={() =>
                                                        setToggling(account)
                                                    }
                                                >
                                                    <UserCheck />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                <Pager page={accounts} />
            </Page>

            {resetting && (
                <ConfirmAction
                    open
                    onOpenChange={(open) => !open && setResetting(null)}
                    title={`Send ${resetting.name} a password link?`}
                    description={`For a guest who cannot get into their account. A link is emailed to ${resetting.email}; they choose a new password themselves. You never see or set it.`}
                    url={UserController.sendResetLink.url(resetting.id)}
                    method="post"
                    confirmLabel="Send link"
                />
            )}

            {toggling && (
                <ConfirmAction
                    open
                    onOpenChange={(open) => !open && setToggling(null)}
                    title={
                        toggling.is_active
                            ? `Deactivate ${toggling.name}?`
                            : `Reactivate ${toggling.name}?`
                    }
                    description={
                        toggling.is_active
                            ? 'They are logged out and cannot log in or book until reactivated. Their past bookings and records stay as they are.'
                            : 'They can log in again with their current password.'
                    }
                    url={
                        toggling.is_active
                            ? UserController.deactivate.url(toggling.id)
                            : UserController.activate.url(toggling.id)
                    }
                    method="patch"
                    confirmLabel={
                        toggling.is_active ? 'Deactivate' : 'Reactivate'
                    }
                    destructive={toggling.is_active}
                />
            )}
        </>
    );
}

GuestAccounts.layout = {
    breadcrumbs: [{ title: 'Guest accounts', href: index() }],
};
