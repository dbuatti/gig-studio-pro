import { supabase } from "@/integrations/supabase/client";

/**
 * Interacts with the r2-storage Edge Function to manage Cloudflare R2 assets.
 */
export const r2Storage = {
  /**
   * Gets a presigned URL and uploads a file directly to R2.
   */
  async upload(path: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('action', 'uploadDirect');
    formData.append('path', path);
    formData.append('file', file);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const res = await fetch(
      `https://rqesjpnhrjdjnrzdhzgw.supabase.co/functions/v1/r2-storage`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(errBody || `Upload failed (${res.status})`);
    }

    const data = await res.json();
    return data.url;
  },

  /**
   * Deletes a file from R2.
   */
  async delete(path: string): Promise<void> {
    const { error } = await supabase.functions.invoke('r2-storage', {
      body: { action: 'delete', path }
    });
    if (error) throw new Error(error.message || "Unknown error");
  },

  /**
   * Lists files in an R2 path.
   */
  async list(prefix: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.functions.invoke('r2-storage', {
      body: { action: 'list', path: prefix }
    });
    if (error) throw new Error(error.message || "Unknown error");
    return data.files;
  }
};