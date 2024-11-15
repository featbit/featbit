using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Insights;

namespace Domain.UnitTests.Insights
{
    public class MetricInsightTests
    {
        private IList<ValidationResult> ValidateModel(object model)
        {
            var validationResults = new List<ValidationResult>();
            var validationContext = new ValidationContext(model, null, null);
            Validator.TryValidateObject(model, validationContext, validationResults, true);
            return validationResults;
        }

        [Theory]
        [InlineData("print(\"test\")")]
        [InlineData("this should fail")]
        [InlineData("select count(*) from system;")]
        public void ItShouldFailValidationWhenInvalidValuesAreProvided(string value1)
        {
            var inputMetric = new MetricInsight()
            {
                EventName = value1,
            };

            var results = ValidateModel(inputMetric);
            Assert.Contains(results, v => v.MemberNames.Contains("EventName") && v.ErrorMessage.Contains("EventName"));
        }
    }
}