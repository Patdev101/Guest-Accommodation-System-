import { Form, Head, router, usePage } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
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
    const [newRole, setNewRole] = useState<Role>('reception');

    const changeRole = (user: Account, role: string) =>
        router.patch(
            UserController.update.url(user.id),
            { role },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title="Users" />
            <div className="flex flex-col gap-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title="Users"
                        description="Guests register themselves. Reception and Admin accounts are created here."
                    />

                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <UserPlus />
                                New account
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogTitle>New account</DialogTitle>
                            <DialogDescription>
                                Share the password with the person directly.
                                They can change it under Settings.
                            </DialogDescription>

                            <Form
                                {...UserController.store.form()}
                                resetOnSuccess
                                onSuccess={() => setOpen(false)}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <input
                                            type="hidden"
                                            name="role"
                                            value={newRole}
                                        />
                                        <div className="grid gap-2">
                                            <Label htmlFor="role">Role</Label>
                                            <Select
                                                value={newRole}
                                                onValueChange={(value) =>
                                                    setNewRole(value as Role)
                                                }
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
                                            <InputError message={errors.role} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Name</Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                required
                                            />
                                            <InputError message={errors.name} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                required
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="contact_number">
                                                Contact number
                                            </Label>
                                            <Input
                                                id="contact_number"
                                                name="contact_number"
                                                type="tel"
                                            />
                                            <InputError
                                                message={errors.contact_number}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="password">
                                                Password
                                            </Label>
                                            <PasswordInput
                                                id="password"
                                                name="password"
                                                autoComplete="new-password"
                                                required
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="password_confirmation">
                                                Confirm password
                                            </Label>
                                            <PasswordInput
                                                id="password_confirmation"
                                                name="password_confirmation"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </div>
                                        <DialogFooter className="gap-2">
                                            <DialogClose asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                >
                                                    Cancel
                                                </Button>
                                            </DialogClose>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Create account
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 font-medium">Name</th>
                                <th className="px-4 py-2 font-medium">Email</th>
                                <th className="px-4 py-2 font-medium">
                                    Contact number
                                </th>
                                <th className="px-4 py-2 font-medium">Role</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-4 py-2 font-medium">
                                        {user.name}
                                    </td>
                                    <td className="px-4 py-2">{user.email}</td>
                                    <td className="px-4 py-2">
                                        {user.contact_number ?? '—'}
                                    </td>
                                    <td className="px-4 py-2">
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
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
