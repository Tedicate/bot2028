import { useState, useRef, useEffect, useMemo } from "react";
import { Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

type Msg = { role: "user" | "assistant"; content: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTH_HEADER = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
const ADVISOR_URL = `${SUPABASE_URL}/functions/v1/course-advisor`;

function shuffleAndPick<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function useRotatingSuggestions<T>(pool: T[], count: number, intervalMs: number): T[] {
  const [items, setItems] = useState<T[]>(() => shuffleAndPick(pool, count));
  useEffect(() => {
    if (pool.length === 0) return;
    setItems(shuffleAndPick(pool, count));
    const timer = setInterval(() => {
      setItems(shuffleAndPick(pool, count));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [pool, count, intervalMs]);
  return items;
}

// ── Shared utilities ──
const SUGGEST_RE = /<!--SUGGEST:(.+?)-->/g;

function stripHtmlAndMarkers(content: string): string {
  return content
    .replace(SUGGEST_RE, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, "")
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

// ── Dynamic suggestion data ──
interface SuggestionData {
  deptPool: string[];
  admissionPool: string[];
  subjectPool: string[];
  loading: boolean;
}

function useSuggestionData(): SuggestionData {
  const [deptPool, setDeptPool] = useState<string[]>([]);
  const [admissionPool, setAdmissionPool] = useState<string[]>([]);
  const [subjectPool, setSubjectPool] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      // Fetch all 3 sources in parallel
      const [deptResult, admResult, subResult] = await Promise.all([
        supabase.from("university_subjects").select("university, department").limit(500),
        supabase.from("admission_plans").select("university"),
        supabase.from("subject_descriptions").select("subject_name"),
      ]);

      if (cancelled) return;

      // 1) [인기 학과] - university_subjects
      if (deptResult.error) {
        console.error("[Suggestions] university_subjects 쿼리 에러:", deptResult.error);
      } else if (deptResult.data && deptResult.data.length > 0) {
        const uniquePairs = new Set<string>();
        const suggestions: string[] = [];
        for (const row of deptResult.data) {
          const key = `${row.university}|${row.department}`;
          if (!uniquePairs.has(key)) {
            uniquePairs.add(key);
            const shortUni = row.university.replace(/대학교$/, "대");
            suggestions.push(`${shortUni} ${row.department}`);
          }
        }
        const shuffled = [...suggestions].sort(() => Math.random() - 0.5).slice(0, 20);
        setDeptPool(shuffled);
        console.log(`[Suggestions] 인기 학과 풀: ${shuffled.length}개 (전체 ${suggestions.length}개 중)`);
      } else {
        console.warn("[Suggestions] university_subjects 데이터 0건");
      }

      // 2) [대학별 전형] - admission_plans (실제 데이터 있는 대학만)
      if (admResult.error) {
        console.error("[Suggestions] admission_plans 쿼리 에러:", admResult.error);
      } else if (admResult.data && admResult.data.length > 0) {
        const unis = [...new Set(admResult.data.map((r) => r.university))];
        const suggestions = unis.map((uni) => {
          const shortUni = uni.replace(/대학교$/, "대");
          return `2028 ${shortUni}`;
        });
        setAdmissionPool(suggestions);
        console.log(`[Suggestions] 대학별 전형 풀: ${suggestions.length}개 — ${suggestions.join(", ")}`);
      } else {
        console.warn("[Suggestions] admission_plans 데이터 0건");
      }

      // 3) [과목 안내] - subject_descriptions
      if (subResult.error) {
        console.error("[Suggestions] subject_descriptions 쿼리 에러:", subResult.error);
      } else if (subResult.data && subResult.data.length > 0) {
        const subjects = [...new Set(subResult.data.map((r) => r.subject_name))].filter(Boolean);
        const shuffled = [...subjects].sort(() => Math.random() - 0.5).slice(0, 15);
        setSubjectPool(shuffled);
        console.log(`[Suggestions] 과목 안내 풀: ${shuffled.length}개 (전체 ${subjects.length}개 중)`);
      } else {
        console.warn("[Suggestions] subject_descriptions 데이터 0건");
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { deptPool, admissionPool, subjectPool, loading };
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { deptPool, admissionPool, subjectPool, loading: suggestionsLoading } = useSuggestionData();

  const goHome = () => {
    setMessages([]);
    setInput("");
    navigate("/");
  };
  const deptSuggestions = useRotatingSuggestions(deptPool, Math.min(6, Math.max(1, deptPool.length)), 3000);
  const subjectSuggestions = useRotatingSuggestions(subjectPool, Math.min(5, Math.max(1, subjectPool.length)), 3000);
  const admissionSuggestions = useRotatingSuggestions(admissionPool, Math.min(3, Math.max(1, admissionPool.length)), 3000);

  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch(ADVISOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "오류가 발생했습니다." }));
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${err.error || "오류가 발생했습니다."}` }]);
        setIsLoading(false);
        return;
      }

      // SSE streaming
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let assistantAdded = false;

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
          if (jsonStr === "[DONE]") break;
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              if (!assistantAdded) {
                assistantAdded = true;
                setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                  return updated;
                });
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      if (!assistantAdded) {
        setMessages((prev) => [...prev, { role: "assistant", content: "답변을 생성할 수 없습니다." }]);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ 네트워크 오류가 발생했습니다. 다시 시도해주세요." }]);
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

    const cleaned = stripHtmlAndMarkers(content);
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
        <div className="chat-markdown">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="text-base font-bold text-foreground mt-5 mb-2 flex items-center gap-1">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-bold text-foreground mt-4 mb-1.5">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="text-sm leading-relaxed text-chat-bot-foreground my-2">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-primary">{children}</strong>
              ),
              ul: ({ children }) => (
                <ul className="space-y-2.5 my-3 list-none pl-0">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="text-sm leading-relaxed text-chat-bot-foreground pl-1 border-l-2 border-primary/20 ml-1 py-0.5 [&>p]:my-0.5">{children}</li>
              ),
              hr: () => <hr className="my-4 border-border" />,
              a: ({ href, children }) => (
                <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">{children}</a>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-xs border-collapse rounded-lg overflow-hidden border border-border">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-primary/8">{children}</thead>,
              th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-primary text-xs">{children}</th>,
              td: ({ children }) => <td className="px-3 py-1.5 border-t border-border text-xs">{children}</td>,
            }}
          >
            {cleaned}
          </ReactMarkdown>
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
        <button
          onClick={goHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img src={logo} alt="교육을 비추다" className="w-10 h-10 rounded-2xl object-contain" />
          <div className="text-left">
            <h1 className="text-lg font-bold text-foreground">2028 교빛 봇</h1>
            <p className="text-xs text-muted-foreground">전공연계 과목 추천 · 과목 안내</p>
          </div>
        </button>
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

              <div className="w-full max-w-2xl grid grid-cols-3 gap-3 text-center">
                {/* Headers */}
                <p className="text-xs font-semibold text-muted-foreground px-1">🎓 인기 학과</p>
                <p className="text-xs font-semibold text-muted-foreground px-1">📚 과목 안내</p>
                <p className="text-xs font-semibold text-muted-foreground px-1">📋 대학별 전형</p>

                {suggestionsLoading ? (
                  <>
                    {/* Skeleton columns */}
                    {[6, 5, 3].map((count, colIdx) => (
                      <div key={colIdx} className="flex flex-col gap-2">
                        {Array.from({ length: count }).map((_, i) => (
                          <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />
                        ))}
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {/* Column: 인기 학과 */}
                    <div className="flex flex-col gap-2">
                      <AnimatePresence mode="popLayout">
                        {deptSuggestions.map((s) => {
                          const parts = s.match(/^(.+?)\s+(.+)$/);
                          return (
                            <motion.button
                              key={s}
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.35, ease: "easeOut" }}
                              onClick={() => send(s)}
                              className="px-3 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors leading-tight"
                            >
                              {parts ? (<>{parts[1]}<br />{parts[2]}</>) : s}
                            </motion.button>
                          );
                        })}
                      </AnimatePresence>
                    </div>

                    {/* Column: 과목 안내 */}
                    <div className="flex flex-col gap-2">
                      <AnimatePresence mode="popLayout">
                        {subjectSuggestions.map((s: string) => (
                          <motion.button
                            key={s}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            onClick={() => send(s)}
                            className="px-3 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {s}
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Column: 대학별 전형 */}
                    <div className="flex flex-col gap-2">
                      <AnimatePresence mode="popLayout">
                        {admissionSuggestions.map((s) => (
                          <motion.button
                            key={s}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            onClick={() => send(s)}
                            className="px-3 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {s}
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                )}
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
                  <div className="flex justify-end gap-2 mt-2">
                    <a
                      href="https://www.kyobit.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-full text-[11px] text-muted-foreground bg-background border border-border shadow-sm hover:text-foreground hover:border-border/80 transition-colors"
                    >
                      교육을 비추다
                    </a>
                    <button
                      onClick={goHome}
                      className="px-3 py-1 rounded-full text-[11px] text-muted-foreground bg-background border border-border shadow-sm hover:text-foreground hover:border-border/80 transition-colors"
                    >
                      메인으로
                    </button>
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
            className="w-8 h-8 min-w-[2rem] min-h-[2rem] rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 transition-opacity hover:opacity-90"
          >
            <Send className="w-4 h-4 shrink-0" />
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
  const afterText = stripHtmlAndMarkers(afterLines.join("\n"));

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
        <div className="chat-markdown">
          <ReactMarkdown>{stripHtmlAndMarkers(beforeLines.join("\n"))}</ReactMarkdown>
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
        <div className="chat-markdown mt-3">
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
      <div className="chat-markdown">
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
