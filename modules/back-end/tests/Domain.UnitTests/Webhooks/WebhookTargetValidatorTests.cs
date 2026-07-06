using Domain.Webhooks;

namespace Domain.UnitTests.Webhooks;

public class WebhookTargetValidatorTests
{
    [Theory]
    // loopback in several encodings
    [InlineData("http://127.0.0.1/")]
    [InlineData("http://127.0.0.1:8099/path")]
    [InlineData("http://2130706433/")]        // decimal 127.0.0.1
    [InlineData("http://0x7f000001/")]         // hex 127.0.0.1
    [InlineData("http://[::1]/")]              // IPv6 loopback
    // link-local / cloud metadata
    [InlineData("http://169.254.169.254/latest/meta-data/")]
    [InlineData("http://[fe80::1]/")]
    // RFC1918 private ranges
    [InlineData("http://10.0.0.5/")]
    [InlineData("http://172.16.0.1/")]
    [InlineData("http://172.30.0.5:8099/rfc1918-probe")]
    [InlineData("http://192.168.1.1/")]
    // CGNAT, this-network, unspecified
    [InlineData("http://100.64.0.1/")]
    [InlineData("http://0.0.0.0/")]
    // IPv4-mapped / NAT64 / 6to4 wrapping an internal IPv4
    [InlineData("http://[::ffff:127.0.0.1]/")]
    [InlineData("http://[::ffff:169.254.169.254]/")]
    [InlineData("http://[64:ff9b::7f00:1]/")]  // NAT64 127.0.0.1
    [InlineData("http://[2002:7f00:0001::]/")] // 6to4 127.0.0.1
    // IPv6 unique-local
    [InlineData("http://[fc00::1]/")]
    // disallowed schemes
    [InlineData("file:///etc/passwd")]
    [InlineData("gopher://127.0.0.1/")]
    [InlineData("ftp://10.0.0.1/")]
    // malformed
    [InlineData("not-a-url")]
    [InlineData("")]
    public void RejectsInternalAndMalformedTargets(string url)
    {
        var ok = WebhookTargetValidator.IsValidTarget(url, out var reason);

        Assert.False(ok);
        Assert.False(string.IsNullOrEmpty(reason));
    }

    [Theory]
    [InlineData("http://1.1.1.1/")]
    [InlineData("http://8.8.8.8:443/hook")]
    [InlineData("https://93.184.216.34/webhook")] // a public literal
    public void AllowsPublicTargets(string url)
    {
        var ok = WebhookTargetValidator.IsValidTarget(url, out var reason);

        Assert.True(ok, reason);
    }
}
