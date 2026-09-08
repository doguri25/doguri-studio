#!/usr/bin/env python3
"""빌드 스탬프: index.html·admin.html 의 site.css / site.js / admin.js 주소 뒤 ?v=… 를 지금 시각으로 바꾼다.
브라우저가 옛 파일을 하루쯤 쥐고 있어도(캐시) 새 HTML이 새 주소를 부르므로 배포 즉시 새 CSS·JS·apps.json을 받는다.
site.js 는 자기 주소의 v= 값을 읽어 /data/apps.json?v=… 요청에도 붙인다.
쓰는 법:  python3 tools/stamp.py   (zip 만들기 전에 한 번)"""
import re, pathlib, datetime
ROOT = pathlib.Path(__file__).resolve().parent.parent
stamp = datetime.datetime.now().strftime('%Y%m%d%H%M')
for name in ('index.html', 'admin.html', '404.html'):
    p = ROOT / name
    if not p.exists(): continue
    s = p.read_text(encoding='utf-8')
    s2 = re.sub(r'(/assets/(?:css|js)/[a-z]+\.(?:css|js))(\?v=[0-9a-z]+)?', lambda m: f'{m.group(1)}?v={stamp}', s)
    if s2 != s:
        p.write_text(s2, encoding='utf-8'); print('stamped', name, stamp)
