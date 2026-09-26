import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { navigate } from '../router.js';

@customElement('app-drawer')
export class AppDrawer extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor open = store.drawerOpen;
  @state() accessor view = store.view;
  @state() accessor userEmail = store.userEmail;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.drawerOpen(val => { this.open = val; }),
      store.subscribe.view(val => { this.view = val; }),
      store.subscribe.userEmail(val => { this.userEmail = val; })
    ];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  closeDrawer() {
    store.drawerOpen = false;
  }

  handleNav(e, targetView) {
    e.preventDefault();
    this.closeDrawer();
    navigate(targetView);
  }

  render() {
    return html`
      <div 
        class="drawer-backdrop ${this.open ? 'active' : ''}"
        @click="${this.closeDrawer}"
      ></div>

      <aside class="drawer-panel ${this.open ? 'active' : ''}">
        <div class="drawer-header">
          <h2 class="drawer-title">⛳ Golf Tracker</h2>
          <app-btn variant="icon" icon="close" .iconSize="${20}" @click="${this.closeDrawer}"></app-btn>
        </div>

        <nav class="drawer-nav">
          <a 
            href="#/feed" 
            class="drawer-nav-item ${this.view === 'feed' ? 'active' : ''}"
            @click="${e => this.handleNav(e, 'feed')}"
          >
            <app-icon name="flag" size="18"></app-icon>
            <span>Rounds Feed</span>
          </a>

          <a 
            href="#/edit/new" 
            class="drawer-nav-item ${this.view === 'edit' && !store.activeRoundId ? 'active' : ''}"
            @click="${e => this.handleNav(e, 'edit')}"
          >
            <app-icon name="plus" size="18"></app-icon>
            <span>Post New Round</span>
          </a>

          <a 
            href="#/stats" 
            class="drawer-nav-item ${this.view === 'stats' ? 'active' : ''}"
            @click="${e => this.handleNav(e, 'stats')}"
          >
            <app-icon name="chart" size="18"></app-icon>
            <span>Handicap & Stats</span>
          </a>

          <a 
            href="#/courses" 
            class="drawer-nav-item ${this.view === 'courses' ? 'active' : ''}"
            @click="${e => this.handleNav(e, 'courses')}"
          >
            <app-icon name="map-pin" size="18"></app-icon>
            <span>Courses & Tees</span>
          </a>

          <a 
            href="#/settings" 
            class="drawer-nav-item ${this.view === 'settings' ? 'active' : ''}"
            @click="${e => this.handleNav(e, 'settings')}"
          >
            <app-icon name="settings" size="18"></app-icon>
            <span>Settings & Sync</span>
          </a>
        </nav>
      </aside>
    `;
  }
}
