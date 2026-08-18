# Elite Drive

A production-oriented premium car rental platform for renters, vehicle owners, and administrators.

**Live application:** https://elite-drive-iota.vercel.app

Elite Drive is built as a multi-role marketplace rather than a static showcase. The application includes live vehicle discovery, authenticated booking creation, customer account workflows, owner fleet operations, identity verification, reviews, promotions, support tooling, and administrative management.

## Product overview

Elite Drive connects three operational roles:

- **Renters** discover available vehicles, apply date and vehicle filters, create bookings, manage trips, complete identity verification, access promotions, make payments, leave reviews, and request support.
- **Vehicle owners** manage cars, availability calendars, bookings, trips, profile verification, wallet activity, and support requests.
- **Administrators** operate platform-level management workflows and oversee marketplace activity.

The public API also exposes vehicle discovery, vehicle detail, availability, reviews, review summaries, and promotion endpoints.

## Core capabilities

| Area | Capability |
| --- | --- |
| Discovery | Live vehicle search backed by the API |
| Availability | Date-aware vehicle availability queries |
| Booking | Authenticated booking creation and booking management |
| Identity | Customer and owner KYC workflows |
| Marketplace | Separate renter, owner, and admin experiences |
| Owner operations | Fleet, calendar, bookings, trips, wallet, and profile management |
| Customer operations | Cars, bookings, payments, promotions, reviews, profile, and support |
| Trust | Authentication, authorization guards, review workflows, and identity verification |
| API | NestJS REST API with DTO validation and Swagger support |
| Deployment | Next.js frontend deployed on Vercel |

## Architecture

```text
┌──────────────────────────────┐
│        Next.js client        │
│  App Router · React · UI     │
└──────────────┬───────────────┘
               │ HTTPS / JSON
               ▼
┌──────────────────────────────┐
│         NestJS API           │
│ Auth · DTO validation · RBAC │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Application data        │
│ MongoDB / persistence layer  │
└──────────────────────────────┘
```

Supporting integrations include transactional email and object/file storage tooling used by backend modules and local infrastructure.

## Technology stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Radix UI / shadcn-style components
- TanStack Query
- Axios
- React Hook Form + Zod
- Framer Motion
- Sonner notifications
- Chart.js

### Backend

- NestJS 10
- TypeScript
- MongoDB / Mongoose
- Prisma tooling
- Passport + JWT authentication
- class-validator / class-transformer
- Swagger
- bcrypt
- Transactional email integrations
- S3-compatible storage tooling

## Repository structure

```text
.
├── client/                 # Next.js application
│   └── src/
│       ├── app/            # Routes for public, customer, owner and admin experiences
│       ├── components/     # Shared UI and providers
│       ├── features/       # Feature-oriented frontend modules
│       ├── hooks/          # Shared React hooks
│       ├── lib/            # API/auth/utilities
│       ├── styles/         # Global styling
│       └── types/          # TypeScript definitions
├── server/                 # NestJS API
│   └── src/
│       ├── common/         # Guards, decorators, DTOs and shared interfaces
│       ├── config/         # App, DB, JWT and Swagger configuration
│       ├── modules/        # Domain modules
│       └── prisma/         # Persistence tooling
└── docker/                 # Local service infrastructure
```

## Local development

### Prerequisites

- Node.js 20 or later
- npm
- MongoDB, either local or hosted
- Docker (optional, for local infrastructure)

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Configure the API

```bash
cd server
cp .env.example .env
npm install
```

Set the required values in `server/.env`. Never commit production credentials.

Start the API:

```bash
npm run start:dev
```

The recommended local API URL is `http://localhost:3001`.

### 3. Configure the web application

In a second terminal:

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

The web app is available at `http://localhost:3000`.

## Environment variables

### Client

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the Elite Drive API |

### Server

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment |
| `APP_PORT` | API port |
| `DATABASE_URL` | Database connection string |
| `JWT_SECRET` | JWT signing secret |
| `BCRYPT_ROUNDS` | Password hashing work factor |
| `BREVO_API_KEY` | Transactional email provider credential |
| `EMAIL_FROM` | Sender email address |
| `EMAIL_FROM_NAME` | Sender display name |

Additional storage/provider variables may be required by optional infrastructure modules.

## API examples

Public endpoints include:

```http
GET /api/cars
GET /api/cars/:car_id
GET /api/cars/:car_id/availability
GET /api/cars/:car_id/reviews
GET /api/reviews/summary
GET /api/promotions
```

Vehicle search supports criteria such as city, category, price range, dates, and transmission.

Authenticated customer booking creation:

```http
POST /api/customer/bookings
Authorization: Bearer <token>
Content-Type: application/json
```

Example payload:

```json
{
  "carId": "vehicle-id",
  "startDate": "2026-08-20",
  "endDate": "2026-08-22",
  "pickupLocation": "Ho Chi Minh City",
  "dropoffLocation": "Ho Chi Minh City"
}
```

## User journeys

### Renter

1. Search the live fleet.
2. Select dates and filters.
3. Sign in or create an account.
4. Complete required verification.
5. Confirm a booking.
6. Manage the booking and trip from the customer workspace.
7. Use payment, review, promotion, and support workflows where applicable.

### Vehicle owner

1. Sign in to the owner workspace.
2. Complete owner verification.
3. Add and manage vehicles.
4. Maintain availability through the calendar.
5. Review incoming bookings and trips.
6. Track wallet and operational activity.

## Security notes

- JWT-based authentication protects private routes.
- Role-aware guards separate customer, owner, and administrative access.
- Request DTOs are validated at the API boundary.
- Secrets belong in environment variables and must never be committed to the repository.
- Local Docker credentials must be treated as disposable development values and replaced before any shared or production deployment.

If a credential has previously been committed, rotate it. Removing it from the latest revision does not remove it from Git history.

## Quality commands

Frontend:

```bash
cd client
npm run lint
npm run build
```

Backend:

```bash
cd server
npm run build
```

## Deployment

The frontend is deployed on Vercel and connected to the repository's `main` branch.

For production deployments:

1. Configure `NEXT_PUBLIC_API_URL` in Vercel.
2. Configure server-side secrets in the backend hosting environment.
3. Build both applications before release.
4. Verify authentication, vehicle search, booking creation, and role-specific dashboards after deployment.

## Engineering decisions

### Why a role-based application structure?

Rental marketplaces have materially different renter, owner, and operator workflows. Keeping these experiences separate at the route and authorization level makes permissions explicit and keeps each workspace focused.

### Why API-backed landing and fleet experiences?

Portfolio projects often fail by presenting polished static data that is disconnected from the real application. Elite Drive treats the public experience as an entry point into the same API-backed fleet and booking workflow used by authenticated renters.

### Why keep infrastructure configuration outside application code?

Application source should remain portable across local, preview, and production environments. Runtime URLs, signing secrets, database credentials, email credentials, and storage credentials therefore belong in environment-specific configuration.

## Status

Elite Drive is an actively developed full-stack product. The current focus is production polish: consistent English UX, stronger automated quality gates, security hardening, observability, and end-to-end verification of critical booking journeys.

## License

This repository is currently provided as a portfolio project. Add an explicit open-source license before granting reuse or redistribution rights.
