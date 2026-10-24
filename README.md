# Rice and Spice

Customer pre-order site plus an admin dashboard, backed by Supabase (Postgres, Auth, row-level security).

## Run

```
npm install
cp .env.example .env.local     # fill in the two public Supabase values
npm run dev                    # http://localhost:5173
npm test                       # unit tests: scheduling, pricing, state machine, analytics
npm run build
```

## Deploy to GitHub Pages

The customer site and `/admin` console are both client-side routes. GitHub Pages hosts the built frontend; Supabase continues to provide the database and staff authentication. In the repository settings, add these Actions variables (Settings → Secrets and variables → Actions → Variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Then enable GitHub Pages with **GitHub Actions** as the build source. The workflow in `.github/workflows/deploy-pages.yml` deploys on pushes to `main` or `master` and on manual runs. Staff authentication and database access remain governed by Supabase RLS; never use a service-role key in the frontend. Set the Supabase Auth site URL and redirect URLs to the published Pages URL so sign-in can return to the site.

- Customer site: `/`  ·  Admin: `/admin` (staff sign in with email and password)  ·  Logos: `/brand`
- Logo: `public/logo.png` (falls back to an SVG recreation if missing)

## How it is built

| Concern | Where it lives |
|---|---|
| Schema, row-level security, order rules | [supabase/migrations/](supabase/migrations/) (apply in order) |
| Data access from the app | [src/data/store.ts](src/data/store.ts) (only file that talks to the database) |
| Staff sign-in and roles | [src/data/auth.ts](src/data/auth.ts) + `staff` table |
| Business rules for the UI preview | [src/features/](src/features/) (pure, unit-tested) |

**The database is the authority.** `place_order` re-prices every line from the catalogue, checks cut-off, notice, blackout dates, capacity and coupons, and holds a per-delivery-date lock so two customers cannot take the last slot. The browser never supplies a price. Order status changes go through `admin_*` functions that enforce the state machine and the caller's role.

**Who can see what**
- Public: menu, categories, active delivery zones, site settings, booked-meal counts per window (no personal data). They can call `place_order`, `get_order` (needs the private tracking token), `find_order` (needs reference and matching phone) and `validate_coupon`.
- Staff (owner, manager, kitchen, delivery): read orders. Owner and manager also edit menu, zones, settings, coupons and run payment/refund actions. Kitchen can only move orders to preparing/ready, delivery only to out-for-delivery/delivered.
- Nobody but staff can read orders, coupons, the audit log or the staff list.

## Setting up your own Supabase project

1. Create a project, then run `supabase/migrations/*.sql` in order (SQL editor, or the Management API).
2. In Authentication, turn off public sign-ups and add the owner user.
3. Add them as staff: `insert into public.staff (user_id, role) values ('<auth user id>', 'owner');`
4. Put the project URL and **publishable** key in `.env.local`. Never put the service-role key or an access token in a `VITE_` variable.

## Browser tests

`npm run e2e` drives real Chrome against the real database (customer journey, admin lifecycle, accessibility, no horizontal scroll). It creates and deletes real rows, so it is guarded:

```
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_ALLOW_DB_RESET=1 npm run e2e
```

Run it only against a **test project with no real orders**: the reset step deletes all orders, coupons and zones and closes pre-orders.

## Not done yet
- **Online payments:** none connected. Orders are marked paid only when staff confirm the money arrived. Paystack/Hubtel need merchant credentials and a server function to verify webhooks.
- **Automatic WhatsApp/SMS/email:** click-to-chat with templates only.
- **Server-rendered SEO:** this is a client-rendered app, so link previews show the static tags in `index.html`. Per-product previews and a sitemap need SSR.
- **Product photos:** the dish photo is a stand-in cropped from the design reference. Upload real photos in Admin. Images are currently stored as URLs/data in the database; move to Supabase Storage before uploading many.
- **Rate limiting:** order lookup and promo-code checks have no per-IP limit yet.
- **Backups:** rely on Supabase's plan. Check that the plan includes daily backups and test a restore before launch.

## Owner decisions still open
Delivery fees and zones, cut-off time, delivery days, portion sizes and add-on prices, kitchen limits, payment provider, refund policy, terms and privacy text, launch date. All start blank or off.
