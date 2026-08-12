# NUVE Jewelry Shop

심플하고 트렌디한 데일리 주얼리 쇼핑몰입니다.

## 주요 기능

- 카테고리별 주얼리 상품 탐색
- Supabase 이메일·Google 로그인 및 회원가입
- 계정 연동 장바구니와 위시리스트
- Kakao 우편번호 배송지 검색
- Toss Payments 테스트 결제

> 결제 기능은 토스페이먼츠 테스트 환경으로 구성되어 실제 금액이 청구되지 않습니다.

## Supabase Edge Function 설정

결제 승인 함수 배포 전 Supabase 프로젝트에 `TOSS_SECRET_KEY`를 비밀 환경변수로 등록해야 합니다. 시크릿 키는 브라우저 코드나 Git 저장소에 추가하지 마세요.
