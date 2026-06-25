# TreeWriter deployment guide

TreeWriter is designed for **local single-user development** by default. The backend binds to `127.0.0.1` and exposes a real shell via `WS /terminal`.

## Local development (default)

```bash
cd view && pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://127.0.0.1:4000
- Terminal WebSocket: ws://127.0.0.1:4000/terminal

No authentication is required in this mode.

## Remote access (SSH tunnel)

To use TreeWriter on a remote machine without exposing ports publicly:

```bash
ssh -L 5173:127.0.0.1:5173 -L 4000:127.0.0.1:4000 user@remote-host
```

Then open http://localhost:5173 on your laptop. All traffic stays inside SSH.

## Optional WebSocket token

Set `TREEWRITER_WS_TOKEN` on the backend and pass the same value when connecting:

```
ws://127.0.0.1:4000/terminal?token=YOUR_SECRET
```

Or send header `X-TreeWriter-Token: YOUR_SECRET` on the upgrade request.

When unset, WebSocket endpoints remain open (localhost-trusted mode).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOST` | `127.0.0.1` | Backend bind address |
| `PORT` | `4000` | Backend HTTP port |
| `TREEWRITER_WS_TOKEN` | *(unset)* | Optional WebSocket auth token |
| `TREEWRITER_DEV_ENDPOINTS` | `false` in production | Enable `POST /api/dev/reset` |
| `NODE_ENV` | — | When `production`, dev reset is disabled unless `TREEWRITER_DEV_ENDPOINTS=true` |

## Threat model summary

| Surface | Localhost | Public network |
|---------|-----------|----------------|
| `WS /terminal` | Full shell in `model/` — acceptable for dev | **Must not expose** without token + VPN |
| REST mutators | No auth | Put behind reverse proxy + API key |
| Overleaf git tokens | Stored in paper INDEX | Use secret store; never commit tokens |

## Production checklist

1. Bind backend to `127.0.0.1` or place behind authenticated reverse proxy.
2. Set `TREEWRITER_WS_TOKEN` if WebSockets are reachable beyond localhost.
3. Do not enable `TREEWRITER_DEV_ENDPOINTS` in production.
4. Run `pnpm ci:all` before deploy.
5. Single-process deployment only (presence, terminal sessions, FTS index are in-memory).
