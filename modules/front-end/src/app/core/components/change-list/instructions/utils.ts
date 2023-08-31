import { firstValueFrom } from "rxjs";
import { SegmentService } from "@services/segment.service";
import { ICondition } from "@shared/rules";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { IInstructionCondition } from "@core/components/change-list/instructions/types";
import { isSegmentCondition } from "@utils/index";
import { findIndex, ruleOps } from "@core/components/find-rule/ruleConfig";

export const getSegmentRefs = async (segmentService: SegmentService, segmentIds: string[]) => {
  if (segmentIds.length === 0) {
    return {};
  }

  const segments = await firstValueFrom(segmentService.getByIds(segmentIds));

  return segments.reduce((acc, cur) => {
    acc[cur.id] = cur;
    return acc;
  }, {});
}

export const mapToIInstructionCondition = (condition: ICondition, segmentRefs: { [key: string]: ISegment }): IInstructionCondition => {
  const isSegment = isSegmentCondition(condition.property);

  if (!isSegment) {
    const ruleOpIdx = findIndex(condition.op);
    const isMultiValue = ruleOps[ruleOpIdx].type === 'multi';
    return {
      property: condition.property,
      op: condition.op,
      opLabel: ruleOps[ruleOpIdx].label,
      displayValue: !['IsTrue', 'IsFalse'].includes(condition.op),
      value: isMultiValue ? JSON.parse(condition.value) : condition.value,
      isMultiValue
    }
  } else {
    return {
      property: condition.property,
      op: null,
      displayValue: !['IsTrue', 'IsFalse'].includes(condition.op),
      value: JSON.parse(condition.value).map((segmentId) => segmentRefs[segmentId]?.name ?? segmentId),
      isMultiValue: true
    }
  }
};
