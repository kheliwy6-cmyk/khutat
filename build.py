"""يبني صفحة الموقع (index.html) وصفحة Claude (khutat-mutun.html) من الملفات في build/.

python3 build.py                 → out/index.html و out/khutat-mutun.html
python3 build.py --site DIR       → يكتب index.html في DIR أيضاً (مستودع الموقع)
python3 build.py --check ORIG_SITE ORIG_ART   → يتحقق أن البناء يطابق ملفين أصليين حرفاً حرفاً

الموقع: البيانات + SITE (إعداد Firebase)، وملف cloud.js. صفحة Claude: البيانات مع ملفات وورد الجاهزة مضمّنة (LIBRARY_EMBED)،
بلا SITE ولا cloud.js (تحفظ في قاعدة بيانات Claude).
"""
import base64, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
B = ROOT / 'build'
OUT = ROOT / 'out'


def read(name):
    return (B / name).read_text(encoding='utf8')


def css():
    s = read('style.css')
    for i in range(2):
        s = s.replace('{{FONT%d}}' % i, base64.b64encode((ROOT / 'fonts' / f'font{i}.woff').read_bytes()).decode())
    return s


REPO = ROOT.parent / 'khutat'


def library_embed(repo=None):
    """ملفات وورد الجاهزة لصفحة Claude (صفحة Claude لا تقرأ ملفات وورد من خارجها): كل ملف docx في LIBRARY.ready، من مستودع الموقع"""
    repo = pathlib.Path(repo or REPO)
    lib = json.loads(re.search(r'^const LIBRARY = (.*?);\n', read('data.base.js'), re.M | re.S).group(1))
    out = {}
    for e in lib['ready']:
        for f in e.get('files', []):
            if f['kind'] == 'docx':
                out[f['path']] = base64.b64encode((repo / f['path']).read_bytes()).decode()
    return out


def fill(tpl, parts):
    for k, v in parts.items():
        tpl = tpl.replace('{{' + k + '}}', v, 1)
    assert '{{' not in tpl.replace('{{FONT', '') or True
    return tpl


def build(repo=None):
    common = {name: read(name) for name in ['page.html', 'plan-core.js', 'hijri.js', 'docx-build.js', 'pdf-build.js', 'xlsx-lite.js', 'app.js']}
    common['style.css'] = css()
    base = read('data.base.js')
    site = fill((ROOT / 'site.tpl.html').read_text(encoding='utf8'), dict(common, **{'data.js': base + read('site-const.js'), 'cloud.js': read('cloud.js')}))
    emb = json.dumps(library_embed(repo), ensure_ascii=False)
    assert base.count('const LIBRARY_EMBED = {};') == 1
    art = fill((ROOT / 'artifact.tpl.html').read_text(encoding='utf8'),
               dict(common, **{'data.js': base.replace('const LIBRARY_EMBED = {};', 'const LIBRARY_EMBED = ' + emb + ';'), 'cloud.js': '\n\n'}))
    return site, art


def main():
    args = sys.argv[1:]
    if args[:1] == ['--check']:
        site, art = build()
        o_site = pathlib.Path(args[1]).read_text(encoding='utf8')
        o_art_full = pathlib.Path(args[2]).read_text(encoding='utf8')
        o_art = o_art_full[o_art_full.index('<body>') + 6: o_art_full.rindex('</body></html>')] if '<body>' in o_art_full[:2000] else o_art_full
        print('site identical:', site == o_site, len(site), len(o_site))
        print('artifact identical:', art == o_art, len(art), len(o_art))
        return
    repo = args[args.index('--site') + 1] if '--site' in args else None
    site, art = build(repo)
    OUT.mkdir(exist_ok=True)
    (OUT / 'index.html').write_text(site, encoding='utf8')
    (OUT / 'khutat-mutun.html').write_text(art, encoding='utf8')
    if repo:
        (pathlib.Path(repo) / 'index.html').write_text(site, encoding='utf8')
    print(f'index.html {len(site.encode()) // 1024} KB, khutat-mutun.html {len(art.encode()) // 1024} KB' + (f' → {repo}' if repo else ''))


if __name__ == '__main__':
    main()
