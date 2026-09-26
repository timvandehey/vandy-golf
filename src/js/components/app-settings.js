import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { getDb, getAllRounds, getAllCourses, putRound, putCourse } from '../db.js';
import { performSync } from '../sync.js';
import { alert, confirm } from '../dialogs.js';

@customElement('app-settings')
export class AppSettings extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor syncStatus = store.syncStatus;
  @state() accessor syncLogs = store.syncLogs;
  @state() accessor userEmail = store.userEmail;
  @state() accessor isOnline = store.isOnline;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.syncStatus(val => { this.syncStatus = val; }),
      store.subscribe.syncLogs(val => { this.syncLogs = val; }),
      store.subscribe.userEmail(val => { this.userEmail = val; }),
      store.subscribe.isOnline(val => { this.isOnline = val; })
    ];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  openDrawer() {
    store.drawerOpen = true;
  }

  async handleManualSync() {
    try {
      const db = await getDb();
      await performSync(db, true);
      alert('Manual sync completed successfully!');
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  }

  async handleExportJson() {
    const db = await getDb();
    const [rounds, courses] = await Promise.all([
      getAllRounds(db),
      getAllCourses(db)
    ]);

    const backupData = {
      exportDate: new Date().toISOString(),
      rounds,
      courses
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `golf-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async handleImportJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = await confirm('Importing backup will merge or overwrite existing rounds and courses. Proceed?');
    if (!confirmed) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const db = await getDb();
      let importedRounds = 0;
      let importedCourses = 0;

      if (Array.isArray(data.rounds)) {
        for (const r of data.rounds) {
          await putRound(db, r);
          importedRounds++;
        }
      }

      if (Array.isArray(data.courses)) {
        for (const c of data.courses) {
          await putCourse(db, c);
          importedCourses++;
        }
      }

      store.rounds = await getAllRounds(db);
      store.courses = await getAllCourses(db);

      alert(`Backup restored successfully: ${importedRounds} rounds and ${importedCourses} courses loaded.`);
    } catch (err) {
      alert('Failed to parse backup JSON: ' + err.message);
    } finally {
      e.target.value = '';
    }
  }

  render() {
    return html`
      <header>
        <div class="header-title-group">
          <app-btn variant="icon" icon="menu" .iconSize="${22}" @click="${this.openDrawer}"></app-btn>
          <h1 class="app-brand-title">Settings & Synchronization</h1>
        </div>
      </header>

      <main>
        <!-- Account Info -->
        <div class="card" style="margin-bottom: 1rem;">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem;">User Account</h3>
          <p style="margin: 0; color: var(--text-muted-2);">
            Logged in as: <strong>${this.userEmail || 'Local Developer (No Zero Trust auth)'}</strong>
          </p>
          <p style="margin: 0.25rem 0 0 0; color: var(--text-muted-2);">
            Network status: <strong>${this.isOnline ? 'Online (Connected)' : 'Offline'}</strong>
          </p>
        </div>

        <!-- Sync Control -->
        <div class="card" style="margin-bottom: 1rem;">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem;">Database Synchronization</h3>
          <p style="margin: 0 0 1rem 0; color: var(--text-muted-2); font-size: 0.9rem;">
            Rounds and courses are saved locally in IndexedDB and delta-synced with Cloudflare D1 / Headless SQLite servers.
          </p>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <app-btn variant="primary" icon="refresh" text="Force Full Resync" @click="${this.handleManualSync}"></app-btn>
            <span style="font-size: 0.85rem; color: var(--text-muted-2);">
              Status: <strong>${this.syncStatus}</strong>
            </span>
          </div>
        </div>

        <!-- Backup & Restore -->
        <div class="card" style="margin-bottom: 1rem;">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem;">Backup & Export Data</h3>
          <p style="margin: 0 0 1rem 0; color: var(--text-muted-2); font-size: 0.9rem;">
            Export your entire round history and course catalog to JSON or restore from a previous backup file.
          </p>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
            <app-btn text="Export Backup JSON" @click="${this.handleExportJson}"></app-btn>

            <label class="app-btn-file-wrapper" style="display: inline-flex; cursor: pointer;">
              <input type="file" accept=".json" @change="${this.handleImportJson}" style="display: none;" />
              <button type="button" class="app-btn-inner" style="pointer-events: none;">Restore From JSON</button>
            </label>
          </div>
        </div>

        <!-- Sync Logs -->
        <div class="card">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem;">Sync Activity Logs</h3>
          <div style="background: var(--hover-bg); border-radius: var(--border-radius); padding: 0.75rem; font-family: monospace; font-size: 0.8rem; max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.25rem;">
            ${this.syncLogs.length === 0 ? html`
              <span style="color: var(--text-muted);">No sync events recorded yet.</span>
            ` : this.syncLogs.map(log => html`
              <div>${log}</div>
            `)}
          </div>
        </div>
      </main>
    `;
  }
}
