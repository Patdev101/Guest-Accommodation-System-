# Guest Accommodation System

Guest check-in, reservations, check-out, billing and room status for Mindoro Marine Manufacturing Corporation's Guest Villas, Barracks and any location added later.

- Requirements: [Guest-Accommodation-Documentation.pdf](Guest-Accommodation-Documentation.pdf) (source: [docs/guest-accommodation-documentation.html](docs/guest-accommodation-documentation.html))
- Process flow poster: [Guest-Accommodation-Flowchart.pdf](Guest-Accommodation-Flowchart.pdf) (source: [docs/guest-accommodation-flowchart.html](docs/guest-accommodation-flowchart.html))

**Stack:** Laravel 13, Inertia v3, React 19, Tailwind CSS 4, Microsoft SQL Server. Authentication is Laravel Fortify.

## Roles

| Role      | Can                                                                                   |
| --------- | ------------------------------------------------------------------------------------- |
| Guest     | Register online, see their reservations, bills and reminders                          |
| Reception | Front desk: check-in/out, walk-in bookings, IDs, payments, room status                |
| Admin     | Everything Reception can do, plus locations, rooms, rates, settings and user accounts |

Guests register themselves. Reception and Admin accounts are created by an Admin under **Users**.

## Local setup (Windows, SQL Server Express)

Requirements: PHP 8.3+ with the `sqlsrv` and `pdo_sqlsrv` extensions, Composer, Node 22+, SQL Server Express with ODBC Driver 17 or 18.

```powershell
# 1. Create the database (Windows authentication)
sqlcmd -S "localhost\SQLEXPRESS" -E -C -Q "CREATE DATABASE guest_accommodation"

# 2. Install and configure
composer install
npm install
copy .env.example .env
php artisan key:generate

# 3. Create the tables, the default rate units and settings, and the first Admin
php artisan migrate
php artisan db:seed      # prints the Admin email and password once

# 4. Run (web server, queue, logs and Vite together)
composer dev
```

Open http://localhost:8000 and log in as the Admin. Change the password under **Settings**.

`.env` uses Windows authentication by default (`DB_USERNAME` and `DB_PASSWORD` empty). For SQL Server authentication, fill both in.

## Checks

```powershell
composer test          # Pint, PHPStan, then PHPUnit (tests run on in-memory SQLite)
npm run check          # lint and format
npm run types:check    # TypeScript
```

## Build phases

1. **Foundation** ✅ SQL Server connection, login and registration, the three roles, the full database schema
2. Admin setup: locations, rooms, inclusions, rates, maintenance, settings
3. Reservations: availability calendar, earliest-slot finder, online and walk-in booking, downpayments
4. Check-in and check-out: verification, ID custody, inspection, damages, billing, refunds
5. Room board and notifications: live room status, 1-hour reminders and calls, extension rules
6. Reports: guest log, held IDs, unpaid company bills, occupancy
