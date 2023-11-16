import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IMenuItem } from './menu';
import { getProfile } from "@utils/index";
import { IProfile } from "@shared/types";
import { MessageQueueService } from "@services/message-queue.service";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { FeedbackService } from "@services/feedback.service";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.less']
})
export class MenuComponent implements OnInit {
  @Input() menus: IMenuItem[];
  @Input() isInitialized: boolean = true;
  @Output() logout = new EventEmitter();
  @Output() toggleMenu = new EventEmitter();
  @Input() menuExtended: boolean = true;

  profile: IProfile;
  constructor(
    private messageQueueService: MessageQueueService,
    private fb: FormBuilder,
    private message: NzMessageService,
    private feedbackService: FeedbackService
  ) {
    this.profile = getProfile();

    this.feedbackForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.messageQueueService.subscribe(this.messageQueueService.topics.USER_PROFILE_CHANGED, () => {
      this.profile = getProfile();
    });
  }
  toggleMenuMode() {
    this.menuExtended = !this.menuExtended;
    this.toggleMenu.emit(this.menuExtended);
  }

  // feedback
  feedbackModalVisible = false;
  sendingFeedback = false;
  feedbackForm: FormGroup;

  openFeedbackModal() {
    this.feedbackModalVisible = true;
    this.feedbackForm.reset();
  }

  sendFeedback() {
    if (this.feedbackForm.invalid) {
      for (const i in this.feedbackForm.controls) {
        this.feedbackForm.controls[i].markAsDirty();
        this.feedbackForm.controls[i].updateValueAndValidity();
      }
    }

    this.sendingFeedback = true;
    const {email, message} = this.feedbackForm.value;

    this.feedbackService.sendFeedback(email, message).subscribe({
      next: () => {
        this.message.success($localize`:@@common.feedback-success-message:Thank you for sending us your feedback, we'll get back to you very soon!`);
      },
      error: () => {
        this.message.error($localize`:@@common.feedback-failure-message:We were not able to send your feedback, Please try again!`);
      },
      complete: () => {
        this.sendingFeedback = false;
        this.feedbackModalVisible = false;
      }
    });
  }
}
