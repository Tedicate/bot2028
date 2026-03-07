import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";

const EMBED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-embed`;
const AUTH_HEADER = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

interface DocRow {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function Admin() {
  // Upload state
  const [text, setText] = useState("");
  const [school, setSchool] = useState("");
  const [docType, setDocType] = useState("수시");
  const [source, setSource] = useState("");
  const [year, setYear] = useState(2026);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Document list state
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filter state
  const [filterSchool, setFilterSchool] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const fetchDocs = async () => {
    setLoading(true);
    let query = supabase.from("documents").select("id, content, metadata, created_at").order("created_at", { ascending: false }).limit(200);

    const { data, error } = await query;
    if (error) {
      toast.error("문서 목록 로드 실패: " + error.message);
    } else {
      let filtered = (data || []) as DocRow[];
      if (filterSchool) {
        filtered = filtered.filter((d) => (d.metadata as any)?.school?.includes(filterSchool));
      }
      if (filterType) {
        filtered = filtered.filter((d) => (d.metadata as any)?.docType === filterType);
      }
      if (filterYear) {
        filtered = filtered.filter((d) => String((d.metadata as any)?.year) === filterYear);
      }
      setDocs(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [filterSchool, filterType, filterYear]);

  const handleUpload = async () => {
    if (!text.trim()) {
      toast.error("텍스트를 입력해주세요");
      return;
    }

    const chunks = text.split("---CHUNK---").map((c) => c.trim()).filter(Boolean);
    if (chunks.length === 0) {
      toast.error("청크가 없습니다");
      return;
    }

    setUploading(true);
    setProgress({ current: 0, total: chunks.length });

    const metadata = {
      school,
      docType,
      source,
      year,
    };

    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      setProgress({ current: i + 1, total: chunks.length });

      try {
        // Get embedding
        const embedResp = await fetch(EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
          body: JSON.stringify({ text: chunks[i], taskType: "RETRIEVAL_DOCUMENT" }),
        });

        if (!embedResp.ok) {
          const err = await embedResp.json().catch(() => ({}));
          console.error(`Chunk ${i + 1} embedding failed:`, err);
          toast.error(`청크 ${i + 1} 임베딩 실패`);
          continue;
        }

        const { embedding } = await embedResp.json();

        // Insert into documents table
        const { error: insertError } = await supabase.from("documents").insert({
          content: chunks[i],
          metadata,
          embedding: embedding as any,
        } as any);

        if (insertError) {
          console.error(`Chunk ${i + 1} insert failed:`, insertError);
          toast.error(`청크 ${i + 1} 저장 실패`);
          continue;
        }

        successCount++;
      } catch (e) {
        console.error(`Chunk ${i + 1} error:`, e);
        toast.error(`청크 ${i + 1} 처리 중 오류`);
      }
    }

    toast.success(`${successCount}/${chunks.length} 청크 업로드 완료`);
    setText("");
    setUploading(false);
    setProgress({ current: 0, total: 0 });
    fetchDocs();
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("documents").delete().in("id", ids);

    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      toast.success(`${ids.length}개 문서 삭제 완료`);
      setSelectedIds(new Set());
      fetchDocs();
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">📄 문서 관리자</h1>

      {/* Upload Section */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">문서 업로드</h2>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"마크다운 텍스트를 붙여넣으세요.\n청크 구분: ---CHUNK---"}
          rows={10}
          className="mb-4"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">학교명</label>
            <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="한양대" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">전형유형</label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="수시">수시</SelectItem>
                <SelectItem value="정시">정시</SelectItem>
                <SelectItem value="고입">고입</SelectItem>
                <SelectItem value="기타">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">문서출처</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="2026_한양대_수시모집요강.pdf" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">연도</label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        </div>

        {uploading && (
          <div className="mb-4">
            <Progress value={progressPercent} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              {progress.current}/{progress.total} 청크 처리 중...
            </p>
          </div>
        )}

        <Button onClick={handleUpload} disabled={uploading || !text.trim()} className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? "업로드 중..." : "업로드"}
        </Button>
      </section>

      {/* Document List Section */}
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">저장된 문서 ({docs.length})</h2>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1" />
                {selectedIds.size}개 삭제
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchDocs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">필터:</span>
          </div>
          <Input
            value={filterSchool}
            onChange={(e) => setFilterSchool(e.target.value)}
            placeholder="학교명"
            className="w-32 h-8 text-xs"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue placeholder="전형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="수시">수시</SelectItem>
              <SelectItem value="정시">정시</SelectItem>
              <SelectItem value="고입">고입</SelectItem>
              <SelectItem value="기타">기타</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            placeholder="연도"
            className="w-20 h-8 text-xs"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">저장된 문서가 없습니다</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {docs.map((doc) => {
              const meta = doc.metadata as any;
              return (
                <div
                  key={doc.id}
                  onClick={() => toggleSelect(doc.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedIds.has(doc.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">{doc.content.slice(0, 150)}...</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {meta?.school && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{meta.school}</span>}
                        {meta?.docType && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{meta.docType}</span>}
                        {meta?.year && <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{meta.year}</span>}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-1 ${
                      selectedIds.has(doc.id) ? "bg-primary border-primary" : "border-muted-foreground/30"
                    }`}>
                      {selectedIds.has(doc.id) && (
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
