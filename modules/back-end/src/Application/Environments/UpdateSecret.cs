using Application.Bases;

namespace Application.Environments;

public class UpdateSecret : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string SecretId { get; set; }

    public string Name { get; set; }
}

public class UpdateSecretValidator : AbstractValidator<UpdateSecret>
{
    public UpdateSecretValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpdateSecretHandler : IRequestHandler<UpdateSecret, bool>
{
    private readonly IEnvironmentService _service;

    public UpdateSecretHandler(IEnvironmentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(UpdateSecret request, CancellationToken cancellationToken)
    {
        var environment = await _service.GetAsync(request.EnvId);
        environment.UpdateSecret(request.SecretId, request.Name);
        await _service.UpdateAsync(environment);

        return true;
    }
}