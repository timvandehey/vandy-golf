import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { store } from '../store.js';
import { navigate } from '../router.js';
import { formatDate } from '../dates.js';
import { formatScoreToPar } from '../render-helpers.js';
import { deleteRound, getAllRounds, getDb } from '../db.js';
import { confirm } from '../dialogs.js';
import { API_DELETE_ROUND } from '../constants.js';

@customElement('app-card')
export class AppCard extends LitElement {
  createRenderRoot() {
    return this;
  }

  @property({ type: Object }) round = {};
  @property({ type: Boolean }) isCounting = false;

  handleView(e) {
    e.preventDefault();
    navigate('round', this.round.id);
  }

  handleEdit(e) {
    e.stopPropagation();
    navigate('edit', this.round.id);
  }

  async handleDelete(e) {
    e.stopPropagation();
    const confirmed = await confirm(`Delete round at ${this.round.course_name} on ${this.round.date}?`);
    if (!confirmed) return;

    try {
      const db = await getDb();
      await deleteRound(db, this.round.id);
      store.rounds = await getAllRounds(db);

      // Best effort remote delete
      fetch(API_DELETE_ROUND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.round.id })
      }).catch(err => console.warn('Remote round delete failed:', err));

    } catch (err) {
      console.error('Delete round failed:', err);
    }
  }

  render() {
    const r = this.round;
    const diffVal = Number(r.differential ?? 0).toFixed(1);
    const scoreToPar = formatScoreToPar(r.score, r.par || 72);

    return html`
      <div class="card">
        <div class="card-header">
          <div>
            <a href="#/round/${r.id}" class="card-course-title" @click="${this.handleView}">
              ${r.course_name || 'Golf Round'}
            </a>
            <div class="card-meta-subtitle">
              ${formatDate(r.date)} &bull; ${r.player ? `${r.player} &bull; ` : ''}${r.tee_name ? `${r.tee_name} Tees` : ''} 
              (${r.course_rating || 72.0} / ${r.slope_rating || 113})
            </div>
          </div>

          <div class="card-score-badge-group">
            <div class="card-score-value">
              ${r.score} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">${scoreToPar}</span>
            </div>
            <div class="card-diff-pill ${this.isCounting ? 'counting' : ''}" title="${this.isCounting ? 'Counts towards current Handicap Index' : 'Score Differential'}">
              Diff: ${diffVal} ${this.isCounting ? '★' : ''}
            </div>
          </div>
        </div>

        <!-- Key stats row -->
        <div class="card-stats-row">
          ${r.stats?.putts ? html`
            <div class="stat-pill">Putts: <strong>${r.stats.putts}</strong></div>
          ` : ''}

          ${r.stats?.fairways_hit !== undefined && r.stats?.fairways_total ? html`
            <div class="stat-pill">FIR: <strong>${r.stats.fairways_hit}/${r.stats.fairways_total}</strong></div>
          ` : ''}

          ${r.stats?.gir_hit !== undefined && r.stats?.gir_total ? html`
            <div class="stat-pill">GIR: <strong>${r.stats.gir_hit}/${r.stats.gir_total}</strong></div>
          ` : ''}

          ${r.stats?.penalties !== undefined && r.stats?.penalties > 0 ? html`
            <div class="stat-pill">Penalties: <strong>${r.stats.penalties}</strong></div>
          ` : ''}
        </div>

        ${r.notes ? html`<p class="card-notes">"${r.notes}"</p>` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 0.35rem; margin-top: auto; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
          <app-btn variant="icon" icon="edit" title="Edit Round" @click="${this.handleEdit}"></app-btn>
          <app-btn variant="icon" icon="trash" title="Delete Round" @click="${this.handleDelete}"></app-btn>
        </div>
      </div>
    `;
  }
}
