import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { navigate } from '../router.js';
import { formatDate } from '../dates.js';

@customElement('app-stats')
export class AppStats extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor rounds = store.rounds;
  @state() accessor activePlayer = store.activePlayer;
  @state() accessor handicapData = store.handicapData;
  @state() accessor statsSummary = store.statsSummary;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.rounds(() => {
        this.rounds = store.rounds;
        this.handicapData = store.handicapData;
        this.statsSummary = store.statsSummary;
      }),
      store.subscribe.activePlayer(val => {
        this.activePlayer = val;
        this.handicapData = store.handicapData;
        this.statsSummary = store.statsSummary;
      })
    ];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  openDrawer() {
    store.drawerOpen = true;
  }

  setPlayer(player) {
    store.activePlayer = player;
    try {
      localStorage.setItem('golf_active_player', player);
    } catch (err) {
      console.warn('Failed to save active player:', err);
    }
  }

  render() {
    const h = this.handicapData || {};
    const stats = this.statsSummary || {};
    const recent20 = h.recent20 || [];
    const usedIds = h.usedRoundIds || new Set();

    return html`
      <header>
        <div class="header-title-group">
          <app-btn variant="icon" icon="menu" .iconSize="${22}" @click="${this.openDrawer}"></app-btn>
          <h1 class="app-brand-title">Handicap & Stats</h1>

          <!-- Player Toggle -->
          <div class="player-toggle-group">
            <button 
              class="player-toggle-btn ${this.activePlayer === 'Tim' ? 'active' : ''}"
              @click="${() => this.setPlayer('Tim')}"
            >Tim</button>
            <button 
              class="player-toggle-btn ${this.activePlayer === 'Pat' ? 'active' : ''}"
              @click="${() => this.setPlayer('Pat')}"
            >Pat</button>
            <button 
              class="player-toggle-btn ${this.activePlayer === 'All' ? 'active' : ''}"
              @click="${() => this.setPlayer('All')}"
            >All</button>
          </div>
        </div>

        <app-btn variant="primary" icon="plus" text="Post Round" @click="${() => navigate('edit', 'new')}"></app-btn>
      </header>

      <main>
        <!-- WHS Handicap Index Overview Card -->
        <div class="card" style="margin-bottom: 1.5rem; background: var(--golf-light); border-color: var(--golf-border);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span style="font-size: 0.8rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: var(--golf-dark);">
                World Handicap System (WHS) &bull; ${this.activePlayer}
              </span>
              <div style="font-size: 2.5rem; font-weight: 900; color: var(--golf-dark); line-height: 1.1; margin: 0.25rem 0;">
                ${h.index !== null ? h.index.toFixed(1) : '—'}
              </div>
              <div style="font-size: 0.9rem; color: var(--golf-dark);">
                ${h.isProvisional ? 'Provisional Handicap Index (Fewer than 3 rounds recorded)' : `Official Handicap Index &bull; Lowest Differential: ${h.lowIndex !== null ? h.lowIndex.toFixed(1) : '—'}`}
              </div>
            </div>

            <div style="background: var(--card-bg); border-radius: var(--border-radius); padding: 0.75rem 1rem; border: 1px solid var(--golf-border);">
              <div style="font-size: 0.8rem; color: var(--text-muted-2); font-weight: 600;">Counting Differentials</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--golf-dark);">
                ${usedIds.size} of ${recent20.length} rounds
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                (Best ${usedIds.size} lowest of last ${recent20.length})
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Summary Grid -->
        <h3 style="margin-bottom: 0.75rem;">Performance Averages (${this.activePlayer})</h3>
        <div class="quick-stats-bar">
          <div class="quick-stat-card">
            <span class="quick-stat-label">Scoring Average</span>
            <span class="quick-stat-val">${stats.scoringAvg || '—'}</span>
            <span class="quick-stat-sub">Low: ${stats.lowScore || '—'}</span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Fairways Hit (FIR)</span>
            <span class="quick-stat-val">${stats.firPct !== null ? `${stats.firPct}%` : '—'}</span>
            <span class="quick-stat-sub">Off the tee accuracy</span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Greens in Reg (GIR)</span>
            <span class="quick-stat-val">${stats.girPct !== null ? `${stats.girPct}%` : '—'}</span>
            <span class="quick-stat-sub">Approach shot precision</span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Putts Per Round</span>
            <span class="quick-stat-val">${stats.avgPutts || '—'}</span>
            <span class="quick-stat-sub">${stats.avgPutts ? (stats.avgPutts / 18).toFixed(1) + ' per hole' : 'No data'}</span>
          </div>
        </div>

        <!-- 20-Round Handicap History Table -->
        <h3 style="margin-top: 2rem; margin-bottom: 0.75rem;">Recent 20 Rounds History (${this.activePlayer})</h3>
        ${recent20.length === 0 ? html`
          <p style="color: var(--text-muted-2);">No rounds recorded yet for ${this.activePlayer}.</p>
        ` : html`
          <div class="scorecard-table-wrapper">
            <table class="scorecard-table" style="text-align: left;">
              <thead>
                <tr>
                  <th style="text-align: center;">#</th>
                  <th>Date</th>
                  <th>Player</th>
                  <th>Course</th>
                  <th>Tees</th>
                  <th style="text-align: center;">Score</th>
                  <th style="text-align: center;">Rating / Slope</th>
                  <th style="text-align: center;">Differential</th>
                  <th style="text-align: center;">Used</th>
                </tr>
              </thead>
              <tbody>
                ${recent20.map((r, i) => {
                  const isUsed = usedIds.has(r.id);
                  const diff = Number(r.differential ?? 0).toFixed(1);
                  return html`
                    <tr style="${isUsed ? 'background: var(--diff-counting-bg); font-weight: 600;' : ''}">
                      <td style="text-align: center; color: var(--text-muted);">${i + 1}</td>
                      <td>${formatDate(r.date)}</td>
                      <td><strong>${r.player || '—'}</strong></td>
                      <td>
                        <a href="#/round/${r.id}" style="color: var(--golf-dark); text-decoration: underline;">
                          ${r.course_name}
                        </a>
                      </td>
                      <td>${r.tee_name || '—'}</td>
                      <td style="text-align: center;"><strong>${r.score}</strong></td>
                      <td style="text-align: center;">${r.course_rating || '72.0'} / ${r.slope_rating || '113'}</td>
                      <td style="text-align: center;">
                        <span class="card-diff-pill ${isUsed ? 'counting' : ''}">${diff}</span>
                      </td>
                      <td style="text-align: center;">
                        ${isUsed ? html`<span style="color: var(--golf-primary); font-size: 1.1rem;" title="Counting towards index">★</span>` : '—'}
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        `}
      </main>
    `;
  }
}
