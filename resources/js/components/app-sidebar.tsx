import { Link, usePage } from '@inertiajs/react';
import {
    BedDouble,
    CalendarCheck,
    CalendarDays,
    ChartColumn,
    DatabaseBackup,
    HandCoins,
    History,
    IdCard,
    LayoutGrid,
    LogIn,
    LogOut,
    MapPin,
    Settings2,
    UserRound,
    Users,
} from 'lucide-react';
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
import { index as activityIndex } from '@/routes/admin/activity';
import { index as guestAccountsIndex } from '@/routes/admin/guest-accounts';
import { index as locationsIndex } from '@/routes/admin/locations';
import { index as roomsIndex } from '@/routes/admin/rooms';
import { edit as settingsEdit } from '@/routes/admin/settings';
import { index as usersIndex } from '@/routes/admin/users';
import { edit as optionsEdit } from '@/routes/admin/options';
import { index as reportsIndex } from '@/routes/admin/reports';
import { calendar, checkIn, pending } from '@/routes/reception';
import { index as refundsIndex } from '@/routes/reception/refunds';
import { index as reservationsIndex } from '@/routes/reception/reservations';
import { index as staysIndex } from '@/routes/reception/stays';
import type { NavItem, Role } from '@/types';

type NavSection = { label: string; roles: Role[]; items: NavItem[] };

// Guest screens come in a later phase; guests see the dashboard only.
const sections: NavSection[] = [
    {
        label: 'Overview',
        roles: ['guest', 'reception', 'admin'],
        items: [{ title: 'Dashboard', href: dashboard(), icon: LayoutGrid }],
    },
    {
        label: 'Front desk',
        // The Admin can do everything Reception can (owner, 6 Oct 2026).
        roles: ['reception', 'admin'],
        // Same order as the owner's simple demo (7 Oct 2026). "Check-out" is the
        // list of guests in house (the stays pages).
        items: [
            {
                title: 'Check-in',
                href: checkIn(),
                icon: LogIn,
                matchChildren: true,
            },
            {
                title: 'Check-out',
                href: staysIndex(),
                icon: LogOut,
                matchChildren: true,
            },
            {
                title: 'Reservations',
                href: reservationsIndex(),
                icon: CalendarCheck,
                matchChildren: true,
            },
            { title: 'Calendar', href: calendar(), icon: CalendarDays },
            { title: 'Unpaid and IDs held', href: pending(), icon: IdCard },
            { title: 'Refunds', href: refundsIndex(), icon: HandCoins },
        ],
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
            {
                title: 'Options and backups',
                href: optionsEdit(),
                icon: DatabaseBackup,
            },
        ],
    },
    {
        label: 'Records',
        roles: ['admin'],
        items: [{ title: 'Reports', href: reportsIndex(), icon: ChartColumn }],
    },
    {
        label: 'Accounts',
        roles: ['admin'],
        items: [
            { title: 'Users', href: usersIndex(), icon: Users },
            {
                title: 'Guest accounts',
                href: guestAccountsIndex(),
                icon: UserRound,
            },
            { title: 'Activity log', href: activityIndex(), icon: History },
        ],
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
