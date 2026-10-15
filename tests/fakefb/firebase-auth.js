// بديل Firebase Auth للاختبار: الدخول بحساب Google يأخذ البريد من globalThis.__signInAs
const KEY = "__fakeauth";
const listeners = new Set();
let current = null;
try {
  current = JSON.parse(localStorage.getItem(KEY) || "null");
} catch (e) {}
function emit() {
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((cb) => cb(current));
}
export function getAuth() {
  return {
    get currentUser() {
      return current;
    },
  };
}
export class GoogleAuthProvider {
  setCustomParameters() {}
}
export function onAuthStateChanged(auth, cb) {
  listeners.add(cb);
  setTimeout(() => cb(current), 0);
  return () => listeners.delete(cb);
}
export async function signInWithPopup() {
  const email = globalThis.__signInAs;
  if (!email) {
    const e = new Error("popup closed");
    e.code = "auth/popup-closed-by-user";
    throw e;
  }
  current = { uid: "u-" + email, email, displayName: email, isAnonymous: false };
  emit();
  return { user: current };
}
export async function signInAnonymously() {
  current = { uid: "anon-" + Math.random().toString(36).slice(2), email: null, displayName: "", isAnonymous: true };
  emit();
  return { user: current };
}
export async function signOut() {
  current = null;
  emit();
}
