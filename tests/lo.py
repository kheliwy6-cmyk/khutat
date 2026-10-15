"""LibreOffice بلا واجهة عبر UNO: فتح ملف اكسل وإعادة حساب صيغه وقراءة القيم (لاختبار ملف التسجيل اليومي)."""
import pathlib, subprocess, tempfile, time
import uno
from com.sun.star.beans import PropertyValue

PORT = 2003


def prop(name, value):
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


class LO:
    def __init__(self):
        self.profile = tempfile.mkdtemp(prefix='lo-prof-')
        self.proc = subprocess.Popen(['soffice', '--headless', '--invisible', '--nologo', '--norestore', '--nodefault',
                                      f'-env:UserInstallation=file://{self.profile}', f'--accept=socket,host=127.0.0.1,port={PORT};urp;'],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        for _ in range(120):
            try:
                self.ctx = resolver.resolve(f'uno:socket,host=127.0.0.1,port={PORT};urp;StarOffice.ComponentContext')
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError('LibreOffice did not start')
        self.desktop = self.ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', self.ctx)

    def open(self, path):
        path = pathlib.Path(path).resolve()
        lock = path.parent / f'.~lock.{path.name}#'
        if lock.exists():
            lock.unlink()
        doc = self.desktop.loadComponentFromURL(uno.systemPathToFileUrl(str(path)), '_blank', 0, (prop('Hidden', True),))
        if doc is None:
            raise RuntimeError(f'could not open {path}')
        return doc

    def close(self):
        try:
            self.desktop.terminate()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=20)
        except Exception:
            self.proc.kill()


def value(sheet, ref):
    """قيمة الخلية كما تظهر: رقم أو نص، و None للفارغة"""
    from com.sun.star.table.CellContentType import TEXT, EMPTY, FORMULA
    c = sheet.getCellRangeByName(ref)
    t = c.Type
    if t == EMPTY:
        return None
    if t == TEXT:
        return c.String
    if t == FORMULA:
        if c.getError():
            return '#ERR'
        return c.Value if c.getPropertyValue('FormulaResultType2') == 1 else c.String
    return c.Value
