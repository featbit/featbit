import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { FeatureFlagService } from "@services/feature-flag.service";
import { slugify, uuidv4 } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { NzMessageService } from "ng-zorro-antd/message";
import { BehaviorSubject } from "rxjs";
import {
  IFeatureFlagListFilter,
  IFeatureFlagListItem,
  IFeatureFlagListModel
} from "@features/safe/feature-flags/types/switch-index";
import { GET_STARTED } from "@utils/localstorage-keys";

@Component({
  selector: 'create-feature-flag',
  templateUrl: './create-feature-flag.component.html',
  styleUrls: ['./create-feature-flag.component.less']
})
export class CreateFeatureFlagComponent implements OnInit{

  public compareWith: (obj1: any, obj2: any) => boolean = (obj1: any, obj2: any) => {
    if (obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  @Input() flag: IFeatureFlag;
  @Output() onComplete = new EventEmitter<IFeatureFlag>();

  variationTypeBoolean = 'boolean';
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private featureFlagService: FeatureFlagService,
    private message: NzMessageService,
  ) {
    this.featureFlagSearchChange$.pipe(
      debounceTime(500)
    ).subscribe(query => {
      this.isFeatureFlagsLoading = true;
      this.featureFlagService.getList(new IFeatureFlagListFilter(query)).subscribe({
        next: (result) => {
          const find = result.items.find((f) => f.name === query || f.key === query);
          if (query?.length > 0 && !find) {
            const newF: IFeatureFlagListItem = {
              id: uuidv4(),
              name: query,
              key: slugify(query),
              variationType: 'boolean',

              isNew: true
            } as IFeatureFlagListItem;

            this.featureFlagList = {
              totalCount: result.totalCount,
              items: [
                ...result.items,
                newF
              ]
            };
          } else {
            this.featureFlagList = result;
          }
        },
        complete: () => {
          if (!this.isFlagListInitialized) {
            this.isCreatingFlag = this.featureFlagList.totalCount === 0;
          }

          this.isFlagListInitialized = true;
          this.isFeatureFlagsLoading = false;
        }
      });
    });
  }

  isCreatingFlag: boolean = false;

  isFlagListInitialized: boolean = false;

  get showCreationForm() {
    return this.isFlagListInitialized && this.isCreatingFlag;
  }

  get isNextEnabled() {
    return this.isFlagListInitialized && (this.flag || this.form.valid);
  }

  ngOnInit() {
    localStorage.setItem(GET_STARTED(), 'true');

    let name: string = '';
    let key: string = '';
    let description: string = '';

    if (this.flag) {
      name = this.flag.name;
      key = this.flag.key;
      description = this.flag.description;
    }

    this.form = this.fb.group({
      name: [name, Validators.required],
      key: [key, Validators.required, this.flagKeyAsyncValidator],
      description:[description,Validators.maxLength(512)]
    });
  }

  patchForm() {
    const { name, key, description } = { ...this.flag };

    this.form.patchValue({
      name,
      key,
      description
    });
  }

  isFeatureFlagsLoading = false;
  featureFlagSearchChange$ = new BehaviorSubject('');
  featureFlagList: IFeatureFlagListModel;

  onSearchFeatureFlag(query: string) {
    if (query.length > 0) {
      this.featureFlagSearchChange$.next(query);
    }
  }

  onFeatureFlagChange(data: IFeatureFlagListItem) {
    const flag = { ...data } as any as IFeatureFlag;
    this.isCreatingFlag = data.isNew;
    this.flag = flag;

    if (this.isCreatingFlag) {
      this.patchForm();
    }
  }

  flagKeyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.featureFlagService.isKeyUsed(value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
        case true:
          return { error: true, duplicated: true };
        case undefined:
          return { error: true, unknown: true };
        default:
          return null;
      }
    }),
    first()
  );

  onNameChange(name: string) {
    let keyControl = this.form.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  next() {
    if (this.isCreatingFlag) {
      this.featureFlagService.create(this.form.value).subscribe({
        next: (result: IFeatureFlag) => {
          this.onComplete.emit(result);
        },
        error: (err) => {
          this.message.error(err.error);
        }
      });
    } else {
      this.onComplete.emit(this.flag);
    }
  }
}
