# 도구리 작업실 (doguri-studio)

내가 만든 창작 도구와 게임을 "밤의 서가"에 봉인해 두는 개인 포트폴리오 사이트.
프레임워크·빌드 없음. HTML 1장 + CSS 1장 + JS 1장 + 앱 목록 JSON 1개.

## 폴더 구조

```
doguri-studio/
├─ index.html              홈 · 이야기 상세(/project/<slug>) · 소개(/about) 를 모두 이 한 장이 처리
├─ 404.html                없는 주소
├─ vercel.json             /project/:slug, /about → index.html 로 연결(rewrite)
├─ robots.txt, sitemap.xml
├─ assets/
│  ├─ css/site.css         디자인 토큰 + 모든 스타일
│  ├─ js/site.js           apps.json 읽기 · 카드 · 필터 · 상세 전환 · 효과
│  └─ img/                 favicon.svg, og.jpg(링크 공유 미리보기)
├─ data/
│  └─ apps.json            ★ 앱 목록. 여기만 고치면 카드가 바뀜
├─ content/
│  └─ <slug>.md            앱별 「이 이야기의 시작」(마크다운)
├─ media/
│  └─ <slug>/              썸네일·스크린샷·데모 영상
└─ apps/
   └─ <slug>/index.html    사이트 안에서 실행할 앱 파일 (hosted 앱만)
```

## 새 앱 추가하기 (10분)

1. `apps/<slug>/index.html` 에 앱 파일을 넣는다. (외부 주소로 여는 앱이면 생략)
2. `media/<slug>/` 에 썸네일 1장(16:10, 가로 800px, webp 권장) + 스크린샷 3~6장(가로 1600px)을 넣는다.
3. `content/<slug>.md` 에 만든 이야기를 쓴다. 문단·`## 제목`·`- 목록`·`> 인용`·`**굵게**`·링크·이미지가 된다.
4. `data/apps.json` 의 `apps` 배열에 항목을 추가한다. 아래 필드 설명 참고.
5. 로컬에서 확인 → GitHub에 push → Vercel이 30초~1분 뒤 자동 배포.

### apps.json 필드

| 필드 | 설명 |
|---|---|
| `slug` | 영문 소문자·하이픈. 주소(`/project/<slug>`)와 폴더 이름에 그대로 쓰임 |
| `num` | 카드에 찍히는 번호 `"01"` |
| `name`, `summary` | 이름, 한 줄 소개 |
| `tags` | 배열. 필터 칩은 여기서 자동 생성 (`"준비 중"` 태그는 칩에서 제외) |
| `status` | `live` · `soon`(준비 중 카드, 실행·다운로드 비활성) · `archived` |
| `period` | 표시용 시기 `"2026.09"` |
| `art` | 스크린샷이 없을 때 쓰는 벡터 그림: `cards` · `door` · `sun` · `soon-art` |
| `thumb` | 카드 썸네일 경로 또는 `null`. 있으면 벡터 그림 위에 사진이 덮임 |
| `screens` | 상세 화면 스크린샷 경로 배열. 비어 있으면 벡터 그림이 자리 표시 |
| `video` | 데모 영상 경로 또는 `null` (10MB 이하 mp4 권장, 크면 유튜브 링크를 story에) |
| `run` | `{ "type": "hosted", "url": "/apps/<slug>/" }` 또는 `{ "type": "external", "url": "https://…" }` 또는 `null` |
| `altRun` | 보조 실행 링크 `{ "label": "…", "url": "…" }` 또는 `null` (예: AI 기능 포함 버전) |
| `downloads` | `[{ "label": "HTML", "file": "/apps/<slug>/index.html", "filename": "저장이름.html", "size": "2 MB" }]`. 외부 파일(GitHub Releases)은 새 탭으로 열림 |
| `notice` | 상세 상단 안내 한 줄 또는 `null` (예: "AI 기능은 claude.ai 버전에서만") |
| `facts` | `[["러닝타임","45분"], …]` 표로 나오는 짧은 사실들 |
| `story` | `"/content/<slug>.md"` |

`site` 항목: `name`, `tagline`, `url`(sitemap·robots에 쓴 주소와 맞추기), `feedbackForm`(구글 폼 주소, 비우면 "준비 중" 안내), `feedbackField`(폼에서 앱 이름이 들어갈 항목의 `entry.xxxxx` 값 — 폼의 "미리 채운 링크 받기"로 확인).

## 로컬에서 보기

`index.html`을 파일로 직접 열면(`file://`) JSON·마크다운을 읽지 못한다. 저장소 폴더에서:

```bash
npx serve -s .
```

`-s`(single-page) 옵션이 있어야 `/project/<slug>` 주소가 index.html로 연결된다. 그런 다음 `http://localhost:3000` 열기.
간단히 볼 때는 `http://localhost:3000/?id=nooneleft` 처럼 `?id=` 로도 상세를 열 수 있다.

## 배포 (처음 한 번)

1. GitHub에서 새 저장소를 만든다(비공개여도 됨). 이름 예: `doguri-studio`.
2. 이 폴더의 파일을 전부 올린다. (웹에서 "Add file → Upload files"로 끌어다 놓아도 됨. 폴더째 끌면 구조가 유지된다.)
3. vercel.com → Add New → Project → 방금 만든 저장소 Import → Framework Preset은 **Other**, 나머지는 기본값 → Deploy.
4. `이름.vercel.app` 주소가 생기면 `data/apps.json`의 `site.url`, `robots.txt`, `sitemap.xml`의 주소를 그 값으로 바꾼다.
5. 이후로는 GitHub에 파일을 고치기만 하면 자동으로 다시 배포된다. 다른 브랜치에 올리면 미리보기 주소가 따로 생긴다.

## 아직 비어 있는 자리

- `apps/card-novel/index.html`, `apps/nooneleft/index.html` — 단독 HTML을 넣고 `run`을 `hosted`로 바꾸기 (각 폴더의 README 참고)
- `media/*/` — 스크린샷·썸네일
- `site.feedbackForm` — 구글 폼 주소
- 탐정게임 윈도우 zip — GitHub Releases에 올린 뒤 `downloads`에 주소

## 인트로·효과에 대해

- 봉인 편지 인트로는 브라우저에 `dgr-intro-seen`을 남겨 **처음 한 번만** 나온다. 다시 보려면 개발자 도구에서 localStorage를 지우거나 시크릿 창으로 연다.
- 「움직임 줄이기」를 켠 기기에서는 인트로·입자·안개·틸트가 모두 꺼진다.
- 서체는 Google Fonts(Nanum Myeongjo, Noto Sans KR, IBM Plex Mono — OFL)에서 불러온다.
