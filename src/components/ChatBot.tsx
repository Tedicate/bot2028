import { useState, useRef, useEffect, useMemo } from "react";
import { Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import logo from "@/assets/logo.png";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/course-advisor`;

const ALL_DEPT_SUGGESTIONS = [
  "서울대 컴퓨터공학부", "연세대 경영학과", "고려대 전기전자공학부",
  "성균관대 의예과", "한양대 기계공학부", "경희대 간호학과",
  "서울시립대 도시공학과", "중앙대 약학부", "이화여대 국어국문학과",
  "서강대 경제학부", "숙명여대 미디어학부", "건국대 동물자원과학과",
  "동국대 영화영상학과", "한국외대 통번역학과", "홍익대 미술학부",
  "서울대 법학부", "연세대 심리학과", "고려대 국어국문학과",
  "한양대 건축학부", "경희대 호텔관광학부", "중앙대 문예창작학과",
  "서울시립대 환경공학부", "숭실대 AI융합학부", "세종대 호텔관광경영학부",
  "부산대 조경학과", "경북대 농업생명과학대학", "전남대 수의예과",
];

const ALL_SUBJECT_SUGGESTIONS = [
  "미적분II", "기하", "역학과 에너지", "물질과 에너지",
  "정보", "인공지능 기초", "데이터 과학", "생명과학과 지구시스템",
  "세계시민과 지리", "사회문화", "생활과 윤리", "정치와 법",
  "심리학", "교육학", "보건", "음악", "미술", "체육",
  "중국어", "일본어", "프랑스어", "확률과 통계",
  "화학반응의 세계", "생명과학실험", "지구과학실험",
  "국어", "영어", "한국사",
];

function shuffleAndPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Shared utilities ──
const SUGGEST_RE = /<!--SUGGEST:(.+?)-->/g;

function stripSuggestMarkers(content: string): string {
  return content
    .replace(SUGGEST_RE, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trimEnd();
}

function parseSuggestions(content: string): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SUGGEST_RE.source, "g");
  while ((m = re.exec(content)) !== null) results.push(m[1]);
  return results;
}

// Detects checkbox lines: "- [ ] text" or "[ ] text" (with optional leading whitespace)
const CHECKBOX_LINE_RE = /^\s*-?\s*\[[ ]\]\s+(.+)$/;

function hasCheckboxLines(content: string): boolean {
  return content.split("\n").some((line) => CHECKBOX_LINE_RE.test(line));
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Randomize suggestions once per mount
  const deptSuggestions = useMemo(() => shuffleAndPick(ALL_DEPT_SUGGESTIONS, 8), []);
  const subjectSuggestions = useMemo(() => shuffleAndPick(ALL_SUBJECT_SUGGESTIONS, 8), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "오류가 발생했습니다." }));
        upsertAssistant(`⚠️ ${err.error || "오류가 발생했습니다."}`);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error(e);
      upsertAssistant("⚠️ 네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    }

    setIsLoading(false);
  };

  const renderSuggestionButtons = (content: string) => {
    const suggestions = parseSuggestions(content);
    if (suggestions.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    );
  };

  const renderAssistantContent = (content: string, _msgIndex: number) => {
    if (hasCheckboxLines(content)) {
      return (
        <CheckboxMessage
          content={content}
          onSubmit={(selected) => {
            const selectedText = selected.join(", ");
            send(`다음 학과들의 상세 정보를 보여주세요: ${selectedText}`);
          }}
          renderSuggestions={() => renderSuggestionButtons(content)}
        />
      );
    }

    const cleaned = stripSuggestMarkers(content);
    const pages = cleaned.split("<!--PAGE_BREAK-->");
    if (pages.length > 1) {
      return (
        <>
          <PaginatedMessage pages={pages} />
          {renderSuggestionButtons(content)}
        </>
      );
    }

    return (
      <>
        <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-td:text-foreground prose-th:text-foreground prose-a:text-primary">
          <ReactMarkdown>{cleaned}</ReactMarkdown>
        </div>
        {renderSuggestionButtons(content)}
      </>
    );
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-background">
      {/* Header */}
      <header className="flex-shrink-0 px-5 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={logo} alt="교육을 비추다" className="w-10 h-10 rounded-2xl object-contain" />
          <div>
            <h1 className="text-lg font-bold text-foreground">2028 교빛 봇</h1>
            <p className="text-xs text-muted-foreground">전공연계 과목 추천 · 과목 안내</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        <AnimatePresence initial={false}>
          {showWelcome && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center pt-8 pb-6"
            >
              <img src={logo} alt="교육을 비추다" className="w-20 h-20 rounded-3xl object-contain mb-5" />
              <h2 className="text-xl font-bold text-foreground mb-2">무엇이 궁금하신가요?</h2>
              <p className="text-sm text-muted-foreground text-center mb-3 max-w-sm leading-relaxed">
                <strong className="text-foreground">관심 학과</strong>를 입력하면 대학별 권장 이수 과목을,<br />
                <strong className="text-foreground">과목명</strong>을 입력하면 과목 설명을 알려드려요.
              </p>
              <p className="text-xs text-muted-foreground mb-5">
                예: "서울대 컴퓨터공학부" 또는 "미적분II"
              </p>

              <div className="w-full max-w-md mb-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">🎓 인기 학과</p>
                <div className="flex flex-wrap gap-2">
                  {deptSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-md">
                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">📚 주요 과목</p>
                <div className="flex flex-wrap gap-2">
                  {subjectSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "user" ? (
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-chat-user text-chat-user-foreground text-sm leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%] w-full px-4 py-3 rounded-2xl rounded-bl-md bg-chat-bot text-chat-bot-foreground text-sm leading-relaxed">
                  {renderAssistantContent(msg.content, i)}
                  <div className="flex justify-end mt-2">
                    <a
                      href="https://www.kyobit.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-full text-[11px] text-muted-foreground/60 border border-border/40 hover:text-muted-foreground hover:border-border transition-colors"
                    >
                      교육을 비추다
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-chat-bot">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border px-5 py-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-3 bg-secondary rounded-2xl px-4 py-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="학과명 또는 과목명을 입력하세요"
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 transition-opacity hover:opacity-90"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          2028학년도 대입 기준 · 대학별 시행계획에 따라 변동될 수 있습니다
        </p>
      </div>
    </div>
  );
}

/* ── Checkbox Message Component ── */
function CheckboxMessage({
  content,
  onSubmit,
  renderSuggestions,
}: {
  content: string;
  onSubmit: (selected: string[]) => void;
  renderSuggestions: () => React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const lines = content.split("\n");
  const beforeLines: string[] = [];
  const checkboxItems: string[] = [];
  const afterLines: string[] = [];
  let phase: "before" | "checkbox" | "after" = "before";

  for (const line of lines) {
    const match = line.match(/^\s*-?\s*\[[ ]\]\s+(.+)$/);
    if (match) {
      phase = "checkbox";
      checkboxItems.push(match[1]);
    } else if (phase === "checkbox" && line.trim() === "") {
      // still in checkbox area
    } else if (phase === "checkbox") {
      phase = "after";
      afterLines.push(line);
    } else if (phase === "after") {
      afterLines.push(line);
    } else {
      beforeLines.push(line);
    }
  }

  // Strip SUGGEST markers from after-lines text
  const afterText = stripSuggestMarkers(afterLines.join("\n"));

  const toggle = (item: string) => {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    setSubmitted(true);
    onSubmit(Array.from(selected));
  };

  return (
    <div>
      {beforeLines.length > 0 && (
        <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground mb-3">
          <ReactMarkdown>{stripSuggestMarkers(beforeLines.join("\n"))}</ReactMarkdown>
        </div>
      )}
      <div className="space-y-2 my-3">
        {checkboxItems.map((item) => (
          <label
            key={item}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
              selected.has(item)
                ? "bg-primary/10 border-primary/30 text-foreground"
                : "bg-background border-border hover:bg-muted"
            } ${submitted ? "opacity-70 cursor-default" : ""}`}
            onClick={() => toggle(item)}
          >
            <div
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                selected.has(item) ? "bg-primary border-primary" : "border-muted-foreground/30"
              }`}
            >
              {selected.has(item) && (
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium">{item}</span>
          </label>
        ))}
      </div>
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={selected.size === 0}
          className="mt-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-30 transition-opacity hover:opacity-90"
        >
          선택한 학과 정보 보기 ({selected.size}개)
        </button>
      )}
      {afterText.trim() && (
        <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground mt-3">
          <ReactMarkdown>{afterText}</ReactMarkdown>
        </div>
      )}
      {renderSuggestions()}
    </div>
  );
}

/* ── Paginated Message Component ── */
function PaginatedMessage({ pages }: { pages: string[] }) {
  const [currentPage, setCurrentPage] = useState(0);
  const filteredPages = pages.filter((p) => p.trim());

  return (
    <div>
      <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-td:text-foreground prose-th:text-foreground prose-a:text-primary">
        <ReactMarkdown>{filteredPages[currentPage]}</ReactMarkdown>
      </div>
      {filteredPages.length > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground disabled:opacity-30 hover:bg-muted transition-colors"
          >
            ← 이전
          </button>
          <span className="text-xs text-muted-foreground">
            {currentPage + 1} / {filteredPages.length}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(filteredPages.length - 1, p + 1))}
            disabled={currentPage === filteredPages.length - 1}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
