"""الواجهة الجديدة في «إنشاء خطة»: «البدء» تحت كل متن (من أوله، من صفحة، محفوظ كله)، وإضافة متن أو مستوى كامل بعدها.

١) ما كانت تصنعه الواجهة القديمة يخرج بالواجهة الجديدة متطابقاً (oldmix.json).
٢) ما لم يكن ممكناً قبل: البدء من صفحة في أكثر من متن، ومتن محفوظ في وسط القائمة، وإضافة مستوى كامل، وبدء متن مضاف من صفحة أو جعله محفوظاً.
٣) مراجعة على كل متن: البدء من ثلاث صفحات في كل متن (التغطية والربط والمراجعة).
"""
import asyncio, json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import *
from playwright.async_api import async_playwright

check = Checker()
AR = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')
TEXTS = None


def rng(s):
    m = re.match(r'^(?:(\d+)/)?(\d+)(?:-(\d+))?$', s.translate(AR).replace('‏', '').replace(' ', ''))
    return (int(m.group(1)) if m.group(1) else None, int(m.group(2)), int(m.group(3) or m.group(2))) if m else None


def pages(days):
    out = set()
    for d in days:
        r = rng(d)
        out |= set(range(r[1], r[2] + 1))
    return out


def link_end(cell):
    last = re.split(r'[←+]', cell.translate(AR).replace('‏', ''))[-1]
    r = rng(last)
    return r[2] if r else None


async def set_start(page, tid, mode, pagen=None):
    await page.select_option(f'#textChecks select[data-start="{tid}"]', mode)
    await page.wait_for_timeout(150)
    if mode == 'from' and pagen is not None:
        await page.fill(f'#textChecks input[data-page="{tid}"]', str(pagen))
        await page.press(f'#textChecks input[data-page="{tid}"]', 'Enter')
        await page.wait_for_timeout(200)


async def append(page, value):
    await page.select_option('#appendText', value)
    await page.wait_for_timeout(200)


async def fresh(page, url):
    await page.goto('about:blank')
    await page.goto(url)
    await page.evaluate('localStorage.clear()')
    await page.reload()
    await page.wait_for_selector('.sheet')


NEW_STEPS = {
    'L5 waraqat@40': (5, None, [('start', 'waraqat', 'from', 40)]),
    'L5 ~waraqat ~unwan rahbiya@100': (5, None, [('start', 'waraqat', 'done'), ('start', 'unwan', 'done'), ('start', 'rahbiya', 'from', 100)]),
    'L5 ~waraqat ~unwan rahbiya': (5, None, [('start', 'waraqat', 'done'), ('start', 'unwan', 'done')]),
    'L1 mukhtasar45@50': (1, None, [('start', 'mukhtasar45', 'from', 50)]),
    'L4 ~bayquni ~ilbiri ajurrumiya@80 +waraqat': (4, None, [('start', 'bayquni', 'done'), ('start', 'ilbiri', 'done'), ('start', 'ajurrumiya', 'from', 80), ('append', 'waraqat')]),
    'L3 +bulugh': (3, None, [('append', 'bulugh')]),
    'L5 tahawiya@150': (5, ['tahawiya'], [('start', 'tahawiya', 'from', 150)]),
    'L2 ~arbaeen nawaqid..': (2, None, [('start', 'arbaeen', 'done')]),
    'L6 bulugh@100 zad': (6, None, [('start', 'bulugh', 'from', 100)]),
    'L7 umda@100': (7, None, [('start', 'umda', 'from', 100)]),
    'L5 ~waraqat ~unwan rahbiya@100 +umda': (5, None, [('start', 'waraqat', 'done'), ('start', 'unwan', 'done'), ('start', 'rahbiya', 'from', 100), ('append', 'umda')]),
    'L2 +tuhfa +shurut': (2, None, [('append', 'tuhfa'), ('append', 'shurut')]),
}


async def run_steps(page, lvl, checked, steps):
    await choose_level(page, lvl)
    if checked:
        await set_checked(page, checked)
    for st in steps:
        if st[0] == 'start':
            await set_start(page, st[1], st[2], st[3] if len(st) > 3 else None)
        else:
            await append(page, st[1])


async def main():
    global TEXTS
    TEXTS = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx, page, errs = await open_page(b, owner=True)
        url = page.url.split('#')[0] + '#create'
        TEXTS = {t['id']: t for t in await page.evaluate('TEXTS.map(t => ({id: t.id, level: t.level, days: t.days, name: t.name}))')}

        # ١) مطابقة الواجهة القديمة
        old = json.loads((OUT / 'oldmix.json').read_text(encoding='utf8'))
        for name, (lvl, checked, steps) in NEW_STEPS.items():
            await fresh(page, url)
            await run_steps(page, lvl, checked, steps)
            d = await dump(page)
            o = old[name]
            same = d == o
            check(same, f'same plan as the old start-page/append UI: {name} → {d["id"]}' + ('' if same else f' (old {o["id"]}; differs in {[k for k in o if o[k] != d.get(k)]})'))

        # ٢) ما صار ممكناً
        # البدء من صفحة في متنين
        await fresh(page, url)
        await run_steps(page, 5, None, [('start', 'waraqat', 'from', 40), ('start', 'rahbiya', 'from', 100)])
        d = await dump(page)
        memo = pages([r[0] for r in d['rows']])
        want = {x for x in pages(TEXTS['waraqat']['days']) if x >= 40} | pages(TEXTS['unwan']['days']) | {x for x in pages(TEXTS['rahbiya']['days']) if x >= 100} | pages(TEXTS['tahawiya']['days'])
        seq = ' | '.join(d['seq'])
        check(d['id'] == 'mix:waraqat@40;unwan;rahbiya@100;tahawiya' and memo == want, f'two start pages in one plan: {d["id"]}, {len(d["rows"])} days')
        check(link_end(d['rows'][0][1]) == 39 and 'الورقات في أصول الفقه إلى صفحة ٣٩' in seq and 'المنظومة الرحبية إلى صفحة ٩٩' in seq, 'day-1 linking ends at page 39; both memorised parts are reviewed')
        tdays = await page.evaluate("[...document.querySelectorAll('#textChecks .tcheck .tdays')].map(x => x.textContent)")
        check(len(await page.query_selector_all('#textChecks .tstart')) == 4, 'a start line under every text in the plan')

        # متن محفوظ في وسط القائمة
        await fresh(page, url)
        await run_steps(page, 5, None, [('start', 'unwan', 'done')])
        d = await dump(page)
        check(d['id'] == 'mix:waraqat;~unwan;rahbiya;tahawiya' and 'عنوان الحكم' in ' | '.join(d['seq']) and d['prev'] == 'wasitiya',
              f'a memorised text in the middle: {d["id"]}, reviewed, linking from the level before ({d["prev"]})')
        check(not any('عنوان' in r[3] for r in d['rows'][:1]) and pages([r[0] for r in d['rows']]).isdisjoint(pages(TEXTS['unwan']['days'])), 'the memorised text is not memorised again')

        # إضافة مستوى كامل، ثم إزالته
        await fresh(page, url)
        await choose_level(page, 3)
        opts = await page.evaluate("[...document.querySelectorAll('#appendText option')].map(o => o.value)")
        check('level:6' in opts and 'level:3' not in opts and 'level:7' not in opts, f'append list offers whole levels: {[o for o in opts if o.startswith("level:")]}')
        await append(page, 'level:6')
        d = await dump(page)
        check(d['id'] == 'mix:tuhfa;shurut;tawheed;bulugh;zad' and d['titles'][0].startswith('خطة المتون'), f'level 6 appended after level 3: {d["id"]}')
        check(await page.locator('[data-unappend-level="6"]').count() == 1, 'appended level has a remove-level button')
        await page.click('[data-unappend-level="6"]')
        await page.wait_for_timeout(200)
        check(await current_text(page) == 'level-3', 'removing the appended level: back to level 3 alone')

        # المستوى الأول بعد الثاني
        await choose_level(page, 2)
        await append(page, 'level:1')
        d = await dump(page)
        opts = await page.evaluate("[...document.querySelectorAll('#appendText option')].map(o => o.value)")
        check(d['id'] == 'mix:arbaeen;nawaqid;qawaid;usul;mukhtasar45;adhkar' and 'mukhtasar41' not in opts, f'level 1 appended after level 2 (edition 45, no second edition offered): {d["id"]}')

        # متن مضاف يبدأ من صفحة، ومتن مضاف محفوظ
        await fresh(page, url)
        await run_steps(page, 3, None, [('append', 'bulugh'), ('start', 'bulugh', 'from', 100)])
        d = await dump(page)
        last = rng(d['rows'][-1][0])
        check(d['id'] == 'mix:tuhfa;shurut;tawheed;bulugh@100' and 'بلوغ المرام إلى صفحة ٩٩' in ' | '.join(d['seq']) and last[2] == 363,
              f'appended text from a page: {d["id"]}, its memorised part reviewed')
        await set_start(page, 'bulugh', 'done')
        d = await dump(page)
        check(d['id'] == 'mix:tuhfa;shurut;tawheed;~bulugh' and 'بلوغ' in ' | '.join(d['seq']) and len(d['rows']) == 63, f'appended text marked memorised: review only ({len(d["rows"])} days)')

        # حدود: لا يُعلَّم كل شيء محفوظاً، وصفحة خارج المتن مرفوضة، وأول صفحة تعني من أوله
        await fresh(page, url)
        await choose_level(page, 6)
        await set_start(page, 'bulugh', 'done')
        await set_start(page, 'zad', 'done')
        note = await page.inner_text('#textChecksNote')
        check(await current_text(page) == 'mix:~bulugh;zad' and 'يبقى متن واحد' in note, f'cannot mark every text memorised: {note}')
        await set_start(page, 'zad', 'from', 999)
        hint = await page.inner_text('#textChecks [data-hint="zad"]')
        check('اكتب صفحة من' in hint and await current_text(page) == 'mix:~bulugh;zad', f'a page outside the text is refused: {hint}')
        await page.fill('#textChecks input[data-page="zad"]', '13')
        await page.press('#textChecks input[data-page="zad"]', 'Enter')
        await page.wait_for_timeout(200)
        check(await current_text(page) == 'mix:~bulugh;zad', 'the first page of a text means from its beginning')
        await set_start(page, 'bulugh', 'whole')
        check(await current_text(page) == 'level-6', 'all back to whole: the level plan again')

        # تبديل طبعة المختصر في خطة تبدأ من صفحة
        await choose_level(page, 1)
        await set_start(page, 'mukhtasar45', 'from', 50)
        await page.select_option('#l1Edition', 'mukhtasar41')
        await page.wait_for_timeout(250)
        check(await current_text(page) == 'mix:mukhtasar41@50;adhkar', 'switching the Mukhtasar edition keeps the start page: ' + await current_text(page))

        # الحفظ والفتح وإعادة فتح الصفحة
        await fresh(page, url)
        await run_steps(page, 5, None, [('start', 'waraqat', 'from', 40), ('start', 'unwan', 'done'), ('append', 'level:6'), ('start', 'zad', 'from', 200)])
        want_id = 'mix:waraqat@40;~unwan;rahbiya;tahawiya;bulugh;zad@200'
        check(await current_text(page) == want_id, 'complex plan: ' + await current_text(page))
        rows_before = (await dump(page))['rows']
        await page.reload()
        await page.wait_for_selector('.sheet')
        await page.wait_for_timeout(300)
        d = await dump(page)
        sel = await page.evaluate("[...document.querySelectorAll('#textChecks select[data-start]')].map(s => s.dataset.start + ':' + s.value)")
        check(d['id'] == want_id and d['rows'] == rows_before and 'unwan:done' in sel and 'zad:from' in sel, f'remembered after reload with its start lines: {sel}')
        name, data = await click_save(page, '#exportPdf', OUT / 'complex.pdf')
        check(pdf_pages(data) == -(-len(d['rows']) // 22), f'PDF of the complex plan: {pdf_pages(data)} pages for {len(d["rows"])} days')
        name, data = await click_save(page, '#export', OUT / 'complex.docx')
        check(name.endswith('.docx') and data[:2] == b'PK', 'Word of the complex plan: ' + name)
        await page.click('#approve')
        await page.wait_for_timeout(500)
        check('حُفظت' in await page.inner_text('#approvedNote'), 'approved and saved')
        await page.goto(url.replace('#create', '#saved'))
        await page.wait_for_timeout(500)
        await page.click('#libList [data-open]')
        await page.wait_for_timeout(500)
        check(await current_text(page) == want_id and (await dump(page))['rows'] == rows_before, 'the saved plan opens as it was')

        # ٣) كل متن من ثلاث صفحات
        bad = []
        for tid, t in TEXTS.items():
            allp = sorted(pages(t['days']))
            for frm in sorted({allp[1], allp[len(allp) // 2], allp[-1]}):
                await choose_level(page, t['level'])
                lvl_ids = await page.evaluate("[...document.querySelectorAll('#textChecks input[type=checkbox][data-id]')].map(c => c.dataset.id)")
                if tid not in lvl_ids:
                    await page.select_option('#l1Edition', tid)
                    await page.wait_for_timeout(150)
                await set_checked(page, [tid])
                await set_start(page, tid, 'from', frm)
                d = await dump(page)
                got = pages([r[0] for r in d['rows']])
                before = max([x for x in allp if x < frm], default=None)
                ok = got == {x for x in allp if x >= frm} and d['id'] == f'mix:{tid}@{frm}' and link_end(d['rows'][0][1]) == before and 'إلى صفحة' in ' | '.join(d['seq'])
                if not ok:
                    bad.append(f'{tid}@{frm}: {d["id"]} link {d["rows"][0][1]}')
                await set_start(page, tid, 'whole')
        check(not bad, f'start page in every text (21 texts × 3 pages): {len(bad)} problems {bad[:3]}')

        # عرض الجوال
        m = await ctx.new_page()
        await m.set_viewport_size({'width': 390, 'height': 844})
        await m.goto(url)
        await m.wait_for_selector('.sheet')
        await m.select_option('#level', '5')
        await m.wait_for_timeout(200)
        await m.select_option('#textChecks select[data-start="waraqat"]', 'from')
        await m.wait_for_timeout(200)
        await m.select_option('#appendText', 'level:6')
        await m.wait_for_timeout(300)
        w = await m.evaluate('document.documentElement.scrollWidth')
        await m.locator('#textChecks').screenshot(path=str(OUT / 'mobile-texts.png'))
        check(w <= 390, f'phone width: no horizontal scroll ({w}px)')
        check(not errs, 'no page errors: ' + '; '.join(errs[:3]))
        await b.close()
    print('FAILURES:', len(check.fails), 'of', check.n)


if __name__ == '__main__':
    asyncio.run(main())
