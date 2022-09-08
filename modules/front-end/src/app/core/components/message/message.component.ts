import {Component, Input} from "@angular/core";

@Component({
  selector: 'message',
  templateUrl: './message.component.html',
  styleUrls: ['./message.component.less']
})
export class MessageComponent {
  @Input() type: string = 'warning'
  @Input() content: string = '';
}
