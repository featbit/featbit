using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Bson.Serialization.Serializers;

namespace Infrastructure.MongoDb;

// ref doc: https://mongodb.github.io/mongo-csharp-driver/2.17/reference/bson/mapping/conventions/#custom-conventions
// ref built-in member map convention: StringIdStoredAsObjectIdConvention
public class StringObjectIdSerializerConvention : ConventionBase, IMemberMapConvention
{
    // these string members in "Domain" project are represented by ObjectId in Bson
    private readonly string[] _members =
    {
        "ProjectId",
        "OrganizationId",
        "GroupId",
        "MemberId",
        "PolicyId",
        "InvitorId",
        "UserId"
    };

    public void Apply(BsonMemberMap memberMap)
    {
        if (memberMap.MemberType != typeof(string))
        {
            return;
        }

        var space = memberMap.MemberInfo.ReflectedType?.Namespace;
        if (space == null || !space.StartsWith("Domain.") || !_members.Contains(memberMap.MemberName))
        {
            return;
        }

        memberMap.SetSerializer(new StringSerializer(representation: BsonType.ObjectId));
    }
}