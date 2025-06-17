import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RelayProxy, RelayProxyScope } from "@features/safe/relay-proxies/types/relay-proxy";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { SegmentType } from "@features/safe/segments/types/segments-index";
import { ResourceSpaceLevel, ResourceTypeEnum, ResourceV2 } from "@shared/policy";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { RelayProxyService } from "@services/relay-proxy.service";

@Component({
  selector: 'relay-proxy-modal',
  templateUrl: './relay-proxy-modal.component.html',
  styleUrls: [ './relay-proxy-modal.component.less' ]
})
export class RelayProxyModalComponent {
  title: string = '';
  operation: 'Edit' | 'Add' = 'Add';
  _rp: RelayProxy | undefined;

  constructor(
    private fb: FormBuilder,
    private rpService: RelayProxyService
  ) {
    this.init();
  }

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
  set rp(rp: RelayProxy | undefined) {
    this.title = rp
      ? $localize`:@@relay-proxy.modal.edit-title:Edit Relay Proxy`
      : $localize`:@@relay-proxy.modal.add-title:Add Relay Proxy`;

    this._rp = rp;
    this.operation = rp ? 'Edit' : 'Add';
  }

  init() {
    this.form = new FormGroup({
      name: new FormControl<string>(this._rp?.name, [Validators.required], [this.nameAsyncValidator]),
      description: new FormControl<string>(this._rp?.description),
      scopes: this.constructScopesFormArray(this._rp?.scopes || [])
    });
  }

  @Output()
  onClose: EventEmitter<RelayProxy | null> = new EventEmitter<RelayProxy | null>();

  form: FormGroup<{
    name: FormControl<string>,
    description: FormControl<string>,
    scopes: FormArray<FormControl<string>>
  }>;

  nameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.rpService.isNameUsed(value as string)),
    map(isNameUsed => {
      switch (isNameUsed) {
        case true:
          return {error: true, duplicated: true};
        case undefined:
          return {error: true, unknown: true};
        default:
          return null;
      }
    }),
    first()
  );

  constructScopesFormArray(scopes: RelayProxyScope[]): FormArray<FormControl<string>> {
    const controls: FormControl<string>[] = !scopes
      ? []
      : scopes.flatMap(scope => scope.envIds.map(envId => new FormControl<string>(envId)));

    const scopesValidator = (control: FormArray) => {
      let scopes = control.value ?? [];
      if (scopes.length > 0) {
        return null;
      }

      return { error: true };
    }

    return this.fb.array(controls, [ scopesValidator ]);
  }

  selectedScopes: string[] = [];
  get scopes() {
    return this.form.get('scopes') as FormArray;
  }

  removeScope(index: number) {
    this.scopes.removeAt(index);
  }

  resourceFinderVisible = false;
  openResourceFinder() {
    this.resourceFinderVisible = true;
  }

  closeResourceFinder(resources: ResourceV2[]) {
    this.scopes.clear();
    for (const resource of resources) {
      this.scopes.push(new FormControl<string>(resource.pathName));
    }

    this.selectedScopes = resources.map(resource => resource.id);

    this.resourceFinderVisible = false;
  }

  saving: boolean = false;
  save() {
    console.log('Saving Relay Proxy:', this.form.value);
    console.log(this.selectedScopes);
    console.log('Clicked save');
  }

  close(rp: RelayProxy | null) {
    this.onClose.emit(rp);
  }

  protected readonly SegmentType = SegmentType;
  protected readonly ResourceSpaceLevel = ResourceSpaceLevel;
  protected readonly ResourceTypeEnum = ResourceTypeEnum;
}
