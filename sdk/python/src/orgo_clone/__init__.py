"""Bottleneck Bots Python SDK — Cloud desktop environments for AI agents."""

from .client import OrgoClient, SyncOrgoClient
from .computer import Computer, SyncComputer
from .workspace import Workspace
from .exceptions import (
    OrgoError,
    AuthenticationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ValidationError,
    ServerError,
)

__version__ = "0.1.0"

__all__ = [
    "OrgoClient",
    "SyncOrgoClient",
    "Computer",
    "SyncComputer",
    "Workspace",
    "OrgoError",
    "AuthenticationError",
    "NotFoundError",
    "ConflictError",
    "RateLimitError",
    "ValidationError",
    "ServerError",
]
