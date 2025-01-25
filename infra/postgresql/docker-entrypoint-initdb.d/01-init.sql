CREATE TABLE Workspaces (
    Id UUID PRIMARY KEY,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Key VARCHAR(255) NOT NULL UNIQUE,
    License TEXT,
    Sso JSONB,
    CONSTRAINT workspace_key_unique UNIQUE (Key)
);

CREATE TABLE Users (
    Id UUID PRIMARY KEY,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    WorkspaceId UUID NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Email VARCHAR(255) NOT NULL,
    Password TEXT NOT NULL,
    Origin VARCHAR(255),
    CONSTRAINT fk_workspace FOREIGN KEY (WorkspaceId) REFERENCES Workspaces(Id) ON DELETE CASCADE
);

CREATE INDEX idx_user_workspace ON Users (WorkspaceId);
CREATE INDEX idx_user_email ON Users (Email);
CREATE UNIQUE INDEX idx_user_email_workspace ON Users (Email, WorkspaceId);

CREATE TABLE Organizations (
    Id UUID PRIMARY KEY,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    WorkspaceId UUID NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Key VARCHAR(255) NOT NULL,
    Initialized BOOLEAN NOT NULL DEFAULT FALSE,
    License TEXT,
    DefaultPermissions JSONB,
    CONSTRAINT fk_workspace FOREIGN KEY (WorkspaceId) REFERENCES Workspaces(Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_organization_workspace_key ON Organizations (WorkspaceId, Key);

CREATE TABLE OrganizationUsers (
    Id UUID PRIMARY KEY,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    OrganizationId UUID NOT NULL,
    UserId UUID NOT NULL,
    InvitorId UUID,
    InitialPassword TEXT,
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT fk_invitor FOREIGN KEY (InvitorId) REFERENCES Users(Id) ON DELETE SET NULL
);

CREATE INDEX idx_organizationuser_organization ON OrganizationUsers (OrganizationId);
CREATE INDEX idx_organizationuser_user ON OrganizationUsers (UserId);
CREATE UNIQUE INDEX idx_organizationuser_organization_user ON OrganizationUsers (OrganizationId, UserId);

CREATE TABLE Projects (
    Id UUID PRIMARY KEY,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    OrganizationId UUID NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Key VARCHAR(255) NOT NULL,
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE
);

CREATE INDEX idx_project_organization ON Projects (OrganizationId);
CREATE UNIQUE INDEX idx_project_organization_key ON Projects (OrganizationId, Key);

CREATE TABLE Environments (
    Id UUID PRIMARY KEY,
    CreatedAt TIMESTAMP NOT NULL,
    UpdatedAt TIMESTAMP NOT NULL,
    ProjectId UUID NOT NULL,
    Name VARCHAR(255) NOT NULL,
    Key VARCHAR(255) NOT NULL,
    Description TEXT,
    Secrets JSONB,
    Settings JSONB,
    CONSTRAINT fk_project FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE CASCADE
);

CREATE INDEX idx_environment_project ON Environments (ProjectId);
CREATE UNIQUE INDEX idx_environment_project_key ON Environments (ProjectId, Key);

CREATE TABLE EndUsers (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    WorkspaceId UUID,                   -- Foreign key to Workspace (nullable)
    EnvId UUID,                         -- Foreign key to Environment (nullable)
    KeyId VARCHAR(255) NOT NULL,        -- End user key
    Name VARCHAR(255) NOT NULL,         -- End user name
    CustomizedProperties JSONB,         -- Customized properties stored as JSONB
    CONSTRAINT fk_workspace FOREIGN KEY (WorkspaceId) REFERENCES Workspaces(Id) ON DELETE SET NULL,
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE SET NULL
);

CREATE INDEX idx_enduser_env ON EndUsers (EnvId);
CREATE INDEX idx_enduser_workspace ON EndUsers (WorkspaceId);
CREATE INDEX idx_enduser_created ON EndUsers (CreatedAt);
CREATE INDEX idx_enduser_updated ON EndUsers (UpdatedAt);

CREATE TABLE EndUserProperties (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    EnvId UUID NOT NULL,                -- Foreign key to Environment
    Name VARCHAR(255) NOT NULL,         -- Property name
    PresetValues JSONB,                 -- Preset values stored as JSONB
    UsePresetValuesOnly BOOLEAN NOT NULL,  -- Whether to use preset values only
    IsBuiltIn BOOLEAN NOT NULL,            -- Whether it's a built-in property
    IsDigestField BOOLEAN NOT NULL,        -- Whether it's a digest field
    Remark TEXT,                        -- Optional remark
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE
);

CREATE INDEX idx_enduserproperty_env ON EndUserProperties (EnvId);

CREATE TABLE Segments (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    WorkspaceId UUID NOT NULL,          -- Foreign key to Workspace
    EnvId UUID NOT NULL,                -- Foreign key to Environment
    Name VARCHAR(255) NOT NULL,         -- Segment name
    Type VARCHAR(255) NOT NULL,         -- Segment type
    Scopes TEXT[],                      -- Array of scopes (TEXT[])
    Description TEXT,                   -- Optional description
    Included TEXT[],                    -- Array of included items (TEXT[])
    Excluded TEXT[],                    -- Array of excluded items (TEXT[])
    Rules JSONB,                        -- Match rules stored as JSONB
    IsArchived BOOLEAN NOT NULL,        -- Whether the segment is archived
    CONSTRAINT fk_workspace FOREIGN KEY (WorkspaceId) REFERENCES Workspaces(Id) ON DELETE CASCADE,
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE
);

CREATE INDEX idx_segment_workspace ON Segments (WorkspaceId);
CREATE INDEX idx_segment_env ON Segments (EnvId);

CREATE TABLE FeatureFlags (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
	CreatorId UUID NOT NULL,            -- ID of the creator (from FullAuditedEntity)
    UpdatorId UUID NOT NULL,            -- ID of the last updater (from FullAuditedEntity)
    EnvId UUID NOT NULL,                -- Foreign key to Environment
    Revision UUID NOT NULL,             -- Revision GUID
    Name VARCHAR(255) NOT NULL,         -- Feature flag name
    Description TEXT,                   -- Optional description
    Key VARCHAR(255) NOT NULL,          -- Feature flag key
    VariationType VARCHAR(255),         -- Variation type (optional)
    Variations JSONB,                   -- Variations stored as JSONB
    TargetUsers JSONB,                  -- Target users stored as JSONB
    Rules JSONB,                        -- Rules stored as JSONB
    IsEnabled BOOLEAN NOT NULL,         -- Whether the feature flag is enabled
    DisabledVariationId VARCHAR(255),   -- Disabled variation ID (optional)
    Fallthrough JSONB,                  -- Fallthrough logic stored as JSONB
    ExptIncludeAllTargets BOOLEAN NOT NULL,  -- Whether to include all targets in the experiment
    Tags TEXT[],                        -- Tags for categorizing feature flags
    IsArchived BOOLEAN NOT NULL,        -- Whether the feature flag is archived
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE
);

CREATE INDEX idx_featureflag_env ON FeatureFlags (EnvId);
CREATE UNIQUE INDEX idx_featureflag_env_key ON FeatureFlags (EnvId, Key);

CREATE TABLE FlagRevisions (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    Flag JSONB,                         -- Feature flag details stored as JSONB
    Comment TEXT                        -- Comment for the revision
);

CREATE TABLE FlagDrafts (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    CreatorId UUID NOT NULL,            -- ID of the creator (from FullAuditedEntity)
    UpdatorId UUID NOT NULL,            -- ID of the last updater (from FullAuditedEntity)
	EnvId UUID NOT NULL,                -- Foreign key to Environment
    FlagId UUID NOT NULL,               -- Foreign key to FeatureFlag
    Status VARCHAR(255) NOT NULL,       -- Draft status (e.g., 'pending', 'approved')
    Comment TEXT,                       -- Optional comment
    DataChange JSONB,                   -- Data change stored as JSONB
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE,
    CONSTRAINT fk_flag FOREIGN KEY (FlagId) REFERENCES FeatureFlags(Id) ON DELETE CASCADE
);

CREATE INDEX idx_flagdraft_env ON FlagDrafts (EnvId);
CREATE INDEX idx_flagdraft_flag ON FlagDrafts (FlagId);

CREATE TABLE Triggers (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    TargetId UUID NOT NULL,             -- ID of the target (foreign key can be added if needed)
    Type VARCHAR(255) NOT NULL,         -- Type of the trigger (e.g., event type)
    Action VARCHAR(255) NOT NULL,       -- Action to be taken (e.g., 'create', 'update')
    Token VARCHAR(255),                 -- Token associated with the trigger (optional)
    Description TEXT,                   -- Description of the trigger (optional)
    IsEnabled BOOLEAN NOT NULL,         -- Whether the trigger is enabled or not
    TriggeredTimes INT DEFAULT 0,       -- The number of times the trigger has been activated
    LastTriggeredAt TIMESTAMP,          -- Timestamp of the last time the trigger was activated (nullable)
    CONSTRAINT fk_target FOREIGN KEY (TargetId) REFERENCES FeatureFlags(Id) ON DELETE CASCADE
);

CREATE INDEX idx_trigger_targetid ON Triggers (TargetId);

CREATE TABLE AuditLogs (
    Id UUID PRIMARY KEY,                -- Primary key
    EnvId UUID NOT NULL,                -- Foreign key to Environment
    RefId VARCHAR(255) NOT NULL,        -- Reference ID related to the operation
    RefType VARCHAR(255) NOT NULL,      -- Type of the reference (e.g., entity type)
    Keyword VARCHAR(255),               -- Keyword for searching/filtering
    Operation VARCHAR(255) NOT NULL,    -- The operation performed (e.g., create, update, delete)
    DataChange JSONB,                   -- JSONB column to store the changes
    Comment TEXT,                       -- Optional comment about the operation
    CreatorId UUID NOT NULL,            -- ID of the user who created the audit log
    CreatedAt TIMESTAMP NOT NULL,       -- Timestamp of when the log was created
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE,
    CONSTRAINT fk_creator FOREIGN KEY (CreatorId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX idx_auditlog_envid ON AuditLogs (EnvId);
CREATE INDEX idx_auditlog_creatorid ON AuditLogs (CreatorId);
CREATE INDEX idx_auditlog_refid ON AuditLogs (RefId);
CREATE INDEX idx_auditlog_reftype ON AuditLogs (RefType);

CREATE TABLE Groups (
    Id UUID PRIMARY KEY,               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,      -- Audit field: UpdatedAt
    OrganizationId UUID NOT NULL,      -- Foreign key to Organization
    Name VARCHAR(255) NOT NULL,        -- Name of the group
    Description TEXT,                  -- Description of the group (optional)
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE
);

CREATE INDEX idx_group_org ON Groups (OrganizationId);

CREATE TABLE Policies (
    Id UUID PRIMARY KEY,               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,      -- Audit field: UpdatedAt
    OrganizationId UUID,               -- Foreign key to Organization (nullable)
    Name VARCHAR(255) NOT NULL,        -- Name of the policy
    Description TEXT,                  -- Description of the policy (optional)
    Type VARCHAR(255) NOT NULL,        -- Type of the policy
    Statements JSONB,                  -- JSONB column to store policy statements
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE SET NULL
);

CREATE INDEX idx_policy_org ON Policies (OrganizationId);

CREATE TABLE GroupMembers (
    Id UUID PRIMARY KEY,               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,      -- Audit field: UpdatedAt
    GroupId UUID NOT NULL,             -- Foreign key to Group
    OrganizationId UUID NOT NULL,      -- Foreign key to Organization
    MemberId UUID NOT NULL,            -- ID of the member (could be a user or another entity)
    CONSTRAINT fk_group FOREIGN KEY (GroupId) REFERENCES Groups(Id) ON DELETE CASCADE,
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE,
    CONSTRAINT fk_member FOREIGN KEY (MemberId) REFERENCES Groups(Id) ON DELETE CASCADE
);

CREATE INDEX idx_groupmember_org ON GroupMembers (OrganizationId);
CREATE INDEX idx_groupmember_groupid ON GroupMembers (GroupId);

CREATE TABLE GroupPolicies (
    Id UUID PRIMARY KEY,               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,      -- Audit field: UpdatedAt
    GroupId UUID NOT NULL,             -- Foreign key to Group
    PolicyId UUID NOT NULL,            -- Foreign key to Policy
    CONSTRAINT fk_group FOREIGN KEY (GroupId) REFERENCES Groups(Id) ON DELETE CASCADE,
    CONSTRAINT fk_policy FOREIGN KEY (PolicyId) REFERENCES Policies(Id) ON DELETE CASCADE
);

CREATE INDEX idx_grouppolicy_groupid ON GroupPolicies (GroupId);

CREATE TABLE MemberPolicies (
    Id UUID PRIMARY KEY,               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,      -- Audit field: UpdatedAt
    OrganizationId UUID NOT NULL,      -- Foreign key to Organization
    MemberId UUID NOT NULL,            -- Foreign key to Member (assumed to be in "User" table)
    PolicyId UUID NOT NULL,            -- Foreign key to Policy
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE,
    CONSTRAINT fk_member FOREIGN KEY (MemberId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT fk_policy FOREIGN KEY (PolicyId) REFERENCES Policies(Id) ON DELETE CASCADE
);

CREATE INDEX idx_memberpolicy_org ON MemberPolicies (OrganizationId);
CREATE INDEX idx_memberpolicy_memberid ON MemberPolicies (MemberId);

CREATE TABLE ExperimentMetrics (
    Id UUID PRIMARY KEY,                             -- Primary key
    CreatedAt TIMESTAMP NOT NULL,                    -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,                    -- Audit field: UpdatedAt
    EnvId UUID NOT NULL,                             -- Foreign key to Environment
    Name VARCHAR(255) NOT NULL,                       -- Name of the experiment metric
    Description TEXT,                                -- Description of the experiment metric
    MaintainerUserId UUID NOT NULL,                  -- Foreign key to User (maintainer)
    EventName VARCHAR(255),                          -- Name of the event
    EventType INT NOT NULL,                          -- Enum value for EventType
    CustomEventTrackOption INT NOT NULL,             -- Enum value for CustomEventTrackOption
    CustomEventUnit VARCHAR(255),                    -- Unit for the custom event
    CustomEventSuccessCriteria INT NOT NULL,         -- Enum value for CustomEventSuccessCriteria
    ElementTargets TEXT,                             -- Targets for the event element
    TargetUrls JSONB,                                -- JSONB column to store target URLs
    IsArvhived BOOLEAN NOT NULL,                     -- Whether the metric is archived
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE,
    CONSTRAINT fk_maintainer_user FOREIGN KEY (MaintainerUserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX idx_experimentmetric_env ON ExperimentMetrics (EnvId);
-- Enum definitions
CREATE TYPE event_type AS ENUM ('Custom', 'PageView', 'Click');
CREATE TYPE custom_event_track_option AS ENUM ('Undefined', 'Conversion', 'Numeric');
CREATE TYPE custom_event_success_criteria AS ENUM ('Undefined', 'Higher', 'Lower');

CREATE TABLE Experiments (
    Id UUID PRIMARY KEY,               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,      -- Audit field: UpdatedAt
    EnvId UUID NOT NULL,               -- Foreign key to Environment
    MetricId UUID NOT NULL,            -- Foreign key to Metric (assumed to exist)
    FeatureFlagId UUID NOT NULL,       -- Foreign key to FeatureFlag
    IsArchived BOOLEAN NOT NULL,       -- Indicates if the experiment is archived
    Status VARCHAR(255) NOT NULL,      -- Status of the experiment (e.g., NotStarted, NotRecording, Recording)
    BaselineVariationId VARCHAR(255),  -- ID of the baseline variation (optional)
    Iterations JSONB,                  -- JSONB column to store iterations
    Alpha DOUBLE PRECISION,            -- Alpha value for the experiment (optional)
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE,
    CONSTRAINT fk_metric FOREIGN KEY (MetricId) REFERENCES ExperimentMetrics(Id) ON DELETE CASCADE,
    CONSTRAINT fk_feature_flag FOREIGN KEY (FeatureFlagId) REFERENCES FeatureFlags(Id) ON DELETE CASCADE
);

CREATE INDEX idx_experiment_env ON Experiments (EnvId);
CREATE INDEX idx_experiment_flag ON Experiments (FeatureFlagId);

CREATE TABLE AccessTokens (
    Id UUID PRIMARY KEY,                               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,                      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,                      -- Audit field: UpdatedAt
    OrganizationId UUID NOT NULL,                      -- Foreign key to Organization
    Name VARCHAR(255) NOT NULL,                         -- Name of the access token
    Type VARCHAR(255) NOT NULL,                         -- Type of the access token
    Status VARCHAR(255) NOT NULL,                       -- Status of the access token
    Token TEXT NOT NULL,                               -- The token itself
    CreatorId UUID NOT NULL,                           -- Foreign key to User (creator)
    Permissions JSONB,                                 -- JSONB column for permissions
    LastUsedAt TIMESTAMP,                              -- Last used timestamp (optional)
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE,
    CONSTRAINT fk_creator FOREIGN KEY (CreatorId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX idx_accesstoken_org ON AccessTokens (OrganizationId);

CREATE TABLE RelayProxies (
    Id UUID PRIMARY KEY,                               -- Primary key
    CreatedAt TIMESTAMP NOT NULL,                      -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,                      -- Audit field: UpdatedAt
    OrganizationId UUID NOT NULL,                      -- Foreign key to Organization
    Name VARCHAR(255) NOT NULL,                         -- Name of the relay proxy
    Key VARCHAR(255) NOT NULL,                          -- Key for the relay proxy
    Description TEXT,                                  -- Description of the relay proxy
    IsAllEnvs BOOLEAN NOT NULL,                        -- Flag indicating if it applies to all environments
    Scopes JSONB,                                      -- JSONB column for scopes
    Agents JSONB,                                      -- JSONB column for agents
    CONSTRAINT fk_organization FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id) ON DELETE CASCADE
);

CREATE INDEX idx_relayproxy_org ON RelayProxies (OrganizationId);

CREATE TABLE Webhooks (
    Id UUID PRIMARY KEY,                                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,                       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,                       -- Audit field: UpdatedAt
    CreatorId UUID NOT NULL,                            -- Foreign key to User (creator)
    UpdatorId UUID NOT NULL,                            -- Foreign key to User (updator)
    OrgId UUID NOT NULL,                                -- Foreign key to Organization
    Name VARCHAR(255) NOT NULL,                          -- Name of the webhook
    Url TEXT NOT NULL,                                  -- URL to send the webhook to
    Scopes TEXT[],                                      -- Array of scopes for the webhook
    Events TEXT[],                                      -- Array of events the webhook listens for
    Headers JSONB,                                      -- JSONB column for headers (key-value pairs)
    PayloadTemplateType VARCHAR(255),                   -- Type of the payload template
    PayloadTemplate TEXT,                               -- The actual payload template
    Secret TEXT,                                        -- Secret associated with the webhook
    IsActive BOOLEAN NOT NULL,                          -- Boolean flag indicating if the webhook is active
    PreventEmptyPayloads BOOLEAN NOT NULL,              -- Prevent empty payloads flag
    LastDelivery JSONB,                                 -- JSONB column for the last delivery information
    CONSTRAINT fk_organization FOREIGN KEY (OrgId) REFERENCES Organizations(Id) ON DELETE CASCADE,
    CONSTRAINT fk_creator FOREIGN KEY (CreatorId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT fk_updator FOREIGN KEY (UpdatorId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX idx_webhook_org ON Webhooks (OrgId);

CREATE TABLE WebhookDeliveries (
    Id UUID PRIMARY KEY,                                -- Primary key
    WebhookId UUID NOT NULL,                            -- Foreign key to Webhook
    Success BOOLEAN NOT NULL,                           -- Indicates whether the delivery was successful
    Events TEXT,                                        -- The events associated with the delivery
    Request JSONB,                                      -- JSONB column for request details
    Response JSONB,                                     -- JSONB column for response details
    Error JSONB,                                        -- JSONB column for error details
    StartedAt TIMESTAMP NOT NULL,                       -- The timestamp when the delivery started
    EndedAt TIMESTAMP NOT NULL,                         -- The timestamp when the delivery ended
    CONSTRAINT fk_webhook FOREIGN KEY (WebhookId) REFERENCES Webhooks(Id) ON DELETE CASCADE
);

CREATE INDEX idx_webhook_webhookid ON WebhookDeliveries (WebhookId);

CREATE TABLE FlagSchedules (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    CreatorId UUID NOT NULL,            -- ID of the creator (from FullAuditedEntity)
    UpdatorId UUID NOT NULL,            -- ID of the last updater (from FullAuditedEntity)
    OrgId UUID NOT NULL,                -- Foreign key to Organization
    EnvId UUID NOT NULL,                -- Foreign key to Environment
    FlagDraftId UUID NOT NULL,          -- Foreign key to FlagDraft
    FlagId UUID NOT NULL,               -- Foreign key to FeatureFlag
    Status VARCHAR(255) NOT NULL,       -- Status of the flag schedule
    Title VARCHAR(255) NOT NULL,        -- Title of the flag schedule
    ScheduledTime TIMESTAMP NOT NULL,   -- Scheduled time for the action
    ChangeRequestId UUID,               -- Optional foreign key for ChangeRequest
    CONSTRAINT fk_org FOREIGN KEY (OrgId) REFERENCES Organizations(Id) ON DELETE CASCADE,
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE,
    CONSTRAINT fk_flagdraft FOREIGN KEY (FlagDraftId) REFERENCES FlagDrafts(Id) ON DELETE CASCADE,
    CONSTRAINT fk_flag FOREIGN KEY (FlagId) REFERENCES FeatureFlags(Id) ON DELETE CASCADE
);

CREATE INDEX idx_flagschedule_org ON FlagSchedules (OrgId);
CREATE INDEX idx_flagschedule_env ON FlagSchedules (EnvId);
CREATE INDEX idx_flagschedule_flag ON FlagSchedules (FlagId);
CREATE INDEX idx_flagschedule_changerequestid ON FlagSchedules (ChangeRequestId);

CREATE TABLE FlagChangeRequests (
    Id UUID PRIMARY KEY,                -- Primary key
    CreatedAt TIMESTAMP NOT NULL,       -- Audit field: CreatedAt
    UpdatedAt TIMESTAMP NOT NULL,       -- Audit field: UpdatedAt
    CreatorId UUID NOT NULL,            -- ID of the creator (from FullAuditedEntity)
    UpdatorId UUID NOT NULL,            -- ID of the last updater (from FullAuditedEntity)
    OrgId UUID NOT NULL,                -- Foreign key to Organization
    EnvId UUID NOT NULL,                -- Foreign key to Environment
    FlagDraftId UUID NOT NULL,          -- Foreign key to FlagDraft
    FlagId UUID NOT NULL,               -- Foreign key to FeatureFlag
    Status VARCHAR(255) NOT NULL,       -- Status of the change request
    Reason TEXT,                        -- Reason for the change request
    Reviewers JSONB,                    -- List of reviewers stored as JSONB
    ScheduleId UUID,                    -- Optional foreign key to FlagSchedule
    CONSTRAINT fk_org FOREIGN KEY (OrgId) REFERENCES Organizations(Id) ON DELETE CASCADE,
    CONSTRAINT fk_env FOREIGN KEY (EnvId) REFERENCES Environments(Id) ON DELETE CASCADE,
    CONSTRAINT fk_flagdraft FOREIGN KEY (FlagDraftId) REFERENCES FlagDrafts(Id) ON DELETE CASCADE,
    CONSTRAINT fk_flag FOREIGN KEY (FlagId) REFERENCES FeatureFlags(Id) ON DELETE CASCADE
);

CREATE INDEX idx_flagchangerequest_org ON FlagChangeRequests (OrgId);
CREATE INDEX idx_flagchangerequest_env ON FlagChangeRequests (EnvId);
CREATE INDEX idx_flagchangerequest_flag ON FlagChangeRequests (FlagId);
CREATE INDEX idx_flagchangerequest_schedule ON FlagChangeRequests (ScheduleId);

ALTER TABLE FlagSchedules
ADD CONSTRAINT fk_change_request FOREIGN KEY (ChangeRequestId)
REFERENCES FlagChangeRequests(Id) ON DELETE SET NULL;

ALTER TABLE FlagChangeRequests
ADD CONSTRAINT fk_schedule  FOREIGN KEY (ScheduleId)
REFERENCES FlagSchedules(Id) ON DELETE SET NULL;