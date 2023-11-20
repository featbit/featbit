using Domain.Workspaces;

namespace Application.Workspaces;

public class WorkspaceVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string License { get; set; }

    public SsoConfig Sso { get; set; }
}