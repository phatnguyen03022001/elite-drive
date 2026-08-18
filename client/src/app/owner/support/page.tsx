"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import api from "@/lib/axios";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, LifeBuoy, ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils";

interface SupportTicketForm {
  type: string;
  bookingId: string;
  description: string;
}

interface TicketHistory {
  id: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function SupportPage() {
  const [history, setHistory] = useState<TicketHistory[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("faq");
  const { register, handleSubmit, reset } = useForm<SupportTicketForm>({
    defaultValues: {
      type: "TECHNICAL",
      bookingId: "",
      description: "",
    },
  });

  const fetchHistory = async () => {
    setFetchingHistory(true);
    try {
      const response = await api.get("/api/customer/disputes");
      const payload = response.data?.data ?? response.data;
      setHistory(Array.isArray(payload) ? payload : []);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Không thể tải lịch sử hỗ trợ"));
    } finally {
      setFetchingHistory(false);
    }
  };

  const onSubmit = async (values: SupportTicketForm) => {
    setLoading(true);
    try {
      await api.post("/api/customer/disputes", {
        ...values,
        bookingId: values.bookingId.trim() || undefined,
        title: `[${values.type}] - ${values.bookingId || "Hỗ trợ chung"}`,
      });
      toast.success("Yêu cầu đã được gửi!");
      reset();
      await fetchHistory();
      setActiveTab("history");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Gửi thất bại"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl animate-in fade-in duration-500">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Trung tâm Hỗ trợ & Liên hệ</h1>
        <p className="text-muted-foreground mt-2 font-medium">Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="flex flex-row items-center space-x-4 pb-2">
            <PhoneCall className="text-primary h-6 w-6" />
            <CardTitle className="text-lg">Hotline 24/7</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">1900 6868</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Dành cho sự cố khẩn cấp (Incident)</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center space-x-4 pb-2">
            <ShieldAlert className="text-primary h-6 w-6" />
            <CardTitle className="text-lg">Tranh chấp</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="destructive" className="mb-2">Dispute Center</Badge>
            <p className="text-xs text-muted-foreground font-medium">Gửi yêu cầu giải quyết tranh chấp</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-12">
          <TabsTrigger value="faq" className="font-bold">FAQ</TabsTrigger>
          <TabsTrigger value="contact" className="font-bold">Gửi yêu cầu</TabsTrigger>
          <TabsTrigger value="history" className="font-bold" onClick={fetchHistory}>Lịch sử yêu cầu</TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" /> Định danh tài khoản
            </h2>
            <Accordion type="single" collapsible className="w-full bg-card border rounded-xl px-4">
              <AccordionItem value="item-1" className="border-none">
                <AccordionTrigger className="hover:no-underline font-semibold">Làm thế nào để xác thực KYC?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Bạn cần tải lên hình ảnh CCCD và Bằng lái xe rõ nét. Hồ sơ sẽ được gửi tới quy trình kiểm duyệt của hệ thống.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </TabsContent>

        <TabsContent value="contact">
          <Card className="shadow-lg border-primary/10">
            <CardHeader>
              <CardTitle className="text-xl">Gửi Ticket hỗ trợ chuyên sâu</CardTitle>
              <CardDescription>Chọn đúng danh mục để yêu cầu của bạn được xử lý nhanh nhất.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Loại vấn đề</label>
                    <select {...register("type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all">
                      <option value="TECHNICAL">Xe gặp sự cố kỹ thuật (Hỏng hóc, lỗi máy...)</option>
                      <option value="DISPUTE">Khiếu nại chủ xe / Tranh chấp chi phí</option>
                      <option value="INCIDENT">Báo cáo va chạm, tai nạn (Cần bảo hiểm)</option>
                      <option value="REFUND">Yêu cầu hoàn trả tiền cọc / Phí thuê</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Mã đặt xe (Booking ID)</label>
                    <Input {...register("bookingId")} placeholder="Booking ObjectId" className="focus:ring-2 focus:ring-primary transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">Nội dung chi tiết</label>
                  <Textarea {...register("description", { required: true })} placeholder="Vui lòng mô tả chi tiết vấn đề bạn gặp phải..." className="min-h-[150px] focus:ring-2 focus:ring-primary transition-all" />
                </div>
                <Button className="w-full h-12 text-md font-bold" type="submit" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Đang gửi yêu cầu...</> : "Gửi yêu cầu hỗ trợ"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-lg border-primary/10">
            <CardHeader>
              <CardTitle className="text-xl">Yêu cầu đã gửi</CardTitle>
              <CardDescription>Theo dõi tiến độ xử lý các khiếu nại và hỗ trợ của bạn.</CardDescription>
            </CardHeader>
            <CardContent>
              {fetchingHistory ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">Bạn chưa gửi yêu cầu hỗ trợ nào.</div>
              ) : (
                <div className="space-y-4">
                  {history.map((ticket) => (
                    <div key={ticket.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString("vi-VN")}</span>
                        </div>
                        <p className="text-sm font-medium line-clamp-1">{ticket.description}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">ID: {ticket.id}</p>
                      </div>
                      <Badge className={cn(
                        "text-white",
                        ticket.status === "RESOLVED" && "bg-emerald-500 hover:bg-emerald-600",
                        (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") && "bg-orange-500 hover:bg-orange-600",
                        ticket.status === "CLOSED" && "bg-slate-500 hover:bg-slate-600",
                      )}>
                        {ticket.status === "RESOLVED" && "Đã giải quyết"}
                        {ticket.status === "OPEN" && "Mới tiếp nhận"}
                        {ticket.status === "IN_PROGRESS" && "Đang xử lý"}
                        {ticket.status === "CLOSED" && "Đã đóng"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
