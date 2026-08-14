/*
 * FeatBit MongoDB migration: 5.4.6 -> 6.0.0
 * Migration 1: Events -> release-decision event collections.
 *
 * Run with mongosh after the v6.0.0 application/schema has been deployed and
 * legacy event ingestion has been stopped:
 *
 *   FEATBIT_MIGRATION_DATABASE=featbit \
 *     mongosh "$MONGODB_URI" --file 01-events-migration.js
 *
 * PowerShell:
 *
 *   $env:FEATBIT_MIGRATION_DATABASE = 'featbit'
 *   mongosh $env:MONGODB_URI --file 01-events-migration.js
 *
 * The script never updates Events or either lookup collection. It first scans
 * and checks every target ID, then uses $setOnInsert in batches. It is safe to
 * rerun after completion or after an interrupted write phase.
 */

(() => {
    "use strict";

    const crypto = require("crypto");
    const databaseName = process.env.FEATBIT_MIGRATION_DATABASE;
    const batchSize = Number.parseInt(process.env.FEATBIT_MIGRATION_BATCH_SIZE || "500", 10);

    if (!databaseName || !databaseName.trim()) {
        throw new Error("FEATBIT_MIGRATION_DATABASE must name the FeatBit MongoDB database");
    }
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10000) {
        throw new Error("FEATBIT_MIGRATION_BATCH_SIZE must be between 1 and 10000");
    }

    const migrationDb = db.getSiblingDB(databaseName.trim());
    const startedAt = new Date();
    const source = migrationDb.getCollection("Events");
    const exposureTarget = migrationDb.getCollection("ReleaseDecisionExposureEvents");
    const metricTarget = migrationDb.getCollection("ReleaseDecisionMetricEvents");
    const environments = migrationDb.getCollection("Environments");
    const featureFlags = migrationDb.getCollection("FeatureFlags");
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function collectionExists(name) {
        return migrationDb.getCollectionInfos({ name }).length === 1;
    }

    for (const required of ["Events", "Environments", "FeatureFlags"]) {
        if (!collectionExists(required)) {
            throw new Error(`Required source/lookup collection is missing: ${required}`);
        }
    }

    function normalizeUuidString(value) {
        if (typeof value !== "string") {
            return null;
        }
        const normalized = value.trim().replace(/^\{/, "").replace(/\}$/, "").toLowerCase();
        return uuidPattern.test(normalized) ? normalized : null;
    }

    function isStandardUuidBinary(value) {
        return Boolean(value && value._bsontype === "Binary" && value.sub_type === 4 && value.buffer && value.buffer.length === 16);
    }

    function uuidStringFrom(value) {
        const fromString = normalizeUuidString(value);
        if (fromString) {
            return fromString;
        }
        if (!value || value._bsontype !== "Binary" || value.sub_type !== 4 || !value.buffer) {
            return null;
        }
        const hex = value.buffer.toString("hex");
        if (hex.length !== 32) {
            return null;
        }
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function deterministicUuid(seed) {
        const bytes = Buffer.from(crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32), "hex");
        bytes[6] = (bytes[6] & 0x0f) | 0x50;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = bytes.toString("hex");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function canonicalExtendedJson(value) {
        return EJSON.stringify(value, { relaxed: false });
    }

    function relaxedExtendedJson(value) {
        return EJSON.stringify(value, { relaxed: true });
    }

    function sourceIdLabel(document) {
        return relaxedExtendedJson(document._id);
    }

    function resolveEventId(document, warnings) {
        const primary = uuidStringFrom(document._id);
        if (primary) {
            return { uuid: primary, strategy: "source_id" };
        }

        const legacy = uuidStringFrom(document.id);
        if (legacy) {
            warnings.push("non_uuid_source_id_used_legacy_id");
            return { uuid: legacy, strategy: "legacy_id" };
        }

        warnings.push("non_uuid_source_id_used_deterministic_uuid");
        return {
            uuid: deterministicUuid(
                `featbit:v5.4.6:mongodb:Events:${canonicalExtendedJson(document._id)}`
            ),
            strategy: "deterministic"
        };
    }

    function isDocument(value) {
        return value !== null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            !(value instanceof Date) &&
            !value._bsontype;
    }

    function getString(document, key, warnings, warningPrefix) {
        if (!document || !Object.prototype.hasOwnProperty.call(document, key) || document[key] == null) {
            return null;
        }
        if (typeof document[key] === "string") {
            return document[key];
        }
        const value = document[key];
        if (["number", "boolean", "bigint"].includes(typeof value) || value._bsontype) {
            warnings.push(`${warningPrefix || key}_was_not_bson_string`);
            return String(value);
        }
        warnings.push(`${warningPrefix || key}_had_unsupported_bson_type`);
        return null;
    }

    function nonBlank(value) {
        return typeof value === "string" && value.trim().length > 0;
    }

    function validDate(value) {
        return value instanceof Date && Number.isFinite(value.getTime());
    }

    function numericValue(value) {
        let parsed = null;
        if (typeof value === "number") {
            parsed = value;
        } else if (value && value._bsontype === "Int32") {
            parsed = value.value;
        } else if (value && value._bsontype === "Long") {
            parsed = value.toNumber();
        } else if (value && value._bsontype === "Double") {
            parsed = value.value;
        } else if (value && value._bsontype === "Decimal128") {
            parsed = Number.parseFloat(value.toString());
        }
        return Number.isFinite(parsed) ? parsed : null;
    }

    function numericString(value) {
        if (typeof value !== "string" || !/^[+-]?((([0-9]+)(\.[0-9]*)?)|(\.[0-9]+))([eE][+-]?[0-9]+)?$/.test(value.trim())) {
            return null;
        }
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : null;
    }

    function bsonType(value) {
        if (value === null) return "null";
        if (value === undefined) return "missing";
        if (value instanceof Date) return "date";
        if (Array.isArray(value)) return "array";
        if (value && value._bsontype) return value._bsontype;
        return typeof value;
    }

    function profileDocument(document, profile) {
        for (const [key, value] of Object.entries(document)) {
            if (!profile[key]) profile[key] = {};
            const type = bsonType(value);
            profile[key][type] = (profile[key][type] || 0) + 1;
        }
    }

    function sortedProfile(profile) {
        return Object.fromEntries(Object.entries(profile)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, types]) => [key, Object.fromEntries(Object.entries(types).sort())]));
    }

    function parseBoolean(value) {
        if (typeof value === "boolean") return value;
        if (typeof value !== "string") return null;
        if (value.trim().toLowerCase() === "true") return true;
        if (value.trim().toLowerCase() === "false") return false;
        return null;
    }

    const environmentIds = new Set();
    for (const environment of environments.find({}, { _id: 1 })) {
        const id = uuidStringFrom(environment._id);
        if (id) environmentIds.add(id);
    }

    const flagLookup = new Map();
    for (const flag of featureFlags.find({}, { envId: 1, key: 1, variations: 1 })) {
        const envId = uuidStringFrom(flag.envId);
        if (!envId || !nonBlank(flag.key)) continue;
        const variationIds = new Set(
            (Array.isArray(flag.variations) ? flag.variations : [])
                .map(variation => nonBlank(variation?.id) ? variation.id : null)
                .filter(Boolean)
        );
        flagLookup.set(`${envId}\u0000${flag.key}`, variationIds);
    }

    function transform(document) {
        const warnings = [];
        const rejects = [];
        const id = resolveEventId(document, warnings);
        const envId = uuidStringFrom(document.env_id);
        const eventType = typeof document.event === "string" ? document.event : null;
        const properties = isDocument(document.properties) ? document.properties : {};

        if (!envId) rejects.push("invalid_env_id");
        if (!nonBlank(eventType)) rejects.push("missing_or_invalid_event_type");
        if (!isDocument(document.properties)) rejects.push("properties_not_a_bson_document");
        if (!validDate(document.timestamp)) rejects.push("invalid_timestamp");
        if (envId && !environmentIds.has(envId)) warnings.push("environment_not_found");

        const propertyEnv = uuidStringFrom(properties.envId);
        if (properties.envId != null && !propertyEnv) warnings.push("properties_env_id_is_not_uuid");
        if (propertyEnv && envId && propertyEnv !== envId) warnings.push("top_level_properties_env_id_mismatch");

        let targetCollection;
        let targetDocument;

        if (eventType === "FlagValue") {
            targetCollection = "exposure";
            const namedFlagKey = getString(properties, "featureFlagKey", warnings);
            const distinctId = typeof document.distinct_id === "string" ? document.distinct_id : null;
            const sourceEnvText = typeof document.env_id === "string" ? document.env_id : envId;
            const envPrefix = nonBlank(sourceEnvText) ? `${sourceEnvText}-` : null;
            const derivedFlagKey = envPrefix && typeof distinctId === "string" && distinctId.startsWith(envPrefix)
                ? distinctId.slice(envPrefix.length) || null
                : null;
            const flagKey = nonBlank(namedFlagKey) ? namedFlagKey : derivedFlagKey;
            const namedUser = getString(properties, "userKeyId", warnings);
            const tagUser = getString(properties, "tag_0", warnings);
            const userKey = nonBlank(namedUser) ? namedUser : tagUser;
            const namedVariation = getString(properties, "variationId", warnings);
            const tagVariation = getString(properties, "tag_1", warnings);
            const variationId = nonBlank(namedVariation) ? namedVariation : tagVariation;

            if (!nonBlank(flagKey)) rejects.push("missing_flag_key");
            if (!nonBlank(userKey)) rejects.push("missing_user_key");
            if (!nonBlank(variationId)) rejects.push("missing_variation_id");
            if (nonBlank(namedFlagKey) && nonBlank(derivedFlagKey) && namedFlagKey !== derivedFlagKey) {
                warnings.push("flag_key_named_distinct_id_mismatch");
            }
            if (nonBlank(namedUser) && nonBlank(tagUser) && namedUser !== tagUser) {
                warnings.push("user_key_named_tag_mismatch");
            }
            if (nonBlank(namedVariation) && nonBlank(tagVariation) && namedVariation !== tagVariation) {
                warnings.push("variation_id_named_tag_mismatch");
            }

            const namedSend = parseBoolean(properties.sendToExperiment);
            const tagSend = parseBoolean(properties.tag_2);
            if (namedSend !== null && tagSend !== null && namedSend !== tagSend) {
                warnings.push("send_to_experiment_named_tag_mismatch");
            }

            if (envId && nonBlank(flagKey)) {
                const variations = flagLookup.get(`${envId}\u0000${flagKey}`);
                if (!variations) {
                    warnings.push("feature_flag_not_found");
                } else if (nonBlank(variationId) && !variations.has(variationId)) {
                    warnings.push("variation_not_found");
                }
            }

            targetDocument = {
                _id: UUID(id.uuid),
                envId: envId ? UUID(envId) : null,
                flagKey,
                userKey,
                variationId,
                variationValue: null,
                exposedAt: document.timestamp,
                properties: relaxedExtendedJson(properties),
                createdAt: startedAt
            };
        } else {
            targetCollection = "metric";
            const nestedUser = isDocument(properties.user)
                ? getString(properties.user, "keyId", warnings, "user_key_id")
                : null;
            const namedUser = getString(properties, "userKeyId", warnings);
            const tagUser = getString(properties, "tag_0", warnings);
            const userKey = nonBlank(nestedUser) ? nestedUser : (nonBlank(namedUser) ? namedUser : tagUser);
            const distinctId = typeof document.distinct_id === "string" ? document.distinct_id : null;
            const namedEventName = getString(properties, "eventName", warnings);
            const eventName = nonBlank(distinctId) ? distinctId : namedEventName;
            const namedNumeric = numericValue(properties.numericValue);
            const tagNumeric = numericString(properties.tag_1);
            const resolvedNumeric = namedNumeric ?? tagNumeric ?? 0;

            if (!nonBlank(userKey)) rejects.push("missing_user_key");
            if (!nonBlank(eventName)) rejects.push("missing_event_name");
            if (nonBlank(nestedUser) && nonBlank(namedUser) && nestedUser !== namedUser) {
                warnings.push("user_key_nested_named_mismatch");
            }
            if (nonBlank(nestedUser) && nonBlank(tagUser) && nestedUser !== tagUser) {
                warnings.push("user_key_nested_tag_mismatch");
            } else if (!nonBlank(nestedUser) && nonBlank(namedUser) && nonBlank(tagUser) && namedUser !== tagUser) {
                warnings.push("user_key_named_tag_mismatch");
            }
            if (nonBlank(distinctId) && nonBlank(namedEventName) && distinctId !== namedEventName) {
                warnings.push("event_name_distinct_id_named_mismatch");
            }
            if (namedNumeric !== null && tagNumeric !== null && namedNumeric !== tagNumeric) {
                warnings.push("numeric_value_named_tag_mismatch");
            }
            if (namedNumeric === null && tagNumeric === null) warnings.push("numeric_value_defaulted_to_zero");
            if (properties.numericValue != null && namedNumeric === null) warnings.push("numeric_value_had_invalid_bson_type_or_value");

            const propertyType = getString(properties, "type", warnings);
            if (nonBlank(propertyType) && nonBlank(eventType) && propertyType !== eventType) {
                warnings.push("event_type_top_level_properties_mismatch");
            }

            targetDocument = {
                _id: UUID(id.uuid),
                envId: envId ? UUID(envId) : null,
                userKey,
                eventName,
                eventType,
                numericValue: resolvedNumeric,
                occurredAt: document.timestamp,
                properties: relaxedExtendedJson(properties),
                createdAt: startedAt
            };
        }

        return {
            sourceId: sourceIdLabel(document),
            uuid: id.uuid,
            idStrategy: id.strategy,
            targetCollection,
            targetDocument,
            warnings: [...new Set(warnings)],
            rejects: [...new Set(rejects)]
        };
    }

    function sameDate(left, right) {
        return validDate(left) && validDate(right) && left.getTime() === right.getTime();
    }

    function sameNullable(left, right) {
        return (left ?? null) === (right ?? null);
    }

    function sameProperties(left, right) {
        if (typeof left !== "string" || typeof right !== "string") return false;
        try {
            return canonicalExtendedJson(EJSON.parse(left)) === canonicalExtendedJson(EJSON.parse(right));
        } catch (_) {
            return false;
        }
    }

    function sameTargetDocument(actual, expected, kind) {
        if (!actual || !isStandardUuidBinary(actual._id) || !isStandardUuidBinary(actual.envId)) return false;
        if (uuidStringFrom(actual._id) !== uuidStringFrom(expected._id)) return false;
        if (uuidStringFrom(actual.envId) !== uuidStringFrom(expected.envId)) return false;
        if (!sameProperties(actual.properties, expected.properties)) return false;

        if (kind === "exposure") {
            return actual.flagKey === expected.flagKey &&
                actual.userKey === expected.userKey &&
                actual.variationId === expected.variationId &&
                sameNullable(actual.variationValue, expected.variationValue) &&
                sameDate(actual.exposedAt, expected.exposedAt);
        }

        return actual.userKey === expected.userKey &&
            actual.eventName === expected.eventName &&
            actual.eventType === expected.eventType &&
            numericValue(actual.numericValue) === expected.numericValue &&
            sameDate(actual.occurredAt, expected.occurredAt);
    }

    function byUuid(documents) {
        const mapped = new Map();
        for (const document of documents) {
            const id = uuidStringFrom(document._id);
            if (!id) continue;
            if (mapped.has(id)) {
                mapped.set(id, { _migrationDuplicateSemanticId: true });
            } else {
                mapped.set(id, document);
            }
        }
        return mapped;
    }

    function fetchTargets(batch) {
        const ids = batch.flatMap(item => [item.targetDocument._id, item.uuid]);
        return {
            exposure: byUuid(exposureTarget.find({ _id: { $in: ids } }).toArray()),
            metric: byUuid(metricTarget.find({ _id: { $in: ids } }).toArray())
        };
    }

    function eachSourceBatch(callback) {
        let batch = [];
        for (const document of source.find({}).sort({ _id: 1 })) {
            batch.push(document);
            if (batch.length >= batchSize) {
                callback(batch);
                batch = [];
            }
        }
        if (batch.length > 0) callback(batch);
    }

    const report = {
        sourceRows: 0,
        acceptedExposureRows: 0,
        acceptedMetricRows: 0,
        alreadyPresentExposureRows: 0,
        alreadyPresentMetricRows: 0,
        rejectedRows: [],
        warningRows: [],
        conflicts: []
    };
    const topLevelProfile = {};
    const propertiesProfile = {};
    const seenTargetIds = new Map();

    eachSourceBatch(documents => {
        const transformed = documents.map(document => {
            report.sourceRows += 1;
            profileDocument(document, topLevelProfile);
            if (isDocument(document.properties)) profileDocument(document.properties, propertiesProfile);
            return transform(document);
        });
        const valid = transformed.filter(item => item.rejects.length === 0);
        const existing = fetchTargets(valid);

        for (const item of transformed) {
            if (item.rejects.length > 0) {
                report.rejectedRows.push({ sourceId: item.sourceId, reasons: item.rejects });
                continue;
            }

            const firstSource = seenTargetIds.get(item.uuid);
            if (firstSource && firstSource !== item.sourceId) {
                report.conflicts.push({
                    sourceId: item.sourceId,
                    targetId: item.uuid,
                    reason: "multiple_source_events_map_to_same_target_uuid",
                    firstSourceId: firstSource
                });
                continue;
            }
            seenTargetIds.set(item.uuid, item.sourceId);

            if (item.targetCollection === "exposure") report.acceptedExposureRows += 1;
            else report.acceptedMetricRows += 1;

            if (item.warnings.length > 0) {
                report.warningRows.push({ sourceId: item.sourceId, warnings: item.warnings });
            }

            const own = existing[item.targetCollection].get(item.uuid);
            const wrong = existing[item.targetCollection === "exposure" ? "metric" : "exposure"].get(item.uuid);
            if (wrong) {
                report.conflicts.push({
                    sourceId: item.sourceId,
                    targetId: item.uuid,
                    reason: "target_id_exists_in_wrong_event_collection"
                });
            } else if (own && !sameTargetDocument(own, item.targetDocument, item.targetCollection)) {
                report.conflicts.push({
                    sourceId: item.sourceId,
                    targetId: item.uuid,
                    reason: "same_target_id_has_different_content"
                });
            } else if (own) {
                if (item.targetCollection === "exposure") report.alreadyPresentExposureRows += 1;
                else report.alreadyPresentMetricRows += 1;
            }
        }
    });

    print("MongoDB source field/BSON type profile:");
    printjson({
        Events: sortedProfile(topLevelProfile),
        EventProperties: sortedProfile(propertiesProfile)
    });
    print("Rejected source events:");
    printjson(report.rejectedRows);
    print("Source events mapped with warnings:");
    printjson(report.warningRows);
    print("Target conflicts:");
    printjson(report.conflicts);

    if (report.conflicts.length > 0) {
        throw new Error(`Event migration stopped: ${report.conflicts.length} target/source ID conflict(s) found`);
    }

    exposureTarget.createIndex({ envId: 1, flagKey: 1, exposedAt: 1 });
    exposureTarget.createIndex({ envId: 1, userKey: 1, exposedAt: 1 });
    metricTarget.createIndex({ envId: 1, eventName: 1, occurredAt: 1 });
    metricTarget.createIndex({ envId: 1, eventName: 1, userKey: 1, occurredAt: 1 });

    let insertedExposureRows = 0;
    let insertedMetricRows = 0;

    eachSourceBatch(documents => {
        const valid = documents.map(transform).filter(item => item.rejects.length === 0);
        for (const kind of ["exposure", "metric"]) {
            const operations = valid
                .filter(item => item.targetCollection === kind)
                .map(item => {
                    const { _id, ...fields } = item.targetDocument;
                    return {
                        updateOne: {
                            filter: { _id },
                            update: { $setOnInsert: fields },
                            upsert: true
                        }
                    };
                });
            if (operations.length === 0) continue;
            const result = (kind === "exposure" ? exposureTarget : metricTarget)
                .bulkWrite(operations, { ordered: false });
            if (kind === "exposure") insertedExposureRows += result.upsertedCount;
            else insertedMetricRows += result.upsertedCount;
        }
    });

    const postWriteConflicts = [];
    eachSourceBatch(documents => {
        const valid = documents.map(transform).filter(item => item.rejects.length === 0);
        const existing = fetchTargets(valid);
        for (const item of valid) {
            const actual = existing[item.targetCollection].get(item.uuid);
            if (!sameTargetDocument(actual, item.targetDocument, item.targetCollection)) {
                postWriteConflicts.push({
                    sourceId: item.sourceId,
                    targetId: item.uuid,
                    reason: "post_write_verification_failed"
                });
            }
        }
    });
    if (postWriteConflicts.length > 0) {
        printjson(postWriteConflicts);
        throw new Error(`Event migration verification failed for ${postWriteConflicts.length} event(s)`);
    }

    const sourceRowsAfter = source.countDocuments({});
    if (sourceRowsAfter !== report.sourceRows) {
        throw new Error(`Events changed during migration: ${report.sourceRows} before, ${sourceRowsAfter} after`);
    }

    print("MongoDB event migration summary:");
    printjson({
        database: databaseName.trim(),
        sourceRows: report.sourceRows,
        exposure: {
            accepted: report.acceptedExposureRows,
            inserted: insertedExposureRows,
            alreadyPresent: report.acceptedExposureRows - insertedExposureRows
        },
        metric: {
            accepted: report.acceptedMetricRows,
            inserted: insertedMetricRows,
            alreadyPresent: report.acceptedMetricRows - insertedMetricRows
        },
        rejected: report.rejectedRows.length,
        warnings: report.warningRows.length,
        sourceRowsAfter
    });
    print("MongoDB event migration completed.");
})();
