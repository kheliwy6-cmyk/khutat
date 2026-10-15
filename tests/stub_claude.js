/* بديل قدرات صفحة Claude للاختبار (window.claude): قاعدة بيانات في الذاكرة تُحفظ في localStorage، وحفظ الملفات في window.__saves،
   وصاحب الصفحة إذا كان window.__OWNER صحيحاً. */
(() => {
  const KEY = "__fakedb_claude";
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (e) {
      return {};
    }
  };
  const store = load();
  if (window.__SEED_DB && !Object.keys(store).length) Object.assign(store, window.__SEED_DB);
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) {}
  };
  const listeners = new Set();
  const notify = () => setTimeout(() => listeners.forEach((l) => l()), 0);
  const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  window.__dbWrites = 0;
  const snapDoc = (path) => {
    const id = path.split("/").pop();
    const exists = path in store;
    const data = copy(store[path]);
    return { id, exists, data: () => data };
  };
  const denied = () => {
    const e = new Error("permission denied");
    e.code = "invalid_argument";
    return e;
  };
  function docApi(path) {
    return {
      id: path.split("/").pop(),
      get: async () => snapDoc(path),
      set: async (data) => {
        if (!window.__OWNER && !path.startsWith("plans/")) throw denied();
        store[path] = copy(data);
        window.__dbWrites++;
        persist();
        notify();
      },
      delete: async () => {
        if (!window.__OWNER) throw denied();
        delete store[path];
        persist();
        notify();
      },
      onSnapshot: (cb) => {
        const run = () => cb(snapDoc(path));
        listeners.add(run);
        setTimeout(run, 0);
        return () => listeners.delete(run);
      },
    };
  }
  function collectionApi(name, order, lim) {
    const list = () => {
      let docs = Object.keys(store)
        .filter((p) => p.startsWith(name + "/") && p.split("/").length === 2)
        .map(snapDoc);
      if (order) {
        const [f, dir] = order;
        docs.sort((a, b) => {
          const x = (a.data() || {})[f];
          const y = (b.data() || {})[f];
          return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
        });
      }
      if (lim) docs = docs.slice(0, lim);
      return { docs };
    };
    let auto = 0;
    return {
      doc: (id) => docApi(`${name}/${id || "auto" + Date.now().toString(36) + (auto++) + Math.random().toString(36).slice(2, 6)}`),
      orderBy: (f, dir) => collectionApi(name, [f, dir || "asc"], lim),
      limit: (n) => collectionApi(name, order, n),
      get: async () => list(),
      onSnapshot: (cb) => {
        const run = () => cb(list());
        listeners.add(run);
        setTimeout(run, 0);
        return () => listeners.delete(run);
      },
      setMany: async (items) => {
        for (const it of items) store[`${name}/${it.id || "auto" + Math.random().toString(36).slice(2)}`] = copy(it.data);
        persist();
        notify();
      },
      deleteMany: async (ids) => {
        for (const id of ids) delete store[`${name}/${id}`];
        persist();
        notify();
      },
    };
  }
  const db = { collection: (n) => collectionApi(n), doc: (p) => docApi(p) };
  window.__saves = [];
  window.__fakedb = store;
  const downloads = {
    save: async ({ filename, data }) => {
      const buf = new Uint8Array(await data.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      window.__saves.push({ filename, b64: btoa(bin), size: buf.length });
    },
  };
  const user = { isOwner: async () => !!window.__OWNER };
  window.claude = {
    use: async (name) => {
      if (name === "db") return db;
      if (name === "downloads") return downloads;
      if (name === "user") return user;
      throw new Error("unknown capability " + name);
    },
  };
})();
