"""Structured logging configuration for CLI and reset workflows."""

import logging
import sys

import structlog


def configure_logging() -> None:
    """Configure structlog once for pretty, structured console output."""
    if getattr(configure_logging, "_configured", False):
        return

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="%H:%M:%S"),
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty()),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    configure_logging._configured = True


def get_logger(name: str) -> structlog.typing.FilteringBoundLogger:
    """Return a configured structlog logger."""
    configure_logging()
    return structlog.get_logger(name)
