import { useState } from "react";
import { useRouter } from "@/lib/router";
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
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
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
              setError(null);

              try {
                await deleteExperimentAction(experimentId);
                router.replace("/");
                router.refresh();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to delete experiment.",
                );
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting..." : "Delete Experiment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
