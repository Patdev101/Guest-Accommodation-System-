import { Form, Head, usePage } from '@inertiajs/react';
import { Ban, KeyRound, Mail, UserCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import { ConfirmAction } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import InputError from '@/components/input-error';
import { Page, PageHeader } from '@/components/page';
import PasswordInput from '@/components/password-input';
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
import { Separator } from '@/components/ui/separator';
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
                    description="Guests register themselves. Reception and Admin accounts are created here. Accounts are deactivated, never deleted, so records keep their names."
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
                                    </TableCell>
                                    <TableCell>
                                        {user.is_active ? (
                                            <Badge variant="secondary">
                                                Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline">
                                                Deactivated
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="pr-4 text-right whitespace-nowrap">
                                        <IconButton
                                            label={`Reset password for ${user.name}`}
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
                roles={roles}
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

/** Two ways to help someone who forgot their password. */
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
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                Reset password for {user.name}
                            </DialogTitle>
                            <DialogDescription>
                                Email them a link to choose a new password, or
                                set one yourself and tell them in person.
                            </DialogDescription>
                        </DialogHeader>

                        <Form
                            {...UserController.sendResetLink.form(user.id)}
                            options={{ preserveScroll: true }}
                            onSuccess={onClose}
                        >
                            {({ processing }) => (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                                    <div className="min-w-0 text-sm">
                                        <p className="font-medium">
                                            Email a reset link
                                        </p>
                                        <p className="truncate text-muted-foreground">
                                            Sent to {user.email}
                                        </p>
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        disabled={processing}
                                    >
                                        {processing ? <Spinner /> : <Mail />}
                                        Send link
                                    </Button>
                                </div>
                            )}
                        </Form>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <Separator className="flex-1" />
                            or
                            <Separator className="flex-1" />
                        </div>

                        <Form
                            {...UserController.password.form(user.id)}
                            options={{ preserveScroll: true }}
                            onSuccess={onClose}
                            resetOnSuccess
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField
                                            label="New password"
                                            htmlFor="reset-password"
                                            error={errors.password}
                                        >
                                            <PasswordInput
                                                id="reset-password"
                                                name="password"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </FormField>
                                        <FormField
                                            label="Confirm password"
                                            htmlFor="reset-password-confirmation"
                                        >
                                            <PasswordInput
                                                id="reset-password-confirmation"
                                                name="password_confirmation"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </FormField>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            Set new password
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </>
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
                        Share the password with the person directly. They can
                        change it under Settings.
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
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    label="Password"
                                    htmlFor="password"
                                    error={errors.password}
                                >
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        autoComplete="new-password"
                                        required
                                    />
                                </FormField>
                                <FormField
                                    label="Confirm password"
                                    htmlFor="password_confirmation"
                                >
                                    <PasswordInput
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        autoComplete="new-password"
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
                                    Create account
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
