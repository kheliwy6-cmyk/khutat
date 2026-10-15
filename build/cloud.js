
/* الحفظ في الموقع المستقل: Firebase (Firestore Lite، والدخول بحساب Google).
   واجهة تحاكي قاعدة بيانات Claude التي تستعملها الصفحة: collection / doc / onSnapshot / set / delete،
   فلا يتغير منطق الخطط المحفوظة ولوحة التحكم بين النسختين.
   Firestore Lite لا يتابع التغييرات لحظياً، فتُعاد قراءة القوائم بعد كل حفظ أو حذف، وعند العودة إلى الصفحة. */
(function () {
  "use strict";
  const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
  const BATCH = 15;

  // Firestore لا يقبل مصفوفة داخل مصفوفة (صفوف الخطة)، فتُلفّ المصفوفة الداخلية في {__a: [...]}
  function enc(v, inArray) {
    if (Array.isArray(v)) {
      const a = v.map((x) => enc(x, true));
      return inArray ? { __a: a } : a;
    }
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v)) if (v[k] !== undefined) o[k] = enc(v[k], false);
      return o;
    }
    return v === undefined ? null : v;
  }
  function dec(v) {
    if (Array.isArray(v)) return v.map(dec);
    if (v && typeof v === "object") {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === "__a" && Array.isArray(v.__a)) return v.__a.map(dec);
      const o = {};
      for (const k of keys) o[k] = dec(v[k]);
      return o;
    }
    return v;
  }

  // رموز الأخطاء كما تعرفها الصفحة من قاعدة بيانات Claude
  const CODES = { "permission-denied": "invalid_argument", unauthenticated: "invalid_argument", "resource-exhausted": "quota_exceeded" };
  function wrapErr(e) {
    const raw = e && e.code ? String(e.code).replace(/^firestore\//, "") : "";
    const err = new Error((e && e.message) || "cloud error");
    err.code = CODES[raw] || raw || "unknown";
    err.raw = raw;
    return err;
  }
  const fail = (e) => {
    throw wrapErr(e);
  };

  function create(fb, config) {
    const app = fb.initializeApp(config);
    const auth = fb.getAuth(app);
    const fs = fb.getFirestore(app);
    const watchers = new Set();
    let lastRefresh = Date.now();
    function refresh() {
      lastRefresh = Date.now();
      watchers.forEach((w) => w());
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh > 30000) refresh();
    });
    function watch(read, cb, onErr) {
      let alive = true;
      const run = () =>
        read().then(
          (v) => alive && cb(v),
          (e) => alive && onErr && onErr(wrapErr(e))
        );
      watchers.add(run);
      run();
      return () => {
        alive = false;
        watchers.delete(run);
      };
    }
    const snap = (s) => {
      const exists = s.exists();
      const data = exists ? dec(s.data() || {}) : undefined;
      return { id: s.id, exists, data: () => data };
    };
    function docApi(ref) {
      return {
        id: ref.id,
        get: () => fb.getDoc(ref).then(snap, fail),
        set: (data) => fb.setDoc(ref, enc(data, false)).then(refresh, fail),
        delete: () => fb.deleteDoc(ref).then(refresh, fail),
        onSnapshot: (cb, onErr) => watch(() => fb.getDoc(ref).then(snap), cb, onErr),
      };
    }
    function collectionApi(name, cons) {
      const col = fb.collection(fs, name);
      return {
        doc: (id) => docApi(id ? fb.doc(col, id) : fb.doc(col)),
        orderBy: (field, dir) => collectionApi(name, cons.concat([fb.orderBy(field, dir || "asc")])),
        limit: (n) => collectionApi(name, cons.concat([fb.limit(n)])),
        onSnapshot: (cb, onErr) =>
          watch(() => fb.getDocs(cons.length ? fb.query(col, ...cons) : col).then((s) => ({ docs: s.docs.map(snap) })), cb, onErr),
        get: () => fb.getDocs(cons.length ? fb.query(col, ...cons) : col).then((s) => ({ docs: s.docs.map(snap) }), fail),
        // كتابة مستندات كثيرة دفعات (الاسترجاع، وأجزاء الملفات): ١٥ مستنداً أو نحو ٨ م.ب في كل دفعة،
        // لأن حدّ الطلب الواحد في Firestore ١٠ م.ب، وقواعد المشرفين تقرأ مستنداً لكل كتابة (٢٠ قراءة للدفعة على الأكثر)؛
        // ثم تُقرأ القوائم مرة واحدة
        setMany: async (items) => {
          let batch = null;
          let n = 0;
          let size = 0;
          const flush = async () => {
            if (batch && n) await batch.commit().catch(fail);
            batch = null;
            n = 0;
            size = 0;
          };
          for (const it of items) {
            const data = enc(it.data, false);
            const s = JSON.stringify(data).length;
            if (batch && (n >= BATCH || size + s > 8000000)) await flush();
            if (!batch) batch = fb.writeBatch(fs);
            batch.set(it.id ? fb.doc(col, it.id) : fb.doc(col), data);
            n++;
            size += s;
          }
          await flush();
          refresh();
        },
        deleteMany: async (ids) => {
          for (let i = 0; i < ids.length; i += BATCH) {
            const batch = fb.writeBatch(fs);
            for (const id of ids.slice(i, i + BATCH)) batch.delete(fb.doc(col, id));
            await batch.commit().catch(fail);
          }
          refresh();
        },
      };
    }
    const db = {
      collection: (name) => collectionApi(name, []),
      doc: (path) => docApi(fb.doc(fs, path)),
    };

    // المشرفون: قواعد Firestore لا تسمح بقراءة owner/check إلا لهم، ولا owner/main إلا لصاحب الموقع
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const allowed = (path) =>
      fb.getDoc(fb.doc(fs, path)).then(
        () => true,
        (e) => {
          const w = wrapErr(e);
          if (w.code === "invalid_argument") return false;
          throw w;
        }
      );
    const person = (u) => (u ? { uid: u.uid, email: u.email || "", name: u.displayName || "", anon: !!u.isAnonymous } : null);
    const authApi = {
      onChange: (cb) => fb.onAuthStateChanged(auth, (u) => cb(person(u))),
      // الزائر يحفظ بهوية مجهولة لجهازه (دون تسجيل دخول)، فيحذف ما حفظه هو وحده
      ensureUser: () => (auth.currentUser ? Promise.resolve(auth.currentUser.uid) : fb.signInAnonymously(auth).then((r) => r.user.uid)),
      // تُستدعى مباشرة من ضغطة الزر، فلا يمنع المتصفح نافذة الدخول
      signIn: () => fb.signInWithPopup(auth, provider).then((r) => person(r.user)),
      signOut: () => fb.signOut(auth),
      isOwner: () => allowed("owner/check"),
      isMain: () => allowed("owner/main"),
    };
    return { db, auth: authApi };
  }

  let loading = null;
  function load(config) {
    if (!loading) {
      loading = Promise.all(["firebase-app.js", "firebase-auth.js", "firebase-firestore-lite.js"].map((f) => import(SDK + f))).then(
        ([a, u, f]) =>
          create(
            {
              initializeApp: a.initializeApp,
              getAuth: u.getAuth,
              GoogleAuthProvider: u.GoogleAuthProvider,
              signInWithPopup: u.signInWithPopup,
              signInAnonymously: u.signInAnonymously,
              signOut: u.signOut,
              onAuthStateChanged: u.onAuthStateChanged,
              getFirestore: f.getFirestore,
              doc: f.doc,
              collection: f.collection,
              getDoc: f.getDoc,
              getDocs: f.getDocs,
              setDoc: f.setDoc,
              deleteDoc: f.deleteDoc,
              query: f.query,
              orderBy: f.orderBy,
              limit: f.limit,
              writeBatch: f.writeBatch,
            },
            config
          )
      );
    }
    return loading;
  }

  window.KhutatCloud = { load, create, enc, dec, SDK };
})();

