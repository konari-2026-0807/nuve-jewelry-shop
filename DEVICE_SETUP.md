# 다른 디바이스에서 이어서 작업하기

## 1. 새 컴퓨터에서 프로젝트 받기

Git, Node.js, ChatGPT 데스크톱 앱을 설치하고 터미널에서 실행한다.

```bash
git clone https://github.com/konari-2026-0807/nuve-jewelry-shop.git
cd nuve-jewelry-shop
node dev-server.mjs
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. 관리자 페이지는 `http://127.0.0.1:4173/admin.html`이다.

ChatGPT 데스크톱 앱에서는 **Projects**에서 로컬 프로젝트를 만들고, 복제한 `nuve-jewelry-shop` 폴더를 기본 폴더로 지정한다. 저장소의 `AGENTS.md`가 새 채팅에도 프로젝트 구조와 작업 규칙을 전달한다.

## 2. 현재 채팅을 다른 디바이스에서 그대로 이어가기

현재 컴퓨터에서 ChatGPT 데스크톱 앱을 열고 다음 순서로 Remote를 설정한다.

1. **Settings → Connections → Control this Mac or PC**로 이동한다.
2. **Set up** 또는 **Add**를 선택하고 원격 접근을 승인한다.
3. 표시되는 QR 코드를 다른 디바이스의 ChatGPT 앱으로 스캔한다.
4. 양쪽 기기에서 같은 ChatGPT 계정과 같은 workspace를 사용한다.
5. 다른 디바이스의 **Remote**에서 이 컴퓨터와 `NUVE 주얼리 쇼핑몰 개발` 채팅을 선택한다.

Remote 방식은 현재 컴퓨터의 채팅, 파일, 로그인 상태, 플러그인과 도구를 그대로 사용한다. 현재 컴퓨터가 켜져 있고 온라인이며 ChatGPT 앱이 실행 중이어야 한다.

## 3. 현재 컴퓨터 없이 새 컴퓨터에서 독립적으로 작업하기

GitHub에서 프로젝트를 복제한 뒤 새 로컬 프로젝트로 연다. 기존 채팅을 찾을 수 있으면 **Recent chats** 또는 프로젝트의 **Chats**에서 연다. 채팅이 보이지 않더라도 새 채팅에서 다음과 같이 요청하면 `AGENTS.md`를 기준으로 이어갈 수 있다.

> 이 저장소의 AGENTS.md와 DEVICE_SETUP.md를 읽고 NUVE 쇼핑몰 작업을 이어가 줘.

로컬 폴더는 기기 간 자동 복사되지 않으므로 작업 시작 전과 종료 후 다음 흐름을 지킨다.

```bash
git pull --ff-only
# 작업 및 확인
git add .
git commit -m "변경 내용"
git push origin main
```

## 4. 계정과 비밀정보

- 새 디바이스에서 GitHub에 로그인해야 푸시할 수 있다.
- Supabase 데이터베이스와 인증 데이터는 클라우드에 있으므로 별도 복사할 필요가 없다.
- 관리자 계정 비밀번호, Supabase secret/service-role key, Toss secret key는 GitHub나 채팅으로 옮기지 않는다.
- Toss의 `TOSS_SECRET_KEY`는 배포된 Supabase Edge Function 환경변수에만 유지한다.

## 5. 배포 확인

`main` 브랜치에 푸시하면 GitHub Pages가 갱신된다.

- 쇼핑몰: https://konari-2026-0807.github.io/nuve-jewelry-shop/
- 관리자: https://konari-2026-0807.github.io/nuve-jewelry-shop/admin.html

