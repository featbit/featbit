using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Evaluation;
using Microsoft.VisualBasic;

namespace Domain.UnitTests.Evaluation
{
    public class VariationTests
    {
        private IList<ValidationResult> ValidateModel(object model)
        {
            var validationResults = new List<ValidationResult>();
            var validationContext = new ValidationContext(model, null, null);
            Validator.TryValidateObject(model, validationContext, validationResults, true);
            return validationResults;
        }

        [Theory]
        [InlineData("test-value")]
        [InlineData("print(\"test\")")]
        [InlineData("3eacb184-2d79-49df")]
        public void ItShouldFailValidationWhenInvalidValuesAreProvided(string variationId)
        {
            var inputVariation = new Variation(variationId, "");
            var results = ValidateModel(inputVariation);
            Assert.Contains(results, v => v.MemberNames.Contains("Id") && v.ErrorMessage.Contains("Id"));
        }

        [Theory]
        [InlineData("98a136e5-995b-44c9-8488-85704d777925")]
        [InlineData("a5b82844-3ab5-4af8-aade-a3d56bcc50c5")]
        [InlineData("cf2f228d-70af-4061-b89d-53cb1bccdf38")]
        public void ItShouldPassValidationWhenValidValuesAreProvided(string variationId)
        {
            var inputVariation = new Variation(variationId, "");
            var results = ValidateModel(inputVariation);
            Assert.Empty(results);
        }
    }
}