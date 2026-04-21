import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-checkout-result',
  templateUrl: './checkout-result.component.html',
  styleUrls: ['./checkout-result.component.less'],
  standalone: false
})
export class CheckoutResultComponent implements OnInit {
  isSuccess: boolean = false;
  sessionId: string = '';

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.isSuccess = this.route.snapshot.data['success'] === true;
    this.sessionId = this.route.snapshot.queryParamMap.get('session_id') || '';
  }

  goHome() {
    this.router.navigate(['/feature-flags']);
  }
}
