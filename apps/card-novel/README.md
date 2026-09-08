# apps/card-novel — 단독 HTML 들어 있음 (2026-09-08)

카드소설 제작소의 단독 HTML 파일을 이 폴더에 `index.html` 이름으로 넣으세요.

넣은 뒤 `data/apps.json`에서 이 앱의 `run`을 아래처럼 바꾸면 사이트 안에서 바로 실행됩니다.

```json
"run": { "type": "hosted", "url": "/apps/card-novel/" },
"altRun": { "label": "AI 기능 포함 버전 열기 (claude.ai)", "url": "https://claude.ai/code/artifact/..." },
"downloads": [ { "label": "단독 HTML (AI 기능 제외)", "file": "/apps/card-novel/index.html", "filename": "카드소설제작소.html" } ]
```
