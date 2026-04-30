import { Component, inject, OnInit } from '@angular/core';
import { BillingService } from "@services/billing.service";
import { NzMessageService } from 'ng-zorro-antd/message';
import { InvoiceItem } from '../types';

@Component({
  selector: 'invoices',
  standalone: false,
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.less'
})
export class InvoicesComponent implements OnInit {
  billingService = inject(BillingService);
  message = inject(NzMessageService);

  invoices: InvoiceItem[] = [];
  isLoading: boolean = true;

  ngOnInit() {
    this.billingService.getInvoices().subscribe({
      next: (invoices) => {
        this.invoices = invoices;
        this.isLoading = false;
      },
      error: () => {
        this.message.error('Failed to load invoices');
        this.isLoading = false;
      }
    });
  }

  getInvoiceStatusLabel(status: string): string {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'pending':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  }
}
