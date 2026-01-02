"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  content: any;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (err: any) {
      console.error("[useNotifications] Error fetching notifications:", err.message);
      showError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    // Set up Realtime listener for new notifications
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          console.log("[useNotifications] Realtime INSERT:", payload.new);
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          showSuccess("New notification received!");
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          console.log("[useNotifications] Realtime UPDATE:", payload.new);
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n));
          setUnreadCount(prev => (payload.new as Notification).is_read ? Math.max(0, prev - 1) : prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id); // Ensure user can only mark their own
      if (error) throw error;
      // Realtime listener will update state, no need to manually set
    } catch (err: any) {
      console.error("[useNotifications] Error marking as read:", err.message);
      showError("Failed to mark notification as read.");
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false); // Only update unread ones
      if (error) throw error;
      // Realtime listener will update state
      showSuccess("All notifications marked as read.");
    } catch (err: any) {
      console.error("[useNotifications] Error marking all as read:", err.message);
      showError("Failed to mark all notifications as read.");
    }
  }, [user]);

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, fetchNotifications };
}