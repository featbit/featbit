using Application.Bases;
using Domain.Environments;

namespace Application.Environments;

public class AddSecret : IRequest<Secret>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public Secret AsSecret()
    {
        var secret = new Secret(EnvId, Name, Type);
        return secret;
    }
}

public class AddSecretValidator : AbstractValidator<AddSecret>
{
    public AddSecretValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Type)
            .Must(SecretTypes.IsDefined).WithErrorCode(ErrorCodes.InvalidSecretType);
    }
}

public class AddSecretHandler : IRequestHandler<AddSecret, Secret>
{
    private readonly IEnvironmentService _service;
    private readonly IPublisher _publisher;

    public AddSecretHandler(IEnvironmentService service, IPublisher publisher)
    {
        _service = service;
        _publisher = publisher;
    }

    public async Task<Secret> Handle(AddSecret request, CancellationToken cancellationToken)
    {
        var environment = await _service.GetAsync(request.EnvId);
        var secret = request.AsSecret();
        environment.AddSecret(secret);
        await _service.UpdateAsync(environment);

        // publish on secret added notification
        await _publisher.Publish(new OnSecretAdded(request.EnvId, secret), cancellationToken);

        return secret;
    }
}