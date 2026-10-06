    # Guest Accommodation System

    **Last updated:** 6 October 2026
    **Status:** The admin side and the whole front desk are built and tested: reservations (group bookings, **editing**, availability, payments, cancellation, no-show, refunds), check-in with the owner's form, check-out, inspection, billing and ID return, extensions, the week calendar, staff alerts with a scheduler, and account setup by emailed link. The latest changes (2 to 6 Oct 2026) are listed in section 2, "Recent changes". Still to build (section 13, "What is left"): the guest (online) side (on hold), reports, and the parked admin extras.

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

| Phase                           | Scope                                                                                                                                                  | Status  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1. Foundation                   | SQL Server connection, login and registration, three roles, full database schema                                                                       | ✅ Done |
| 2. Admin setup                  | Locations, rooms, inclusions, rates, maintenance, settings, admin dashboard, UX pass                                                                   | ✅ Done |
| 2b. Room photos                 | Admin uploads photos per room, drags them into order, adds captions, picks the cover photo                                                             | ✅ Done |
| 2c. Admin tools                 | Copy a room, standard check-in/out times, safer accounts (confirm role change, reset password, deactivate, last-admin guard), activity log, email      | ✅ Done |
| 2d. ID types                    | Admin-managed list of accepted IDs (add, rename, turn off, delete when unused); `id_custody` now links to it                                           | ✅ Done |
| 2e. Admin extras                | Companies list, reports, admin calendar, dashboard trends                                                                                              | Pending |
| 3a. Front-desk reservations     | Group bookings (several rooms), availability, earliest slot, price suggestion, payments, cancellation, no-show, refunds, reception dashboard           | ✅ Done |
| 3b. Guest side                  | Public room browsing (Airbnb-style), online booking by guests, availability calendar                                                                   | On hold |
| 4a. Check-in                    | Owner's check-in form (guest list with rooms, ID with private photo), verification, walk-ins, reception room status changes                            | ✅ Done |
| 4b. Check-out and billing       | Check-out, inspection, damages and charges, final bill, payments, ID return, cleaning                                                                  | ✅ Done |
| 5a. Stay management             | Calls before check-out (call log), "not extending", extensions with Guest B's consent, week calendar, room status board                                | ✅ Done |
| 5b. Notifications and scheduler | Staff alert bell, scheduler for the check-out call, late and arriving guests; room ready and extension alerts; dashboard refreshes every minute        | ✅ Done |
| 5c. Front-desk UX pass          | Dashboard search, Walk-in button, clickable stat tiles, one-click Check in from lists, clearable number boxes, date + time fields                      | ✅ Done |
| 5d. Figma-inspired layout       | Room cards with guest, pax and times; board filters; "Today" panel; house rules strip; check-in progress and stay summary; role under user name        | ✅ Done |
| 5e. Accounts by emailed link    | Admin never sets passwords: new accounts get a "set up your password" email (3 days), separate from "forgot password"; only staff roles created        | ✅ Done |
| 5f. Booking rules and editing   | A booking that leaves guests without a room is refused, with free rooms suggested; active reservations can be edited                                   | ✅ Done |
| 5g. Room details for reception  | Clicking a room on the dashboard shows its prices, inclusions, photo, description and the guests in it; inclusions on the booking page                 | ✅ Done |
| 5h. Front-desk tools            | Printable bill, change room during a stay, late check-out fee, overpayment refunds, refund method and reference, room-clash warning, alerts by email   | ✅ Done |
| 6. Reports and data care        | Admin reports (guest log, held IDs, unpaid bills, occupancy, income) with print and CSV; dashboard trends; payment methods; ID photo deletion; backups | ✅ Done |

### Recent changes (2 to 6 October 2026)

Newest first. Details are in the sections named.

- **6 Oct: front-desk tools and admin reports (one batch, owner's list).**
    - **Printable bill:** "Print bill" on the stay page opens a plain page (`reception.stays.bill`, `resources/views/print/bill.blade.php`) with charges, payments, totals and signature lines; print it or save it as PDF from the browser.
    - **Room still occupied, next guest due:** the Today panel lists rooms where the last guest is still in and the next booking is due today; reception also gets a red **room clash** alert an hour before the arrival (`FrontDeskAlerts::roomClashes()`).
    - **Change room during a stay:** "Change room" on each room of a stay (`reception.stays.rooms.move`). The new room must be Available, big enough and free until the check-out. The old room goes to Cleaning, or to Under maintenance with the reason logged and the Admin alerted. The bill is not changed; add a charge if the new room costs more.
    - **Late check-out fee:** when a stay is past its check-out time, "Late check-out fee" adds one charge without changing the check-out time. Suggested amount: each room's hourly extension rate for every started hour (`reception.stays.late-fee`).
    - **Overpayment refunds:** after check-out and inspection, a stay paid more than its bill shows "Refund ₱X"; it creates a refund linked to the stay (`refunds.stay_id`). `Stay::balance()` now adds back refunded overpayments; `Stay::overpaid()` is what is still owed back.
    - **Refund method:** "Mark refunded" asks how the money was given back (one of the payment methods) and an optional reference number (`refunds.method`, `refunds.reference`).
    - **Alerts by email:** in Options the Admin can switch on emailing the urgent alerts (call before check-out, not arrived, room clash, next guest must answer) to every active Reception account. A mail failure never blocks the desk. **SMS is not built:** it needs a paid SMS provider.
    - **ID photos:** in Options the Admin sets how many days after an ID is returned its photo is deleted (0 = keep; default 0), and can delete the photos of all returned IDs at once. The ID's type and number stay. Runs nightly (`housekeeping:run`).
    - **Reports** (Admin → Reports, `admin.reports.index`, `App\Services\Reports`): guest log, IDs held, unpaid bills by company, occupancy by location and income by method for a date range, with Print and CSV export.
    - **Dashboard trends:** the Admin dashboard shows the last six months (income, occupancy, cancellations, no-shows) and the top companies.
    - **Payment methods** are now a list the Admin edits in Options (setting `payment_methods`; `Payment::methods()` replaced the fixed `Payment::METHODS`).
    - **Backups** (Admin → Options and backups, `App\Services\Housekeeping`): "Back up now" writes one zip with every table as JSON plus room photos and ID photos, in `storage/app/private/backups`; download or delete it there. One is also written every night at 2:00 AM by the scheduler; the newest 7 are kept (setting). Restoring is a manual job for a technician.
    - New Admin sidebar links: **Options and backups** (Setup) and **Reports** (Records). Tests: `tests/Feature/Reception/StayToolsTest.php`, `tests/Feature/Admin/ReportsAndOptionsTest.php`.

- **6 Oct: room details for reception.** On the reception dashboard, clicking a room opens a panel with the cover photo, who is in the room (contact person, company, the guests in that room by name, due-out time, "Open stay"), the next arrival ("Check in"), **every price the Admin set** (standard rates and the extension rate), **the inclusions**, the description, and the status buttons. Read-only: prices and inclusions are still changed only by the Admin. The booking page's room list also shows "Includes: …" per room. Data: `DashboardController::forReception()` (board fields `rates`, `inclusions`, `description`, `company`, `guest_names`), `RoomDialog` in `pages/reception/dashboard.tsx`, `inclusions` in `ReservationController::bookingPage()`.
- **5 Oct: guests must all have a room** (section 6, rule 12). Refused with a suggestion of free rooms to add.
- **5 Oct: edit a reservation** (section 11, first "Editing" bullet). Edit button on active reservations.
- **5 Oct: account setup by email** (section 6, "Accounts and audit"). The Admin no longer types anyone's password; "set up your password" and "forgot password" are separate flows. Only Reception and Admin can be created or assigned on the Users page; a self-registered Guest row can be promoted.
- **5 Oct: small fixes.** Edge showed two "show password" eyes (its built-in one is hidden in `resources/css/app.css`). Page header actions stay top right when the description is long (`components/page.tsx`).
- **6 Oct: the Admin sees the Front desk section in the sidebar again** (`components/app-sidebar.tsx`: `roles: ['reception', 'admin']`); it was hidden on 2 Oct. The Admin can do everything Reception can. Alerts in the bell still go to Reception only.
- **6 Oct: report rows open the stay.** On Reports, the names in "Unpaid bills by company", "IDs held" and "Guest log" link to the stay page, where the bill is paid and the ID returned. A company with several unpaid stays lists each guest and what they owe (`Reports::unpaid()` returns `bills`).
- **6 Oct: guest accounts are kept apart from staff accounts** (owner decision). The Users page lists staff only (Reception and Admin). A new Admin page, "Guest accounts" (`/admin/guest-accounts`, `Admin/GuestAccountController`, `pages/admin/guest-accounts.tsx`), lists the accounts guests registered themselves, with search and an Active/Deactivated filter. The Admin can only do two things there: deactivate or reactivate an account, and email its owner a password link when they cannot get in. No role changes and no account creation on that page. The actions reuse `UserController` (`deactivate`, `activate`, `sendResetLink`), which now return to the list the Admin came from.
- **Decided for the guest side (not built yet):** an online booking is a request that Reception approves or declines; it is not confirmed automatically.
- **6 Oct: "Unpaid and IDs held" page** for Reception and the Admin (Front desk in the sidebar; `/reception/pending`, `Reception/PendingController`, `pages/reception/pending.tsx`). It lists stays that still owe money or whose ID is still held, with totals on top. It shows checked-out stays by default; a toggle adds guests still in house. Each row opens the stay and has "View ID photo" and "Bill" buttons.
- **6 Oct: the ID photo and the bill open in a pop-up** instead of a new tab (`components/reception/viewers.tsx`: `IdPhotoButton`, `BillButton`). The bill pop-up loads the same print page with `?embed=1` (no buttons of its own) and has "Print or save as PDF".
- **Paying at check-out (how it works now):** check-out is never blocked by an unpaid bill. Room inspection follows, and damages can be added. The ID is returned only when every room is inspected and the balance is zero; until then it shows "Held – pending payment" and the stay appears under "Unpaid bills by company".

**A separate demo project exists:** `C:\Users\Temp\Documents\GitHub\reception-preview` (plain Laravel + Blade, database `guest_accommodation_simple`, port 8090). It is a simplified stand-in the owner shows to their supervisor. **It is not this system and shares nothing with it**; it has its own README. Do not copy code between them unless the owner asks.

The owner first asked for admin screens only; on **30 Sep 2026 they asked to proceed to reception**. **Guest screens (online booking, public browsing) are still on hold until the owner asks.** The guest dashboard (`resources/js/pages/dashboard.tsx`) is a placeholder; reception has its own (`pages/reception/dashboard.tsx`).

**Pending admin extras (owner parked these on 30 Sep 2026; build only when asked):** companies list, reports, admin calendar, dashboard trends. Details are in section 13, Step A3. (The ID types list from the same batch was built on 30 Sep 2026.)

**Decided 29 Sep 2026 (not built yet):**

- **Guests browse like Airbnb.** Anyone can browse rooms, photos, rates and availability **without logging in**. Logging in (or signing up) is required only when they click to book.
- **Room photos** are built on the admin side. Guests will see them once public browsing (Step B) is built.

Reservations are mainly **Reception's** job (walk-ins, managing all bookings, cancellations, no-shows, payments, refunds). Guests make and cancel **their own** online bookings.

Verification at handoff:

- **PHP tests:** 181 passing, 3 skipped (6 Oct 2026). The skipped ones are the starter kit's two-factor tests; two-factor login is switched off.
- **Static checks:** PHPStan, Pint, ESLint/format and TypeScript are all clean. The production build succeeds.
- **SQL Server:** tested live against SQL Server Express. All admin pages load in about 0.2 to 0.4 seconds. Alerts checked live on 30 Sep 2026: `php artisan front-desk:alerts` sent the check-out calls for the two sample stays, and the bell listed them and marked them read.
- **Email:** checked again on 6 Oct 2026 with Mailpit running. Four emails arrived: forgot password (from the login page), the test-email button, a reset link sent by the Admin to a reception account, and an urgent front-desk alert. The reset link in the email opens. Not checked: the setup link for a brand-new account (same mail path, but no account was created for the test), and a real company SMTP server.
- **Staff walkthrough, 6 Oct 2026:** a scripted run against the running app and the real database passed every step: reserve with a down payment (over-capacity refused), edit, check in with ID photo, extra charge, extension, bill, check out, inspection with a damage, payment (overpaying refused), ID return (refused until paid), room back to available, then cancel a paid reservation and take its refund through to "refunded". It left test records named "Walkthrough Test" / "Walkthrough Co" (reservations #13 and #14, stay #7).

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
- **One address:** the app runs at `http://127.0.0.1:8000` (`composer dev`), and `APP_URL=http://127.0.0.1:8000` must match it, because photo URLs and links in emails are built from `APP_URL`. The `guest_accommodation` database currently holds the **sample data** from `DemoSeeder` (2 locations, 12 rooms, 2 checked-in guests). Clear it with `php artisan migrate:fresh --seed` before entering real rooms; that also creates a new Admin password, printed once.
- **Mail (local demo):** **Mailpit** catches every email the app sends. Nothing reaches real inboxes; you read the emails at `http://localhost:8025`.
    - `.env` settings: `MAIL_MAILER=smtp`, `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`, `MAIL_FROM_ADDRESS="no-reply@guest-accommodation.test"`.
    - Mailpit was installed with `winget install axllent.mailpit` and must be running (see section 5).
    - To check it, use Admin → System settings → Email → **Send me a test email**. If Mailpit is not running, the page shows the error.
    - **For go-live,** replace these settings with the company's SMTP server.

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
composer dev                              # http://127.0.0.1:8000

# Email for the local demo: start Mailpit in its own terminal (inbox: http://localhost:8025)
& "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\axllent.mailpit_Microsoft.Winget.Source_8wekyb3d8bbwe\mailpit.exe"

# Front-desk alerts (section 6, "Alerts as built"). Optional in development: the bell
# also runs the check when a staff member has the app open. In its own terminal:
php artisan schedule:work
# Production: Windows Task Scheduler runs this every minute, in the project folder:
#   php artisan schedule:run
# Send due alerts once by hand (prints how many were sent):
php artisan front-desk:alerts

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

**5a. Room photos (built):**

- The Admin uploads up to 10 photos per room on the room page: JPG, PNG or WebP, up to 5 MB each.
- Photos are put in order by dragging, or with the arrow buttons. Each can have an optional caption.
- One photo is the **cover** (shown on room cards). The first upload becomes the cover; deleting the cover promotes the next photo.
- Guests will see the photos when browsing, before logging in (Step B).

**5b. Copy a room (built):**

- Creates one or many new rooms, in any location, with the same pax, description, rates, inclusions and photos (the photo files are duplicated).
- Copies start **Available**. Maintenance history is not copied.
- Names must be new in the target location (case-insensitive) and different from each other; up to 50 at a time.
- The dialog has a "Number them for me" helper (e.g. A-102 to A-110).

**5c. Standard check-in and check-out times (built as settings):**

- `standard_check_in_time` defaults to `14:00` (2:00 PM); `standard_check_out_time` defaults to `12:00` (12:00 PM).
- _Suggested use in Phase 3:_ the default times when a booking is made by date. Ask the owner whether reception can change them per booking.

**5d. ID types (built 30 Sep 2026):**

- The Admin manages the IDs reception accepts, in System settings → **ID types**.
- Defaults (seeded): Driver’s License, Passport, UMID, Company ID, PhilSys ID, Other Government ID.
- Add, rename, **turn off** (no longer offered at check-in; past records keep it) or turn back on.
- Delete only when unused. A type on past ID records can only be turned off.
- `id_custody.id_type_id` links to it (required). The old free-text `id_type` column was replaced, because no real ID records existed yet.

### Accounts and audit (built 30 Sep 2026)

- **Role changes** on the Users page ask for confirmation first.
- **Passwords (changed 5 Oct 2026, owner's decision): the Admin never sets or sees anyone's password.** There are two separate flows:
    - **Set up a password (new accounts):** the New account dialog has no password boxes. Creating the account emails a **"Set up your account"** link (AccountSetup notification → /set-password/{token}, page uth/set-password, Auth\SetPasswordController). It works for **3 days** (password broker invites in config/auth.php). Until it is used, users.password_set_at is null and the Users page shows **Awaiting password setup**; the key button re-sends the setup link.
    - **Forgot password (existing accounts):** the normal Fortify reset (/forgot-password → /reset-password/{token}), valid 60 minutes. The key button sends this once a password has been set.
    - The old "Set new password" by the Admin (dmin.users.password) was removed.
    - Emails need the mail server running (Mailpit locally). If sending fails, the account is still created and the Admin is told to send the link again.
- **Accounts are deactivated, never deleted,** from the Users page (with confirmation), so their names stay on records.
    - A deactivated account cannot log in ("This account has been deactivated…").
    - Someone deactivated while logged in is signed out on their next click.
    - Reactivate at any time.
- **There is always at least one active Admin.**
    - The last active Admin cannot be demoted, deactivated or delete their own account (profile settings).
    - Admins cannot demote or deactivate themselves.
- **Activity log** (Admin → Activity log):
    - Records who added, changed or deleted locations, rooms, room status, rates, inclusions, photos, maintenance records, rate units, settings and accounts, with the **old → new** values.
    - Passwords are never shown, only "(changed)".
    - Filter by person, type, text and date range; 25 entries per page.
    - Logins and page views are **not** logged.

### Group bookings and the check-in form (owner decisions, 30 Sep 2026)

- **One booking can cover several rooms,** e.g. a company crew of 10 in A-101 and A-102. A booking has one **contact person** (a `guests` row), a company, a purpose and one set of dates; each room in it has its own number of guests, rate and price (`reservation_rooms`). Rule 2 still holds: a room is never shared between **different bookings**.
- **Company is required** (owner, 30 Sep 2026). The booking and check-in forms put it first, with the contact person under it: **Company → Purpose → Contact person (name, contact number, email, guest type)**.
- **Reservations (advance bookings) record:** company, purpose, contact person, email, contact number, arrival and departure, and the rooms with guests per room. **The guest list and the ID are taken at check-in**, not when booking.
- **The owner's check-in form** (in this order):
    1. company, purpose, contact person, email, contact number (prefilled from the reservation when there is one)
    2. check-in and check-out date and time
    3. **guest list:** each guest's name, address and contact number, and the **room number** they are in
    4. **valid ID:** choose the ID type from the Admin's list (rule 5d) → **upload a photo of the ID** (required) → enter the ID number → the ID is collected
- **One ID per booking,** from the contact person (guest in charge). It is held until the whole booking is settled (rule 24).
- **The ID photo is required** and must be stored **privately** (the `local` disk, never `public`), viewable only by staff through an authorised route.

**Check-in as built (30 Sep 2026)** (defaults used where the owner has not decided; see open questions 11 to 13):

- **Check in** button on an active reservation → the check-in page, prefilled from the booking. **Walk-ins:** the New reservation page has **Save and check in now** (shown when the arrival is today), which saves the booking and opens its check-in page.
- **Guest list:** one row per booked guest, placed in the booked rooms. **Name and address are required; the contact number is optional** (the contact person's number is required). Guests per room ≤ capacity. Rooms can only be the booking's rooms.
- **A booked room with no guests is not checked in** and becomes free for others.
- **Rooms must be Available** and free until the expected check-out. A room still being cleaned blocks check-in; reception marks it Available on the dashboard first.
- **Verification:** Passed or Failed, with notes (required when failed). Failed → a `verification_attempts` row, nobody is checked in, no ID is taken, and the reservation stays active.
- **ID:** type (active types only), photo (JPG/PNG/WebP up to 10 MB; phones open the camera), ID number, and a required "I have received the ID" tick. Saved at `storage/app/private/id-photos/{stay}/…` and shown only through `reception.id-photos.show`.
- On success: stay, stay rooms, guest list and ID custody (`held`) are created; rooms become **Occupied**; the reservation becomes **Checked in** (logged in the activity log). The check-in time is "now".
- **Reception room status:** reception clicks a room on its dashboard board to make the same manual changes the Admin can (e.g. Cleaning → Available, report maintenance).

**Stays, check-out and billing as built (30 Sep 2026)** (sidebar **In house**; one page per stay):

- **Room charges** are added at check-in: one `charges` row (type `room`) per checked-in room at its booked price. **Billed to the company when the booking has a company, otherwise to the guest** (rule 23). Reception can switch any line between company and guest.
- **Check out** (confirm dialog = the check-out verification of rule 22): records the time and who; the guests may leave; every room goes to **Inspection**; the reservation becomes **Checked out**; the ID becomes "Held – pending payment" if anything is owed.
- **Inspect** each room: add damages (description, amount, company or guest), then **Send to cleaning** or **Needs repair** (Under maintenance, with an issue added to the maintenance log). Each room is inspected once. Rooms go to Cleaning straight after inspection; they do not wait for payment.
- **Bill:** room charges + extensions + damages + extras − all payments (reservation downpayments included) = balance (rule 25). The page also shows the company's and the guest's charged and paid amounts. Reception adds extras or damages, removes them (not room charges), and records payments up to the balance.
- **Return ID** only when checked out, every room inspected and the balance is 0 (rule 24). Returning it **settles** the stay: the bill is then locked.
- **Calls (rules 18 and 19):** the reception dashboard lists guests due out within the reminder time ("Due out: call first"). **Log call** records the result (checking out / wants to extend / no answer) in `reminder_logs`; "checking out" also confirms **not extending**. A **Not extending** button does the same without a call. Either releases the rooms for booking after the expected check-out (rule 13).
- **Extend stay (rules 20 and 21):** pick the new check-out; the price is suggested from each room's extension rate (editable). If nothing is booked in the way, it is approved at once, the check-out moves and an `extension` charge is added ("not extending" is cleared again). If a room is reserved next, the dialog lists **other free rooms that fit Guest B**; reception calls Guest B and records **Agreed / Declined / Not reached yet**. Agreed → Guest B's room is moved and the extension approved; Declined or no fitting room → denied, with the reason; Not reached → waiting, with **Record answer** on the stay page. Each moved room is an `extension_moves` row.
- **Calendar:** a week of every room by location: reserved, in house and checked-out bars (click to open), a dashed "may extend" band for guests who have not confirmed (rule 13), and click a free day to book it.

### Check-in (Phase 4)

6. Order: guest arrives → reception attends → check-in form (owner's form above) → **verification** (internal process; record the result and who verified) → **room check** → **surrender a valid ID only once a room is confirmed** → assign the rooms and hand over the keys → rooms become Occupied.
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
11. The system shows the earliest available slot and an availability calendar; the guest takes the earliest slot or picks an open slot. **Built for reception:** when the free rooms cannot hold the number of guests, the booking page shows the earliest time when enough rooms are free for the whole group, with a "Use these dates" button. (The calendar is not built yet.)
12. Every room in a reservation records its **pax**, which must be ≤ that room's pax capacity.
    - **Everyone needs a place (built 5 Oct 2026):** the booking page asks for the number of guests. If the rooms added have fewer places (e.g. 10 guests, one room for 8), **the booking is refused**: a red message says how many guests have no room and **suggests free rooms to add** (the smallest room that takes the rest, otherwise the biggest rooms first), with an **Add suggested room** button; Save stays disabled. The server checks the same (`guests` in `StoreReservationRequest`). This covers walk-ins too, since they use the same page.

**Built at the front desk (30 Sep 2026):**

- **Price:** each room's price is suggested as rate price × units (open question 1, default a), and reception can change it. Units come from the rate unit's name: "hour" → hours (rounded up), "night"/"Overnight" → nights (calendar days crossed, at least 1), "day" (e.g. Day tour) → days (dates spanned), "week" → weeks; any other unit → 1. The reservation total is the sum of the room prices. Code: `resources/js/lib/pricing.ts`.
- **Payment methods:** Cash, GCash, Maya, Bank transfer, Card, Other (`Payment::METHODS`). Paid by: guest (default) or company. The first payment is a Downpayment, or Full if it covers everything; later ones are Balance (`PaymentType::forBooking`).
- **Contact person reuse:** a booking with the same contact name and number as an earlier one reuses that `guests` row and updates its company, email and type.
- **Cancel** needs a reason; every payment gets a refund request for its full amount. **No-show** is allowed only after the grace period; refunds follow the no-show setting (full, partial %, none). Both free the rooms at once.
- **Refunds page:** Requested → Processing → Refunded, one step at a time with confirmation; who and when are recorded.
- The activity log now also records reservations (booked, cancelled, no-show), payments and refunds.

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

### Alerts as built (30 Sep 2026)

Staff alerts are built. **Guest in-app notifications wait for the guest side**, which is on hold. "Reservation changed" waits for reservation editing (not built).

- **Who gets them (changed 30 Sep 2026 after owner feedback):**
    - **Front-desk alerts go to active Reception accounts only.** Admins get them only when no Reception account is active (a small setup where the Admin runs the desk).
    - **The Admin gets their own alerts:** a room sent for repair (from the board or an inspection) or taken out of service.
    - **Whoever caused an alert also gets it, already marked read.** It stays in their list for the record but does not pop up or add to the badge. (Before, the person who clicked got nothing, so a single receptionist never saw "room ready" or "extension approved", while the Admin saw everything.)
- **Bell** in the header (reception and admin): unread count, the 15 latest alerts, "Mark all as read". Clicking an alert marks it read and opens the stay, reservation, calendar or room. New alerts also pop up as a message for 12 seconds. The bell checks every 60 seconds. Each alert has a coloured icon: **red** = act now (call, late guest, next guest must answer), **blue** = coming up (arrival, new booking), **green** = done (room ready, extension decided), **grey** = cancelled, **amber** = repair (Admin).
- **Timed alerts,** checked every minute (`front-desk:alerts`):
    - **"Call X before check-out"** (opens the stay): from the reminder time (setting, default 60 min) before expected check-out, unless the guest already confirmed not extending. Skipped when more than 12 hours overdue. Also writes a `reminder_logs` row of type `in_app` (rule 21).
    - **"X has not arrived"** (opens the reservation): the grace period (setting, default 60 min) has passed and the reservation is still Active. Skipped after 2 days.
    - **"X arrives at 2:00 PM"** (opens the reservation): an Active reservation starts within the next 60 minutes (`FrontDeskAlerts::ARRIVAL_NOTICE_MINUTES`).
- **Event alerts** (reception):
    - **"New booking: X"** (opens the reservation): rooms, guests, arrival time.
    - **"Booking cancelled: X" / "No-show: X"** (opens the reservation): the rooms are free again.
    - **"A-101 is ready"** (opens the calendar): someone set the room to Available (usually after cleaning). The message names the room's next booking.
    - **"Call Y about a room move"** (opens the stay): an extension is waiting for the next guest (Guest B) to agree to move; names the number and the room offered.
    - **"Extension approved/denied: X"** (opens the stay): an extension was decided, at once or after Guest B's answer.
- **Admin alerts:** **"A-104 needs repair"** / **"A-106 is out of service"** (opens the room's setup page), with the issue and who reported it.
- **Sent once:** each timed alert has a key (e.g. `checkout:{stay}:{due timestamp}`) stored in `sent_alerts` (unique). If the check-out time changes (extension), the new time gets a new alert.
- **Without a scheduler:** the bell's request runs the same check at most once a minute (`FrontDeskAlerts::runThrottled()`, cache lock), so alerts work while any staff member has the app open. For alerts when nobody is logged in, run the scheduler (section 5).
- **Live dashboard:** the reception dashboard reloads its data every minute (Inertia `usePoll`), so the "call first", "not arrived", arrivals and board stay current.

---

## 7. Data model (SQL Server, all tables exist already)

Migrations: `database/migrations/2026_09_29_00000{1..5}_*.php`, `2026_09_30_000001_add_deactivation_and_activity_log.php`, `2026_09_30_000002_create_id_types_table.php`, `2026_09_30_000003_add_rooms_to_reservations.php` (moved room, rate and pax from `reservations` into `reservation_rooms`) , `2026_09_30_000004_add_rooms_and_guests_to_stays.php` (moved room and pax from `stays` into `stay_rooms`, added `stay_guests` and `id_custody.photo_path`), `2026_09_30_000005_add_check_out_details.php` (inspection columns, `extension_moves`) and `2026_09_30_000006_create_sent_alerts_table.php`.

| Table                   | Key columns                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`                 | name, email, password, **role** (`guest`/`reception`/`admin`), **contact_number**, **deactivated_at** (null = active)                                                                                                                                                                                                                                                                                        |
| `settings`              | **key** (primary key), value. Keys: `cleaning_buffer_minutes` (0), `no_show_grace_minutes` (60), `checkout_reminder_minutes` (60), `no_show_refund` (`full`), `no_show_refund_percent` (100), `standard_check_in_time` (`14:00`), `standard_check_out_time` (`12:00`), `settings_reviewed_at`                                                                                                                |
| `activity_logs`         | user_id (null = system), action (`created`/`updated`/`deleted`), subject_type (model name, e.g. `Room`), subject_id, description, changes (JSON `{field: [old, new]}`), ip_address, created_at                                                                                                                                                                                                               |
| `locations`             | name (unique), description                                                                                                                                                                                                                                                                                                                                                                                   |
| `rooms`                 | location_id, name (unique per location), pax_capacity, description, **status**                                                                                                                                                                                                                                                                                                                               |
| `room_photos`           | room_id, path (on the `public` disk, `storage/app/public/rooms/{room}`), caption, sort_order, is_cover. Cover = first uploaded; max 10 per room                                                                                                                                                                                                                                                              |
| `room_inclusions`       | room_id, item, quantity                                                                                                                                                                                                                                                                                                                                                                                      |
| `rate_units`            | name (unique). Seeded: Per hour, Overnight, Day tour                                                                                                                                                                                                                                                                                                                                                         |
| `room_rates`            | room_id, rate_unit_id, name, price decimal(12,2), is_extension_rate                                                                                                                                                                                                                                                                                                                                          |
| `maintenance_records`   | room_id, performed_on (date), issue, action_taken (null = open), done_by, recorded_by                                                                                                                                                                                                                                                                                                                        |
| `guests`                | user_id (null for walk-ins), name, type (`visitor`/`contractor`), company, contact_number, email. Used for the **contact person** of a booking                                                                                                                                                                                                                                                               |
| `reservations`          | guest_id (contact person), **company**, **purpose**, starts_at, ends_at, total (sum of room prices), status (`active`/`checked_in`/`checked_out`/`cancelled`/`no_show`), booked_via (`guest`/`reception`), booked_by, cancelled_at, cancelled_by, cancellation_reason                                                                                                                                        |
| `reservation_rooms`     | reservation_id (cascade), room_id, room_rate_id, **pax**, price. Unique (reservation_id, room_id). Availability reads this table                                                                                                                                                                                                                                                                             |
| `verification_attempts` | guest_id, result (`passed`/`failed`), notes, verified_by, attempted_at                                                                                                                                                                                                                                                                                                                                       |
| `stays`                 | One checked-in booking: reservation_id (always set for new check-ins; null only on old sample data), guest_id (contact person), verification_attempt_id, checked_in_at, expected_check_out_at, **not_extending_confirmed_at**, checked_out_at, checked_in_by, checked_out_by                                                                                                                                 |
| `stay_rooms`            | stay_id (cascade), room_id, **pax** (guests in that room), inspected_at, inspected_by. Unique (stay_id, room_id). Availability reads occupied rooms from here                                                                                                                                                                                                                                                |
| `extension_moves`       | extension_id (cascade), reservation_room_id (Guest B's room line), from_room_id, to_room_id (null = no room fits), consent_status (`pending`/`agreed`/`declined`), consent_responded_at, consent_recorded_by                                                                                                                                                                                                 |
| `stay_guests`           | stay_id (cascade), room_id, name, address, contact_number (nullable): the guest list                                                                                                                                                                                                                                                                                                                         |
| `id_types`              | name (unique), is_active (false = turned off, not offered at check-in). Seeded: Driver’s License, Passport, UMID, Company ID, PhilSys ID, Other Government ID                                                                                                                                                                                                                                                |
| `id_custody`            | stay_id (one per stay), **id_type_id** (required), id_number, **photo_path** (private `local` disk; null only on old sample data), status (`held`/`held_pending_payment`/`returned`), received_by, returned_at, returned_by                                                                                                                                                                                  |
| `charges`               | stay_id or reservation_id, type (`room`/`extension`/`damage`/`extra`), description, amount, **billed_to** (`company` default / `guest`), created_by                                                                                                                                                                                                                                                          |
| `payments`              | stay_id or reservation_id, amount, payment_type (`downpayment`/`full`/`balance`/`damages`), paid_by (`company`/`guest`), method, receipt_number, received_by, paid_at                                                                                                                                                                                                                                        |
| `booking_requests`      | Guest side, created 6 Oct 2026, not used by any screen yet. user_id (the guest account), contact_name, contact_number, email, company, purpose, guest_type, guests, starts_at, ends_at, total, message, status (`pending`/`approved`/`declined`/`cancelled`/`expired`), hold_expires_at, decided_by, decided_at, decline_reason, reservation_id (set on approval). Model `BookingRequest`, scope `holding()` |
| `booking_request_rooms` | booking_request_id (cascade), room_id, room_rate_id, pax, price. Unique (booking_request_id, room_id). Model `BookingRequestRoom`                                                                                                                                                                                                                                                                            |
| `refunds`               | reservation_id, payment_id, amount, reason, status (`requested`/`processing`/`refunded`), requested_by/at, processed_by, processing_at, refunded_by/at                                                                                                                                                                                                                                                       |
| `extensions`            | stay_id, old_check_out_at, new_check_out_at, price, status (`pending_consent`/`approved`/`denied`), requested_by, decided_by/at, denial_reason. (The single-move columns affected_reservation_id … consent_recorded_by are unused; moves live in `extension_moves`.)                                                                                                                                         |
| `reminder_logs`         | stay_id, type (`in_app`/`call`), sent_at, result (`extend`/`check_out`/`no_answer`), notes, logged_by                                                                                                                                                                                                                                                                                                        |
| `notifications`         | Laravel database notifications (uuid, type, notifiable, data, read_at). Staff alerts store data `{kind, title, body, url}`; kinds are listed in `FrontDeskAlert::DESK_KINDS` (reception) and `ADMIN_KINDS` (`repair`)                                                                                                                                                                                        |
| `sent_alerts`           | **key** (unique, e.g. `checkout:3:1790740800`), created_at. Stops a timed alert from being sent twice                                                                                                                                                                                                                                                                                                        |

**Enums** (`app/Enums`):

- `Role`, `RoomStatus` (plus `RoomStatusGroup`)
- `GuestType`, `ReservationStatus`, `BookingChannel`, `PaymentStatus`
- `VerificationResult`, `IdCustodyStatus`
- `BilledTo`, `ChargeType`, `PaymentType`, `RefundStatus`
- `ExtensionStatus`, `ConsentStatus`
- `ReminderType`, `ReminderResult`, `NoShowRefund`

**Models** (`app/Models`): one per table. Useful helpers:

- `Setting::get($key)` / `Setting::set()` / `Setting::values()`
- `Room::summary()`, `Room::activeStay()`, `Room::reservations()` (through `reservation_rooms`)
- `Reservation::rooms()`, `amountPaid()` / `balance()` / `paymentStatus()`, `isActive()`, `noShowAllowedFrom()`, `requestRefunds($percent, $reason, $by)`
- `App\Services\Availability`: `busyPeriods($roomIds)`, `blockedReason($room, $start, $end)` (null = free, else a readable reason), `isFree()`, `earliestSlot($pax, $minutes, $locationId, $from)` (group-aware), `UNBOOKABLE` statuses
- `PaymentType::forBooking()`, `RefundStatus::next()`, `Payment::METHODS`

- `Stay::rooms()` (StayRoom), `guests()` (StayGuest), `idCustody()`, `checkedInBy()` / `checkedOutBy()`, `allPayments()` (stay + reservation payments), `balance()`, `isCheckedOut()`, `defaultBilledTo()`, `addRoomCharges()`, `allRoomsInspected()`, `refreshIdCustody()`, `idReturnBlocker()`; `Room::stays()` (through `stay_rooms`); `IdCustody::DISK` (`local`)
- `App\Services\StayExtension`: `conflicts($stay, $newCheckOut)`, `alternatives($reservationRoom, $stay)`, `approve()`, `deny()`, `settle()`; models `Extension::moves()`, `ExtensionMove`

- `Stay::balance()` (includes reservation downpayments), `Stay::releasesRoomForBooking()`
- `User::hasRole()` / `isAdmin()` / `isStaff()`, `User::guest()`, `User::isActive()` / `isLastActiveAdmin()`, scope `User::active()`
- `ActivityLog::record($action, $model, $description, $changes)` / `ActivityLog::withoutLogging(fn () => …)`
- `IdType::active()` (the types reception may choose), `IdType::DEFAULTS`, `IdCustody::idType()`

**SQL Server rule:** foreign keys do **not** cascade, because multiple cascade paths are an error on SQL Server. The only cascades are room → inclusions, rates and maintenance records. Deleting a room or location is blocked in code when it has reservations, stays or rooms.

---

## 8. Code map

### Backend

| Path                                                                                        | Purpose                                                                                                               |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `routes/web.php`                                                                            | All app routes. Admin routes: prefix `admin`, name `admin.`, middleware `role:admin`                                  |
| `routes/settings.php`                                                                       | Profile, password and appearance settings (from the starter kit)                                                      |
| `bootstrap/app.php`                                                                         | Middleware; alias `role` → `App\Http\Middleware\EnsureUserHasRole` (usage `role:reception,admin`)                     |
| `app/Http/Controllers/DashboardController.php`                                              | `/dashboard`: `admin/dashboard` for admins, `reception/dashboard` for reception, `dashboard` (placeholder) for guests |
| `app/Http/Controllers/Reception/ReservationController.php`                                  | Front desk: list (filters), booking page with availability, store (locks rooms), show, cancel, no-show                |
| `app/Http/Controllers/Reception/ReservationPaymentController.php`                           | Record a payment on a reservation (up to the balance)                                                                 |
| `app/Http/Controllers/Reception/RefundController.php`                                       | Refunds list and "advance one step"                                                                                   |
| `app/Http/Requests/Reception/StoreReservationRequest.php`                                   | Booking validation: contact, dates (`Y-m-d\TH:i`), rooms[] (pax ≤ capacity, the room's own rate), payment             |
| `app/Services/Availability.php`, `app/Services/BusyPeriod.php`                              | When rooms are free (rules 11–14), earliest slot for a group                                                          |
| `app/Http/Controllers/Reception/CheckInController.php`                                      | Check-in page (prefilled) and store: failed verification, or stay + rooms + guests + ID (locks rooms)                 |
| `app/Http/Requests/Reception/CheckInRequest.php`                                            | Check-in validation; everything but the notes is skipped when verification failed                                     |
| `app/Http/Controllers/Reception/IdPhotoController.php`                                      | Streams an ID photo from the private disk to staff                                                                    |
| `app/Http/Controllers/Reception/RoomStatusController.php`                                   | Reception's room status changes (reuses the Admin controller's rules, returns to the board)                           |
| `app/Http/Controllers/Reception/StayController.php`                                         | In house list, stay page (bill, rooms, ID, extension check), check out, not extending, return ID                      |
| `app/Http/Controllers/Reception/InspectionController.php`                                   | Inspect a room after check-out: damages, then cleaning or repair                                                      |
| `app/Http/Controllers/Reception/ChargeController.php`, `StayPaymentController.php`          | Add/switch/remove bill lines; payments on a stay                                                                      |
| `app/Http/Controllers/Reception/ExtensionController.php`, `app/Services/StayExtension.php`  | Extensions and Guest B's consent (rules 20 and 21)                                                                    |
| `app/Http/Controllers/Reception/ReminderController.php`                                     | Log the call before check-out                                                                                         |
| `app/Http/Controllers/Reception/CalendarController.php`                                     | The week calendar                                                                                                     |
| `app/Services/FrontDeskAlerts.php`, `app/Notifications/FrontDeskAlert.php`                  | Staff alerts: timed checks (`run()`, `runThrottled()`), `roomReady()`, `extensionDecided()`; database notification    |
| `app/Console/Commands/SendFrontDeskAlerts.php`, `routes/console.php`                        | `front-desk:alerts` command, scheduled every minute                                                                   |
| `app/Http/Controllers/Reception/AlertController.php`                                        | The bell's JSON: latest 15 alerts and unread count (also runs the throttled check), mark one or all read              |
| `app/Http/Controllers/Admin/LocationController.php`                                         | Locations index/store/update/destroy                                                                                  |
| `app/Http/Controllers/Admin/RoomController.php`                                             | Rooms index/store/show/update/destroy                                                                                 |
| `app/Http/Controllers/Admin/RoomStatusController.php`                                       | Manual room status changes (maintenance logging)                                                                      |
| `app/Http/Controllers/Admin/RoomRateController.php`                                         | Rates for a room (scoped bindings)                                                                                    |
| `app/Http/Controllers/Admin/RoomInclusionController.php`                                    | Inclusions for a room                                                                                                 |
| `app/Http/Controllers/Admin/MaintenanceRecordController.php`                                | Maintenance log for a room                                                                                            |
| `app/Http/Controllers/Admin/RateUnitController.php`                                         | Rate units (blocked delete when in use)                                                                               |
| `app/Http/Controllers/Admin/IdTypeController.php`                                           | ID types: add, rename, turn off/on (`is_active`), delete when unused                                                  |
| `app/Http/Controllers/Admin/RoomPhotoController.php`                                        | Room photos: upload, caption / set cover, reorder, delete                                                             |
| `app/Http/Controllers/Admin/RoomCopyController.php`                                         | Copy a room into one or many new rooms (rates, inclusions, photos)                                                    |
| `app/Http/Controllers/Admin/SettingsController.php`                                         | System settings (`/admin/settings`), check-in/out times, "Send me a test email"                                       |
| `app/Http/Controllers/Admin/UserController.php`                                             | Accounts: create, change role, set password, email reset link, deactivate/activate (last-admin guard)                 |
| `app/Http/Controllers/Admin/ActivityLogController.php`                                      | Activity log with filters; add new subject types to its `TYPES`                                                       |
| `app/Http/Middleware/EnsureAccountIsActive.php`                                             | Signs out deactivated accounts (appended to the `web` group in `bootstrap/app.php`)                                   |
| `app/Providers/FortifyServiceProvider.php`                                                  | Login: blocks deactivated accounts; friendly "too many login attempts" message                                        |
| `app/Http/Requests/Settings/ProfileDeleteRequest.php`                                       | Stops the last active Admin from deleting their own account                                                           |
| `app/Concerns/LogsActivity.php`                                                             | Trait: logs created/updated/deleted with old → new values; each model defines `activityLabel()`                       |
| `app/Models/ActivityLog.php`                                                                | Activity log entries: `record()`, `withoutLogging()`                                                                  |
| `app/Http/Requests/Admin/*.php`                                                             | Validation for locations, rooms, rates, maintenance, settings                                                         |
| `app/Actions/Fortify/CreateNewUser.php`                                                     | Self-registration: always role `guest`, requires contact number, creates the `guests` row                             |
| `app/Concerns/ProfileValidationRules.php`                                                   | Shared name/email/contact number rules                                                                                |
| `database/seeders/DatabaseSeeder.php`                                                       | Rate units, default settings, first Admin (safe to re-run)                                                            |
| `database/seeders/DemoSeeder.php`                                                           | Optional sample data (refuses to run if locations exist)                                                              |
| `database/factories/*`                                                                      | `UserFactory` (`admin()`, `reception()`), `LocationFactory`, `RoomFactory` (`status()`)                               |
| `tests/Feature/Admin/*`, `tests/Feature/DashboardTest.php`, `tests/Unit/RoomStatusTest.php` | Tests for everything above                                                                                            |

Admin route names:

- Locations and rooms: `admin.locations.*`, `admin.rooms.*`, `admin.rooms.status.update`, `admin.rooms.copies.store`.
- Room parts:
    - `admin.rooms.rates.*`, `admin.rooms.inclusions.*`
    - `admin.rooms.maintenance.*` (parameter `{maintenanceRecord}`)
    - `admin.rooms.photos.store|update|destroy`, `admin.rooms.photos.reorder` (`PUT rooms/{room}/photos/order`)
- Settings: `admin.rate-units.*` (parameter `{rateUnit}`), `admin.id-types.store|update|destroy` (parameter `{idType}`), `admin.settings.edit|update|test-email`.
- Accounts: `admin.users.index|store|update|password|reset-link|deactivate|activate`, `admin.activity.index`.

Front-desk route names (prefix `reception`, middleware `role:reception,admin`): `reception.reservations.index|create|store|show`, `reception.reservations.cancel|no-show` (PATCH), `reception.reservations.payments.store`, `reception.refunds.index`, `reception.refunds.advance` (PATCH), `reception.reservations.check-in.create|store`, `reception.id-photos.show` (parameter `{idCustody}`), `reception.rooms.status.update` (PATCH), `reception.calendar` (`?start=Y-m-d`), `reception.stays.index|show` (`?show=in_house|to_settle|settled|all`; show takes `?extend_to=` for the extension check), `reception.stays.check-out|return-id|charges.store|payments.store|extensions.store|reminders.store` (POST), `reception.stays.not-extending` (PATCH), `reception.stays.inspections.store` (`stays/{stay}/rooms/{stayRoom}/inspection`), `reception.charges.update|destroy`, `reception.extensions.decide` (PATCH), `reception.alerts.index` (GET, JSON), `reception.alerts.read` (POST `alerts/{alert}/read`), `reception.alerts.read-all` (POST). The booking page takes `?starts_at=2026-10-01T14:00&ends_at=…&pax=…&location=…`, and `?walk_in=1` for walk-in mode.

### Frontend (`resources/js`)

| Path                                                                                                                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.tsx`                                                                                                                         | Inertia app; layout chosen by page name (`auth/*` → AuthLayout, `settings/*` → Settings layout, else AppLayout)                                                                                                                                                                                                                                                                                            |
| `pages/admin/dashboard.tsx`                                                                                                       | Admin dashboard: setup checklist, stat tiles, availability chart, room board, rooms without a price, recent maintenance                                                                                                                                                                                                                                                                                    |
| `pages/admin/locations/index.tsx`                                                                                                 | Location cards plus create/edit dialog                                                                                                                                                                                                                                                                                                                                                                     |
| `pages/admin/rooms/index.tsx`                                                                                                     | Room table with search and filters (URL `?location=`, `&status=`, `&missing=rates` or `&missing=extension`, `&create=1`)                                                                                                                                                                                                                                                                                   |
| `pages/admin/rooms/show.tsx`                                                                                                      | Room page composed of the panels below                                                                                                                                                                                                                                                                                                                                                                     |
| `pages/admin/settings.tsx`                                                                                                        | System settings form (useForm, sticky save bar), check-in/out times, rate units, ID types, Email card                                                                                                                                                                                                                                                                                                      |
| `pages/admin/users.tsx`                                                                                                           | Accounts: role change with confirmation, reset-password dialog, deactivate/reactivate                                                                                                                                                                                                                                                                                                                      |
| `pages/admin/activity.tsx`                                                                                                        | Activity log: filters, old → new values, Newer/Older paging                                                                                                                                                                                                                                                                                                                                                |
| `components/admin/room-photos.tsx`                                                                                                | Photo grid: upload, drag or arrows to reorder, caption dialog, cover, delete                                                                                                                                                                                                                                                                                                                               |
| `components/admin/room-copy-dialog.tsx`                                                                                           | Copy-room dialog: target location, "Number them for me" helper, one name per line                                                                                                                                                                                                                                                                                                                          |
| `pages/dashboard.tsx`                                                                                                             | Placeholder dashboard for guests                                                                                                                                                                                                                                                                                                                                                                           |
| `pages/reception/dashboard.tsx`                                                                                                   | Front desk: search, Walk-in and New reservation (header); stat tiles (rooms occupied, available now, arriving today, due out today); room board with location and status filter chips; "Today" panel (call before check-out, not arrived, arriving today, rooms to inspect, refunds); room dialog (who is in it, next guest, Check in, change status); house rules strip. Reloads every minute (`usePoll`) |
| `pages/reception/reservations/index.tsx`, `create.tsx`, `show.tsx`                                                                | Reservations list (Check in button on rows due today); booking page (company and contact → dates → free rooms → rooms in booking → payment, sticky save bar; `?walk_in=1` = walk-in mode, main button "Save and check in"); reservation page                                                                                                                                                               |
| `components/notification-bell.tsx`, `components/app-sidebar-header.tsx`                                                           | The alert bell (polls `reception.alerts.index` every 60 s, pop-up for new alerts); shown in the header for reception and admin                                                                                                                                                                                                                                                                             |
| `components/count-input.tsx`                                                                                                      | Number box that can be cleared while typing (commits valid numbers only, clamps to max, restores on blur). Use it for guest counts                                                                                                                                                                                                                                                                         |
| `pages/reception/refunds.tsx`                                                                                                     | Refunds to process, refunded, all                                                                                                                                                                                                                                                                                                                                                                          |
| `pages/reception/check-in.tsx`                                                                                                    | The owner's check-in form in 5 numbered steps (booking details, check-out, guest list with rooms, verification, ID with photo). Side panel: progress (ticks per step, jump links) and "This stay" (check-out, length, rooms with guests/capacity and their next booking). Warns when check-out runs into a room's next booking                                                                             |
| `pages/reception/stays/index.tsx`, `stays/show.tsx`                                                                               | In house list; stay page (rooms + inspect, bill, payments, guest list, ID + return, calls and extensions)                                                                                                                                                                                                                                                                                                  |
| `pages/reception/calendar.tsx`                                                                                                    | Week calendar (rooms × days, booking bars, click a free day to book)                                                                                                                                                                                                                                                                                                                                       |
| `components/reception/stay-dialogs.tsx`, `call-dialog.tsx`                                                                        | Inspect, add charge, stay payment, extend (with Guest B), record answer; log call                                                                                                                                                                                                                                                                                                                          |
| `components/date-time-input.tsx`                                                                                                  | Date + time side by side for one `2026-10-01T14:00` value (used by booking, check-in and extend)                                                                                                                                                                                                                                                                                                           |
| `components/admin/room-status-panel.tsx`                                                                                          | Admin room status card; exports `StatusDialog` (takes the route `form`) and `actionLabel`, also used on the reception board                                                                                                                                                                                                                                                                                |
| `components/reception/badges.tsx`, `components/pager.tsx`                                                                         | Reservation, payment and refund badges; Previous/Next pager for paginated lists                                                                                                                                                                                                                                                                                                                            |
| `lib/pricing.ts`                                                                                                                  | `suggestPrice(price, unit, startsAt, endsAt)`                                                                                                                                                                                                                                                                                                                                                              |
| `types/reception.ts`                                                                                                              | `ReservationRow`, `Paginated<T>`, status types                                                                                                                                                                                                                                                                                                                                                             |
| `pages/auth/*`, `pages/settings/*`, `pages/welcome.tsx`                                                                           | Login/register/reset (customised), profile settings, public landing page                                                                                                                                                                                                                                                                                                                                   |
| `components/admin/room-rates.tsx`, `room-maintenance.tsx`, `room-inclusions.tsx`, `room-status-panel.tsx`, `room-form-dialog.tsx` | Room page panels and dialogs                                                                                                                                                                                                                                                                                                                                                                               |
| `components/admin/stat-tile.tsx`, `availability-chart.tsx`, `room-board.tsx`, `setup-checklist.tsx`                               | Dashboard pieces. `RoomBoard` cards show status, the guest in the room (or today's next arrival), pax used/capacity and the due-out or arrival time (red when late); used by both dashboards                                                                                                                                                                                                               |
| `components/page.tsx`                                                                                                             | `Page` (content column) and `PageHeader` (title, description, actions)                                                                                                                                                                                                                                                                                                                                     |
| `components/form-field.tsx`                                                                                                       | Label, control, hint and error                                                                                                                                                                                                                                                                                                                                                                             |
| `components/icon-button.tsx`                                                                                                      | Icon-only button with tooltip label (and `disabledReason`)                                                                                                                                                                                                                                                                                                                                                 |
| `components/confirm-dialog.tsx`                                                                                                   | `ConfirmAction` (asks before any request, e.g. role change) and `ConfirmDelete` (a DELETE)                                                                                                                                                                                                                                                                                                                 |
| `components/empty-state.tsx`, `components/room-status-badge.tsx` (`RoomStatusBadge`, `StatusDot`)                                 | Shared UI                                                                                                                                                                                                                                                                                                                                                                                                  |
| `components/app-sidebar.tsx`                                                                                                      | Role-based navigation sections                                                                                                                                                                                                                                                                                                                                                                             |
| `lib/format.ts`                                                                                                                   | `formatPeso`, `formatDate`, `formatDateTime`, `formatDayTime`, `formatTime`, `formatClock` ("14:00" → "2:00 PM"), `formatLocal` (form value "2026-10-01T14:00"), `formatToday`, `todayIso`, `greeting`, `plural`, `percent` (Manila time)                                                                                                                                                                  |
| `lib/query.ts`                                                                                                                    | `useInitialQuery()` (SSR-safe query string) and `replaceQuery()`                                                                                                                                                                                                                                                                                                                                           |
| `lib/room-status.ts`                                                                                                              | `groupColor` (CSS variables per status group)                                                                                                                                                                                                                                                                                                                                                              |
| `types/admin.ts`, `types/auth.ts`                                                                                                 | Shared TypeScript types (`Role`, `RoomStatus`, `RoomSummary`, …)                                                                                                                                                                                                                                                                                                                                           |
| `css/app.css`                                                                                                                     | Theme tokens: brand navy `#1f3c73` and teal `#0e97ab`, light and dark mode, room status colours                                                                                                                                                                                                                                                                                                            |

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
- **Dates are immutable:** `AppServiceProvider` calls `Date::use(CarbonImmutable::class)`, so model dates and `now()` are `Carbon\CarbonImmutable`, not `Illuminate\Support\Carbon`. Type new code with `CarbonImmutable` (or `CarbonInterface` for inputs) and use `CarbonImmutable::now()` / `::today()`. Older model docblocks (e.g. `Stay`) still say `Illuminate\Support\Carbon`; fix them when you touch them.
- **Ids are integers only because of `App\Concerns\CastsKeysToIntegers`:** SQL Server returns bigint columns (every foreign key) as strings, so `$stayRoom->stay_id === $stay->id` failed ("3" vs 3) and pages got ids as text (bug fixed 30 Sep 2026). Every model with `*_id` / `*_by` columns uses the trait; a text column with such a name must declare its own cast (`maintenance_records.done_by` → `'string'`). The tests run on SQLite, which hides this, so `tests/Unit/CastsKeysToIntegersTest.php` checks the casts directly. Prefer `$child->parent()->is($parent)` over comparing ids.
- **SQL Server rejects the same column twice in ORDER BY.** `$user->notifications()` is already sorted newest first, so never add `->latest()` to it (use `->reorder(...)` for another order). SQLite accepts it, so the tests will not catch this (bug fixed 30 Sep 2026).
- **New alerts:** add a method to `App\Services\FrontDeskAlerts` that sends a `FrontDeskAlert` (kind, title, body, url) through `toDesk($alert, $by)` (reception) or `toAdmins($alert, $by)`; pass the acting user as `$by` so they get a read copy. Timed alerts go in `run()` and use `once($key, …)` with a key that includes the time they are for. Add the kind to `FrontDeskAlert::DESK_KINDS` or `ADMIN_KINDS`, and its icon and tone in `components/notification-bell.tsx`. Write alert text in plain English with singular/plural handled (`trans_choice`, e.g. "1 guest", "2 guests").
- **Booking safety:** re-check availability inside `DB::transaction` after `Room::query()->whereKey($ids)->lockForUpdate()->get()`, and throw a `ValidationException` naming the room if it is no longer free.
- **Activity log:**
    - Every model the Admin edits uses `App\Concerns\LogsActivity` and implements `activityLabel()` (e.g. `room A-104 (Barracks)`).
    - For bulk writes (copying, reordering), wrap the work in `ActivityLog::withoutLogging(fn () => …)` and write one summary with `ActivityLog::record()`.
    - Seeders use `WithoutModelEvents`, so they do not fill the log.
    - A new setting needs a label in `Setting::LABELS` to be logged. A new model type needs an entry in `ActivityLogController::TYPES` to appear in the filter.
- **Accounts:** never hard-delete staff; set `deactivated_at`. Query usable accounts with `User::active()`. Keep the last-admin guard (`isLastActiveAdmin()`) on anything that removes admin access.

### Frontend

- **Write SSR-safe code** (SSR can be switched on in production for the public pages). Never read `window`, `document` or `localStorage` while rendering. Use `useInitialQuery()` for query strings, and format "now" in `Asia/Manila` (see `lib/format.ts`).
- Import routes from Wayfinder: `import RoomController from '@/actions/App/Http/Controllers/Admin/RoomController'` → `RoomController.update.form(id)` / `.url(id)`, or `import { show } from '@/routes/admin/rooms'`.
- Forms: Inertia `<Form {...Controller.action.form(args)} options={{ preserveScroll: true }} onSuccess={...}>` with `FormField` and uncontrolled inputs. Use `useForm` only when you need dirty tracking (settings page).
- Radix `Select` takes a `name` prop, so it submits inside `<Form>`. **Give every `SelectTrigger` in a form or grid `className="w-full"`**: by default it grows with its text and spills into the next column.
- **Date + time:** use `components/date-time-input.tsx` (date shrinks, time keeps room for its clock icon); do not place two raw inputs side by side.
- **Number boxes** people type into (guest counts): use `components/count-input.tsx`, so the box can be emptied and retyped (a plain controlled number input turned "1" + "5" into 15).
- **Dialogs the page opens (`open={…}`)** never get `onOpenChange(true)` from Radix, so do not start work there. Start it in a `useEffect` on `open` (bug fixed 30 Sep 2026: the Extend dialog span on "Checking the rooms…" until the date was changed). A spinner must end when its request ends; if no answer came, offer "Check again" instead of spinning.
- **Live pages:** use Inertia `usePoll(60_000)` for pages reception leaves open (the dashboard does); say "updates every minute" in the page description.
- **Layout ideas taken from the owner's Figma mock-ups (30 Sep 2026),** kept inside the existing sidebar layout:
    - Room cards: status pill top right, "In the room" / "Arriving" / "Vacant", then a footer line with pax and the time. Board data comes from `DashboardController::occupancy()` (`stay`, `arrival` per room; types `RoomOccupancy`, `BoardRoomSummary`).
    - Filters as pill buttons (`aria-pressed`) above the list they filter; status chips carry the dot and count, so they double as the legend.
    - A "Today" panel of to-dos: each item has a coloured left bar (red = act now, primary = scheduled, the room turnover colour = inspection) and one action button on the right. It comes first in the page order, so phones show it before the board; on wide screens it sits in the right column.
    - Long forms show numbered step marks in the card titles and a side panel with progress; the form stays on one page (no wizard), so reception can fill it in any order.
    - Settings that shape the day (times, buffer, grace, reminder) are shown read-only where reception works.
- Page layout: `<Page>` with `<PageHeader title description actions />`. Set `Page.layout = { breadcrumbs: [...] }`, or a function `(props) => ({ breadcrumbs })`.
- Room status colours come only from `groupColor` / `StatusDot` / `RoomStatusBadge`. Text is never coloured with status colours; a coloured dot sits beside the label. The four group colours were validated for colour-blind safety; do not change them casually.

### UX rules (owner's preferences)

- **Card actions go top right of the card header** (e.g. "Add rate", "Add record"). **Page actions go top right of the page header** (e.g. "Add room").
- **Dialogs:** Cancel then the primary button, right-aligned. Destructive or risky actions always confirm: `ConfirmDelete` for deletes, `ConfirmAction` for others (role change, deactivate).
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
        - photos: upload, drag or arrows to reorder, captions, cover
        - rates, with a prompt when there is no extension rate
        - maintenance log
        - inclusions (quantity steppers, inline add)
        - status panel, showing only allowed manual transitions
        - details, edit, delete, **Copy room** (page header)
- **System settings:**
    - standard check-in and check-out times
    - cleaning buffer, no-show grace period, check-out reminder
    - no-show refund policy (full / partial with percentage / none)
    - rate units (add, rename, delete when unused)
    - ID types (add, rename, turn off/on, delete when unused)
    - Email card: mail server details and "Send me a test email"
    - a sticky save bar with unsaved-changes state
- **Users:**
    - create Reception/Admin/Guest accounts
    - change roles (with confirmation)
    - reset passwords (email a link, or set one)
    - deactivate and reactivate (with confirmation)
    - last-admin guard
- **Activity log:** who changed what and when, with old → new values and filters.
- **Front desk** (Reception and Admin, sidebar "Front desk"):
    - reception dashboard: stat tiles in plain words ("Occupied rooms: 2 · Out of 12 rooms · 4 guests staying", "Available now", "Still to arrive today · 2 already checked in · 1 late", "Checking out today · 2 guests to call now") that open the matching list ("Available now" filters the board); search box (goes to all reservations); Walk-in and New reservation buttons; room cards showing who is in each room and when they leave, with location and status filters; clicking a room opens the room details panel: photo, the guests in it, the next arrival (Check in), prices, inclusions, description and status changes; "Today" panel with calls, late guests, arrivals, inspections and refunds; house rules strip; reloads every minute
    - the sidebar shows the account's role (Admin / Reception / Guest) under the user's name
    - alert bell in the header: check-out calls, late guests, arrivals within the hour, rooms ready, extension answers (section 6, "Alerts as built"); the scheduler sends them even when nobody has the bell open
    - walk-in: the **Walk-in** button opens the booking page starting now (rounded up to the quarter hour); "Save and check in" goes straight to the check-in form
    - reservations list: Upcoming, Arriving today, Past grace period, Checked in, Cancelled, No-shows, All; search by name, number, company or room
    - booking page: choose dates and number of guests → free rooms update live (with the reason a room is blocked) → add rooms (guests per room, rate, suggested price) → contact person → optional payment → save; earliest slot for the whole group when rooms are short
    - reservation page: rooms and total, payments (record payment up to the balance), refunds, contact person, who booked; Cancel (reason required), Mark no-show (after the grace period)
    - refunds page: Requested → Processing → Refunded
    - check-in: the owner's form, walk-ins ("Save and check in now"), failed verifications recorded, ID photo kept privately; the reservation page then shows the guest list and the held ID
    - room board on the reception dashboard: click a room to change its status
    - dashboard: "Due out: call first" (log call) and "Rooms to inspect"
    - In house: stay page with check out, inspection, bill (charges, payments, company/guest split), return ID, not extending, extend stay with Guest B's consent, call log
    - Calendar: week view of every room. Colours (legend at the top, explained in words): **violet** = reserved, **red dashed** = not arrived (past the grace period), **orange** = in house (the same orange as "In use" on the room board), **orange stripes** = may extend (kept free until the guest confirms), **grey** = checked out; a **red line** marks now. Bars too short to read show no text (hover or focus shows the details)
- **Branding:** navy and teal theme, anchor logo, light and dark mode, responsive layout.
- **Docs:** requirements v1.1 (HTML and PDF) and flowchart poster updated with all decisions; README describes setup and the admin screens.

---

## 11. Known gaps and gotchas

- **Mail uses Mailpit locally.** Emails are caught at `http://localhost:8025`; if Mailpit is not running, sending fails (the test-email button shows the reason). Set the company's SMTP server in `.env` before go-live.
- **Activity log grows forever.** There is no automatic clean-up yet (see open question 8).
- **The scheduler must be set up on the server.** Alerts are sent by `php artisan schedule:run`, which Windows Task Scheduler must run every minute (section 5). Without it, alerts are only checked while a staff member has the app open (the bell triggers the check). Alerts are sent directly, so no queue worker is needed for them.
- **`notifications` and `sent_alerts` grow over time.** Both are small rows; add a clean-up (e.g. delete read alerts older than 30 days) when the owner decides on retention (open question 8).
- **SQL Server Express AUTO_CLOSE:** new databases get `AUTO_CLOSE ON`, which gives random "Timeout error [258]" errors after the app is idle. It is already turned off on `guest_accommodation` (29 Sep 2026); do the same on any new database (see section 5).
- **`php artisan serve` handles one request at a time.** A long seeding run or long DB transaction can make page loads wait. Use IIS or nginx with PHP-FPM, or `PHP_CLI_SERVER_WORKERS=4`, for real use.
- **SSR:** any `window` use during render causes hydration errors when SSR is on (already fixed once in the rooms and locations pages).
- **Speed (29 Sep 2026):** hover prefetch on sidebar links was removed (the single-request dev server queued prefetches ahead of clicks); sessions and cache use files instead of SQL Server; SSR is off in development.
- **Account deletion:** "Delete account" in profile settings still exists for everyone (the last active Admin is blocked). Staff should be **deactivated** by an Admin instead. Guests may delete their own account; revisit this in Phase 3, when guests have reservations linked to them.
- **Stale project path:** `docs/` still mentions the old project folder path.
- **Editing a reservation (built 5 Oct 2026):** an **Edit** button on an active reservation opens the booking page filled in (`reception.reservations.edit|update`, same page `reservations/create.tsx` with the `editing` prop). Dates, rooms, guests per room, prices and contact details can change; the booking's own rooms count as free; payments stay and are still recorded on the reservation page. Refused when a room is taken by someone else, when the new total is below what was already paid, or when a room is part of another guest's pending extension. Reception gets a "Booking changed" alert. Checked-in, cancelled and no-show reservations cannot be edited.
- **The two sample stays** (converted to the group shape) have no reservation, so they have no room charges and no ID photo; their expected check-out has passed.
- **Not built at the front desk:** discounts (only adding/removing extras), billing a booked room that was not used at check-in, and alerts by SMS (email alerts exist; SMS needs a paid provider).
- **ID photos are personal data:** they sit in `storage/app/private/id-photos` and are included in backups. The Admin sets the retention period in Options (default: keep). **Backups also contain them**, so keep backup files private.
- **Backups are a data export, not a one-click restore.** Each zip holds every table as JSON and the uploaded files. Bringing data back from one needs a technician. Download backups and keep a copy off the server.
- **Nightly jobs need the scheduler** (section 5): ID photo deletion and the 2:00 AM backup run only when `php artisan schedule:run` is set up.
- **Git:** changes have not been committed. Commit them in GitHub Desktop.

---

## 12. Open questions for the owner (ask before building the related feature)

1. **How is a reservation total calculated?** _Built with default (a): suggested rate × units per room, editable (see "Built at the front desk")._ Confirm with the owner.
2. **No-show refund policy:** full, partial or none. The system defaults to Full; the setting already exists.
3. **Guest B consent timing:** how long to wait for Guest B's answer before reception decides, and what happens if nobody answers.
4. **Rooms under maintenance or out of service:** can guests book them for future dates? _Suggested default: not bookable while in those statuses._
5. **Production server:** not decided yet. Development uses local SQL Server Express.
6. **Public room pages:** should prices be shown to visitors who are not logged in? _Default: yes (like Airbnb)._
7. **Photo limits:** maximum photos per room. _Default: 10._
8. **Activity log retention:** keep entries forever, or delete entries older than N months? _Default: keep forever._
9. **Standard check-in/out times:** can reception change the times per booking, or are they fixed? _Built: prefilled, editable._
10. **Payment methods:** is Cash, GCash, Maya, Bank transfer, Card, Other the right list?
11. **Purpose of stay:** free text for now. Required at check-in, or a fixed list (e.g. Project work, Visit, Training)?
12. **Check-in verification:** what does "verification" check (e.g. company confirms the crew list, security clearance)? _Built generically: Passed/Failed with notes._
13. **Walk-ins with no reservation:** _Built: "Save and check in now" on the booking page, so every stay belongs to a reservation._ Confirm with the owner.
14. **Guest list fields:** name and address required, contact number optional. Right?
15. **ID photo retention:** how long to keep ID photos after the ID is returned?
16. **Who pays by default:** answered by making company required: charges go to the company by default (the "guest" fallback only applies to older bookings without a company). Reception can switch any line to the guest.
17. **Unused booked rooms:** when a booked room gets no guests at check-in, should the booking still pay for it? _Built: it is not charged._
18. **Discounts:** needed? How (fixed amount, percentage, who may give them)?
19. **Cleaning before payment:** rooms go to cleaning right after inspection, before the bill is paid. Right?

---

## 13. Next steps, step by step

Build in this order. After each step, write tests and run the checks in section 5.

### Step A: Room photos (admin) ✅ done 29 Sep 2026; reorder and captions done 30 Sep 2026 (`RoomPhotoController`, `components/admin/room-photos.tsx`)

1. Migration `create_room_photos_table` (columns in section 7; `room_id` cascades on room delete, like inclusions). Model `RoomPhoto` with `url` accessor (`Storage::disk('public')->url($path)`); `Room::photos()` ordered by `sort_order`, and `Room::coverPhoto()`.
2. Run `php artisan storage:link` once so uploaded files are served from `/storage`.
3. `Admin\RoomPhotoController` (store, update caption / set cover, reorder, destroy) under `Route::scopeBindings()`: `admin.rooms.photos.*`. Validate `image|mimes:jpg,jpeg,png,webp|max:5120`, up to 10 per room. The first photo becomes the cover automatically; deleting the cover promotes the next one. Delete the file from disk when the row is deleted.
4. Frontend: `components/admin/room-photos.tsx` on the room page (top of the left column): card with "Add photos" (card header, top right), multi-file upload using Inertia `<Form>` (it sends `multipart/form-data` automatically), a thumbnail grid, a "Cover" badge, "Set as cover", caption edit and delete via `IconButton` and `ConfirmDelete`. Show the cover photo on the rooms list and the dashboard room board.
5. Tests: upload with `UploadedFile::fake()->image()` and `Storage::fake('public')`; limits; cover rules; non-admins get 403.

### Step A2: Admin tools ✅ done 30 Sep 2026

Copy a room, photo order and captions, safer accounts, standard check-in/out times, activity log, email via Mailpit. The rules are in section 6 (5a to 5c, "Accounts and audit"), and the files in section 8. Tests: `tests/Feature/Admin/RoomCopyTest.php`, `AccountSafetyTest.php`, `ActivityLogTest.php`, plus new cases in `RoomPhotoTest.php` and `SettingsTest.php`.

### Step A3: Admin extras, pending (build only when the owner asks)

The owner parked these on 30 Sep 2026. The designs below are suggestions; confirm the details with the owner before building. Items 3 to 5 need Phase 3 and 4 data (reservations, stays, payments), so they only become useful after those phases.

1. **Companies list:** an Admin-managed list of the companies guests come from (contractors, visitors), with contact person and billing details. Reception picks from it instead of typing the company, so unpaid company bills group correctly.
    - Today `guests.company` is free text. A `companies` table plus `guests.company_id` would replace it.
    - Ask: are billing details or terms needed per company?
2. **ID types list:** ✅ built 30 Sep 2026 (see rule 5d).
3. **Reports** (Phase 6):
    - guest log, held IDs, unpaid company bills, occupancy
    - date-range filters, print and CSV export
4. **Admin calendar:** a read-only month or week view of every room's reservations and stays, sharing the availability grid built for reception in Step C.4.
5. **Dashboard trends:**
    - occupancy % over time
    - revenue by month
    - top companies
    - no-show and cancellation counts

    Charts on the admin dashboard, using the same colours as the availability chart.

### Step B: Public browsing (Airbnb-style), guests do not need to log in

1. Public routes (no `auth` middleware): `/` shows room listings, `/rooms/{room}` shows a room page. Controller `PublicRoomController` returns only public data: name, location, pax, description, inclusions, standard rates, photos, and free/busy periods (no guest names). Hide rooms that are Under maintenance or Out of service.
2. Pages: replace `pages/welcome.tsx` with a listing page (search bar: location, dates, number of guests; grid of room cards with cover photo, name, location, pax, "from ₱X / night"); add `pages/rooms/show.tsx` (photo gallery, details, inclusions, rates, availability calendar, **Book** button).
3. **Book** when logged out: send to `/login` with the room, dates and pax kept (Laravel's intended URL: `redirect()->guest(...)` or store it before redirecting), then return to the booking step. Sign-up must return to the same place.
4. Public layout: header with logo, "Log in" / "Sign up" (or "My reservations" when logged in), no admin sidebar. Works on phone width.

### Step C: Reservations (Phase 3): front-desk part ✅ done 30 Sep 2026

Built: items 1, 2, 5, 6 and 8 below, extended to **group bookings** (several rooms per reservation; see section 6). Not built: 3 (guest online booking, on hold). Item 4 was built later as the week calendar (Step E) and item 7 as staff alerts (Step F). The original plan is kept for reference.

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

### Step D: Check-in with the owner's form ✅ done 30 Sep 2026

Built as planned below (details in section 6, "Check-in as built"), plus reception room status changes from the dashboard board. Tests: `tests/Feature/Reception/CheckInTest.php`.

1. **Migration: stays become group stays** (convert the 2 demo stays; test on SQLite and SQL Server):
    - `stays`: keep reservation_id (make it required if open question 13 is accepted), guest_id (contact person), verification_attempt_id, checked_in_at, expected_check_out_at, not_extending_confirmed_at, checked_out_at, checked_in_by, checked_out_by. Move `room_id` and `pax` out.
    - new `stay_rooms`: stay_id, room_id, pax. Availability (`Availability::busyPeriods`) must read occupied rooms from here.
    - new `stay_guests`: stay_id, room_id, name, address, contact_number (the guest list; every guest is in one of the stay's rooms).
    - `id_custody`: add `photo_path` (required, on the private `local` disk, e.g. `id-photos/{stay}/{random}.jpg`). One row per stay.
2. **Check-in page** `reception/check-in` (from a reservation's page with a **Check in** button, or new for a walk-in):
    - section 1: company, purpose, contact person, email, contact number (prefilled from the reservation)
    - section 2: check-in and check-out date and time (prefilled; check-out required, rule 9)
    - section 3: guest list rows (name, address, contact number, room select limited to the booking's rooms; "Add guest"); guests per room ≤ capacity
    - section 4: verification result (passed/failed + notes; a failure is saved in `verification_attempts` and stops check-in, rule 7)
    - section 5: valid ID: ID type select (`IdType::active()`), **photo upload (required; accept camera capture on phones, `accept="image/*" capture`)**, ID number; "ID collected" confirms custody
    - on submit, in a transaction with room locks: rooms must be Available and free now; create the stay, stay_rooms, stay_guests, id_custody (status `held`), set the reservation to `checked_in`, and set each room to Occupied
3. **Serve ID photos** through an authorised route (reception/admin only) that streams from the private disk; never link to `/storage`.
4. Tests: every rule above, including a failed verification (no stay, attempt logged), rooms not free, capacity, missing photo, and photo privacy (guest role gets 403).

### Step E: Check-out, billing, calls, extensions and calendar ✅ done 30 Sep 2026

Built as below, plus calls before check-out, extensions with Guest B's consent and the week calendar (details in section 6, "Stays, check-out and billing as built"). Tests: `tests/Feature/Reception/CheckOutTest.php`, `CalendarTest.php`. The original plan:

1. **Check out** button on a checked-in reservation (and a "Due out today" list on the reception dashboard). It records `checked_out_at` / `checked_out_by` at once (the guests may leave, rule 22), and every room of the stay goes Occupied → Check-out → **Inspection**.
2. **Inspection** per room: "No damage" or add damage charges (`charges` type `damage`, description, amount, billed to company by default, rule 23). Then the room goes to **Cleaning**, or **Under maintenance** with an issue if repairs are needed.
3. **Bill:** room charges (the reservation's room prices as `charges` type `room`), extensions, damages and extras, minus all payments including reservation downpayments (`Stay::balance()`, rule 25). Record payments on the stay (`payments.stay_id`).
4. **ID custody:** while the balance is above 0 the ID is `held_pending_payment`; **return the ID** (`returned_at`, `returned_by`) only when the balance is 0 (rule 24).
5. Tests for every rule, including a company-billed booking that keeps the ID until the company pays.

### Step F: Alerts, scheduler and front-desk UX ✅ done 30 Sep 2026

Staff alert bell, the `front-desk:alerts` scheduler, room ready and extension alerts, the dashboard reloading every minute, and the UX pass (dashboard search, Walk-in button, clickable tiles, Check in buttons in lists, `CountInput`). Details are in section 6, "Alerts as built". Tests: `tests/Feature/Reception/AlertTest.php`.

Then a layout pass from the owner's Figma mock-ups (a top-nav dashboard and a 4-step check-in wizard), merged into the existing layout: room cards with occupancy, board filters, the "Today" panel, the house rules strip, and the check-in progress and stay summary panel (conventions in section 9). Not taken: the top navigation bar (the sidebar stays) and a multi-page wizard (one page is faster at the desk). Tests: `tests/Feature/Reception/FrontDeskDashboardTest.php`.

### Step G: Guest side, plan and structure (written 6 Oct 2026; not built yet)

This replaces Step B and Step C.3 above where they differ. The owner's decisions so far:

- An online booking is a **request that Reception approves or declines**. It is never confirmed automatically.
- Guest accounts are managed on their own Admin page (built), not on the Users page.
- The tables for requests exist already: `booking_requests` and `booking_request_rooms` (section 7), with the setting `booking_request_hold_hours` (default 24).

**Rules for a request**

- A pending request **holds its rooms** for its dates, so two guests cannot ask for the same room. The hold ends when Reception declines, the guest cancels, or `hold_expires_at` passes (then the status becomes `expired`).
- `Availability` must count holding requests as busy (`BookingRequest::holding()`); this is the one change to existing staff logic.
- Approve: in a transaction with `Room::lockForUpdate()`, re-check that the rooms are free, create the reservation the same way the front desk does (`booked_via = guest`, find or create the `guests` row linked to the account), copy the rooms, set `reservation_id`, `decided_by`, `decided_at`.
- Decline needs a reason, which the guest sees.
- The same capacity rule as the front desk: every guest needs a place (`guests` against the rooms' pax).
- No online payment in the first version: the request shows the total, and payment is taken by Reception (as now). Online payment is a later, separate step.
- A deactivated guest cannot log in, so cannot request. Pending requests of a deactivated account stay for Reception to decide.

**Screens and addresses**

| Who              | Address                          | Page file                      | What it does                                                                                                                                 |
| ---------------- | -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Anyone           | `/`                              | `pages/public/rooms.tsx`       | Room list: search by location, dates and number of guests; cards with cover photo, name, location, pax and "from ₱X". Replaces `welcome.tsx` |
| Anyone           | `/rooms/{room}`                  | `pages/public/room.tsx`        | Photos, description, inclusions, rates, free/busy times (no names), **Request to book**                                                      |
| Guest            | `/book`                          | `pages/guest/book.tsx`         | Request form: dates, guests, rooms, company, purpose, message; shows the total; refuses when guests have no place                            |
| Guest            | `/my/bookings`                   | `pages/guest/bookings.tsx`     | The guest's requests and reservations with their status                                                                                      |
| Guest            | `/my/bookings/{request}`         | `pages/guest/request.tsx`      | One request: status, decline reason, cancel while pending                                                                                    |
| Guest            | `/my/reservations/{reservation}` | `pages/guest/reservation.tsx`  | One approved booking: rooms, dates, total, payments, cancel (rule 16)                                                                        |
| Reception, Admin | `/reception/requests`            | `pages/reception/requests.tsx` | Requests waiting, oldest first, with Approve and Decline; a count in the sidebar                                                             |

**Code structure**

- Layout: `layouts/public-layout.tsx` (logo, Log in / Sign up, or My bookings and the account menu when logged in; no sidebar; works at phone width). Guests never see the staff sidebar.
- Controllers: `Public/RoomController` (index, show; public data only), `Guest/BookingRequestController` (create, store, index, show, cancel), `Guest/ReservationController` (show, cancel), `Reception/BookingRequestController` (index, approve, decline).
- Requests: `Guest/StoreBookingRequest`, sharing the room and capacity checks with `Reception/StoreReservationRequest` (move them to a trait).
- Service: `app/Services/BookingRequests.php` (submit, approve, decline, cancel, expire) so the rules live in one place.
- Routes: public ones outside `auth`; guest ones under `auth`, `verified`, `role:guest`, names `guest.*`; reception ones inside the existing `reception.` group.
- Alerts: Reception gets "New booking request" (`FrontDeskAlerts`, a desk kind). The guest gets an email and an in-app notification when approved, declined or expired (guest-side bell, rule 27).
- Scheduler: the existing `front-desk:alerts` run also expires requests past `hold_expires_at`.
- Admin: add "Hours a request holds its rooms" to Options.

**Build order (each step works on its own)**

1. **Public browsing:** public layout, room list and room page, with real availability. No login, no booking yet.
2. **Request to book:** the form, the hold, "My bookings", cancel while pending, and login or sign-up that returns to the same room and dates.
3. **Reception decides:** the requests page, approve and decline, the alert, the emails to the guest, and expiry by the scheduler.
4. **After approval:** the guest's reservation page, guest cancellation with refunds (rule 16), and the guest-side notification bell.
5. **Later, only if asked:** online payment, Guest B answering a move request in the app, a guest asking to extend.

**Decided by the owner on 6 Oct 2026:**

- A guest must verify their email before sending a request.
- A company is required on a request, the same as at the front desk.
- One guest may have at most 3 pending requests at a time, so one account cannot hold many rooms.

### What is left

1. **Guest side:** planned in Step G above (plan written 6 Oct 2026; building starts when the owner says). Also still open from the old list: Guest B answering the move request in the app.
2. **Pending front-desk items (owner put these on hold on 6 Oct 2026; build only when asked):**
    - **Guest and company history:** look up a person or company and see past stays and unpaid balances.
    - **Companies list:** pick from saved companies instead of typing, so "Seatech" and "Sea Tech" do not become two companies in reports (a `companies` table plus `guests.company_id`).
    - **Shift handover note** on the dashboard for the next receptionist.
    - **Discounts:** needs the owner's decision on whether they are allowed and who may give them (open question 18).
3. **Admin extras** still parked: admin calendar (reuse `pages/reception/calendar.tsx`), a read-only front-desk overview for the Admin, clean-up of old activity log entries and alerts.
4. **SMS alerts:** need a paid SMS provider; email alerts are built.
5. **Go-live setup:** Windows Task Scheduler entry for `php artisan schedule:run` (section 5), the company's SMTP server, a real web server instead of `php artisan serve`.

---

## 14. Files to paste when asking an AI for help

- **Any change:** this README, plus the exact files you want changed.
- **New admin screen:** `routes/web.php`, one existing admin controller (e.g. `app/Http/Controllers/Admin/LocationController.php`) and its page (`resources/js/pages/admin/locations/index.tsx`) as a pattern, `resources/js/components/page.tsx`, `resources/js/components/form-field.tsx`.
- **Booking or availability logic:** `app/Services/Availability.php`, `app/Http/Controllers/Reception/ReservationController.php`, `app/Http/Requests/Reception/StoreReservationRequest.php`, `app/Models/Reservation.php`, `ReservationRoom.php`, `Stay.php`, `Setting.php`, `app/Enums/RoomStatus.php`, and the migrations `2026_09_29_000003_create_guest_and_booking_tables.php` and `2026_09_30_000003_add_rooms_to_reservations.php`.
- **Front-desk screens:** `resources/js/pages/reception/reservations/create.tsx` (or the page in question; for the dashboard: `pages/reception/dashboard.tsx`, `components/admin/room-board.tsx`, `app/Http/Controllers/DashboardController.php`), `resources/js/lib/pricing.ts`, `resources/js/types/reception.ts`.
- **Check-out, bill or extensions:** `app/Models/Stay.php`, `app/Http/Controllers/Reception/StayController.php`, `app/Services/StayExtension.php`, `resources/js/pages/reception/stays/show.tsx`, `resources/js/components/reception/stay-dialogs.tsx`.
- **Alerts or the bell:** `app/Services/FrontDeskAlerts.php`, `app/Notifications/FrontDeskAlert.php`, `app/Http/Controllers/Reception/AlertController.php`, `routes/console.php`, `resources/js/components/notification-bell.tsx`.
- **Styling:** `resources/css/app.css`, `resources/js/lib/room-status.ts`, `resources/js/components/room-status-badge.tsx`.
- **Accounts, login or activity log:** `app/Models/User.php`, `app/Http/Controllers/Admin/UserController.php`, `app/Providers/FortifyServiceProvider.php`, `app/Concerns/LogsActivity.php`, `app/Models/ActivityLog.php`, `resources/js/pages/admin/users.tsx`.
- **Test failures:** the full error output, plus the test file and the file it tests.
