import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plane, CheckCircle, Clock, MapPin, Camera, Truck, Eye, Package, Search, Loader2 } from "lucide-react";

const serviceTypes = [
  { value: "mapping", label: "Aerial Mapping & Surveying", icon: MapPin },
  { value: "inspection", label: "Infrastructure Inspection", icon: Eye },
  { value: "photography", label: "Aerial Photography & Video", icon: Camera },
  { value: "delivery", label: "Package Delivery", icon: Truck },
  { value: "surveillance", label: "Site Surveillance & Security", icon: Eye },
  { value: "other", label: "Other / Custom", icon: Package },
];

const requestSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().optional(),
  customerCompany: z.string().optional(),
  title: z.string().min(5, "Please describe your request in at least 5 characters"),
  serviceType: z.string().min(1, "Please select a service type"),
  location: z.string().min(3, "Please enter the location"),
  description: z.string().min(10, "Please describe your mission in at least 10 characters"),
  budgetUsd: z.coerce.number().optional(),
  preferredDate: z.string().optional(),
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    open: { color: "bg-blue-100 text-blue-700", label: "Received" },
    "under-review": { color: "bg-amber-100 text-amber-700", label: "Under Review" },
    published: { color: "bg-indigo-100 text-indigo-700", label: "Finding Operator" },
    claimed: { color: "bg-teal-100 text-teal-700", label: "Operator Assigned" },
    bidding: { color: "bg-yellow-100 text-yellow-700", label: "Matching Operators" },
    awarded: { color: "bg-purple-100 text-purple-700", label: "Operator Assigned" },
    "in-progress": { color: "bg-orange-100 text-orange-700", label: "In Progress" },
    delivered: { color: "bg-emerald-100 text-emerald-700", label: "Delivered" },
    completed: { color: "bg-green-100 text-green-700", label: "Completed" },
    cancelled: { color: "bg-red-100 text-red-700", label: "Cancelled" },
  };
  const s = map[status] ?? { color: "bg-gray-100 text-gray-700", label: status };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

export default function FlyguysPortal() {
  const [submitted, setSubmitted] = useState<{ id: string; message: string } | null>(null);
  const [trackEmail, setTrackEmail] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [tracked, setTracked] = useState<any[]>([]);
  const [trackError, setTrackError] = useState("");
  const [docUrls, setDocUrls] = useState<string[]>([""]);

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      customerName: "", customerEmail: "", customerPhone: "", customerCompany: "",
      title: "", serviceType: "", location: "", description: "", preferredDate: "",
    },
  });

  async function onSubmit(data: z.infer<typeof requestSchema>) {
    try {
      const filteredDocs = docUrls.filter(u => u.trim().length > 0);
      const res = await fetch("/api/flyguys/portal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, documentUrls: filteredDocs }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Submission failed");
      }
      const result = await res.json();
      setSubmitted({ id: result.id, message: result.message });
      form.reset();
    } catch (e: any) {
      form.setError("root", { message: e.message });
    }
  }

  async function trackRequest() {
    if (!trackEmail.trim()) return;
    setTrackLoading(true);
    setTrackError("");
    try {
      const res = await fetch(`/api/flyguys/portal/track?email=${encodeURIComponent(trackEmail.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setTracked(data);
    } catch (e: any) {
      setTrackError(e.message || "Error fetching requests");
    } finally {
      setTrackLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Flyguys</h1>
              <p className="text-xs text-slate-500">Drone Services Marketplace</p>
            </div>
          </div>
          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-xs">Customer Portal</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Request Drone Services
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Tell us what you need, and we'll match you with certified drone operators ready to deliver.
          </p>
        </div>

        {/* Service type cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {serviceTypes.map(s => (
            <div key={s.value} className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl border text-sm">
              <s.icon className="w-4 h-4 text-sky-500 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Request Form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                <CardContent className="p-8 text-center space-y-4">
                  <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
                  <h3 className="text-xl font-semibold text-green-800 dark:text-green-300">Request Submitted!</h3>
                  <p className="text-green-700 dark:text-green-400">{submitted.message}</p>
                  <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <p className="text-xs text-slate-500 mb-1">Your Request ID</p>
                    <p className="font-mono text-sm font-bold">{submitted.id}</p>
                  </div>
                  <p className="text-xs text-slate-500">Track your request status below using your email address.</p>
                  <Button variant="outline" onClick={() => setSubmitted(null)} data-testid="button-submit-another">
                    Submit Another Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Submit a Service Request</CardTitle>
                  <CardDescription>Fill in the details below and a Flyguys operator will be assigned to your project.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="customerName" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name *</FormLabel>
                            <FormControl><Input data-testid="input-portal-name" placeholder="Jane Smith" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="customerEmail" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address *</FormLabel>
                            <FormControl><Input data-testid="input-portal-email" type="email" placeholder="jane@company.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="customerPhone" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl><Input data-testid="input-portal-phone" placeholder="(555) 123-4567" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="customerCompany" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company (optional)</FormLabel>
                            <FormControl><Input data-testid="input-portal-company" placeholder="Acme Corp" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="serviceType" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-portal-service-type">
                                <SelectValue placeholder="Select the type of drone service you need" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {serviceTypes.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Request Summary *</FormLabel>
                          <FormControl>
                            <Input data-testid="input-portal-title" placeholder="e.g. Aerial survey of 50-acre construction site" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location / Address *</FormLabel>
                          <FormControl>
                            <Input data-testid="input-portal-location" placeholder="e.g. 123 Main St, Houston, TX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="budgetUsd" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Budget ($)</FormLabel>
                            <FormControl>
                              <Input data-testid="input-portal-budget" type="number" placeholder="e.g. 1500" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="preferredDate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preferred Date</FormLabel>
                            <FormControl>
                              <Input data-testid="input-portal-date" type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold flex items-center gap-1.5">
                            Mission Statement <span className="text-red-500">*</span>
                          </FormLabel>
                          <p className="text-xs text-muted-foreground -mt-1 mb-1">Describe exactly what you need accomplished, where, and what deliverables you expect. The more detail you provide, the better Flyguys can match the right operator and drone.</p>
                          <FormControl>
                            <Textarea
                              data-testid="textarea-portal-description"
                              rows={5}
                              placeholder="e.g. We need a comprehensive aerial survey of a 50-acre construction site in downtown Austin TX. Deliverables: ortho-mosaic map, 3D point cloud, and HD video walkthrough. Site access available weekdays 7am–4pm. Construction equipment will be present..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {/* Document Upload */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium block">Supporting Documents <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
                        <p className="text-xs text-muted-foreground">Paste links to any relevant files — site maps, CAD drawings, reference images, contracts (Google Drive, Dropbox, etc.)</p>
                        <div className="space-y-2">
                          {docUrls.map((url, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                data-testid={`input-doc-url-${i}`}
                                type="url"
                                placeholder="https://drive.google.com/..."
                                value={url}
                                onChange={e => {
                                  const updated = [...docUrls];
                                  updated[i] = e.target.value;
                                  setDocUrls(updated);
                                }}
                                className="flex-1 text-sm"
                              />
                              {docUrls.length > 1 && (
                                <button type="button" onClick={() => setDocUrls(docUrls.filter((_, j) => j !== i))}
                                  className="text-red-400 hover:text-red-600 text-xs px-1.5">✕</button>
                              )}
                            </div>
                          ))}
                          {docUrls.length < 5 && (
                            <button type="button" data-testid="button-add-doc-url"
                              onClick={() => setDocUrls([...docUrls, ""])}
                              className="text-sky-600 hover:text-sky-700 text-xs font-medium flex items-center gap-1">
                              + Add another document link
                            </button>
                          )}
                        </div>
                      </div>

                      {form.formState.errors.root && (
                        <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
                      )}

                      <Button
                        type="submit"
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                        disabled={form.formState.isSubmitting}
                        data-testid="button-portal-submit"
                      >
                        {form.formState.isSubmitting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                        ) : (
                          <><Plane className="w-4 h-4 mr-2" /> Submit Request</>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: Track + How it works */}
          <div className="space-y-5">
            {/* Track Request */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4 text-sky-500" /> Track Your Request
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    data-testid="input-track-email"
                    placeholder="your@email.com"
                    type="email"
                    value={trackEmail}
                    onChange={e => setTrackEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && trackRequest()}
                  />
                  <Button size="sm" variant="outline" onClick={trackRequest} disabled={trackLoading} data-testid="button-track">
                    {trackLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Track"}
                  </Button>
                </div>
                {trackError && <p className="text-xs text-red-500">{trackError}</p>}
                {tracked.length > 0 && (
                  <div className="space-y-2">
                    {tracked.map(r => (
                      <div key={r.id} data-testid={`tracked-request-${r.id}`} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border text-xs">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{r.title}</p>
                          <StatusBadge status={r.status} />
                        </div>
                        <p className="text-slate-500 mt-1">{r.location}</p>
                      </div>
                    ))}
                  </div>
                )}
                {tracked.length === 0 && trackEmail && !trackLoading && !trackError && (
                  <p className="text-xs text-muted-foreground">No requests found for this email.</p>
                )}
              </CardContent>
            </Card>

            {/* How it works */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { step: "1", label: "Submit Your Request", desc: "Fill out the form with your drone service needs and location." },
                  { step: "2", label: "Operator Matching", desc: "Flyguys reviews bids from certified operators in your area." },
                  { step: "3", label: "Project Delivery", desc: "Your selected operator completes the mission and delivers results." },
                  { step: "4", label: "Receive Deliverables", desc: "Videos, images, and reports are shared securely with you." },
                ].map(item => (
                  <div key={item.step} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Powered by */}
            <div className="text-center text-xs text-slate-400 dark:text-slate-600 pt-2">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-5 h-5 bg-slate-700 rounded flex items-center justify-center">
                  <Clock className="w-3 h-3 text-slate-300" />
                </div>
                <span>Powered by HOLOCRON AI</span>
              </div>
              <p>All drone operations monitored via HOLOCRON probes</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
