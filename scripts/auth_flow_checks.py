"""Run onboarding/auth checks in a separate local Supabase project. No trading fixtures."""

import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = Path(tempfile.gettempdir()) / "artiste-auth-tests"
ENV_FILE = PROJECT / "test-env.json"
CLI = str(ROOT / "node_modules/.bin/supabase")


def cli(*args):
    return subprocess.run(
        [CLI, *args, "--workdir", str(PROJECT)],
        text=True,
        capture_output=True,
        check=True,
    ).stdout


def prepare():
    from supabase import create_client

    project_supabase = PROJECT / "supabase"
    project_supabase.mkdir(parents=True, exist_ok=True)
    source = (ROOT / "supabase/config.toml").read_text()
    source = re.sub(r"^project_id = .*$", 'project_id = "artiste_auth_tests"', source, flags=re.M)
    source = re.sub(r"\b543(\d{2})\b", r"553\1", source)
    source = source.replace("127.0.0.1:3000", "localhost:3102")
    # Require email confirmations only in this disposable test project.
    start = source.index("[auth.email]\n")
    end = source.index("\n[auth.", start + 1)
    section = source[start:end]
    section = re.sub(
        r"^enable_confirmations = .*$", "enable_confirmations = true", section, flags=re.M
    )
    source = source[:start] + section + source[end:]
    if (project_supabase / "config.toml").exists():
        cli("stop")
    (project_supabase / "config.toml").write_text(source)
    shutil.copytree(
        ROOT / "supabase/migrations", project_supabase / "migrations", dirs_exist_ok=True
    )
    shutil.copyfile(ROOT / "supabase/seed.sql", project_supabase / "seed.sql")
    cli(
        "start",
        "-x",
        "studio,realtime,storage-api,imgproxy,postgres-meta,edge-runtime,logflare,vector,supavisor",
    )
    output = cli("status", "--output", "json")
    settings = json.JSONDecoder().raw_decode(output[output.index("{") :])[0]
    if settings["API_URL"] not in ("http://127.0.0.1:55321", "http://localhost:55321"):
        raise RuntimeError("Auth checks require the isolated local test stack")
    client = create_client(settings["API_URL"], settings["SERVICE_ROLE_KEY"])
    users = client.auth.admin.list_users()
    password = secrets.token_urlsafe(24)
    email = "onboarding-test@example.com"
    existing = next((user for user in users if user.email == email), None)
    if existing:
        user = client.auth.admin.update_user_by_id(
            existing.id, {"password": password, "email_confirm": True}
        ).user
    else:
        user = client.auth.admin.create_user(
            {"email": email, "password": password, "email_confirm": True}
        ).user
    client.table("profiles").update(
        {"onboarding_version": 1, "onboarding_step": 2, "onboarding_completed": True}
    ).eq("id", user.id).execute()
    config = {
        "NEXT_PUBLIC_SUPABASE_URL": settings["API_URL"],
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": settings["ANON_KEY"],
        "NEXT_PUBLIC_SITE_URL": "http://localhost:3102",
        "ARTISTE_API_URL": "http://127.0.0.1:8102",
        "SUPABASE_URL": settings["API_URL"],
        "SUPABASE_SECRET_KEY": settings["SERVICE_ROLE_KEY"],
        "PLAYWRIGHT_TEST_EMAIL": email,
        "PLAYWRIGHT_TEST_PASSWORD": password,
        "PLAYWRIGHT_AUTH_FLOW_TESTS": "1",
        "PLAYWRIGHT_MAILPIT_URL": "http://127.0.0.1:55324",
        "PLAYWRIGHT_BASE_URL": "http://localhost:3102",
        "ARTISTE_NEXT_DIST_DIR": ".next-auth-tests",
    }
    fd = os.open(ENV_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as output_file:
        json.dump(config, output_file)
    print("Prepared isolated auth tests on port 55321. Trading settings were not enabled.")


def main():
    mode = sys.argv[1]
    if mode == "prepare":
        prepare()
        return
    if mode == "stop":
        cli("stop")
        ENV_FILE.unlink(missing_ok=True)
        print("Stopped isolated auth test stack.")
        return
    config = json.loads(ENV_FILE.read_text())
    if config["SUPABASE_URL"] not in ("http://127.0.0.1:55321", "http://localhost:55321"):
        raise RuntimeError("Auth checks require the isolated local test stack")
    env = os.environ.copy()
    for name in tuple(env):
        if name.startswith(("SUPABASE_", "NEXT_PUBLIC_", "PLAYWRIGHT_", "ARTISTE_")):
            env.pop(name)
    if mode == "api":
        env.update({key: config[key] for key in ("SUPABASE_URL", "SUPABASE_SECRET_KEY")})
        command = [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8102",
            "--no-access-log",
        ]
        cwd = ROOT
    elif mode == "browser":
        env.update(
            {
                key: value
                for key, value in config.items()
                if key.startswith(("NEXT_PUBLIC_", "PLAYWRIGHT_", "ARTISTE_"))
            }
        )
        command = ["npm", "run", "test:e2e:configured", "--", *sys.argv[2:]]
        cwd = ROOT / "frontend"
    else:
        raise SystemExit("Use prepare, api, browser or stop")
    raise SystemExit(subprocess.call(command, cwd=cwd, env=env))


if __name__ == "__main__":
    main()
