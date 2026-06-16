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
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="px-4 pt-4 pr-10">
            <DialogTitle className="text-sm">Edit Decision State</DialogTitle>
          </DialogHeader>

          <form
            action={async (formData) => {
              await updateDecisionStateAction(formData);
              setOpen(false);
            }}
            className="flex min-h-0 flex-col"
          >
            <input type="hidden" name="experimentId" value={experiment.id} />

            <div className="max-h-[calc(90vh-8rem)] min-w-0 space-y-3 overflow-y-auto overflow-x-hidden px-4 pb-4">
              {visibleFields.map(({ key, label, placeholder, rows }) => (
                <div key={key} className="min-w-0 space-y-1">
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
                    className="max-h-40 resize-y text-xs"
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="mx-0 mb-0 shrink-0 gap-2 rounded-b-xl px-4 py-3">
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
