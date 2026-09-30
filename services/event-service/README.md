# Event Service

Base NestJS + Prisma service for PickleHub events domain.

## Available scripts

- `npm run start:dev`: Run in watch mode and regenerate Prisma client.
- `npm run build`: Build TypeScript sources.
- `npm run test`: Run unit tests.
- `npm run test:e2e`: Run e2e tests.
- `npm run prisma:generate`: Generate Prisma client.
- `npm run prisma:migrate`: Create and run local migration.
- `npm run prisma:deploy`: Apply migrations in deploy mode.

## Prisma migration workflow (team-safe)

Event service currently uses this migration chain:

1. `20260328110000_event_baseline`
2. `20260328123000_add_play_session_waitlist_status`

### Fresh database

Run deploy normally:

```bash
docker compose exec event-service npx prisma migrate deploy
```

### Existing database with migration state mismatch

If your schema already contains baseline objects, but migration history marks
`20260328110000_event_baseline` as failed, mark it as applied:

```bash
docker compose exec event-service npx prisma migrate resolve --applied 20260328110000_event_baseline
docker compose exec event-service npx prisma migrate deploy
docker compose exec event-service npx prisma migrate status
```

Expected final result: `Database schema is up to date!`
