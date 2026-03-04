

## 분석 결과

**핵심 문제: 데이터가 전체의 약 1/3만 파싱되었습니다.**

- Excel 파일: 약 1,358개 행 (line 10~1367)
- Edge function에 포함된 데이터: 약 462개 행 (line 13~474)
- **약 900개 행이 누락** — 부산대, 경북대, KAIST, UNIST 등 영남권/호남권/충청권의 많은 대학 데이터가 빠져 있습니다.

"도시공학과"는 실제로 서울시립대(line 241), 동아대(line 324)에 포함되어 있으나, Gemini 모델이 대량의 텍스트에서 이를 놓칠 수 있고, 다른 대학의 도시공학 관련 학과가 누락되었을 가능성이 높습니다.

## 근본 원인

Edge function의 `UNIVERSITY_DATA` 문자열에 Excel 전체 데이터를 넣기에는 양이 너무 많아 이전 작업에서 잘렸습니다. 또한 이 데이터를 시스템 프롬프트와 함께 Gemini에 매번 전달하므로, 데이터가 많을수록 토큰 비용과 지연이 증가합니다.

## 해결 계획

### 1. 데이터를 데이터베이스로 이전
Excel 전체 데이터(~1,358행)를 DB 테이블에 저장합니다.

```text
테이블: university_courses
─────────────────────────
id (uuid, PK)
region (text)          -- 권역 (수도권, 영남권 등)
area (text)            -- 지역 (서울, 부산 등)
university (text)      -- 대학명
college (text)         -- 단과대학/계열
department (text)      -- 학과명
core_subjects (text)   -- 핵심과목
recommended_subjects (text) -- 권장과목
notes (text)           -- 비고
```

### 2. Edge function 수정
- `UNIVERSITY_DATA` 문자열을 제거하고, 사용자 쿼리에 맞는 데이터만 DB에서 검색
- 학과 검색: `department ILIKE '%도시공학%'` 로 정확히 매칭
- 과목 검색: `core_subjects ILIKE '%미적분%' OR recommended_subjects ILIKE '%미적분%'` 로 검색
- 검색 결과만 시스템 프롬프트에 포함 → 토큰 절약 + 정확도 향상

### 3. 데이터 삽입
- Excel 파일을 다시 파싱하여 전체 ~1,358행을 DB에 INSERT하는 마이그레이션 생성

### 4. 시스템 프롬프트 업데이트
- 기존: 전체 데이터를 프롬프트에 포함
- 변경: DB 검색 결과만 "관련 데이터" 섹션으로 프롬프트에 주입

이 방식은 데이터 누락 문제를 근본적으로 해결하고, 검색 정확도와 응답 속도를 모두 개선합니다.

