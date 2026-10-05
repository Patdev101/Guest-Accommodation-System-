import { Form, Head, usePage } from '@inertiajs/react';
import { Ban, KeyRound, Mail, UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import { ConfirmAction } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import InputError from '@/components/input-error';
import { Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { index } from '@/routes/admin/users';
import type { Role } from '@/types';

type Account = {
    id: number;
    name: string;
    email: string;
    role: Role;
    contact_number: string | null;
    is_active: boolean;
    awaits_password: boolean;
    is_self: boolean;
    is_last_admin: boolean;
};

type RoleOption = { value: Role; label: string };

type Props = {
    users: Account[];
    roles: RoleOption[];
};

const roleHelp: Record<Role, string> = {
    admin: 'They will be able to change rooms, rates, settings and user accounts.',
    reception:
        'They will run the front desk: check-ins, check-outs, bookings and payments. They lose any Admin access.',
    guest: 'They will only see their own reservations. They lose all staff access.',
};

export default function Users({ users, roles }: Props) {
    const { errors } = usePage().props as { errors: Record<string, string> };
    const [creating, setCreating] = useState(false);
    const [roleChange, setRoleChange] = useState<{
        user: Account;
        role: Role;
    } | null>(null);
    const [resetting, setResetting] = useState<Account | null>(null);
    const [toggling, setToggling] = useState<Account | null>(null);
    const roleLabel = (role: Role) =>
        roles.find((option) => option.value === role)?.label ?? role;

    return (
        <>
            <Head title="Users" />
            <Page>
                <PageHeader
                    title="Users"
                    description="Create Reception and Admin accounts here. Each person sets their own password from an emailed link."
                    actions={
                        <Button onClick={() => setCreating(true)}>
                            <UserPlus />
                            New account
                        </Button>
                    }
                />

                {(errors.role || errors.account) && (
                    <InputError message={errors.role ?? errors.account} />
                )}

                <Card className="gap-0 overflow-hidden py-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-4">Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="hidden lg:table-cell">
                                    Contact number
                                </TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-24 pr-4">
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow
                                    key={user.id}
                                    className={cn(
                                        !user.is_active &&
                                            'text-muted-foreground',
                                    )}
                                >
                                    <TableCell className="pl-4 font-medium">
                                        {user.name}
                                        {user.is_self && (
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                (you)
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {user.contact_number ?? '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={user.role}
                                            onValueChange={(role) =>
                                                setRoleChange({
                                                    user,
                                                    role: role as Role,
                                                })
                                            }
                                            disabled={
                                                user.is_self ||
                                                user.is_last_admin ||
                                                !user.is_active
                                            }
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                className="w-36"
                                                aria-label={`Role for ${user.name}`}
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roles
                                                    .filter(
                                                        (role) =>
                                                            role.value !==
                                                                'guest' ||
                                                            user.role ===
                                                                'guest',
                                                    )
                                                    .map((role) => (
                                                        <SelectItem
                                                            key={role.value}
                                                            value={role.value}
                                                        >
                                                            {role.label}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        {!user.is_active ? null : user.awaits_password ? (
                                            <Badge variant="outline">
                                                Awaiting password setup
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                Active
                                            </Badge>
                                        )}
                                        {user.is_active ? null : (
                                            <Badge variant="outline">
                                                Deactivated
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="pr-4 text-right whitespace-nowrap">
                                        <IconButton
                                            label={
                                                user.awaits_password
                                                    ? `Send the setup link to ${user.name} again`
                                                    : `Send ${user.name} a password reset link`
                                            }
                                            onClick={() => setResetting(user)}
                                            disabled={!user.is_active}
                                            disabledReason="Reactivate the account first"
                                        >
                                            <KeyRound />
                                        </IconButton>
                                        {user.is_active ? (
                                            <IconButton
                                                label={`Deactivate ${user.name}`}
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() =>
                                                    setToggling(user)
                                                }
                                                disabled={
                                                    user.is_self ||
                                                    user.is_last_admin
                                                }
                                                disabledReason={
                                                    user.is_self
                                                        ? 'You cannot deactivate yourself'
                                                        : 'The only administrator cannot be deactivated'
                                                }
                                            >
                                                <Ban />
                                            </IconButton>
                                        ) : (
                                            <IconButton
                                                label={`Reactivate ${user.name}`}
                                                onClick={() =>
                                                    setToggling(user)
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
            </Page>

            <NewAccountDialog
                open={creating}
                onOpenChange={setCreating}
                roles={roles.filter((role) => role.value !== 'guest')}
            />

            {roleChange && (
                <ConfirmAction
                    open
                    onOpenChange={(open) => !open && setRoleChange(null)}
                    title={`Make ${roleChange.user.name} ${roleLabel(roleChange.role)}?`}
                    description={roleHelp[roleChange.role]}
                    url={UserController.update.url(roleChange.user.id)}
                    method="patch"
                    data={{ role: roleChange.role }}
                    confirmLabel={`Make ${roleLabel(roleChange.role)}`}
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
                            ? 'They are logged out and cannot log in again until reactivated. Their name stays on past records.'
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

            <ResetPasswordDialog
                user={resetting}
                onClose={() => setResetting(null)}
            />
        </>
    );
}

/**
 * Email a password link. Two different emails: a setup link for an account
 * that never had a password, a reset link for someone who forgot theirs.
 * The Admin never types anyone's password.
 */
function ResetPasswordDialog({
    user,
    onClose,
}: {
    user: Account | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={user !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {user && (
                    <Form
                        {...UserController.sendResetLink.form(user.id)}
                        options={{ preserveScroll: true }}
                        onSuccess={onClose}
                        className="space-y-4"
                    >
                        {({ processing }) => (
                            <>
                                <DialogHeader>
                                    <DialogTitle>
                                        {user.awaits_password
                                            ? `Send the setup link to ${user.name} again?`
                                            : `Send ${user.name} a password reset link?`}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {user.awaits_password
                                            ? 'They have not set a password yet. The new link replaces the old one and works for 3 days.'
                                            : 'For someone who forgot their password. They choose a new one themselves; the link works for 60 minutes.'}
                                    </DialogDescription>
                                </DialogHeader>
                                <p className="truncate rounded-lg border px-3 py-2.5 text-sm">
                                    <span className="text-muted-foreground">
                                        Sent to{' '}
                                    </span>
                                    <span className="font-medium">
                                        {user.email}
                                    </span>
                                </p>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={processing}>
                                        {processing ? <Spinner /> : <Mail />}
                                        {user.awaits_password
                                            ? 'Send setup link'
                                            : 'Send reset link'}
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

function NewAccountDialog({
    open,
    onOpenChange,
    roles,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: RoleOption[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New account</DialogTitle>
                    <DialogDescription>
                        The person sets their own password from a link sent to
                        their email. Check the email address carefully.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...UserController.store.form()}
                    resetOnSuccess
                    onSuccess={() => onOpenChange(false)}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <FormField
                                label="Role"
                                htmlFor="role"
                                error={errors.role}
                            >
                                <Select name="role" defaultValue="reception">
                                    <SelectTrigger id="role" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem
                                                key={role.value}
                                                value={role.value}
                                            >
                                                {role.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <FormField
                                label="Name"
                                htmlFor="name"
                                error={errors.name}
                            >
                                <Input id="name" name="name" required />
                            </FormField>
                            <FormField
                                label="Email"
                                htmlFor="email"
                                error={errors.email}
                            >
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Contact number"
                                htmlFor="contact_number"
                                optional
                                error={errors.contact_number}
                            >
                                <Input
                                    id="contact_number"
                                    name="contact_number"
                                    type="tel"
                                />
                            </FormField>
                            <p className="flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                                <Mail className="mt-0.5 size-4 shrink-0" />
                                No password is set here. We email this person a
                                link to choose their own. It works for 3 days.
                            </p>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Create account and email link
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

Users.layout = {
    breadcrumbs: [
        {
            title: 'Users',
            href: index(),
        },
    ],
};
