"""أدوات اختبار الصفحة بـ Playwright.

الصفحات تُخدم من /home/claude/testroot:
  new/  البناء الجديد (out/ في المصادر)، و old/ البناء المنشور قبل التعديل (للمقارنة)، وفي كل منهما ready/ وtexts/ من مستودع الموقع.
صفحة Claude (khutat-mutun.html) تعمل ببديل قدرات Claude (stub_claude.js)، وصفحة الموقع (index.html) ببديل Firebase (fakefb/).
"""
import asyncio, base64, functools, http.server, json, os, pathlib, re, shutil, socketserver, subprocess, sys, threading

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent
REPO = SRC.parent / 'khutat'
ROOT = pathlib.Path('/home/claude/testroot')
OLD = pathlib.Path('/home/claude/oldbuild')  # النسخة المنشورة قبل التعديل: index.html و khutat-mutun.html
PORT = 8800
JSZIP = pathlib.Path('/opt/npm-tools/node_modules/jszip/dist/jszip.min.js').read_text()
STUB = (HERE / 'stub_claude.js').read_text(encoding='utf8')
FAKEFB = {n: (HERE / 'fakefb' / n).read_text(encoding='utf8') for n in ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore-lite.js']} if (HERE / 'fakefb').exists() else {}
OUT = SRC / 'out' / 'test'
OUT.mkdir(parents=True, exist_ok=True)

SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>{}</body></html>'


def setup_root():
    """يجهّز مجلد الخدمة: new/ من out/، و old/ من النسخة المحفوظة قبل التعديل"""
    for name, src in (('new', SRC / 'out'), ('old', OLD)):
        d = ROOT / name
        d.mkdir(parents=True, exist_ok=True)
        if (src / 'index.html').exists():
            shutil.copy(src / 'index.html', d / 'index.html')
        if (src / 'khutat-mutun.html').exists():
            art = (src / 'khutat-mutun.html').read_text(encoding='utf8')
            (d / 'khutat-mutun.html').write_text(SKELETON.format(art), encoding='utf8')
        for sub in ('ready', 'texts'):
            link = d / sub
            if not link.exists():
                link.symlink_to(REPO / sub)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


_server = None


def serve():
    global _server
    if _server:
        return
    setup_root()
    handler = functools.partial(Quiet, directory=str(ROOT))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    _server = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), handler)
    _server.daemon_threads = True
    threading.Thread(target=_server.serve_forever, daemon=True).start()


class Checker:
    def __init__(self):
        self.fails = []
        self.n = 0

    def __call__(self, cond, msg):
        self.n += 1
        print(('ok   ' if cond else 'FAIL ') + msg, flush=True)
        if not cond:
            self.fails.append(msg)
        return cond


async def _route(route):
    url = route.request.url
    if 'jszip' in url:
        await route.fulfill(body=JSZIP, content_type='application/javascript')
        return
    m = re.search(r'gstatic\.com/firebasejs/[\d.]+/(firebase-[a-z-]+\.js)', url)
    if m and m.group(1) in FAKEFB:
        await route.fulfill(body=FAKEFB[m.group(1)], content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'})
        return
    await route.abort()


async def new_context(browser, owner=False, seed=None, viewport=(1300, 950), site=False, sign_in_as=None):
    ctx = await browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, accept_downloads=True)
    init = f"window.__OWNER = {json.dumps(bool(owner))}; window.__SEED_DB = {json.dumps(seed or {})};"
    if sign_in_as:
        init += f" globalThis.__signInAs = {json.dumps(sign_in_as)};"
    await ctx.add_init_script(init)
    if not site:
        await ctx.add_init_script(STUB)
    await ctx.route('https://**/*', _route)
    return ctx


async def open_page(browser, build='new', site=False, owner=False, seed=None, viewport=(1300, 950), hash_='create', sign_in_as=None, ctx=None):
    serve()
    ctx = ctx or await new_context(browser, owner=owner, seed=seed, viewport=viewport, site=site, sign_in_as=sign_in_as)
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    url = f'http://127.0.0.1:{PORT}/{build}/' + ('index.html' if site else 'khutat-mutun.html') + '#' + hash_
    await page.goto(url)
    if hash_ == 'create':
        await page.wait_for_selector('.sheet')
    await page.wait_for_timeout(300)
    return ctx, page, errors


async def current_text(page):
    return await page.evaluate("document.getElementById('textChecks').dataset.text")


async def choose_level(page, lvl):
    await page.select_option('#level', str(lvl))
    await page.wait_for_timeout(150)


async def set_checked(page, ids):
    """يعلّم متون المستوى المعطاة ويلغي غيرها (بالضغط كما يفعل المستخدم)"""
    boxes = await page.evaluate("[...document.querySelectorAll('#textChecks input[type=checkbox][data-id]')].map(c => [c.dataset.id, c.checked])")
    # علّم المطلوب أولاً حتى لا تبقى القائمة فارغة
    for tid, on in boxes:
        if tid in ids and not on:
            await page.click(f'#textChecks input[type=checkbox][data-id="{tid}"]')
            await page.wait_for_timeout(80)
    boxes = await page.evaluate("[...document.querySelectorAll('#textChecks input[type=checkbox][data-id]')].map(c => [c.dataset.id, c.checked])")
    for tid, on in boxes:
        if tid not in ids and on:
            await page.click(f'#textChecks input[type=checkbox][data-id="{tid}"]')
            await page.wait_for_timeout(80)


async def set_days(page, n):
    await page.fill('#days', str(n))
    await page.dispatch_event('#days', 'input')
    await page.wait_for_timeout(120)


DUMP = """() => ({
  id: document.getElementById('textChecks').dataset.text,
  rows: [...document.querySelectorAll('.plan tbody tr')].map(tr => [...tr.querySelectorAll('input.cell, textarea.cell')].map(i => i.value)),
  titles: [...document.querySelectorAll('.sheet-title')].map(h => h.textContent),
  info: document.getElementById('textInfo').textContent,
  seq: [...document.querySelectorAll('#levelSeq li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim()),
  prev: document.getElementById('linkPrev').value,
  prevNote: document.getElementById('linkPrevNote').textContent,
  qrs: [...document.querySelectorAll('.sheet-head figure img')].map(i => i.src.length),
  days: document.getElementById('days').value,
})"""


async def dump(page):
    return await page.evaluate(DUMP)


async def wait_save(page, before, out_path=None, timeout=60):
    for _ in range(timeout * 10):
        saves = await page.evaluate('window.__saves.length')
        if saves > before:
            s = await page.evaluate('window.__saves[window.__saves.length - 1]')
            data = base64.b64decode(s['b64'])
            if out_path:
                pathlib.Path(out_path).write_bytes(data)
            return s['filename'], data
        await page.wait_for_timeout(100)
    raise TimeoutError('no file saved')


async def click_save(page, selector, out_path=None):
    if selector in ('#export', '#exportPdf', '#exportXlsx') and not await page.is_visible(selector):
        await page.click('#approve')
        await page.wait_for_timeout(300)
    before = await page.evaluate('window.__saves.length')
    await page.click(selector)
    return await wait_save(page, before, out_path)


def pdf_pages(data):
    p = OUT / '_tmp.pdf'
    p.write_bytes(data)
    out = subprocess.run(['pdfinfo', str(p)], capture_output=True, text=True).stdout
    m = re.search(r'Pages:\s+(\d+)', out)
    return int(m.group(1)) if m else 0
