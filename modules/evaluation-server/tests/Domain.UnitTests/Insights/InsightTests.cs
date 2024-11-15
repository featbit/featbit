using Domain.EndUsers;
using Domain.Insights;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.UnitTests.Insights
{
    public class InsightTests
    {
        [Theory]
        [InlineData("print(\"test\")")]
        [InlineData("this should fail")]
        [InlineData("select count(*) from system;")]
        public void ItShouldFailValidationWhenInvalidEventName(string eventName)
        {
            var user = new EndUser() { KeyId = "test-user", Name = "test-user" };

            var inputInsight = new Insight();

            inputInsight.User = user;

            var inputMetric = new MetricInsight()
            {
                EventName = eventName,
            };

            inputInsight.Metrics = inputInsight.Metrics.Append(inputMetric);

            Assert.False(inputInsight.IsValid());
        }
    }
}