@echo off
setlocal
wsl.exe bash -lc "export PATH=\"$HOME/.local/bin:$PATH\" && cd ~/projects/portfolio-manager && npm run remote:stack:start && tmux attach -t portfolio-remote-dev"