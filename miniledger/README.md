# MiniLedger

Track money you've lent to friends. Node.js + TypeScript + PostgreSQL backend, React Native (Expo) app.

**Features**
- Phone login with a mock OTP (printed in the server log)
- Add a loan (friend, amount, due date, optional receipt photo) and mark it repaid
- Summary: total lent, total repaid, outstanding, overdue amount
- Overdue entries highlighted in red
- Input validation (Zod on the server, plus client-side checks) and Jest/Supertest tests

## Prerequisites
- Node.js 20+
- Docker (for Postgres), or any local PostgreSQL
- Expo Go on your phone, or an Android emulator / iOS simulator

## 1. Backend

```bash
docker compose up -d            # starts Postgres on :5432
cd backend
cp .env.example .env            # edit JWT_SECRET if you like
npm install
npm run migrate                 # creates tables
npm run dev                     # API on http://localhost:4000
```

The OTP appears in this terminal after you request it:
```
[OTP] +919876543210 -> 482913 (valid 5 min)
```

### Tests
Uses a separate `miniledger_test` database. Create it once, then run:
```bash
docker compose exec db psql -U miniledger -c "CREATE DATABASE miniledger_test;"
cd backend && npm test
```
(Override with `TEST_DATABASE_URL` if your setup differs.)

## 2. Mobile app

```bash
cd mobile
npm install
```

Point the app at the API:
- Android emulator: works out of the box (`10.0.2.2:4000`)
- iOS simulator: works out of the box (`localhost:4000`)
- **Real phone (Expo Go):** use your computer's LAN IP; phone and computer must be on the same Wi-Fi:
  ```bash
  EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 npx expo start
  ```

Otherwise just `npx expo start` and press `a` (Android), `i` (iOS), or scan the QR code.

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/request-otp` | none | `{ phone }`, logs a 6-digit OTP on the server |
| POST | `/auth/verify-otp` | none | `{ phone, otp }`, returns `{ token }` (JWT, 7 days) |
| GET | `/loans` | Bearer | List my loans (each has a server-computed `is_overdue`) |
| POST | `/loans` | Bearer | `friend_name`, `amount`, `due_date` (YYYY-MM-DD), optional `receipt` image. JSON or multipart |
| PATCH | `/loans/:id/repay` | Bearer | Mark as repaid (409 if already repaid, 404 if not yours) |
| GET | `/summary` | Bearer | `{ total_lent, total_repaid, outstanding, overdue_amount }` |

## Design notes
- **OTP:** stored in the `otps` table, 5-minute expiry, single use; requesting a new code invalidates older ones. Consumption is one atomic `UPDATE ... RETURNING`, so a code can't be used twice in a race.
- **Auth:** JWT in `Authorization: Bearer`. Every loan query is scoped by `user_id`, so users can't see or modify each other's data.
- **Overdue** = not repaid AND `due_date < CURRENT_DATE`, computed in SQL so the list and the summary always agree.
- **Summary** is a single query using `SUM(...) FILTER (WHERE ...)`.
- **Money** is `NUMERIC(12,2)` in Postgres (no float rounding in storage).
- **Receipts** are saved to `backend/uploads/` with random filenames (5 MB limit, images only).

## Known limitations (what I'd do next)
- Mock OTP only: no SMS provider, no rate limiting or attempt limits on verification
- Receipt files are served publicly by (unguessable) URL; production would use signed URLs / object storage
- No edit/delete of entries, no pagination
