/*
 * FeatBit MongoDB migration: 5.4.6 -> 6.0.0
 * Migration 2: ExperimentMetrics, Experiments, and iteration results.
 *
 * Run after the v6.0.0 application/schema has been deployed and the legacy
 * collections have been frozen:
 *
 *   FEATBIT_MIGRATION_DATABASE=featbit \
 *     mongosh "$MONGODB_URI" --file 02-metrics-and-experimentation-migration.js
 *
 * PowerShell:
 *
 *   $env:FEATBIT_MIGRATION_DATABASE = 'featbit'
 *   mongosh $env:MONGODB_URI --file 02-metrics-and-experimentation-migration.js
 *
 * This script does not modify legacy collections, Events, release-decision
 * event collections, layers, or assignments. All source/target conflicts are
 * checked before writes. Inserts use $setOnInsert, so an interrupted migration
 * can be rerun without overwriting v6 documents.
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
    const collections = {
        sourceMetrics: migrationDb.getCollection("ExperimentMetrics"),
        sourceExperiments: migrationDb.getCollection("Experiments"),
        featureFlags: migrationDb.getCollection("FeatureFlags"),
        environments: migrationDb.getCollection("Environments"),
        projects: migrationDb.getCollection("Projects"),
        users: migrationDb.getCollection("Users"),
        metrics: migrationDb.getCollection("ReleaseDecisionMetrics"),
        experiments: migrationDb.getCollection("ReleaseDecisionExperiments"),
        runs: migrationDb.getCollection("ReleaseDecisionExperimentRuns"),
        activities: migrationDb.getCollection("ReleaseDecisionActivities")
    };
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function collectionExists(name) {
        return migrationDb.getCollectionInfos({ name }).length === 1;
    }

    for (const required of [
        "ExperimentMetrics", "Experiments", "FeatureFlags", "Environments", "Projects", "Users"
    ]) {
        if (!collectionExists(required)) {
            throw new Error(`Required source/lookup collection is missing: ${required}`);
        }
    }

    function normalizeUuidString(value) {
        if (typeof value !== "string") return null;
        const normalized = value.trim().replace(/^\{/, "").replace(/\}$/, "").toLowerCase();
        return uuidPattern.test(normalized) ? normalized : null;
    }

    function isStandardUuidBinary(value) {
        return Boolean(value && value._bsontype === "Binary" && value.sub_type === 4 && value.buffer && value.buffer.length === 16);
    }

    function uuidStringFrom(value) {
        const fromString = normalizeUuidString(value);
        if (fromString) return fromString;
        if (!value || value._bsontype !== "Binary" || value.sub_type !== 4 || !value.buffer) return null;
        const hex = value.buffer.toString("hex");
        if (hex.length !== 32) return null;
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

    function sourceIdLabel(document) {
        return EJSON.stringify(document?._id, { relaxed: true });
    }

    function isDocument(value) {
        return value !== null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            !(value instanceof Date) &&
            !value._bsontype;
    }

    function nonBlank(value) {
        return typeof value === "string" && value.trim().length > 0;
    }

    function validDate(value) {
        return value instanceof Date && Number.isFinite(value.getTime());
    }

    function integerValue(value) {
        let parsed = null;
        if (typeof value === "number") parsed = value;
        else if (value?._bsontype === "Int32") parsed = value.value;
        else if (value?._bsontype === "Long") parsed = value.toNumber();
        else if (value?._bsontype === "Double") parsed = value.value;
        return Number.isInteger(parsed) ? parsed : null;
    }

    function numericValue(value) {
        let parsed = null;
        if (typeof value === "number") parsed = value;
        else if (value?._bsontype === "Int32") parsed = value.value;
        else if (value?._bsontype === "Long") parsed = value.toNumber();
        else if (value?._bsontype === "Double") parsed = value.value;
        else if (value?._bsontype === "Decimal128") parsed = Number.parseFloat(value.toString());
        return Number.isFinite(parsed) ? parsed : null;
    }

    function sameNullable(left, right) {
        return (left ?? null) === (right ?? null);
    }

    function sameDate(left, right) {
        if (left == null || right == null) return left == null && right == null;
        return validDate(left) && validDate(right) && left.getTime() === right.getTime();
    }

    function sameJsonString(left, right) {
        if (left == null || right == null) return left == null && right == null;
        if (typeof left !== "string" || typeof right !== "string") return false;
        try {
            return canonicalExtendedJson(EJSON.parse(left)) === canonicalExtendedJson(EJSON.parse(right));
        } catch (_) {
            return false;
        }
    }

    function bsonType(value) {
        if (value === null) return "null";
        if (value === undefined) return "missing";
        if (value instanceof Date) return "date";
        if (Array.isArray(value)) return "array";
        if (value?._bsontype) return value._bsontype;
        return typeof value;
    }

    function profileDocument(document, profile) {
        if (!isDocument(document)) return;
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

    function extraFields(document, known) {
        return isDocument(document)
            ? Object.keys(document).filter(key => !known.has(key)).sort()
            : [];
    }

    function indexByUuid(documents, field = "_id") {
        const result = new Map();
        for (const document of documents) {
            const id = uuidStringFrom(document[field]);
            if (id && !result.has(id)) result.set(id, document);
        }
        return result;
    }

    function addToMapList(map, key, value) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(value);
    }

    function withoutId(document) {
        const { _id, ...fields } = document;
        return fields;
    }

    function bulkSetOnInsert(collection, documents) {
        let inserted = 0;
        for (let offset = 0; offset < documents.length; offset += batchSize) {
            const batch = documents.slice(offset, offset + batchSize);
            if (batch.length === 0) continue;
            const result = collection.bulkWrite(batch.map(document => ({
                updateOne: {
                    filter: { _id: document._id },
                    update: { $setOnInsert: withoutId(document) },
                    upsert: true
                }
            })), { ordered: false });
            inserted += result.upsertedCount;
        }
        return inserted;
    }

    const knownMetricFields = new Set([
        "_id", "envId", "name", "description", "maintainerUserId", "eventName",
        "eventType", "customEventTrackOption", "customEventUnit",
        "customEventSuccessCriteria", "elementTargets", "targetUrls",
        "isArvhived", "createdAt", "updatedAt"
    ]);
    const knownExperimentFields = new Set([
        "_id", "envId", "metricId", "featureFlagId", "isArchived", "status",
        "baselineVariationId", "iterations", "alpha", "createdAt", "updatedAt"
    ]);
    const knownIterationFields = new Set([
        "id", "startTime", "endTime", "updatedAt", "isArchived", "eventType",
        "eventName", "customEventTrackOption", "customEventUnit",
        "customEventSuccessCriteria", "results", "isFinish"
    ]);
    const knownResultFields = new Set([
        "changeToBaseline", "confidenceInterval", "conversion", "conversionRate",
        "totalEvents", "average", "isBaseline", "isInvalid", "isWinner", "pValue",
        "uniqueUsers", "variationId", "effectSize", "reason"
    ]);
    const knownVariationFields = new Set(["id", "name", "value"]);
    const knownTargetUrlFields = new Set(["id", "matchType", "url"]);

    const profiles = {
        ExperimentMetrics: {}, TargetUrls: {}, Experiments: {}, Iterations: {},
        IterationResults: {}, FeatureFlagVariations: {}
    };
    const unknownFields = [];

    const sourceMetricDocuments = collections.sourceMetrics.find({}).sort({ _id: 1 }).toArray();
    const sourceExperimentDocuments = collections.sourceExperiments.find({}).sort({ _id: 1 }).toArray();
    const environmentDocuments = collections.environments.find({}).toArray();
    const projectDocuments = collections.projects.find({}).toArray();
    const featureFlagDocuments = collections.featureFlags.find({}).toArray();
    const userDocuments = collections.users.find({}, { _id: 1 }).toArray();

    const environmentById = indexByUuid(environmentDocuments);
    const projectById = indexByUuid(projectDocuments);
    const featureFlagById = indexByUuid(featureFlagDocuments);
    const userIds = new Set(indexByUuid(userDocuments).keys());

    for (const flag of featureFlagDocuments) {
        for (const variation of Array.isArray(flag.variations) ? flag.variations : []) {
            profileDocument(variation, profiles.FeatureFlagVariations);
            const extras = extraFields(variation, knownVariationFields);
            if (extras.length) unknownFields.push({ collection: "FeatureFlags.variations", sourceId: sourceIdLabel(flag), fields: extras });
        }
    }

    const metricStages = [];
    for (const document of sourceMetricDocuments) {
        profileDocument(document, profiles.ExperimentMetrics);
        const extras = extraFields(document, knownMetricFields);
        if (extras.length) unknownFields.push({ collection: "ExperimentMetrics", sourceId: sourceIdLabel(document), fields: extras });
        for (const targetUrl of Array.isArray(document.targetUrls) ? document.targetUrls : []) {
            profileDocument(targetUrl, profiles.TargetUrls);
            const targetExtras = extraFields(targetUrl, knownTargetUrlFields);
            if (targetExtras.length) unknownFields.push({ collection: "ExperimentMetrics.targetUrls", sourceId: sourceIdLabel(document), fields: targetExtras });
        }

        const rejects = [];
        const warnings = [];
        const sourceId = uuidStringFrom(document._id);
        const envId = uuidStringFrom(document.envId);
        const eventType = integerValue(document.eventType);
        const trackOption = integerValue(document.customEventTrackOption);
        const successCriteria = integerValue(document.customEventSuccessCriteria);
        const isNumeric = eventType === 1 && trackOption === 2;
        const metricType = isNumeric ? "continuous" : "binary";
        const metricAgg = isNumeric ? "sum" : "once";
        const expectedDirection = successCriteria === 2 ? "decrease_good" : "increase_good";
        const status = document.isArvhived === true ? "archived" : "active";

        if (!sourceId || !isStandardUuidBinary(document._id)) rejects.push("metric_id_not_standard_uuid_binary");
        if (!envId || !isStandardUuidBinary(document.envId)) rejects.push("env_id_not_standard_uuid_binary");
        if (envId && !environmentById.has(envId)) rejects.push("environment_not_found");
        if (!nonBlank(document.name)) rejects.push("missing_name");
        if (!nonBlank(document.eventName)) rejects.push("missing_event_name");
        if (![1, 2, 3].includes(eventType)) rejects.push("invalid_event_type");
        if (![0, 1, 2].includes(trackOption)) rejects.push("invalid_custom_event_track_option");
        if (![0, 1, 2].includes(successCriteria)) rejects.push("invalid_custom_event_success_criteria");
        if (document.description != null && typeof document.description !== "string") rejects.push("invalid_description_type");
        if (typeof document.isArvhived !== "boolean") rejects.push("invalid_is_arvhived_type");
        if (!validDate(document.createdAt)) rejects.push("invalid_created_at");
        if (!validDate(document.updatedAt)) rejects.push("invalid_updated_at");

        if (successCriteria === 0) warnings.push("undefined_success_criteria_defaulted_to_increase_good");
        const maintainerId = uuidStringFrom(document.maintainerUserId);
        if (!maintainerId || !isStandardUuidBinary(document.maintainerUserId)) warnings.push("invalid_maintainer_user_id");
        else if (!userIds.has(maintainerId)) warnings.push("maintainer_user_not_found");
        if (nonBlank(document.customEventUnit)) warnings.push("custom_event_unit_has_no_v6_metric_field");
        if (nonBlank(document.elementTargets)) warnings.push("element_targets_has_no_v6_metric_field");
        if (Array.isArray(document.targetUrls) && document.targetUrls.length > 0) warnings.push("target_urls_has_no_v6_metric_field");
        if (extras.length) warnings.push("unknown_fields_preserved_only_in_source_or_activity_snapshot");

        metricStages.push({
            sourceDocument: document,
            sourceIdLabel: sourceIdLabel(document),
            sourceId,
            envId,
            eventType,
            trackOption,
            successCriteria,
            metricType,
            metricAgg,
            expectedDirection,
            status,
            rejects: [...new Set(rejects)],
            warnings: [...new Set(warnings)],
            targetDocument: sourceId && envId ? {
                _id: UUID(sourceId),
                featBitEnvId: UUID(envId),
                name: document.name,
                key: document.eventName,
                description: document.description ?? null,
                metricType,
                metricAgg,
                expectedDirection,
                status,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt
            } : null
        });
    }

    function metricCompatibilitySignature(stage) {
        return JSON.stringify({
            name: stage.sourceDocument.name,
            description: stage.sourceDocument.description ?? null,
            metricType: stage.metricType,
            metricAgg: stage.metricAgg,
            expectedDirection: stage.expectedDirection,
            status: stage.status
        });
    }

    function sameMetric(actual, expected) {
        return actual && expected &&
            isStandardUuidBinary(actual._id) &&
            isStandardUuidBinary(actual.featBitEnvId) &&
            uuidStringFrom(actual._id) === uuidStringFrom(expected._id) &&
            uuidStringFrom(actual.featBitEnvId) === uuidStringFrom(expected.featBitEnvId) &&
            actual.name === expected.name &&
            actual.key === expected.key &&
            sameNullable(actual.description, expected.description) &&
            actual.metricType === expected.metricType &&
            actual.metricAgg === expected.metricAgg &&
            actual.expectedDirection === expected.expectedDirection &&
            actual.status === expected.status &&
            sameDate(actual.createdAt, expected.createdAt) &&
            sameDate(actual.updatedAt, expected.updatedAt);
    }

    const conflicts = [];
    function detectDuplicateSemanticTargetIds(documents, kind) {
        const grouped = new Map();
        for (const document of documents) {
            const id = uuidStringFrom(document._id);
            if (id) addToMapList(grouped, id, document);
        }
        for (const [id, group] of grouped) {
            if (group.length > 1) {
                conflicts.push({
                    kind,
                    targetId: id,
                    reason: "multiple_target_documents_use_the_same_semantic_uuid"
                });
            }
        }
    }

    const validMetricGroups = new Map();
    for (const stage of metricStages.filter(item => item.rejects.length === 0)) {
        addToMapList(validMetricGroups, `${stage.envId}\u0000${stage.sourceDocument.eventName}`, stage);
    }

    for (const [key, group] of validMetricGroups) {
        if (new Set(group.map(metricCompatibilitySignature)).size > 1) {
            conflicts.push({
                kind: "metric_source_duplicate",
                key,
                sourceIds: group.map(item => item.sourceId),
                reason: "same_env_key_has_different_v6_metric_content"
            });
        }
    }

    const existingMetricDocuments = collections.metrics.find({}).toArray();
    detectDuplicateSemanticTargetIds(existingMetricDocuments, "metric_target");
    const existingMetricsById = indexByUuid(existingMetricDocuments);
    const existingMetricsByKey = new Map();
    for (const document of existingMetricDocuments) {
        const envId = uuidStringFrom(document.featBitEnvId);
        if (envId && nonBlank(document.key)) addToMapList(existingMetricsByKey, `${envId}\u0000${document.key}`, document);
    }

    const metricIdMap = new Map();
    const metricsToInsert = [];
    for (const [key, group] of validMetricGroups) {
        if (new Set(group.map(metricCompatibilitySignature)).size > 1) continue;
        const canonical = [...group].sort((left, right) => {
            const dateComparison = left.sourceDocument.createdAt.getTime() - right.sourceDocument.createdAt.getTime();
            return dateComparison || left.sourceId.localeCompare(right.sourceId);
        })[0];
        const byKey = existingMetricsByKey.get(key) || [];
        if (byKey.length > 1) {
            conflicts.push({ kind: "metric_target", key, reason: "multiple_target_metrics_have_same_env_key" });
            continue;
        }

        let mappedDocument;
        if (byKey.length === 1) {
            const existing = byKey[0];
            const expected = { ...canonical.targetDocument, _id: existing._id };
            if (!sameMetric(existing, expected)) {
                conflicts.push({
                    kind: "metric_target",
                    key,
                    sourceId: canonical.sourceId,
                    targetId: uuidStringFrom(existing._id),
                    reason: "same_env_key_has_different_content"
                });
                continue;
            }
            mappedDocument = expected;
        } else {
            const idCollision = existingMetricsById.get(canonical.sourceId);
            if (idCollision) {
                conflicts.push({
                    kind: "metric_target",
                    key,
                    sourceId: canonical.sourceId,
                    reason: "source_id_already_used_by_different_target_metric"
                });
                continue;
            }
            mappedDocument = canonical.targetDocument;
            metricsToInsert.push(mappedDocument);
        }

        const targetId = uuidStringFrom(mappedDocument._id);
        for (const item of group) {
            metricIdMap.set(item.sourceId, {
                targetId,
                targetDocument: mappedDocument,
                sourceStage: item,
                wasMerged: item.sourceId !== targetId
            });
        }
    }

    const experimentStages = [];
    const runStages = [];
    for (const document of sourceExperimentDocuments) {
        profileDocument(document, profiles.Experiments);
        const experimentExtras = extraFields(document, knownExperimentFields);
        if (experimentExtras.length) unknownFields.push({ collection: "Experiments", sourceId: sourceIdLabel(document), fields: experimentExtras });

        const rejects = [];
        const warnings = [];
        const sourceId = uuidStringFrom(document._id);
        const envId = uuidStringFrom(document.envId);
        const metricId = uuidStringFrom(document.metricId);
        const featureFlagId = uuidStringFrom(document.featureFlagId);
        const environment = envId ? environmentById.get(envId) : null;
        const projectId = environment ? uuidStringFrom(environment.projectId) : null;
        const project = projectId ? projectById.get(projectId) : null;
        const flag = featureFlagId ? featureFlagById.get(featureFlagId) : null;
        const flagEnvId = flag ? uuidStringFrom(flag.envId) : null;
        const mappedMetric = metricId ? metricIdMap.get(metricId) : null;
        const iterations = document.iterations == null ? [] : document.iterations;
        const variations = Array.isArray(flag?.variations) ? flag.variations : [];
        const variationIds = variations.map(item => item?.id).filter(nonBlank);

        if (!sourceId || !isStandardUuidBinary(document._id)) rejects.push("experiment_id_not_standard_uuid_binary");
        if (!envId || !isStandardUuidBinary(document.envId)) rejects.push("env_id_not_standard_uuid_binary");
        if (!metricId || !isStandardUuidBinary(document.metricId)) rejects.push("metric_id_not_standard_uuid_binary");
        if (!featureFlagId || !isStandardUuidBinary(document.featureFlagId)) rejects.push("feature_flag_id_not_standard_uuid_binary");
        if (!environment) rejects.push("environment_not_found");
        if (environment && !isStandardUuidBinary(environment._id)) rejects.push("environment_lookup_id_not_standard_uuid_binary");
        if (environment && !isStandardUuidBinary(environment.projectId)) rejects.push("project_reference_not_standard_uuid_binary");
        if (!project) rejects.push("project_not_found");
        if (project && !isStandardUuidBinary(project._id)) rejects.push("project_lookup_id_not_standard_uuid_binary");
        if (project && !nonBlank(project.key)) rejects.push("project_key_missing_or_invalid");
        if (!metricId || !mappedMetric) rejects.push("metric_not_mapped");
        if (!featureFlagId || !flag) rejects.push("feature_flag_not_found");
        if (flag && !isStandardUuidBinary(flag._id)) rejects.push("feature_flag_lookup_id_not_standard_uuid_binary");
        if (flag && !isStandardUuidBinary(flag.envId)) rejects.push("feature_flag_env_id_not_standard_uuid_binary");
        if (flag && flagEnvId !== envId) rejects.push("feature_flag_environment_mismatch");
        if (flag && !nonBlank(flag.name)) rejects.push("feature_flag_name_missing_or_invalid");
        if (flag && !nonBlank(flag.key)) rejects.push("feature_flag_key_missing_or_invalid");
        if (mappedMetric && uuidStringFrom(mappedMetric.targetDocument.featBitEnvId) !== envId) rejects.push("metric_environment_mismatch");
        if (!Array.isArray(iterations)) rejects.push("iterations_not_an_array");
        if (!Array.isArray(flag?.variations)) rejects.push("flag_variations_not_an_array");
        if (variations.some(item =>
            !isDocument(item) ||
            !nonBlank(item.id) ||
            !nonBlank(item.name) ||
            (item.value != null && typeof item.value !== "string")
        )) rejects.push("invalid_flag_variation");
        if (new Set(variationIds).size !== variationIds.length) rejects.push("duplicate_flag_variation_id");
        if (document.alpha != null && numericValue(document.alpha) === null) rejects.push("invalid_alpha_type");
        if (!validDate(document.createdAt)) rejects.push("invalid_created_at");
        if (!validDate(document.updatedAt)) rejects.push("invalid_updated_at");
        if (!nonBlank(document.baselineVariationId)) warnings.push("missing_baseline_variation_id");
        else if (!variationIds.includes(document.baselineVariationId)) warnings.push("baseline_variation_not_found_in_flag");
        if (document.alpha == null) warnings.push("legacy_alpha_is_null");
        if (typeof document.isArchived !== "boolean") warnings.push("legacy_is_archived_has_invalid_type");
        if (!nonBlank(document.status)) warnings.push("legacy_status_missing_or_invalid");
        if (experimentExtras.length) warnings.push("unknown_fields_preserved_in_migration_activity");

        const primaryMetricObject = mappedMetric ? {
            name: mappedMetric.targetDocument.name,
            event: mappedMetric.targetDocument.key,
            metricType: mappedMetric.targetDocument.metricType,
            metricAgg: mappedMetric.targetDocument.metricAgg,
            expectedDirection: mappedMetric.targetDocument.expectedDirection,
            ...(mappedMetric.targetDocument.description != null
                ? { description: mappedMetric.targetDocument.description }
                : {})
        } : null;
        const variantObjects = variations.map(variation => ({
            key: variation.id,
            name: variation.name,
            value: variation.value ?? null,
            description: nonBlank(variation.value)
                ? `${variation.name} (${variation.value})`
                : variation.name
        }));
        const generatedName = flag && mappedMetric
            ? `${flag.name} / ${mappedMetric.targetDocument.name}`.slice(0, 256)
            : null;

        const targetDocument = sourceId && envId && project && flag && mappedMetric ? {
            _id: UUID(sourceId),
            name: generatedName,
            description: null,
            stage: Array.isArray(iterations) && iterations.length > 0 ? "measuring" : "implementing",
            flagKey: flag.key,
            featBitProjectKey: project.key,
            featBitEnvId: UUID(envId),
            hypothesis: null,
            accessToken: null,
            change: null,
            constraints: null,
            envSecret: null,
            flagServerUrl: null,
            goal: null,
            guardrails: null,
            intent: null,
            lastAction: null,
            lastLearning: null,
            openQuestions: null,
            primaryMetric: JSON.stringify(primaryMetricObject),
            sandboxId: null,
            sandboxStatus: "idle",
            variants: JSON.stringify(variantObjects),
            conflictAnalysis: null,
            entryMode: null,
            experimentRuns: [],
            activities: [],
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
        } : null;

        const stage = {
            sourceDocument: document,
            sourceIdLabel: sourceIdLabel(document),
            sourceId,
            envId,
            metricId,
            featureFlagId,
            environment,
            project,
            flag,
            mappedMetric,
            iterations: Array.isArray(iterations) ? iterations : [],
            variations,
            variationIds,
            rejects: [...new Set(rejects)],
            warnings: [...new Set(warnings)],
            targetDocument
        };
        experimentStages.push(stage);

        stage.iterations.forEach((iteration, index) => {
            profileDocument(iteration, profiles.Iterations);
            const iterationExtras = extraFields(iteration, knownIterationFields);
            if (iterationExtras.length) unknownFields.push({
                collection: "Experiments.iterations",
                sourceId: stage.sourceIdLabel,
                iteration: index + 1,
                fields: iterationExtras
            });
            for (const result of Array.isArray(iteration?.results) ? iteration.results : []) {
                profileDocument(result, profiles.IterationResults);
                const resultExtras = extraFields(result, knownResultFields);
                if (resultExtras.length) unknownFields.push({
                    collection: "Experiments.iterations.results",
                    sourceId: stage.sourceIdLabel,
                    iteration: index + 1,
                    fields: resultExtras
                });
            }

            // Field profiling covers every source iteration, even when its
            // parent experiment cannot be migrated because a lookup is bad.
            if (stage.rejects.length > 0) return;

            const runRejects = [];
            const runWarnings = [];
            const runIdText = typeof iteration?.id === "string" ? iteration.id.trim() : null;
            const runId = uuidStringFrom(iteration?.id);
            const eventType = iteration?.eventType == null
                ? stage.mappedMetric.sourceStage.eventType
                : integerValue(iteration.eventType);
            const trackOption = iteration?.customEventTrackOption == null
                ? stage.mappedMetric.sourceStage.trackOption
                : integerValue(iteration.customEventTrackOption);
            const successCriteria = iteration?.customEventSuccessCriteria == null
                ? stage.mappedMetric.sourceStage.successCriteria
                : integerValue(iteration.customEventSuccessCriteria);
            const eventName = nonBlank(iteration?.eventName)
                ? iteration.eventName
                : stage.mappedMetric.targetDocument.key;
            const results = iteration?.results == null ? [] : iteration.results;

            if (!isDocument(iteration)) runRejects.push("iteration_not_a_bson_document");
            if (!runId) runRejects.push("iteration_id_not_uuid");
            if (!validDate(iteration?.startTime)) runRejects.push("invalid_start_time");
            if (iteration?.endTime != null && !validDate(iteration.endTime)) runRejects.push("invalid_end_time");
            if (iteration?.updatedAt != null && !validDate(iteration.updatedAt)) runRejects.push("invalid_updated_at");
            if (![1, 2, 3].includes(eventType)) runRejects.push("invalid_iteration_event_type");
            if (![0, 1, 2].includes(trackOption)) runRejects.push("invalid_iteration_track_option");
            if (![0, 1, 2].includes(successCriteria)) runRejects.push("invalid_iteration_success_criteria");
            if (!nonBlank(eventName)) runRejects.push("missing_iteration_event_name");
            if (!Array.isArray(results)) runRejects.push("iteration_results_not_an_array");
            if (Array.isArray(results) && results.some(result => !isDocument(result) || !nonBlank(result.variationId))) {
                runRejects.push("invalid_iteration_result");
            }
            if (Array.isArray(results) && results.some(result => nonBlank(result?.variationId) && !stage.variationIds.includes(result.variationId))) {
                runRejects.push("result_variation_not_found_in_flag");
            }
            if (!nonBlank(document.baselineVariationId)) runRejects.push("missing_control_variation");
            else if (!stage.variationIds.includes(document.baselineVariationId)) runRejects.push("control_variation_not_found_in_flag");
            if (iteration?.isFinish != null && typeof iteration.isFinish !== "boolean") runRejects.push("invalid_is_finish_type");

            if (iteration?.eventName == null) runWarnings.push("event_name_fell_back_to_metric_definition");
            if (iteration?.eventType == null) runWarnings.push("event_type_fell_back_to_metric_definition");
            if (iteration?.customEventTrackOption == null) runWarnings.push("track_option_fell_back_to_metric_definition");
            if (iteration?.isArchived === true) runWarnings.push("legacy_iteration_was_archived");
            if (validDate(iteration?.startTime) && validDate(iteration?.endTime) && iteration.endTime < iteration.startTime) {
                runWarnings.push("observation_end_precedes_start");
            }
            if (iterationExtras.length) runWarnings.push("unknown_fields_preserved_in_legacy_artifact");
            runWarnings.push("legacy_results_preserved_without_recomputation");

            const treatmentIds = [];
            if (Array.isArray(results)) {
                for (const result of results) {
                    const variationId = result?.variationId;
                    if (nonBlank(variationId) && variationId !== document.baselineVariationId && !treatmentIds.includes(variationId)) {
                        treatmentIds.push(variationId);
                    }
                }
            }
            if (treatmentIds.length === 0) {
                for (const variationId of stage.variationIds) {
                    if (variationId !== document.baselineVariationId) treatmentIds.push(variationId);
                }
            }

            const isNumeric = eventType === 1 && trackOption === 2;
            const updatedAt = validDate(iteration?.updatedAt)
                ? iteration.updatedAt
                : (validDate(iteration?.endTime) ? iteration.endTime : iteration?.startTime);
            const analysisArtifact = {
                artifactVersion: 1,
                kind: "featbit_legacy_frequentist",
                sourceVersion: "5.4.6",
                sourceProvider: "MongoDB",
                recomputed: false,
                sourceExperimentId: stage.sourceId,
                alpha: document.alpha ?? null,
                iteration,
                results: Array.isArray(results) ? results : []
            };
            const targetRun = runId && validDate(iteration?.startTime) ? {
                _id: UUID(runId),
                experimentId: UUID(stage.sourceId),
                slug: `legacy-${index + 1}`,
                status: iteration?.isFinish === true || (Array.isArray(results) && results.length > 0)
                    ? "analyzing"
                    : "collecting",
                hypothesis: null,
                method: "legacy_frequentist",
                methodReason: "Imported from FeatBit 5.4.6; historical result was not recomputed.",
                primaryMetricEvent: eventName,
                metricDescription: stage.mappedMetric.targetDocument.description ?? null,
                guardrailEvents: null,
                guardrailDescriptions: null,
                controlVariant: document.baselineVariationId ?? null,
                treatmentVariant: treatmentIds.length > 0 ? treatmentIds.join("|") : null,
                trafficAllocation: null,
                minimumSample: null,
                observationStart: iteration.startTime,
                observationEnd: validDate(iteration.endTime) ? iteration.endTime : null,
                priorProper: false,
                priorMean: null,
                priorStddev: null,
                inputData: null,
                analysisResult: canonicalExtendedJson(analysisArtifact),
                decision: null,
                decisionSummary: null,
                decisionReason: null,
                whatChanged: null,
                whatHappened: null,
                confirmedOrRefuted: null,
                whyItHappened: null,
                nextHypothesis: null,
                runId: runIdText || runId,
                primaryMetricAgg: isNumeric ? "sum" : "once",
                primaryMetricType: isNumeric ? "continuous" : "binary",
                trafficPercent: 100,
                layerId: null,
                audienceFilters: null,
                trafficOffset: 0,
                layerKey: null,
                allocationKeySelector: "user.keyId",
                sliceStart: 0,
                sliceEnd: 100,
                allocationPlan: null,
                assignmentUnitSelector: "user.keyId",
                layerTrafficPercent: 100,
                analysisSamplingPlan: null,
                dataSourceMode: "featbit-managed",
                customerEndpointConfig: null,
                createdAt: iteration.startTime,
                updatedAt
            } : null;

            runStages.push({
                experimentStage: stage,
                sourceIteration: iteration,
                sourceIterationId: runIdText,
                iterationNumber: index + 1,
                runId,
                rejects: [...new Set(runRejects)],
                warnings: [...new Set(runWarnings)],
                targetDocument: targetRun
            });
        });
    }

    const runStagesById = new Map();
    for (const stage of runStages.filter(item => item.runId)) addToMapList(runStagesById, stage.runId, stage);
    for (const group of runStagesById.values()) {
        if (group.length > 1) {
            for (const stage of group) {
                if (!stage.rejects.includes("duplicate_iteration_id")) stage.rejects.push("duplicate_iteration_id");
            }
        }
    }

    function sameExperiment(actual, expected) {
        return actual && expected &&
            isStandardUuidBinary(actual._id) &&
            isStandardUuidBinary(actual.featBitEnvId) &&
            uuidStringFrom(actual._id) === uuidStringFrom(expected._id) &&
            actual.name === expected.name &&
            sameNullable(actual.description, expected.description) &&
            actual.stage === expected.stage &&
            sameNullable(actual.flagKey, expected.flagKey) &&
            sameNullable(actual.featBitProjectKey, expected.featBitProjectKey) &&
            uuidStringFrom(actual.featBitEnvId) === uuidStringFrom(expected.featBitEnvId) &&
            sameJsonString(actual.primaryMetric, expected.primaryMetric) &&
            sameJsonString(actual.variants, expected.variants) &&
            sameNullable(actual.sandboxStatus, expected.sandboxStatus) &&
            sameDate(actual.createdAt, expected.createdAt) &&
            sameDate(actual.updatedAt, expected.updatedAt);
    }

    function sameRun(actual, expected) {
        return actual && expected &&
            isStandardUuidBinary(actual._id) &&
            isStandardUuidBinary(actual.experimentId) &&
            uuidStringFrom(actual._id) === uuidStringFrom(expected._id) &&
            uuidStringFrom(actual.experimentId) === uuidStringFrom(expected.experimentId) &&
            actual.slug === expected.slug &&
            actual.status === expected.status &&
            sameNullable(actual.method, expected.method) &&
            sameNullable(actual.methodReason, expected.methodReason) &&
            sameNullable(actual.primaryMetricEvent, expected.primaryMetricEvent) &&
            sameNullable(actual.metricDescription, expected.metricDescription) &&
            sameNullable(actual.controlVariant, expected.controlVariant) &&
            sameNullable(actual.treatmentVariant, expected.treatmentVariant) &&
            sameDate(actual.observationStart, expected.observationStart) &&
            sameDate(actual.observationEnd, expected.observationEnd) &&
            sameNullable(actual.inputData, expected.inputData) &&
            sameJsonString(actual.analysisResult, expected.analysisResult) &&
            sameNullable(actual.runId, expected.runId) &&
            sameNullable(actual.primaryMetricAgg, expected.primaryMetricAgg) &&
            sameNullable(actual.primaryMetricType, expected.primaryMetricType) &&
            sameDate(actual.createdAt, expected.createdAt) &&
            sameDate(actual.updatedAt, expected.updatedAt);
    }

    const existingExperimentDocuments = collections.experiments.find({}).toArray();
    detectDuplicateSemanticTargetIds(existingExperimentDocuments, "experiment_target");
    const existingExperimentsById = indexByUuid(existingExperimentDocuments);
    const experimentsToInsert = [];
    for (const stage of experimentStages.filter(item => item.rejects.length === 0)) {
        const existing = existingExperimentsById.get(stage.sourceId);
        if (existing && !sameExperiment(existing, stage.targetDocument)) {
            conflicts.push({
                kind: "experiment_target",
                sourceId: stage.sourceId,
                reason: "same_id_has_different_content"
            });
        } else if (!existing) {
            experimentsToInsert.push(stage.targetDocument);
        }
    }

    const existingRunDocuments = collections.runs.find({}).toArray();
    detectDuplicateSemanticTargetIds(existingRunDocuments, "run_target");
    const existingRunsById = indexByUuid(existingRunDocuments);
    const existingRunsBySlug = new Map();
    for (const document of existingRunDocuments) {
        const experimentId = uuidStringFrom(document.experimentId);
        if (experimentId && nonBlank(document.slug)) addToMapList(existingRunsBySlug, `${experimentId}\u0000${document.slug}`, document);
    }
    const runsToInsert = [];
    for (const stage of runStages.filter(item => item.rejects.length === 0)) {
        const existingById = existingRunsById.get(stage.runId);
        const slugMatches = existingRunsBySlug.get(`${stage.experimentStage.sourceId}\u0000${stage.targetDocument.slug}`) || [];
        if (slugMatches.some(item => uuidStringFrom(item._id) !== stage.runId)) {
            conflicts.push({
                kind: "run_target",
                experimentId: stage.experimentStage.sourceId,
                sourceIterationId: stage.sourceIterationId,
                reason: "same_experiment_slug_has_different_id"
            });
        } else if (existingById && !sameRun(existingById, stage.targetDocument)) {
            conflicts.push({
                kind: "run_target",
                experimentId: stage.experimentStage.sourceId,
                sourceIterationId: stage.sourceIterationId,
                reason: "same_id_has_different_content"
            });
        } else if (!existingById) {
            runsToInsert.push(stage.targetDocument);
        }
    }

    const activityStages = experimentStages
        .filter(item => item.rejects.length === 0)
        .map(stage => {
            const activityId = deterministicUuid(`featbit:v5.4.6:mongodb:experiment:${stage.sourceId}`);
            const detail = canonicalExtendedJson({
                artifactVersion: 1,
                kind: "featbit_v5_4_6_experiment_migration",
                sourceVersion: "5.4.6",
                sourceProvider: "MongoDB",
                sourceExperiment: stage.sourceDocument,
                sourceMetric: stage.mappedMetric.sourceStage.sourceDocument,
                lookups: {
                    environmentId: stage.envId,
                    projectId: uuidStringFrom(stage.environment.projectId),
                    featureFlagId: stage.featureFlagId
                },
                mapping: {
                    oldMetricId: stage.metricId,
                    targetMetricId: stage.mappedMetric.targetId,
                    metricWasMerged: stage.mappedMetric.wasMerged
                }
            });
            return {
                experimentStage: stage,
                activityId,
                targetDocument: {
                    _id: UUID(activityId),
                    type: "migration",
                    title: "Imported FeatBit 5.4.6 MongoDB experiment",
                    detail,
                    actorId: null,
                    actorName: "v5.4.6 MongoDB migration",
                    actorEmail: null,
                    actorType: "system",
                    experimentId: UUID(stage.sourceId),
                    createdAt: startedAt
                }
            };
        });

    function sameActivity(actual, expected) {
        return actual && expected &&
            isStandardUuidBinary(actual._id) &&
            isStandardUuidBinary(actual.experimentId) &&
            uuidStringFrom(actual._id) === uuidStringFrom(expected._id) &&
            actual.type === expected.type &&
            actual.title === expected.title &&
            sameJsonString(actual.detail, expected.detail) &&
            sameNullable(actual.actorId, expected.actorId) &&
            sameNullable(actual.actorName, expected.actorName) &&
            sameNullable(actual.actorEmail, expected.actorEmail) &&
            sameNullable(actual.actorType, expected.actorType) &&
            uuidStringFrom(actual.experimentId) === uuidStringFrom(expected.experimentId);
    }

    const existingActivityDocuments = collections.activities.find({}).toArray();
    detectDuplicateSemanticTargetIds(existingActivityDocuments, "activity_target");
    const existingActivitiesById = indexByUuid(existingActivityDocuments);
    const activitiesToInsert = [];
    for (const stage of activityStages) {
        const existing = existingActivitiesById.get(stage.activityId);
        if (existing && !sameActivity(existing, stage.targetDocument)) {
            conflicts.push({
                kind: "activity_target",
                experimentId: stage.experimentStage.sourceId,
                activityId: stage.activityId,
                reason: "same_id_has_different_content"
            });
        } else if (!existing) {
            activitiesToInsert.push(stage.targetDocument);
        }
    }

    print("MongoDB source field/BSON type profile:");
    printjson(Object.fromEntries(Object.entries(profiles).map(([key, value]) => [key, sortedProfile(value)])));
    print("Unknown source fields (preserved in source and referenced experiment/activity artifacts):");
    printjson(unknownFields);
    print("Rejected legacy metrics:");
    printjson(metricStages.filter(item => item.rejects.length > 0).map(item => ({
        sourceId: item.sourceIdLabel,
        reasons: item.rejects
    })));
    print("Legacy metric warnings and fields without direct v6 columns:");
    printjson(metricStages.filter(item => item.warnings.length > 0).map(item => ({
        sourceId: item.sourceIdLabel,
        warnings: item.warnings,
        maintainerUserId: item.sourceDocument.maintainerUserId,
        customEventUnit: item.sourceDocument.customEventUnit,
        elementTargets: item.sourceDocument.elementTargets,
        targetUrls: item.sourceDocument.targetUrls
    })));
    print("Rejected legacy experiments:");
    printjson(experimentStages.filter(item => item.rejects.length > 0).map(item => ({
        sourceId: item.sourceIdLabel,
        reasons: item.rejects
    })));
    print("Rejected legacy iterations:");
    printjson(runStages.filter(item => item.rejects.length > 0).map(item => ({
        experimentId: item.experimentStage.sourceId,
        iteration: item.iterationNumber,
        sourceIterationId: item.sourceIterationId,
        reasons: item.rejects
    })));
    print("Target/source conflicts:");
    printjson(conflicts);

    if (conflicts.length > 0) {
        throw new Error(`Metrics/experimentation migration stopped: ${conflicts.length} conflict(s) found`);
    }

    collections.metrics.createIndex({ featBitEnvId: 1, key: 1 }, { unique: true });
    collections.metrics.createIndex({ featBitEnvId: 1, status: 1 });
    collections.experiments.createIndex({ featBitEnvId: 1, updatedAt: -1 });
    collections.experiments.createIndex({ featBitProjectKey: 1 });
    collections.experiments.createIndex({ flagKey: 1 });
    collections.experiments.createIndex({ featBitEnvId: 1, flagKey: 1, updatedAt: -1 });
    collections.runs.createIndex({ experimentId: 1, slug: 1 }, { unique: true });
    collections.activities.createIndex({ experimentId: 1, createdAt: -1 });
    collections.activities.createIndex({ experimentId: 1, actorId: 1 });

    const insertedMetrics = bulkSetOnInsert(collections.metrics, metricsToInsert);
    const insertedExperiments = bulkSetOnInsert(collections.experiments, experimentsToInsert);
    const insertedRuns = bulkSetOnInsert(collections.runs, runsToInsert);
    const insertedActivities = bulkSetOnInsert(collections.activities, activitiesToInsert);

    const verificationFailures = [];
    const actualMetrics = indexByUuid(collections.metrics.find({}).toArray());
    for (const mapping of metricIdMap.values()) {
        const actual = actualMetrics.get(mapping.targetId);
        if (!sameMetric(actual, mapping.targetDocument)) {
            verificationFailures.push({ kind: "metric", targetId: mapping.targetId });
        }
    }
    const actualExperiments = indexByUuid(collections.experiments.find({}).toArray());
    for (const stage of experimentStages.filter(item => item.rejects.length === 0)) {
        if (!sameExperiment(actualExperiments.get(stage.sourceId), stage.targetDocument)) {
            verificationFailures.push({ kind: "experiment", targetId: stage.sourceId });
        }
    }
    const actualRuns = indexByUuid(collections.runs.find({}).toArray());
    for (const stage of runStages.filter(item => item.rejects.length === 0)) {
        if (!sameRun(actualRuns.get(stage.runId), stage.targetDocument)) {
            verificationFailures.push({ kind: "run", targetId: stage.runId });
        }
    }
    const actualActivities = indexByUuid(collections.activities.find({}).toArray());
    for (const stage of activityStages) {
        if (!sameActivity(actualActivities.get(stage.activityId), stage.targetDocument)) {
            verificationFailures.push({ kind: "activity", targetId: stage.activityId });
        }
    }
    if (verificationFailures.length > 0) {
        printjson(verificationFailures);
        throw new Error(`Post-write verification failed for ${verificationFailures.length} target document(s)`);
    }

    const sourceMetricRowsAfter = collections.sourceMetrics.countDocuments({});
    const sourceExperimentRowsAfter = collections.sourceExperiments.countDocuments({});
    if (sourceMetricRowsAfter !== sourceMetricDocuments.length ||
        sourceExperimentRowsAfter !== sourceExperimentDocuments.length) {
        throw new Error("Legacy metric or experiment collection changed during migration");
    }

    print("Old metric ID -> target metric ID mapping:");
    printjson([...metricIdMap.entries()].map(([oldMetricId, mapping]) => ({
        oldMetricId,
        targetMetricId: mapping.targetId,
        envId: mapping.sourceStage.envId,
        key: mapping.sourceStage.sourceDocument.eventName,
        wasMerged: mapping.wasMerged
    })).sort((left, right) => left.oldMetricId.localeCompare(right.oldMetricId)));

    print("MongoDB metrics and experimentation migration summary:");
    printjson({
        database: databaseName.trim(),
        metrics: {
            source: metricStages.length,
            accepted: metricStages.filter(item => item.rejects.length === 0).length,
            targetDocuments: new Set([...metricIdMap.values()].map(item => item.targetId)).size,
            inserted: insertedMetrics,
            mergedSourceRows: [...metricIdMap.values()].filter(item => item.wasMerged).length,
            rejected: metricStages.filter(item => item.rejects.length > 0).length
        },
        experiments: {
            source: experimentStages.length,
            accepted: experimentStages.filter(item => item.rejects.length === 0).length,
            inserted: insertedExperiments,
            alreadyPresent: experimentStages.filter(item => item.rejects.length === 0).length - insertedExperiments,
            rejected: experimentStages.filter(item => item.rejects.length > 0).length
        },
        runs: {
            sourceIterations: runStages.length,
            accepted: runStages.filter(item => item.rejects.length === 0).length,
            inserted: insertedRuns,
            alreadyPresent: runStages.filter(item => item.rejects.length === 0).length - insertedRuns,
            rejected: runStages.filter(item => item.rejects.length > 0).length
        },
        activities: {
            expected: activityStages.length,
            inserted: insertedActivities,
            alreadyPresent: activityStages.length - insertedActivities
        },
        sourceMetricRowsAfter,
        sourceExperimentRowsAfter
    });
    print("MongoDB metrics and experimentation migration completed.");
})();
