const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

const slugify = str => str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

// https://github.com/featbit/featbit/pull/841
// added key to Policies collection

// fill keys if not exist
db.Policies.find({
    $or: [
        { key: { $exists: false } },
        { key: null }
    ]
}).forEach(doc => {
    db.Policies.updateOne(
        { _id: doc._id },
        { $set: { key: slugify(doc.name) } }
    );
});

// make sure keys are unique per organization
db.Policies.aggregate([
    {
        $group: {
            _id: {
                organizationId: "$organizationId",
                key: "$key"
            },
            ids: { $push: "$_id" }
        }
    },
    {
        $match: {
            "_id.key": { $ne: null },
            "ids.1": { $exists: true }
        }
    }
]).forEach(group => {
    group.ids.forEach((id, index) => {
        if (index === 0) return;

        db.Policies.updateOne(
            { _id: id },
            {
                $set: {
                    key: `${group._id.key}-${index + 1}`
                }
            }
        );
    });
});

// https://github.com/featbit/featbit/pull/844
// added key to Segments collection
db.Segments.find({
    $or: [
        { key: { $exists: false } },
        { key: null }
    ]
}).forEach(doc => {
    db.Segments.updateOne(
        { _id: doc._id },
        { $set: { key: slugify(doc.name) } }
    );
});

// make sure keys are unique
db.Segments.aggregate([
    {
        $match: {
            key: { $ne: null },
            type: { $in: ["shared", "environment-specific"] }
        }
    },
    {
        $group: {
            _id: {
                type: "$type",
                scopeId: {
                    $cond: [
                        { $eq: ["$type", "shared"] },
                        "$workspaceId",
                        "$envId"
                    ]
                },
                key: "$key"
            },
            ids: { $push: "$_id" }
        }
    },
    {
        $match: {
            "ids.1": { $exists: true }
        }
    }
]).forEach(group => {
    group.ids.forEach((id, index) => {
        if (index === 0) return;

        db.Segments.updateOne(
            { _id: id },
            {
                $set: {
                    key: `${group._id.key}-${index + 1}`
                }
            }
        );
    });
});