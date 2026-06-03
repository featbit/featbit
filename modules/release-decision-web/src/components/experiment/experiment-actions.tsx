"use client";

import { useState } from "react";
import { deleteExperimentAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function ExperimentActions({
  experimentId,
  experimentName,
}: {
  experimentId: string;
  experimentName: string;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 className="size-3" data-icon="inline-start" />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Experiment</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{experimentName}&rdquo;? This
            will permanently remove the experiment, all experiment runs, and activity
            history. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              await deleteExperimentAction(experimentId);
            }}
          >
            {deleting ? "Deleting..." : "Delete Experiment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
