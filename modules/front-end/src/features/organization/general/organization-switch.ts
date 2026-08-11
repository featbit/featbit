export function shouldChangeOrganization(
  currentOrganizationId: string,
  nextOrganizationId: string
) {
  return Boolean(
    nextOrganizationId && nextOrganizationId !== currentOrganizationId
  )
}
