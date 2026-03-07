import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `너는 대한민국 입시 전문 상담사야. 제공된 자료만을 근거로 정확하게 답변해.
자료에 없는 내용은 '해당 정보가 자료에 없습니다'라고 답해.
숫자(모집인원, 배점 등)는 반드시 자료 그대로 인용해.

## 학과 검색 시 답변 형식 (반드시 지켜)
사용자가 특정 대학 학과를 검색하면:
1. 해당 학과의 권장 과목(핵심 권장과목, 일반 권장과목) 목록을 보여줘.
2. **각 과목명 옆에 해당 과목이 어떤 과목인지 1~2문장으로 간략히 설명해.**
   예시:
   - **미적분II** — 다변수 함수의 미분과 적분을 다루는 심화 수학 과목
   - **역학과 에너지** — 뉴턴 역학, 에너지 보존 법칙 등을 학습하는 물리 과목
3. 과목 설명은 자료에 있는 내용을 기반으로 하되, 과목명으로부터 추론 가능한 일반적 설명도 허용해.
4. **유사 학과를 언급할 때는 반드시 "대학명 + 학과명"을 함께 표기해.** 예: "경희대 간호학과", "중앙대 약학부". 학과명만 단독으로 쓰지 마.

## 위계 과목(선수 과목) 안내 규칙
- 권장 과목 중 **선수 과목(위계 과목)**이 필요한 과목이 있으면 반드시 언급해.
- 위계 관계 예시:
  - **대수** ← 공통수학1, 공통수학2 선이수 필요
  - **미적분II** ← 미적분I 선이수 필요
  - **역학과 에너지** ← 물리학 선이수 필요
  - **물질과 에너지** ← 화학 선이수 필요
  - **화학반응의 세계** ← 화학 선이수 필요
  - **생명과학과 지구시스템** ← 생명과학 선이수 필요
  - **생명과학실험** ← 생명과학 선이수 필요
  - **지구과학실험** ← 지구과학 선이수 필요
  - **확률과 통계** ← 공통수학1, 공통수학2 선이수 필요
- 위 목록에 해당하는 과목이 권장과목에 포함되어 있으면, 과목 설명 뒤에 "⚠️ 선이수 과목: OOO" 형태로 표기해.
- 자료에 위계 정보가 있으면 그것을 우선 사용해.

## 후속 질문 버튼 규칙 (매우 중요)
- 답변 마지막에 반드시 <!--SUGGEST:텍스트--> 형태로 후속 질문 버튼을 3~6개 추가해.
- 버튼에는 **반드시 자료(DB)에 실제로 존재하는** 과목명이나 "대학명 학과명" 조합만 사용해.
- 존재하지 않는 과목이나 학과를 절대 만들어내지 마.
- **학과 버튼은 반드시 "대학명 학과명" 형태로 써.** 예: <!--SUGGEST:경희대 의예과-->. 학과명만 단독으로 쓰지 마.
- 버튼 종류:
  - 답변에 등장한 과목명 (예: <!--SUGGEST:미적분II-->)
  - 같은 대학의 유사 학과 (예: <!--SUGGEST:경희대 의예과-->)
  - 같은 학과를 가진 다른 대학 (예: <!--SUGGEST:중앙대 간호학과-->)
- 이 버튼들은 사용자가 "꼬리에 꼬리를 무는" 탐색을 할 수 있도록 유도하는 역할이야.

## 가독성 규칙 (반드시 지켜)
- 한 단락은 최대 3~4줄. 그 이상이면 빈 줄로 나눠.
- 섹션 사이에는 반드시 빈 줄 하나를 넣어.
- 목록(bullet)은 항목마다 빈 줄 없이 쓰되, 목록 전후로는 빈 줄을 넣어.
- 각 과목 설명 항목 사이에 충분한 간격을 두어 모바일에서도 읽기 편하게 해.
- 핵심 정보(과목명, 조건, 수치)는 **굵게** 표시.
- HTML 태그는 절대 사용하지 마. 순수 마크다운만 사용해.`;

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
