"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const SPLITTER_WIDTH = 32;

interface ResizablePanelsProps {
  left: ReactNode;
  right: ReactNode;
  /** Initial width of the left panel in pixels (default 600) */
  defaultLeftWidth?: number;
  /** Minimum width for each panel in pixels */
  minWidth?: number;
  /** Controlled right-panel collapse state (optional) */
  rightCollapsed?: boolean;
  onRightCollapsedChange?: (collapsed: boolean) => void;
}

export function ResizablePanels({
  left,
  right,
  defaultLeftWidth = 600,
  minWidth = 280,
  rightCollapsed: rightCollapsedProp,
  onRightCollapsedChange,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [_rightCollapsed, _setRightCollapsed] = useState(false);

  // Support controlled or uncontrolled right-panel collapse
  const rightCollapsed = rightCollapsedProp ?? _rightCollapsed;
  function setRightCollapsed(value: boolean) {
    if (onRightCollapsedChange) {
      onRightCollapsedChange(value);
    } else {
      _setRightCollapsed(value);
    }
  }

  // Store width before collapse so we can restore it
  const savedLeftWidth = useRef(defaultLeftWidth);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (leftCollapsed || rightCollapsed) return;
      e.preventDefault();
      setIsDragging(true);
    },
    [leftCollapsed, rightCollapsed]
  );

  useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(e: MouseEvent) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = Math.max(
        minWidth,
        Math.min(e.clientX - rect.left, rect.width - minWidth - SPLITTER_WIDTH)
      );
      setLeftWidth(newWidth);
      savedLeftWidth.current = newWidth;
    }

    function onMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, minWidth]);

  function toggleLeft() {
    if (leftCollapsed) {
      setLeftWidth(savedLeftWidth.current);
    }
    setLeftCollapsed((v) => !v);
  }

  function toggleRight() {
    setRightCollapsed(!rightCollapsed);
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-1 min-h-0 relative",
        isDragging && "select-none"
      )}
    >
      {/* ── Left panel ── */}
      {!leftCollapsed ? (
        <div
          className={cn(
            "flex flex-col min-h-0 overflow-hidden",
            rightCollapsed ? "flex-1" : "shrink-0"
          )}
          style={rightCollapsed ? undefined : { width: leftWidth }}
        >
          {left}
        </div>
      ) : (
        <div className="shrink-0 flex items-start pt-2 px-1 border-r">
          <button
            onClick={toggleLeft}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"
            title="Show stages"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      )}

      {/* ── Drag handle ── */}
      {!leftCollapsed && !rightCollapsed && (
        <div
          className={cn(
            "shrink-0 w-8 relative border-l border-r border-border bg-muted transition-colors",
            isDragging ? "bg-primary/40" : "bg-muted"
          )}
        >
          <div
            onMouseDown={handleMouseDown}
            className="absolute inset-0 cursor-col-resize transition-colors hover:bg-primary/30 active:bg-primary/40"
          />
          <div className="absolute left-1/2 top-2 z-10 flex -translate-x-1/2 flex-col overflow-hidden rounded-md border border-border/80 bg-background/90 shadow-sm backdrop-blur">
            <button
              onClick={toggleLeft}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex size-6 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              title="Collapse stages"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
            <button
              onClick={toggleRight}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex size-6 items-center justify-center border-t border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              title="Collapse chat"
            >
              <PanelRightClose className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Right collapsed rail ── */}
      {rightCollapsed && (
        <div className="shrink-0 flex items-start pt-2 px-1 border-l">
          <button
            onClick={toggleRight}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"
            title="Show chat"
          >
            <PanelRightOpen className="size-4" />
          </button>
        </div>
      )}

      {/* ── Right panel: keep mounted while collapsed so agent session state survives. ── */}
      <div
        aria-hidden={rightCollapsed}
        className={cn(
          "min-w-0 flex flex-col min-h-0 overflow-hidden",
          rightCollapsed
            ? "w-0 shrink-0 pointer-events-none opacity-0"
            : "flex-1"
        )}
      >
        {right}
      </div>
    </div>
  );
}
