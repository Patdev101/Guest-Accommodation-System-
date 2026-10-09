import { Form, Head, usePage } from '@inertiajs/react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
};

export default function Profile({ company }: { company?: string | null }) {
    const { auth } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Profile settings" />

            <h1 className="sr-only">Profile settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Profile"
                    description="Update your name, email address and contact number"
                />

                <Form
                    {...ProfileController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    className="space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>

                                <Input
                                    id="name"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.name}
                                    name="name"
                                    required
                                    autoComplete="name"
                                    placeholder="Full name"
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.name}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>

                                <Input
                                    id="email"
                                    type="email"
                                    className="mt-1 block w-full"
                                    defaultValue={auth.user.email}
                                    name="email"
                                    required
                                    autoComplete="username"
                                    placeholder="Email address"
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.email}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="contact_number">
                                    Contact number
                                </Label>

                                <Input
                                    id="contact_number"
                                    type="tel"
                                    className="mt-1 block w-full"
                                    defaultValue={
                                        auth.user.contact_number ?? ''
                                    }
                                    name="contact_number"
                                    required={auth.user.role === 'guest'}
                                    autoComplete="tel"
                                    placeholder="09XX XXX XXXX"
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.contact_number}
                                />
                            </div>

                            {auth.user.role === 'guest' && (
                                <div className="grid gap-2">
                                    <Label htmlFor="company">Company</Label>

                                    <Input
                                        id="company"
                                        className="mt-1 block w-full"
                                        defaultValue={company ?? ''}
                                        name="company"
                                        autoComplete="organization"
                                        placeholder="The company you book for"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Filled in for you on a booking request.
                                        Change it here, or on the request
                                        itself, if you move to another company.
                                    </p>

                                    <InputError
                                        className="mt-2"
                                        message={errors.company}
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-profile-button"
                                >
                                    Save
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </div>

            <DeleteUser />
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile settings',
            href: edit(),
        },
    ],
};
