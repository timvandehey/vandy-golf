import { store } from './store.js';
import { confirm } from './dialogs.js';

export async function handleHashRoute() {
  const hash = window.location.hash || '#/feed';

  // Guard check for dirty editor
  const editor = document.querySelector('app-editor');
  if (editor && editor.isDirty) {
    const confirmed = await confirm('You have unsaved changes in your scorecard. Discard them?');
    if (!confirmed) {
      const oldHash = store.view === 'round' ? `#/round/${store.activeRoundId}` :
                      store.view === 'edit' ? `#/edit/${store.activeRoundId || 'new'}` :
                      store.view === 'stats' ? '#/stats' :
                      store.view === 'courses' ? '#/courses' :
                      store.view === 'settings' ? '#/settings' : '#/feed';
      const url = new URL(window.location.href);
      url.hash = oldHash;
      window.history.replaceState(null, '', url.href);
      return;
    }
    editor.isDirty = false;
  }

  let view = 'feed';
  let activeRoundId = null;

  if (hash.startsWith('#/round/')) {
    view = 'round';
    activeRoundId = hash.slice(8);
  } else if (hash.startsWith('#/edit/')) {
    view = 'edit';
    const id = hash.slice(7);
    activeRoundId = id === 'new' ? null : id;
  } else if (hash === '#/stats') {
    view = 'stats';
  } else if (hash === '#/courses') {
    view = 'courses';
  } else if (hash === '#/settings') {
    view = 'settings';
  }

  store.view = view;
  store.activeRoundId = activeRoundId;
  store.drawerOpen = false;
}

export async function navigate(view, activeRoundId = null, pushHistory = true) {
  const editor = document.querySelector('app-editor');
  if (editor && editor.isDirty) {
    const confirmed = await confirm('You have unsaved changes in your scorecard. Discard them?');
    if (!confirmed) {
      return false;
    }
    editor.isDirty = false;
  }

  let newHash = '#/feed';
  if (view === 'round') newHash = `#/round/${activeRoundId}`;
  else if (view === 'edit') newHash = `#/edit/${activeRoundId || 'new'}`;
  else if (view === 'stats') newHash = '#/stats';
  else if (view === 'courses') newHash = '#/courses';
  else if (view === 'settings') newHash = '#/settings';

  if (pushHistory) {
    window.location.hash = newHash;
  } else {
    const url = new URL(window.location.href);
    url.hash = newHash;
    window.history.replaceState(null, '', url.href);
    await handleHashRoute();
  }
  return true;
}

export function back() {
  window.history.back();
}
