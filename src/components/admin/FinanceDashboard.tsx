import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { getSignedUrl } from "@/lib/storage";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { DollarSign, TrendingUp, TrendingDown, Upload, Plus, Settings2, RefreshCw, FileSpreadsheet, Trash2, Eye, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface FinanceEntry {
  id: string;
  admin_id: string;
  type: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  entry_date: string;
  receipt_url: string | null;
  created_at: string;
}

interface FinanceCategory {
  id: string;
  name: string;
  type: string;
}

interface FinanceSettings {
  id: string;
  google_sheet_id: string | null;
  google_sheet_tab: string | null;
  last_synced_at: string | null;
}

const defaultCategories = ["Rent", "Supplies", "Marketing", "Client Payments", "Subscriptions", "Equipment", "Other"];

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "expense" | "revenue">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  // Form state
  const [formType, setFormType] = useState<"expense" | "revenue">("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("Other");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formReceiptUrl, setFormReceiptUrl] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Settings form
  const [sheetId, setSheetId] = useState("");
  const [sheetTab, setSheetTab] = useState("Finance");

  // Category form
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"expense" | "revenue" | "both">("both");

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const [entriesRes, catsRes, settingsRes] = await Promise.all([
      supabase.from("finance_entries" as any).select("*").order("entry_date", { ascending: false }),
      supabase.from("finance_categories" as any).select("*").order("sort_order"),
      supabase.from("finance_settings" as any).select("*").eq("admin_id", user.id).maybeSingle(),
    ]);
    if (entriesRes.data) setEntries(entriesRes.data as any);
    if (catsRes.data) setCategories(catsRes.data as any);
    if (settingsRes.data) {
      setSettings(settingsRes.data as any);
      setSheetId((settingsRes.data as any).google_sheet_id || "");
      setSheetTab((settingsRes.data as any).google_sheet_tab || "Finance");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Seed default categories if none exist
  useEffect(() => {
    if (!loading && categories.length === 0 && user) {
      const seedCategories = async () => {
        const rows = defaultCategories.map((name, i) => ({
          admin_id: user.id,
          name,
          type: name === "Client Payments" ? "revenue" : "both",
          sort_order: i,
        }));
        await supabase.from("finance_categories" as any).insert(rows);
        fetchAll();
      };
      seedCategories();
    }
  }, [loading, categories.length, user, fetchAll]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const thisMonthEntries = entries.filter(e => {
    const d = parseISO(e.entry_date);
    return d >= monthStart && d <= monthEnd;
  });

  const totalRevenue = entries.filter(e => e.type === "revenue").reduce((s, e) => s + Number(e.amount), 0);
  const totalExpenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const monthRevenue = thisMonthEntries.filter(e => e.type === "revenue").reduce((s, e) => s + Number(e.amount), 0);
  const monthExpenses = thisMonthEntries.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);

  // Chart data: last 6 months
  const chartData = useMemo(() => {
    const months: { month: string; revenue: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const label = format(d, "MMM yyyy");
      const rev = entries.filter(e => e.type === "revenue" && parseISO(e.entry_date) >= ms && parseISO(e.entry_date) <= me).reduce((s, e) => s + Number(e.amount), 0);
      const exp = entries.filter(e => e.type === "expense" && parseISO(e.entry_date) >= ms && parseISO(e.entry_date) <= me).reduce((s, e) => s + Number(e.amount), 0);
      months.push({ month: label, revenue: rev, expenses: exp });
    }
    return months;
  }, [entries]);

  const filteredEntries = entries.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  const resetForm = () => {
    setFormType("expense");
    setFormAmount("");
    setFormCategory("Other");
    setFormDescription("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormReceiptUrl(null);
  };

  const handleSaveEntry = async () => {
    if (!user || !formAmount) return;
    setFormSaving(true);
    const { error } = await supabase.from("finance_entries" as any).insert({
      admin_id: user.id,
      type: formType,
      amount: parseFloat(formAmount),
      category: formCategory,
      description: formDescription,
      entry_date: formDate,
      receipt_url: formReceiptUrl,
    });
    setFormSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entry saved" });
      resetForm();
      setAddOpen(false);
      fetchAll();
    }
  };

  const handleDeleteEntry = async (id: string) => {
    const { error } = await supabase.from("finance_entries" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const handleReceiptUpload = async (file: File) => {
    if (!user) return;
    setReceiptUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("finance-receipts").upload(path, file);
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      setReceiptUploading(false);
      return;
    }

    setFormReceiptUrl(path);

    // Call AI to transcribe
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-receipt", {
        body: { receipt_url: path },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.amount) setFormAmount(String(data.amount));
      if (data.date) setFormDate(data.date);
      if (data.description) setFormDescription(data.vendor ? `${data.vendor} — ${data.description}` : data.description);
      if (data.suggested_category) setFormCategory(data.suggested_category);
      toast({ title: "Receipt scanned", description: "Review the extracted data below" });
    } catch (e: any) {
      toast({ title: "AI scan failed", description: e.message || "Could not read receipt, please fill manually", variant: "destructive" });
    }

    setReceiptUploading(false);
    setAddOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    const payload = { admin_id: user.id, google_sheet_id: sheetId || null, google_sheet_tab: sheetTab || "Finance" };
    if (settings) {
      await supabase.from("finance_settings" as any).update(payload).eq("id", settings.id);
    } else {
      await supabase.from("finance_settings" as any).insert(payload);
    }
    toast({ title: "Settings saved" });
    setSettingsOpen(false);
    fetchAll();
  };

  const handleSync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("sync-finance-sheets");
    setSyncing(false);
    if (error || data?.error) {
      toast({ title: "Sync failed", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Synced to Google Sheets", description: `${data.rows_synced} entries exported` });
      fetchAll();
    }
  };

  const handleImport = async () => {
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("import-finance-sheets");
    setImporting(false);
    if (error || data?.error) {
      toast({ title: "Import failed", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ 
        title: "Imported from Google Sheets", 
        description: `${data.imported} entries imported (${data.updated} updated, ${data.created} created)` 
      });
      fetchAll();
    }
  };

  const handleAddCategory = async () => {
    if (!user || !newCatName.trim()) return;
    await supabase.from("finance_categories" as any).insert({
      admin_id: user.id,
      name: newCatName.trim(),
      type: newCatType,
      sort_order: categories.length,
    });
    setNewCatName("");
    fetchAll();
  };

  const handleDeleteCategory = async (id: string) => {
    await supabase.from("finance_categories" as any).delete().eq("id", id);
    fetchAll();
  };

  const handleViewReceipt = async (url: string) => {
    const signed = await getSignedUrl("finance-receipts", url);
    if (signed) setReceiptPreviewUrl(signed);
  };

  const categoryNames = categories.length > 0 ? categories.map(c => c.name) : defaultCategories;

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-2))" },
    expenses: { label: "Expenses", color: "hsl(var(--chart-1))" },
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-[11px] font-sans text-muted-foreground uppercase tracking-wide">Month Revenue</p>
          <p className="text-xl font-serif font-semibold text-chart-2">€{monthRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-[11px] font-sans text-muted-foreground uppercase tracking-wide">Month Expenses</p>
          <p className="text-xl font-serif font-semibold text-chart-1">€{monthExpenses.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-[11px] font-sans text-muted-foreground uppercase tracking-wide">Month Net</p>
          <p className={`text-xl font-serif font-semibold ${monthRevenue - monthExpenses >= 0 ? "text-chart-2" : "text-destructive"}`}>
            €{(monthRevenue - monthExpenses).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-[11px] font-sans text-muted-foreground uppercase tracking-wide">All-Time Net</p>
          <p className={`text-xl font-serif font-semibold ${totalRevenue - totalExpenses >= 0 ? "text-chart-2" : "text-destructive"}`}>
            €{(totalRevenue - totalExpenses).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-sm font-semibold text-foreground mb-3">Revenue vs Expenses (6 months)</h3>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }} className="gap-1.5 font-sans text-xs">
          <Plus className="h-3.5 w-3.5" /> Add Entry
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 font-sans text-xs relative" disabled={receiptUploading}>
          <Upload className="h-3.5 w-3.5" /> {receiptUploading ? "Scanning..." : "Upload Receipt"}
          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f); e.target.value = ""; }}
          />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCategoryOpen(true)} className="gap-1.5 font-sans text-xs">
          <Settings2 className="h-3.5 w-3.5" /> Categories
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)} className="gap-1.5 font-sans text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Sheets Settings
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing || !settings?.google_sheet_id}
          className="gap-1.5 font-sans text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync Sheets
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleImport}
          disabled={importing || !settings?.google_sheet_id}
          className="gap-1.5 font-sans text-xs"
        >
          <Download className={`h-3.5 w-3.5 ${importing ? "animate-spin" : ""}`} /> Import from Sheet
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-[130px] h-8 text-xs font-sans"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px] h-8 text-xs font-sans"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground font-sans ml-auto">{filteredEntries.length} entries</span>
      </div>

      {/* Entries Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-sans">Date</TableHead>
              <TableHead className="text-xs font-sans">Type</TableHead>
              <TableHead className="text-xs font-sans">Category</TableHead>
              <TableHead className="text-xs font-sans">Description</TableHead>
              <TableHead className="text-xs font-sans text-right">Amount</TableHead>
              <TableHead className="text-xs font-sans w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">No entries yet</TableCell></TableRow>
            ) : filteredEntries.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-xs font-sans">{format(parseISO(e.entry_date), "dd/MM/yy")}</TableCell>
                <TableCell>
                  <Badge variant={e.type === "revenue" ? "default" : "secondary"} className="text-[10px]">
                    {e.type === "revenue" ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {e.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs font-sans">{e.category}</TableCell>
                <TableCell className="text-xs font-sans max-w-[200px] truncate">{e.description}</TableCell>
                <TableCell className={`text-xs font-sans text-right font-medium ${e.type === "revenue" ? "text-chart-2" : "text-chart-1"}`}>
                  €{Number(e.amount).toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {e.receipt_url && (
                      <button onClick={() => handleViewReceipt(e.receipt_url!)} className="p-1 text-muted-foreground hover:text-foreground">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteEntry(e.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Entry Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Add Finance Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={formType === "expense" ? "default" : "outline"} onClick={() => setFormType("expense")} className="flex-1 text-xs font-sans">Expense</Button>
              <Button size="sm" variant={formType === "revenue" ? "default" : "outline"} onClick={() => setFormType("revenue")} className="flex-1 text-xs font-sans">Revenue</Button>
            </div>
            <Input type="number" step="0.01" placeholder="Amount (€)" value={formAmount} onChange={e => setFormAmount(e.target.value)} className="text-sm" />
            <Select value={formCategory} onValueChange={setFormCategory}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoryNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Description" value={formDescription} onChange={e => setFormDescription(e.target.value)} className="text-sm" />
            <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="text-sm" />
            {formReceiptUrl && (
              <p className="text-xs text-muted-foreground font-sans">📎 Receipt attached</p>
            )}
            <Button onClick={handleSaveEntry} disabled={formSaving || !formAmount} className="w-full text-xs font-sans">
              {formSaving ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Google Sheets Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-sans text-muted-foreground">Google Sheet ID</label>
              <Input placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" value={sheetId} onChange={e => setSheetId(e.target.value)} className="text-sm mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">From the Sheet URL: docs.google.com/spreadsheets/d/<strong>SHEET_ID</strong>/edit</p>
            </div>
            <div>
              <label className="text-xs font-sans text-muted-foreground">Tab Name</label>
              <Input placeholder="Finance" value={sheetTab} onChange={e => setSheetTab(e.target.value)} className="text-sm mt-1" />
            </div>
            {settings?.last_synced_at && (
              <p className="text-[10px] text-muted-foreground">Last synced: {format(parseISO(settings.last_synced_at), "dd/MM/yyyy HH:mm")}</p>
            )}
            <Button onClick={handleSaveSettings} className="w-full text-xs font-sans">Save Settings</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/50">
                  <div>
                    <span className="text-xs font-sans font-medium">{c.name}</span>
                    <Badge variant="outline" className="ml-2 text-[9px]">{c.type}</Badge>
                  </div>
                  <button onClick={() => handleDeleteCategory(c.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="New category" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="text-sm flex-1" />
              <Select value={newCatType} onValueChange={(v) => setNewCatType(v as any)}>
                <SelectTrigger className="w-[100px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleAddCategory} disabled={!newCatName.trim()}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview */}
      <Dialog open={!!receiptPreviewUrl} onOpenChange={() => setReceiptPreviewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Receipt</DialogTitle>
          </DialogHeader>
          {receiptPreviewUrl && (
            <img src={receiptPreviewUrl} alt="Receipt" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
