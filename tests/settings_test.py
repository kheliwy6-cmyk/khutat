"""الإعدادات التلقائية للخطط في لوحة التحكم: الربط والمراجعة الكبرى وما يظهر في الخطة، وإعلان الصفحة الرئيسية.

صفحة Claude (صاحب الصفحة) وصفحة الموقع (مشرف بحساب Google): الحفظ، وتطبيقها عند الزوار (الجدد ومن غيّر إعداداته من قبل)،
وبقاء ما يغيّره الزائر بعدها، وزر «استعادة الإعدادات التلقائية»، والخطة المحفوظة المفتوحة لا تتغير، والنسخة الاحتياطية.
"""
import asyncio, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import *
from playwright.async_api import async_playwright

check = Checker()
OWNER = 'kheliwy6@gmail.com'


async def fill_input(page, sel, v):
    await page.fill(sel, v)
    await page.dispatch_event(sel, 'input')


async def set_defaults(page):
    """إعدادات تجريبية: الربط ٥ أيام، والمراجعة بالقائمة ٣٠ صفحة، والمستويات ١٥ صفحة، ولا تعود الدورة، واسم الطالب والحلقة، والدراسة من السبت إلى الأربعاء، وإعلان"""
    await page.check('#dLinkDays')
    await fill_input(page, '#dLinkDaysN', '٥')
    await fill_input(page, '#dLinkPagesN', '8')
    await page.check('#dRevList')
    await fill_input(page, '#dRevPages', '15')
    await fill_input(page, '#dRevItemN', '30')
    await page.uncheck('#dRevRepeat')
    await page.check('#dStudent')
    await page.check('#dHalaqa')
    # الأيام: السبت (٦) بدلاً من الخميس (٤)
    await page.click('#dWeekdays [data-wd="4"]')
    await page.click('#dWeekdays [data-wd="6"]')
    await page.fill('#dNotice', 'تنبيه: خطط الفصل الثاني متاحة.\nالسطر الثاني.')
    await page.click('#dSave')
    for _ in range(50):
        if 'حُفظت' in await page.inner_text('#defaultsStatus'):
            break
        await page.wait_for_timeout(100)


async def plan_state(page):
    return await page.evaluate("""() => ({
      linkDays: document.getElementById('linkByDays').checked, linkDaysN: document.getElementById('linkDays').value,
      linkPagesN: document.getElementById('linkPages').value,
      list: document.getElementById('methodList').checked,
      item: (document.querySelector('.ritem-val') || {}).value,
      repeat: document.getElementById('reviewRepeat').checked,
      student: document.getElementById('withStudent').checked, halaqa: document.getElementById('withHalaqa').checked,
    })""")


async def manual_equivalent(browser, build_site=False):
    """خطة المستوى الخامس بالإعدادات نفسها يضعها زائر بيده (بلا إعدادات تلقائية)"""
    ctx, page, errs = await open_page(browser, site=build_site)
    await choose_level(page, 5)
    await page.check('#linkByDays')
    await fill_input(page, '#linkDays', '5')
    await page.click('label.method:has(#methodList)')
    await page.wait_for_timeout(150)
    await fill_input(page, '.ritem-val', '30')
    await page.uncheck('#reviewRepeat')
    await page.wait_for_timeout(200)
    d = await dump(page)
    await ctx.close()
    return d


async def artifact(b):
    print('— صفحة Claude')
    ctx, page, errs = await open_page(b, owner=True, hash_='admin')
    await page.wait_for_selector('#adminDefaults:not([hidden])')
    base = await page.evaluate("""() => [document.getElementById('dLinkPagesN').value, document.getElementById('dRevPages').value,
      document.getElementById('dRevItemN').value, document.getElementById('dLinkOn').checked, document.getElementById('dRevLevels').checked,
      [...document.querySelectorAll('#dWeekdays [aria-pressed=true]')].map(b => +b.dataset.wd)]""")
    check(base == ['١٠', '٢٠', '٢٠', True, True, [0, 1, 2, 3, 4]], f'control panel shows the built-in defaults: {base}')
    await set_defaults(page)
    st = await page.inner_text('#defaultsStatus')
    store = await page.evaluate('window.__fakedb')
    doc = store.get('config/settings')
    check('حُفظت' in st and doc and doc['settings']['link'] == {'enabled': True, 'mode': 'days', 'pages': 8, 'days': 5, 'cont': True}, f'saved to config/settings: {st}')
    # تُطبَّق على صاحب الصفحة مباشرة
    await page.evaluate("location.hash = 'create'")
    await page.wait_for_timeout(300)
    await choose_level(page, 5)
    s = await plan_state(page)
    check(s['linkDays'] and s['linkDaysN'] == '٥' and s['list'] and s['item'] == '٣٠' and not s['repeat'] and s['student'] and s['halaqa'], f'owner plan uses them at once: {s}')
    seed = {'config/settings': doc}
    await ctx.close()

    # زائر جديد: الخطة بالإعدادات التلقائية، مثلها إذا ضبطها بيده
    want = await manual_equivalent(b)
    ctx, page, errs = await open_page(b, seed=seed)
    await page.wait_for_timeout(300)
    await choose_level(page, 5)
    d = await dump(page)
    s = await plan_state(page)
    check(d['rows'] == want['rows'] and s['student'] and s['halaqa'], f'new visitor: the same level-5 plan as setting them by hand ({len(d["rows"])} days)')
    await page.check('#withDates')
    await page.wait_for_timeout(200)
    wd = await page.evaluate("[...document.querySelectorAll('#weekdays [aria-pressed=true]')].map(b => +b.dataset.wd)")
    await page.uncheck('#withDates')
    await page.wait_for_timeout(150)
    check(wd == [0, 1, 2, 3, 6], f'study days from the settings: {wd}')
    await page.evaluate("location.hash = 'ready'")
    await page.wait_for_timeout(200)
    notice = await page.inner_text('#siteNotice') if await page.is_visible('#siteNotice') else None
    check(notice == 'تنبيه: خطط الفصل الثاني متاحة.\nالسطر الثاني.', f'notice on the home page: {notice!r}')
    # يغيّر الزائر الربط فيبقى بعد إعادة الفتح
    await page.evaluate("location.hash = 'create'")
    await page.wait_for_timeout(200)
    await page.check('#linkByPages')
    await fill_input(page, '#linkPages', '12')
    await page.wait_for_timeout(150)
    await page.reload()
    await page.wait_for_selector('.sheet')
    await page.wait_for_timeout(300)
    s = await plan_state(page)
    check(not s['linkDays'] and s['linkPagesN'] == '١٢', f'the visitor\'s own change stays after reload: {s}')
    # استعادة الإعدادات التلقائية
    await page.click('#resetDefaults')
    await page.wait_for_timeout(200)
    s = await plan_state(page)
    check(s['linkDays'] and s['linkDaysN'] == '٥' and s['list'], f'«restore defaults» brings the owner settings back: {s}')
    await ctx.close()

    # زائر قديم غيّر إعداداته قبل أن تُحفظ الإعدادات: تعود إلى الأصل الجديد
    ctx = await new_context(b)
    page = await ctx.new_page()
    serve()
    url = f'http://127.0.0.1:{PORT}/new/khutat-mutun.html#create'
    await page.goto(url)
    await page.wait_for_selector('.sheet')
    await page.check('#linkByPages')
    await fill_input(page, '#linkPages', '3')
    await page.wait_for_timeout(200)
    # يحفظ صاحب الصفحة الإعدادات (قاعدة البيانات نفسها في هذا المتصفح)
    await page.evaluate("doc => { const s = JSON.parse(localStorage.getItem('__fakedb_claude') || '{}'); s['config/settings'] = doc; localStorage.setItem('__fakedb_claude', JSON.stringify(s)); }", doc)
    await page.reload()
    await page.wait_for_selector('.sheet')
    await page.wait_for_timeout(400)
    s = await plan_state(page)
    check(s['linkDays'] and s['linkDaysN'] == '٥', f'a returning visitor\'s old settings give way to the new defaults: {s}')
    await ctx.close()

    # إعدادات تتغير وخطة محفوظة مفتوحة: لا تتغير الخطة
    ctx, page, errs = await open_page(b, owner=True)
    await choose_level(page, 3)
    await page.click('#approve')
    await page.wait_for_timeout(400)
    await page.evaluate("location.hash = 'saved'")
    await page.wait_for_timeout(300)
    await page.click('#libList [data-open]')
    await page.wait_for_timeout(400)
    before = (await dump(page))['rows']
    await page.evaluate("location.hash = 'admin'")
    await page.wait_for_timeout(300)
    await set_defaults(page)
    await page.evaluate("location.hash = 'create'")
    await page.wait_for_timeout(300)
    check((await dump(page))['rows'] == before, 'an opened saved plan keeps its own settings when the defaults change')
    # ملء الإعدادات الأصلية ثم الحفظ
    await page.evaluate("location.hash = 'admin'")
    await page.wait_for_timeout(300)
    await page.click('#dReset')
    await page.click('#dSave')
    await page.wait_for_timeout(400)
    doc2 = (await page.evaluate('window.__fakedb'))['config/settings']
    check(doc2['settings']['link']['pages'] == 10 and doc2['settings']['review']['method'] == 'levels' and doc2['settings']['notice'] == '', 'built-in defaults saved back')
    await page.evaluate("location.hash = 'ready'")
    await page.wait_for_timeout(200)
    check(not await page.is_visible('#siteNotice'), 'empty notice is hidden')
    check(not errs, 'no page errors: ' + '; '.join(errs[:3]))
    await ctx.close()


async def site(b):
    print('— الموقع (Firebase)')
    ctx, page, errs = await open_page(b, site=True, sign_in_as=OWNER)
    await page.click('#ownerIn')
    for _ in range(50):
        if OWNER in await page.inner_text('#ownerInfo'):
            break
        await page.wait_for_timeout(100)
    await page.evaluate("location.hash = 'admin'")
    await page.wait_for_selector('#adminDefaults:not([hidden])')
    await set_defaults(page)
    store = await page.evaluate('globalThis.__fakefs()')
    doc = store.get('config/settings')
    check(doc and doc['settings']['review']['itemValue'] == 30, 'site: the admin saves config/settings in Firestore')
    # نسخة احتياطية فيها الإعدادات
    async with page.expect_download() as dl:
        await page.click('#backupDown')
    f = await dl.value
    path = OUT / 'backup.json'
    await f.save_as(path)
    data = json.loads(path.read_text(encoding='utf8'))
    check(data.get('settings', {}).get('link', {}).get('days') == 5, 'site: the backup includes the settings')
    await ctx.close()
    # زائر (بلا دخول) يقرأ الإعدادات
    want = await manual_equivalent(b, build_site=True)
    ctx, page, errs = await open_page(b, site=True, seed={'config/settings': doc})
    await page.wait_for_timeout(500)
    await choose_level(page, 5)
    d = await dump(page)
    check(d['rows'] == want['rows'], f'site visitor: the plan follows the saved defaults ({len(d["rows"])} days)')
    # الزائر لا يستطيع الحفظ
    await page.evaluate("location.hash = 'ready'")
    await page.wait_for_timeout(300)
    check(await page.is_visible('#siteNotice') and not await page.is_visible('#navAdmin'), 'site visitor: sees the notice, not the control panel')
    # استرجاع النسخة الاحتياطية يعيد الإعدادات
    ctx2, page2, errs2 = await open_page(b, site=True, sign_in_as=OWNER, hash_='create')
    await page2.click('#ownerIn')
    await page2.wait_for_timeout(500)
    await page2.evaluate("location.hash = 'admin'")
    await page2.wait_for_selector('#adminBackup:not([hidden])')
    await page2.set_input_files('#backupFile', str(path))
    await page2.wait_for_timeout(300)
    await page2.click('#backupConfirm')
    await page2.wait_for_timeout(600)
    st = await page2.inner_text('#backupStatus')
    store = await page2.evaluate('globalThis.__fakefs()')
    check('الإعدادات' in st and store.get('config/settings', {}).get('settings', {}).get('link', {}).get('days') == 5, f'site: restoring the backup brings the settings back: {st}')
    check(not errs and not errs2, 'site: no page errors ' + '; '.join((errs + errs2)[:3]))


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await artifact(b)
        await site(b)
        await b.close()
    print('FAILURES:', len(check.fails), 'of', check.n)


if __name__ == '__main__':
    asyncio.run(main())
