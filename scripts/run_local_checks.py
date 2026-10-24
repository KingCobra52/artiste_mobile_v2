"""Run services/checks using isolated local fixture settings, never browser admin keys."""

import json
import os
import subprocess
import sys
from pathlib import Path

config = json.loads(Path("/tmp/artiste-web-test-env.json").read_text())
if config["SUPABASE_URL"] not in ("http://127.0.0.1:54321", "http://localhost:54321"):
    raise RuntimeError("Only local Supabase is supported by this helper")
mode = sys.argv[1]
env = os.environ.copy()
# Never pass a database administrative key to frontend or browser-test processes.
for name in ("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"):
    env.pop(name, None)
if mode == "api":
    keys = ("SUPABASE_URL", "SUPABASE_SECRET_KEY")
    command = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--no-access-log",
    ]
    cwd = None
elif mode == "integration":
    keys = tuple(key for key in config if key.startswith("TRADING_E2E_"))
    command = [sys.executable, "-m", "pytest", "tests/test_backend/test_trading_e2e.py", "-q"]
    # Import-time configuration only; integration requests use real user JWTs.
    env.update(SUPABASE_URL=config["SUPABASE_URL"], SUPABASE_SECRET_KEY="unused-test-config")
    cwd = None
elif mode in ("browser", "web"):
    keys = tuple(
        key
        for key in config
        if key.startswith(("NEXT_PUBLIC_", "PLAYWRIGHT_")) or key == "ARTISTE_API_URL"
    )
    command = (
        ["npm", "run", "test:e2e:configured"]
        if mode == "browser"
        else ["npm", "run", "dev", "--", "--webpack", "--hostname", "127.0.0.1", "--port", "3000"]
    )
    cwd = "frontend"
else:
    raise SystemExit("Use api, integration, browser or web")
env.update({key: config[key] for key in keys})
raise SystemExit(subprocess.call(command + sys.argv[2:], env=env, cwd=cwd))
