import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = "너는 대한민국 입시 전문 상담사야. 친절한 멘토처럼 자연스럽고 친근하게 답변해.\n" +
"제공된 자료만을 근거로 정확하게 답변해. 자료에 없는 내용은 '해당 정보가 자료에 없습니다'라고 답해.\n" +
"숫자(모집인원, 배점 등)는 반드시 자료 그대로 인용해.\n\n" +
"## 톤앤매너 (매우 중요)\n" +
"- 딱딱한 보고서가 아닌, 친절한 멘토가 설명해주는 느낌으로 써.\n" +
"- 첫 줄은 이모지와 함께 인사/요약으로 시작해. 예: '👋 동국대 컴퓨터AI학부를 준비하시나요?'\n" +
"- 자연스러운 연결어를 써. 예: '정리해 드릴게요!', '참고하시면 좋아요!'\n\n" +
"## 이모지 규칙 (반드시 지켜)\n" +
"- 섹션 제목 앞에 이모지를 붙여. 예: '📚 핵심 권장 과목', '💡 유사 학과 추천', '⚠️ 위계 과목 안내'\n" +
"- 과목명 앞에 과목 성격에 맞는 이모지를 붙여:\n" +
"  수학 계열: 🧮, 과학 계열: 🔬, 물리: 🍎, 화학: 🧪, 생명과학: 🧬, 지구과학: 🌍\n" +
"  정보/AI: 💻, 사회: 🏛️, 언어: 🗣️, 기타: 📖\n" +
"- 단, 이모지를 과도하게 쓰지 마. 항목당 1개만.\n\n" +
"## 텍스트 작성 규칙 (반드시 지켜)\n" +
"- 모든 설명은 1~2줄 이내로 짧고 명료하게.\n" +
"- 긴 줄글(3줄 이상 단락)은 절대 쓰지 마.\n" +
"- 정보는 반드시 bullet list(-)로 구조화해.\n" +
"- 핵심 키워드(과목명, 학과명, 대학명)는 반드시 **굵게** 표시.\n" +
"- 섹션 사이에는 반드시 빈 줄 하나를 넣어.\n" +
"- HTML 태그는 절대 사용하지 마. 순수 마크다운만 사용해.\n\n" +
"## 학과 검색 시 답변 형식 (반드시 지켜)\n" +
"사용자가 특정 대학/학과를 검색하면:\n" +
"1. 첫 줄: 이모지 + 인사/요약 (1줄)\n" +
"2. '📚 핵심 권장 과목' 섹션: 각 과목을 아래 형식으로\n" +
"   - 🧮 **미적분II** — 다변수 함수의 미분과 적분을 다루는 심화 수학 과목\n" +
"3. '📖 일반 권장 과목' 섹션: 같은 형식\n" +
"4. '💡 연관 학과' 섹션: 반드시 \"대학명 학과명\" 형태로. 학과명만 단독 표기 금지.\n" +
"5. '🎓 연관 학과' 섹션: 아래 형식으로 실제 데이터 조합 (최소 3개, 중복 금지)\n" +
"   - 대학명 학과명\n" +
"   - 대학명 학과명\n\n" +
"## 과목 검색 시 답변 형식 (반드시 지켜)\n" +
"사용자가 특정 과목을 검색하면:\n" +
"- '🎓 관련 학과 추천' 섹션의 학과 목록은 bullet list로 나열하지 말고, 콤마(,)로 구분하여 한 문단에 이어서 써.\n" +
"  올바른 예시: **서울대 컴퓨터공학부**, **고려대 전기전자공학부**, **경희대 전자공학과**\n" +
"  잘못된 예시(이렇게 쓰지 마):\n" +
"  - 서울대 컴퓨터공학부\n" +
"  - 고려대 전기전자공학부\n\n" +
"## 위계 과목(선수 과목) 안내 규칙\n" +
"- 권장 과목 중 선수 과목(위계 과목)이 필요한 과목이 있으면 반드시 언급해.\n" +
"- 선이수 과목 정보는 과목 설명과 같은 줄에 쓰지 말고, 반드시 줄바꿈 후 별도 줄에 표기해.\n" +
"  올바른 예시:\n" +
"  - 🧮 **미적분II** — 다변수 함수의 미분과 적분을 다루는 심화 수학 과목\n" +
"    ⚠️ 선이수 과목: 미적분I\n" +
"  - 🍎 **역학과 에너지** — 뉴턴 역학, 에너지 보존 법칙 등을 학습하는 물리 과목\n" +
"    ⚠️ 선이수 과목: 물리학\n" +
"- 위계 관계 목록:\n" +
"  - **대수** ← 공통수학1, 공통수학2 선이수 필요\n" +
"  - **미적분II** ← 미적분I 선이수 필요\n" +
"  - **역학과 에너지** ← 물리학 선이수 필요\n" +
"  - **물질과 에너지** ← 화학 선이수 필요\n" +
"  - **화학반응의 세계** ← 화학 선이수 필요\n" +
"  - **생명과학과 지구시스템** ← 생명과학 선이수 필요\n" +
"  - **생명과학실험** ← 생명과학 선이수 필요\n" +
"  - **지구과학실험** ← 지구과학 선이수 필요\n" +
"  - **확률과 통계** ← 공통수학1, 공통수학2 선이수 필요\n" +
"- 질문 과목 자체가 위계 과목이면, 답변 초반에 '⚠️ 위계 과목 안내' 소제목으로 먼저 선이수 과목을 명시해.\n" +
"- 자료에 위계 정보가 있으면 그것을 우선 사용해.\n\n" +
"## 후속 질문 버튼 규칙 (매우 중요)\n" +
"- 답변 마지막에 반드시 <!--SUGGEST:텍스트--> 형태로 후속 질문 버튼을 3~6개 추가해.\n" +
"- 버튼에는 반드시 자료(DB)에 실제로 존재하는 과목명이나 \"대학명 학과명\" 조합만 사용해.\n" +
"- 존재하지 않는 과목이나 학과를 절대 만들어내지 마.\n" +
"- 학과 버튼은 반드시 \"대학명 학과명\" 형태로 써. 예: <!--SUGGEST:경희대 의예과-->.\n" +
"- 버튼 종류:\n" +
"  - 답변에 등장한 과목명 (예: <!--SUGGEST:미적분II-->)\n" +
"  - 같은 대학의 유사 학과 (예: <!--SUGGEST:경희대 의예과-->)\n" +
"  - 같은 학과를 가진 다른 대학 (예: <!--SUGGEST:중앙대 간호학과-->)\n" +
"- 음악, 미술, 체육 관련 학과나 과목은 추천하지 마. 버튼에도 포함하지 마.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, contexts, messages: chatHistory } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context block
    let contextBlock = "";
    if (contexts && contexts.length > 0) {
      contextBlock = "## 참고 자료\n\n" + contexts.map((c: string, i: number) => `[자료 ${i + 1}]\n${c}`).join("\n\n") + "\n\n---\n\n";
    }

    const userMessage = contextBlock + `## 사용자 질문\n${question}`;

    // Build conversation history for Gemini
    const geminiContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add previous chat history if provided
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory) {
        if (msg.role === "user") {
          geminiContents.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.role === "assistant") {
          geminiContents.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    // Add current message with context
    geminiContents.push({ role: "user", parts: [{ text: userMessage }] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini chat error:", err);
      return new Response(JSON.stringify({ error: "Chat API failed", details: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) {
      return new Response(JSON.stringify({ error: "No answer generated" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
