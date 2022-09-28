namespace Domain.Policies;

// taken from infra/mongodb/docker-entrypoint-initdb.d/seed.js
public class BuiltInPolicy
{
    public static Guid Owner = Guid.Parse("98881f6a-5c6c-4277-bcf7-fda94c538785");

    public static Guid Admin = Guid.Parse("3e961f0f-6fd4-4cf4-910f-52d356f8cc08");

    public static Guid Developer = Guid.Parse("66f3687f-939d-4257-bd3f-c3553d39e1b6");
}