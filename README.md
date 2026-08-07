# ZorthDeployHub

Team Web SSH terminal. One shared login, one shared SSH private key, browser shells to configured hosts.

## Requirements

- Node.js 22+
- An SSH private key that can reach your target servers
- Docker (optional, for production-style deploy)

## Quick start (local)

```bash
cp .env.example .env
# edit AUTH_* and SSH_* paths

mkdir -p secrets data
cp ~/.ssh/id_ed25519 secrets/ssh_key
cp ~/.ssh/known_hosts secrets/known_hosts  # optional

npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `AUTH_USERNAME` / `AUTH_PASSWORD`, add a server, click **Open**.

## Docker

```bash
cp .env.example .env
# set AUTH_SECRET, AUTH_USERNAME, AUTH_PASSWORD

# optional: override key mount paths
export SSH_KEY_HOST_PATH=$HOME/.ssh/id_ed25519
export SSH_KNOWN_HOSTS_HOST_PATH=$HOME/.ssh/known_hosts

docker compose up -d --build
```

App listens on port `3000`. SQLite data persists in `./data`.

## Docker image (ARM64)

GitHub Actions builds a `linux/arm64` image and publishes it to GHCR on pushes to `main` / version tags:

```bash
docker pull ghcr.io/zorth44/zorth-deploy-hub:latest
```

If the package is private the first time, open the package settings on GitHub and set visibility to Public.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path, default `file:./data/app.db` |
| `AUTH_SECRET` | Auth.js secret |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Shared web login |
| `AUTH_URL` | Public app URL (e.g. `http://localhost:3000`) |
| `SSH_PRIVATE_KEY_PATH` | Private key used for all SSH sessions |
| `SSH_KNOWN_HOSTS_PATH` | Mounted for ops; host key checks accept for MVP |

## MVP features

- Shared credentials login
- Server CRUD
- Online status (TCP probe ~30s)
- Multi-tab Web Terminal (xterm.js + Socket.IO + ssh2)
- PTY resize / interactive tools (`vim`, `top`, `less`)
- Docker Compose deploy
