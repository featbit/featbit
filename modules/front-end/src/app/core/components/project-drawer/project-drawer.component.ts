import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IProject } from '@shared/types';
import { ProjectService } from '@services/project.service';
import { PermissionsService } from "@services/permissions.service";
import { ResourceTypeEnum, generalResourceRNPattern, permissionActions } from "@shared/policy";

@Component({
  selector: 'app-project-drawer',
  templateUrl: './project-drawer.component.html',
  styleUrls: ['./project-drawer.component.less']
})
export class ProjectDrawerComponent implements OnInit {

  private _project: IProject;

  projectForm: FormGroup;

  isEditing: boolean = false;

  isLoading: boolean = false;
  title: string;

  @Input()
  set project(project: IProject) {
    this.isEditing = !!project;
    if (this.isEditing) {
      this.title = $localize`:@@org.project.editProject:Edit project`;
      this.patchForm(project);
    } else {
      this.title = $localize`:@@org.project.addProject:Add project`;
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
  ) {
  }

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.projectForm = this.fb.group({
      name: [null, [Validators.required]]
    });
  }

  patchForm(project: Partial<IProject>) {
    this.projectForm.patchValue({
      name: project.name
    });
  }

  resetForm() {
    this.projectForm && this.projectForm.reset();
  }

  onClose() {
    this.close.emit({isEditing: false, project: undefined});
  }

  canTakeAction() {
    if (!this.isEditing) { // creation
      return this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.CreateProject);
    } else {
      const rn = this.permissionsService.getResourceRN(ResourceTypeEnum.Project, this.project);
      return this.permissionsService.isGranted(rn, permissionActions.UpdateProjectSettings);
    }
  }

  doSubmit() {
    if (!this.canTakeAction()) {
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

    const {name} = this.projectForm.value;

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
      this.projectService.create({ name }).subscribe({
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
