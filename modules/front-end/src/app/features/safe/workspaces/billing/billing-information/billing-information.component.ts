import { Component, inject, OnInit } from "@angular/core";
import { BillingService } from "src/app/core/services/billing.service";
import { BillingInformation } from "@features/safe/workspaces/billing/types";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'billing-information',
  templateUrl: './billing-information.component.html',
  styleUrl: './billing-information.component.less',
  standalone: false
})
export class BillingInformationComponent implements OnInit {
  billingService = inject(BillingService);
  message = inject(NzMessageService);

  isLoading: boolean = true;

  raw: BillingInformation;
  draft: BillingInformation;

  isEditing: boolean = false;

  ngOnInit() {
    this.billingService.getBillingInformation().subscribe({
      next: info => {
        this.raw = { ...info };
        // a separate draft for editing
        this.draft = { ...info };
        this.isLoading = false;
      },
      error: () => this.message.error('Failed to load billing information. Please try again later.'),
    });
  }

  startEdit() {
    this.isEditing = true;
  }

  cancel() {
    // reset draft to original data
    this.draft = { ...this.raw };
    this.isEditing = false;
  }

  isSaving: boolean = false;
  save() {
    this.isSaving = true;
    this.billingService.updateBillingInformation(this.draft).subscribe({
      next: () => {
        this.message.success('Billing information updated successfully.');
        this.raw = { ...this.draft };
        this.isEditing = false;
        this.isSaving = false;
      },
      error: () => {
        this.message.error('Failed to update billing information. Please try again later.');
        this.isEditing = false;
        this.isSaving = false;
      }
    });
  }
}
