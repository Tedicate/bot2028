import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SummaryRow {
  university: string;
  year: number;
  document_type: string;
  count: number;
}

export default function AdmissionSummaryTab() {
  const [data, setData] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    const { data: raw, error } = await supabase
      .from("documents")
      .select("metadata, created_at")
      .limit(1000);

    if (error) {
      toast.error("로드 실패");
      setLoading(false);
      return;
    }

    // Aggregate counts from metadata
    const map = new Map<string, SummaryRow>();
    (raw || []).forEach((r: any) => {
      const meta = r.metadata || {};
      const uni = meta.university || "미지정";
      const yr = meta.year || 0;
      const dt = meta.document_type || "미지정";
      const key = `${uni}|${yr}|${dt}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { university: uni, year: yr, document_type: dt, count: 1 });
      }
    });

    setData(Array.from(map.values()));
    setLoading(false);
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Build pivot: university -> { `${year}_${docType}` -> count }
  const universities = [...new Set(data.map((d) => d.university))].sort();
  const yearDocTypes = [...new Set(data.map((d) => `${d.year}_${d.document_type}`))].sort();

  const pivot = new Map<string, Map<string, number>>();
  data.forEach((d) => {
    if (!pivot.has(d.university)) pivot.set(d.university, new Map());
    pivot.get(d.university)!.set(`${d.year}_${d.document_type}`, d.count);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">대학별 전형 문서 보유 현황</p>
        <Button variant="outline" size="sm" onClick={fetchSummary}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground py-8">로딩 중...</p>
      ) : universities.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">데이터가 없습니다</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium">대학</th>
                {yearDocTypes.map((yd) => {
                  const [yr, dt] = yd.split("_");
                  return <th key={yd} className="p-2 font-medium text-center">{yr} {dt}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {universities.map((uni) => (
                <tr key={uni} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">{uni}</td>
                  {yearDocTypes.map((yd) => {
                    const count = pivot.get(uni)?.get(yd);
                    return (
                      <td key={yd} className="p-2 text-center">
                        {count ? (
                          <Badge variant="secondary" className="text-xs">✅ {count}청크</Badge>
                        ) : (
                          <span className="text-muted-foreground">❌</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
