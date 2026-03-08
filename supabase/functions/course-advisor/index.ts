import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Question type classification ──
type QuestionType = "university_only" | "subject_recommendation" | "admission_plan" | "subject_description" | "admission_philosophy" | "general";

function classifyQuestion(text: string): QuestionType {
  const lower = text.toLowerCase();

  // 전형안 질문 (대학+전형안/전형 패턴)
  if (/전형안|2028\s*전형|전형\s*종류|전형\s*목록|어떤\s*전형|전형\s*안내/.test(lower)) {
    return "admission_plan";
  }

  // 전형 철학/평가 방식 질문 (최우선 체크 — 벡터 검색 필요)
  if (/평가|방식|철학|어떤\s*학생|인재상|선발\s*기준|평가\s*기준|어떻게\s*평가|어떻게\s*선발|어떤\s*인재|가치|핵심\s*역량|역량|학생부종합|종합전형|학종/.test(lower)) {
    return "admission_philosophy";
  }

  // 권장과목/추천과목 질문
  if (/권장\s*과목|추천\s*과목|뭐\s*들어야|과목\s*추천|어떤\s*과목.*들어|이수.*과목|필수.*과목/.test(lower)) {
    return "subject_recommendation";
  }

  // 전형 정보 질문
  if (/수능\s*최저|전형\s*방법|면접|서류|선발\s*방법|전형\s*유형|모집\s*인원|정시|수시|논술/.test(lower)) {
    return "admission_plan";
  }

  // 과목 내용/설명 질문
  if (/어떤\s*과목|무슨\s*내용|뭐\s*배워|선이수|위계\s*과목|과목\s*설명|과목.*내용/.test(lower)) {
    return "subject_description";
  }

  // Default: try to detect if it's a university+department or subject name
  const hasUniversityPattern = /대학?교?|대$/.test(lower);
  const hasDepartmentPattern = /학과|학부|계열|전공|예과/.test(lower);

  // University-only: has university name but no department, no admission keyword, no other specific intent
  if (hasUniversityPattern && !hasDepartmentPattern) {
    return "university_only";
  }

  if (hasDepartmentPattern) {
    return "subject_recommendation";
  }

  // Check if input is just a known university alias (e.g. "중앙대", "서울대")
  const trimmed = text.trim();
  const KNOWN_UNI_ALIASES = Object.keys(UNIVERSITY_ALIASES);
  if (KNOWN_UNI_ALIASES.some(alias => trimmed === alias || trimmed === alias + "학교")) {
    return "university_only";
  }

  return "general";
}

function isAdmissionPhilosophyPriorityQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return /평가|방식|철학|어떤\s*학생|인재상|학생부종합|종합전형|학종|선발\s*기준|평가\s*기준/.test(lower);
}

// ── Course descriptions (static, small) ──
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
- 역학과 에너지: 뉴턴 역학의 심화, 에너지와 열역학을 깊이 학습하는 진로선택 과목
- 전자기와 양자: 전자기학과 현대물리학(양자역학 기초)을 학습하는 진로선택 과목
- 물질과 에너지: 화학 결합의 심화, 분자 구조, 에너지 변환을 학습하는 진로선택 과목
- 화학 반응의 세계: 화학 반응의 규칙성, 화학 평형, 산·염기 반응 등을 학습하는 융합선택 과목
- 세포와 물질대사: 세포의 구조와 기능, 효소, 물질대사를 깊이 학습하는 진로선택 과목
- 생물의 유전: 멘델 유전, 사람의 유전, 유전자 발현을 깊이 학습하는 융합선택 과목
- 지구시스템과학: 지구 시스템의 상호작용, 기후변화를 학습하는 진로선택 과목
- 행성우주과학: 태양계, 항성, 은하, 우주론을 학습하는 융합선택 과목
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

## 질문 유형별 응답

사용자의 질문 유형에 따라 시스템이 자동으로 관련 데이터를 조회하여 제공합니다.
제공된 데이터를 기반으로 정확하고 친절하게 답변하세요.

### 유형 0: 대학명만 입력 (학과/전형/과목 지정 없이 "중앙대", "서울대" 등만 입력한 경우)
사용자가 대학명만 단독으로 입력하면, 무엇이 궁금한지 물어보며 선택지를 SUGGEST 버튼으로 제시하세요.

예시 답변:
👋 **중앙대학교**에 대해 알아보고 싶으신가요?

궁금한 내용을 선택해주세요! 👇

<!--SUGGEST:중앙대 2028 전형안-->
<!--SUGGEST:중앙대 컴퓨터공학부 권장과목-->
<!--SUGGEST:중앙대 경영학과 권장과목-->
<!--SUGGEST:중앙대 학생부종합전형-->

- 대학명만 입력된 경우 절대로 바로 상세 정보를 내보내지 마세요.
- 반드시 "전형안 보기", "학과별 권장과목 보기" 등의 선택지를 먼저 제시하세요.
- 해당 대학의 데이터가 없더라도 일단 선택지를 제시하고, 사용자가 선택한 후에 데이터 유무를 판단하세요.

### 유형 1: 학과별 권장과목 (university_subjects 데이터 제공)
사용자가 학과명 또는 대학+학과를 입력하면 DB에서 조회한 권장과목 데이터가 제공됩니다.
- **핵심권장(is_core=true)**: 필수적으로 이수를 권장하는 과목
- **일반권장(is_recommended=true)**: 가급적 이수를 권장하는 과목

**1단계** - 여러 학과가 매칭되면 체크박스 형태로 제공:

"기계공학과"와 관련된 학과들을 찾았어요! 🔍
관심 있는 학과를 선택해주세요:

- [ ] 고려대학교 기계공학부
- [ ] 경희대학교 기계공학부

반드시 "- [ ] " 형식을 사용하세요. **데이터에 있는 대학만** 보여주세요.

**2단계** - 사용자가 특정 학과들을 선택하면 상세 정보를 제공:

---

## 🏫 고려대학교 기계공학부

**핵심 권장 과목:**
- 🧮 **미적분II** — 여러 가지 미분법과 적분법을 학습하는 진로선택 과목
  ⚠️ 선이수 과목: 미적분I

**일반 권장 과목:**
- 🍎 **역학과 에너지** — 뉴턴 역학 심화, 기계공학의 핵심 물리 토대

---

내용이 많으면 <!--PAGE_BREAK--> 마커를 사용하여 페이지를 나눠주세요 (대학 2-3개씩).

### 유형 2: 전형 정보 (admission_plans 데이터 제공)
수능최저, 전형방법, 선발방식 등의 질문에는 제공된 전형 데이터를 기반으로 답변합니다.
- 수능최저학력기준, 전형방법, 교과이수반영 여부 등을 정확히 전달
- 숫자와 세부사항은 데이터 그대로 인용

**"XX대 2028 전형안" 같은 전형 안내 질문일 때:**
1단계: 해당 대학의 전형 목록을 보여주며 "어떤 전형이 궁금하신가요?" 질문
- 데이터가 있으면 admission_plans에서 가져온 전형명을 <!--SUGGEST:XX대 학생부교과전형--> 버튼으로 제시
- 데이터가 없으면 documents 벡터 검색 결과를 기반으로 해당 대학에서 언급된 전형명을 추출하여 SUGGEST 버튼으로 제시
- 전형 버튼은 반드시 "대학명 전형명" 형태로: <!--SUGGEST:건국대 학생부종합전형-->
- 추가로 해당 대학의 인기 학과도 함께 제안: <!--SUGGEST:건국대 컴퓨터공학부 권장과목-->

2단계: 사용자가 특정 전형을 선택하면 상세 정보를 제공
- 전형 방법, 수능 최저, 교과이수 반영 등 핵심 정보를 구조화
- **반드시** 해당 전형에서 권장과목이 중요한 경우 "이 전형에서는 교과이수를 반영하므로, 권장과목 확인이 중요합니다"와 함께 학과별 권장과목 조회를 유도하는 SUGGEST 버튼을 추가
- 예: <!--SUGGEST:건국대 컴퓨터공학부 권장과목--> <!--SUGGEST:건국대 경영학과 권장과목-->

**전형↔과목↔학과 연계 규칙 (매우 중요!):**
- 전형 설명 후 반드시 "이 대학의 학과별 권장과목도 확인해보세요!" 문구와 함께 해당 대학 학과 SUGGEST 버튼 2~3개 추가
- 과목 설명 후 "이 과목을 권장하는 학과"를 SUGGEST 버튼으로 추가  
- 학과 권장과목 설명 후 "이 대학의 전형도 확인해보세요!" 문구와 함께 전형 SUGGEST 버튼 추가
- 이렇게 [전형] ↔ [권장과목] ↔ [과목설명]이 꼬리를 물고 이어지도록 구성

### 유형 3: 과목 설명 (subject_descriptions 벡터검색 결과 제공)
과목 내용, 선이수 과목 등의 질문에는 벡터검색으로 찾은 과목 설명을 기반으로 답변합니다.

### 유형 4: 전형 철학/평가 방식 (documents 벡터검색 결과 제공)
대학의 인재상, 평가 방식, 학생부종합전형 철학 등에 대한 질문에는 관련 문서를 기반으로 답변합니다.

**⚠️ 매우 중요**: 아래에 "관련 문서 (벡터 검색)" 섹션이 제공되면, 그 문서 내용을 **반드시** 활용하여 답변하세요.
- 문서 데이터가 제공되었는데 "정보가 없다", "자료가 없다"고 답하는 것은 **절대 금지**입니다.
- 문서의 내용을 요약하고 구조화하여 사용자에게 전달하세요.
- 문서에 특정 대학 이름이 명시되어 있지 않더라도, 검색된 문서 내용을 바탕으로 일반적인 학생부종합전형의 평가 방식이나 철학을 설명해주세요.

## 톤앤매너 (매우 중요)
- 딱딱한 보고서가 아닌, 친절한 멘토가 설명해주는 느낌으로 써.
- 첫 줄은 이모지와 함께 인사/요약으로 시작해. 예: '👋 동국대 컴퓨터AI학부를 준비하시나요?'
- 자연스러운 연결어를 써. 예: '정리해 드릴게요!', '참고하시면 좋아요!'

## 이모지 규칙 (반드시 지켜)
- 섹션 제목 앞에 이모지를 붙여. 예: '📚 핵심 권장 과목', '💡 유사 학과 추천', '⚠️ 위계 과목 안내'
- 과목명 앞에 과목 성격에 맞는 이모지를 붙여:
  수학 계열: 🧮, 과학 계열: 🔬, 물리: 🍎, 화학: 🧪, 생명과학: 🧬, 지구과학: 🌍
  정보/AI: 💻, 사회: 🏛️, 언어: 🗣️, 기타: 📖
- 단, 이모지를 과도하게 쓰지 마. 항목당 1개만.

## 텍스트 작성 규칙 (반드시 지켜)
- 모든 설명은 1~2줄 이내로 짧고 명료하게.
- 긴 줄글(3줄 이상 단락)은 절대 쓰지 마.
- 정보는 반드시 bullet list(-)로 구조화해.
- 핵심 키워드(과목명, 학과명, 대학명)는 반드시 **굵게** 표시.
- 섹션 사이에는 반드시 빈 줄 하나를 넣어.
- HTML 태그는 절대 사용하지 마. 순수 마크다운만 사용해.

## 위계 과목(선수 과목) 안내 규칙
- 권장 과목 중 선수 과목(위계 과목)이 필요한 과목이 있으면 반드시 언급해.
- 선이수 과목 정보는 과목 설명과 같은 줄에 쓰지 말고, 반드시 줄바꿈 후 별도 줄에 표기해.
- 위계 관계 목록:
  - **대수** ← 공통수학1, 공통수학2 선이수 필요
  - **미적분II** ← 미적분I 선이수 필요
  - **역학과 에너지** ← 물리학 선이수 필요
  - **물질과 에너지** ← 화학 선이수 필요
  - **화학반응의 세계** ← 화학 선이수 필요
  - **생명과학과 지구시스템** ← 생명과학 선이수 필요
  - **생명과학실험** ← 생명과학 선이수 필요
  - **지구과학실험** ← 지구과학 선이수 필요
  - **확률과 통계** ← 공통수학1, 공통수학2 선이수 필요

## 후속 질문 버튼 규칙 (매우 중요)
- 답변 마지막에 반드시 <!--SUGGEST:텍스트--> 형태로 후속 질문 버튼을 4~8개 추가해.
- 버튼에는 반드시 데이터에 실제로 존재하는 과목명이나 "대학명 학과명" 조합만 사용해.
- 존재하지 않는 과목이나 학과를 절대 만들어내지 마.
- 학과 버튼은 반드시 "대학명 학과명" 형태로 써. 예: <!--SUGGEST:경희대 의예과-->
- 전형 버튼은 "대학명 전형명" 형태로 써. 예: <!--SUGGEST:건국대 학생부종합전형-->
- 음악, 미술, 체육 관련 학과나 과목은 추천하지 마.
- **꼬리물기 규칙**: 학과 답변 후 → 전형 버튼 추가, 전형 답변 후 → 학과/과목 버튼 추가, 과목 답변 후 → 학과 버튼 추가. 항상 다른 카테고리로 연결되는 버튼을 1~2개 이상 포함해.

## 가독성 규칙 (매우 중요!)
대부분의 사용자가 모바일 환경에서 읽습니다.
- **단락 사이에 빈 줄을 넉넉히** 넣으세요.
- 리스트 항목 사이에도 빈 줄을 넣어 여유롭게 배치하세요.
- 한 문단이 4줄을 넘지 않도록 하세요.
- 핵심 정보는 **볼드**로 강조하여 스캔하기 쉽게 하세요.
- 대학별 정보를 나열할 때 "---" 구분선과 헤딩(##)을 적극 활용하세요.
- 표(table) 대신 헤딩+볼드+리스트 조합으로 깔끔하게 정리하세요.

## 과목 설명 참고 자료
${COURSE_DESCRIPTIONS}
`;

// ── DB query helpers ──

// ── 대입 전용 동의어/줄임말 사전 ──
const UNIVERSITY_ALIASES: Record<string, string> = {
  "건대": "건국대학교", "설대": "서울대학교", "서울대": "서울대학교",
  "경희대": "경희대학교", "고대": "고려대학교", "연대": "연세대학교",
  "중대": "중앙대학교", "한대": "한양대학교", "성대": "성균관대학교",
  "서강대": "서강대학교", "이대": "이화여자대학교", "숙대": "숙명여자대학교",
  "동대": "동국대학교", "홍대": "홍익대학교", "국대": "국민대학교",
  "숭대": "숭실대학교", "세대": "세종대학교", "광대": "광운대학교",
  "단대": "단국대학교", "인대": "인하대학교", "아대": "아주대학교",
  "건국대": "건국대학교", "고려대": "고려대학교", "연세대": "연세대학교",
  "중앙대": "중앙대학교", "한양대": "한양대학교", "성균관대": "성균관대학교",
  "동국대": "동국대학교", "홍익대": "홍익대학교", "국민대": "국민대학교",
  "숭실대": "숭실대학교", "세종대": "세종대학교", "광운대": "광운대학교",
  "단국대": "단국대학교", "인하대": "인하대학교", "아주대": "아주대학교",
  "가천대": "가천대학교", "명지대": "명지대학교", "상명대": "상명대학교",
};

const ADMISSION_TYPE_ALIASES: Record<string, string> = {
  "학종": "학생부종합전형", "학생부종합": "학생부종합전형",
  "교과": "학생부교과전형", "학생부교과": "학생부교과전형",
  "논술": "논술위주전형", "정시": "수능위주전형", "수능": "수능위주전형",
};

// 전형 관련 키워드 목록 (department로 취급하면 안 되는 단어들)
const ADMISSION_KEYWORDS_SET = new Set([
  "학종", "학생부종합", "학생부종합전형", "교과", "학생부교과", "학생부교과전형",
  "논술", "논술위주전형", "정시", "수능위주전형", "수능", "전형", "전형안",
  "수시", "종합전형", "교과전형", "2028",
]);

// Extract university, department, and admission type keywords from question text
function extractKeywords(question: string): { universityKeyword: string; departmentKeyword: string; admissionKeyword: string } {
  // Known university name stems (without 대/대학/대학교 suffix)
  const KNOWN_UNIVERSITIES = [
    "서울", "고려", "연세", "경희", "중앙", "한양", "성균관", "서강", "이화",
    "숙명", "동국", "건국", "홍익", "국민", "숭실", "세종", "광운", "명지",
    "상명", "가톨릭", "서울시립", "인하", "아주", "부산", "경북", "전남",
    "충남", "충북", "전북", "강원", "제주", "울산", "경상", "한국외국어",
    "한국항공", "서울과학기술", "한국교통", "단국", "가천", "덕성",
  ];

  // Step 0: 줄임말 사전을 먼저 적용하여 정식 명칭으로 변환
  let normalizedQuestion = question;
  
  // 대학명 줄임말 → 정식 명칭 (긴 것부터 매칭)
  const sortedUniAliases = Object.entries(UNIVERSITY_ALIASES).sort((a, b) => b[0].length - a[0].length);
  let resolvedUniversity = "";
  for (const [alias, fullName] of sortedUniAliases) {
    if (normalizedQuestion.includes(alias)) {
      resolvedUniversity = fullName;
      normalizedQuestion = normalizedQuestion.replace(alias, "");
      break;
    }
  }

  // 전형명 줄임말 → 정식 명칭 (긴 것부터 매칭)
  let resolvedAdmission = "";
  const sortedAdmAliases = Object.entries(ADMISSION_TYPE_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, fullName] of sortedAdmAliases) {
    if (normalizedQuestion.includes(alias)) {
      resolvedAdmission = fullName;
      normalizedQuestion = normalizedQuestion.replace(alias, "");
      break;
    }
  }

  const words = normalizedQuestion.split(/\s+/).filter(w => w.length >= 1);
  let universityKeyword = resolvedUniversity ? resolvedUniversity.replace(/(대학교|대학|대)$/g, "").trim() : "";
  let admissionKeyword = resolvedAdmission;
  const departmentCandidates: string[] = [];

  for (const word of words) {
    if (!word.trim()) continue;
    
    // 전형 관련 키워드는 admissionKeyword로 분류 (절대 department로 안 감)
    if (ADMISSION_KEYWORDS_SET.has(word)) {
      if (!admissionKeyword) {
        admissionKeyword = ADMISSION_TYPE_ALIASES[word] || word;
      }
      continue;
    }

    if (/대학교|대학|대$/.test(word)) {
      if (!universityKeyword) {
        universityKeyword = word.replace(/(대학교|대학|대)$/g, "").trim() || word;
      }
    } else if (/학과|학부|계열|전공|예과|과$/.test(word)) {
      const stripped = word.replace(/(학과|학부|계열|전공|예과|과)$/g, "").trim();
      if (stripped) departmentCandidates.push(stripped);
    } else if (!/권장|추천|과목|알려|어떤|정보|보여|상세|평가|방식|철학|인재상|기준|에|대해|줘|해|알려줘|대해서/.test(word)) {
      if (!universityKeyword && KNOWN_UNIVERSITIES.some(u => word.includes(u) || u.includes(word))) {
        universityKeyword = word;
      } else if (word.length >= 2) {
        departmentCandidates.push(word);
      }
    }
  }

  // If still no university but we have 2+ candidates AND no admission keyword, heuristic: first might be university
  if (!universityKeyword && !admissionKeyword && departmentCandidates.length >= 2) {
    const first = departmentCandidates.shift()!;
    universityKeyword = first;
  }

  const departmentKeyword = departmentCandidates[0] || "";
  return { universityKeyword, departmentKeyword, admissionKeyword };
}

async function querySubjectRecommendations(supabase: any, question: string) {
  const { universityKeyword, departmentKeyword } = extractKeywords(question);
  console.log('키워드 추출 결과 — university:', universityKeyword, 'department:', departmentKeyword);

  if (!universityKeyword && !departmentKeyword) {
    console.log('키워드 없음, 전체 질문으로 검색:', question);
    const { data, error } = await supabase
      .from('university_subjects')
      .select('university, department, subject, is_core, is_recommended, year')
      .ilike('department', `%${question}%`)
      .limit(100);
    if (error) console.error('university_subjects 쿼리 에러:', error);
    console.log('결과:', data?.length ?? 0, '행');
    return data && data.length > 0 ? data : null;
  }

  // Both university and department
  if (universityKeyword && departmentKeyword) {
    const { data, error } = await supabase
      .from('university_subjects')
      .select('university, department, subject, is_core, is_recommended, year')
      .ilike('university', `%${universityKeyword}%`)
      .ilike('department', `%${departmentKeyword}%`);

    if (error) console.error('university_subjects 쿼리 에러:', error);
    console.log('university_subjects 결과:', data?.length ?? 0, '행', 'university:', universityKeyword, 'department:', departmentKeyword);

    if (data && data.length > 0) return data;

    // Fallback 1: department only (show same department at other universities)
    const { data: deptData, error: deptError } = await supabase
      .from('university_subjects')
      .select('university, department, subject, is_core, is_recommended, year')
      .ilike('department', `%${departmentKeyword}%`)
      .limit(100);

    if (deptError) console.error('학과 폴백 쿼리 에러:', deptError);
    console.log('학과 폴백 결과:', deptData?.length ?? 0, '행');
    if (deptData && deptData.length > 0) return deptData;

    // Fallback 2: university only (show other departments at same university)
    const { data: uniData, error: uniError } = await supabase
      .from('university_subjects')
      .select('university, department, subject, is_core, is_recommended, year')
      .ilike('university', `%${universityKeyword}%`)
      .limit(30);

    if (uniError) console.error('대학 폴백 쿼리 에러:', uniError);
    console.log('대학 폴백 결과:', uniData?.length ?? 0, '행');
    return uniData && uniData.length > 0 ? uniData : null;
  }

  // University only or department only
  const filterCol = universityKeyword ? 'university' : 'department';
  const filterVal = universityKeyword || departmentKeyword;
  const { data, error } = await supabase
    .from('university_subjects')
    .select('university, department, subject, is_core, is_recommended, year')
    .ilike(filterCol, `%${filterVal}%`)
    .limit(200);

  if (error) console.error('university_subjects 쿼리 에러:', error);
  console.log('university_subjects 단일 필터 결과:', data?.length ?? 0, '행', filterCol, ':', filterVal);
  return data && data.length > 0 ? data : null;
}

// 일반적인(필터링에 무의미한) 전형 키워드
const GENERIC_ADMISSION_WORDS = new Set([
  "전형", "방식", "평가", "선발", "입시", "입학", "모집", "원서",
]);

async function queryAdmissionPlans(supabase: any, question: string, universityKw: string, admissionKw: string) {
  // admissionKw가 일반 단어면 필터에서 제외
  const effectiveAdmKw = admissionKw && !GENERIC_ADMISSION_WORDS.has(admissionKw) ? admissionKw : "";

  // Build query with extracted keywords
  let query = supabase.from("admission_plans").select("*");

  if (universityKw) {
    query = query.ilike("university", `%${universityKw}%`);
  }
  if (effectiveAdmKw) {
    query = query.ilike("admission_type", `%${effectiveAdmKw}%`);
  }

  // If no keywords extracted, fallback to word-based search
  if (!universityKw && !effectiveAdmKw) {
    const words = question.split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return null;
    const orFilters = words.map(w => `university.ilike.%${w}%`).join(",");
    query = supabase.from("admission_plans").select("*").or(orFilters);
  }

  const { data, error } = await query.order("university").limit(50);

  if (error) {
    console.error("admission_plans query error:", error);
    return null;
  }

  // Fallback: admissionKw 조건으로 0건이면 대학명만으로 재검색
  if ((!data || data.length === 0) && effectiveAdmKw && universityKw) {
    console.log(`[admission_plans] 0건 → admissionKw 제거 후 대학명(${universityKw})만으로 재검색`);
    const { data: fallbackData, error: fbErr } = await supabase
      .from("admission_plans")
      .select("*")
      .ilike("university", `%${universityKw}%`)
      .order("university")
      .limit(50);
    if (fbErr) {
      console.error("admission_plans fallback error:", fbErr);
      return null;
    }
    return fallbackData && fallbackData.length > 0 ? fallbackData : null;
  }

  return data && data.length > 0 ? data : null;
}

async function vectorSearchSubjectDescriptions(supabase: any, embedding: number[]) {
  const { data, error } = await supabase.rpc("match_subject_descriptions", {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  if (error) {
    console.error("subject_descriptions vector search error:", error);
    return null;
  }

  return data;
}

async function vectorSearchDocuments(supabase: any, embedding: number[], universityKw?: string) {
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: 0.4,
    match_count: 15,
  });

  if (error) {
    console.error("documents vector search error:", error);
    return null;
  }

  let results = data || [];

  // Log each result's actual university metadata for debugging
  if (results.length > 0) {
    console.log(`[documents] 검색된 문서의 실제 대학명:`);
    results.forEach((d: any, i: number) => {
      console.log(`  [${i}] university="${d.metadata?.university || '(없음)'}", similarity=${d.similarity?.toFixed(3)}, preview="${d.content?.substring(0, 60)}..."`);
    });
  }

  // Post-filter by university metadata — STRICT: no fallback to other universities
  if (universityKw && results.length > 0) {
    const filtered = results.filter((d: any) => {
      const docUni = d.metadata?.university || "";
      return docUni.includes(universityKw);
    });
    console.log(`[documents] university filter "${universityKw}": ${results.length} → ${filtered.length}`);
    // STRICT: if no documents match the university, return null (do NOT use other university's docs)
    results = filtered;
  }

  console.log(`[documents] final results: ${results.length}`);
  return results.length > 0 ? results.slice(0, 8) : null;
}

async function getEmbedding(apiKey: string, text: string): Promise<number[] | null> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: 768,
      }),
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data?.embedding?.values ?? null;
}

// ── Format DB results into context strings ──

function formatSubjectRecommendations(data: any[]): string {
  // Group by university + department
  const grouped: Record<string, { core: string[]; recommended: string[] }> = {};

  for (const row of data) {
    const key = `${row.university}|${row.department}`;
    if (!grouped[key]) grouped[key] = { core: [], recommended: [] };
    if (row.is_core) grouped[key].core.push(row.subject);
    if (row.is_recommended) grouped[key].recommended.push(row.subject);
  }

  const lines: string[] = ["## 조회된 대학별 권장과목 데이터\n"];
  for (const [key, subjects] of Object.entries(grouped)) {
    const [uni, dept] = key.split("|");
    lines.push(`### ${uni} ${dept}`);
    if (subjects.core.length > 0) {
      lines.push(`- **핵심 권장 과목**: ${subjects.core.join(", ")}`);
    }
    if (subjects.recommended.length > 0) {
      lines.push(`- **일반 권장 과목**: ${subjects.recommended.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatAdmissionPlans(data: any[]): string {
  const lines: string[] = ["## 조회된 전형 정보\n"];

  for (const row of data) {
    lines.push(`### ${row.university} — ${row.admission_type} (${row.admission_category})`);
    if (row.selection_method) lines.push(`- **전형 방법**: ${row.selection_method}`);
    if (row.suneung_minimum) {
      lines.push(`- **수능 최저학력기준**: 있음`);
      if (row.suneung_minimum_detail) lines.push(`  - 상세: ${row.suneung_minimum_detail}`);
    } else {
      lines.push(`- **수능 최저학력기준**: 없음`);
    }
    if (row.subject_recommendation_applied) {
      lines.push(`- **교과이수 반영**: 적용`);
      if (row.subject_recommendation_note) lines.push(`  - ${row.subject_recommendation_note}`);
    }
    if (row.reflected_subjects && Object.keys(row.reflected_subjects).length > 0) {
      lines.push(`- **반영 교과**: ${JSON.stringify(row.reflected_subjects)}`);
    }
    if (row.special_notes) lines.push(`- **특이사항**: ${row.special_notes}`);
    lines.push("");
  }

  return lines.join("\n");
}

function formatVectorResults(data: any[], label: string): string {
  if (!data || data.length === 0) return "";
  const lines: string[] = [`## ${label}\n`];
  for (const item of data) {
    lines.push(`[유사도: ${item.similarity?.toFixed(3)}]`);
    lines.push(item.content);
    lines.push("");
  }
  return lines.join("\n");
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the latest user message
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const question = lastUserMsg?.content || "";

    // ── DEBUG MODE: 모든 검색을 무조건 실행하고 결과를 사용자에게 표시 ──
    const { universityKeyword, departmentKeyword, admissionKeyword } = extractKeywords(question);
    const questionType = classifyQuestion(question);
    console.log(`[DEBUG] question="${question}", type="${questionType}", uniKw="${universityKeyword}", deptKw="${departmentKeyword}", admKw="${admissionKeyword}"`);

    // 1) admission_plans SQL
    let admissionPlansCount = 0;
    let admissionPlansError = "없음";
    let admissionPlansData: any[] | null = null;
    try {
      admissionPlansData = await queryAdmissionPlans(supabase, question, universityKeyword, admissionKeyword);
      admissionPlansCount = admissionPlansData?.length ?? 0;
    } catch (e: any) {
      admissionPlansError = e?.message || String(e);
    }

    // 2) documents 벡터 검색
    let documentsCount = 0;
    let documentsError = "없음";
    let documentsData: any[] | null = null;
    let embeddingSuccess = false;
    try {
      const embedding = await getEmbedding(GEMINI_API_KEY, question);
      embeddingSuccess = !!embedding;
      if (embedding) {
        documentsData = await vectorSearchDocuments(supabase, embedding, universityKeyword);
        documentsCount = documentsData?.length ?? 0;
      } else {
        documentsError = "임베딩 생성 실패";
      }
    } catch (e: any) {
      documentsError = e?.message || String(e);
    }

    // 3) university_subjects SQL
    let uniSubjectsCount = 0;
    let uniSubjectsError = "없음";
    let uniSubjectsData: any[] | null = null;
    try {
      uniSubjectsData = await querySubjectRecommendations(supabase, question);
      uniSubjectsCount = uniSubjectsData?.length ?? 0;
    } catch (e: any) {
      uniSubjectsError = e?.message || String(e);
    }

    // 디버그 로그 블록 생성
    const debugLog = `[시스템 디버그 로그]
- 질문: "${question}"
- 키워드 추출: university="${universityKeyword}", department="${departmentKeyword}", admission="${admissionKeyword}"
- 임베딩 생성: ${embeddingSuccess ? "성공" : "실패"}
- admission_plans SQL 결과: ${admissionPlansCount}건 (에러: ${admissionPlansError})
- documents 벡터 검색 결과: ${documentsCount}건 (에러: ${documentsError})${documentsData && documentsData.length > 0 ? `\n  - 상위 문서 유사도 및 대학명: ${documentsData.slice(0, 5).map((d: any) => `[${d.similarity?.toFixed(3)}, uni="${d.metadata?.university || '(없음)'}"]`).join(", ")}` : ""}${documentsData && documentsData.length > 0 ? `\n  - 상위 문서 미리보기: "${documentsData[0]?.content?.substring(0, 100)}..."` : ""}
- university_subjects 결과: ${uniSubjectsCount}건 (에러: ${uniSubjectsError})
`;

    console.log(debugLog);

    // 컨텍스트 블록 조합 (찾은 데이터 모두 포함)
    let contextBlock = debugLog + "\n---\n\n";

    if (documentsData && documentsData.length > 0) {
      contextBlock += `## ⚠️ 아래 문서 데이터가 검색되었습니다. 반드시 이 내용을 기반으로 답변하세요.\n\n`;
      contextBlock += formatVectorResults(documentsData, "관련 문서 (벡터 검색)");
    }

    if (admissionPlansData && admissionPlansData.length > 0) {
      contextBlock += formatAdmissionPlans(admissionPlansData);
    }

    if (uniSubjectsData && uniSubjectsData.length > 0) {
      contextBlock += formatSubjectRecommendations(uniSubjectsData);
    }

    if (documentsCount === 0 && admissionPlansCount === 0 && uniSubjectsCount === 0) {
      if (universityKeyword) {
        contextBlock += `⚠️ "${universityKeyword}" 대학교의 2028학년도 전형 자료(admission_plans, documents, university_subjects)가 모두 등록되어 있지 않습니다.\n`;
        contextBlock += `반드시 "현재 ${universityKeyword}대학교의 2028학년도 전형 자료는 등록되어 있지 않습니다"라고 정직하게 답변하세요. 다른 대학의 데이터를 빌려와서 답변하지 마세요.\n`;
      } else {
        contextBlock += "모든 검색에서 결과가 0건입니다. 데이터가 등록되어 있지 않을 수 있습니다.\n";
      }
    }

    // Build Gemini request
    const geminiContents = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Inject context into last user message
    if (contextBlock && geminiContents.length > 0) {
      const lastIdx = geminiContents.length - 1;
      const originalText = geminiContents[lastIdx].parts[0].text;
      geminiContents[lastIdx].parts[0].text = `${contextBlock}\n\n---\n\n## 사용자 질문\n${originalText}`;
    }

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
            ...messages.map((m: any) => {
              if (m === lastUserMsg && contextBlock) {
                return { role: m.role, content: `${contextBlock}\n\n---\n\n## 사용자 질문\n${m.content}` };
              }
              return m;
            }),
          ],
          stream: true,
        }),
      });

      if (!fallbackResp.ok) {
        const fallbackText = await fallbackResp.text();
        console.error("Lovable AI fallback error:", fallbackResp.status, fallbackText);

        if (fallbackResp.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI 사용 크레딧이 부족합니다." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (fallbackResp.status === 429) {
          return new Response(
            JSON.stringify({ error: "AI 요청이 많아 일시적으로 지연되고 있습니다." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "AI 서비스 호출에 실패했습니다." }),
          { status: fallbackResp.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(fallbackResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

      console.error("Gemini fallback error:", fallback.status);
      return await fallbackToLovableGateway();
    }

    if (!response || !response.ok) {
      const providerErrorText = response ? await response.text() : "No response";
      console.error("Gemini API error:", response?.status, providerErrorText);

      if (response?.status === 429) {
        return await fallbackToLovableGateway();
      }

      return new Response(
        JSON.stringify({ error: "AI 서비스 호출 중 오류가 발생했습니다." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream transform: Gemini SSE → OpenAI-compatible SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        // 디버그 로그를 SSE 스트림 맨 앞에 직접 주입
        const debugChunk = { choices: [{ delta: { content: debugLog + "\n---\n\n" } }] };
        await writer.write(encoder.encode(`data: ${JSON.stringify(debugChunk)}\n\n`));

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
