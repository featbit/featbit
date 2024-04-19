using Application.Bases;
using Domain.EndUsers;

namespace Application.EndUsers;

public class UpsertEndUser : IRequest<EndUser>
{
    public Guid EnvId { get; set; }

    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public EndUser AsEndUser()
    {
        return new EndUser(workspaceId: null, EnvId, KeyId, Name, CustomizedProperties);
    }
}

public class UpsertEndUserValidator : AbstractValidator<UpsertEndUser>
{
    public UpsertEndUserValidator()
    {
        RuleFor(x => x.KeyId)
            .NotEmpty().WithErrorCode(ErrorCodes.KeyIdIsRequired);

        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class UpsertEndUserHandler : IRequestHandler<UpsertEndUser, EndUser>
{
    private readonly IEndUserService _service;

    public UpsertEndUserHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task<EndUser> Handle(UpsertEndUser request, CancellationToken cancellationToken)
    {
        return await _service.UpsertAsync(request.AsEndUser());
    }
}