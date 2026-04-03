import logging
import socket

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

    logger.warning(
        "%s DB target driver=%s host=%s port=%s database=%s sslmode=%s pooled_hint=%s",
        label,
        parsed.drivername,
        host,
        port,
        database,
        sslmode,
        pooled_hint,
    )


def preflight_database_network(raw_url: str, *, label: str, timeout_sec: int = 5) -> None:
    """Validate DNS resolution and TCP reachability for DB target without exposing secrets."""
    logger = logging.getLogger("app.db")

    try:
        parsed = make_url(raw_url)
    except Exception as exc:
        raise RuntimeError(f"{label} DB URL parse failed") from exc

    host = parsed.host
    port = parsed.port or 5432

    if not host:
        logger.warning("%s DB preflight skipped (no host: likely unix socket)", label)
        return

    try:
        addr_info = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise RuntimeError(f"{label} DNS resolution failed for host={host}") from exc

    addresses = sorted({entry[4][0] for entry in addr_info})
    logger.warning(
        "%s DB preflight DNS ok host=%s resolved_ips=%s port=%s",
        label,
        host,
        ",".join(addresses),
        port,
    )

    last_error: Exception | None = None
    for ip in addresses:
        try:
            with socket.create_connection((ip, port), timeout=timeout_sec):
                logger.warning(
                    "%s DB preflight TCP ok ip=%s port=%s timeout_sec=%s",
                    label,
                    ip,
                    port,
                    timeout_sec,
                )
                return
        except OSError as exc:
            last_error = exc

    raise RuntimeError(
        f"{label} TCP connect failed host={host} port={port} timeout_sec={timeout_sec}"
    ) from last_error
