export enum ChangeOperation {
  ChangeStatus = 'ChangeStatus',
  ChangeName = 'ChangeName',
  ChangeDescription = 'ChangeDescription',
  ChangeVariations = 'ChangeVariations',
  ChangeOffVariation = 'ChangeOffVariation',
  AddTag = 'AddTag',
  RemoveTag = 'RemoveTag',
  Archive = 'Archive',
  Restore = 'Restore',
  Delete = 'Delete',
  ChangeTargeting = 'ChangeTargeting',
}

export interface ChangeCommentData {
  resourceType: 'flag' | 'segment';
  resourceKey: string;
  operation: ChangeOperation;
}

export const OperationDescriptions: Record<ChangeOperation, string> = {
  [ChangeOperation.ChangeStatus]: `You're going to toggle the status of the {type}.`,
  [ChangeOperation.ChangeName]: `You're going to change the name of the {type}.`,
  [ChangeOperation.ChangeDescription]: `You're going to change the description of the {type}.`,
  [ChangeOperation.ChangeVariations]: `You're going to change the variations of the {type}.`,
  [ChangeOperation.ChangeOffVariation]: `You're going to change the off variation of the {type}.`,
  [ChangeOperation.AddTag]: `You're going to add a tag to the {type}.`,
  [ChangeOperation.RemoveTag]: `You're going to remove a tag from the {type}.`,
  [ChangeOperation.Archive]: `You're going to archive the {type}.`,
  [ChangeOperation.Restore]: `You're going to restore the {type}.`,
  [ChangeOperation.Delete]: `You're going to permanently delete the {type}.`,
  [ChangeOperation.ChangeTargeting]: `You're going to change the targeting rules of the {type}.`,
};
