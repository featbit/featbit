using System.Text.RegularExpressions;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AccessTokens;
using Domain.Policies;

namespace Application.AccessTokens;

public class CreateAccessToken : IRequest<AccessTokenVm>
{
    public Guid OrganizationId { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public IEnumerable<PolicyStatement> Permissions { get; set; }
}

public class CreateAccessTokenValidator : AbstractValidator<CreateAccessToken>
{
    public CreateAccessTokenValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Type)
            .Must(AccessTokenTypes.IsDefined).WithErrorCode(ErrorCodes.InvalidAccessTokenType);

        RuleFor(x => x.Permissions)
            .Must(permissions => permissions.Any())
            .Unless(x => x.Type == AccessTokenTypes.Personal)
            .WithErrorCode(ErrorCodes.ServiceAccessTokenMustDefinePolicies);
    }
}

public class CreateAccessTokenHandler : IRequestHandler<CreateAccessToken, AccessTokenVm>
{
    private readonly IMemberService _memberService;
    private readonly ICurrentUser _currentUser;
    private readonly IAccessTokenService _service;
    private readonly IMapper _mapper;

    public CreateAccessTokenHandler(
        IAccessTokenService service,
        IMemberService memberService,
        ICurrentUser currentUser,
        IMapper mapper)
    {
        _service = service;
        _currentUser = currentUser;
        _memberService = memberService;
        _mapper = mapper;
    }

    public async Task<AccessTokenVm> Handle(CreateAccessToken request, CancellationToken cancellationToken)
    {
        if (request.Type == AccessTokenTypes.Service)
        {
            var authorizedPolices =
                await _memberService.GetPoliciesAsync(request.OrganizationId, _currentUser.Id);

            var haveUnauthorizedPermissions = request.Permissions.Any(x =>
            {
                var matchedPolicy = authorizedPolices.FirstOrDefault(policy =>
                    policy.Statements.Any(statement =>
                        (statement.ResourceType == x.ResourceType || statement.ResourceType == "*") &&
                        statement.Effect == "allow" &&
                        x.Resources.All(rsc => statement.Resources.Any(resource => MatchRule(rsc, resource))) &&
                        x.Actions.All(act => statement.Actions.Any(action => MatchRule(act, action))))
                );

                return matchedPolicy == null;
            });

            if (haveUnauthorizedPermissions)
            {
                throw new BusinessException(ErrorCodes.Forbidden);
            }
        }

        var existed =
            await _service.FindOneAsync(at => string.Equals(at.Name, request.Name, StringComparison.OrdinalIgnoreCase));
        if (existed != null)
        {
            throw new BusinessException(ErrorCodes.EntityExistsAlready);
        }

        var accessToken =
            new AccessToken(request.OrganizationId, _currentUser.Id, request.Name, request.Type, request.Permissions);

        await _service.AddOneAsync(accessToken);

        return _mapper.Map<AccessTokenVm>(accessToken);
    }

    // use "*" (star) as a wildcard for example:
    // "a*b" => everything that starts with "a" and ends with "b"
    // "a*" => everything that starts with "a"
    // "*b" => everything that ends with "b"
    // "*a*" => everything that has an "a" in it
    // "*a*b*"=> everything that has an "a" in it, followed by anything, followed by a "b", followed by anything
    private static bool MatchRule(string str, string rule)
    {
        string EscapeRegex(string s) => Regex.Replace(s, "([.*+?^=!:${}()|\\[\\]\\\\/])", "\\$1");

        var matchPattern = rule
            .Split('*')
            .Select(EscapeRegex)
            .Aggregate((x, y) => $"{x}.*{y}");

        var regex = new Regex($"^{matchPattern}$");
        return regex.IsMatch(str);
    }
}