namespace Api.Setup.OpenApi;

public interface IOpenApiExamplesProvider
{
    IEnumerable<(string Name, object Value)> GetExamples();
}
