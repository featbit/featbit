using System.Text.RegularExpressions;

namespace Domain.Utils;

public static class StringHelper
{
    /// <summary>
    /// Escapes a set of characters (. * + ? ^ = ! : $ { } ( ) | [ ] / \) by replacing them with their escape codes.
    /// This converts a string so that it can be used as a constant within a regular expression safely.
    /// </summary>
    /// <param name="s"></param>
    /// <returns>The replaced string</returns>
    public static string EscapeRegex(string s)
    {
        return Regex.Replace(s, @"([.*+?^=!:${}()|[\]/\\])", @"\$1");
    }
}

