import { Form, Head, router, usePage } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import { FormField } from '@/components/form-field';
import { Page, PageHeader } from '@/components/page';
import PasswordInput from '@/components/password-input';
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
import { index } from '@/routes/admin/users';
import type { Role } from '@/types';

type Account = {
    id: number;
    name: string;
    email: string;
    role: Role;
    contact_number: string | null;
};

type Props = {
    users: Account[];
    roles: { value: Role; label: string }[];
};

export default function Users({ users, roles }: Props) {
    const { auth } = usePage().props;
    const [open, setOpen] = useState(false);

    const changeRole = (user: Account, role: string) =>
        router.patch(
            UserController.update.url(user.id),
            { role },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title="Users" />
            <Page>
                <PageHeader
                    title="Users"
                    description="Guests register themselves. Reception and Admin accounts are created here."
                    actions={
                        <Button onClick={() => setOpen(true)}>
                            <UserPlus />
                            New account
                        </Button>
                    }
                />

                <Card className="gap-0 overflow-hidden py-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-4">Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead className="hidden md:table-cell">
                                    Contact number
                                </TableHead>
                                <TableHead className="pr-4">Role</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="pl-4 font-medium">
                                        {user.name}
                                        {user.id === auth.user.id && (
                                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                (you)
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell className="hidden text-muted-foreground md:table-cell">
                                        {user.contact_number ?? '—'}
                                    </TableCell>
                                    <TableCell className="pr-4">
                                        <Select
                                            value={user.role}
                                            onValueChange={(role) =>
                                                changeRole(user, role)
                                            }
                                            disabled={user.id === auth.user.id}
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </Page>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New account</DialogTitle>
                        <DialogDescription>
                            Share the password with the person directly. They
                            can change it under Settings.
                        </DialogDescription>
                    </DialogHeader>

                    <Form
                        {...UserController.store.form()}
                        resetOnSuccess
                        onSuccess={() => setOpen(false)}
                        className="space-y-4"
                    >
                        {({ processing, errors }) => (
                            <>
                                <FormField
                                    label="Role"
                                    htmlFor="role"
                                    error={errors.role}
                                >
                                    <Select
                                        name="role"
                                        defaultValue="reception"
                                    >
                                        <SelectTrigger
                                            id="role"
                                            className="w-full"
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
        </>
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
