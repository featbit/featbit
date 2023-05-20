import { Injectable } from '@angular/core';

interface Events {
  [key: string]: Function[];
}

@Injectable({
  providedIn: 'root'
})
export class MessageQueueService {
  topics = {
    FLAG_SETTING_CHANGED: (key: string) => `flag_setting_changed:${key}`,
    FLAG_TARGETING_CHANGED: (key: string) => `flag_targeting_changed:${key}`,
    SEGMENT_SETTING_CHANGED: (id: string) => `segment_setting_changed:${id}`,
    SEGMENT_TARGETING_CHANGED: (id: string) => `segment_targeting_changed:${id}`,
    POLICY_CHANGED: (key: string) => `policy_changed:${key}`,
    CURRENT_ORG_PROJECT_ENV_CHANGED: 'current_org_project_env_changed',
    CURRENT_ENV_SECRETS_CHANGED: 'current_env_secrets_changed',
    PROJECT_LIST_CHANGED: 'project_list_changed',
    USER_PROFILE_CHANGED: 'user_profile_changed',
  };

  public events: Events;
  constructor() {
    this.events = {};
  }

  public subscribe(name: string, cb: Function) {
    (this.events[name] || (this.events[name] = [])).push(cb);

    return {
      unsubscribe: () =>
        this.events[name] && this.events[name].splice(this.events[name].indexOf(cb) >>> 0, 1)
    };
  }

  public emit(name: string, ...args: any[]): void {
    (this.events[name] || []).forEach(fn => fn(...args));
  }
}
