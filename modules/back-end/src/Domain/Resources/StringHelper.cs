using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Domain.Resources
{
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

        [TestMethod]
        public static void TestEscapeRegex()
        {
            // Test escaping of special characters
            string input = @"This is a regex string with special characters: .*+?^=!:${}()|[]/\";
            string expectedOutput = @"This is a regex string with special characters\: \.\*\+\?\^\=\!\:\$\{\}\(\)\|\[\]\/\\\\";
            string actualOutput = EscapeRegex(input);
            Assert.AreEqual(expectedOutput, actualOutput);

            // Test escaping of backslashes
            input = @"This is a string with some \backslashes that need to be escaped.";
            expectedOutput = @"This is a string with some \\backslashes that need to be escaped\.";
            actualOutput = EscapeRegex(input);
            Assert.AreEqual(expectedOutput, actualOutput);

            // Test escaping of empty string
            input = "";
            expectedOutput = "";
            actualOutput = EscapeRegex(input);
            Assert.AreEqual(expectedOutput, actualOutput);
        }



    }
}
