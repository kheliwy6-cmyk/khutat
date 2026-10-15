"""مقارنة البناء الجديد بالمنشور قبل التعديل: خطط كثيرة بالإعدادات نفسها يجب أن تخرج متطابقة (الأيام والربط والمراجعة والملاحظات والعناوين).

python3 regress.py old   → يسجّل نتائج البناء القديم
python3 regress.py new   → يشغّل البناء الجديد ويقارن
"""
import asyncio, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import *
from playwright.async_api import async_playwright

LEVELS = {1: ['mukhtasar45', 'adhkar'], 2: ['arbaeen', 'nawaqid', 'qawaid', 'usul'], 3: ['tuhfa', 'shurut', 'tawheed'],
          4: ['bayquni', 'ilbiri', 'ajurrumiya', 'wasitiya'], 5: ['waraqat', 'unwan', 'rahbiya', 'tahawiya'], 6: ['bulugh', 'zad'], 7: ['umda']}


def scenarios():
    out = []
    for L, ids in LEVELS.items():
        out.append((f'L{L}', [('level', L)]))
        if len(ids) > 1:
            for t in ids:
                out.append((f'L{L}-{t}', [('level', L), ('check', [t])]))
        if len(ids) >= 3:
            out.append((f'L{L}-first-last', [('level', L), ('check', [ids[0], ids[-1]])]))
            out.append((f'L{L}-no-first', [('level', L), ('check', ids[1:])]))
    out += [
        ('L3-half', [('level', 3), ('days', 32)]),
        ('L3-double', [('level', 3), ('days', 126)]),
        ('tahawiya-7', [('level', 5), ('check', ['tahawiya']), ('days', 7)]),
        ('bulugh-60', [('level', 6), ('check', ['bulugh']), ('days', 60)]),
        ('L4-link-days', [('level', 4), ('radio', '#linkByDays')]),
        ('L4-link-pages5', [('level', 4), ('fill', '#linkPages', '5')]),
        ('L4-link-off', [('level', 4), ('box', '#withLink', False)]),
        ('L4-link-nocont', [('level', 4), ('box', '#linkCont', False)]),
        ('L2-review-off', [('level', 2), ('box', '#withReview', False)]),
        ('L5-review-list', [('level', 5), ('method', 'methodList')]),
        ('L5-review-pages10', [('level', 5), ('fill', '#levelPages', '10')]),
        ('L5-review-noself', [('level', 5), ('box', '#levelSelf', False)]),
        ('L5-review-norepeat', [('level', 5), ('box', '#reviewRepeat', False)]),
        ('L6-review-start3', [('level', 6), ('box', '#levelStartOn', True), ('select', '#levelStart', '3')]),
        ('L1-ed41', [('level', 1), ('select', '#l1Edition', 'mukhtasar41')]),
        ('L1-ed41-only', [('level', 1), ('select', '#l1Edition', 'mukhtasar41'), ('check', ['mukhtasar41'])]),
        ('L2-ed41-review', [('level', 1), ('select', '#l1Edition', 'mukhtasar41'), ('level', 2)]),
        ('umda-40', [('level', 7), ('days', 40)]),
    ]
    return out


async def run_actions(page, acts):
    for a in acts:
        k = a[0]
        if k == 'level':
            await choose_level(page, a[1])
        elif k == 'check':
            await set_checked(page, a[1])
        elif k == 'days':
            await set_days(page, a[1])
        elif k == 'radio':
            await page.check(a[1])
        elif k == 'fill':
            await page.fill(a[1], a[2])
            await page.dispatch_event(a[1], 'input')
        elif k == 'box':
            if a[2]:
                await page.check(a[1])
            else:
                await page.uncheck(a[1])
        elif k == 'method':
            await page.click(f'label.method:has(#{a[1]})')
        elif k == 'select':
            await page.select_option(a[1], a[2])
        await page.wait_for_timeout(120)


async def run(build):
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await new_context(b)
        page = await ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        serve()
        url = f'http://127.0.0.1:{PORT}/{build}/khutat-mutun.html#create'
        for name, acts in scenarios():
            await page.goto('about:blank')
            await page.goto(url)
            await page.evaluate('localStorage.clear()')
            await page.reload()
            await page.wait_for_selector('.sheet')
            await run_actions(page, acts)
            res[name] = await dump(page)
        res['_errors'] = errs
        await b.close()
    return res


def main():
    build = sys.argv[1]
    res = asyncio.run(run(build))
    path = OUT / f'regress-{build}.json'
    path.write_text(json.dumps(res, ensure_ascii=False, indent=0), encoding='utf8')
    print(build, len(res) - 1, 'scenarios; errors:', res['_errors'][:3])
    if build == 'new':
        old = json.loads((OUT / 'regress-old.json').read_text(encoding='utf8'))
        bad = 0
        for k, v in old.items():
            if k == '_errors':
                continue
            n = res.get(k)
            if n != v:
                bad += 1
                diffs = [f for f in v if n is None or v[f] != n.get(f)]
                print('DIFF', k, diffs)
                for f in diffs[:2]:
                    a, c = v[f], (n or {}).get(f)
                    if isinstance(a, list):
                        for i, (x, y) in enumerate(zip(a, c or [])):
                            if x != y:
                                print('   ', f, i, x, '→', y)
                                break
                        if len(a) != len(c or []):
                            print('   ', f, 'len', len(a), '→', len(c or []))
                    else:
                        print('   ', f, a, '→', c)
        print('FAILURES:', bad, 'of', len(old) - 1)


if __name__ == '__main__':
    main()
