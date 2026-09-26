import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';

@customElement('app-home')
export class AppHome extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor view = store.view;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.view(val => { this.view = val; })
    ];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  renderActiveView() {
    switch (this.view) {
      case 'feed':
        return html`<app-feed></app-feed>`;
      case 'round':
        return html`<app-reader></app-reader>`;
      case 'edit':
        return html`<app-editor></app-editor>`;
      case 'stats':
        return html`<app-stats></app-stats>`;
      case 'courses':
        return html`<app-courses></app-courses>`;
      case 'settings':
        return html`<app-settings></app-settings>`;
      default:
        return html`<app-feed></app-feed>`;
    }
  }

  render() {
    return html`
      ${this.renderActiveView()}

      <!-- Global Navigation Drawer -->
      <app-drawer></app-drawer>

      <!-- Global Dialog Modal -->
      <app-dialog></app-dialog>

      <!-- Footer -->
      <footer>
        &copy; 2026 Golf Tracker &bull; Local-First WHS Handicap & Rounds
      </footer>
    `;
  }
}
