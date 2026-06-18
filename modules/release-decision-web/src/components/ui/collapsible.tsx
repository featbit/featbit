"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function Collapsible({
  open,
  onOpenChange,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(open ?? false);
  const isOpen = open ?? internalOpen;
  const toggle = onOpenChange ?? setInternalOpen;

  return (
    <div className={className} data-state={isOpen ? "open" : "closed"} {...props}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return React.cloneElement(child as React.ReactElement<any>, {
            "data-state": isOpen ? "open" : "closed",
            __collapsibleOpen: isOpen,
            __collapsibleToggle: () => toggle(!isOpen),
          });
        }
        return child;
      })}
    </div>
  );
}

function CollapsibleTrigger({
  children,
  className,
  __collapsibleOpen,
  __collapsibleToggle,
  ...props
}: React.ComponentProps<"button"> & {
  __collapsibleOpen?: boolean;
  __collapsibleToggle?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={__collapsibleToggle}
      className={cn("flex items-center gap-1 cursor-pointer", className)}
      {...props}
    >
      <ChevronRight
        className={cn(
          "size-3.5 transition-transform duration-200",
          __collapsibleOpen && "rotate-90"
        )}
      />
      {children}
    </button>
  );
}

function CollapsibleContent({
  children,
  className,
  __collapsibleOpen,
  ...props
}: React.ComponentProps<"div"> & {
  __collapsibleOpen?: boolean;
  __collapsibleToggle?: () => void;
}) {
  if (!__collapsibleOpen) return null;
  return (
    <div className={cn("overflow-hidden", className)} {...props}>
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
