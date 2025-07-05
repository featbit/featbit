import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RelayProxyAgent } from "@features/safe/relay-proxies/types/relay-proxy";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { urlValidator } from "@utils/form-validators";
import { uuidv4 } from "@utils/index";

@Component({
  selector: 'relay-proxy-agent-modal',
  templateUrl: './relay-proxy-agent-modal.component.html',
  styleUrls: [ './relay-proxy-agent-modal.component.less' ]
})
export class RelayProxyAgentModalComponent {
  title: string = '';
  _agent: RelayProxyAgent;

  private _visible: boolean = false;
  get visible() {
    return this._visible;
  }

  @Input()
  set visible(visible: boolean) {
    this._visible = visible;
    if (visible) {
      this.init();
    }
  }

  @Input()
  set agent(agent: RelayProxyAgent) {
    this._agent = agent;

    this.title = agent
      ? $localize`:@@relay-proxy.agent-modal.edit-title:Edit Agent`
      : $localize`:@@relay-proxy.agent-modal.add-title:Add Agent`;

    if (agent) {
      this.form.patchValue({
        name: agent.name,
        url: agent.host
      });
    }
  }

  form: FormGroup<{
    name: FormControl<string>,
    url: FormControl<string>
  }>

  constructor(private fb: FormBuilder) {
    this.init();
  }

  init() {
    this.form = this.fb.group({
      name: new FormControl<string>(this._agent?.name || '', [ Validators.required ]),
      url: new FormControl<string>(this._agent?.host || '', [ Validators.required, urlValidator ])
    });
  }

  @Output()
  onClose: EventEmitter<RelayProxyAgent | null> = new EventEmitter<RelayProxyAgent | null>();

  cancel() {
    this.onClose.emit(null);
  }

  ok() {
    const agent: RelayProxyAgent = {
      id: this._agent?.id ?? uuidv4(),
      name: this.form.value.name,
      host: this.form.value.url,
      syncAt: this._agent?.syncAt || null,
      serves: this._agent?.serves || '',
      dataVersion: this._agent?.dataVersion || 0,
      createdAt: this._agent?.createdAt || new Date(),
    };

    this.onClose.emit(agent);
  }
}
