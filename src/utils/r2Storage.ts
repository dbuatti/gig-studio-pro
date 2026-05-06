import { supabase } from "@/integrations/supabase/client";

/**
 * Interacts with the r2-storage Edge Function to manage Cloudflare R2 assets.
 */
export const r2Storage = {
  /**
   * Gets a presigned URL and uploads a file directly to R2.
   */
  async upload(path: string, file: File): Promise<string> {
    const { data, error } = await supabase.functions.invoke('r2-storage', {
      body: { action: 'getUploadUrl', path, contentType: file.type }
    });

    if (error) throw error;

    const uploadRes = await fetch(data.url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    if (!uploadRes.ok) throw new Error("Failed to upload to R2");

    // Construct the public URL (Assumes bucket is public or has a custom domain)
    // If using a custom domain, replace this with your domain.
    const endpoint = "https://rqesjpnhrjdjnrzdhzgw.supabase.co"; // Placeholder, will be derived from R2 config
    return data.url.split('?')[0]; 
  },

  /**
   * Deletes a file from R2.
   */
  async delete(path: string): Promise<void> {
    const { error } = await supabase.functions.invoke('r2-storage', {
      body: { action: 'delete', path }
    });
    if (error) throw error;
  },

  /**
   * Lists files in an R2 path.
   */
  async list(prefix: string): Promise<any[]> {
    const { data, error } = await supabase.functions.invoke('r2-storage', {
      body: { action: 'list', path: prefix }
    });
    if (error) throw error;
    return data.files;
  }
};