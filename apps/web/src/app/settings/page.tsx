"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/convexApi";
import { BlocklistSection, FallbackSection, MusicSection } from "@/components/SettingsSections";

const formSchema = z.object({
  approvalMode: z.enum(["auto", "manual"]),
  autoApproveDelayMinutes: z.coerce.number().int().min(0),
  dailyRunHourUtc: z.coerce.number().int().min(0).max(23),
  dailyRunMinuteUtc: z.coerce.number().int().min(0).max(59),
  defaultVoice: z.string().min(1),
  brandHandle: z.string().min(1),
  backgroundMusicMode: z.enum(["library", "auto", "none"]),
  maxAttemptsPerStep: z.coerce.number().int().min(1),
  pipelinePaused: z.boolean(),
  alertWebhookUrl: z.string().optional(),
  themeRotationText: z.string(),
  enabledSourcesText: z.string(),
});

type FormValues = z.input<typeof formSchema>;

const labelCls = "block text-sm font-medium mb-1";
const inputCls = "w-full rounded-md border px-3 py-1.5 text-sm";

export default function SettingsPage() {
  const settings = useQuery(api.getSettings, {});
  const updateSettings = useMutation(api.updateSettings);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (settings) {
      reset({
        approvalMode: settings.approvalMode,
        autoApproveDelayMinutes: settings.autoApproveDelayMinutes,
        dailyRunHourUtc: settings.dailyRunHourUtc,
        dailyRunMinuteUtc: settings.dailyRunMinuteUtc,
        defaultVoice: settings.defaultVoice,
        brandHandle: settings.brandHandle,
        backgroundMusicMode: settings.backgroundMusicMode,
        maxAttemptsPerStep: settings.maxAttemptsPerStep,
        pipelinePaused: settings.pipelinePaused,
        alertWebhookUrl: settings.alertWebhookUrl ?? "",
        themeRotationText: settings.themeRotation.join(", "),
        enabledSourcesText: settings.enabledSources.join(", "),
      });
    }
  }, [settings, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const parsed = formSchema.parse(values);
    const list = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    try {
      await updateSettings({
        patch: {
          approvalMode: parsed.approvalMode,
          autoApproveDelayMinutes: parsed.autoApproveDelayMinutes,
          dailyRunHourUtc: parsed.dailyRunHourUtc,
          dailyRunMinuteUtc: parsed.dailyRunMinuteUtc,
          defaultVoice: parsed.defaultVoice,
          brandHandle: parsed.brandHandle,
          backgroundMusicMode: parsed.backgroundMusicMode,
          maxAttemptsPerStep: parsed.maxAttemptsPerStep,
          pipelinePaused: parsed.pipelinePaused,
          alertWebhookUrl: parsed.alertWebhookUrl ? parsed.alertWebhookUrl : undefined,
          themeRotation: list(parsed.themeRotationText),
          enabledSources: list(parsed.enabledSourcesText),
        },
      });
      alert("Settings saved.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  });

  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {settings === undefined ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : settings === null ? (
        <p className="mt-8 text-muted-foreground">
          Settings not seeded yet — click “Seed” on the Today page.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Approval mode</label>
                <select className={inputCls} {...register("approvalMode")}>
                  <option value="auto">auto</option>
                  <option value="manual">manual</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Auto-approve delay (min)</label>
                <input type="number" className={inputCls} {...register("autoApproveDelayMinutes")} />
              </div>
              <div>
                <label className={labelCls}>Daily run hour (UTC)</label>
                <input type="number" className={inputCls} {...register("dailyRunHourUtc")} />
              </div>
              <div>
                <label className={labelCls}>Daily run minute (UTC)</label>
                <input type="number" className={inputCls} {...register("dailyRunMinuteUtc")} />
              </div>
              <div>
                <label className={labelCls}>Max attempts per step</label>
                <input type="number" className={inputCls} {...register("maxAttemptsPerStep")} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="paused" {...register("pipelinePaused")} />
                <label htmlFor="paused" className="text-sm font-medium">
                  Pause pipeline
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Video &amp; sources</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Brand handle</label>
                <input className={inputCls} {...register("brandHandle")} />
              </div>
              <div>
                <label className={labelCls}>Default voice</label>
                <input className={inputCls} {...register("defaultVoice")} />
              </div>
              <div>
                <label className={labelCls}>Background music</label>
                <select className={inputCls} {...register("backgroundMusicMode")}>
                  <option value="library">library (uploaded)</option>
                  <option value="auto">auto-source</option>
                  <option value="none">none</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Alert webhook URL</label>
                <input className={inputCls} {...register("alertWebhookUrl")} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Theme rotation (comma-separated)</label>
                <input className={inputCls} {...register("themeRotationText")} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Enabled sources (comma-separated feed ids; empty = all)</label>
                <input className={inputCls} {...register("enabledSourcesText")} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={formState.isSubmitting}>
            Save settings
          </Button>
        </form>
      )}

      <div className="mt-8 space-y-6">
        <BlocklistSection />
        <FallbackSection />
        <MusicSection />
      </div>
    </Shell>
  );
}
