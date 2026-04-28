# WSL Telegram Remote Development

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.


This guide turns the WSL copy of the project into a single-project remote development workspace for Codex + ductor + Telegram + mobile preview.

## Workspace

- Project root: `~/projects/portfolio-manager`
- Backend/API host: `http://127.0.0.1:3000`
- Flutter mobile preview: `http://127.0.0.1:3001`
- Mobile preview proxy: `http://127.0.0.1:3010` (`/api/*` -> Next.js API, other paths -> Flutter)
- Mobile preview tunnel: Cloudflare quick tunnel to the mobile preview proxy
- Telegram control plane: ductor running from the project root

## One-time installs in WSL

Install Codex CLI:

```bash
mkdir -p ~/.local/bin
npm install -g @openai/codex --prefix ~/.local
```

Install ductor:

```bash
pipx install ductor
```

Install cloudflared to the user bin directory:

```bash
mkdir -p ~/.local/bin
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared
chmod +x ~/.local/bin/cloudflared
```

Ensure user binaries are on PATH:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## Codex login

Authenticate the CLI inside WSL before using ductor:

```bash
codex login
```

## ductor setup

Run ductor from the project root:

```bash
cd ~/projects/portfolio-manager
npm run remote:ductor
```

During the first-time setup, provide:

- provider: `codex`
- Telegram Bot Token: create via `@BotFather`
- allowed Telegram user IDs: your own Telegram numeric user id only
- working workspace: keep using `~/projects/portfolio-manager`

Recommended helper bots:

- `@BotFather` to create the bot token
- `@userinfobot` to read your numeric Telegram user id

## Start the local backend

Make sure PostgreSQL is running, then start the app so ductor can edit and the tunnel can preview it:

```bash
sudo service postgresql start
cd ~/projects/portfolio-manager
npm run local:start:linux
```

If the database is already prepared and you just want the dev server:

```bash
npm run preview:start
```

## Start the Flutter mobile preview

In a second terminal:

```bash
cd ~/projects/portfolio-manager
npm run mobile:dev:web
```

This builds and serves the Flutter Web release bundle at `http://127.0.0.1:3001`. The release bundle is the default for phone testing because it is more stable behind Cloudflare Tunnel than Flutter's debug web server. The Next.js process on port `3000` remains the current backend/API host while the product migrates to Flutter.

For local hot-reload debugging only:

```bash
cd ~/projects/portfolio-manager
FLUTTER_MOBILE_DEV_SERVER=1 npm run mobile:dev:web
```

## Start the mobile preview proxy

In a third terminal:

```bash
cd ~/projects/portfolio-manager
npm run mobile:preview:proxy
```

This serves the phone-facing preview at `http://127.0.0.1:3010`. It forwards `/api/*` to the Next.js backend on port `3000` and all other paths to Flutter on port `3001`. Use this proxy for phone testing; tunneling directly to `3001` loads the Flutter app but breaks login/API calls.

## Start the mobile preview tunnel

In another terminal:

```bash
cd ~/projects/portfolio-manager
npm run preview:tunnel:cloudflare -- 3010
```

Cloudflare quick tunnel will print a temporary `https://...trycloudflare.com` URL. Open that URL on your phone to see the latest local changes.

## Daily workflow

Terminal 1:

```bash
cd ~/projects/portfolio-manager
npm run local:start:linux
```

Terminal 2:

```bash
cd ~/projects/portfolio-manager
npm run mobile:dev:web
```

Terminal 3:

```bash
cd ~/projects/portfolio-manager
npm run remote:ductor
```

Terminal 4:

```bash
cd ~/projects/portfolio-manager
npm run mobile:preview:proxy
```

Terminal 5:

```bash
cd ~/projects/portfolio-manager
npm run preview:tunnel:cloudflare -- 3010
```

Now you can:

- chat with the Telegram bot to drive Codex in this repo
- keep commits synced to GitHub
- open the Cloudflare URL on your phone to verify Flutter UI changes live

## Security notes

- Keep `allowed_user_ids` restricted to your own Telegram account.
- Treat the Bot Token like a password.
- Cloudflare quick tunnels are temporary and easier to rotate than exposing a fixed port.
- Keep ductor running only when you actually need remote development.

## Tunnel URL file and startup notification

When the Cloudflare quick tunnel starts, the project now writes the public URL to:

- `~/projects/portfolio-manager/.local/cloudflare-tunnel-url.txt`

The tunnel startup also sends a Telegram message to the first `allowed_user_ids` account from the ductor config so you receive the preview URL automatically after each stack start.

The startup Telegram message now includes a simple status card with:

- stack status
- backend/API URL
- Flutter preview URL
- mobile preview proxy URL
- public preview URL
- project path
- tunnel URL file path
- `tmux` session name

## Verify the desktop startup flow

For this WSL-only checkout, the Windows desktop shortcut target should be:

```text
%SystemRoot%\System32\cmd.exe /k wsl.exe -d Ubuntu -- /bin/bash /home/jkliu97/projects/portfolio-manager/scripts/windows-remote-dev-entry.sh
```

Set `Start in` to `%SystemRoot%\System32`.

Use this short check after double-clicking the desktop shortcut:

1. Double-click `Portfolio Remote Dev` on the Windows desktop.
2. Wait for WSL and `tmux` to open.
3. In Telegram, confirm you receive the startup status card with a `trycloudflare.com` URL.
4. Open the `trycloudflare.com` URL on your phone and verify the app loads.
5. In the attached terminal or a fresh WSL shell, run:

```bash
cd ~/projects/portfolio-manager
npm run remote:stack:status
```

You should see the `portfolio-remote-dev` session with these windows:

- `backend`
- `flutter`
- `proxy`
- `ductor`
- `tunnel`

If you need to inspect the live processes directly:

```bash
cd ~/projects/portfolio-manager
npm run remote:stack:attach
```

To stop everything cleanly:

```bash
cd ~/projects/portfolio-manager
npm run remote:stack:stop
```
