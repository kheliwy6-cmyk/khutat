import asyncio, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from harness import *
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for build in ('old', 'new'):
            ctx, page, errs = await open_page(b, build)
            await choose_level(page, 5)
            d = await dump(page)
            print(build, d['id'], len(d['rows']), d['rows'][:2], d['titles'][:1], errs[:3])
            await ctx.close()
        await b.close()
asyncio.run(main())
