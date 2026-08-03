"""Live terminal dashboard for suite run progress using Rich."""

import sys
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from rich.columns import Columns
from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.spinner import Spinner
from rich.table import Table
from rich.text import Text


# Status tokens
WAITING = "waiting"
RUNNING = "running"
OK = "ok"
FAILED = "failed"
SKIPPED = "skipped"

_STATUS_ICON = {
    WAITING:  ("[dim].[/dim]", "dim"),
    RUNNING:  ("[cyan]>[/cyan]", "cyan"),
    OK:       ("[green]+[/green]", "green"),
    FAILED:   ("[red]x[/red]", "red"),
    SKIPPED:  ("[dim]-[/dim]", "dim"),
}


@dataclass
class _Item:
    name: str
    status: str = WAITING
    duration: Optional[float] = None
    detail: str = ""
    started_at: Optional[float] = None
    children: List["_Item"] = field(default_factory=list)


@dataclass
class _Phase:
    title: str
    items: List[_Item] = field(default_factory=list)
    active: bool = False

    def get(self, name: str) -> Optional[_Item]:
        for item in self.items:
            if item.name == name:
                return item
        return None

    def add(self, name: str) -> _Item:
        item = _Item(name=name)
        self.items.append(item)
        return item

    def set_status(self, name: str, status: str, detail: str = "") -> None:
        item = self.get(name)
        if item is None:
            item = self.add(name)
        if status == RUNNING and item.started_at is None:
            item.started_at = time.perf_counter()
        if status in (OK, FAILED, SKIPPED) and item.started_at is not None:
            item.duration = round(time.perf_counter() - item.started_at, 1)
        item.status = status
        if detail:
            item.detail = detail

    def set_child_status(self, parent_name: str, child_name: str, status: str, detail: str = "") -> None:
        parent = self.get(parent_name)
        if parent is None:
            parent = self.add(parent_name)
        child: Optional[_Item] = None
        for c in parent.children:
            if c.name == child_name:
                child = c
                break
        if child is None:
            child = _Item(name=child_name)
            parent.children.append(child)
        if status == RUNNING and child.started_at is None:
            child.started_at = time.perf_counter()
        if status in (OK, FAILED, SKIPPED) and child.started_at is not None:
            child.duration = round(time.perf_counter() - child.started_at, 1)
        child.status = status
        if detail:
            child.detail = detail


def _build_phase_table(phase: _Phase) -> Panel:
    table = Table.grid(padding=(0, 1))
    table.add_column(width=2, no_wrap=True)
    table.add_column(min_width=32, no_wrap=True)
    table.add_column(width=8, no_wrap=True)
    table.add_column(no_wrap=False)

    for item in phase.items:
        icon_markup, color = _STATUS_ICON.get(item.status, _STATUS_ICON[WAITING])

        if item.status == RUNNING:
            spinner = Spinner("line", style="cyan")
            icon_cell = spinner
        else:
            icon_cell = Text.from_markup(icon_markup)

        name_cell = Text(item.name, style=color if item.status != WAITING else "dim")

        if item.duration is not None:
            dur_cell = Text(f"{item.duration}s", style="dim")
        elif item.status == RUNNING:
            elapsed = round(time.perf_counter() - (item.started_at or time.perf_counter()), 1)
            dur_cell = Text(f"{elapsed}s...", style="cyan dim")
        else:
            dur_cell = Text("")

        detail_cell = Text(item.detail[:60], style="dim") if item.detail else Text("")

        table.add_row(icon_cell, name_cell, dur_cell, detail_cell)

        for child in item.children:
            child_icon_markup, child_color = _STATUS_ICON.get(child.status, _STATUS_ICON[WAITING])
            if child.status == RUNNING:
                child_icon_cell = Spinner("line", style="cyan")
            else:
                child_icon_cell = Text.from_markup(child_icon_markup)
            child_name_cell = Text(
                f"  {child.name}",
                style=child_color if child.status != WAITING else "dim",
            )
            child_detail_cell = Text(child.detail[:50], style="dim") if child.detail else Text("")
            table.add_row(child_icon_cell, child_name_cell, Text(""), child_detail_cell)

    return Panel(table, title=f"[bold]{phase.title}[/bold]", border_style="bright_black")


class SuiteDashboard:
    """Animated terminal dashboard for a suite run.

    Usage::

        dashboard = SuiteDashboard(suite="cp02", with_reset=True, with_seed=True)
        with dashboard:
            dashboard.update_reset_step("api_scale_down", "running")
            # ... run real work ...
            dashboard.update_reset_step("api_scale_down", "ok", duration=1.2)
    """

    # Ordered reset steps
    RESET_STEPS = [
        "api_scale_down",
        "mongodb_delete_flags",
        "redis_readiness",
        "redis_flush",
        "kafka_topics_reset",
        "mirrormaker_restart",
        "redis_readiness_pre_api_scale_up",
        "api_scale_up",
        "stabilization_wait",
        "health_verification",
    ]

    def __init__(
        self,
        suite: str,
        with_reset: bool = False,
        with_seed: bool = False,
        seed_flag_keys: Optional[List[str]] = None,
        scenario_names: Optional[List[str]] = None,
    ) -> None:
        self._suite = suite
        self._with_reset = with_reset
        self._with_seed = with_seed

        self._reset_phase = _Phase(title="Reset")
        if with_reset:
            for step in self.RESET_STEPS:
                self._reset_phase.add(step)

        self._seed_phase = _Phase(title="Seed")
        if with_seed:
            self._seed_phase.add("auth")
            self._seed_phase.add("org / project / env")
            for key in (seed_flag_keys or []):
                self._seed_phase.add(key)

        self._scenario_phase = _Phase(title="Scenarios")
        for name in (scenario_names or []):
            self._scenario_phase.add(name)

        self._console = Console(stderr=False)
        self._live: Optional[Live] = None

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    def __enter__(self) -> "SuiteDashboard":
        self._live = Live(
            self._render(),
            console=self._console,
            refresh_per_second=10,
            transient=False,
        )
        self._live.__enter__()
        return self

    def __exit__(self, *args) -> None:
        if self._live:
            self._live.update(self._render())
            self._live.__exit__(*args)

    # ------------------------------------------------------------------
    # Public update API
    # ------------------------------------------------------------------

    def update_reset_step(self, name: str, status: str, detail: str = "") -> None:
        self._reset_phase.set_status(name, status, detail)
        self._refresh()

    def update_seed_item(self, name: str, status: str, detail: str = "") -> None:
        self._seed_phase.set_status(name, status, detail)
        self._refresh()

    def update_scenario(self, name: str, status: str, detail: str = "") -> None:
        self._scenario_phase.set_status(name, status, detail)
        self._refresh()

    def update_scenario_step(self, scenario_name: str, step_name: str, status: str, detail: str = "") -> None:
        self._scenario_phase.set_child_status(scenario_name, step_name, status, detail)
        self._refresh()

    # ------------------------------------------------------------------
    # Rendering
    # ------------------------------------------------------------------

    def _render(self) -> Layout:
        layout = Layout()
        panels = []

        if self._with_reset:
            panels.append(_build_phase_table(self._reset_phase))
        if self._with_seed:
            panels.append(_build_phase_table(self._seed_phase))
        if self._scenario_phase.items:
            panels.append(_build_phase_table(self._scenario_phase))

        if not panels:
            layout.update(Text(""))
            return layout

        if len(panels) == 1:
            layout.update(panels[0])
            return layout

        layout.split_column(*[Layout(p, name=str(i)) for i, p in enumerate(panels)])
        return layout

    def _refresh(self) -> None:
        if self._live:
            self._live.update(self._render())


def is_interactive() -> bool:
    """Return True when stdout is a real terminal (not piped or CI)."""
    return sys.stdout.isatty()
