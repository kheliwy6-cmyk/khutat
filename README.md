# مصادر «الخطط العلميّة»

هذا الفرع (`source`) فيه الملفات التي تُبنى منها صفحة الموقع (`index.html` في الفرع `main`) وصفحة Claude.

- `build/` أجزاء الصفحة: `page.html` (العناصر)، `style.css` (التنسيق، والخط المرفق في `fonts/`)، `data.base.js` (بيانات المتون والخطط الجاهزة وقالب وورد)،
  `plan-core.js` (حساب الخطة)، `hijri.js`، `docx-build.js` (وورد)، `pdf-build.js` (PDF)، `xlsx-lite.js` (اكسل)، `cloud.js` (Firebase للموقع)، `app.js` (الواجهة).
- `site.tpl.html` و`artifact.tpl.html` قالبا الصفحتين.
- `python3 build.py --site ../khutat` يبني الصفحتين في `out/` ويكتب `index.html` في مستودع الموقع.
- `tests/` اختبارات الصفحة (Playwright).

لا يوضع هنا خط Traditional Arabic (مرخّص من Monotype ولا يجوز نشره).
