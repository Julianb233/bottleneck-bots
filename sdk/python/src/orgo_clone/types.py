"""Shared type definitions for the Bottleneck Bots SDK."""

from __future__ import annotations

from typing import Literal, TypedDict

ComputerStatus = Literal[
    "creating", "starting", "running", "stopping", "stopped", "error"
]


class ExecResult(TypedDict):
    """Result from a bash or code execution command."""

    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int


class ScreenshotMeta(TypedDict):
    """Metadata returned alongside a screenshot."""

    format: str
    width: int
    height: int
    bytes: int
    timestamp: str


class ComputerSpec(TypedDict, total=False):
    """Hardware specification for a computer."""

    cpu: int
    ram: int
    gpu: str
    resolution: str
