using Domain.Insights;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.UnitTests.Insights
{
    public class VariationInsightTests
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
            var inputVariation = new VariationInsight()
            {
                FeatureFlagKey = value1,
            };

            var results = ValidateModel(inputVariation);
            Assert.Contains(results, v => v.MemberNames.Contains("FeatureFlagKey") && v.ErrorMessage.Contains("FeatureFlagKey"));
        }
    }
}