import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { FormsModule } from '@angular/forms';
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";

interface Environment {
  id: string;
  name: string;
  projectName: string;
  fullName: string;
}

interface DiffItem {
  label: string;
  hasDiff: boolean;
}

interface FlagTag {
  id: string;
  name: string;
  color: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  tags: string[]; // tag IDs
  diffs: { [envId: string]: DiffItem[] };
}

type SelectableTag = {
  name: string,
  selected: boolean
}

@Component({
  selector: 'compare-flags',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzSelectModule,
    NzTableModule,
    NzIconModule,
    NzToolTipModule,
    NzTagModule,
    NzInputModule,
    NzButtonModule,
    NzSpinModule,
    NzDropDownModule,
    NzCheckboxModule
  ],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.less'
})
export class CompareComponent implements OnInit {
  // Current/Source environment
  sourceEnvironment: Environment = {
    id: 'env-1',
    name: 'Development',
    projectName: 'webapp',
    fullName: 'webapp/development'
  };

  // Available target environments
  availableEnvironments: Environment[] = [
    {
      id: 'env-2',
      name: 'Staging',
      projectName: 'webapp',
      fullName: 'webapp/staging'
    },
    {
      id: 'env-3',
      name: 'Production',
      projectName: 'webapp',
      fullName: 'webapp/prod'
    },
    {
      id: 'env-4',
      name: 'Development',
      projectName: 'mobile-app',
      fullName: 'mobile-app/development'
    },
    {
      id: 'env-5',
      name: 'Production',
      projectName: 'mobile-app',
      fullName: 'mobile-app/prod'
    }
  ];

  // Selected target environment IDs
  selectedEnvironmentIds: string[] = ['env-2', 'env-3'];

  // Filter properties
  searchText: string = '';
  tagSearchText: string = '';
  selectedTagIds: string[] = [];

  // Available tags
  availableTags: SelectableTag[] = [
    { name: 'frontend', selected: false },
    { name: 'backend', selected: false },
    { name: 'mobile', selected: false },
    { name: 'experiment', selected: false },
    { name: 'release', selected: false },
    { name: 'ops', selected: false },
    { name: 'deprecated', selected: false }
  ];

  // Feature flags with mock diff data
  featureFlags: FeatureFlag[] = [];

  ngOnInit() {
    this.initializeMockData();
  }

  initializeMockData() {
    this.featureFlags = [
      {
        id: 'flag-1',
        name: 'New User Onboarding Flow',
        key: 'new-user-onboarding',
        description: 'Enable the new streamlined onboarding experience for first-time users with interactive tutorials and personalized recommendations',
        tags: ['tag-1', 'tag-4'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ]
        }
      },
      {
        id: 'flag-2',
        name: 'Dark Mode',
        key: 'dark-mode-feature',
        description: 'Toggle dark mode theme across the application',
        tags: ['tag-1', 'tag-3', 'tag-5'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-3',
        name: 'Advanced Analytics Dashboard',
        key: 'analytics-dashboard-v2',
        description: 'Enable the new analytics dashboard with real-time metrics, custom reports, and advanced data visualization capabilities for power users',
        tags: ['tag-2', 'tag-4'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-4',
        name: 'Payment Integration V3',
        key: 'payment-v3',
        description: 'New payment gateway integration',
        tags: ['tag-2', 'tag-5', 'tag-6'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ]
        }
      },
      {
        id: 'flag-5',
        name: 'Multi-language Support',
        key: 'i18n-support',
        description: 'Enable internationalization support for multiple languages including Spanish, French, German, and Japanese',
        tags: ['tag-1', 'tag-2', 'tag-3'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-6',
        name: 'Real-time Notifications',
        key: 'realtime-notifications',
        description: 'Enable real-time push notifications for user activities and system events',
        tags: ['tag-1', 'tag-2'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ]
        }
      },
      {
        id: 'flag-7',
        name: 'AI-Powered Search',
        key: 'ai-search',
        description: 'Enable AI-powered semantic search capabilities with natural language processing',
        tags: ['tag-2', 'tag-4'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-8',
        name: 'Two-Factor Authentication',
        key: '2fa-enabled',
        description: 'Require two-factor authentication for all user logins',
        tags: ['tag-2', 'tag-6'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-9',
        name: 'Beta Features Access',
        key: 'beta-features',
        description: 'Grant access to experimental beta features for selected users',
        tags: ['tag-4', 'tag-5'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: true }
          ]
        }
      },
      {
        id: 'flag-10',
        name: 'Social Login Integration',
        key: 'social-login',
        description: 'Allow users to sign in using Google, Facebook, and GitHub accounts',
        tags: ['tag-1', 'tag-5'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-11',
        name: 'Data Export Feature',
        key: 'data-export',
        description: 'Enable users to export their data in CSV, JSON, and Excel formats',
        tags: ['tag-1', 'tag-6'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ]
        }
      },
      {
        id: 'flag-12',
        name: 'Advanced Caching Layer',
        key: 'advanced-caching',
        description: 'Enable Redis-based distributed caching for improved performance',
        tags: ['tag-2', 'tag-6'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-13',
        name: 'Custom Branding',
        key: 'custom-branding',
        description: 'Allow enterprise customers to customize logos, colors, and themes',
        tags: ['tag-1', 'tag-3'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      },
      {
        id: 'flag-14',
        name: 'Webhook Integrations',
        key: 'webhooks',
        description: 'Enable webhook notifications for third-party integrations',
        tags: ['tag-2', 'tag-5'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ]
        }
      },
      {
        id: 'flag-15',
        name: 'Rate Limiting',
        key: 'rate-limiting',
        description: 'Apply API rate limiting to prevent abuse and ensure fair usage',
        tags: ['tag-2', 'tag-6', 'tag-7'],
        diffs: {
          'env-2': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: true },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-3': [
            { label: 'ON/OFF state', hasDiff: true },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ],
          'env-4': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: false },
            { label: 'Targeting rules', hasDiff: false },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: true }
          ],
          'env-5': [
            { label: 'ON/OFF state', hasDiff: false },
            { label: 'Individual targeting', hasDiff: true },
            { label: 'Targeting rules', hasDiff: true },
            { label: 'Default rule', hasDiff: false },
            { label: 'Off variation', hasDiff: false }
          ]
        }
      }
    ];
  }

  get selectedEnvironments(): Environment[] {
    return this.availableEnvironments.filter(env =>
      this.selectedEnvironmentIds.includes(env.id)
    );
  }

  get filteredTags(): SelectableTag[] {
    if (!this.tagSearchText) {
      return this.availableTags;
    }
    const searchLower = this.tagSearchText.toLowerCase();
    return this.availableTags.filter(tag =>
      tag.name.toLowerCase().includes(searchLower)
    );
  }

  getSelectedTagsLabel(): string {
    const selectedTags = this.availableTags.filter(tag => tag.selected);
    if (selectedTags.length === 0) {
      return 'any';
    }

    if (selectedTags.length === 1) {
      return selectedTags[0].name;
    }
    return `${selectedTags.length} selected`;
  }

  get filteredFeatureFlags(): FeatureFlag[] {
    return this.featureFlags.filter(flag => {
      // Filter by search text (name or key)
      const matchesSearch = !this.searchText ||
        flag.name.toLowerCase().includes(this.searchText.toLowerCase()) ||
        flag.key.toLowerCase().includes(this.searchText.toLowerCase());

      // Filter by tags
      const matchesTags = this.selectedTagIds.length === 0 ||
        this.selectedTagIds.some(tagId => flag.tags.includes(tagId));

      return matchesSearch && matchesTags;
    });
  }

  truncateText(text: string, maxLength: number = 80): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  getDiffForEnvironment(flag: FeatureFlag, envId: string): DiffItem[] {
    return flag.diffs[envId] || [];
  }

  hasDifferences(flag: FeatureFlag, envId: string): boolean {
    const diffs = this.getDiffForEnvironment(flag, envId);
    return diffs.some(diff => diff.hasDiff);
  }

  getDiffCountForFlag(flag: FeatureFlag, envId: string): number {
    const diffs = this.getDiffForEnvironment(flag, envId);
    return diffs.filter(diff => diff.hasDiff).length;
  }

  onSelectTags(visible: boolean) {
    if (visible === false) {
      this.selectedTagIds = this.availableTags
        .filter(tag => tag.selected)
        .map(tag => tag.name);
    }
  }
}
