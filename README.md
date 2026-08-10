# ZorthDeployHub

Team Web SSH terminal. One shared login, one shared SSH private key, browser shells to configured hosts.

## Deploy: single linux/arm64 binary

GitHub Actions builds a self-contained **linux/arm64** binary (React SPA embedded) on pushes to `main` / version tags:

- Workflow: [`.github/workflows/release-arm64.yml`](.github/workflows/release-arm64.yml)
- Artifact: `zorth-deploy-hub-linux-arm64.tar.gz`
- Tags `v*`: attached to the GitHub Release

### Offline / air-gapped

1. Copy the tarball to the target host (no Node/JRE required).
2. Extract and configure:

```bash
tar -xzf zorth-deploy-hub-linux-arm64.tar.gz
cp .env.example .env
# set AUTH_SECRET, AUTH_USERNAME, AUTH_PASSWORD
# point SSH_PRIVATE_KEY_PATH at your private key file

mkdir -p data
chmod +x ./zorth-deploy-hub
./zorth-deploy-hub
```

App listens on `PORT` (default `3000`). SQLite data lives under `./data`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path, default `file:./data/app.db` |
| `AUTH_SECRET` | Session HMAC secret |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Shared web login |
| `SSH_PRIVATE_KEY_PATH` | Private key used for all SSH sessions |
| `PORT` / `LISTEN_HOST` | Bind address (default `0.0.0.0:3000`) |
| `COOKIE_SECURE` | Set `true` when serving over HTTPS |

## Local development (Go + Vite)

```bash
# backend
cp backend/.env.example backend/.env
# or reuse root .env with SSH_PRIVATE_KEY_PATH=./secrets/ssh_key
mkdir -p secrets data
cp ~/.ssh/id_ed25519 secrets/ssh_key

cd backend
go run ./cmd/server

# frontend (another terminal) — proxies /api to :3000
cd web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build the single binary yourself

```bash
cd web && npm ci && npm run build && cd ..
cd backend
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o ../zorth-deploy-hub ./cmd/server
```

`web` build output is written to `backend/internal/static/dist` and embedded into the binary.

## Project layout

| Path | Role |
| --- | --- |
| `backend/` | Go HTTP API, WebSocket terminal, SSH, SQLite, embed |
| `web/` | React + Vite SPA (xterm.js) |
| Root Next.js files | **Legacy** reference only; prefer the Go binary |

## MVP features

- Shared credentials login
- Server CRUD
- Multi-tab Web Terminal (xterm.js + WebSocket + Go SSH)
- PTY resize / interactive tools (`vim`, `top`, `less`)
