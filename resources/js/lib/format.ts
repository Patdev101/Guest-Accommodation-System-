const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const pesoWhole = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
});

const longDate = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
});

// "Now" is always read in the facility's time zone, so the server render and
// every browser show the same day and greeting.
const TIME_ZONE = 'Asia/Manila';

const weekdayDate = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
});

const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

const hour = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
});

/** ₱1,500.00, or ₱1,500 when the amount has no centavos. */
export function formatPeso(amount: string | number): string {
    const value = Number(amount);

    return Number.isInteger(value)
        ? pesoWhole.format(value)
        : peso.format(value);
}

/** A "YYYY-MM-DD" date shown as e.g. "29 Sept 2026", read in local time. */
export function formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    return longDate.format(new Date(year, month - 1, day));
}

export function formatToday(): string {
    return weekdayDate.format(new Date());
}

/** Today as "YYYY-MM-DD", for date inputs. */
export function todayIso(): string {
    return isoDate.format(new Date());
}

export function greeting(): string {
    const now = Number(hour.format(new Date()));

    if (now < 12) {
        return 'Good morning';
    }

    return now < 18 ? 'Good afternoon' : 'Good evening';
}

const dateTime = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
});

const dayAndTime = new Intl.DateTimeFormat('en-PH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
});

const clock = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
});

/** An ISO time from the server, e.g. "30 Sept 2026, 2:00 PM" (Manila time). */
export function formatDateTime(iso: string): string {
    return dateTime.format(new Date(iso));
}

/** "Thu, 1 Oct, 2:00 PM" (Manila time). */
export function formatDayTime(iso: string): string {
    return dayAndTime.format(new Date(iso));
}

/** Just the time of an ISO timestamp, e.g. "2:00 PM" (Manila time). */
export function formatTime(iso: string): string {
    return clock.format(new Date(iso));
}

/** A "14:00" setting or input value shown as "2:00 PM". */
export function formatClock(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return time;
    }

    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

const dayMonth = new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
});

/** Whether an ISO timestamp falls on today (Manila time). */
export function isToday(iso: string): boolean {
    return isoDate.format(new Date(iso)) === todayIso();
}

/** "2:00 PM" today, else "Thu, 1 Oct, 2:00 PM". */
export function formatWhen(iso: string): string {
    return isToday(iso) ? formatTime(iso) : formatDayTime(iso);
}

/** Short, for small tiles: "2:00 PM" today, else "1 Oct". */
export function formatShortWhen(iso: string): string {
    return isToday(iso) ? formatTime(iso) : dayMonth.format(new Date(iso));
}

/** Minutes as "45 minutes", "1 hour", "1 h 30 min", "2 days 3 h"; 0 is "none". */
export function formatMinutes(minutes: number): string {
    const total = Math.round(minutes);

    if (total <= 0) {
        return 'none';
    }

    if (total < 60) {
        return plural(total, 'minute');
    }

    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const rest = total % 60;

    if (days > 0) {
        return hours > 0
            ? `${plural(days, 'day')} ${hours} h`
            : plural(days, 'day');
    }

    return rest > 0 ? `${hours} h ${rest} min` : plural(hours, 'hour');
}

/** A form value "2026-10-01T14:00" (Manila wall time, UTC+8) in milliseconds. */
export function localToMs(value: string): number {
    return Date.parse(`${value}:00+08:00`);
}

/** A form value "2026-10-01T14:00" (Manila wall time) as "1 Oct 2026, 2:00 PM". */
export function formatLocal(value: string): string {
    const [date, time = '00:00'] = value.split('T');

    return `${formatDate(date)}, ${formatClock(time)}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`;
}

export function percent(part: number, whole: number): string {
    return whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;
}
