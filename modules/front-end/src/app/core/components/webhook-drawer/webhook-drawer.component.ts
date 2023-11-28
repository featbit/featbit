import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Webhook, WebhookEvents } from "@features/safe/integrations/webhooks/webhooks";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { trimJsonString, uuidv4 } from "@utils/index";
import { jsonValidator, urlValidator } from "@utils/form-validators";

import { editor } from 'monaco-editor';
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
declare const monaco: any;

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
      url: new FormControl(this._webhook?.url, [Validators.required, urlValidator]),
      events: this.constructEventsFormArray(this._webhook?.events),
      headers: this.constructHeaderFormArray(this._webhook?.headers),
      payloadTemplate: new FormControl(this._webhook?.payloadTemplate, [jsonValidator]),
      secret: new FormControl(this._webhook?.secret),
      isActive: new FormControl(this._webhook?.isActive)
    });
  }

  editor?: editor.IStandaloneCodeEditor;
  onEditorInit(e: editor.IStandaloneCodeEditor): void {
    this.editor = e;

    function createDependencyProposals(range) {
      // returning a static list of proposals, not even looking at the prefix (filtering is done by the Monaco editor),
      // here you could do a server side lookup
      return [
        {
          label: '"@@flag.name"',
          kind: monaco.languages.CompletionItemKind.Variable,
          documentation: "The name of the feature flag",
          insertText: '@@flag.name',
          range: range
        },
        {
          label: '"@@flag.description"',
          kind: monaco.languages.CompletionItemKind.Variable,
          documentation: "The description of the feature flag",
          insertText: '@@flag.description',
          range: range
        }
      ];
    }

    monaco.languages.registerCompletionItemProvider("json", {
      provideCompletionItems: function (model, position) {
        // Get the text before the cursor
        const word = model.getWordUntilPosition(position);

        const idx = word.word.lastIndexOf('@');
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn + Math.max(0, idx),
          endColumn: word.endColumn,
        };

        return { suggestions: createDependencyProposals(range) };
      },

      triggerCharacters: ['@']
    });
  }

  get events() {
    return this.form.get('events') as FormArray;
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

    const eventsValidator = (control: FormArray) => {
      let events = control.value?.flatMap(group => group.events);
      if (events?.some(event => event.checked === true)) {
        return null;
      }

      return { error: true };
    }

    const formArray = this.fb.array(formGroups, [eventsValidator]);
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

  get headers() {
    return this.form.get('headers') as FormArray;
  }

  addHeader() {
    const formGroup = new FormGroup({
      key: new FormControl(''),
      value: new FormControl('')
    });

    this.headers.push(formGroup);
  }

  removeHeader(index: number) {
    this.headers.removeAt(index);
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
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json'
          },
          {
            key: 'Authorization',
            value: 'Bearer <token>..'
          }
        ],
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

  private constructHeaderFormArray(headers: { key: string; value: string; }[]) {
    let formGroups = (headers ?? [{ key: '', value: '' }]).map(header => {
      return new FormGroup({
        key: new FormControl(header.key),
        value: new FormControl(header.value)
      });
    });

    return this.fb.array(formGroups);
  }

  doSubmit() {
    console.log(this.form.value);

    const { name, url, events, headers, payloadTemplate, secret, isActive } = this.form.value;

    const payload = {
      name,
      url,
      events: events.flatMap(group => group.events.filter(event => event.checked).map(event => event.value)),
      headers: headers.reduce((acc, header) => {
        acc[header.name] = header.value;
        return acc;
      }, {}),
      payloadTemplate: trimJsonString(payloadTemplate),
      secret,
      isActive
    };

    console.log(payload);
  }
}
