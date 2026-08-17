"use client";

import { useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { offlineDb, generateOfflineId } from "@/lib/offline-db";
import { syncEngine } from "@/lib/sync-engine";
import type {
  SubscriptionFrequency,
  Team,
  subscription,
} from "@/app/generated/prisma/client";

// ============================================================================
// Constants
// ============================================================================

const SUBSCRIPTION_FREQUENCIES: readonly SubscriptionFrequency[] = [
  "WEEKLY",
  "FORTNIGHTLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
] as const;

const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const DEFAULT_CURRENCY = "USD";

// ============================================================================
// Schema & Types
// ============================================================================

const subscriptionFormSchema = z.object({
  serviceName: z
    .string()
    .min(1, "Service name is required")
    .max(100, "Service name must be less than 100 characters")
    .transform((val) => val.trim()),
  provider: z
    .string()
    .min(1, "Provider is required")
    .max(100, "Provider must be less than 100 characters")
    .transform((val) => val.trim()),
  cost: z
    .string()
    .min(1, "Cost is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: "Cost must be a valid positive number",
    })
    .transform((val) => Number(val)),
  frequency: z.enum([
    "WEEKLY",
    "FORTNIGHTLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
  ]),
  teamId: z.string().min(1, "Please select a team"),
  startDate: z.string().min(1, "Start date is required"),
  lastPaymentDate: z.string().optional(),
  notes: z
    .string()
    .max(500, "Notes must be less than 500 characters")
    .optional()
    .transform((val) => val?.trim() || ""),
  version: z.number().int().positive().default(1),
});

type SubscriptionFormValues = z.input<typeof subscriptionFormSchema>;
type SubscriptionFormOutput = z.output<typeof subscriptionFormSchema>;

interface SubscriptionFormProps {
  teams: (Team & { role: string })[];
  initialData?: subscription & { team_name: string };
  onSuccess: () => void;
  onCancel: () => void;
  onSubmitting?: (submitting: boolean) => void;
}

// ============================================================================
// Utilities
// ============================================================================

function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

function getDefaultValues(
  initialData?: subscription & { team_name: string },
): SubscriptionFormValues {
  if (initialData) {
    return {
      serviceName: initialData.serviceName,
      provider: initialData.provider,
      cost: String(initialData.cost),
      frequency: initialData.frequency,
      teamId: initialData.teamId,
      startDate: formatDateForInput(initialData.startDate),
      lastPaymentDate: formatDateForInput(initialData.lastPaymentDate),
      notes: initialData.notes ?? "",
      version: initialData.version,
    };
  }

  return {
    serviceName: "",
    provider: "",
    cost: "",
    frequency: "MONTHLY",
    teamId: "",
    startDate: "",
    lastPaymentDate: "",
    notes: "",
    version: 1,
  };
}

// ============================================================================
// Component
// ============================================================================

export function SubscriptionForm({
  teams,
  initialData,
  onSuccess,
  onCancel,
  onSubmitting,
}: SubscriptionFormProps) {
  const isEditMode = !!initialData;

  const form = useForm({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: getDefaultValues(initialData),
    mode: "onBlur",
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = form;

  // Reset form when initialData changes
  useEffect(() => {
    reset(getDefaultValues(initialData));
  }, [initialData, reset]);

  // Notify parent of submitting state changes
  useEffect(() => {
    onSubmitting?.(isSubmitting);
  }, [isSubmitting, onSubmitting]);

  const onSubmit = useCallback(
    async (data: SubscriptionFormOutput) => {
      const now = new Date().toISOString();
      const effectiveLastPaymentDate = data.lastPaymentDate || data.startDate;

      try {
        if (isEditMode && initialData) {
          // Update existing subscription
          await offlineDb.subscriptions.update(initialData.id, {
            serviceName: data.serviceName,
            provider: data.provider,
            cost: data.cost,
            frequency: data.frequency,
            teamId: data.teamId,
            startDate: data.startDate,
            lastPaymentDate: effectiveLastPaymentDate,
            notes: data.notes,
            version: data.version,
            updatedAt: now,
            pendingSync: true,
          });

          if (syncEngine) {
            await syncEngine.queueChange({
              tableName: "subscription",
              recordId: initialData.id,
              action: "update",
              payload: {
                serviceName: data.serviceName,
                provider: data.provider,
                cost: data.cost,
                frequency: data.frequency,
                teamId: data.teamId,
                startDate: data.startDate,
                lastPaymentDate: effectiveLastPaymentDate,
                notes: data.notes || null,
                version: data.version,
              },
            });
          }
        } else {
          // Create new subscription
          const subscriptionId = generateOfflineId();

          await offlineDb.subscriptions.add({
            id: subscriptionId,
            teamId: data.teamId,
            startDate: data.startDate,
            notes: data.notes,
            serviceName: data.serviceName,
            provider: data.provider,
            cost: data.cost,
            currency: DEFAULT_CURRENCY,
            frequency: data.frequency,
            lastPaymentDate: effectiveLastPaymentDate,
            isActive: true,
            version: data.version,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
            synced: false,
            pendingSync: true,
          });

          if (syncEngine) {
            await syncEngine.queueChange({
              tableName: "subscription",
              recordId: subscriptionId,
              action: "create",
              payload: {
                teamId: data.teamId,
                serviceName: data.serviceName,
                provider: data.provider,
                cost: data.cost,
                currency: DEFAULT_CURRENCY,
                frequency: data.frequency,
                lastPaymentDate: effectiveLastPaymentDate,
                isActive: true,
                version: data.version,
                notes: data.notes || null,
              },
            });
          }
        }

        reset(getDefaultValues());
        onSuccess();
      } catch (error) {
        // Set form-level error
        form.setError("root", {
          type: "manual",
          message: `Failed to ${isEditMode ? "update" : "create"} subscription. Please try again.`,
        });
        console.error("Subscription form error:", error);
      }
    },
    [isEditMode, initialData, reset, onSuccess, form],
  );

  if (teams.length === 0) {
    return (
      <Button disabled>
        {isEditMode ? "Edit Subscription" : "Add Subscription"}
      </Button>
    );
  }

  return (
    <Form {...form}>
      <form
        id="subscription-form"
        onSubmit={handleSubmit((data) =>
          onSubmit({
            ...data,
            cost: Number(data.cost),
            notes: data.notes ?? "",
            version: data.version ?? 1,
          }),
        )}
        className="space-y-6"
        noValidate
      >
        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-4 pr-2">
          {/* Service Name */}
          <FormField
            control={form.control}
            name="serviceName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., GitHub Enterprise" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Provider */}
          <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., GitHub" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dates Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastPaymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last payment date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Defaults to start date if empty
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Cost & Frequency Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost ({DEFAULT_CURRENCY})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing frequency</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUBSCRIPTION_FREQUENCIES.map((freq) => (
                        <SelectItem key={freq} value={freq}>
                          {FREQUENCY_LABELS[freq]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Team Selection */}
          <FormField
            control={form.control}
            name="teamId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Notes{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add any additional notes about this subscription..."
                    rows={3}
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Form-level Error */}
          {errors.root && (
            <div
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
            >
              {errors.root.message}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner className="mr-2 size-4" />}
            {isEditMode ? "Update Subscription" : "Add Subscription"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
