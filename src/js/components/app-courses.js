import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store.js';
import { getDb, putCourse, deleteCourse, getAllCourses } from '../db.js';
import { confirm } from '../dialogs.js';
import { API_SAVE_COURSE, API_DELETE_COURSE } from '../constants.js';

@customElement('app-courses')
export class AppCourses extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() accessor courses = store.courses;
  @state() accessor showModal = false;
  @state() accessor editingCourse = null;

  _unsubscribes = [];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribes = [
      store.subscribe.courses(c => { this.courses = c; })
    ];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribes.forEach(unsub => unsub());
  }

  openDrawer() {
    store.drawerOpen = true;
  }

  openAddCourse() {
    this.editingCourse = {
      id: `crs_${Date.now()}`,
      name: '',
      city: '',
      state: '',
      tees: [
        { name: 'Blue', rating: 72.0, slope: 113, par: 72, yardage: 6500 },
        { name: 'White', rating: 70.0, slope: 113, par: 72, yardage: 6000 }
      ]
    };
    this.showModal = true;
  }

  openEditCourse(course) {
    this.editingCourse = JSON.parse(JSON.stringify(course));
    if (!this.editingCourse.tees || this.editingCourse.tees.length === 0) {
      this.editingCourse.tees = [{ name: 'Standard', rating: 72.0, slope: 113, par: 72, yardage: 6500 }];
    }
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editingCourse = null;
  }

  addTeeRow() {
    if (!this.editingCourse) return;
    this.editingCourse.tees.push({
      name: 'New Tee',
      rating: 72.0,
      slope: 113,
      par: 72,
      yardage: 6200
    });
    this.requestUpdate();
  }

  removeTeeRow(index) {
    if (!this.editingCourse) return;
    this.editingCourse.tees.splice(index, 1);
    this.requestUpdate();
  }

  async handleSaveCourse(e) {
    e.preventDefault();
    if (!this.editingCourse.name) {
      window.alert('Please enter a course name.');
      return;
    }

    try {
      this.editingCourse.updated_at = new Date().toISOString();
      if (!this.editingCourse.created_at) {
        this.editingCourse.created_at = this.editingCourse.updated_at;
      }

      const db = await getDb();
      await putCourse(db, this.editingCourse);
      store.courses = await getAllCourses(db);

      // Best effort remote save
      fetch(API_SAVE_COURSE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.editingCourse)
      }).catch(err => console.warn('Remote course save failed:', err));

      this.closeModal();
    } catch (err) {
      console.error('Failed to save course:', err);
      window.alert('Error saving course: ' + err.message);
    }
  }

  async handleDeleteCourse(course) {
    const confirmed = await confirm(`Delete "${course.name}" from your saved courses?`);
    if (!confirmed) return;

    try {
      const db = await getDb();
      await deleteCourse(db, course.id);
      store.courses = await getAllCourses(db);

      fetch(API_DELETE_COURSE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: course.id })
      }).catch(err => console.warn('Remote course delete failed:', err));
    } catch (err) {
      console.error('Delete course failed:', err);
    }
  }

  render() {
    return html`
      <header>
        <div class="header-title-group">
          <app-btn variant="icon" icon="menu" .iconSize="${22}" @click="${this.openDrawer}"></app-btn>
          <h1 class="app-brand-title">Courses & Tees Directory</h1>
        </div>

        <app-btn variant="primary" icon="plus" text="Add Course" @click="${this.openAddCourse}"></app-btn>
      </header>

      <main>
        ${this.courses.length === 0 ? html`
          <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted-2);">
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">No courses saved in catalog yet.</p>
            <app-btn variant="primary" icon="plus" text="Add Your First Course" @click="${this.openAddCourse}"></app-btn>
          </div>
        ` : html`
          <div class="courses-cards">
            ${this.courses.map(c => html`
              <div class="card">
                <div class="card-header">
                  <div>
                    <h3 style="margin: 0; font-size: 1.15rem; color: var(--golf-dark);">${c.name}</h3>
                    ${c.city || c.state ? html`
                      <div class="card-meta-subtitle">${[c.city, c.state].filter(Boolean).join(', ')}</div>
                    ` : ''}
                  </div>

                  <div style="display: flex; gap: 0.25rem;">
                    <app-btn variant="icon" icon="edit" title="Edit Course" @click="${() => this.openEditCourse(c)}"></app-btn>
                    <app-btn variant="icon" icon="trash" title="Delete Course" @click="${() => this.handleDeleteCourse(c)}"></app-btn>
                  </div>
                </div>

                <!-- Tees List -->
                <div>
                  <div style="font-size: 0.8rem; font-weight: bold; text-transform: uppercase; color: var(--text-muted-2); margin-bottom: 0.4rem;">
                    Available Tees
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    ${(c.tees || []).map(t => html`
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 0.25rem 0.5rem; background: var(--hover-bg); border-radius: var(--border-radius);">
                        <span>
                          ${t.player ? html`<span style="font-size: 0.72rem; margin-right: 0.35rem; padding: 0.1rem 0.4rem; background: var(--golf-light); color: var(--golf-dark); border-radius: 4px; font-weight: 600;">${t.player}</span>` : ''}
                          <strong>${t.name}</strong>
                        </span>
                        <span>Rating: <strong>${t.rating}</strong> / Slope: <strong>${t.slope}</strong> ${t.par ? `(Par ${t.par})` : ''}</span>
                      </div>
                    `)}
                  </div>
                </div>
              </div>
            `)}
          </div>
        `}

        <!-- Add/Edit Course Modal -->
        ${this.showModal && this.editingCourse ? html`
          <div class="dialog-backdrop" @click="${this.closeModal}">
            <div class="dialog-box" style="width: min(95vw, 65ch);" @click="${e => e.stopPropagation()}">
              <h3 class="dialog-header">${this.editingCourse.name ? 'Edit Course' : 'Add New Course'}</h3>
              
              <form @submit="${this.handleSaveCourse}">
                <div class="form-grid">
                  <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Course Name *</label>
                    <input 
                      type="text" 
                      required 
                      .value="${this.editingCourse.name}" 
                      @input="${e => { this.editingCourse.name = e.target.value; }}" 
                      placeholder="e.g. Cypress Point Club"
                    />
                  </div>
                  <div class="form-group">
                    <label>City</label>
                    <input 
                      type="text" 
                      .value="${this.editingCourse.city || ''}" 
                      @input="${e => { this.editingCourse.city = e.target.value; }}"
                    />
                  </div>
                  <div class="form-group">
                    <label>State / Region</label>
                    <input 
                      type="text" 
                      .value="${this.editingCourse.state || ''}" 
                      @input="${e => { this.editingCourse.state = e.target.value; }}"
                    />
                  </div>
                </div>

                <div style="margin: 1rem 0 0.5rem 0; display: flex; justify-content: space-between; align-items: center;">
                  <h4 style="margin: 0;">Tee Sets</h4>
                  <app-btn text="+ Add Tee" @click="${this.addTeeRow}"></app-btn>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
                  ${this.editingCourse.tees.map((t, idx) => html`
                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                      <input 
                        type="text" 
                        placeholder="Tee Name" 
                        .value="${t.name}" 
                        @input="${e => { t.name = e.target.value; }}" 
                        style="flex: 2;"
                      />
                      <input 
                        type="number" 
                        step="0.1" 
                        placeholder="Rating" 
                        .value="${t.rating}" 
                        @input="${e => { t.rating = Number(e.target.value); }}" 
                        style="flex: 1.2;"
                      />
                      <input 
                        type="number" 
                        placeholder="Slope" 
                        .value="${t.slope}" 
                        @input="${e => { t.slope = Number(e.target.value); }}" 
                        style="flex: 1.2;"
                      />
                      <input 
                        type="number" 
                        placeholder="Par" 
                        .value="${t.par || 72}" 
                        @input="${e => { t.par = Number(e.target.value); }}" 
                        style="flex: 1;"
                      />
                      <app-btn variant="icon" icon="trash" @click="${() => this.removeTeeRow(idx)}"></app-btn>
                    </div>
                  `)}
                </div>

                <div class="dialog-actions" style="margin-top: 1.25rem;">
                  <app-btn text="Cancel" @click="${this.closeModal}"></app-btn>
                  <app-btn variant="primary" type="submit" text="Save Course"></app-btn>
                </div>
              </form>
            </div>
          </div>
        ` : ''}
      </main>
    `;
  }
}
