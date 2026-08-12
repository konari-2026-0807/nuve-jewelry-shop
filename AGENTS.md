# NUVE Jewelry Shop 작업 안내

이 저장소는 별도 빌드 과정이 없는 정적 주얼리 쇼핑몰과 Supabase 백엔드로 구성된다.

## 주요 주소

- 쇼핑몰: https://konari-2026-0807.github.io/nuve-jewelry-shop/
- 관리자: https://konari-2026-0807.github.io/nuve-jewelry-shop/admin.html
- GitHub: https://github.com/konari-2026-0807/nuve-jewelry-shop
- Supabase 프로젝트 ID: `znevzirirtvrlxebuyyp`

## 구조

- `index.html`, `styles.css`, `app.js`: 쇼핑몰
- `admin.html`, `admin.css`, `admin.js`: 관리자 페이지
- `assets/`: 상품 스프라이트 이미지
- `supabase/`: 데이터베이스 SQL과 Edge Functions
- `supabase-config.js`: 브라우저에서 사용하는 공개 Supabase URL과 publishable key

## 작업 원칙

- 변경 전 `git pull --ff-only`로 최신 코드를 받는다.
- 로컬 실행은 `node dev-server.mjs`를 사용하고 `http://127.0.0.1:4173/`에서 확인한다.
- JavaScript 변경 후 `node --check app.js`와 `node --check admin.js`를 실행한다.
- GitHub Pages는 `main` 브랜치 루트에서 배포된다. 검증한 변경만 커밋하고 `main`에 푸시한다.
- Supabase 스키마 변경은 `supabase/`에 재현 가능한 SQL로 함께 기록한다.
- `service_role`, Supabase secret key, Toss secret key, 비밀번호, 로그인 토큰을 저장소에 기록하지 않는다.
- `supabase-config.js`의 publishable key는 공개 클라이언트용이지만 secret key로 교체하면 안 된다.
- 이 Supabase 프로젝트에는 NUVE 외 데이터가 있을 수 있다. 주얼리 상품은 `earrings-*`, `necklaces-*`, `bracelets-*`, `rings-*` slug만 대상으로 하며 관련 없는 행은 삭제하지 않는다.
- 관리자 권한은 `public.admin_users`로만 판정한다. `user_metadata`를 권한 판정에 사용하지 않는다.
- 최초 관리자 등록은 관리자가 0명일 때만 `admin-bootstrap` Edge Function을 통해 허용한다.

## 현재 기능

- 이메일·Google 로그인/회원가입
- 계정 연동 장바구니와 위시리스트
- Kakao 주소검색과 Toss 테스트 결제
- 상품 40개와 카테고리 필터
- 관리자 상품·재고·노출·주문·고객·통계 관리
- 비관리자에게 쇼핑몰 상단 `ADMIN` 진입 버튼 표시

