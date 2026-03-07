import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `너는 대한민국 입시 전문 상담사야. 제공된 자료만을 근거로 정확하게 답변해.
자료에 없는 내용은 '해당 정보가 자료에 없습니다'라고 답해.
숫자(모집인원, 배점 등)는 반드시 자료 그대로 인용해.

## 가독성 규칙 (반드시 지켜)
- 한 단락은 최대 3~4줄. 그 이상이면 빈 줄로 나눠.
- 섹션 사이에는 반드시 빈 줄 하나를 넣어.
- 목록(bullet)은 항목마다 빈 줄 없이 쓰되, 목록 전후로는 빈 줄을 넣어.
- 핵심 정보(과목명, 조건, 수치)는 **굵게** 표시.
- HTML 태그는 절대 사용하지 마. 순수 마크다운만 사용해.
- <!--SUGGEST:텍스트--> 형태로 후속 질문 버튼을 추가할 수 있어.`;

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
