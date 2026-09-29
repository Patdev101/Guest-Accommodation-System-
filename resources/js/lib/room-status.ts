import type { RoomStatusGroup } from '@/types/admin';

/**
 * Colour per status group, as CSS variables so light and dark mode each use
 * their own validated step (see resources/css/app.css). Colour marks identity
 * only; the status label is always shown next to it.
 */
export const groupColor: Record<RoomStatusGroup, string> = {
    available: 'var(--room-available)',
    in_use: 'var(--room-in-use)',
    turnover: 'var(--room-turnover)',
    unavailable: 'var(--room-unavailable)',
};

export const groupOrder: RoomStatusGroup[] = [
    'available',
    'in_use',
    'turnover',
    'unavailable',
];
