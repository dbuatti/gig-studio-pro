"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';

export function useFollow(profileUserId: string | undefined) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followCount, setFollowCount] = useState(0);

  const fetchFollowStatus = useCallback(async () => {
    if (!user || !profileUserId) {
      setIsFollowing(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check if current user is following the profile user
      const { count: isFollowingCount, error: isFollowingError } = await supabase
        .from('follows')
        .select('*', { count: 'exact' })
        .eq('follower_id', user.id)
        .eq('followed_id', profileUserId);

      if (isFollowingError) throw isFollowingError;
      setIsFollowing(isFollowingCount > 0);

      // Get total followers for the profile user
      const { count: followersCount, error: followersError } = await supabase
        .from('follows')
        .select('*', { count: 'exact' })
        .eq('followed_id', profileUserId);

      if (followersError) throw followersError;
      setFollowCount(followersCount || 0);

    } catch (err: any) {
      // Error handled by toast
    } finally {
      setLoading(false);
    }
  }, [user, profileUserId]);

  useEffect(() => {
    fetchFollowStatus();
  }, [fetchFollowStatus]);

  const toggleFollow = useCallback(async () => {
    if (!user || !profileUserId || loading) return;

    setLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', profileUserId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowCount(prev => Math.max(0, prev - 1));
        showSuccess(`Unfollowed user.`);
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: user.id, followed_id: profileUserId });
        if (error) throw error;
        setIsFollowing(true);
        setFollowCount(prev => prev + 1);
        showSuccess(`Now following user!`);
      }
    } catch (err: any) {
      showError(`Failed to update follow status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, profileUserId, isFollowing, loading]);

  return { isFollowing, followCount, loading, toggleFollow };
}