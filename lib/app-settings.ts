import { createSupabaseAdminClient } from "@/lib/supabase";

const AUTO_APPROVE_KEY = "auto_approve";

export async function getAutoApprove(): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", AUTO_APPROVE_KEY)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const value = data.value;
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  return false;
}

export async function setAutoApprove(enabled: boolean): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: AUTO_APPROVE_KEY,
      value: enabled,
    },
    { onConflict: "key" },
  );

  if (error) {
    throw new Error(`Gagal menyimpan pengaturan: ${error.message}`);
  }
}
