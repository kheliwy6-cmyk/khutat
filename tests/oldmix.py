"""يسجّل خطط «البدء من صفحة» و«إضافة متن» في البناء القديم (بواجهته القديمة)، لتُقارن بها الواجهة الجديدة (البدء تحت كل متن).

python3 oldmix.py → out/test/oldmix.json
"""
import asyncio, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import *
from playwright.async_api import async_playwright


async def start_at(page, text=None, pagen=None):
    if not await page.is_checked('#startOn'):
        await page.check('#startOn')
        await page.wait_for_timeout(120)
    if text:
        await page.select_option('#startText', text)
        await page.wait_for_timeout(200)
    if pagen:
        await page.fill('#startPage', str(pagen))
        await page.press('#startPage', 'Enter')
        await page.wait_for_timeout(200)


async def append(page, tid):
    await page.select_option('#appendText', tid)
    await page.wait_for_timeout(200)


# الاسم ← (المستوى، المتون المعلَّمة، خطوات الواجهة القديمة)
CASES = {
    'L5 waraqat@40': (5, None, [('start', None, 40)]),
    'L5 ~waraqat ~unwan rahbiya@100': (5, None, [('start', 'rahbiya', 100)]),
    'L5 ~waraqat ~unwan rahbiya': (5, None, [('start', 'rahbiya', None)]),
    'L1 mukhtasar45@50': (1, None, [('start', None, 50)]),
    'L4 ~bayquni ~ilbiri ajurrumiya@80 +waraqat': (4, None, [('start', 'ajurrumiya', 80), ('append', 'waraqat')]),
    'L3 +bulugh': (3, None, [('append', 'bulugh')]),
    'L5 tahawiya@150': (5, ['tahawiya'], [('start', None, 150)]),
    'L2 ~arbaeen nawaqid..': (2, None, [('start', 'nawaqid', None)]),
    'L6 bulugh@100 zad': (6, None, [('start', None, 100)]),
    'L7 umda@100': (7, None, [('start', None, 100)]),
    'L5 ~waraqat ~unwan rahbiya@100 +umda': (5, None, [('start', 'rahbiya', 100), ('append', 'umda')]),
    'L2 +tuhfa +shurut': (2, None, [('append', 'tuhfa'), ('append', 'shurut')]),
}


async def main():
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await new_context(b)
        page = await ctx.new_page()
        errs = []
        page.on('pageerror', lambda e: errs.append(str(e)))
        serve()
        url = f'http://127.0.0.1:{PORT}/old/khutat-mutun.html#create'
        for name, (lvl, checked, steps) in CASES.items():
            await page.goto('about:blank')
            await page.goto(url)
            await page.evaluate('localStorage.clear()')
            await page.reload()
            await page.wait_for_selector('.sheet')
            await choose_level(page, lvl)
            if checked:
                await set_checked(page, checked)
            for st in steps:
                if st[0] == 'start':
                    await start_at(page, st[1], st[2])
                else:
                    await append(page, st[1])
            res[name] = await dump(page)
            print(name, res[name]['id'], len(res[name]['rows']))
        res['_errors'] = errs
        await b.close()
    (OUT / 'oldmix.json').write_text(json.dumps(res, ensure_ascii=False, indent=0), encoding='utf8')
    print('errors:', errs[:3])


asyncio.run(main())
