using System.Security.Cryptography;
using System.Text;
using Infrastructure.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Api.Setup;

public static class JwtOptionsBuilder
{
    public static JwtOptions Build(IConfiguration configuration)
    {
        var options = new JwtOptions();
        configuration.GetSection(JwtOptions.Jwt).Bind(options);

        var validator = new JwtOptionsValidator();
        var validationResult = validator.Validate(null, options);
        if (validationResult.Failed)
        {
            throw new OptionsValidationException(nameof(JwtOptions), typeof(JwtOptions), validationResult.Failures);
        }

        switch (options.Algorithm)
        {
            case SecurityAlgorithms.HmacSha256:
                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));

                options.SigningSecurityKey = key;
                options.VerificationSecurityKey = key;
                break;

            case SecurityAlgorithms.RsaSha256:
                var privateKey = RSA.Create();
                privateKey.ImportFromPem(File.ReadAllText(options.PrivateKeyPath));
                options.SigningSecurityKey = new RsaSecurityKey(privateKey);

                var publicKey = RSA.Create();
                publicKey.ImportFromPem(File.ReadAllText(options.PublicKeyPath));
                options.VerificationSecurityKey = new RsaSecurityKey(publicKey);
                break;
        }

        return options;
    }
}