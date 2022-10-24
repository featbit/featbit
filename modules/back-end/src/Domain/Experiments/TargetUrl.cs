using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Experiments
{
    public class TargetUrl
    {
        public string Id { get; set; }
        public UrlMatchType MatchType { get; set; }
        public string Url { get; set; }
    }
}
