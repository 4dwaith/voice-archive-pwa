"""Provision only disposable E2E databases through the sibling backend runtime."""

import os
from pathlib import Path
import re
import sys

from dotenv import load_dotenv
from psycopg import connect, sql


def main() -> None:
    action, repository, database, uploads, port = sys.argv[1:]
    if not re.fullmatch(r"va_e2e_[0-9a-f]{32}", database):
        raise SystemExit("Refusing a database name outside the disposable E2E namespace")

    repository_path = Path(repository).resolve(strict=True)
    environment_file = repository_path / ".env.test"
    if not environment_file.is_file():
        raise SystemExit(f"Create {environment_file} as documented in the backend README")
    # Only the explicitly selected test configuration supplies DB credentials.
    load_dotenv(environment_file, override=True)
    sys.path.insert(0, str(repository_path / "src"))
    from voice_archive_api.core.config import Settings

    settings = Settings()
    if settings.environment != "test" or settings.postgres_db != "voice_archive_test":
        raise SystemExit("E2E requires environment=test and the dedicated voice_archive_test admin database")

    if action in {"create", "drop"}:
        with connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            user=settings.postgres_user,
            password=settings.postgres_password.get_secret_value(),
            dbname=settings.postgres_db,
            connect_timeout=5,
            autocommit=True,
        ) as connection:
            if action == "create":
                connection.execute(sql.SQL("CREATE DATABASE {} TEMPLATE template0").format(sql.Identifier(database)))
            else:
                connection.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(database)))
        return

    os.environ["VOICE_ARCHIVE_POSTGRES_DB"] = database
    os.environ["VOICE_ARCHIVE_UPLOAD_ROOT"] = str(Path(uploads).resolve())
    os.environ["VOICE_ARCHIVE_CORS_ORIGINS"] = '["http://127.0.0.1:5174"]'
    os.chdir(repository_path)
    if action == "migrate":
        from alembic import command
        from alembic.config import Config

        command.upgrade(Config(str(repository_path / "alembic.ini")), "head")
    elif action == "serve":
        import uvicorn

        uvicorn.run("voice_archive_api.main:app", host="127.0.0.1", port=int(port), log_level="warning")
    else:
        raise SystemExit(f"Unknown E2E backend action: {action}")


if __name__ == "__main__":
    main()
