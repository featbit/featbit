import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IProject } from '@shared/types';
import { ProjectService } from '@services/project.service';
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { slugify } from "@utils/index";

@Component({
  selector: 'app-project-drawer',
  templateUrl: './project-drawer.component.html',
  styleUrls: ['./project-drawer.component.less']
})
export class ProjectDrawerComponent {

  private _project: IProject;

  projectForm: FormGroup;

  isEditing: boolean = false;

  isLoading: boolean = false;
  title: string;

  @Input()
  set project(project: IProject) {
    this.isEditing = project && !!project.id;
    if (this.isEditing) {
      this.title = $localize`:@@org.project.editProject:Edit project`;
      this.initForm(true);
      this.patchForm(project);
    } else {
      this.title = $localize`:@@org.project.addProject:Add project`;
      this.initForm(false);
      this.resetForm();
    }
    this._project = project;
  }

  get project() {
    return this._project;
  }

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  permissionDenyMsg = this.permissionsService.genericDenyMessage;

  constructor(
    private fb: FormBuilder,
    private projectService: ProjectService,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) { }

  initForm(isKeyDisabled: boolean) {
    this.projectForm = this.fb.group({
      name: [null, [Validators.required]],
      key: [{disabled: isKeyDisabled, value: null}, Validators.required, this.keyAsyncValidator],
    });

    this.projectForm.get('name').valueChanges.subscribe((newName) => {
      this.nameChange(newName);
    })
  }

  nameChange(name: string) {
    if (this.isEditing) return;

    let keyControl = this.projectForm.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  keyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.projectService.isKeyUsed(value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
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

  patchForm(project: Partial<IProject>) {
    this.projectForm.patchValue({
      name: project.name,
      key: project.key
    });
  }

  resetForm() {
    this.projectForm && this.projectForm.reset();
  }

  onClose() {
    this.close.emit();
  }

  isGranted() {
    if (!this.isEditing) { // creation
      return this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.CreateProject);
    } else {
      const rn = this.permissionsService.getProjectRN(this.project);
      return this.permissionsService.isGranted(rn, permissionActions.UpdateProjectSettings);
    }
  }

  doSubmit() {
    if (!this.isGranted()) {
      return this.message.warning(this.permissionsService.genericDenyMessage);
    }

    if (this.projectForm.invalid) {
      for (const i in this.projectForm.controls) {
        this.projectForm.controls[i].markAsDirty();
        this.projectForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isLoading = true;

    const { name, key } = this.projectForm.value;

    if (this.isEditing) {
      this.projectService.update(this.project.id, { name }).subscribe({
        next: updatedProject => {
          this.isLoading = false;
          this.close.emit({isEditing: true, project: updatedProject});
          this.message.success($localize`:@@org.project.projectUpdateSuccess:Project successfully updated`);
        },
        error: _ => {
          this.isLoading = false;
        }
      });
    } else {
      this.projectService.create({ name, key }).subscribe({
        next: createdProject => {
          this.isLoading = false;
          this.close.emit({isEditing: false, project: createdProject});
          this.message.success($localize`:@@org.project.projectCreateSuccess:Project successfully created`);
        },
        error: _ => {
          this.isLoading = false;
        }
      });
    }
  }
}
