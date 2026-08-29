import { Component, input } from '@angular/core';

@Component({
  selector: 'sci-spinner',
  standalone: true,
  template: ` <span class="ring" [style.--s]="size() + 'px'"></span> `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .ring {
        width: var(--s, 20px);
        height: var(--s, 20px);
        border-radius: 50%;
        border: 2px solid var(--sciad-brand-soft);
        border-top-color: var(--sciad-brand);
        animation: rotate 0.8s linear infinite;
      }
      @keyframes rotate {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class Spinner {
  readonly size = input<number>(20);
}
