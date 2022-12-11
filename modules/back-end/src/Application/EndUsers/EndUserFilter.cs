using Application.Bases.Models;
using Domain.EndUsers;
using Microsoft.AspNetCore.Http;

namespace Application.EndUsers;

public class EndUserFilter : PagedRequest
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public List<EndUserCustomizedProperty> CustomizedProperties { get; set; } = new();

    public EndUserFilter(IQueryCollection query)
    {
        // pagination params
        if (int.TryParse(query["pageIndex"].ToString(), out var pageIndex))
        {
            PageIndex = pageIndex;
        }

        if (int.TryParse(query["pageSize"].ToString(), out var pageSize))
        {
            PageSize = pageSize;
        }

        // search text (value for multiple fields)
        var searchText = query["searchText"].ToString();
        if (string.IsNullOrWhiteSpace(searchText))
        {
            // no search text
            return;
        }

        // properties
        var properties = query["properties"].ToList();
        if (!properties.Any())
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
            var customizedProperty = new EndUserCustomizedProperty
            {
                Name = property,
                Value = searchText
            };

            CustomizedProperties.Add(customizedProperty);
        }
    }
}