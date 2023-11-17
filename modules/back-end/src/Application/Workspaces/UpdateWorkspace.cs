using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.Workspaces;

public class UpdateWorkspace : IRequest<WorkspaceVm>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }
}

public class UpdateWorkspaceValidator : AbstractValidator<UpdateWorkspace>
{
    public UpdateWorkspaceValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"));
    }
}

public class UpdateWorkspaceHandler : IRequestHandler<UpdateWorkspace, WorkspaceVm>
{
    private readonly IWorkspaceService _service;
    private readonly IMapper _mapper;

    public UpdateWorkspaceHandler(IWorkspaceService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<WorkspaceVm> Handle(UpdateWorkspace request, CancellationToken cancellationToken)
    {
        var workspace = await _service.GetAsync(request.Id);

        var isKeyUsed = await _service.HasKeyBeenUsedAsync(workspace.Id, request.Key);
        if (isKeyUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        workspace.Update(request.Name, request.Key);
        await _service.UpdateAsync(workspace);

        return _mapper.Map<WorkspaceVm>(workspace);
    }
}