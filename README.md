# Guest Accommodation System

**Last updated:** 29 September 2026
**Status:** Phase 1 (foundation) and Phase 2 (admin setup and admin dashboard) are done. Phase 3 (reservations) is next.

This README is the full context for anyone, human or AI, continuing this project. Read it before changing anything. The detailed business requirements are in `docs/guest-accommodation-documentation.html` (PDF: `Guest-Accommodation-Documentation.pdf`, v1.1). This README summarises them and records every decision made since.

---

## 0. How to work on this project (read first if you are an AI assistant)

- **You may not have the code.** The owner will paste files you ask for. Ask for exact paths from the code map (section 8), a few at a time. Do not guess file contents.
- **Give changes the owner can apply without interpretation:** either a complete replacement file, or an exact "find this / replace with this" edit. Always state the full path.
- **Give commands for Windows PowerShell 5.1.** The machine runs Windows 11. `git` is not on PATH in the owner's terminal (the owner uses GitHub Desktop). There is no `&&` in PowerShell 5.1; use `;`.
- **After every change,** tell the owner to run the checks in section 5 and to paste any failure output back.
- **Follow the conventions in section 9 exactly.** They exist because of problems already hit, such as server-rendering mismatches and SQL Server cascade errors.
- **The owner's preferences:**
    - short, clear answers
    - step-by-step instructions
    - admin features first
    - consistent, easy-to-use UI (see section 9, "UX rules")
- **Unclear rules:** if a business rule is not covered here or in the requirements document, ask the owner. Do not invent one. Open questions are listed in section 12.

---

## 1. What the system is

A web system for **Mindoro Marine Manufacturing Corporation** that runs guest check-in, reservations, check-out, billing and room status for company accommodation. Rooms are at the **Guest Villa**, the **Barracks** and any location the Admin adds later.

| Role          | Does                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Guest**     | Registers online, books advance reservations, sees their reservations, bills and reminders                                |
| **Reception** | Checks guests in and out, books walk-ins, verifies guests, holds IDs, calls guests, records payments, updates room status |
| **Admin**     | Everything Reception can do, plus locations, rooms, rates, settings, user accounts and reports                            |

Guests self-register. Reception and Admin accounts are created by an Admin on the **Users** page.

---

## 2. Current status

| Phase                           | Scope                                                                                                                                             | Status      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1. Foundation                   | SQL Server connection, login and registration, three roles, full database schema                                                                  | ✅ Done     |
| 2. Admin setup                  | Locations, rooms, inclusions, rates, maintenance, settings, admin dashboard, UX pass                                                              | ✅ Done     |
| 2b. Room photos                 | Admin uploads photos per room (cover photo, order, captions)                                                                                      | ⏭ Next      |
| 3. Reservations                 | Public room browsing (Airbnb-style), availability calendar, earliest-slot finder, online and walk-in booking, downpayments, cancellation, no-show | Planned     |
| 4. Check-in and check-out       | Verification, ID custody, stays, inspection, damages, billing, refunds                                                                            | Not started |
| 5. Room board and notifications | Live room status, 1-hour reminders and calls, extension rules with Guest B consent                                                                | Not started |
| 6. Reports                      | Guest log, held IDs, unpaid company bills, occupancy                                                                                              | Not started |

The owner asked to build **admin screens only for now**. Reception and guest screens come later: their dashboards (`resources/js/pages/dashboard.tsx`) are placeholders.

**Decided 29 Sep 2026 (not built yet):**

- **Guests browse like Airbnb.** Anyone can browse rooms, photos, rates and availability **without logging in**. Logging in (or signing up) is required only when they click to book.
- **Room photos.** The Admin can add photos to every room to showcase it; guests see them while browsing.

Reservations are mainly **Reception's** job (walk-ins, managing all bookings, cancellations, no-shows, payments, refunds). Guests make and cancel **their own** online bookings.

Verification at handoff:

- **PHP tests:** 72 passing, 3 skipped. The skipped ones are the starter kit's two-factor tests; two-factor login is switched off.
- **Static checks:** PHPStan, Pint, ESLint/format and TypeScript are all clean.
- **SQL Server:** tested live against SQL Server Express.

---

## 3. Tech stack

| Layer                | Technology                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend              | Laravel **13.33**, PHP 8.3+ (local machine runs 8.5), Laravel Fortify 1.40 for authentication                                                                                                                        |
| Frontend             | Inertia.js **v3** (inertia-laravel 3.4, @inertiajs/react 3), React **19**, TypeScript 5, Tailwind CSS **4**                                                                                                          |
| UI components        | shadcn-style components on Radix UI in `resources/js/components/ui`, lucide-react icons, sonner toasts                                                                                                               |
| Routes in TypeScript | Laravel **Wayfinder**, which generates `resources/js/actions/**` and `resources/js/routes/**`. Never edit those by hand.                                                                                             |
| Build                | Vite 8 through **vite-plus** (`vp`). Server-side rendering (SSR) is **off by default** (`INERTIA_SSR_ENABLED=false`, `config/inertia.php`) because it slowed every page in development; code must still be SSR-safe. |
| Database             | **Microsoft SQL Server Express** (`localhost\SQLEXPRESS`), database `guest_accommodation`, **Windows authentication** (empty `DB_USERNAME`/`DB_PASSWORD`), `pdo_sqlsrv`                                              |
| Tests                | PHPUnit 12 on **in-memory SQLite** (`phpunit.xml`); Larastan/PHPStan; Pint                                                                                                                                           |
| Starting point       | Official `laravel/react-starter-kit` (main branch), with email verification, two-factor login and passkeys removed                                                                                                   |

Time zone: `APP_TIMEZONE=Asia/Manila`. Currency: Philippine peso (₱), formatted with `en-PH`.

---

## 4. Local environment

- **Project folder:** `C:\Users\Temp\Documents\GitHub\Guest-Accommodation-System-`. The requirements document mentions `C:\projects\shogun\GuestAccomodation`, which is outdated.
- **`.env`:**
    - `DB_CONNECTION=sqlsrv`
    - `DB_HOST=localhost\SQLEXPRESS`
    - `DB_PORT=` (empty, because it is a named instance)
    - `DB_DATABASE=guest_accommodation`
    - `DB_TRUST_SERVER_CERTIFICATE=true`
    - `config/database.php` treats an empty username as Windows authentication.
- **First Admin:** created by `php artisan db:seed` from `ADMIN_EMAIL` (default `admin@example.com`) and `ADMIN_PASSWORD`. If the password is empty, a random one is generated and printed once. Passwords are never stored in this document.
- **Temporary demo setup:** a demo copy may still be running on `http://127.0.0.1:8124` against a throwaway database `guest_accommodation_demo`. It is safe to stop it and drop that database.
- **Mail:** not configured (`MAIL_MAILER=log`), so password-reset emails are only written to `storage/logs/laravel.log`.

---

## 5. Commands

```powershell
# Install / first run
composer install
npm install
# SQL Server Express creates databases with AUTO_CLOSE ON, which causes random
# "Shared Memory Provider: Timeout error [258]" pages. Turn it off once:
sqlcmd -S "localhost\SQLEXPRESS" -E -C -Q "ALTER DATABASE guest_accommodation SET AUTO_CLOSE OFF"
php artisan migrate
php artisan db:seed                       # rate units, default settings, first Admin
php artisan db:seed --class=DemoSeeder    # OPTIONAL sample data, only into an EMPTY database

# Run everything for development (web server, queue, logs, Vite)
composer dev                              # http://localhost:8000

# After adding or renaming routes/controllers (Vite also does this automatically)
php artisan wayfinder:generate --with-form

# Checks - run after every change
composer test          # Pint (lint) + PHPStan (1G memory) + PHPUnit
npm run check          # ESLint + formatting (use `npm run check:fix` to auto-fix)
npm run types:check    # TypeScript
npm run build          # production assets; the tests need public/build/manifest.json if Vite dev is not running
```

---

## 6. Business rules (authoritative)

These combine the requirements document with the owner's decisions of 29 Sep 2026. Where they differ from the v1.0 document, **these win**.

### Rooms and locations

1. Everything about rooms is entered by the Admin; nothing is hard-coded. A location contains rooms. A room has a name, **pax capacity** (the most people in one booking), a description, inclusions, several rates and maintenance records.
2. **One booking per room.** A room is never shared between separate guests.
3. **Rates** have a name, a price and a unit (Per hour, Overnight, Day tour, or a custom unit the Admin adds). **Prices are entered manually by the Admin.** A rate is either _standard_ (what guests book) or an **extension rate** (`is_extension_rate`, charged when a stay is extended).
4. **Room status is the physical state only:** Available, Occupied, Check-out, Inspection, Cleaning, Under maintenance, Out of service. **"Reserved" is NOT a room status.** It is derived from the reservations table, so a room can be Occupied now and reserved for later.
5. Allowed status changes (`app/Enums/RoomStatus.php`):
    - Available → Occupied (check-in), Under maintenance, Out of service
    - Occupied → Check-out
    - Check-out → Inspection
    - Inspection → Cleaning, Under maintenance
    - Cleaning / Under maintenance / Out of service → Available

    **Manual changes** (from the room page) exclude Occupied, Check-out and Inspection; those are driven by check-in and check-out. Setting Under maintenance requires an issue description, which is logged as a maintenance record. Returning from Under maintenance to Available fills in the open record's "action taken" and "done by".

5a. **Room photos (to build):** the Admin uploads several photos per room on the room page. One is the **cover photo** (shown on room cards); the rest show in a gallery. The Admin can reorder, add a caption (optional) and delete photos. Accept JPG, PNG and WebP, up to 5 MB each. Guests see the photos when browsing, before logging in.

### Check-in (Phase 4)

6. Order: guest arrives → reception attends → check-in form (contact number and **pax**) → **verification** (internal process; record the result and who verified) → **room check** → **surrender a valid ID only once a room is confirmed** → assign the room and hand over the key → room becomes Occupied.
7. A failed verification stops the guest and is **logged in `verification_attempts`**, even though no stay is created.
8. If no room is free, **no ID is taken**. Show the earliest available slot and a calendar, and continue as a reservation.
9. An expected check-out date and time is required at check-in.

### Reservations (Phase 3)

10. **Airbnb-style browsing for guests:**
    - The public home page (`/`) and room pages are open to everyone, **no login needed**: browse rooms by location, see photos, pax capacity, inclusions, standard rates (from ₱X / unit) and availability, and filter by dates and number of guests.
    - Rooms that are Under maintenance or Out of service are hidden from the public list.
    - Clicking **Book** asks the visitor to **log in or sign up**, then returns them to the same room with their dates and pax kept, to finish the booking.
    - Never show other guests' names or reservation details publicly: only free/busy times.
    - Reception books walk-ins on the guest's behalf (no guest account needed).
11. The system shows the earliest available slot and an availability calendar; the guest takes the earliest slot or picks an open slot.
12. Every reservation records **pax**, which must be ≤ the room's pax capacity.
13. **After an occupied room's current stay, the room is NOT bookable until its guest confirms they are not extending** (`stays.not_extending_confirmed_at`) or checks out. Reservations made before the stay began stay valid.
14. The next guest enters only after inspection and cleaning. The **cleaning buffer** setting (default **0 minutes**) is added after the expected check-out when estimating availability.
15. Payment when reserving is optional:
    - full → Paid
    - downpayment of any amount → Partially paid (balance shown at check-in and check-out)
    - none → Unpaid

    Payment status is derived from payments, not stored.

16. **Cancellation:** a guest can cancel their own booking at any time; reception can cancel any booking at any time. Payments already made go through the refund process.
17. **No-show:** the room is held for the **grace period** (setting, default 60 minutes) after the reserved time. After that, reception may mark the reservation No-show, which frees the room. A late guest gets the room if it is still free. **No-show payments are refunded: Full by default** (setting `no_show_refund`: full / partial with a percentage / none). The final policy is still undecided.

### Check-out reminder and extension (Phase 5)

18. At the **check-out reminder** time (setting, default 60 minutes before expected check-out), the guest gets an in-app notification and reception gets an alert to call the guest on the number from the check-in form.
19. **Not extending:** the room opens for booking from the expected check-out time, and the guest proceeds to check-out.
20. **Extending:** reception enters the new check-out time.
    - No reservation after this stay → the extension is allowed and availability recalculated.
    - The room is reserved next for Guest B → the extension is allowed **only if** another room (same or larger pax) can take Guest B at the same time **and Guest B agrees**. Guest B is notified in-app and asked to agree or decline; reception can record the answer from a phone call. Agree → Guest B is moved and the extension approved. Decline → the extension is denied.
    - No other room for Guest B → the extension is denied.
21. Every reminder, call and extension is logged: old and new time, price (from the Admin's extension rate), who approved, when, and Guest B's consent.

### Check-out, billing, ID custody and refunds (Phase 4)

22. Order: guest reports to reception → check-out verification (match the active stay) → **record the check-out first; the guest may leave** → room goes to **Inspection** → check damages and unpaid charges → bill charges → return the ID when fully paid → room goes to Cleaning (or Under maintenance if repairs are needed).
23. Charges are **billed to the company by default**, or to the guest if reception switches it.
24. **The ID is held (`Held – pending payment`) until everything is settled, whether billed to the company or the guest, including damages.**
25. Final bill = room charges + extensions + damages and extras − payments already made (reservation downpayments included).
26. Refunds go Requested → Processing → Refunded, recording who handled each step and when.

### Notifications (Phase 5)

27. In-app notifications to the guest; alerts to reception for:
    - reservation confirmed, changed or cancelled
    - request to move to another room (Guest B consent)
    - 1 hour before check-out ("Call Room X")
    - upcoming check-in
    - reservation past its grace period (no-show)
    - room ready
    - extension approved or denied

---

## 7. Data model (SQL Server, all tables exist already)

Migrations: `database/migrations/2026_09_29_00000{1..4}_*.php`.

| Table                   | Key columns                                                                                                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                 | name, email, password, **role** (`guest`/`reception`/`admin`), **contact_number**                                                                                                                                                                                                                        |
| `settings`              | **key** (primary key), value. Keys: `cleaning_buffer_minutes` (0), `no_show_grace_minutes` (60), `checkout_reminder_minutes` (60), `no_show_refund` (`full`), `no_show_refund_percent` (100), `settings_reviewed_at`                                                                                     |
| `locations`             | name (unique), description                                                                                                                                                                                                                                                                               |
| `rooms`                 | location_id, name (unique per location), pax_capacity, description, **status**                                                                                                                                                                                                                           |
| `room_photos` (to add)  | room_id, path (on the `public` disk, `storage/app/public/rooms/{room}`), caption, sort_order, is_cover. Not created yet: needs a migration                                                                                                                                                               |
| `room_inclusions`       | room_id, item, quantity                                                                                                                                                                                                                                                                                  |
| `rate_units`            | name (unique). Seeded: Per hour, Overnight, Day tour                                                                                                                                                                                                                                                     |
| `room_rates`            | room_id, rate_unit_id, name, price decimal(12,2), is_extension_rate                                                                                                                                                                                                                                      |
| `maintenance_records`   | room_id, performed_on (date), issue, action_taken (null = open), done_by, recorded_by                                                                                                                                                                                                                    |
| `guests`                | user_id (null for walk-ins), name, type (`visitor`/`contractor`), company, contact_number                                                                                                                                                                                                                |
| `reservations`          | guest_id, room_id, room_rate_id, **pax**, starts_at, ends_at, total, status (`active`/`checked_in`/`cancelled`/`no_show`), booked_via (`guest`/`reception`), booked_by, cancelled_at, cancelled_by, cancellation_reason                                                                                  |
| `verification_attempts` | guest_id, result (`passed`/`failed`), notes, verified_by, attempted_at                                                                                                                                                                                                                                   |
| `stays`                 | reservation_id (null for walk-ins), guest_id, room_id, verification_attempt_id, **pax**, checked_in_at, expected_check_out_at, **not_extending_confirmed_at**, checked_out_at, checked_in_by, checked_out_by                                                                                             |
| `id_custody`            | stay_id, id_type, id_number, status (`held`/`held_pending_payment`/`returned`), received_by, returned_at, returned_by                                                                                                                                                                                    |
| `charges`               | stay_id or reservation_id, type (`room`/`extension`/`damage`/`extra`), description, amount, **billed_to** (`company` default / `guest`), created_by                                                                                                                                                      |
| `payments`              | stay_id or reservation_id, amount, payment_type (`downpayment`/`full`/`balance`/`damages`), paid_by (`company`/`guest`), method, receipt_number, received_by, paid_at                                                                                                                                    |
| `refunds`               | reservation_id, payment_id, amount, reason, status (`requested`/`processing`/`refunded`), requested_by/at, processed_by, processing_at, refunded_by/at                                                                                                                                                   |
| `extensions`            | stay_id, old_check_out_at, new_check_out_at, price, status (`pending_consent`/`approved`/`denied`), requested_by, decided_by/at, denial_reason, affected_reservation_id, moved_from_room_id, moved_to_room_id, consent_status (`pending`/`agreed`/`declined`), consent_responded_at, consent_recorded_by |
| `reminder_logs`         | stay_id, type (`in_app`/`call`), sent_at, result (`extend`/`check_out`/`no_answer`), notes, logged_by                                                                                                                                                                                                    |
| `notifications`         | Laravel database notifications (uuid, type, notifiable, data, read_at)                                                                                                                                                                                                                                   |

**Enums** (`app/Enums`):

- `Role`, `RoomStatus` (plus `RoomStatusGroup`)
- `GuestType`, `ReservationStatus`, `BookingChannel`, `PaymentStatus`
- `VerificationResult`, `IdCustodyStatus`
- `BilledTo`, `ChargeType`, `PaymentType`, `RefundStatus`
- `ExtensionStatus`, `ConsentStatus`
- `ReminderType`, `ReminderResult`, `NoShowRefund`

**Models** (`app/Models`): one per table. Useful helpers:

- `Setting::get($key)` / `Setting::set()` / `Setting::values()`
- `Room::summary()`, `Room::activeStay()`, `Room::nextReservation()`
- `Reservation::amountPaid()` / `balance()` / `paymentStatus()`
- `Stay::balance()` (includes reservation downpayments), `Stay::releasesRoomForBooking()`
- `User::hasRole()` / `isAdmin()` / `isStaff()`, `User::guest()`

**SQL Server rule:** foreign keys do **not** cascade, because multiple cascade paths are an error on SQL Server. The only cascades are room → inclusions, rates and maintenance records. Deleting a room or location is blocked in code when it has reservations, stays or rooms.

---

## 8. Code map

### Backend

| Path                                                                                        | Purpose                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `routes/web.php`                                                                            | All app routes. Admin routes: prefix `admin`, name `admin.`, middleware `role:admin`                   |
| `routes/settings.php`                                                                       | Profile, password and appearance settings (from the starter kit)                                       |
| `bootstrap/app.php`                                                                         | Middleware; alias `role` → `App\Http\Middleware\EnsureUserHasRole` (usage `role:reception,admin`)      |
| `app/Http/Controllers/DashboardController.php`                                              | `/dashboard`: renders `admin/dashboard` for admins, `dashboard` (placeholder) for reception and guests |
| `app/Http/Controllers/Admin/LocationController.php`                                         | Locations index/store/update/destroy                                                                   |
| `app/Http/Controllers/Admin/RoomController.php`                                             | Rooms index/store/show/update/destroy                                                                  |
| `app/Http/Controllers/Admin/RoomStatusController.php`                                       | Manual room status changes (maintenance logging)                                                       |
| `app/Http/Controllers/Admin/RoomRateController.php`                                         | Rates for a room (scoped bindings)                                                                     |
| `app/Http/Controllers/Admin/RoomInclusionController.php`                                    | Inclusions for a room                                                                                  |
| `app/Http/Controllers/Admin/MaintenanceRecordController.php`                                | Maintenance log for a room                                                                             |
| `app/Http/Controllers/Admin/RateUnitController.php`                                         | Rate units (blocked delete when in use)                                                                |
| `app/Http/Controllers/Admin/SettingsController.php`                                         | System settings (`/admin/settings`)                                                                    |
| `app/Http/Controllers/Admin/UserController.php`                                             | Create accounts and change roles (an admin cannot demote themselves)                                   |
| `app/Http/Requests/Admin/*.php`                                                             | Validation for locations, rooms, rates, maintenance, settings                                          |
| `app/Actions/Fortify/CreateNewUser.php`                                                     | Self-registration: always role `guest`, requires contact number, creates the `guests` row              |
| `app/Concerns/ProfileValidationRules.php`                                                   | Shared name/email/contact number rules                                                                 |
| `database/seeders/DatabaseSeeder.php`                                                       | Rate units, default settings, first Admin (safe to re-run)                                             |
| `database/seeders/DemoSeeder.php`                                                           | Optional sample data (refuses to run if locations exist)                                               |
| `database/factories/*`                                                                      | `UserFactory` (`admin()`, `reception()`), `LocationFactory`, `RoomFactory` (`status()`)                |
| `tests/Feature/Admin/*`, `tests/Feature/DashboardTest.php`, `tests/Unit/RoomStatusTest.php` | Tests for everything above                                                                             |

Admin route names: `admin.locations.*`, `admin.rooms.*`, `admin.rooms.status.update`, `admin.rooms.rates.*`, `admin.rooms.inclusions.*`, `admin.rooms.maintenance.*` (parameter `{maintenanceRecord}`), `admin.rate-units.*` (parameter `{rateUnit}`), `admin.settings.edit|update`, `admin.users.*`.

### Frontend (`resources/js`)

| Path                                                                                                                              | Purpose                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `app.tsx`                                                                                                                         | Inertia app; layout chosen by page name (`auth/*` → AuthLayout, `settings/*` → Settings layout, else AppLayout)         |
| `pages/admin/dashboard.tsx`                                                                                                       | Admin dashboard: setup checklist, stat tiles, availability chart, room board, rooms without a price, recent maintenance |
| `pages/admin/locations/index.tsx`                                                                                                 | Location cards plus create/edit dialog                                                                                  |
| `pages/admin/rooms/index.tsx`                                                                                                     | Room table with search and filters (URL `?location= &status= &missing=rates                                             | extension &create=1`) |
| `pages/admin/rooms/show.tsx`                                                                                                      | Room page composed of the panels below                                                                                  |
| `pages/admin/settings.tsx`                                                                                                        | System settings form (useForm, sticky save bar) plus rate units                                                         |
| `pages/admin/users.tsx`                                                                                                           | Accounts and roles                                                                                                      |
| `pages/dashboard.tsx`                                                                                                             | Placeholder dashboard for reception and guests                                                                          |
| `pages/auth/*`, `pages/settings/*`, `pages/welcome.tsx`                                                                           | Login/register/reset (customised), profile settings, public landing page                                                |
| `components/admin/room-rates.tsx`, `room-maintenance.tsx`, `room-inclusions.tsx`, `room-status-panel.tsx`, `room-form-dialog.tsx` | Room page panels and dialogs                                                                                            |
| `components/admin/stat-tile.tsx`, `availability-chart.tsx`, `room-board.tsx`, `setup-checklist.tsx`                               | Dashboard pieces                                                                                                        |
| `components/page.tsx`                                                                                                             | `Page` (content column) and `PageHeader` (title, description, actions)                                                  |
| `components/form-field.tsx`                                                                                                       | Label, control, hint and error                                                                                          |
| `components/icon-button.tsx`                                                                                                      | Icon-only button with tooltip label (and `disabledReason`)                                                              |
| `components/confirm-dialog.tsx`                                                                                                   | `ConfirmDelete`: asks before sending a DELETE                                                                           |
| `components/empty-state.tsx`, `components/room-status-badge.tsx` (`RoomStatusBadge`, `StatusDot`)                                 | Shared UI                                                                                                               |
| `components/app-sidebar.tsx`                                                                                                      | Role-based navigation sections                                                                                          |
| `lib/format.ts`                                                                                                                   | `formatPeso`, `formatDate`, `formatToday`, `todayIso`, `greeting`, `plural`, `percent` (Manila time)                    |
| `lib/query.ts`                                                                                                                    | `useInitialQuery()` (SSR-safe query string) and `replaceQuery()`                                                        |
| `lib/room-status.ts`                                                                                                              | `groupColor` (CSS variables per status group)                                                                           |
| `types/admin.ts`, `types/auth.ts`                                                                                                 | Shared TypeScript types (`Role`, `RoomStatus`, `RoomSummary`, …)                                                        |
| `css/app.css`                                                                                                                     | Theme tokens: brand navy `#1f3c73` and teal `#0e97ab`, light and dark mode, room status colours                         |

---

## 9. Conventions (follow these)

### Backend

- Every controller returns Inertia pages with **explicit arrays** (map models to the fields the page needs). Never pass models raw. Send dates as `Y-m-d` strings or ISO 8601.
- Success and error messages: `Inertia::flash('toast', ['type' => 'success'|'error', 'message' => __('…')]);` then `return to_route(...)`. The frontend shows toasts automatically.
- Validation: a FormRequest when rules are shared between store and update; otherwise `$request->validate()`. Give friendly `attributes()`/`messages()`.
- Checkbox booleans arrive as `"1"` or missing; read them with `$request->boolean()`.
- Guard destructive actions in code (e.g. a room with reservations cannot be deleted) and explain with an error toast.
- Nested resources use `Route::scopeBindings()`.
- New status or type values go in `app/Enums`, cast on the model.
- Business settings are read with `Setting::get('key')`; add new keys with a default in `Setting::DEFAULTS`.
- Use DB transactions for multi-step writes. For booking and availability, lock the room row (`lockForUpdate()`) so SQL Server cannot double-book.
- PHPStan is strict: add `@property` docblocks to models when adding columns.

### Frontend

- **Write SSR-safe code** (SSR can be switched on in production for the public pages). Never read `window`, `document` or `localStorage` while rendering. Use `useInitialQuery()` for query strings, and format "now" in `Asia/Manila` (see `lib/format.ts`).
- Import routes from Wayfinder: `import RoomController from '@/actions/App/Http/Controllers/Admin/RoomController'` → `RoomController.update.form(id)` / `.url(id)`, or `import { show } from '@/routes/admin/rooms'`.
- Forms: Inertia `<Form {...Controller.action.form(args)} options={{ preserveScroll: true }} onSuccess={...}>` with `FormField` and uncontrolled inputs. Use `useForm` only when you need dirty tracking (settings page).
- Radix `Select` takes a `name` prop, so it submits inside `<Form>`.
- Page layout: `<Page>` with `<PageHeader title description actions />`. Set `Page.layout = { breadcrumbs: [...] }`, or a function `(props) => ({ breadcrumbs })`.
- Room status colours come only from `groupColor` / `StatusDot` / `RoomStatusBadge`. Text is never coloured with status colours; a coloured dot sits beside the label. The four group colours were validated for colour-blind safety; do not change them casually.

### UX rules (owner's preferences)

- **Card actions go top right of the card header** (e.g. "Add rate", "Add record"). **Page actions go top right of the page header** (e.g. "Add room").
- **Dialogs:** Cancel then the primary button, right-aligned. Destructive actions always confirm with `ConfirmDelete`.
- **Icon-only buttons** use `IconButton` (tooltip label). A disabled button explains why with `disabledReason`. No hidden "…" menus for common actions.
- **Forms:** helper links go under their field (e.g. "Forgot your password?" under the password field). **No positive `tabIndex`**; keep DOM order the same as visual order.
- Every list has an empty state with the next action. Every page works on phone width and in dark mode.

---

## 10. What is built (detail)

- **Auth:**
    - login, registration (guest role, contact number required), password reset, password confirmation
    - profile settings (includes contact number), appearance (light/dark/system)
    - email verification, two-factor login and passkeys are removed
- **Roles:** `role` middleware. Admin-only routes return 403 to others. The sidebar shows Setup and Accounts only to admins.
- **Admin dashboard:**
    - setup checklist (location → rooms → rates → extension rates → review settings), hidden when complete
    - stat tiles (rooms, capacity, available now, not bookable)
    - availability stacked bar with legend and a table of every status
    - room board grouped by location
    - rooms without a price, recent maintenance
- **Locations:** cards with room count, capacity and status counts; add/edit dialog; delete blocked while rooms exist.
- **Rooms:**
    - list with search, location/status filters, "without a price" and "without an extension rate" filters
    - add-room dialog, which goes to the room page afterwards
    - room page:
        - rates, with a prompt when there is no extension rate
        - maintenance log
        - inclusions (quantity steppers, inline add)
        - status panel, showing only allowed manual transitions
        - details, edit, delete
- **System settings:**
    - cleaning buffer, no-show grace period, check-out reminder
    - no-show refund policy (full / partial with percentage / none)
    - rate units (add, rename, delete when unused)
    - a sticky save bar with unsaved-changes state
- **Users:** create Reception/Admin/Guest accounts; change roles inline.
- **Branding:** navy and teal theme, anchor logo, light and dark mode, responsive layout.
- **Docs:** requirements v1.1 (HTML and PDF) and flowchart poster updated with all decisions; README describes setup and the admin screens.

---

## 11. Known gaps and gotchas

- **Mail is not configured.** Password-reset emails only go to the log. Needs SMTP settings in `.env` before go-live.
- **Background jobs are not set up yet.** Phase 5 reminders need the Laravel scheduler (`php artisan schedule:run` every minute via Windows Task Scheduler) and a queue worker (`php artisan queue:work`, `QUEUE_CONNECTION=database`).
- **SQL Server Express AUTO_CLOSE:** new databases get `AUTO_CLOSE ON`, which gives random "Timeout error [258]" errors after the app is idle. It is already turned off on `guest_accommodation` (29 Sep 2026); do the same on any new database (see section 5).
- **`php artisan serve` handles one request at a time.** A long seeding run or long DB transaction can make page loads wait. Use IIS or nginx with PHP-FPM, or `PHP_CLI_SERVER_WORKERS=4`, for real use.
- **SSR:** any `window` use during render causes hydration errors when SSR is on (already fixed once in the rooms and locations pages).
- **Speed (29 Sep 2026):** hover prefetch on sidebar links was removed (the single-request dev server queued prefetches ahead of clicks); sessions and cache use files instead of SQL Server; SSR is off in development.
- **Account deletion:** the starter kit's "Delete account" in profile settings is available to admins too. Consider blocking deletion of the last admin.
- **Role changes** on the Users page apply immediately, without a confirmation dialog.
- **Stale project path:** `docs/` still mentions the old project folder path.
- **Git:** changes have not been committed. Commit them in GitHub Desktop.

---

## 12. Open questions for the owner (ask before building the related feature)

1. **How is a reservation total calculated?** Options: (a) the system suggests rate price × number of units (nights/hours) and reception can edit it, or (b) reception types the total. _Default to (a) unless told otherwise._
2. **No-show refund policy:** full, partial or none. The system defaults to Full; the setting already exists.
3. **Guest B consent timing:** how long to wait for Guest B's answer before reception decides, and what happens if nobody answers.
4. **Rooms under maintenance or out of service:** can guests book them for future dates? _Suggested default: not bookable while in those statuses._
5. **Production server:** not decided yet. Development uses local SQL Server Express.
6. **Public room pages:** should prices be shown to visitors who are not logged in? _Default: yes (like Airbnb)._
7. **Photo limits:** maximum photos per room. _Default: 10._

---

## 13. Next steps, step by step

Build in this order. After each step, write tests and run the checks in section 5.

### Step A: Room photos (admin), do this first

1. Migration `create_room_photos_table` (columns in section 7; `room_id` cascades on room delete, like inclusions). Model `RoomPhoto` with `url` accessor (`Storage::disk('public')->url($path)`); `Room::photos()` ordered by `sort_order`, and `Room::coverPhoto()`.
2. Run `php artisan storage:link` once so uploaded files are served from `/storage`.
3. `Admin\RoomPhotoController` (store, update caption / set cover, reorder, destroy) under `Route::scopeBindings()`: `admin.rooms.photos.*`. Validate `image|mimes:jpg,jpeg,png,webp|max:5120`, up to 10 per room. The first photo becomes the cover automatically; deleting the cover promotes the next one. Delete the file from disk when the row is deleted.
4. Frontend: `components/admin/room-photos.tsx` on the room page (top of the left column): card with "Add photos" (card header, top right), multi-file upload using Inertia `<Form>` (it sends `multipart/form-data` automatically), a thumbnail grid, a "Cover" badge, "Set as cover", caption edit and delete via `IconButton` and `ConfirmDelete`. Show the cover photo on the rooms list and the dashboard room board.
5. Tests: upload with `UploadedFile::fake()->image()` and `Storage::fake('public')`; limits; cover rules; non-admins get 403.

### Step B: Public browsing (Airbnb-style), guests do not need to log in

1. Public routes (no `auth` middleware): `/` shows room listings, `/rooms/{room}` shows a room page. Controller `PublicRoomController` returns only public data: name, location, pax, description, inclusions, standard rates, photos, and free/busy periods (no guest names). Hide rooms that are Under maintenance or Out of service.
2. Pages: replace `pages/welcome.tsx` with a listing page (search bar: location, dates, number of guests; grid of room cards with cover photo, name, location, pax, "from ₱X / night"); add `pages/rooms/show.tsx` (photo gallery, details, inclusions, rates, availability calendar, **Book** button).
3. **Book** when logged out: send to `/login` with the room, dates and pax kept (Laravel's intended URL: `redirect()->guest(...)` or store it before redirecting), then return to the booking step. Sign-up must return to the same place.
4. Public layout: header with logo, "Log in" / "Sign up" (or "My reservations" when logged in), no admin sidebar. Works on phone width.

### Step C: Reservations (Phase 3)

1. **Availability service:** `app/Services/Availability.php`
    - `busyPeriods(Room $room, Carbon $from, Carbon $to)` returns intervals from:
        - active reservations `[starts_at, ends_at + cleaning buffer]`
        - the active stay `[checked_in_at, expected_check_out_at + buffer]`. **If the stay's `not_extending_confirmed_at` is null, treat the room as busy with no end date** (rule 13); existing reservations still count.
    - Rooms whose status is Under maintenance or Out of service are unavailable (open question 4).
    - `isFree(Room, start, end)` and `earliestSlot(int $pax, int $minutes, ?Location)` return the earliest start at or after now in any room with `pax_capacity >= pax`.
    - Unit-test every rule above.
2. **Reception booking (walk-in):**
    - routes under prefix `reception`, name `reception.`, middleware `role:reception,admin`
    - `Reception\ReservationController` (index, create, store, show, cancel, markNoShow)
    - store: find or create the `Guest` (name, type, company, contact), check pax ≤ capacity, choose a standard rate, compute the total (open question 1), then **in a transaction with `Room::lockForUpdate()`** re-check `isFree` and create the reservation (`booked_via = reception`).
    - Optional downpayment → a `payments` row (`payment_type` downpayment or full, `paid_by` guest).
3. **Guest online booking** (continues from the public room page in Step B):
    - routes under `guest.` for role guest; the guest profile comes from `$request->user()->guest`
    - same availability and locking; `booked_via = guest`
    - "My reservations" list on the guest dashboard (the controller already returns `reservations`)
4. **Availability calendar UI:**
    - day or week grid per room (rows = rooms, columns = time), showing reservations and stays
    - "Earliest available" suggestion; click a free slot to prefill the booking form
    - reuse `RoomStatusBadge` / `groupColor`
5. **Cancellation and refunds:**
    - cancel sets `status = cancelled`, `cancelled_at`, `cancelled_by`, reason
    - every payment on it creates a `refunds` row (`requested`)
    - admin/reception screens move refunds Requested → Processing → Refunded
6. **No-show:**
    - after `no_show_grace_minutes` past `starts_at`, show "Mark no-show" to reception
    - it sets `status = no_show` and creates refunds per `no_show_refund` / `no_show_refund_percent`
7. **Notifications:** Laravel notifications (database channel) for reservation confirmed, changed and cancelled; a bell with unread count in the header.
8. **Reception navigation:** add sidebar sections for the `reception` role (e.g. "Front desk": Reservations, Calendar) in `components/app-sidebar.tsx`, and replace the placeholder reception dashboard.

Then **Phase 4** (check-in with verification attempts → room check → ID custody → stay; check-out → inspection → charges (company default) → payments → ID return when balance = 0 → cleaning), **Phase 5** (scheduler: reminder notifications and call logs, extension flow with Guest B consent, live room board with polling), and **Phase 6** (reports: guest log, held IDs, unpaid company bills, occupancy).

---

## 14. Files to paste when asking an AI for help

- **Any change:** this README, plus the exact files you want changed.
- **New admin screen:** `routes/web.php`, one existing admin controller (e.g. `app/Http/Controllers/Admin/LocationController.php`) and its page (`resources/js/pages/admin/locations/index.tsx`) as a pattern, `resources/js/components/page.tsx`, `resources/js/components/form-field.tsx`.
- **Booking or availability logic:** `app/Models/Room.php`, `Reservation.php`, `Stay.php`, `Setting.php`, `app/Enums/RoomStatus.php`, and the migration `database/migrations/2026_09_29_000003_create_guest_and_booking_tables.php`.
- **Styling:** `resources/css/app.css`, `resources/js/lib/room-status.ts`, `resources/js/components/room-status-badge.tsx`.
- **Test failures:** the full error output, plus the test file and the file it tests.
