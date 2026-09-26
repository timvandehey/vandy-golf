// Environment checks
export const IS_DEV = 
  Boolean(import.meta.env?.DEV) || 
  (typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'golf' ||
    window.location.hostname.includes('dev')
  ));

// IndexedDB parameters
export const DB_NAME = 'golf-tracker-db';
export const DB_VERSION = 3;
export const DB_STORE_ROUNDS = 'rounds';
export const DB_STORE_COURSES = 'courses';

// LocalStorage keys
export const LS_LAST_SYNC_KEY = 'golf_last_sync_timestamp';

// API Endpoints
export const API_SAVE_ROUND = '/api/rounds/save';
export const API_DELETE_ROUND = '/api/rounds/delete';
export const API_SAVE_COURSE = '/api/courses/save';
export const API_DELETE_COURSE = '/api/courses/delete';
export const API_SYNC = '/api/sync';
export const API_USER = '/api/auth/user';

// Default standard round template
export const DEFAULT_ROUND_TEMPLATE = {
  date: new Date().toISOString().slice(0, 10),
  course_id: '',
  course_name: '',
  tee_name: '',
  course_rating: '',
  slope_rating: '',
  par: '',
  holes_played: 18,
  score: '',
  differential: null,
  stats: {},
  notes: ''
};
