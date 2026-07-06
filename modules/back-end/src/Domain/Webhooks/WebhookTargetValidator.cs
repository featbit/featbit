using System.Net;
using System.Net.Sockets;

namespace Domain.Webhooks;

/// <summary>
/// Validates that a webhook target URL points to a public, routable destination and
/// does not allow a caller to reach internal infrastructure (SSRF, CWE-918).
///
/// The check runs against every IP address the host resolves to, so a DNS name that
/// resolves to an internal address is rejected too. IPv4 addresses embedded in IPv6
/// (mapped ::ffff:, NAT64 64:ff9b::/96, 6to4 2002::/16, IPv4-compatible) are unwrapped
/// before evaluation, and non-dotted-decimal IPv4 forms (decimal / hex) are canonicalised
/// by the address parser.
/// </summary>
public static class WebhookTargetValidator
{
    /// <summary>
    /// Returns true when <paramref name="url"/> is a well-formed absolute http/https URL
    /// whose host resolves exclusively to public, routable IP addresses.
    /// </summary>
    public static bool IsValidTarget(string url, out string reason)
    {
        reason = null;

        if (string.IsNullOrWhiteSpace(url))
        {
            reason = "url is empty";
            return false;
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            reason = "url is not a well-formed absolute uri";
            return false;
        }

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        {
            reason = $"scheme '{uri.Scheme}' is not allowed, only http/https";
            return false;
        }

        IPAddress[] addresses;
        var host = uri.DnsSafeHost;

        // Literal IP host (covers decimal / hex / IPv6 literals, canonicalised by IPAddress).
        if (IPAddress.TryParse(host, out var literal))
        {
            addresses = [literal];
        }
        else
        {
            try
            {
                addresses = Dns.GetHostAddresses(host);
            }
            catch (Exception ex)
            {
                reason = $"could not resolve host '{host}': {ex.Message}";
                return false;
            }
        }

        if (addresses.Length == 0)
        {
            reason = $"host '{host}' did not resolve to any address";
            return false;
        }

        foreach (var address in addresses)
        {
            var canonical = Unwrap(address);
            if (!IsPublic(canonical))
            {
                reason = $"host '{host}' resolves to non-public address '{canonical}'";
                return false;
            }
        }

        return true;
    }

    // Unwrap IPv4 addresses that are embedded in an IPv6 address so the IPv4 range
    // checks below can see them. Covers IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible,
    // NAT64 well-known prefix (64:ff9b::/96) and 6to4 (2002::/16).
    private static IPAddress Unwrap(IPAddress address)
    {
        if (address.AddressFamily != AddressFamily.InterNetworkV6)
        {
            return address;
        }

        if (address.IsIPv4MappedToIPv6)
        {
            return address.MapToIPv4();
        }

        var bytes = address.GetAddressBytes();

        // NAT64 well-known prefix 64:ff9b::/96 -> embedded IPv4 in the last 4 bytes.
        if (bytes[0] == 0x00 && bytes[1] == 0x64 && bytes[2] == 0xff && bytes[3] == 0x9b &&
            bytes[4] == 0x00 && bytes[5] == 0x00 && bytes[6] == 0x00 && bytes[7] == 0x00 &&
            bytes[8] == 0x00 && bytes[9] == 0x00 && bytes[10] == 0x00 && bytes[11] == 0x00)
        {
            return new IPAddress(new[] { bytes[12], bytes[13], bytes[14], bytes[15] });
        }

        // 6to4 2002::/16 -> embedded IPv4 in bytes 2..5.
        if (bytes[0] == 0x20 && bytes[1] == 0x02)
        {
            return new IPAddress(new[] { bytes[2], bytes[3], bytes[4], bytes[5] });
        }

        // IPv4-compatible ::a.b.c.d (deprecated) -> last 4 bytes when the top 12 are zero.
        var topZero = true;
        for (var i = 0; i < 12; i++)
        {
            if (bytes[i] != 0)
            {
                topZero = false;
                break;
            }
        }

        if (topZero && !(bytes[15] == 0 || (bytes[14] == 0 && bytes[15] == 1)))
        {
            return new IPAddress(new[] { bytes[12], bytes[13], bytes[14], bytes[15] });
        }

        return address;
    }

    private static bool IsPublic(IPAddress address)
    {
        if (IPAddress.IsLoopback(address))
        {
            return false;
        }

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = address.GetAddressBytes();

            // 0.0.0.0/8 (this network, includes the unspecified 0.0.0.0)
            if (b[0] == 0) return false;
            // 10.0.0.0/8
            if (b[0] == 10) return false;
            // 127.0.0.0/8 (already covered by IsLoopback but explicit)
            if (b[0] == 127) return false;
            // 100.64.0.0/10 (CGNAT)
            if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return false;
            // 169.254.0.0/16 (link-local, includes cloud metadata 169.254.169.254)
            if (b[0] == 169 && b[1] == 254) return false;
            // 172.16.0.0/12
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return false;
            // 192.168.0.0/16
            if (b[0] == 192 && b[1] == 168) return false;
            // 192.0.0.0/24 and 192.0.2.0/24 (IETF protocol assignments / TEST-NET)
            if (b[0] == 192 && b[1] == 0 && (b[2] == 0 || b[2] == 2)) return false;

            return true;
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6Multicast)
            {
                return false;
            }

            var b = address.GetAddressBytes();

            // Unspecified ::
            if (address.Equals(IPAddress.IPv6Any)) return false;
            // Unique local address fc00::/7
            if ((b[0] & 0xfe) == 0xfc) return false;
            // Link-local fe80::/10 (belt-and-suspenders with IsIPv6LinkLocal)
            if (b[0] == 0xfe && (b[1] & 0xc0) == 0x80) return false;

            return true;
        }

        return false;
    }
}
