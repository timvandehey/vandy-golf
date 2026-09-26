import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { navigate, back } from '../router.js';
import { formatDate } from '../dates.js';
import { formatScoreToPar, getScoreClass } from '../render-helpers.js';
import { deleteRound, getAllRounds, getDb } from '../db.js';
import { confirm } from '../dialogs.js';
import { API_DELETE_ROUND } from '../constants.js';

@customElement('app-reader')
export class AppReader extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor activeRoundId = store.activeRoundId;
  @state() accessor round = null;
  @state() accessor handicapData = store.handicapData;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.activeRoundId(id => this.loadRound(id)),
      store.subscribe.rounds(() => {
        this.loadRound(store.activeRoundId);
        this.handicapData = store.handicapData;
      })
    ];
    this.loadRound(store.activeRoundId);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  loadRound(id) {
    this.activeRoundId = id;
    if (id) {
      this.round = store.rounds.find(r => r.id === id) || null;
    } else {
      this.round = null;
    }
  }

  handleEdit() {
    if (this.round) {
      navigate('edit', this.round.id);
    }
  }

  async handleDelete() {
    if (!this.round) return;
    const confirmed = await confirm(`Delete round at ${this.round.course_name} on ${this.round.date}?`);
    if (!confirmed) return;

    try {
      const db = await getDb();
      await deleteRound(db, this.round.id);
      store.rounds = await getAllRounds(db);

      fetch(API_DELETE_ROUND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.round.id })
      }).catch(err => console.warn('Remote delete failed:', err));

      navigate('feed');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  render() {
    if (!this.round) {
      return html`
        <header>
          <div class="header-title-group">
            <app-btn variant="icon" icon="arrow-left" .iconSize="${20}" @click="${back}"></app-btn>
            <h1 class="app-brand-title">Round Details</h1>
          </div>
        </header>
        <main>
          <p style="color: var(--text-muted-2);">Round not found.</p>
        </main>
      `;
    }

    const r = this.round;
    const isCounting = this.handicapData?.usedRoundIds?.has(r.id);
    const scoreToPar = formatScoreToPar(r.score, r.par || 72);
    const diffVal = Number(r.differential ?? 0).toFixed(1);

    const holes = r.stats?.holes || [];
    const front9 = holes.slice(0, 9);
    const back9 = holes.slice(9, 18);

    return html`
      <header>
        <div class="header-title-group">
          <app-btn variant="icon" icon="arrow-left" .iconSize="${20}" @click="${() => navigate('feed')}"></app-btn>
          <div>
            <h1 class="app-brand-title">${r.course_name}</h1>
            <div style="font-size: 0.85rem; color: var(--text-muted-2);">
              ${formatDate(r.date)} &bull; ${r.tee_name ? `${r.tee_name} Tees` : ''} 
              (Rating ${r.course_rating} / Slope ${r.slope_rating})
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 0.35rem;">
          <app-btn icon="edit" text="Edit" @click="${this.handleEdit}"></app-btn>
          <app-btn variant="danger" icon="trash" @click="${this.handleDelete}"></app-btn>
        </div>
      </header>

      <main>
        <!-- Top Metrics Cards -->
        <div class="quick-stats-bar">
          <div class="quick-stat-card">
            <span class="quick-stat-label">Total Score</span>
            <span class="quick-stat-val">${r.score} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">${scoreToPar}</span></span>
            <span class="quick-stat-sub">Par ${r.par || 72}</span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Score Differential</span>
            <span class="quick-stat-val">${diffVal}</span>
            <span class="quick-stat-sub">
              ${isCounting ? '★ Counts towards Handicap Index' : 'Outside best 8 / recent 20'}
            </span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Putts</span>
            <span class="quick-stat-val">${r.stats?.putts ?? '—'}</span>
            <span class="quick-stat-sub">
              ${r.stats?.putts ? (r.stats.putts / (r.holes_played || 18)).toFixed(1) + ' per hole' : 'No putt data'}
            </span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Fairways & GIR</span>
            <span class="quick-stat-val">
              ${r.stats?.gir_hit !== undefined ? `${r.stats.gir_hit}/${r.stats.gir_total || 18}` : '—'}
            </span>
            <span class="quick-stat-sub">
              FIR: ${r.stats?.fairways_hit !== undefined ? `${r.stats.fairways_hit}/${r.stats.fairways_total || 14}` : '—'}
            </span>
          </div>
        </div>

        <!-- Hole-by-Hole Scorecard if present -->
        ${holes.length > 0 ? html`
          <h3 style="margin-top: 1.5rem; margin-bottom: 0.75rem;">Scorecard</h3>
          <div class="scorecard-table-wrapper">
            <table class="scorecard-table">
              <thead>
                <tr>
                  <th>Hole</th>
                  ${front9.map(h => html`<th class="hole-col">${h.hole}</th>`)}
                  <th class="total-col">OUT</th>
                  ${back9.map(h => html`<th class="hole-col">${h.hole}</th>`)}
                  <th class="total-col">IN</th>
                  <th class="total-col">TOT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Par</strong></td>
                  ${front9.map(h => html`<td>${h.par}</td>`)}
                  <td class="total-col">${front9.reduce((s, h) => s + (Number(h.par) || 0), 0)}</td>
                  ${back9.map(h => html`<td>${h.par}</td>`)}
                  <td class="total-col">${back9.reduce((s, h) => s + (Number(h.par) || 0), 0)}</td>
                  <td class="total-col">${holes.reduce((s, h) => s + (Number(h.par) || 0), 0)}</td>
                </tr>
                <tr>
                  <td><strong>Score</strong></td>
                  ${front9.map(h => html`<td class="${getScoreClass(h.score, h.par)}"><strong>${h.score}</strong></td>`)}
                  <td class="total-col">${front9.reduce((s, h) => s + (Number(h.score) || 0), 0)}</td>
                  ${back9.map(h => html`<td class="${getScoreClass(h.score, h.par)}"><strong>${h.score}</strong></td>`)}
                  <td class="total-col">${back9.reduce((s, h) => s + (Number(h.score) || 0), 0)}</td>
                  <td class="total-col"><strong>${r.score}</strong></td>
                </tr>
                <tr>
                  <td><strong>Putts</strong></td>
                  ${front9.map(h => html`<td>${h.putts ?? '—'}</td>`)}
                  <td class="total-col">${front9.reduce((s, h) => s + (Number(h.putts) || 0), 0)}</td>
                  ${back9.map(h => html`<td>${h.putts ?? '—'}</td>`)}
                  <td class="total-col">${back9.reduce((s, h) => s + (Number(h.putts) || 0), 0)}</td>
                  <td class="total-col">${holes.reduce((s, h) => s + (Number(h.putts) || 0), 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Notes -->
        ${r.notes ? html`
          <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Round Notes</h3>
          <div class="card" style="font-size: 0.95rem; line-height: 1.5;">
            ${r.notes}
          </div>
        ` : ''}
      </main>
    `;
  }
}
