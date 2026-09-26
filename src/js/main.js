import { store } from './store.js';
import { getDb, getAllRounds, getAllCourses } from './db.js';
import { calculateHandicapIndex, calculateStatsSummary } from './handicap.js';
import { addSyncLog, performSync } from './sync.js';
import { handleHashRoute } from './router.js';

// Expose store globally for easy debugging in console
window.store = store;

// Initialize global store state properties
store.addProps({
  rounds: [],
  courses: [],
  query: '',
  activePlayer: localStorage.getItem('golf_active_player') || 'Tim',
  loading: false,
  error: false,
  activeRoundId: null,
  activeCourseId: null,
  drawerOpen: false,
  view: 'feed',
  dialogOpen: false,
  dialogType: 'alert',
  dialogMessage: '',
  dialogResolve: null,
  isOnline: navigator.onLine,
  syncStatus: 'Idle',
  lastSyncCount: 'N/A',
  syncLogs: [],
  userEmail: null
});

// Helper to filter rounds by active player
function getPlayerFilteredRounds() {
  const all = store.rounds || [];
  const player = store.activePlayer;
  if (!player || player === 'All') return all;
  return all.filter(r => (r.player || '').toLowerCase() === player.toLowerCase());
}

// Computed properties
store.addProp('playerRounds', null, {
  get: () => getPlayerFilteredRounds()
});

store.addProp('handicapData', null, { 
  get: () => calculateHandicapIndex(getPlayerFilteredRounds())
});

store.addProp('statsSummary', null, { 
  get: () => calculateStatsSummary(getPlayerFilteredRounds()) 
});

// Dynamically load all web components
const components = import.meta.glob('./components/*.js');
for (const path in components) {
  components[path]();
}

// Bootstrap local database & background sync
async function bootstrap() {
  store.loading = true;
  try {
    // Check auth identity
    try {
      const authRes = await fetch('/api/auth/user');
      if (authRes.ok) {
        const authData = await authRes.json();
        store.userEmail = authData.email || null;
      }
    } catch (authErr) {
      console.warn('Failed to fetch user auth identity:', authErr);
    }

    const db = await getDb();
    
    // Load local cached rounds & courses
    const [cachedRounds, cachedCourses] = await Promise.all([
      getAllRounds(db),
      getAllCourses(db)
    ]);

    store.rounds = cachedRounds;
    store.courses = cachedCourses;

    // Run initial hash route parsing
    handleHashRoute();

    // Trigger initial background sync
    try {
      await performSync(db);
    } catch (syncErr) {
      console.warn('Initial sync failed (running offline):', syncErr);
    }

    // Periodic sync every 30 seconds
    setInterval(async () => {
      if (!store.loading) {
        try {
          await performSync(db);
        } catch (err) {
          console.warn('Background sync failed:', err);
        }
      }
    }, 30000);

    // Sync on window focus
    window.addEventListener('focus', async () => {
      if (!store.loading) {
        try {
          await performSync(db);
        } catch (err) {
          console.warn('Focus sync failed:', err);
        }
      }
    });

  } catch (err) {
    console.error('Failed to initialize local DB:', err);
    store.error = true;
  } finally {
    store.loading = false;
  }
}

// Online/Offline network state listeners
window.addEventListener('online', () => { store.isOnline = true; });
window.addEventListener('offline', () => { store.isOnline = false; });

// Route change listener
window.addEventListener('hashchange', handleHashRoute);

// Cross-tab database updates listener
const syncChannel = new BroadcastChannel('golf-sync-channel');
syncChannel.onmessage = async (event) => {
  if (event.data && event.data.type === 'data-updated') {
    addSyncLog('Cross-tab update event detected. Reloading cache...');
    try {
      const db = await getDb();
      const [rounds, courses] = await Promise.all([
        getAllRounds(db),
        getAllCourses(db)
      ]);
      store.rounds = rounds;
      store.courses = courses;
    } catch (err) {
      console.error('[Sync] Cross-tab update reload failed:', err);
    }
  }
};

bootstrap();
