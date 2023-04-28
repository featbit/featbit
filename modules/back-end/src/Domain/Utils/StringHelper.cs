using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Text.RegularExpressions;

namespace Domain.Utils;
public static class StringHelper
{
    /// <summary>
    /// This regular expression matches any single character that is one of the following special characters:
    /// . * + ? ^ = ! : $ { } ( ) | [ ] / \
    /// It can be used to search for any of these special characters in a given text or string.
    /// </summary>
    /// <param name="s"></param>
    /// <returns>The replaced string</returns>
    public static string EscapeRegex(string s)
    {
        return Regex.Replace(s, @"([.*+?^=!:${}()|[\]/\\])", @"\$1");
    }
}

