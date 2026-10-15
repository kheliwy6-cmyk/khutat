"""فحص سريع لصفحة الموقع (Firebase): زائر يعتمد خطة فيها «بدء» ومتن مضاف فتُحفظ، ورابط الواتساب يفتحها، وصاحب الموقع يحذفها،
والخطط الجاهزة والمتون تظهر، ولوحة التحكم لا تظهر للزائر."""
import asyncio, json, re, sys, pathlib, urllib.parse
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import *
from features_test import set_start, append
from playwright.async_api import async_playwright

check = Checker()
OWNER = 'kheliwy6@gmail.com'


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx, page, errs = await open_page(b, site=True)
        check(not await page.is_visible('#navAdmin'), 'visitor: no control panel tab')
        await choose_level(page, 4)
        await set_start(page, 'bayquni', 'done')
        await set_start(page, 'ilbiri', 'from', 45)
        await append(page, 'umda')
        tid = await current_text(page)
        rows = (await dump(page))['rows']
        await page.select_option('#teacher', index=2)
        await page.click('#approve')
        for _ in range(50):
            if 'حُفظت' in await page.inner_text('#approvedNote'):
                break
            await page.wait_for_timeout(100)
        note = await page.inner_text('#approvedNote')
        store = await page.evaluate('globalThis.__fakefs()')
        plans = {k: v for k, v in store.items() if k.startswith('plans/')}
        saved = list(plans.values())[0] if plans else {}
        check('حُفظت' in note and len(plans) == 1 and saved.get('textId') == tid and saved.get('by', '').startswith('anon-'), f'visitor approval saves the plan ({tid}) as its anonymous author')
        await page.evaluate("location.hash = 'saved'")
        await page.wait_for_timeout(600)
        wa = await page.get_attribute('#libList a.wa-link', 'href')
        link = urllib.parse.unquote(wa.split('text=')[1]).split('\n')[-1] if wa else ''
        check(wa and wa.startswith('https://wa.me/?text=') and '#plan=' in link, f'WhatsApp link with the plan link: {link[-40:]}')
        await ctx.close()
        # الرابط المرسل يفتح الخطة عند غيره
        ctx, page, errs2 = await open_page(b, site=True, seed=store, hash_='plan=' + link.split('#plan=')[1])
        await page.wait_for_selector('.sheet')
        for _ in range(50):
            if await current_text(page) == tid:
                break
            await page.wait_for_timeout(100)
        d = await dump(page)
        check(d['id'] == tid and d['rows'] == rows, 'the shared link opens the same plan')
        sel = await page.evaluate("[...document.querySelectorAll('#textChecks select[data-start]')].map(s => s.dataset.start + ':' + s.value)")
        check('bayquni:done' in sel and 'ilbiri:from' in sel and 'umda:whole' in sel, f'with its start lines: {sel}')
        await ctx.close()
        # صاحب الموقع يحذفها
        ctx, page, errs3 = await open_page(b, site=True, seed=store, sign_in_as=OWNER, hash_='saved')
        await page.click('#ownerIn')
        for _ in range(50):
            if await page.is_visible('#navAdmin'):
                break
            await page.wait_for_timeout(100)
        await page.wait_for_timeout(500)
        await page.click('#libList [data-del]')
        await page.wait_for_timeout(200)
        await page.click('#libList [data-del]')
        await page.wait_for_timeout(600)
        store2 = await page.evaluate('globalThis.__fakefs()')
        check(not any(k.startswith('plans/') for k in store2), 'the owner deletes it (two clicks)')
        await page.evaluate("location.hash = 'ready'")
        await page.wait_for_timeout(500)
        n_ready = await page.evaluate("document.querySelectorAll('#readyList .lib-item').length")
        await page.evaluate("location.hash = 'texts'")
        await page.wait_for_timeout(500)
        n_texts = await page.evaluate("document.querySelectorAll('#textsList .lib-item').length")
        check(n_ready == 12 and n_texts == 9, f'ready plans and texts listed ({n_ready}, {n_texts})')
        allerr = errs + errs2 + errs3
        check(not allerr, 'no page errors: ' + '; '.join(allerr[:3]))
        await b.close()
    print('FAILURES:', len(check.fails), 'of', check.n)


if __name__ == '__main__':
    asyncio.run(main())
