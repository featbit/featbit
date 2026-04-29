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
    // 10 fake invoices for demonstration
    // this.isLoading = false;
    // this.invoices = Array.from({ length: 10 }, (_, i) => ({
    //   id: `inv_${i + 1}`,
    //   billingDate: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
    //   plan: i % 2 === 0 ? 'Pro' : 'Basic',
    //   billingCycle: 'Monthly',
    //   status: i % 3 === 0 ? 'paid' : (i % 3 === 1 ? 'pending' : 'overdue'),
    //   currency: 'USD',
    //   amountDue: 100 + i * 10,
    //   amountPaid: i % 3 === 0 ? 100 + i * 10 : 0,
    //   amountRemaining: i % 3 === 0 ? 0 : 100 + i * 10,
    //   amountFlat: 100,
    //   amountMetered: i * 10,
    // }));
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
