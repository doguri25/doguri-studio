# apps/nooneleft — 비공개

「나간 사람이 없다」는 아직 공개하지 않기로 해서(2026-09-08), 이 폴더의 `index.html`은 "비공개입니다" 안내 페이지입니다.
사이트의 [실행]·[다운로드] 버튼도 `data/apps.json`의 `"private": true` 때문에 누르면 "비공개입니다" 안내만 뜹니다.

공개하기로 마음이 바뀌면:
1. 빌드된 게임 HTML(nooneleft.html)을 이 폴더에 `index.html` 이름으로 넣고
2. `data/apps.json`에서 `"private": true`를 지우고 `run`을 `{ "type": "hosted", "url": "/apps/nooneleft/" }`, `downloads`를 채우면 됩니다.
