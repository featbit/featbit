import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewExperimentForm } from "./new-experiment-form";

export default function NewExperimentPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/experiments" />}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          Back to Experiments
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Release Decision Experiment</CardTitle>
          <CardDescription>
            Create an experiment to track a feature flag through the full experiment
            loop — from intent to decision.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewExperimentForm />
        </CardContent>
      </Card>
    </div>
  );
}
