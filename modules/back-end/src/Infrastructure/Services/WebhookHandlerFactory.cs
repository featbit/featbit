using Microsoft.Extensions.Configuration;
using Microsoft.Security.AntiSSRF;

namespace Infrastructure.Services;

/// <summary>
/// Builds the HTTP handler the webhook sender uses. The handler refuses every target that is not a public address
/// (the AntiSSRF policy), except what an operator lists: host names in <see cref="AllowedHostsSetting"/> and IP
/// addresses or CIDR ranges in <see cref="AllowedAddressesSetting"/>. Both are empty by default.
/// </summary>
internal static class WebhookHandlerFactory
{
    public const string AllowedHostsSetting = "Webhook:AllowedHosts";
    public const string AllowedAddressesSetting = "Webhook:AllowedAddresses";

    /// <summary>
    /// Reads the host names that skip the check. A host is listed by its exact name, without a scheme, port or path,
    /// and without wildcards. Blank entries are dropped. An entry that is not a host name fails here, at startup,
    /// and not on the first delivery.
    /// </summary>
    public static string[] GetAllowedHosts(IConfiguration configuration)
    {
        var hosts = ReadList(configuration, AllowedHostsSetting);

        foreach (var host in hosts)
        {
            if (Uri.CheckHostName(host) == UriHostNameType.Unknown)
            {
                throw new InvalidOperationException(
                    $"{AllowedHostsSetting} has the entry '{host}', which is not a host name. " +
                    "List the name only, for example 'notify.internal', without a scheme, port, path or wildcard.");
            }
        }

        return hosts;
    }

    /// <summary>
    /// Reads the addresses exempt from the check: a list of IPs or CIDR ranges. Blank entries are dropped. An entry
    /// that is not an address fails here, at startup, and not on the first delivery.
    /// </summary>
    public static string[] GetAllowedAddresses(IConfiguration configuration)
    {
        var addresses = ReadList(configuration, AllowedAddressesSetting);

        // The policy parses an entry when it is added, so adding each one to a throwaway policy finds the bad one.
        foreach (var address in addresses)
        {
            try
            {
                CreatePolicy([address]);
            }
            catch (FormatException ex)
            {
                throw new InvalidOperationException(
                    $"{AllowedAddressesSetting} has the entry '{address}', which is not an IP address or CIDR range.", ex);
            }
        }

        return addresses;
    }

    /// <summary>
    /// The handler for the webhook client. With nothing allowed it blocks every non-public target. Requests for a
    /// listed host go to a plain handler that does not follow redirects; every other request is checked.
    /// </summary>
    public static HttpMessageHandler CreateHandler(string[] allowedAddresses, string[] allowedHosts)
    {
        var guarded = CreatePolicy(allowedAddresses).GetHandler();
        if (allowedHosts.Length == 0)
        {
            return guarded;
        }

        return new AllowedHostsHandler(allowedHosts, CreateTrustedHandler(), guarded);
    }

    /// <summary>
    /// The handler for a listed host. It does not follow redirects, because a redirect would lead the request to an
    /// address nothing has checked, and it does not use a proxy, because the checked requests connect directly and an
    /// internal host is often not reachable or resolvable through one.
    /// </summary>
    internal static SocketsHttpHandler CreateTrustedHandler() =>
        new() { AllowAutoRedirect = false, UseProxy = false };

    /// <summary>
    /// Reads a list setting: the trimmed, non-blank values of the children of <paramref name="setting"/>. An unset
    /// setting gives an empty list.
    /// </summary>
    private static string[] ReadList(IConfiguration configuration, string setting) =>
        configuration
            .GetSection(setting)
            .GetChildren()
            .Select(child => child.Value?.Trim())
            .OfType<string>()
            .Where(value => value.Length > 0)
            .ToArray();

    /// <summary>
    /// The policy for requests to any host that is not listed: it blocks every non-public address except the given
    /// ones. Plain HTTP is allowed, and no X-Forwarded-For header is added.
    /// </summary>
    private static AntiSSRFPolicy CreatePolicy(string[] allowedAddresses)
    {
        var policy = new AntiSSRFPolicy(PolicyConfigOptions.ExternalOnlyLatest)
        {
            AllowPlainTextHttp = true,

            // ExternalOnlyLatest adds X-Forwarded-For: true by default as a
            // defense-in-depth against IMDS. For an outgoing webhook sender the
            // dummy value can cause third-party receivers to reject the request,
            // and IMDS is already blocked by the IP-range enforcement, so disable it.
            AddXFFHeader = false
        };

        if (allowedAddresses.Length > 0)
        {
            policy.AddAllowedAddresses(allowedAddresses);
        }

        return policy;
    }
}
