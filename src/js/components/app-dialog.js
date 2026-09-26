import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';

@customElement('app-dialog')
export class AppDialog extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor open = store.dialogOpen;
  @state() accessor type = store.dialogType;
  @state() accessor message = store.dialogMessage;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.dialogOpen(val => { this.open = val; }),
      store.subscribe.dialogType(val => { this.type = val; }),
      store.subscribe.dialogMessage(val => { this.message = val; })
    ];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  handleConfirm() {
    if (store.dialogResolve) {
      store.dialogResolve(true);
    }
    this.close();
  }

  handleCancel() {
    if (store.dialogResolve) {
      store.dialogResolve(false);
    }
    this.close();
  }

  close() {
    store.dialogOpen = false;
    store.dialogResolve = null;
  }

  render() {
    if (!this.open) return html``;

    return html`
      <div class="dialog-backdrop" @click="${this.handleCancel}">
        <div class="dialog-box" @click="${e => e.stopPropagation()}">
          <h3 class="dialog-header">${this.type === 'confirm' ? 'Confirm Action' : 'Notice'}</h3>
          <p class="dialog-body">${this.message}</p>
          <div class="dialog-actions">
            ${this.type === 'confirm' ? html`
              <app-btn text="Cancel" @click="${this.handleCancel}"></app-btn>
              <app-btn variant="primary" text="Confirm" @click="${this.handleConfirm}"></app-btn>
            ` : html`
              <app-btn variant="primary" text="OK" @click="${this.handleConfirm}"></app-btn>
            `}
          </div>
        </div>
      </div>
    `;
  }
}
