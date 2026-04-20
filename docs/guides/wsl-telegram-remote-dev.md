# WSL Telegram Remote Development

This guide turns the WSL copy of the project into a single-project remote development workspace for Codex + ductor + Telegram + mobile preview.

## Workspace

- Project root: `~/projects/portfolio-manager`
- Local preview app: `http://127.0.0.1:3000`
- Mobile preview tunnel: Cloudflare quick tunnel
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

## Start the local app

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

## Start the mobile preview tunnel

In a second terminal:

```bash
cd ~/projects/portfolio-manager
npm run preview:tunnel:cloudflare
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
npm run remote:ductor
```

Terminal 3:

```bash
cd ~/projects/portfolio-manager
npm run preview:tunnel:cloudflare
```

Now you can:

- chat with the Telegram bot to drive Codex in this repo
- keep commits synced to GitHub
- open the Cloudflare URL on your phone to verify UI changes live

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
- local app URL
- public preview URL
- project path
- tunnel URL file path
- `tmux` session name

## Verify the desktop startup flow

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

- `app`
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