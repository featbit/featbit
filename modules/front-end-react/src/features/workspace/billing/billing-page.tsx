import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentWorkspace, localizedPath } from "@/features/layout/context";
import { getRuntimeEnv } from "@/lib/env/runtime-env";
import { fetchWorkspaceDetails, type WorkspaceDetails } from "../workspace-api";
import { WorkspaceLayout } from "../workspace-layout";
import {
  fetchBillingInformation,
  fetchBillingLicense,
  fetchCurrentCycle,
  fetchInvoices,
  fetchSubscription,
  previewProration,
  updateBillingInformation,
  updateSubscription,
  type SubscriptionChangePayload
} from "./billing-api";
import { CheckoutAlert, type CheckoutState, UsageAlert } from "./components/billing-alerts";
import { BillingInformationPanel } from "./components/billing-information-panel";
import { InvoiceHistoryPanel } from "./components/invoice-history-panel";
import { PricingDrawer } from "./components/pricing-drawer";
import { SubscriptionOverview } from "./components/subscription-overview";
import { UpdateSubscriptionDialog } from "./components/update-subscription-dialog";
import {
  HOSTING_MODE_SAAS,
  currentTotal,
  normalizePlan,
  planRank,
  planTotal,
  usageStats,
  type BillingInfoForm,
  type DrawerIntent,
  type PendingChange
} from "./billing-utils";

export function BillingPage({ lang }: { lang: "en" | "zh" }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [workspace, setWorkspace] = useState<WorkspaceDetails>(() => getCurrentWorkspace());
  const [editBillingInfo, setEditBillingInfo] = useState(false);
  const [drawerIntent, setDrawerIntent] = useState<DrawerIntent | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("open") === "pricing" ? "manage" : null;
  });
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment_status");
    if (!paymentStatus) {
      return null;
    }

    return paymentStatus === "succeeded" ? "verifying" : "cancelled";
  });

  const isSaas = getRuntimeEnv().hostingMode === HOSTING_MODE_SAAS;
  const subscriptionQuery = useQuery({ queryKey: ["billing", "subscription"], queryFn: fetchSubscription, enabled: isSaas });
  const cycleQuery = useQuery({ queryKey: ["billing", "current-cycle"], queryFn: fetchCurrentCycle, enabled: isSaas });
  const billingInfoQuery = useQuery({ queryKey: ["billing", "information"], queryFn: fetchBillingInformation, enabled: isSaas });
  const invoiceQuery = useQuery({ queryKey: ["billing", "invoices"], queryFn: fetchInvoices, enabled: isSaas });

  const subscription = subscriptionQuery.data;
  const stats = usageStats(subscription, cycleQuery.data);
  const showUsageAlert = stats.percent >= 90;

  const billingInfoSchema = useMemo(
    () => z.object({
      companyName: z.string().trim().min(1, t("workspace.billing.validation.companyName")),
      contactEmail: z.string().trim().min(1, t("workspace.billing.validation.contactEmail")).email(t("workspace.billing.validation.email")),
      address: z.string().trim().min(1, t("workspace.billing.validation.address")),
      addressLine2: z.string(),
      taxId: z.string(),
      countryOrRegion: z.string().trim().min(1, t("workspace.billing.validation.countryRegion"))
    }),
    [t]
  );

  const billingInfoForm = useForm<BillingInfoForm>({
    resolver: zodResolver(billingInfoSchema),
    defaultValues: {
      companyName: "",
      contactEmail: "",
      address: "",
      addressLine2: "",
      taxId: "",
      countryOrRegion: ""
    }
  });

  const updateBillingInfoMutation = useMutation({
    mutationFn: updateBillingInformation,
    onSuccess: (updated) => {
      queryClient.setQueryData(["billing", "information"], updated);
      setEditBillingInfo(false);
      toast.success(t("workspace.billing.billingInfo.updated"));
    },
    onError: () => toast.error(t("workspace.billing.errors.saveBillingInfo"))
  });

  const prorationQuery = useQuery({
    queryKey: ["billing", "proration", pendingChange?.payload],
    queryFn: () => previewProration(pendingChange!.payload),
    enabled: Boolean(pendingChange?.kind === "upgrade")
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: (change: PendingChange) => updateSubscription(change.kind, change.payload),
    onSuccess: () => {
      toast.success(t("workspace.billing.toast.subscriptionUpdated"));
      setPendingChange(null);
      setDrawerIntent(null);
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: () => toast.error(t("workspace.billing.errors.subscriptionUpdate"))
  });

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceDetails()
      .then((loadedWorkspace) => {
        if (!cancelled) {
          setWorkspace((current) => ({ ...loadedWorkspace, license: loadedWorkspace.license ?? current.license }));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const info = billingInfoQuery.data;
    billingInfoForm.reset({
      companyName: info?.companyName ?? "",
      contactEmail: info?.contactEmail ?? "",
      address: info?.address ?? "",
      addressLine2: info?.addressLine2 ?? "",
      taxId: info?.taxId ?? "",
      countryOrRegion: info?.countryOrRegion ?? info?.country ?? ""
    });
  }, [billingInfoForm, billingInfoQuery.data]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("open") === "pricing") {
      params.delete("open");
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }

    const paymentStatus = params.get("payment_status");
    if (paymentStatus !== "succeeded") {
      return;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      fetchBillingLicense()
        .then(() => {
          setCheckoutState("confirmed");
          window.clearInterval(interval);
          void queryClient.invalidateQueries({ queryKey: ["billing"] });
        })
        .catch(() => {
          if (attempts >= 5) {
            setCheckoutState("timeout");
            window.clearInterval(interval);
          }
        });
    }, 1800);

    return () => window.clearInterval(interval);
  }, [location.pathname, location.search, navigate, queryClient]);

  if (!isSaas) {
    return <Navigate to={localizedPath(lang, "/workspace")} replace />;
  }

  function retryAll() {
    void subscriptionQuery.refetch();
    void cycleQuery.refetch();
    void billingInfoQuery.refetch();
    void invoiceQuery.refetch();
  }

  function startChange(payload: SubscriptionChangePayload) {
    const nextTotal = planTotal(payload);
    const current = currentTotal(subscription);
    const currentPlan = normalizePlan(subscription?.plan);
    const nextPlan = normalizePlan(payload.plan);
    const kind = planRank(nextPlan) >= planRank(currentPlan) ? "upgrade" : "downgrade";
    setPendingChange({ kind, payload, currentTotal: current, nextTotal });
  }

  return (
    <WorkspaceLayout workspace={workspace} lang={lang} activeTab="billing">
      <div className="space-y-6 pb-8 pt-5">
        <CheckoutAlert state={checkoutState} onCheckAgain={() => void fetchBillingLicense().then(() => setCheckoutState("confirmed")).catch(() => setCheckoutState("timeout"))} />

        {showUsageAlert ? (
          <UsageAlert
            percent={stats.percent}
            used={stats.used}
            purchased={stats.purchased}
            exceeded={stats.used > stats.purchased}
            onUpgrade={() => setDrawerIntent("upgrade")}
          />
        ) : null}

        {subscriptionQuery.isError ? (
          <Alert className="flex items-center gap-4 rounded-md border-destructive/30 bg-destructive/5 px-5 py-4 text-foreground">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-destructive/30 bg-background text-destructive">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
            <AlertTitle className="mb-1 text-sm font-semibold text-foreground">{t("workspace.billing.errors.subscriptionTitle")}</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
                {t("workspace.billing.errors.subscriptionDescription")}
            </AlertDescription>
            </div>
            <Button className="shrink-0" variant="outline" size="sm" onClick={retryAll}>
                <RefreshCw className="h-3.5 w-3.5" />
                {t("workspace.billing.actions.retry")}
            </Button>
          </Alert>
        ) : (
          <SubscriptionOverview
            subscription={subscription}
            cycle={cycleQuery.data}
            isLoading={subscriptionQuery.isLoading}
            stats={stats}
            lang={lang}
            onManage={() => setDrawerIntent("manage")}
          />
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <BillingInformationPanel
            form={billingInfoForm}
            info={billingInfoQuery.data}
            isEditing={editBillingInfo}
            isLoading={billingInfoQuery.isLoading}
            isError={billingInfoQuery.isError}
            isSaving={updateBillingInfoMutation.isPending}
            onEdit={() => setEditBillingInfo(true)}
            onCancel={() => {
              setEditBillingInfo(false);
              billingInfoForm.reset();
            }}
            onRetry={() => void billingInfoQuery.refetch()}
            onSubmit={(values) => updateBillingInfoMutation.mutate(values)}
          />

          <InvoiceHistoryPanel
            invoices={invoiceQuery.data ?? []}
            isLoading={invoiceQuery.isLoading}
            isError={invoiceQuery.isError}
            onRetry={() => void invoiceQuery.refetch()}
          />
        </div>
      </div>

      <PricingDrawer
        key={`${subscription?.plan ?? "free"}-${subscription?.mau ?? 0}-${subscription?.addOnFeatures?.join(",") ?? ""}`}
        open={drawerIntent !== null}
        intent={drawerIntent ?? "manage"}
        subscription={subscription}
        stats={stats}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerIntent(null);
          }
        }}
        onStartChange={startChange}
      />

      <UpdateSubscriptionDialog
        change={pendingChange}
        preview={prorationQuery.data}
        previewLoading={prorationQuery.isLoading}
        previewError={prorationQuery.isError}
        updating={updateSubscriptionMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingChange(null);
          }
        }}
        onConfirm={() => {
          if (pendingChange) {
            updateSubscriptionMutation.mutate(pendingChange);
          }
        }}
      />
    </WorkspaceLayout>
  );
}
