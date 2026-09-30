# User Service

PickleHub user-service handles user profile reads and updates.

## Overview

- Base URL: `/api/users`
- Swagger UI: `/api-docs`
- Default port: `8006`
- Auth: Bearer JWT on protected endpoints

The service uses Prisma with PostgreSQL and automatically creates a user row the first time an authenticated profile is requested.

## Response Envelope

All successful responses return the same `ApiResponse<T>` wrapper shape:

```json
{
  "success": true,
  "message": "User profile fetched successfully",
  "data": {
    "...": "..."
  }
}
```

The `data` property contains the actual profile payload. Error responses use `success: false` and may include either `message`, `error`, or `errors`.

## Endpoints

### `GET /api/users/me`
Returns the authenticated user's profile inside the standard response envelope.

- Requires `Authorization: Bearer <token>`
- Creates the user row if it does not already exist
- Includes linked DUPR profile data when available

### `PATCH /api/users/me`
Updates editable profile fields for the authenticated user and returns the updated profile inside the standard response envelope.

Allowed fields:

- `fullName`
- `avatarUrl`
- `bio`
- `gender`
- `preferredHand`

Notes:

- Unknown fields are rejected by the global validation pipe
- `selfRating` is managed by the service and is not editable through this endpoint
- Empty updates fall back to returning the current profile

### `GET /api/users/:id`
Returns a public profile for another user by id inside the standard response envelope.

- No authentication required in the controller
- Returns `404` when the user does not exist

## Profile shape

`data` contains this profile shape:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "fullName": "Nguyen Van A",
  "avatarUrl": "https://cdn.example.com/avatars/user-123.png",
  "bio": "Competitive pickleball player.",
  "gender": "MALE",
  "selfRating": 2.5,
  "preferredHand": "RIGHT",
  "dupr": {
    "duprId": "dupr-123",
    "rating": 3,
    "singlesRating": 3.5,
    "doublesRating": 2.5,
    "lastSyncedAt": "2026-04-22T10:30:00.000Z"
  }
}
```

The `dupr` object is present only when a DUPR profile is linked.

## Validation Rules

- `fullName`: string, max 50 characters
- `avatarUrl`: string, max 2048 characters
- `bio`: string, max 255 characters
- `gender`: one of the Prisma `Gender` enum values
- `preferredHand`: one of the Prisma `PreferredHand` enum values
- String fields are trimmed before validation

## Development

From `services/user-service`:

```bash
npm install
npm run prisma:generate
npm run start:dev
```

## Database

The service expects `DATABASE_URL` to point to the user-service PostgreSQL database.

For local Docker-based development, the shared repo `.env.example` defines:

- `USER_DB_USER`
- `USER_DB_PASSWORD`
- `USER_DB_NAME`
- `USER_DB_PORT`
- `USER_DATABASE_URL`

## Related Files

- [Controller](src/user/user.controller.ts)
- [Service](src/user/user.service.ts)
- [DTO](src/user/dto/update-profile.dto.ts)
- [Swagger bootstrap](src/main.ts)
