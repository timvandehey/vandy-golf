import { store } from './store.js';
import { putRound, deleteRound, getAllRounds, putCourse, deleteCourse, getAllCourses } from './db.js';
import { API_SYNC, LS_LAST_SYNC_KEY } from './constants.js';
import { getDateParts } from './dates.js';

export function addSyncLog(message) {
  const d = getDateParts();
  const dateStr = `${d.yyyy}-${d.MM}-${d.dd}`;
  const timeStr = `${d.hh}:${d.mm}:${d.ss}`;
  const line = `[${dateStr} ${timeStr}] ${message}`;

  const currentLogs = [...(store.syncLogs || [])];
  currentLogs.unshift(line);
  if (currentLogs.length > 100) {
    currentLogs.pop();
  }
  store.syncLogs = currentLogs;
}

export async function performSync(db, forceFull = false) {
  store.syncStatus = 'Syncing...';
  const lastSync = forceFull ? '1970-01-01T00:00:00.000Z' : (localStorage.getItem(LS_LAST_SYNC_KEY) || '1970-01-01T00:00:00.000Z');
  addSyncLog(`Sync started (${forceFull ? 'Full Resync' : 'since: ' + lastSync})`);

  try {
    const res = await fetch(`${API_SYNC}?since=${encodeURIComponent(lastSync)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const delta = await res.json();
    const roundAdds = delta.rounds?.length || 0;
    const roundDels = delta.deleted_rounds?.length || 0;
    const courseAdds = delta.courses?.length || 0;
    const courseDels = delta.deleted_courses?.length || 0;

    // Apply round updates
    for (const round of (delta.rounds || [])) {
      await putRound(db, round);
      if (!forceFull && roundAdds <= 5) {
        addSyncLog(`Received round update: ${round.course_name} (${round.date})`);
      }
    }

    // Apply round deletions
    for (const id of (delta.deleted_rounds || [])) {
      await deleteRound(db, id);
      if (!forceFull && roundDels <= 5) {
        addSyncLog(`Received round deletion: ${id}`);
      }
    }

    // Apply course updates
    for (const course of (delta.courses || [])) {
      await putCourse(db, course);
      if (!forceFull && courseAdds <= 5) {
        addSyncLog(`Received course update: ${course.name}`);
      }
    }

    // Apply course deletions
    for (const id of (delta.deleted_courses || [])) {
      await deleteCourse(db, id);
      if (!forceFull && courseDels <= 5) {
        addSyncLog(`Received course deletion: ${id}`);
      }
    }

    localStorage.setItem(LS_LAST_SYNC_KEY, delta.timestamp);

    // Refresh store if changes occurred
    if (roundAdds > 0 || roundDels > 0 || courseAdds > 0 || courseDels > 0) {
      const [rounds, courses] = await Promise.all([
        getAllRounds(db),
        getAllCourses(db)
      ]);
      store.rounds = rounds;
      store.courses = courses;

      // Broadcast update across browser tabs
      try {
        const syncChannel = new BroadcastChannel('golf-sync-channel');
        syncChannel.postMessage({ type: 'data-updated' });
        syncChannel.close();
      } catch (err) {
        console.warn('Failed to broadcast sync event:', err);
      }
    }

    store.syncStatus = 'Success';
    store.lastSyncCount = `+${roundAdds + courseAdds} / -${roundDels + courseDels}`;
    addSyncLog(`Sync completed successfully. Rounds (+${roundAdds}/-${roundDels}), Courses (+${courseAdds}/-${courseDels}).`);
  } catch (err) {
    store.syncStatus = 'Failed';
    addSyncLog(`Sync failed: ${err.message}`);
    throw err;
  }
}
