import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { navigate, back } from '../router.js';
import { calculateDifferential } from '../handicap.js';
import { getDb, putRound, getAllRounds } from '../db.js';
import { API_SAVE_ROUND, DEFAULT_ROUND_TEMPLATE } from '../constants.js';

@customElement('app-editor')
export class AppEditor extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor activeRoundId = store.activeRoundId;
  @state() accessor courses = store.courses;
  @state() accessor rounds = store.rounds;
  @state() accessor round = { ...DEFAULT_ROUND_TEMPLATE };
  @state() accessor showHoles = false;

  isDirty = false;
  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.activeRoundId(id => this.loadRound(id)),
      store.subscribe.courses(c => { this.courses = c; }),
      store.subscribe.rounds(r => { this.rounds = r; })
    ];
    this.loadRound(store.activeRoundId);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  getSortedCourses() {
    const rounds = this.rounds || store.rounds || [];
    const player = this.round?.player || store.activePlayer;

    const courseLastPlayed = new Map();
    for (const r of rounds) {
      if (!r.date) continue;
      const isPlayerMatch = !player || player === 'All' || (r.player || '').toLowerCase() === player.toLowerCase();
      const courseKey = r.course_id || r.course_name;
      if (courseKey) {
        const existing = courseLastPlayed.get(courseKey);
        if (!existing || (isPlayerMatch && !existing.forPlayer) || (r.date > existing.lastDate)) {
          courseLastPlayed.set(courseKey, { lastDate: r.date, forPlayer: isPlayerMatch });
        }
      }
    }

    return [...this.courses].sort((a, b) => {
      const entryA = courseLastPlayed.get(a.id) || courseLastPlayed.get(a.name);
      const entryB = courseLastPlayed.get(b.id) || courseLastPlayed.get(b.name);
      const lastA = entryA?.lastDate || '';
      const lastB = entryB?.lastDate || '';

      if (lastA && lastB) {
        return lastB.localeCompare(lastA);
      }
      if (lastA) return -1;
      if (lastB) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  getSortedTees(course) {
    if (!course || !course.tees) return [];
    const rounds = this.rounds || store.rounds || [];
    const player = this.round?.player || store.activePlayer;

    // Filter tees strictly by active player if player is set (and not 'All')
    let candidateTees = course.tees;
    if (player && player !== 'All') {
      const filtered = course.tees.filter(t => {
        if (t.player) {
          return t.player.toLowerCase() === player.toLowerCase();
        }
        return rounds.some(r => 
          (r.course_id === course.id || r.course_name === course.name) &&
          r.tee_name === t.name &&
          (r.player || '').toLowerCase() === player.toLowerCase()
        );
      });
      if (filtered.length > 0) {
        candidateTees = filtered;
      }
    }

    const teeLastPlayed = new Map();
    for (const r of rounds) {
      if ((r.course_id === course.id || r.course_name === course.name) && r.tee_name && r.date) {
        const isPlayerMatch = !player || player === 'All' || (r.player || '').toLowerCase() === player.toLowerCase();
        const existing = teeLastPlayed.get(r.tee_name);
        if (!existing || (isPlayerMatch && !existing.forPlayer) || (r.date > existing.lastDate)) {
          teeLastPlayed.set(r.tee_name, { lastDate: r.date, forPlayer: isPlayerMatch });
        }
      }
    }

    return [...candidateTees].sort((a, b) => {
      const lastA = teeLastPlayed.get(a.name)?.lastDate || '';
      const lastB = teeLastPlayed.get(b.name)?.lastDate || '';

      if (lastA && lastB) {
        return lastB.localeCompare(lastA);
      }
      if (lastA) return -1;
      if (lastB) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  handlePlayerChange(player) {
    this.isDirty = true;
    this.round.player = player;
    if (this.round.stats) {
      this.round.stats.player = player;
    }
    const course = this.courses.find(c => c.id === this.round.course_id);
    if (course) {
      const sortedTees = this.getSortedTees(course);
      if (sortedTees && sortedTees.length > 0) {
        const isCurrentTeeInList = sortedTees.some(t => t.name === this.round.tee_name);
        if (!isCurrentTeeInList) {
          const tee = sortedTees[0];
          this.round.tee_name = tee.name;
          this.round.course_rating = tee.rating ?? '';
          this.round.slope_rating = tee.slope ?? '';
          this.round.par = tee.par ?? '';
          this.recalculateDifferential();
        }
      }
    }
    this.requestUpdate();
  }

  loadRound(id) {
    this.activeRoundId = id;
    if (id) {
      const existing = store.rounds.find(r => r.id === id);
      if (existing) {
        this.round = JSON.parse(JSON.stringify(existing));
        this.showHoles = Boolean(existing.stats?.holes && existing.stats.holes.length > 0);
        this.isDirty = false;
        return;
      }
    }
    // New round - start with clean empty fields (no prefilled dummy values)
    const defaultPlayer = store.activePlayer && store.activePlayer !== 'All' ? store.activePlayer : 'Tim';

    this.round = {
      ...DEFAULT_ROUND_TEMPLATE,
      id: `rnd_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      player: defaultPlayer,
      course_id: '',
      course_name: '',
      tee_name: '',
      course_rating: '',
      slope_rating: '',
      par: '',
      score: '',
      differential: null,
      stats: {
        player: defaultPlayer
      },
      notes: ''
    };
    this.showHoles = false;
    this.isDirty = false;
  }

  toggleHoles() {
    this.showHoles = !this.showHoles;
    if (this.showHoles && (!this.round.stats?.holes || this.round.stats.holes.length === 0)) {
      if (!this.round.stats) this.round.stats = {};
      this.round.stats.holes = Array.from({ length: 18 }, (_, i) => ({
        hole: i + 1,
        par: 4,
        score: ''
      }));
    }
    this.requestUpdate();
  }

  handleCourseChange(e) {
    const courseId = e.target.value;
    this.isDirty = true;
    if (!courseId) {
      this.round.course_id = '';
      this.round.course_name = '';
      this.round.tee_name = '';
      this.round.course_rating = '';
      this.round.slope_rating = '';
      this.round.par = '';
      this.recalculateDifferential();
      this.requestUpdate();
      return;
    }
    const course = this.courses.find(c => c.id === courseId);
    if (course) {
      this.round.course_id = course.id;
      this.round.course_name = course.name;
      const sortedTees = this.getSortedTees(course);
      if (sortedTees && sortedTees.length > 0) {
        const tee = sortedTees[0];
        this.round.tee_name = tee.name;
        this.round.course_rating = tee.rating ?? '';
        this.round.slope_rating = tee.slope ?? '';
        this.round.par = tee.par ?? '';
      }
      this.recalculateDifferential();
      this.requestUpdate();
    }
  }

  handleTeeChange(e) {
    const teeName = e.target.value;
    this.isDirty = true;
    const course = this.courses.find(c => c.id === this.round.course_id);
    if (course && course.tees) {
      const sortedTees = this.getSortedTees(course);
      const tee = sortedTees.find(t => t.name === teeName) || course.tees.find(t => t.name === teeName);
      if (tee) {
        this.round.tee_name = tee.name;
        this.round.course_rating = tee.rating ?? '';
        this.round.slope_rating = tee.slope ?? '';
        this.round.par = tee.par ?? '';
        this.recalculateDifferential();
        this.requestUpdate();
      }
    }
  }

  handleFieldChange(field, value) {
    this.isDirty = true;
    this.round[field] = value;
    if (field === 'score' || field === 'course_rating' || field === 'slope_rating') {
      this.recalculateDifferential();
    }
    this.requestUpdate();
  }

  handleStatChange(stat, value) {
    this.isDirty = true;
    if (!this.round.stats) this.round.stats = {};
    if (value === '' || value === null || value === undefined) {
      delete this.round.stats[stat];
    } else {
      this.round.stats[stat] = Number(value);
    }
    this.requestUpdate();
  }

  recalculateDifferential() {
    this.round.differential = calculateDifferential(
      this.round.score,
      this.round.course_rating,
      this.round.slope_rating
    );
  }

  handleHoleScoreChange(holeIndex, newScore) {
    this.isDirty = true;
    if (!this.round.stats) this.round.stats = {};
    if (!this.round.stats.holes) this.round.stats.holes = [];
    const holes = this.round.stats.holes;
    if (holes[holeIndex]) {
      holes[holeIndex].score = newScore === '' ? '' : Number(newScore);
    }
    const enteredScores = holes.filter(h => h.score !== '' && !isNaN(Number(h.score)));
    if (enteredScores.length > 0) {
      this.round.score = enteredScores.reduce((sum, h) => sum + Number(h.score), 0);
    }
    this.recalculateDifferential();
    this.requestUpdate();
  }

  async handleSave(e) {
    e.preventDefault();
    if (!this.round.course_name) {
      window.alert('Please specify a golf course name.');
      return;
    }
    if (this.round.score === '' || this.round.score === null || this.round.score === undefined) {
      window.alert('Please enter a gross score.');
      return;
    }

    try {
      this.round.updated_at = new Date().toISOString();
      if (!this.round.created_at) {
        this.round.created_at = this.round.updated_at;
      }
      this.round.score = Number(this.round.score);
      if (this.round.course_rating !== '') this.round.course_rating = Number(this.round.course_rating);
      if (this.round.slope_rating !== '') this.round.slope_rating = Number(this.round.slope_rating);
      if (this.round.par !== '') this.round.par = Number(this.round.par);

      if (this.round.stats) {
        if (!this.round.stats.holes || this.round.stats.holes.length === 0 || !this.showHoles) {
          delete this.round.stats.holes;
        }
      }

      const db = await getDb();
      await putRound(db, this.round);
      store.rounds = await getAllRounds(db);
      this.isDirty = false;

      // Remote save sync
      fetch(API_SAVE_ROUND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.round)
      }).catch(err => console.warn('Remote round save failed:', err));

      navigate('round', this.round.id);
    } catch (err) {
      console.error('Failed to save round:', err);
      window.alert('Error saving round: ' + err.message);
    }
  }

  render() {
    const r = this.round;
    const diff = calculateDifferential(r.score, r.course_rating, r.slope_rating);
    const selectedCourse = this.courses.find(c => c.id === r.course_id);

    return html`
      <header>
        <div class="header-title-group">
          <app-btn variant="icon" icon="arrow-left" .iconSize="${20}" @click="${back}"></app-btn>
          <h1 class="app-brand-title">${this.activeRoundId ? 'Edit Round' : 'Post New Round'}</h1>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          <app-btn text="Cancel" @click="${back}"></app-btn>
          <app-btn variant="primary" text="Save Round" @click="${this.handleSave}"></app-btn>
        </div>
      </header>

      <main>
        <form @submit="${this.handleSave}">
          <div class="form-grid">
            <!-- Player Selection -->
            <div class="form-group">
              <label>Player *</label>
              <select @change="${e => this.handlePlayerChange(e.target.value)}">
                <option value="Tim" ?selected="${(r.player || 'Tim') === 'Tim'}">Tim</option>
                <option value="Pat" ?selected="${r.player === 'Pat'}">Pat</option>
              </select>
            </div>

            <!-- Course Selection -->
            <div class="form-group">
              <label>Select Saved Course</label>
              <select @change="${this.handleCourseChange}">
                <option value="">-- Choose from Catalog (Recent First) --</option>
                ${this.getSortedCourses().map(c => html`
                  <option value="${c.id}" ?selected="${c.id === r.course_id}">${c.name}</option>
                `)}
              </select>
            </div>

            <!-- Course Name -->
            <div class="form-group">
              <label>Course Name *</label>
              <input 
                type="text" 
                required 
                .value="${r.course_name || ''}" 
                @input="${e => this.handleFieldChange('course_name', e.target.value)}"
                placeholder="e.g. Pebble Beach Golf Links"
              />
            </div>

            <!-- Date -->
            <div class="form-group">
              <label>Date Played *</label>
              <input 
                type="date" 
                required 
                .value="${r.date || ''}" 
                @input="${e => this.handleFieldChange('date', e.target.value)}"
              />
            </div>

            <!-- Tee Set -->
            <div class="form-group">
              <label>Tee Set</label>
              ${selectedCourse?.tees?.length ? html`
                <select @change="${this.handleTeeChange}">
                  <option value="">-- Select Tee Set --</option>
                  ${this.getSortedTees(selectedCourse).map(t => html`
                    <option value="${t.name}" ?selected="${t.name === r.tee_name}">${t.name} (${t.rating}/${t.slope})</option>
                  `)}
                </select>
              ` : html`
                <input 
                  type="text" 
                  .value="${r.tee_name || ''}" 
                  @input="${e => this.handleFieldChange('tee_name', e.target.value)}"
                  placeholder="e.g. Blue, White, Black"
                />
              `}
            </div>

            <!-- Course Rating -->
            <div class="form-group">
              <label>Course Rating</label>
              <input 
                type="number" 
                step="0.1" 
                required 
                .value="${r.course_rating ?? ''}" 
                @input="${e => this.handleFieldChange('course_rating', e.target.value ? Number(e.target.value) : '')}"
                placeholder="e.g. 72.0"
              />
            </div>

            <!-- Slope Rating -->
            <div class="form-group">
              <label>Slope Rating (55 - 155)</label>
              <input 
                type="number" 
                min="55" 
                max="155" 
                required 
                .value="${r.slope_rating ?? ''}" 
                @input="${e => this.handleFieldChange('slope_rating', e.target.value ? Number(e.target.value) : '')}"
                placeholder="e.g. 113"
              />
            </div>

            <!-- Par -->
            <div class="form-group">
              <label>Course Par</label>
              <input 
                type="number" 
                .value="${r.par ?? ''}" 
                @input="${e => this.handleFieldChange('par', e.target.value ? Number(e.target.value) : '')}"
                placeholder="e.g. 72"
              />
            </div>

            <!-- Gross Score & Differential -->
            <div class="form-group">
              <label>Gross Score *</label>
              <input 
                type="number" 
                required 
                .value="${r.score ?? ''}" 
                @input="${e => this.handleFieldChange('score', e.target.value ? Number(e.target.value) : '')}"
                placeholder="e.g. 85"
              />
            </div>

            <div class="form-group">
              <label>Calculated Differential</label>
              <div style="font-size: 1.3rem; font-weight: 800; color: var(--golf-dark); padding-top: 0.35rem;">
                ${diff != null && !isNaN(diff) ? diff.toFixed(1) : '—'}
              </div>
            </div>
          </div>

          <!-- Overall Stats Group -->
          <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Round Statistics</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Total Putts</label>
              <input 
                type="number" 
                .value="${r.stats?.putts ?? ''}" 
                @input="${e => this.handleStatChange('putts', e.target.value)}"
                placeholder="Optional"
              />
            </div>

            <div class="form-group">
              <label>Fairways Hit (FIR)</label>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input 
                  type="number" 
                  .value="${r.stats?.fairways_hit ?? ''}" 
                  @input="${e => this.handleStatChange('fairways_hit', e.target.value)}"
                  style="width: 5rem;"
                  placeholder="Hit"
                />
                <span>/</span>
                <input 
                  type="number" 
                  .value="${r.stats?.fairways_total ?? ''}" 
                  @input="${e => this.handleStatChange('fairways_total', e.target.value)}"
                  style="width: 5rem;"
                  placeholder="Tot"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Greens in Regulation (GIR)</label>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input 
                  type="number" 
                  .value="${r.stats?.gir_hit ?? ''}" 
                  @input="${e => this.handleStatChange('gir_hit', e.target.value)}"
                  style="width: 5rem;"
                  placeholder="Hit"
                />
                <span>/</span>
                <input 
                  type="number" 
                  .value="${r.stats?.gir_total ?? ''}" 
                  @input="${e => this.handleStatChange('gir_total', e.target.value)}"
                  style="width: 5rem;"
                  placeholder="Tot"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Penalty Strokes</label>
              <input 
                type="number" 
                .value="${r.stats?.penalties ?? ''}" 
                @input="${e => this.handleStatChange('penalties', e.target.value)}"
                placeholder="Optional"
              />
            </div>
          </div>

          <!-- Hole by Hole toggle -->
          <div style="margin: 1.5rem 0 0.5rem 0; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0;">Hole-by-Hole Scorecard</h3>
            <app-btn .text="${this.showHoles ? 'Hide Holes' : 'Show 18 Holes'}" @click="${() => this.toggleHoles()}"></app-btn>
          </div>

          ${this.showHoles ? html`
            <div class="scorecard-table-wrapper">
              <table class="scorecard-table">
                <thead>
                  <tr>
                    <th>Hole</th>
                    ${r.stats?.holes?.map(h => html`<th class="hole-col">${h.hole}</th>`)}
                    <th class="total-col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Par</strong></td>
                    ${r.stats?.holes?.map(h => html`<td>${h.par}</td>`)}
                    <td class="total-col">${r.stats?.holes?.reduce((s, h) => s + (Number(h.par) || 0), 0)}</td>
                  </tr>
                  <tr>
                    <td><strong>Score</strong></td>
                    ${r.stats?.holes?.map((h, idx) => html`
                      <td>
                        <input 
                          type="number" 
                          class="scorecard-input" 
                          .value="${h.score}" 
                          @input="${e => this.handleHoleScoreChange(idx, e.target.value)}"
                        />
                      </td>
                    `)}
                    <td class="total-col">${r.score}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Notes -->
          <div class="form-group" style="margin-top: 1.5rem;">
            <label>Round Notes / Highlights</label>
            <textarea 
              rows="3" 
              .value="${r.notes || ''}" 
              @input="${e => this.handleFieldChange('notes', e.target.value)}"
              placeholder="e.g. Windy conditions on front 9, chipped in on 12..."
            ></textarea>
          </div>
        </form>
      </main>
    `;
  }
}
