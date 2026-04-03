import logging

from sqlalchemy.engine.url import make_url


def log_database_target(raw_url: str, *, label: str) -> None:
    """Log non-sensitive DB target fields to aid deploy diagnostics."""
    logger = logging.getLogger("app.db")

    try:
        parsed = make_url(raw_url)
    except Exception:
        logger.warning("%s DB target parse failed; check DATABASE_URL format", label)
        return

    host = parsed.host or "local-socket"
    port = parsed.port or "default"
    database = parsed.database or "(none)"
    sslmode = parsed.query.get("sslmode", "not-set")
    pooled_hint = "yes" if "pooler" in host or str(port) == "6543" else "no"

    logger.info(
        "%s DB target driver=%s host=%s port=%s database=%s sslmode=%s pooled_hint=%s",
        label,
        parsed.drivername,
        host,
        port,
        database,
        sslmode,
        pooled_hint,
    )
