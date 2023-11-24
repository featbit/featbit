import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Webhook, WebhookEvents } from "@features/safe/integrations/webhooks/webhooks";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { uuidv4 } from "@utils/index";

@Component({
  selector: 'webhook-drawer',
  templateUrl: './webhook-drawer.component.html',
  styleUrls: ['./webhook-drawer.component.less']
})
export class WebhookDrawerComponent {

  title: string = '';

  // the webhook form
  form: FormGroup<{
    id: FormControl<string>;
    name: FormControl<string>;
    url: FormControl<string>;
    events: FormArray;
    headers: FormArray;
    payloadTemplate: FormControl<string>;
    secret: FormControl<string>;
    isActive: FormControl<boolean>;
  }>;

  constructor(private fb: FormBuilder) {
    this.initForm();
  }

  private _visible: boolean = false;
  get visible(): boolean {
    return this._visible;
  }

  @Input()
  set visible(visible: boolean) {
    this._visible = visible;
    if (visible) {
      this.initForm();
    }
  }

  private initForm() {
    this.form = new FormGroup({
      id: new FormControl(this._webhook?.id),
      name: new FormControl(this._webhook?.name, [Validators.required]),
      url: new FormControl(this._webhook?.url),
      events: this.constructEventsFormArray(this._webhook?.events),
      headers: this.constructHeaderFormArray(this._webhook?.headers),
      payloadTemplate: new FormControl(this._webhook?.payloadTemplate),
      secret: new FormControl(this._webhook?.secret),
      isActive: new FormControl(this._webhook?.isActive)
    });
  }

  get events() {
    return this.form.get('events') as FormArray;
  }

  get headers() {
    return this.form.get('headers') as FormArray;
  }

  addHeader() {
    const formGroup = new FormGroup({
      name: new FormControl(''),
      value: new FormControl('')
    });

    this.headers.push(formGroup);
  }

  removeHeader(index: number) {
    this.headers.removeAt(index);
  }

  private constructEventsFormArray(events: string[]): FormArray {
    let groupedEvents = WebhookEvents.reduce((acc, event) => {
      let value = {
        group: event.group,
        label: event.label,
        value: event.value,
        checked: events?.includes(event.value) ?? false
      };

      if (!acc[event.group]) {
        acc[event.group] = [];
      }

      acc[event.group].push(value);
      return acc;
    }, {});

    let formGroups = Object.keys(groupedEvents).map(group => {
      let events = groupedEvents[group];
      let checkedCount = events.filter(e => e.checked).length;

      return new FormGroup({
        group: new FormGroup({
          label: new FormControl(group),
          indeterminate: new FormControl(checkedCount > 0 && checkedCount < events.length),
          checked: new FormControl(checkedCount === events.length)
        }),
        events: new FormControl(groupedEvents[group])
      });
    });

    const formArray = this.fb.array(formGroups)
    formArray.controls.forEach(control => {
      let eventsControl = control.get('events');
      let checkAllControl = control.get('group.checked');
      let indeterminateControl = control.get('group.indeterminate');

      checkAllControl.valueChanges.subscribe(checked => {
        indeterminateControl.setValue(false);
        eventsControl.setValue(eventsControl.value.map(event => ({ ...event, checked })), { emitEvent: false });
      });

      eventsControl.valueChanges.subscribe(events => {
        if (events.every(event => event.checked === true)) {
          indeterminateControl.setValue(false);
          checkAllControl.setValue(true, { emitEvent: false });
        } else if (events.some(event => event.checked === true)) {
          indeterminateControl.setValue(true);
          checkAllControl.setValue(false, { emitEvent: false });
        } else {
          indeterminateControl.setValue(false);
          checkAllControl.setValue(false, { emitEvent: false });
        }
      });
    });

    return formArray;
  }

  private _webhook: Webhook;
  @Input()
  set webhook(webhook: Webhook) {
    this.title = webhook
      ? $localize`:@@integrations.webhooks.webhook-drawer.edit-title:Edit Webhook`
      : $localize`:@@integrations.webhooks.webhook-drawer.add-title:Add Webhook`;

    if (webhook) {
      this._webhook = webhook;
    } else {
      this._webhook = {
        id: uuidv4(),
        name: '',
        url: '',
        secret: '',
        events: ['feature_flag.delete'],
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ejt..'
        },
        payloadTemplate: `{
	"hello": 1,
	"enabled": true,
	"world": "yes"
}`,
        isActive: true,
        lastTriggeredAt: null,
        status: 'None',
        creator: ''
      };
    }
  }

  @Output()
  close: EventEmitter<void> = new EventEmitter();

  onClose() {
    this.close.emit();
  }

  private constructHeaderFormArray(headers: Record<string, string>) {
    let formGroups = Object.keys(headers ?? {}).map(name => {
      return new FormGroup({
        name: new FormControl(name),
        value: new FormControl(headers[name])
      });
    });

    return this.fb.array(formGroups);
  }

  doSubmit() {
    console.log(this.form.value);
  }
}
