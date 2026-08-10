# 우리집 가계부

실제 자금이 움직이는 **결제일/입출금일 기준**으로 부부의 수입·지출을 관리하고, 생활비 계좌 정산·잔액 대조·월 마감까지 연결하는 개인 가계관리 웹앱입니다.

## 기술 스택

- Next.js App Router
- React / TypeScript
- Tailwind CSS
- Supabase PostgreSQL / Auth / RLS
- Vitest

## 현재 구현된 기능

### 인증 / 가구

- 로그인 / 로그아웃
- 신규 household 온보딩
- household 기반 RLS

### 설정

- 계좌 등록·수정·비활성/삭제
- 생활비 계좌 지정
- 카드 등록 및 결제계좌/결제일 설정
- 생활비 반영률 version 관리
- 수입·지출 카테고리 관리
- 월별 집계 분류 설정

### 월별 가계부

- 실제 DB 기반 수입·지출 CRUD
- planned / confirmed / cancelled 상태
- 카드대금 실제 결제일 기준 기록
- 카테고리 집계 분류 snapshot
- 생활비 반영률 snapshot
- 마감된 월 read-only UI

### 정기 항목

- 일반 정기결제와 할부를 `recurring_rules` 하나로 관리
- 매월 / 매년 반복
- 시작월 / 종료월
- 결제일 기준 자동 transaction 생성
- 중복 생성 방지
- 기존 생성 거래는 규칙 변경 후에도 보존

### 생활비 정산

거래 데이터로 정산 방향을 계산하며 별도 settlement 테이블은 사용하지 않습니다.

지원하는 주요 흐름:

- 개인 계좌 수입의 생활비 몫 → 생활비 계좌
- 생활비 계좌 직접 수입의 투자 몫 → 생활비 계좌 밖
- 개인 계좌가 먼저 낸 생활비 → 생활비 계좌에서 보전
- 생활비 계좌가 먼저 낸 투자 지출 → 투자 자금에서 보전

정산 완료는 transaction의 `settlement_completed_at`으로 기록합니다.

### 생활비 계좌 잔액 대조

- 은행 실제 잔액 입력
- 첫 잔액을 장부 기준점으로 저장
- 이후 직접 수입/지출과 완료된 정산을 누적해 예상 장부 잔액 계산
- 실제 잔액과 프로그램 장부 잔액 차이 확인
- 다음 대조는 직전 확인 실제 잔액을 새 기준점으로 사용

### 월 마감

- 지난 월 `monthly_snapshots` 저장
- 예정 거래가 남아 있으면 마감 차단
- 생활비 계좌 잔액 기준점 확인
- 마감 이후 거래 재무값 변경/삭제 잠금
- 이후 열린 월에서 과거 거래 정산은 가능
- 가장 최근 마감 월부터 역순으로 마감 취소 가능

### 월별 정리

마감 snapshot을 기준으로:

- 연간 누적 수입
- 생활비 배정
- 생활비/투자 지출
- 자산소득
- 고정지출 충당률
- 월별 변화
- 생활비 계좌 월말 상태

를 비교할 수 있습니다.

## 핵심 운영 기준

- 카드 사용일과 가맹점은 기록하지 않습니다.
- 카드 지출은 실제 카드대금 결제일이 속한 달의 지출입니다.
- 신규 거래는 기본적으로 바로 확정할 수 있습니다.
- 거래 상태는 `planned | confirmed | cancelled`만 사용합니다.
- 환불 상태는 사용하지 않습니다. 필요한 경우 별도 수입 거래로 기록합니다.
- 취소 거래는 DB에 남지만 일반 장부 합계에서는 제외합니다.
- 모든 수입은 거래 시점의 생활비 반영률을 snapshot으로 저장합니다.
- 과거 transaction snapshot은 이후 설정 변경으로 재계산하지 않습니다.
- 일반 정기결제와 할부는 같은 `recurring_rules` 구조를 사용합니다.
- 정산 필요 여부와 이체 방향은 transaction 데이터에서 계산합니다.
- 마감된 월은 snapshot을 기준으로 과거 결과를 보존합니다.

## 주요 데이터 구조

- `households`
- `household_members`
- `accounts`
- `cards`
- `rate_rules`
- `categories`
- `transactions`
- `recurring_rules`
- `account_reconciliations`
- `monthly_snapshots`

## 실행

Node.js 20.9 이상을 권장합니다.

```bash
npm install
npm run dev
```

브라우저:

```text
http://localhost:3000
```

## Supabase

`.env.example`을 `.env.local`로 복사하고 프로젝트 정보를 입력합니다.

migration 적용:

```bash
npx supabase db push
```

DB schema가 변경되어 생성 타입을 갱신해야 하는 작업에서는:

```bash
npx supabase gen types typescript --linked --schema public > src/types/database.types.ts
```

이미 적용된 migration 파일은 수정하지 않고, 변경 사항은 항상 새 migration으로 추가합니다.

## 검증

일반 코드 변경 후:

```bash
npm run lint
npm run test
npm run build
```

실제 사용자 흐름 회귀검증은 다음 문서를 사용합니다.

```text
docs/REGRESSION_CHECKLIST.md
```

## 주요 화면

- `/` 홈 대시보드
- `/ledger` 월별 가계부
- `/settlements` 생활비 정산
- `/reconciliation` 잔액 대조
- `/recurring` 정기 항목
- `/monthly-close` 월 마감
- `/monthly-summary` 월별 정리
- `/settings` 설정
