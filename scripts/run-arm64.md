# ZorthDeployHub (linux/arm64)

Single binary Web SSH hub. Frontend is embedded.

## Quick start

```bash
cp .env.example .env
# edit AUTH_* and SSH_PRIVATE_KEY_PATH

mkdir -p data
chmod +x ./zorth-deploy-hub
./zorth-deploy-hub
```

Open `http://<host>:3000`.

## Required env

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Session HMAC secret |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Shared web login |
| `SSH_PRIVATE_KEY_PATH` | Private key used for all SSH sessions |
| `PORT` | Listen port (default `3000`) |
| `DATABASE_URL` | SQLite path, default `file:./data/app.db` |

Optional: `LISTEN_HOST` (default `0.0.0.0`), `COOKIE_SECURE=true` behind HTTPS.
