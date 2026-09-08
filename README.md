# 도구리 작업실 (doguri-studio)

내가 만든 창작 도구와 게임을 "밤의 서가"에 봉인해 두는 개인 포트폴리오 사이트.
프레임워크·빌드 없음. HTML 1장 + CSS 1장 + JS 1장 + 앱 목록 JSON 1개.

## 폴더 구조

```
doguri-studio/
├─ index.html              홈 · 이야기 상세(/project/<slug>) · 소개(/about) 를 모두 이 한 장이 처리
├─ 404.html                없는 주소
├─ vercel.json             /project/:slug, /about → index.html 로 연결(rewrite) · 캐시 헤더
├─ admin.html + assets/js/admin.js   관리 화면 (/admin)
├─ api/admin.js            관리 화면의 서버 쪽 (Vercel 함수) — 로그인 검사 · GitHub 커밋 대행
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
| `pin` | 서가에서 고정할 자리 `1`, `2`, … 또는 `null`. 고정한 앱이 번호 순으로 맨 앞, 나머지는 `added` 최신순, `soon`은 맨 뒤 (관리 화면 05에서 조절) |
| `added` | 올린 날짜 `"2026-09-08T17:00:00+09:00"` — 고정하지 않은 앱의 자동 순서 기준 |

`site` 항목: `name`, `tagline`, `url`(sitemap·robots에 쓴 주소와 맞추기), `feedbackForm`(구글 폼 주소, 비우면 "준비 중" 안내), `feedbackField`(폼에서 앱 이름이 들어갈 항목의 `entry.xxxxx` 값 — 폼의 "미리 채운 링크 받기"로 확인).


## 작품집(카드 묶음) 올리기 — 카드소설처럼 "한 장씩 넘겨 보는" 작품

앱 항목에 `works` 배열을 두면 상세 화면에 「작품집」 칸이 생기고, 표지를 누르면 카드 뷰어가 떠서 한 장씩 넘겨 읽는다(← → 키, 옆으로 밀기, 화면 좌·우 탭, 점 표시, 마지막에 "THE END").

1. `media/<slug>/works/<작품slug>/` 폴더에 카드 이미지를 순서대로 넣는다. 이름은 `01.webp`, `02.webp`… 처럼 번호 순이면 된다(jpg·png도 됨). 한 변 1080px면 충분.
2. `data/apps.json`의 해당 앱에 아래처럼 추가한다.

```json
"works": [
  {
    "slug": "dry-umbrella",
    "title": "젖지 않은 우산",
    "date": "2026.09",
    "ratio": "1:1",
    "blurb": "비 오는 밤, 우산꽂이에 우산이 하나 남았다.",
    "cards": ["/media/card-novel/works/dry-umbrella/01.webp", "/media/card-novel/works/dry-umbrella/02.webp", "…"]
  }
]
```

`ratio`는 카드 비율(`1:1` · `4:5` · `3:4` · `9:16`), `blurb`는 한 줄 소개(없어도 됨). 작품이 여러 개면 배열에 계속 추가. 지금 들어 있는 「젖지 않은 우산」은 앱의 예시 원고로 만든 샘플이니 본인 작품으로 바꿔도 된다.


## 관리 화면 (/admin) — 카드소설을 브라우저에서 바로 올리기

`https://doguri-studio.vercel.app/admin` 을 열면 관리 화면이 나온다. **관리자만** 들어올 수 있고(구글 로그인 또는 비밀번호), 저장소 열쇠(GitHub 토큰)는 Vercel 서버에만 있어 브라우저로 내려오지 않는다. 사진을 넣고 순서를 맞춘 뒤 **게시하기**를 누르면 이미지가 자동으로 줄어(긴 변 1080px, webp) 저장소에 커밋되고, Vercel이 다시 배포해 약 1분 뒤 사이트에 나타난다. 올라간 작품의 순서 바꾸기·제목 고치기·지우기도 여기서 한다.

구조: 브라우저 → `api/admin.js`(Vercel 서버리스 함수 1개) → GitHub API. 함수가 로그인을 검사하고, 허용된 경로(`media/<앱>/works/**`, `data/apps.json`, `content/<앱>.md`)에만 쓴다.

관리 화면에서 할 수 있는 것:

| 칸 | 할 수 있는 것 |
|---|---|
| 02 올라가 있는 작품집 | 작품 순서 ▲▼ · **제목·소개·비율** 고치기 · **카드 편집**(작품 안 카드 순서 바꾸기·빼기·더하기) · 작품 지우기 → **변경 사항 게시**로 한 번에 커밋 |
| 03 새 작품 올리기 | 카드 이미지 여러 장 → 순서 맞추기 → 게시. 기본 비율은 **3:4(인스타 새 세로, 1080×1440)**. 4:5·1:1·9:16도 고를 수 있고, 표지·뷰어가 그 비율로 보인다 |
| 04 앱 소개 글 고치기 | 상세 화면의 **한 줄 소개**(제목 밑) · **속삭임**(노란 안내 상자, 비우면 사라짐) · **이 이야기의 시작**(마크다운 긴 글, `content/<앱>.md`) 편집 → 저장하고 게시 |
| 05 서가 순서 | 이야기를 **고정**(📌)하면 정한 순서로 맨 앞에, 나머지는 올린 날짜 최신순으로 자동. 고정한 것만 ▲▼. 기본값: 1 카드소설 제작소 · 2 나간 사람이 없다 고정 |

화면 위에 **빠른 이동 바**(01~05)가 붙어 있어 스크롤이 길어져도 칸 사이를 바로 오갈 수 있다.

**로그인 잠금**: 비밀번호(또는 구글 계정)를 **5번 틀리면 1시간 동안** 그 IP와 전체에서 로그인 시도가 막힌다(서버가 429로 거절, 화면에 남은 시간 표시). 잠금 상태는 서버 함수 인스턴스 메모리에 있어 오래 쉬면 풀릴 수 있는데, 확실히 기억시키려면 Vercel Marketplace에서 **Upstash Redis**를 연결하면 된다(환경변수 `KV_REST_API_URL`·`KV_REST_API_TOKEN`이 자동으로 들어오고, 함수가 있으면 알아서 쓴다). 본인이 잠겼을 때는 1시간 기다리거나, 다른 네트워크(폰 데이터)에서도 막히면 Vercel에서 Redeploy로 메모리를 비울 수 있다.

카드 순서만 바꾸면 파일 이름은 그대로 두고 `apps.json`의 순서만 바뀐다(파일 이름 번호가 순서와 달라도 괜찮다). 카드를 더하면 기존 번호 다음 번호로 저장된다.

### 처음 한 번: Vercel 환경변수

Vercel → 프로젝트 → 왼쪽 **Settings → Environments → Production** 안의 **Environment Variables** 칸에 아래를 넣고(예전 화면에서는 Settings → Environment Variables), 왼쪽 **Deployments → 맨 위 배포 → ⋯ → Redeploy** 한다. (환경변수는 다시 배포해야 반영된다.)

| 이름 | 값 | 필수 |
|---|---|---|
| `GITHUB_TOKEN` | GitHub fine-grained 토큰 (아래 만드는 법) | ✅ |
| `ADMIN_PASSWORD` | 관리자 비밀번호. **영문·숫자·기호만**(로그인 칸이 한글을 받지 않는다), 12자 이상, 다른 데서 안 쓰는 것 | 로그인 A |
| `GOOGLE_CLIENT_ID` | 구글 OAuth 클라이언트 ID (`…apps.googleusercontent.com`) | 로그인 B |
| `ADMIN_EMAIL` | 허용할 구글 계정 (여러 개면 쉼표) | 로그인 B |
| `GITHUB_REPO` | 기본 `doguri25/doguri-studio` — 다르면 적기 | 선택 |
| `GITHUB_BRANCH` | 기본 `main` | 선택 |

A(비밀번호)만 넣어도 되고, B(구글)만 넣어도 되고, 둘 다 넣으면 로그인 화면에 둘 다 나온다. **비밀번호로 먼저 시작하고, 나중에 구글을 붙여도 된다.**

**GitHub 토큰 만들기**
1. GitHub → 오른쪽 위 프로필 → Settings → 맨 아래 **Developer settings** → **Personal access tokens → Fine-grained tokens → Generate new token**
2. Token name 아무거나, Expiration은 1년 등 넉넉히, **Repository access → Only select repositories → 사이트 저장소(doguri-studio)** 선택
3. **Permissions → Repository permissions → Contents → Read and write** (다른 건 그대로) → Generate token → 복사
4. 복사한 값을 Vercel 환경변수 `GITHUB_TOKEN`에 붙여 넣는다. 채팅·메모·코드 어디에도 적지 않는다. 노출됐다 싶으면 GitHub에서 지우고(Delete) 새로 만들어 값을 바꾼다.

**구글 로그인 붙이기 (선택, 10분)**
1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 하나 만들기(이름 아무거나)
2. 왼쪽 메뉴 **API 및 서비스 → OAuth 동의 화면** → User Type **외부** → 앱 이름·지원 이메일만 채우고 저장. 범위는 건너뛰고, **테스트 사용자**에 자기 구글 계정 추가 (게시하지 않아도 테스트 사용자는 로그인된다)
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID** → 유형 **웹 애플리케이션** → **승인된 JavaScript 원본**에 `https://doguri-studio.vercel.app` 추가 (로컬 시험도 하려면 `http://localhost:3000`도) → 만들기 → **클라이언트 ID** 복사
4. Vercel 환경변수 `GOOGLE_CLIENT_ID`에 클라이언트 ID, `ADMIN_EMAIL`에 자기 구글 계정을 넣고 Redeploy

로그인하면 12시간짜리 세션이 그 브라우저에 남는다(`localStorage`의 `dgr-admin-session`). **나가기**를 누르면 지워진다. 비밀번호를 바꾸거나 토큰을 바꾸면 기존 세션은 모두 무효가 된다.

## 로컬에서 보기

`index.html`을 파일로 직접 열면(`file://`) JSON·마크다운을 읽지 못한다. 저장소 폴더에서:

```bash
npx serve -s .
```

`-s`(single-page) 옵션이 있어야 `/project/<slug>` 주소가 index.html로 연결된다. 그런 다음 `http://localhost:3000` 열기.
간단히 볼 때는 `http://localhost:3000/?id=nooneleft` 처럼 `?id=` 로도 상세를 열 수 있다.
관리 화면(`/admin`)은 서버 함수(`api/admin.js`)가 있어야 해서 `serve`로는 로그인이 안 된다. 굳이 로컬에서 보려면 `npx vercel dev`(환경변수는 `.env.local`에) — 보통은 배포된 주소에서 쓰면 된다.

## 배포 (처음 한 번)

1. GitHub에서 새 저장소를 만든다(비공개여도 됨). 이름 예: `doguri-studio`.
2. 이 폴더의 파일을 전부 올린다. (웹에서 "Add file → Upload files"로 끌어다 놓아도 됨. 폴더째 끌면 구조가 유지된다.)
3. vercel.com → Add New → Project → 방금 만든 저장소 Import → Framework Preset은 **Other**, 나머지는 기본값 → Deploy.
4. `이름.vercel.app` 주소가 생기면 `data/apps.json`의 `site.url`, `robots.txt`, `sitemap.xml`의 주소를 그 값으로 바꾼다.
5. 이후로는 GitHub에 파일을 고치기만 하면 자동으로 다시 배포된다. 다른 브랜치에 올리면 미리보기 주소가 따로 생긴다.

## 아직 비어 있는 자리

- `site.feedbackForm` — 구글 폼 주소 (비어 있으면 "준비 중" 안내)
- 탐정게임 — 지금은 `private: true`로 비공개(실행·다운로드 누르면 "비공개입니다"). 공개할 때 `apps/nooneleft/README.md` 참고
- 아침 책상 — 지금은 claude.ai 아티팩트로 연결(external). 공개 API로 갱신을 다시 만들면 `apps/morning-desk/`에 넣고 hosted로 전환
- 스크린샷은 사이트 안 앱을 그대로 찍은 것. 더 좋은 장면이 있으면 `media/<slug>/`의 파일만 바꾸면 됨
- 삼국피구(`apps/samguk-dodgeball/`)는 게임 HTML(10.7.3)과 설명서(`manual.md`)를 그대로 둔 것. 새 버전이 나오면 `index.html`만 바꾸고 `data/apps.json`의 downloads 라벨·용량과 `content/samguk-dodgeball.md`의 버전 언급을 맞추면 된다

## 인트로·효과에 대해

- 봉인 편지 인트로는 브라우저에 `dgr-intro-seen`을 남겨 **처음 한 번만** 나온다. 다시 보려면 개발자 도구에서 localStorage를 지우거나 시크릿 창으로 연다.
- 「움직임 줄이기」를 켠 기기에서는 인트로·입자·안개·틸트가 모두 꺼진다.
- 상단 헤더는 스크롤 중 **높이를 바꾸지 않는다**(compact는 배경·블러·브랜드 축소만). 높이를 바꾸면 문서 길이→scrollY→compact 토글이 서로 물고 흔들리는 버그가 생긴다(2026-09-08 수정). 전환 기준도 내려갈 때 64px·올라올 때 16px로 두었다.
- 서체는 Google Fonts(Nanum Myeongjo, Noto Sans KR, IBM Plex Mono — OFL)에서 불러온다. IBM Plex Mono는 영문·숫자 라벨(No. 01, SEALED, 날짜)에만 쓰고, 한글이 섞이는 글은 전부 Noto Sans KR(`--label`)이다.
- `assets/`·`data/`는 브라우저가 매번 서버에 새 버전을 묻도록(`max-age=0, must-revalidate`) 해 두었다. 배포 뒤에도 옛 화면이 보이면 한 번만 강력 새로고침(Ctrl+F5 / 모바일은 탭 닫고 다시 열기)하면 된다.
