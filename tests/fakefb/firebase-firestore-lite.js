// بديل Firestore Lite للاختبار: المستندات في localStorage، وقواعد مبسطة كقواعد الموقع
const KEY = "__fakefs";
const MAIN = "kheliwy6@gmail.com";
let store = {};
try {
  store = JSON.parse(localStorage.getItem(KEY) || "{}");
} catch (e) {}
if (globalThis.__SEED_DB && !Object.keys(store).length) store = JSON.parse(JSON.stringify(globalThis.__SEED_DB));
const save = () => localStorage.setItem(KEY, JSON.stringify(store));
globalThis.__fakefs = () => store;
globalThis.__fsWrites = 0;
const user = () => {
  try {
    return JSON.parse(localStorage.getItem("__fakeauth") || "null");
  } catch (e) {
    return null;
  }
};
const isMain = () => !!user() && user().email === MAIN;
const isAdmin = () => {
  const u = user();
  return !!u && !!u.email && (u.email === MAIN || "admins/" + u.email.toLowerCase() in store);
};
const fail = (code) => {
  const e = new Error(code);
  e.code = code;
  return e;
};
function canRead(path) {
  if (path === "owner/check") return isAdmin();
  if (path === "owner/main") return isMain();
  if (path.startsWith("admins/")) return isAdmin();
  return true;
}
function canWrite(path, data, old) {
  const u = user();
  if (path.startsWith("plans/")) return isAdmin() || (!!u && (data ? data.by === u.uid : old && old.by === u.uid));
  if (path.startsWith("admins/")) return isMain();
  return isAdmin();
}
const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export function getFirestore() {
  return {};
}
export function collection(fs, name) {
  return { type: "col", path: name };
}
export function doc(base, a) {
  if (base && base.type === "col") {
    const id = a || "auto" + Math.random().toString(36).slice(2, 12);
    return { type: "doc", path: base.path + "/" + id, id };
  }
  return { type: "doc", path: a, id: a.split("/").pop() };
}
const snap = (path) => {
  const exists = path in store;
  const data = copy(store[path]);
  return { id: path.split("/").pop(), exists: () => exists, data: () => data };
};
export async function getDoc(ref) {
  await 0;
  if (!canRead(ref.path)) throw fail("permission-denied");
  return snap(ref.path);
}
export function query(col, ...cons) {
  const q = { type: "q", col };
  for (const c of cons) Object.assign(q, c);
  return q;
}
export function orderBy(f, dir) {
  return { order: [f, dir || "asc"] };
}
export function limit(n) {
  return { lim: n };
}
export async function getDocs(q) {
  await 0;
  const col = q.type === "col" ? q : q.col;
  if (col.path === "admins" && !isAdmin()) throw fail("permission-denied");
  let docs = Object.keys(store)
    .filter((p) => p.startsWith(col.path + "/") && p.split("/").length === 2)
    .map(snap);
  if (q.order) {
    const [f, dir] = q.order;
    docs.sort((a, b) => {
      const x = (a.data() || {})[f];
      const y = (b.data() || {})[f];
      return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
    });
  }
  if (q.lim) docs = docs.slice(0, q.lim);
  return { docs };
}
export async function setDoc(ref, data) {
  await 0;
  if (!canWrite(ref.path, data, store[ref.path])) throw fail("permission-denied");
  store[ref.path] = copy(data);
  globalThis.__fsWrites++;
  save();
}
export async function deleteDoc(ref) {
  await 0;
  if (!canWrite(ref.path, null, store[ref.path])) throw fail("permission-denied");
  delete store[ref.path];
  save();
}
export function writeBatch() {
  const ops = [];
  return {
    set(ref, data) {
      ops.push([ref, data]);
      return this;
    },
    delete(ref) {
      ops.push([ref, null]);
      return this;
    },
    async commit() {
      await 0;
      for (const [ref, data] of ops) if (!canWrite(ref.path, data, store[ref.path])) throw fail("permission-denied");
      for (const [ref, data] of ops) {
        if (data === null) delete store[ref.path];
        else store[ref.path] = copy(data);
      }
      globalThis.__fsWrites++;
      save();
    },
  };
}
