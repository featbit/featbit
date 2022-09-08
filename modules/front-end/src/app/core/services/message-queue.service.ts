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
    POLICY_CHANGED: (key: string) => `policy_changed:${key}`
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
