# Moksha Sewa — Backend API

Node.js + Express + TypeScript + MongoDB backend for the Moksha Sewa platform. Serves both the
customer-facing frontend (`moksha_clone_voyage`) and the admin panel (separate app) over one REST API.

## Stack

- Express + TypeScript
- MongoDB + Mongoose
- JWT auth (access + refresh) for two actor types: `customer` and `admin`
- Phone OTP via a pluggable provider (console for dev, MSG91/AiSensy WhatsApp wired in)
- Email via SMTP (Nodemailer)
- Razorpay for payments and donations
- Cloudinary for media uploads (gallery, service images, blog covers)
- Zod for request validation
- AES-256-GCM field-level encryption for sensitive PII (donor/contact phone, email, PAN, address)

## Getting started

```bash
npm install
cp .env.example .env      # then fill in real values
npm run seed:admin        # creates the first super admin using SEED_ADMIN_* env vars
npm run dev
```

API runs at `http://localhost:5000`, routes mounted under `/api/v1`.

## Project structure

```
src/
├── config/        env validation, DB connection, logger
├── models/        Mongoose schemas — one per collection
├── modules/       one folder per feature: validation + service + controller + routes
├── middlewares/    auth guard, request validation, centralized error handler
├── lib/           cross-cutting infra: OTP (pluggable), email, tokens, password hashing, Razorpay, crypto
├── utils/         ApiError, ApiResponse, asyncHandler, generic admin CRUD factory
├── routes/        aggregates all module routers under /api/v1
├── scripts/       one-off scripts (seed admin)
├── app.ts         Express app: middleware, routes, error handling
└── server.ts       entrypoint: connects DB, starts HTTP server
```

## Auth model

Every JWT carries `{ id, type: 'customer' | 'admin', role }`. `requireAuth` verifies the token;
`requireActorType('customer' | 'admin')` restricts a route to one side; `requireAdminRole(...)`
further restricts admin routes by role (`superadmin`, `manager`, `staff`).

Customers can authenticate two ways (both live at once, per your call):
- **Phone OTP** — `POST /auth/otp/send`, `POST /auth/otp/verify` (agency-agnostic: set `OTP_PROVIDER`)
- **Email + password** — `POST /auth/register`, `POST /auth/login`

Admins only use email + password: `POST /admin/auth/login`.

## Swapping the SMS/OTP agency

`OTP_PROVIDER` in `.env` picks the implementation (`src/lib/otp/otp.factory.ts`): `console` (dev,
free, logs the OTP), `msg91` (SMS), or `aisensy` (WhatsApp — needs an approved OTP template/campaign
in your AiSensy account, named via `AISENSY_CAMPAIGN_OTP`). To use a different agency, add
`src/lib/otp/providers/<agency>.provider.ts` implementing `OtpProvider`, register it in the
factory, and flip `OTP_PROVIDER` — nothing else in the codebase changes.

## Field-level encryption

Sensitive PII — donor/contact `phone`, `email`, `pan`, and the street-address `line1` — is
encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`) before it's ever written to MongoDB.
`encryptFieldsOnSave` (`src/lib/fieldEncryption.ts`) hooks each model's `pre('save')` so this
happens automatically for `Model.create()`/`doc.save()` — see `donation.model.ts`,
`enquiry.model.ts`, and `booking.model.ts`.

**Required setup:** `ENCRYPTION_KEY` must be a base64 string decoding to exactly 32 bytes. The
server refuses to boot without a valid one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Reading it back — two different rules, on purpose:**
- A user viewing **their own** data (their own booking, the donor's own post-payment receipt) is
  always shown the decrypted value — `decryptField()`, never gated. Hiding someone's own phone
  number from them isn't security, it's a broken UI.
- An **admin** viewing someone else's PII goes through `maybeDecrypt()`, gated by the
  `EXPOSE_DECRYPTED_DATA` env toggle. `false` (default) → admin APIs return ciphertext. `true` →
  they're transparently decrypted. This is a developer/ops switch in `.env`, not a runtime
  per-request toggle — flipping it exposes PII to anyone with admin API access, so treat `true`
  as an explicit, deliberate choice for trusted environments only.

**Known limitation:** encryption only covers fields written via `Model.create()`/`doc.save()`.
`findOneAndUpdate` paths (e.g. a customer editing their saved addresses) aren't hooked — extending
this to array/subdocument updates safely needs more care than the generic helper gives, so those
fields are deliberately left out of encryption scope for now rather than half-covered.

## Admin CRUD pattern

Most catalog-style resources (services, pandits, drivers, blog, gallery, testimonials, FAQs)
follow the same shape: a small public read controller with domain-specific filtering, plus
`buildAdminCrudHandlers` (`src/utils/crudFactory.ts`) for the admin list/get/create/update/delete
surface under `/admin/*`. Look at `src/modules/service/` as the reference implementation.

## Booking status flow

`pending → confirmed → in_progress → completed`, with `cancelled` reachable from `pending`/`confirmed`.
Admin assigns a pandit/driver via `PATCH /bookings/:id/assign`, which auto-confirms a pending booking.
