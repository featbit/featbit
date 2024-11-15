using Domain.Insights;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.UnitTests.Insights
{
    public class InsightMessageTests
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
        public void ItShouldFailValidationWhenInvalidDistinctIdsAreProvided(string value1)
        {
            var inputInsightMessage = new InsightMessage()
            {
                DistinctId = value1,
            };

            var results = ValidateModel(inputInsightMessage);
            Assert.Contains(results, v => v.MemberNames.Contains("DistinctId") && v.ErrorMessage.Contains("DistinctId"));
        }

        [Theory]
        [InlineData("print(\"test\")")]
        [InlineData("this should fail")]
        [InlineData("select count(*) from system;")]
        public void ItShouldFailValidationWhenInvalidEnvIdsAreProvided(string value1)
        {
            var inputInsightMessage = new InsightMessage()
            {
                EnvId = value1,
            };

            var results = ValidateModel(inputInsightMessage);
            Assert.Contains(results, v => v.MemberNames.Contains("EnvId") && v.ErrorMessage.Contains("EnvId"));
        }

        [Theory]
        [InlineData("98a136e5-995b-44c9-8488-85704d777925")]
        [InlineData("a5b82844-3ab5-4af8-aade-a3d56bcc50c5")]
        [InlineData("cf2f228d-70af-4061-b89d-53cb1bccdf38")]
        public void ItShouldPassValidationWhenValidDistinctIdsAreProvided(string value1)
        {
            var inputInsightMessage = new InsightMessage()
            {
                DistinctId = value1,
            };

            var results = ValidateModel(inputInsightMessage);
            Assert.Empty(results);
        }
    }
}