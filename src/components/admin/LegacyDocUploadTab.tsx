import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, RefreshCw, Filter, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const EMBED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-embed`;
const AUTH_HEADER = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

interface DocRow {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function LegacyDocUploadTab() {
  const [text, setText] = useState("");
  const [school, setSchool] = useState("");
  const [docType, setDocType] = useState("수시");
  const [source, setSource] = useState("");
  const [year, setYear] = useState(2026);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterSchool, setFilterSchool] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subject_descriptions")
      .select("id, subject_name, category, content, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("로드 실패: " + error.message);
    } else {
      let filtered = (data || []) as any[];
      if (filterSchool) filtered = filtered.filter((d) => d.metadata?.school?.includes(filterSchool) || d.subject_name?.includes(filterSchool));
      if (filterType && filterType !== "all") filtered = filtered.filter((d) => d.metadata?.docType === filterType || d.category === filterType);
      if (filterYear) filtered = filtered.filter((d) => String(d.metadata?.year) === filterYear);
      setDocs(filtered);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [filterSchool, filterType, filterYear]);

  const handleUpload = async () => {
    if (!text.trim()) { toast.error("텍스트를 입력해주세요"); return; }
    const chunks = text.split("---CHUNK---").map((c) => c.trim()).filter(Boolean);
    if (chunks.length === 0) { toast.error("청크가 없습니다"); return; }

    setUploading(true);
    setProgress({ current: 0, total: chunks.length });
    const metadata = { school, docType, source, year };
    let success = 0;

    for (let i = 0; i < chunks.length; i++) {
      setProgress({ current: i + 1, total: chunks.length });
      try {
        const embedResp = await fetch(EMBED_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: AUTH_HEADER },
          body: JSON.stringify({ text: chunks[i], taskType: "RETRIEVAL_DOCUMENT" }),
        });
        if (!embedResp.ok) { toast.error(`청크 ${i + 1} 임베딩 실패`); continue; }
        const { embedding } = await embedResp.json();
        const { error } = await supabase.from("subject_descriptions").insert({
          content: chunks[i], 
          metadata: metadata as any, 
          embedding: embedding as any,
          subject_name: school || "",
          category: docType || "",
        } as any);
        if (error) { toast.error(`청크 ${i + 1} 저장 실패`); continue; }
        success++;
      } catch { toast.error(`청크 ${i + 1} 오류`); }
    }

    toast.success(`${success}/${chunks.length} 청크 업로드 완료`);
    setText(""); setUploading(false); setProgress({ current: 0, total: 0 }); fetchDocs();
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("documents").delete().in("id", ids);
    if (error) { toast.error("삭제 실패"); } else {
      toast.success(`${ids.length}개 삭제 완료`);
      setSelectedIds(new Set()); fetchDocs();
    }
  };

  const toggle = (id: number) => {
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
        <p className="text-sm text-destructive font-medium">
          ⚠️ 과목 안내서는 이미 전체 업로드 완료. 중복 업로드 주의
        </p>
      </div>

      {/* Upload section */}
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="마크다운 텍스트를 붙여넣으세요.\n청크 구분: ---CHUNK---" rows={8} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="파일명.pdf" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">연도</label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      {uploading && (
        <div>
          <Progress value={progressPercent} className="h-3 mb-1" />
          <p className="text-xs text-muted-foreground text-center">{progress.current}/{progress.total} 처리 중...</p>
        </div>
      )}

      <Button onClick={handleUpload} disabled={uploading || !text.trim()} className="w-full">
        <Upload className="w-4 h-4 mr-2" />{uploading ? "업로드 중..." : "업로드"}
      </Button>

      {/* Document list */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">저장된 문서 ({docs.length})</h3>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1" />{selectedIds.size}개 삭제
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchDocs}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <Input value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)} placeholder="학교명" className="w-28 h-7 text-xs" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-20 h-7 text-xs"><SelectValue placeholder="전형" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="수시">수시</SelectItem>
              <SelectItem value="정시">정시</SelectItem>
              <SelectItem value="고입">고입</SelectItem>
            </SelectContent>
          </Select>
          <Input value={filterYear} onChange={(e) => setFilterYear(e.target.value)} placeholder="연도" className="w-16 h-7 text-xs" />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">저장된 문서가 없습니다</p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {docs.map((doc) => {
              const meta = doc.metadata as any;
              return (
                <div key={doc.id} onClick={() => toggle(doc.id)}
                  className={`p-2 rounded-lg border cursor-pointer text-xs transition-colors ${selectedIds.has(doc.id) ? "bg-primary/10 border-primary/30" : "hover:bg-muted"}`}>
                  <p className="line-clamp-1">{doc.content.slice(0, 100)}</p>
                  <div className="flex gap-1 mt-1">
                    {meta?.school && <span className="bg-secondary px-1.5 py-0.5 rounded-full text-[10px]">{meta.school}</span>}
                    {meta?.docType && <span className="bg-secondary px-1.5 py-0.5 rounded-full text-[10px]">{meta.docType}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
