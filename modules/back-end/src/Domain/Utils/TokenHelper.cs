using System.Text;

namespace Domain.Utils;

public static class TokenHelper
{
    public static string New(Guid id)
    {
        // timestamp in millis, length is 13
        var reversedTimestamp =
            new string(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString().Reverse().ToArray());

        // header length is (13 + 2) * 4/3 = 20, we trim '=' character, so got 18 chars
        var header = Convert.ToBase64String(Encoding.UTF8.GetBytes(reversedTimestamp)).TrimEnd('=');

        // 22 chars
        var guid = GuidHelper.Encode(id);

        // 18 + 22 = 40 chars
        return $"{header}{guid}";
    }
}