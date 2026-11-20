using Riok.Mapperly.Abstractions;

// Defaults for every [Mapper] in this assembly.
//
// RequiredMappingStrategy.Target: only unmapped target members are reported. A view model exposes a
// subset of its entity, so unmapped source members are expected. Application.csproj raises the target
// diagnostic (RMG012) to a build error, so every view model member is either mapped or explicitly
// ignored with [MapperIgnoreTarget].
//
// AutoUserMappings = false: a helper method in a mapper is used only where a mapping names it
// (MapProperty Use = ...) or where it's marked [UserMapping]. Otherwise Mapperly applies any method
// whose signature fits to every member of that type, e.g. a string-masking helper to every string.
[assembly: MapperDefaults(RequiredMappingStrategy = RequiredMappingStrategy.Target, AutoUserMappings = false)]
