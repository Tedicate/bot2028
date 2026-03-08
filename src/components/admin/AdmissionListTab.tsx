import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";

interface DocRow {
  id: number;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

export default function AdmissionListTab() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterUni, setFilterUni] = useState("");
  const [filterDocType, setFilterDocType] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("id, content, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("로드 실패: " + error.message);
      setDocs([]);
    } else {
      let filtered = (data || []) as DocRow[];
      if (filterUni) filtered = filtered.filter((d) => (d.metadata?.university || "").includes(filterUni));
      if (filterDocType && filterDocType !== "all") filtered = filtered.filter((d) => d.metadata?.document_type === filterDocType);
      if (filterYear) filtered = filtered.filter((d) => String(d.metadata?.year) === filterYear);
      setDocs(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [filterUni, filterDocType, filterYear]);

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("documents").delete().in("id", ids);
    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      toast.success(`${ids.length}개 삭제 완료`);
      setSelectedIds(new Set());
      fetchDocs();
    }
  };

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Input value={filterUni} onChange={(e) => setFilterUni(e.target.value)} placeholder="대학명" className="w-32 h-8 text-xs" />
        <Select value={filterDocType} onValueChange={setFilterDocType}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="문서유형" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="계획안">계획안</SelectItem>
            <SelectItem value="요강">요강</SelectItem>
          </SelectContent>
        </Select>
        <Input value={filterYear} onChange={(e) => setFilterYear(e.target.value)} placeholder="연도" className="w-20 h-8 text-xs" />
        <div className="ml-auto flex gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" />{selectedIds.size}개 삭제
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchDocs}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">총 {docs.length}개 청크 저장됨</p>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">로딩 중...</p>
      ) : docs.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">저장된 문서가 없습니다</p>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 w-8"></th>
                <th className="p-2">대학</th>
                <th className="p-2">연도</th>
                <th className="p-2">문서유형</th>
                <th className="p-2">전형</th>
                <th className="p-2">내용유형</th>
                <th className="p-2">업로드일</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const meta = doc.metadata || {};
                return (
                  <tr
                    key={doc.id}
                    onClick={() => toggle(doc.id)}
                    className={`border-b cursor-pointer transition-colors ${selectedIds.has(doc.id) ? "bg-primary/10" : "hover:bg-muted/50"}`}
                  >
                    <td className="p-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedIds.has(doc.id) ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                        {selectedIds.has(doc.id) && (
                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="p-2 font-medium">{meta.university || "-"}</td>
                    <td className="p-2">{meta.year || "-"}</td>
                    <td className="p-2">{meta.document_type || "-"}</td>
                    <td className="p-2">{meta.admission_type || "-"}</td>
                    <td className="p-2">{meta.content_type || "-"}</td>
                    <td className="p-2 text-muted-foreground">{doc.created_at ? new Date(doc.created_at).toLocaleDateString("ko") : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
