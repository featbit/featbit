"use client";

import { useState } from "react";
import { updateDecisionStateAction } from "@/lib/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { Experiment } from "@/generated/prisma";

const ALL_FIELDS: {
  key: keyof Experiment;
  label: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: "description",
    label: "Description",
    placeholder: "A short summary of this experiment for teammates and future-you.",
    rows: 2,
  },
  {
    key: "goal",
    label: "Goal",
    placeholder: "What business outcome are you trying to achieve?",
    rows: 2,
  },
  {
    key: "intent",
    label: "Intent",
    placeholder: "What specific change do you intend to make?",
    rows: 2,
  },
  {
    key: "hypothesis",
    label: "Hypothesis",
    placeholder: "If we do X, we expect Y because Z…",
    rows: 3,
  },
  {
    key: "change",
    label: "Change",
    placeholder: "What exactly will be different in the treatment?",
    rows: 2,
  },
  {
    key: "constraints",
    label: "Constraints",
    placeholder: "Any constraints or limitations to keep in mind?",
    rows: 2,
  },
  {
    key: "primaryMetric",
    label: "Primary Metric",
    placeholder: "e.g. onboarding completion rate",
    rows: 2,
  },
  {
    key: "guardrails",
    label: "Guardrails",
    placeholder: "Metrics that must not regress, one per line",
    rows: 2,
  },
];

/**
 * A pencil button that opens a dialog for editing Decision State fields.
 *
 * `fields` controls which fields are shown (defaults to all).
 * Place inside a flex header row — the button is self-contained.
 */
export function EditDecisionStateDialog({
  experiment,
  fields,
}: {
  experiment: Experiment;
  fields?: Array<keyof Experiment>;
}) {
  const [open, setOpen] = useState(false);
  const visibleFields = fields
    ? ALL_FIELDS.filter((f) => fields.includes(f.key))
    : ALL_FIELDS;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 text-muted-foreground/50 hover:text-foreground transition-colors"
        title="Edit"
      >
        <Pencil className="size-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Decision State</DialogTitle>
          </DialogHeader>

          <form
            action={async (formData) => {
              await updateDecisionStateAction(formData);
              setOpen(false);
            }}
            className="space-y-3 pt-1"
          >
            <input type="hidden" name="experimentId" value={experiment.id} />

            {visibleFields.map(({ key, label, placeholder, rows }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`ds-${key}`} className="text-xs">
                  {label}
                </Label>
                <Textarea
                  id={`ds-${key}`}
                  name={key}
                  defaultValue={
                    (experiment[key] as string | null | undefined) ?? ""
                  }
                  placeholder={placeholder}
                  rows={rows}
                  className="text-xs resize-y"
                />
              </div>
            ))}

            <DialogFooter className="gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
