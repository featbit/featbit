using System.Text;

namespace Domain.Utils;

public static class StringExtensions
{
    public static string Replace(this string str, char[] chars, char replacement)
    {
        var sb = new StringBuilder(str);

        foreach (var ch in chars)
        {
            sb.Replace(ch, replacement);
        }

        return sb.ToString();
    }
}