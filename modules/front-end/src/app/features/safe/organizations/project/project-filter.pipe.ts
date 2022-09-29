import {Pipe, PipeTransform} from '@angular/core';
import {IProject} from "@shared/types";

@Pipe({ name: 'projectFilter' })
export class ProjectFilterPipe implements PipeTransform {
  transform(projects: IProject[], searchValue: string): any {
    if (!projects) {
      return [];
    }

    if (!searchValue) {
      return projects;
    }

    return projects.filter(project =>
      project.name.toLowerCase().indexOf(searchValue.toLowerCase()) >= 0
    );
  }
}
