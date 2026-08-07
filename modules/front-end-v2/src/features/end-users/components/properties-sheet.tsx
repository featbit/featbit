import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { removeEndUserProperty, upsertEndUserProperty } from "../end-users-api"
import type {
  EndUserProperty,
  EndUserPropertyPayload,
} from "../end-users-types"
import { PresetValuesDialog } from "./preset-values-dialog"
import {
  NewPropertyRow,
  PropertyRow,
  type PropertyDraft,
} from "./property-rows"
import {
  NumberedPagination,
  SearchInput,
  TableMessage,
  TableSkeleton,
} from "./shared"

const PAGE_SIZE = 10

export function PropertiesSheet({
  envId,
  open,
  properties,
  loading,
  error,
  onRetry,
  onOpenChange,
}: {
  envId: string
  open: boolean
  properties: EndUserProperty[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [newDraft, setNewDraft] = useState<PropertyDraft | null>(null)
  const [editing, setEditing] = useState<PropertyDraft | null>(null)
  const [removeTarget, setRemoveTarget] = useState<EndUserProperty | null>(null)
  const [presetTarget, setPresetTarget] = useState<EndUserProperty | null>(null)
  const [validationError, setValidationError] = useState("")
  const [pendingDigestValues, setPendingDigestValues] = useState<
    Record<string, boolean>
  >({})

  const filtered = useMemo(() => {
    const filter = search.trim().toLowerCase()
    return properties.filter((property) =>
      property.name.toLowerCase().includes(filter)
    )
  }, [properties, search])
  const rows = newDraft ? [...filtered, newDraft] : filtered
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const displayedRows = rows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  function updateCache(
    updater: (current: EndUserProperty[]) => EndUserProperty[]
  ) {
    queryClient.setQueryData<EndUserProperty[]>(
      ["end-users", envId, "properties"],
      (current = []) => updater(current)
    )
  }

  const saveMutation = useMutation({
    mutationFn: ({
      propertyId,
      payload,
    }: {
      propertyId: string
      payload: EndUserPropertyPayload
    }) => upsertEndUserProperty(envId, propertyId, payload),
    onSuccess: (saved) => {
      updateCache((current) => {
        const exists = current.some((property) => property.id === saved.id)
        return exists
          ? current.map((property) =>
              property.id === saved.id ? saved : property
            )
          : [...current, saved]
      })
      setNewDraft(null)
      setEditing(null)
      setPresetTarget(null)
      setValidationError("")
      toast.success(t("endUsers.operationSucceeded"))
    },
    onError: () => toast.error(t("endUsers.operationFailed")),
  })
  const removeMutation = useMutation({
    mutationFn: (property: EndUserProperty) =>
      removeEndUserProperty(envId, property.id),
    onSuccess: (_, property) => {
      updateCache((current) =>
        current.filter((item) => item.id !== property.id)
      )
      setRemoveTarget(null)
      toast.success(t("endUsers.operationSucceeded"))
    },
    onError: () => toast.error(t("endUsers.operationFailed")),
  })

  function validateName(name: string, propertyId?: string) {
    const trimmed = name.trim()
    if (!trimmed) {
      setValidationError(t("endUsers.propertiesDrawer.nameRequired"))
      return false
    }
    if (
      properties.some(
        (property) =>
          property.id !== propertyId &&
          property.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setValidationError(t("endUsers.propertiesDrawer.nameDuplicate"))
      return false
    }
    setValidationError("")
    return true
  }

  function saveNew() {
    if (!newDraft || !validateName(newDraft.name)) return
    saveMutation.mutate({
      propertyId: newDraft.id,
      payload: {
        name: newDraft.name.trim(),
        remark: newDraft.remark.trim(),
        isDigestField: newDraft.isDigestField,
        presetValues: [],
        usePresetValuesOnly: false,
      },
    })
  }

  function saveEdit(property: EndUserProperty) {
    if (!editing) return
    saveMutation.mutate({
      propertyId: property.id,
      payload: propertyPayload(property, { remark: editing.remark.trim() }),
    })
  }

  function toggleDigest(property: EndUserProperty, checked: boolean) {
    setPendingDigestValues((current) => ({
      ...current,
      [property.id]: checked,
    }))
    saveMutation.mutate(
      {
        propertyId: property.id,
        payload: propertyPayload(property, { isDigestField: checked }),
      },
      {
        onSettled: () =>
          setPendingDigestValues((current) => {
            const next = { ...current }
            delete next[property.id]
            return next
          }),
      }
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,920px)] data-[side=right]:sm:max-w-[920px]">
          <SheetHeader className="border-b px-6 py-5 pr-12">
            <SheetTitle>{t("endUsers.propertiesDrawer.title")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("endUsers.propertiesDrawer.title")}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <SearchInput
                value={search}
                placeholder={t("endUsers.propertiesDrawer.filter")}
                className="w-72"
                onChange={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
              />
              <Button
                type="button"
                disabled={Boolean(newDraft)}
                onClick={() => {
                  setSearch("")
                  setPage(Math.floor(properties.length / PAGE_SIZE) + 1)
                  setValidationError("")
                  setNewDraft({
                    id: crypto.randomUUID(),
                    name: "",
                    remark: "",
                    isDigestField: false,
                  })
                }}
              >
                <Plus />
                {t("endUsers.propertiesDrawer.add")}
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[20%] px-4 py-4 font-semibold">
                      {t("endUsers.name")}
                    </TableHead>
                    <TableHead className="w-[15%] px-4 py-4 text-center font-semibold">
                      {t("endUsers.propertiesDrawer.digest")}
                    </TableHead>
                    <TableHead className="w-[28%] px-4 py-4 font-semibold">
                      {t("endUsers.propertiesDrawer.comment")}
                    </TableHead>
                    <TableHead className="px-4 py-4 font-semibold">
                      {t("endUsers.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton columns={4} rows={7} />
                  ) : error ? (
                    <TableMessage
                      columns={4}
                      title={t("endUsers.propertiesDrawer.loadFailed")}
                      action={
                        <Button variant="outline" onClick={onRetry}>
                          {t("endUsers.retry")}
                        </Button>
                      }
                    />
                  ) : !displayedRows.length ? (
                    <TableMessage
                      columns={4}
                      title={t("endUsers.propertiesDrawer.noMatch")}
                      action={
                        <Button variant="outline" onClick={() => setSearch("")}>
                          {t("endUsers.clearSearch")}
                        </Button>
                      }
                    />
                  ) : (
                    displayedRows.map((row) =>
                      isEndUserProperty(row) ? (
                        <PropertyRow
                          key={row.id}
                          property={row}
                          editing={editing?.id === row.id}
                          editRemark={editing?.remark ?? ""}
                          saving={saveMutation.isPending}
                          digestChecked={
                            pendingDigestValues[row.id] ?? row.isDigestField
                          }
                          onEditRemark={(remark) =>
                            setEditing((current) =>
                              current ? { ...current, remark } : current
                            )
                          }
                          onEdit={() => {
                            setValidationError("")
                            setEditing({
                              id: row.id,
                              name: row.name,
                              remark: row.remark,
                              isDigestField: row.isDigestField,
                            })
                          }}
                          onCancel={() => setEditing(null)}
                          onSave={() => saveEdit(row)}
                          onToggleDigest={(checked) =>
                            toggleDigest(row, checked)
                          }
                          onPresets={() => setPresetTarget(row)}
                          onRemove={() => setRemoveTarget(row)}
                        />
                      ) : (
                        <NewPropertyRow
                          key={row.id}
                          draft={row}
                          error={validationError}
                          saving={saveMutation.isPending}
                          onChange={setNewDraft}
                          onSave={saveNew}
                          onCancel={() => {
                            setNewDraft(null)
                            setValidationError("")
                          }}
                        />
                      )
                    )
                  )}
                </TableBody>
              </Table>
            </div>
            {rows.length > PAGE_SIZE ? (
              <NumberedPagination
                page={safePage}
                pageSize={PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      {presetTarget ? (
        <PresetValuesDialog
          key={presetTarget.id}
          property={presetTarget}
          saving={saveMutation.isPending}
          onOpenChange={(nextOpen) => !nextOpen && setPresetTarget(null)}
          onSave={(property, presetValues, usePresetValuesOnly) =>
            saveMutation.mutate({
              propertyId: property.id,
              payload: propertyPayload(property, {
                presetValues,
                usePresetValuesOnly,
              }),
            })
          }
        />
      ) : null}
      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("endUsers.propertiesDrawer.removeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("endUsers.propertiesDrawer.removeDescription", {
                name: removeTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t-0 bg-transparent">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              {t("endUsers.propertiesDrawer.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() =>
                removeTarget && removeMutation.mutate(removeTarget)
              }
            >
              {removeMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {t(
                removeMutation.isPending
                  ? "endUsers.propertiesDrawer.removing"
                  : "endUsers.propertiesDrawer.remove"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function propertyPayload(
  property: EndUserProperty,
  overrides: Partial<EndUserPropertyPayload> = {}
): EndUserPropertyPayload {
  return {
    name: property.name,
    presetValues: property.presetValues,
    usePresetValuesOnly: property.usePresetValuesOnly,
    isDigestField: property.isDigestField,
    remark: property.remark,
    ...overrides,
  }
}

function isEndUserProperty(
  row: PropertyDraft | EndUserProperty
): row is EndUserProperty {
  return "isBuiltIn" in row
}
