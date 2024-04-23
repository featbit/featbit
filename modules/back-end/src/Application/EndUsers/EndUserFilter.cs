using Application.Bases.Models;
using Domain.EndUsers;

namespace Application.EndUsers;

public class EndUserFilter : PagedRequest
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public List<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public string[] ExcludedKeyIds { get; set; }

    public bool IncludeGlobalUser { get; set; }

    public EndUserFilter(SearchEndUser query)
    {
        CustomizedProperties = new List<EndUserCustomizedProperty>();

        // pagination params
        PageIndex = query.PageIndex;
        PageSize = query.PageSize;

        // excluded keyIds
        ExcludedKeyIds = query.ExcludedKeyIds ?? Array.Empty<string>();

        // whether to include global user
        IncludeGlobalUser = query.IncludeGlobalUser ?? false;

        // search text (value for multiple fields)
        var searchText = query.SearchText;
        if (string.IsNullOrWhiteSpace(searchText))
        {
            // no search text
            return;
        }

        // properties
        var properties = query.Properties;
        if (properties == null || !properties.Any())
        {
            // if no properties specified, default to keyId & name
            KeyId = searchText;
            Name = searchText;
            return;
        }

        // built-in properties
        KeyId = properties.Exists(x => x.Equals(EndUserConsts.KeyId, StringComparison.OrdinalIgnoreCase))
            ? searchText
            : string.Empty;
        Name = properties.Exists(x => x.Equals(EndUserConsts.Name, StringComparison.OrdinalIgnoreCase))
            ? searchText
            : string.Empty;

        // custom properties filter
        foreach (var property in properties)
        {
            var isBuiltInProperty = EndUserConsts.BuiltInProperties.Contains(property, StringComparer.OrdinalIgnoreCase);
            if (isBuiltInProperty)
            {
                continue;
            }

            var customizedProperty = new EndUserCustomizedProperty
            {
                Name = property,
                Value = searchText
            };

            CustomizedProperties.Add(customizedProperty);
        }
    }
}