import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { navigate } from '../router.js';

@customElement('app-feed')
export class AppFeed extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor rounds = store.rounds;
  @state() accessor activePlayer = store.activePlayer;
  @state() accessor query = store.query;
  @state() accessor handicapData = store.handicapData;
  @state() accessor statsSummary = store.statsSummary;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.rounds(val => { 
        this.rounds = val; 
        this.handicapData = store.handicapData;
        this.statsSummary = store.statsSummary;
      }),
      store.subscribe.activePlayer(val => {
        this.activePlayer = val;
        this.handicapData = store.handicapData;
        this.statsSummary = store.statsSummary;
      }),
      store.subscribe.query(val => { this.query = val; })
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

  handleSearchInput(e) {
    store.query = e.target.value;
  }

  getFilteredRounds() {
    let list = [...this.rounds];

    // Filter by active player if not 'All'
    if (this.activePlayer && this.activePlayer !== 'All') {
      list = list.filter(r => (r.player || '').toLowerCase() === this.activePlayer.toLowerCase());
    }

    list.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

    if (!this.query.trim()) return list;

    const q = this.query.toLowerCase();
    return list.filter(r => 
      r.course_name?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q) ||
      r.tee_name?.toLowerCase().includes(q) ||
      r.player?.toLowerCase().includes(q) ||
      r.date?.includes(q)
    );
  }

  render() {
    const filteredRounds = this.getFilteredRounds();
    const hData = this.handicapData || {};
    const stats = this.statsSummary || {};
    const usedIds = hData.usedRoundIds || new Set();

    return html`
      <header>
        <div class="header-title-group">
          <app-btn variant="icon" icon="menu" .iconSize="${22}" @click="${this.openDrawer}" title="Open Menu"></app-btn>
          <h1 class="app-brand-title">⛳ Golf Tracker</h1>

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

          ${hData.index !== null ? html`
            <div class="header-index-pill" title="World Handicap System Index">
              ${this.activePlayer !== 'All' ? `${this.activePlayer} ` : ''}HI: ${hData.index.toFixed(1)}
            </div>
          ` : ''}
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <app-btn variant="primary" icon="plus" text="Post Round" @click="${() => navigate('edit', 'new')}"></app-btn>
        </div>
      </header>

      <main>
        <!-- Quick stats summary bar -->
        <div class="quick-stats-bar">
          <div class="quick-stat-card">
            <span class="quick-stat-label">Handicap Index (${this.activePlayer})</span>
            <span class="quick-stat-val">
              ${hData.index !== null ? hData.index.toFixed(1) : '—'}
            </span>
            <span class="quick-stat-sub">
              ${hData.numRounds ? `Based on ${hData.numRounds} round${hData.numRounds > 1 ? 's' : ''}` : 'Enter 3+ rounds'}
            </span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Scoring Average</span>
            <span class="quick-stat-val">
              ${stats.scoringAvg ? stats.scoringAvg : '—'}
            </span>
            <span class="quick-stat-sub">Low: ${stats.lowScore || '—'}</span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Best Differential</span>
            <span class="quick-stat-val">
              ${stats.bestDiff ? stats.bestDiff : '—'}
            </span>
            <span class="quick-stat-sub">Best of all recorded rounds</span>
          </div>

          <div class="quick-stat-card">
            <span class="quick-stat-label">Total Rounds (${this.activePlayer})</span>
            <span class="quick-stat-val">${stats.totalRounds || 0}</span>
            <span class="quick-stat-sub">Putts Avg: ${stats.avgPutts || '—'}</span>
          </div>
        </div>

        <!-- Search bar -->
        <div class="feed-search-bar">
          <app-icon name="search" size="20" style="margin: 0 0.5rem; color: var(--text-muted);"></app-icon>
          <input 
            type="search" 
            placeholder="Search rounds by course, date, notes..." 
            .value="${this.query}"
            @input="${this.handleSearchInput}"
          />
        </div>

        <!-- Rounds Feed Grid -->
        ${filteredRounds.length === 0 ? html`
          <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted-2);">
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">No rounds found for ${this.activePlayer}.</p>
            <app-btn variant="primary" icon="plus" text="Record Your First Round" @click="${() => navigate('edit', 'new')}"></app-btn>
          </div>
        ` : html`
          <div class="feed-cards">
            ${filteredRounds.map(r => html`
              <app-card 
                .round="${r}" 
                .isCounting="${usedIds.has(r.id)}"
              ></app-card>
            `)}
          </div>
        `}
      </main>
    `;
  }
}
