# Freelancer Jakaria — Nexus Workspace Backend

Express + SQLite API backend for the Nexus Workspace frontend.

## Requirements
- Node.js 20+
- npm

## Setup
```bash
cd Freelancer_Jakaria_Backend
npm install
cp .env.example .env
```
Edit `.env` and set a long random `JWT_SECRET` (32+ characters) and a strong `ADMIN_PASSWORD`. Then run:
```bash
npm run dev
```
API health check: `http://localhost:4000/api/health`

## First admin
The first server start seeds an administrator from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Change the sample password before use. The database file is created at `data/nexus.sqlite`.

## Demo registration and login
Registration:
```bash
curl -X POST http://localhost:4000/api/auth/register \
 -H "Content-Type: application/json" \
 -d '{"name":"Demo Client","email":"client@example.com","password":"StrongPass123"}'
```
In development, response includes `devOtp` when `DEV_RETURN_OTP=true`. Verify:
```bash
curl -X POST http://localhost:4000/api/auth/verify-otp \
 -H "Content-Type: application/json" \
 -d '{"email":"client@example.com","code":"1234"}'
```
Login:
```bash
curl -X POST http://localhost:4000/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"admin@freelancerjakaria.com","password":"YOUR_ADMIN_PASSWORD"}'
```
Send the returned token as `Authorization: Bearer YOUR_TOKEN` for protected endpoints.

## API routes

### Public authentication
- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me` (authenticated)

### Authenticated resources
- `GET/POST /api/projects`, `PATCH/DELETE /api/projects/:id`
- `GET/POST /api/orders`, `PATCH/DELETE /api/orders/:id`
- `GET/POST /api/products`, `PATCH/DELETE /api/products/:id`
- `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/invoices`, `PATCH/DELETE /api/invoices/:id`
- `GET /api/clients` (admin/employee)
- `GET /api/team` (admin/employee)
- `POST /api/team` (admin)
- `GET /api/dashboard/summary` (admin/employee)

### Roles
- `admin`: full management and delete permissions
- `employee`: read/write business resources, no delete/team administration
- `client`: can read own orders/invoices; cannot manage business records

## Security and production checklist
- Set `NODE_ENV=production`, a strong private `JWT_SECRET`, and `DEV_RETURN_OTP=false`.
- Integrate a real email/SMS OTP provider; OTP is logged to the server console in this starter.
- Configure CORS to the exact production frontend origin.
- Add email-based password reset delivery, refresh-token rotation/revocation, CSRF strategy if using cookies, audit logs, backups and monitoring.
- Add pagination and stricter per-field schemas for high-volume production use.
- Use HTTPS in production.
- OAuth buttons, payment processing, file uploads and invoice PDF generation are not wired in this API starter.
- SQLite is suitable for a small deployment; use PostgreSQL/MySQL for concurrent/high-scale production deployments.

## Notes
This backend is a starter implementation. Do not expose `.env`, the SQLite file, or development OTP responses publicly.
