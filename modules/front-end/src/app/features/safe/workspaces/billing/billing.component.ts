import { Component } from '@angular/core';

interface Invoice {
  id: string;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
  amount: number;
  plan: string;
}

@Component({
  selector: 'billing',
  standalone: false,
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.less'
})
export class BillingComponent {

  // Current subscription (sample data)
  currentPlanName = 'Pro';
  billingCycle: 'monthly' | 'yearly' = 'monthly';
  currentMau = 30000;
  mauUsed = 7234;
  monthlyTotal = 89;
  nextBillingDate = 'May 20, 2026';
  subscriptionStartDate = 'Jan 20, 2026';
  currentBillingPeriod = 'Apr 20, 2026 – May 19, 2026';

  // Usage alert
  get mauUsagePercent(): number {
    return Math.round((this.mauUsed / this.currentMau) * 100);
  }

  get showUsageAlert(): boolean {
    return this.mauUsagePercent >= 80;
  }

  // Billing info (sample data)
  billingInfo = {
    companyName: 'Acme Corp',
    contactEmail: 'billing@acme.com',
    address: '123 Innovation Drive, San Francisco, CA 94105',
    taxId: 'US-TAX-123456789'
  };
  editingBillingInfo = false;
  billingInfoDraft = { ...this.billingInfo };

  // Invoices (sample data)
  invoices: Invoice[] = [
    { id: 'INV-2026-004', date: 'Apr 20, 2026', status: 'pending', amount: 89, plan: 'Pro' },
    { id: 'INV-2026-003', date: 'Mar 20, 2026', status: 'paid', amount: 89, plan: 'Pro' },
    { id: 'INV-2026-002', date: 'Feb 20, 2026', status: 'paid', amount: 69, plan: 'Pro' },
    { id: 'INV-2026-001', date: 'Jan 20, 2026', status: 'paid', amount: 49, plan: 'Pro' },
    { id: 'INV-2025-012', date: 'Dec 20, 2025', status: 'paid', amount: 0, plan: 'Free' },
  ];

  getInvoiceStatusColor(status: string): string {
    switch (status) {
      case 'paid':
        return 'green';
      case 'pending':
        return 'orange';
      case 'overdue':
        return 'red';
      default:
        return 'default';
    }
  }

  startEditBillingInfo(): void {
    this.billingInfoDraft = { ...this.billingInfo };
    this.editingBillingInfo = true;
  }

  saveBillingInfo(): void {
    this.billingInfo = { ...this.billingInfoDraft };
    this.editingBillingInfo = false;
  }

  cancelEditBillingInfo(): void {
    this.editingBillingInfo = false;
  }

  cancelSubscription(): void {
    // In real implementation, this would prompt confirmation and call the API
    console.log('Cancel subscription');
  }

  contactSupport(): void {
    window.open('mailto:support@featbit.co', '_blank');
  }

  pricingDrawerVisible = false;
  openPricingDrawer(): void {
    this.pricingDrawerVisible = true;
  }
  onClosePricingDrawer(): void {
    this.pricingDrawerVisible = false;
  }
}
