import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('app-btn')
export class AppBtn extends LitElement {
  createRenderRoot() {
    return this; // Light DOM
  }

  @property({ type: String }) variant = ''; // '', 'primary', 'danger', 'icon'
  @property({ type: String }) text = '';
  @property({ type: String }) icon = '';
  @property({ type: Number }) iconSize = 16;
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) type = 'button';
  @property({ type: String }) title = '';

  render() {
    const classList = [
      'app-btn-inner',
      this.variant ? `btn-${this.variant}` : '',
      this.disabled ? 'btn-disabled' : ''
    ].filter(Boolean).join(' ');

    return html`
      <button 
        type="${this.type}" 
        class="${classList}"
        title="${this.title}"
        ?disabled="${this.disabled}"
      >
        ${this.icon ? html`<app-icon name="${this.icon}" size="${this.iconSize}"></app-icon>` : ''}
        ${this.text ? html`<span>${this.text}</span>` : ''}
      </button>
    `;
  }
}
