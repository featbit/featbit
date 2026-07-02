import { Loader2, Pencil } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BillingInformation } from "../billing-api";
import { fieldValue, type BillingInfoForm } from "../billing-utils";

export function BillingInformationPanel({
  form,
  info,
  isEditing,
  isLoading,
  isError,
  isSaving,
  onEdit,
  onCancel,
  onRetry,
  onSubmit
}: {
  form: UseFormReturn<BillingInfoForm>;
  info?: BillingInformation;
  isEditing: boolean;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onSubmit: (values: BillingInfoForm) => void;
}) {
  return (
    <Card className="rounded-md p-5 shadow-none">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Billing information</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEditing ? "Update invoice recipient, address, and tax details." : "Used for workspace invoices and billing emails."}
          </p>
        </div>
        {!isEditing ? (
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-8" />)}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load billing information.
          <Button className="ml-3" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      ) : isEditing ? (
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField form={form} name="companyName" label="Company name *" />
            <FormField form={form} name="contactEmail" label="Contact email *" />
            <FormField form={form} name="address" label="Address *" />
            <FormField form={form} name="addressLine2" label="Address line 2" />
            <FormField form={form} name="taxId" label="Tax ID" />
            <FormField form={form} name="countryOrRegion" label="Country / Region *" />
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid text-sm md:grid-cols-[12rem_1fr]">
          <InfoRow label="Company name" value={fieldValue(info?.companyName)} />
          <InfoRow label="Contact email" value={fieldValue(info?.contactEmail)} />
          <InfoRow label="Address" value={fieldValue(info?.address)} />
          <InfoRow label="Address line 2" value={fieldValue(info?.addressLine2)} />
          <InfoRow label="Tax ID" value={fieldValue(info?.taxId)} />
          <InfoRow label="Country / Region" value={fieldValue(info?.countryOrRegion ?? info?.country)} />
        </dl>
      )}
    </Card>
  );
}

function FormField({ form, name, label }: { form: UseFormReturn<BillingInfoForm>; name: keyof BillingInfoForm; label: string }) {
  const error = form.formState.errors[name]?.message;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} {...form.register(name)} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const muted = value === "Not provided";
  return (
    <>
      <dt className="border-b py-2 text-muted-foreground">{label}</dt>
      <dd className={cn("border-b py-2", muted && "text-muted-foreground")}>{value}</dd>
    </>
  );
}
