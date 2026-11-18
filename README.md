# NitsHacks 9.0 Webhook Capture

A small webhook capture service with a live dashboard. Send a request to a token-specific URL and the server saves it, puts it on a background queue, and notifies any connected Socket.IO clients watching that token.

The repository currently contains a built frontend in `index.html` and `assets/`, plus the TypeScript backend in `server/`.

## What it does

- Captures the HTTP method, headers, query string, and request body at `POST`, `GET`, or any other method on `/in/:token`.
- Saves captured requests in PostgreSQL.
- Queues request processing with BullMQ and Redis.
- Streams new requests and history to clients over Socket.IO.
- Provides dashboard endpoints for queue jobs and captured requests.
- Supports collaborative session presence and versioned shared state over Socket.IO.

## Requirements

- Node.js and npm
- Redis available at `localhost:6379`
- A PostgreSQL database reachable through Neon (or a compatible PostgreSQL connection for Prisma)

The Redis host and port are currently set directly in `server/src/lib/redis.ts`.

## Configure the server

Create `server/.env` with the connection strings below:

```env
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."
PORT=3000
```

`DATABASE_URL` is used by the running server. Prisma's CLI configuration reads `DATABASE_URL_UNPOOLED`. Use the appropriate pooled and direct database URLs for your provider; if your provider supplies only one URL, it can be used for both.

## Install and start

From the project root, run:

```sh
npm run setup
npm run db:migrate
npm run dev
```

`setup` installs the backend dependencies and generates the Prisma client. `db:migrate` applies the checked-in database migrations. `dev` starts the backend with automatic restarts when server files change.

You can also run these commands from `server/` directly with `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run dev`.

The backend listens on port `3000` by default. Set `PORT` to use another port.

The root folder contains the static frontend files. Serve the root with a static web server or deploy it to a static host, and point its API and Socket.IO connections at the backend. The built frontend currently uses hashed files under `assets/`.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| Any | `/in/:token` | Capture a request for the given token |
| GET | `/dashboard` | Queue counts: waiting, active, completed, and failed |
| GET | `/jobs` | Recent queue jobs |
| GET | `/jobs/:id` | Job details and in-memory event log |
| GET | `/jobs/:id/logs` | Recent events for a job |
| GET | `/requests` | Latest 100 captured requests |
| GET | `/requests/:id` | One captured request |
| GET | `/:sessionId/state` | Session members and attached job statuses |
| GET | `/:sessionId/events?after=0` | Session deltas after a sequence number |
| GET | `/sessions/:sessionId/state` | Versioned shared state for a session |

For example, send a request to `http://localhost:3000/in/demo-token`. A successful capture returns JSON containing `ok` and the saved event `id`.

## Socket.IO events

Clients can watch a capture token with `watch:token`. The server sends `request:history` when the watch starts and `request:captured` for new requests.

Session clients can use `session:join` and `session:leave` for presence, `session:attach-job` to associate a queue job, and `session:state:set` or `session:state:bulk-set` to update shared values using expected versions. Session changes are sent as `session:delta` events.

## Notes

- Queue event logs and session delta history are held in memory, so they reset when the server restarts.
- Request bodies are stored as JSON when parseable; otherwise they are retained as raw text in the payload.
- The worker currently marks a captured event as processed. It does not deliver the captured request to a separate destination URL.
