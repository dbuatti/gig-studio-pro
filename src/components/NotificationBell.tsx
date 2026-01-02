"use client";

import React from 'react';
import { Bell, BellRing, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns'; // Assuming date-fns is installed

interface NotificationBellProps {
  onOpenDrawer: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenDrawer }) => {
  const { unreadCount, notifications, markAsRead, markAllAsRead, loading } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    // Optionally, navigate to a specific page based on notification type
    // onOpenDrawer(); // Open the full drawer
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
          {unreadCount > 0 ? (
            <BellRing className="w-5 h-5 text-indigo-500 animate-bell-ring" />
          ) : (
            <Bell className="w-5 h-5 text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-card border-border rounded-xl shadow-lg z-[100]">
        <div className="flex items-center justify-between p-4">
          <h4 className="text-sm font-bold text-foreground">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="link" size="sm" onClick={markAllAsRead} className="text-indigo-500 text-xs h-auto p-0">
              Mark all as read
            </Button>
          )}
        </div>
        <Separator className="bg-border" />
        <ScrollArea className="h-[250px]">
          {loading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground text-sm">No new notifications.</p>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex flex-col gap-1 p-4 cursor-pointer hover:bg-accent/50 transition-colors",
                    !notification.is_read ? "bg-indigo-500/10" : "text-muted-foreground"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-medium", !notification.is_read && "text-foreground font-bold")}>
                      {notification.type === 'new_follower' ? `New follower: ${notification.content?.follower_name || 'Someone'}` : notification.type}
                    </span>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <Separator className="bg-border" />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={onOpenDrawer}>
            View All
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;