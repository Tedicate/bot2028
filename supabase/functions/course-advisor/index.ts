import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UNIVERSITY_DATA = `
2028학년도 계열별 대표 모집단위별 반영과목 데이터
(⁎ 표시 대학은 학과 특성에 따라 일반 선택 과목 이수 후 진로와 적성에 맞게 과목 이수 권장 대학)

## 영어영문 [인문]
- 강원대(춘천): 영어
- 광운대: 국어, 확률과통계, 영어, 일반사회, 윤리
- 단국대⁎: 국어, 대수, 영어, 일반사회
- 단국대(천안)⁎: 국어, 대수, 영어, 일반사회
- 덕성여대: 국어, 영어, 일반사회
- 동국대: 국어, 영어, 일반사회, 역사, 윤리
- 서울대: 제2외국어/한문
- 서울시립대: 국어, 대수, 일반사회
- 숭실대: 국어, 영어, 일반사회
- 영남대: 국어, 확률과통계, 영어, 일반사회
- 전남대: 영어, 일반사회
- 전북대: 국어, 영어
- 조선대: 영어
- 충북대: 영어, 일반사회, 제2외국어

## 철학 [인문]
- 강원대(춘천): 국어, 영어, 윤리, 한문/교양
- 건국대: 국어, 영어, 일반사회
- 단국대⁎: 국어, 대수, 영어, 일반사회
- 단국대(천안)⁎: 국어, 대수, 영어, 일반사회
- 동국대: 국어, 윤리, 한문/교양
- 동아대: 국어, 일반사회
- 서울대: 제2외국어/한문
- 서울시립대: 국어, 대수, 영어, 일반사회
- 숭실대: 국어, 영어, 일반사회
- 영남대: 국어, 영어, 일반사회, 교양
- 전남대: 국어, 윤리
- 충남대: 국어, 영어, 제2외국어/한문
- 충북대: 국어, 일반사회(역사/도덕 포함)

## 경영 [사회]
- 강원대(춘천): 국어, 확률과통계, 미적분I, 영어
- 광운대: 국어, 대수, 확률과통계, 미적분I, 영어, 일반사회, 지리, 윤리, 제2외국어
- 국립한밭대: 영어, 일반사회
- 단국대⁎: 국어, 대수, 영어, 일반사회
- 단국대(천안)⁎: 국어, 대수, 영어, 일반사회
- 동국대: 대수, 확률과통계, 미적분I, 미적분II, 영어, 일반사회
- 동아대: 대수, 영어
- 부산대: 확률과통계, 미적분I, 미적분II
- 아주대⁎: 대수, 확률과통계, 미적분I, 일반사회, 물리학
- 영남대: 국어, 대수, 확률과통계, 미적분I, 영어, 일반사회
- 서울대: 제2외국어/한문
- 서울과기대: 대수, 확률과통계, 미적분I, 미적분II
- 서울시립대: 대수, 영어
- 숭실대: 국어, 대수, 확률과통계, 미적분I, 일반사회
- 전남대: 대수, 일반사회
- 전주대: 국어
- 조선대: 대수, 영어
- 충남대: 확률과통계, 영어
- 충북대: 영어, 일반사회
- 한국기술교육대: 국어, 대수, 영어, 일반사회
- 한국항공대: 대수, 확률과통계, 미적분I
- 한라대: 국어
- 한양대: 미적분II, 기하, 물리학, 화학, 생명과학
- 협성대⁎: 기타

## 심리 [사회]
- 가톨릭대: 확률과통계
- 강원대(춘천): 국어, 확률과통계, 영어, 일반사회
- 광운대: 국어, 대수, 확률과통계, 미적분I, 영어, 일반사회, 윤리
- 서울대: 제2외국어/한문
- 아주대⁎: 대수, 확률과통계, 미적분I, 일반사회
- 영남대: 국어, 대수, 확률과통계, 미적분I, 영어, 일반사회, 물리학
- 전남대: 영어, 일반사회
- 전주대: 국어
- 조선대: 국어, 영어
- 충남대: 국어, 확률과통계, 영어, 일반사회(역사/도덕 포함)
- 충북대: 대수, 영어

## 국어교육 [교육]
- 강원대(춘천): 국어, 역사, 한문
- 경북대⁎: 국어
- 단국대⁎: 국어, 대수, 영어, 일반사회
- 동국대: 국어, 일반사회
- 서울대: 제2외국어/한문
- 전남대: 국어
- 전북대: 국어
- 전주대: 국어
- 조선대: 국어
- 충남대: 국어, 영어, 제2외국어/한문
- 충북대: 국어, 일반사회(역사/도덕 포함)

## 수학교육 [교육]
- 강원대(춘천): 확률과통계, 미적분I, 미적분II, 기하, 영어, 생명과학
- 경북대⁎: 대수
- 고려대: 미적분II, 기하
- 단국대⁎: 국어, 대수, 영어, 물리학
- 동국대: 대수
- 부산대: 확률과통계, 미적분II, 기하
- 서울대: 미적분I, 미적분II, 기하, 물리학
- 영남대: 국어, 대수, 물리학
- 전남대: 대수
- 전북대: 대수
- 전주대: 대수
- 조선대: 대수
- 충남대: 대수, 물리학⁎
- 충북대: 대수, 물리학

## 생명과학 [자연]
- 가톨릭대: 화학, 생명과학
- 강원대(춘천): 화학, 생명과학
- 경북대: 미적분I, 화학, 생명과학
- 경희대: 대수, 확률과통계, 미적분I, 미적분II, 화학, 생명과학
- 고려대: 미적분II, 화학, 생명과학
- 동국대: 대수, 물리학, 화학, 생명과학
- 동아대: 영어, 화학
- 부산대: 화학, 생명과학
- 서울과기대: 대수, 물리학, 화학, 생명과학
- 서울대: 미적분I, 미적분II, 기하, 생명과학
- 서울시립대: 화학, 생명과학
- 숭실대: 대수, 생명과학
- 영남대: 대수, 영어, 물리학, 화학, 생명과학
- 전북대: 대수, 화학
- 중앙대: 미적분II, 기하, 화학, 생명과학
- 충남대: 대수, 확률과통계, 미적분I, 미적분II, 화학, 생명과학

## 물리 [자연]
- 가톨릭대: 대수, 물리학
- 강원대(춘천): 확률과통계, 미적분I, 미적분II, 기하, 물리학
- 경북대: 대수, 물리학
- 경희대: 대수, 물리학, 화학
- 고려대: 미적분II, 물리학
- 광운대: 대수, 물리학, 화학, 생명과학
- 국민대: 대수, 미적분I, 물리학
- 동국대: 대수, 물리학, 화학
- 부산대: 미적분II, 기하, 물리학, 화학
- 서울대: 미적분II, 기하, 물리학
- 숭실대: 대수, 물리학
- 영남대: 대수, 영어, 물리학, 화학
- 인하대: 물리학
- 전남대: 대수, 영어, 물리학
- 전북대: 대수, 물리학
- 중앙대: 미적분II, 기하, 물리학, 화학
- 충남대: 대수, 물리학⁎
- 충북대: 대수, 물리학

## 화학 [자연]
- 가톨릭대: 화학
- 강원대(춘천): 확률과통계, 미적분I, 미적분II, 화학, 생명과학
- 경기대: 물리학
- 경북대: 미적분I, 화학, 생명과학
- 경희대: 대수, 물리학, 화학, 생명과학
- 고려대: 미적분II, 화학
- 광운대: 대수, 물리학, 화학, 생명과학
- 국민대: 미적분I, 물리학, 화학
- 동국대: 대수, 물리학, 화학
- 동아대: 대수, 화학
- 부산대: 화학, 생명과학
- 서울과기대: 대수, 확률과통계, 미적분I, 물리학, 화학
- 서울대: 미적분II, 기하, 화학
- 서울시립대: 대수, 화학
- 숭실대: 대수, 화학
- 아주대⁎: 대수, 물리학
- 영남대: 대수, 영어, 물리학, 화학, 생명과학
- 전남대: 화학
- 전북대: 대수, 화학
- 중앙대: 미적분II, 물리학, 화학, 생명과학
- 충북대: 대수, 물리학

## 기계공학 [공학]
- 강원대(삼척): 미적분I, 미적분II, 영어, 물리학, 화학
- 경북대: 대수, 물리학, 화학
- 경희대: 대수, 물리학, 화학
- 고려대: 미적분II, 물리학
- 국민대: 미적분I, 미적분II, 기하, 물리학
- 단국대⁎: 국어, 대수, 영어, 물리학
- 동아대: 대수, 물리학
- 부산대: 미적분II, 기하, 물리학, 화학
- 서울과기대: 대수, 물리학, 화학
- 서울대: 미적분II, 기하, 물리학
- 서울시립대: 확률과통계, 미적분I, 미적분II, 기하, 물리학
- 아주대⁎: 대수, 물리학
- 영남대: 대수, 영어, 물리학, 화학
- 인하대: 물리학, 화학
- 전남대: 대수, 물리학
- 전북대: 대수, 물리학
- 전주대: 대수, 미적분I, 미적분II, 기하
- 조선대: 대수, 물리학
- 중앙대: 미적분II, 기하, 물리학, 화학
- 충북대: 대수, 물리학
- 한국기술교육대: 국어, 대수, 영어, 물리학
- 한국항공대: 대수, 물리학
- 한라대: 국어
- 한양대(ERICA): 미적분I, 물리학

## 컴퓨터공학 [공학]
- 가톨릭대: 대수, 물리학
- 강원대(춘천): 확률과통계, 미적분I, 미적분II, 영어
- 건국대: 대수, 미적분I, 미적분II, 기하, 물리학
- 경북대: 대수, 물리학, 화학
- 경희대: 대수
- 고려대: 미적분II, 기하
- 광운대: 대수, 물리학
- 국민대: 미적분I, 미적분II, 기하, 물리학
- 단국대⁎: 국어, 대수, 영어, 물리학
- 동국대: 대수
- 동아대: 대수, 영어, 물리학
- 부산대: 확률과통계, 미적분II, 기하
- 서울과기대: 대수, 물리학
- 서울시립대: 미적분I, 미적분II, 물리학
- 숭실대: 미적분II, 기하, 물리학⁎
- 영남대: 국어, 대수, 영어, 물리학
- 전남대: 대수, 물리학
- 전북대: 대수, 물리학
- 전주대: 대수, 확률과통계, 미적분I, 미적분II, 기술·가정/정보
- 조선대: 대수, 물리학
- 충남대: 대수, 확률과통계, 미적분I, 미적분II, 물리학⁎
- 충북대: 대수, 확률과통계, 미적분I, 미적분II, 물리학
- 아주대⁎: 대수, 물리학
- 원광대: 대수, 화학, 생명과학
- 중앙대: 미적분II, 기하, 화학, 생명과학
- 한국기술교육대: 국어, 대수, 영어, 물리학
- 한국항공대: 대수, 물리학
- 한라대: 국어
- 한양대(ERICA): 확률과통계, 미적분I
- 협성대⁎: 기타

## 약학 [의약]
- 가톨릭대: 대수, 화학, 생명과학
- 강원대(춘천): 확률과통계, 미적분I, 미적분II, 화학, 생명과학
- 경북대: 대수, 확률과통계, 미적분I, 미적분II, 물리학, 화학, 생명과학
- 경성대: 미적분II, 기하, 화학, 생명과학
- 경희대: 대수, 확률과통계, 미적분I, 미적분II, 화학, 생명과학
- 덕성여대: 대수, 화학, 생명과학
- 동국대: 대수, 화학, 생명과학
- 서울대: 미적분II, 기하, 화학, 생명과학
- 부산대: 화학, 생명과학
- 영남대: 대수, 영어, 물리학, 화학, 생명과학
- 한양대(ERICA): 화학, 생명과학

## 의예 [의약]
- 가톨릭대: 대수, 화학, 생명과학
- 강원대(춘천): 국어, 확률과통계, 미적분I, 미적분II, 영어, 화학, 생명과학
- 건국대(글로컬): 대수, 생명과학
- 경북대: 대수, 확률과통계, 미적분I, 미적분II, 물리학, 화학, 생명과학
- 경희대: 대수, 확률과통계, 미적분I, 미적분II, 물리학, 화학, 생명과학
- 고려대: 미적분II, 화학, 생명과학
- 동아대: 국어, 대수, 영어, 물리학
- 부산대: 화학, 생명과학
- 서울대: 미적분II, 기하, 생명과학
- 아주대⁎: 대수, 물리학
- 영남대: 대수, 영어, 물리학, 화학, 생명과학
- 원광대: 대수, 화학, 생명과학
- 전남대: 대수, 영어, 생명과학
- 전북대: 대수, 영어
- 조선대: 대수, 물리학
- 중앙대: 미적분II, 기하, 화학, 생명과학
- 충남대: 대수, 화학, 생명과학
- 충북대: 영어, 물리학

## 시각디자인 [예체능]
- 강원대(삼척): 국어, 영어, 미술/미술창작/미술감상과비평
- 국립한밭대: 국어, 영어
- 동아대: 국어, 영어
- 조선대: 국어, 일반사회, 산업디자인
- 전주대: 미술/기술가정/교양

## 음악 [예체능]
- 동아대: 국어, 영어

## 체육 [예체능]
- 동아대: 국어, 미적분I, 미적분II, 기하, 영어, 일반사회, 물리학
- 동양대: 국어, 미적분I, 미적분II, 기하, 영어, 일반사회, 물리학
- 조선대: 국어
- 한체대: 체육스포츠과학/스포츠생활
`;

const COURSE_DESCRIPTIONS = `
2022 개정 교육과정 주요 과목 설명

## 수학 교과
- 대수: 다항식, 방정식과 부등식, 경우의 수 등 대수적 사고력을 기르는 일반선택 과목
- 미적분I: 수열의 극한, 함수의 극한과 연속, 미분법과 적분법의 기초를 학습하는 일반선택 과목
- 확률과 통계: 경우의 수, 확률, 통계적 추정 등을 학습하는 일반선택 과목
- 기하: 이차곡선, 벡터, 공간도형과 공간좌표를 학습하는 진로선택 과목. 이공계열 진학 시 중요
- 미적분II: 여러 가지 미분법, 여러 가지 적분법, 미분방정식의 기초를 학습하는 진로선택 과목. 자연계열 핵심
- 경제 수학: 경제적 상황에서 수학적 개념을 활용하는 진로선택 과목
- 인공지능 수학: AI관련 수학적 기초(행렬, 최적화 등)를 학습하는 진로선택 과목
- 수학과제 탐구: 수학 관련 주제를 탐구하는 융합선택 과목
- 실용 통계: 실생활 통계 분석 능력을 기르는 융합선택 과목

## 과학 교과
- 물리학: 힘과 운동, 전기와 자기, 파동과 빛, 열과 에너지 등 물리학의 기본 개념을 학습하는 일반선택 과목. 공학계열 필수
- 화학: 물질의 구조, 화학 결합, 화학 반응 등 화학의 기본 개념을 학습하는 일반선택 과목
- 생명과학: 세포, 유전, 진화, 생태계 등 생명현상의 기본 원리를 학습하는 일반선택 과목
- 지구과학: 지구의 구조와 역사, 대기와 해양, 우주 등을 학습하는 일반선택 과목
- 역학과 에너지: 뉴턴 역학의 심화, 에너지와 열역학을 깊이 학습하는 진로선택 과목. 기계/항공/물리 관련 학과에 중요
- 전자기와 양자: 전자기학과 현대물리학(양자역학 기초)을 학습하는 진로선택 과목. 전기전자/반도체/물리 관련 학과에 중요
- 물질과 에너지: 화학 결합의 심화, 분자 구조, 에너지 변환을 학습하는 진로선택 과목. 화학/화공/재료 관련 학과에 중요
- 화학 반응의 세계: 화학 반응의 규칙성, 화학 평형, 산·염기 반응 등을 학습하는 융합선택 과목
- 세포와 물질대사: 세포의 구조와 기능, 효소, 물질대사를 깊이 학습하는 진로선택 과목. 의학/약학/생명과학 관련 학과에 중요
- 생물의 유전: 멘델 유전, 사람의 유전, 유전자 발현을 깊이 학습하는 융합선택 과목. 생명과학/의학 관련 학과에 중요
- 지구시스템과학: 지구 시스템의 상호작용, 기후변화를 학습하는 진로선택 과목
- 행성우주과학: 태양계, 항성, 은하, 우주론을 학습하는 융합선택 과목
- 과학의 역사와 문화: 과학의 발전 과정과 사회적 영향을 학습하는 융합선택 과목
- 기후변화와 환경생태: 기후변화의 원인과 영향, 생태계 보전을 학습하는 융합선택 과목
- 융합과학 탐구: 교과 간 융합적 주제를 탐구하는 융합선택 과목

## 국어 교과
- 화법과 언어: 의사소통 능력과 국어 문법을 심화 학습하는 일반선택 과목
- 독서와 작문: 읽기와 쓰기를 심화 학습하는 일반선택 과목
- 문학: 한국 문학과 세계 문학을 감상·비평하는 일반선택 과목

## 사회 교과
- 세계시민과 지리: 세계 여러 지역의 자연환경과 인문환경을 학습하는 일반선택 과목
- 세계사: 세계 역사의 흐름을 학습하는 일반선택 과목
- 사회와 문화: 사회·문화 현상을 탐구하는 일반선택 과목
- 현대사회와 윤리: 현대 사회의 윤리적 쟁점을 탐구하는 일반선택 과목
- 정치: 정치과정과 참여, 국제정치를 학습하는 진로선택 과목
- 법과 사회: 법의 이념과 기능, 개인생활과 법을 학습하는 진로선택 과목
- 경제: 경제생활, 시장경제, 국가경제를 학습하는 진로선택 과목
- 윤리와 사상: 동서양 윤리사상을 학습하는 진로선택 과목

## 기술·가정/정보 교과
- 정보: 컴퓨터과학의 기본 개념과 프로그래밍을 학습하는 일반선택 과목
- 인공지능 기초: AI의 원리와 활용을 학습하는 진로선택 과목
- 데이터 과학: 데이터 수집·분석·시각화를 학습하는 진로선택 과목
`;

const SYSTEM_PROMPT = `당신은 2028 대학입시를 준비하는 한국 고등학생을 위한 '2028 교빛 봇'입니다.

## 두 가지 모드

### 모드 1: 학과 검색
사용자가 학과명(예: "기계공학과")을 입력하면:
**1단계** - 유사 학과 목록을 체크박스 형태로 제공합니다.
반드시 아래 형식을 정확히 따르세요:

"기계공학과"와 관련된 학과들을 찾았어요! 🔍
관심 있는 학과를 선택해주세요:

- [ ] 고려대학교 기계공학부
- [ ] 중앙대학교 기계공학부

반드시 "- [ ] " (하이픈 공백 대괄호열기 공백 대괄호닫기 공백) 형식을 사용하세요.

**2단계** - 사용자가 특정 학과들을 선택하면, 해당 학과들의 상세 정보를 알기 쉽게 정리합니다.

표 형식은 절대 사용하지 마세요. 대신 아래와 같이 자연스러운 줄글+리스트 형태로 작성하세요:

---

## 🏫 고려대학교 반도체공학과

**권장 과목:**
- **역학과 에너지** (진로선택) — 뉴턴 역학의 심화 과정으로, 반도체 장비 설계에 중요한 물리적 토대가 됩니다.
- **전자기와 양자** (진로선택) — 전자기학과 양자역학의 기초를 다루며, 반도체의 작동 원리를 직접적으로 이해하는 핵심 과목입니다.

---

## 🏫 중앙대학교 지능형반도체공학과

**권장 과목:**
- **미적분II** (진로선택) — 여러 가지 미분법과 적분법을 학습하며, 공학적 모델링의 기초입니다.
- **기하** (진로선택) — 벡터와 공간도형을 학습하며, 반도체 소자 구조 이해에 필수적입니다.
...

---

이런 형식으로 각 대학-학과별로 구분선(---)으로 나누고, 과목명을 볼드체로, 구분(일반/진로/융합선택)을 괄호로, 설명을 대시(—) 뒤에 간결하게 적어주세요.

마지막에 과목 선택 팁을 2-3줄로 간단히 추가하세요.

내용이 많으면 <!--PAGE_BREAK--> 마커를 사용하여 페이지를 나눠주세요 (대학 2-3개씩).

### 모드 2: 과목 검색
사용자가 과목명(예: "미적분II", "물리학")을 입력하면:
해당 과목에 대해 아래처럼 자연스럽게 설명해주세요:

## 📘 미적분II

**구분:** 진로선택 과목

**내용:** 여러 가지 미분법, 여러 가지 적분법, 미분방정식의 기초를 학습합니다. 자연계열 핵심 과목으로, 공학적 설계와 모델링의 수학적 토대가 됩니다.

**선수 과목:** 공통수학1·2 → 미적분I을 먼저 이수해야 합니다.

**이 과목이 중요한 학과:** 기계공학, 전기전자공학, 화학공학, 반도체공학 등 대부분의 이공계열

이런 식으로 깔끔하게 정리하세요.

## 🔗 후속 안내 (매우 중요!)
모든 답변의 맨 마지막에, 사용자가 다음으로 할 수 있는 행동을 자연스러운 텍스트로 안내하세요.
절대 "- [ ]" 체크박스 형식을 사용하지 마세요! 체크박스는 오직 모드1의 1단계(학과 선택 목록)에서만 사용합니다.

아래처럼 일반 텍스트로 안내하세요:

---
💡 더 궁금한 것이 있으신가요?
- 특정 과목이 궁금하시면 하단 채팅창에 과목명(예: 기하, 역학과 에너지)을 입력해보세요!
- 다른 학과의 권장 과목이 궁금하시면 학과명(예: 컴퓨터공학과)을 입력해보세요!

이런 식으로 사용자가 직접 채팅창에 입력하도록 안내하세요. 클릭 가능한 선택지처럼 보이게 하지 마세요.

## 응답 규칙
- 표(table) 대신 헤딩+볼드+리스트 조합으로 깔끔하게 정리하세요.
- 친근하고 격려하는 톤, 이모지 적절히 사용.
- 제공된 데이터에 없는 정보를 지어내지 마세요.
- 입력이 학과명인지 과목명인지 판단하여 적절한 모드로 응답하세요.
- 학과명과 과목명 모두 아닌 경우, 어떤 것을 찾고 있는지 물어보세요.
- "- [ ]" 체크박스는 오직 모드1의 1단계(유사 학과 목록)에서만 사용하세요. 그 외에는 절대 사용하지 마세요.
- 응답에서 마크다운 문법(**볼드**, ##헤딩 등)은 자연스럽게 사용하되, 프론트엔드가 이를 렌더링하므로 걱정하지 마세요.

아래는 참고 데이터입니다:

${UNIVERSITY_DATA}

${COURSE_DESCRIPTIONS}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Convert messages to Gemini format
    const geminiContents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const systemInstruction = { parts: [{ text: SYSTEM_PROMPT }] };

    const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
    const nonStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
      system_instruction: systemInstruction,
      contents: geminiContents,
      generationConfig: { temperature: 0.7 },
    };

    const fallbackToLovableGateway = async () => {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "현재 AI 요청이 많습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fallbackResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!fallbackResp.ok) {
        const fallbackText = await fallbackResp.text();
        console.error("Lovable AI fallback error:", fallbackResp.status, fallbackText);

        if (fallbackResp.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI 사용 크레딧이 부족합니다. 크레딧을 충전한 후 다시 시도해주세요." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (fallbackResp.status === 429) {
          return new Response(
            JSON.stringify({ error: "AI 요청이 많아 일시적으로 지연되고 있습니다. 잠시 후 다시 시도해주세요." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: "AI 서비스 호출에 실패했습니다. 잠시 후 다시 시도해주세요." }),
          { status: fallbackResp.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(fallbackResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // 1) Try streaming first, with lightweight retry on 429
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;
      if (response.status !== 429) break;
      if (attempt < 2) await sleep(800 * (attempt + 1));
    }

    // 2) If streaming is still rate-limited, fallback to non-stream request
    if (response && !response.ok && response.status === 429) {
      const fallback = await fetch(nonStreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (fallback.ok) {
        const data = await fallback.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        const oneShotSse = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(oneShotSse, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      const fallbackErrText = await fallback.text();
      console.error("Gemini fallback error:", fallback.status, fallbackErrText);
      return await fallbackToLovableGateway();
    }

    if (!response || !response.ok) {
      const providerErrorText = response ? await response.text() : "No response";
      console.error("Gemini API error:", response?.status, providerErrorText);

      if (response?.status === 400 && providerErrorText.includes("API key expired")) {
        return new Response(
          JSON.stringify({ error: "Gemini API 키가 만료되었거나 유효하지 않습니다. 키를 다시 발급해 교체해주세요." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response?.status === 429) {
        return await fallbackToLovableGateway();
      }

      return new Response(
        JSON.stringify({ error: "AI 서비스 호출 중 오류가 발생했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const openaiChunk = { choices: [{ delta: { content: text } }] };
                await writer.write(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
              }
            } catch {
              // ignore partial/invalid lines
            }
          }
        }

        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream transform error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("course-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
