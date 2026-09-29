import { Link, usePage } from '@inertiajs/react';
import { BedDouble, LayoutGrid, MapPin, Settings2, Users } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { index as locationsIndex } from '@/routes/admin/locations';
import { index as roomsIndex } from '@/routes/admin/rooms';
import { edit as settingsEdit } from '@/routes/admin/settings';
import { index as usersIndex } from '@/routes/admin/users';
import type { NavItem, Role } from '@/types';

type NavSection = { label: string; roles: Role[]; items: NavItem[] };

// Reception and guest screens come in later phases; they see the dashboard only.
const sections: NavSection[] = [
    {
        label: 'Overview',
        roles: ['guest', 'reception', 'admin'],
        items: [{ title: 'Dashboard', href: dashboard(), icon: LayoutGrid }],
    },
    {
        label: 'Setup',
        roles: ['admin'],
        items: [
            {
                title: 'Rooms',
                href: roomsIndex(),
                icon: BedDouble,
                matchChildren: true,
            },
            { title: 'Locations', href: locationsIndex(), icon: MapPin },
            { title: 'System settings', href: settingsEdit(), icon: Settings2 },
        ],
    },
    {
        label: 'Accounts',
        roles: ['admin'],
        items: [{ title: 'Users', href: usersIndex(), icon: Users }],
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()}>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-4 pt-2">
                {sections
                    .filter((section) => section.roles.includes(auth.user.role))
                    .map((section) => (
                        <NavMain
                            key={section.label}
                            label={section.label}
                            items={section.items}
                        />
                    ))}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
