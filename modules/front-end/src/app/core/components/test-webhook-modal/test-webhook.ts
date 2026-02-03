import { ISegment, SegmentType } from "@features/safe/segments/types/segments-index";
import { IFeatureFlag, VariationTypeEnum } from "@features/safe/feature-flags/types/details";
import Handlebars from 'handlebars/lib/handlebars';
import { getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";

export function getTestPayload(event: string, payloadTemplate: string): string {
  let projectEnv = getCurrentProjectEnv();
  let organization = getCurrentOrganization();

  const resourceDescriptor = {
    organization: {
      id: organization.id,
      name: organization.name
    },
    project: {
      id: projectEnv.projectId,
      name: projectEnv.projectName
    },
    environment: {
      id: projectEnv.envId,
      name: projectEnv.envName
    }
  };

  const data = Object.assign(
    {},
    {
      events: event,
      operator: 'webhook-tester',
      happenedAt: new Date().toISOString(),
      changes: [
        'test change description 1',
        'test change description 2'
      ]
    },
    { ...resourceDescriptor }
  );

  if (event.startsWith('feature_flag')) {
    Object.assign(data, { data: { kind: 'feature flag', object: testFeatureFlag } });
  } else if (event.startsWith('segment')) {
    const segmentData = Object.assign({}, { ...testSegment }, {
      flagReferences: [
        {
          id: 'eac7cb6e-9860-4d58-b1fb-82c7bf5d5025',
          name: 'Test Feature Flag',
          key: 'test'
        }
      ]
    })
    Object.assign(data, { data: { kind: 'segment', object: segmentData } });
  }

  const compiled = Handlebars.compile(payloadTemplate);
  return compiled(data);
}

const testSegment: ISegment = {
  id: '510766ab-bf7d-4a80-a601-68beced8360e',
  name: 'Test Segment',
  key: 'test-segment',
  type: SegmentType.EnvironmentSpecific,
  scopes: ['organization/organization-key:project/project-key:env/env-key'],
  tags: ['test', 'demo'],
  description: 'This is a test segment',
  rules: [
    {
      id: '3c22622e-7b8d-4f9f-96e8-f2afb92002b3',
      name: 'Test Rule',
      conditions: [
        {
          id: '27d853f6-b057-4b55-9716-d5a79bc4e087',
          property: 'name',
          op: 'eq',
          value: 'tester'
        }
      ],
      dispatchKey: ''
    }
  ],
  included: ['truthy-user'],
  excluded: ['falsy-user'],
  isArchived: false,
  updatedAt: new Date()
};

const testFeatureFlag: IFeatureFlag = {
  envId: 'de41a713-d02a-4e84-a87f-eab812942ab2',
  id: 'eac7cb6e-9860-4d58-b1fb-82c7bf5d5025',
  revision: 'c55d5bd8-7f45-4ed9-a5c1-5c6e4f2637c9',
  name: 'Test Feature Flag',
  description: 'This is a test feature flag',
  key: 'test',
  variationType: VariationTypeEnum.boolean,
  variations: [
    {
      id: '155b54a0-0fa1-400d-8f05-394022a66067',
      name: 'TRUE',
      value: 'true'
    },
    {
      id: '8f8be618-540d-47d0-85a0-c42473b86590',
      name: 'FALSE',
      value: 'false'
    }
  ],
  targetUsers: [
    {
      variationId: '155b54a0-0fa1-400d-8f05-394022a66067',
      keyIds: ['truthy-user']
    },
    {
      variationId: '8f8be618-540d-47d0-85a0-c42473b86590',
      keyIds: ['falsy-user']
    }
  ],
  rules: [
    {
      id: 'f33b0932-accb-4aff-815f-cb3985f9e526',
      name: 'Test Rule',
      dispatchKey: 'keyId',
      includedInExpt: false,
      conditions: [
        {
          id: '6a0db8aa-c976-4052-8f33-c462c7ab275f',
          property: 'name',
          op: 'eq',
          value: 'tester',
        }
      ],
      variations: [
        {
          id: '155b54a0-0fa1-400d-8f05-394022a66067',
          rollout: [0, 0.2],
          exptRollout: 1
        },
        {
          id: '8f8be618-540d-47d0-85a0-c42473b86590',
          rollout: [0.2, 0.8],
          exptRollout: 1
        }
      ]
    }
  ],
  isEnabled: true,
  disabledVariationId: '8f8be618-540d-47d0-85a0-c42473b86590',
  fallthrough: {
    dispatchKey: null,
    includedInExpt: true,
    variations: [
      {
        id: '155b54a0-0fa1-400d-8f05-394022a66067',
        rollout: [0, 1],
        exptRollout: 1
      }
    ],
    isNotPercentageRollout: true
  },
  exptIncludeAllTargets: true,
  tags: ['test', 'demo'],
  isArchived: false,
  updatedAt: new Date(),
  createdAt: new Date('2024-01-01'),
  creatorId: '00000000-0000-0000-0000-000000000000',
  updatorId: '00000000-0000-0000-0000-000000000000'
};
