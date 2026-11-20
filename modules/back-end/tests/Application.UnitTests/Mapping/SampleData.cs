using System.Collections;
using System.Reflection;
using System.Runtime.CompilerServices;

namespace Application.UnitTests.Mapping;

/// <summary>
/// Builds deterministic object graphs for mapping tests. <see cref="Populated{T}"/> fills every settable
/// property, including collections (two elements each) and nested objects. <see cref="WithNulls{T}"/>
/// fills scalars only and leaves every collection and nested object null.
/// </summary>
public static class SampleData
{
    private const int MaxDepth = 4;

    public static T Populated<T>() => (T)Create(typeof(T), new Counter(), 0, nulls: false);

    public static T WithNulls<T>() => (T)Create(typeof(T), new Counter(), 0, nulls: true);

    private sealed class Counter
    {
        private int _value;
        public int Next() => ++_value;
    }

    private static object Create(Type type, Counter counter, int depth, bool nulls)
    {
        var instance = Instantiate(type);
        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.SetMethod == null || property.GetIndexParameters().Length > 0)
            {
                continue;
            }

            property.SetValue(instance, Value(property.PropertyType, property.Name, counter, depth + 1, nulls));
        }

        return instance;
    }

    // Domain entities may only have a non-public parameterless constructor, or none at all.
    private static object Instantiate(Type type)
    {
        var constructor = type.GetConstructor(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic, Type.EmptyTypes);
        return constructor != null ? constructor.Invoke(null) : RuntimeHelpers.GetUninitializedObject(type);
    }

    private static object Value(Type type, string name, Counter counter, int depth, bool nulls)
    {
        var underlying = Nullable.GetUnderlyingType(type) ?? type;
        var n = counter.Next();

        if (underlying == typeof(string)) return $"{name}-{n:D4}-abcdefghijklmnopqrstuvwxyz";
        if (underlying == typeof(Guid)) return new Guid(n, 0, 0, new byte[8]);
        if (underlying == typeof(DateTime)) return new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMinutes(n);
        if (underlying == typeof(DateTimeOffset)) return new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero).AddMinutes(n);
        if (underlying == typeof(bool)) return true;
        if (underlying.IsEnum)
        {
            var values = Enum.GetValues(underlying);
            return values.GetValue(values.Length - 1);
        }

        if (underlying.IsPrimitive || underlying == typeof(decimal)) return Convert.ChangeType(n, underlying);
        if (underlying == typeof(object)) return $"{name}-{n}";

        if (underlying.IsGenericType && underlying.GetGenericTypeDefinition() == typeof(KeyValuePair<,>))
        {
            var args = underlying.GetGenericArguments();
            return Activator.CreateInstance(
                underlying,
                Value(args[0], name + "Key", counter, depth, nulls),
                Value(args[1], name + "Value", counter, depth, nulls));
        }

        if (nulls || depth > MaxDepth) return null;

        if (underlying.IsArray)
        {
            var element = underlying.GetElementType()!;
            var array = Array.CreateInstance(element, 2);
            for (var i = 0; i < 2; i++) array.SetValue(Value(element, name, counter, depth, nulls), i);
            return array;
        }

        if (underlying.IsGenericType && typeof(IEnumerable).IsAssignableFrom(underlying))
        {
            var args = underlying.GetGenericArguments();
            if (args.Length == 2)
            {
                var dictionary = (IDictionary)Activator.CreateInstance(typeof(Dictionary<,>).MakeGenericType(args))!;
                dictionary[Value(args[0], name + "Key", counter, depth, nulls)!] = Value(args[1], name, counter, depth, nulls);
                return dictionary;
            }

            var list = (IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(args[0]))!;
            for (var i = 0; i < 2; i++) list.Add(Value(args[0], name, counter, depth, nulls));
            return list;
        }

        if (underlying.IsClass && !underlying.IsAbstract &&
            underlying.GetConstructor(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic, Type.EmptyTypes) != null)
        {
            return Create(underlying, counter, depth, nulls);
        }

        return null;
    }
}
