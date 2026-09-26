import { store } from './store.js';

export function alert(message) {
  return new Promise((resolve) => {
    store.dialogType = 'alert';
    store.dialogMessage = message;
    store.dialogResolve = resolve;
    store.dialogOpen = true;
  });
}

export function confirm(message) {
  return new Promise((resolve) => {
    store.dialogType = 'confirm';
    store.dialogMessage = message;
    store.dialogResolve = resolve;
    store.dialogOpen = true;
  });
}
