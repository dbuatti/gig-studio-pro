"use client";

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { X, Bell, BellRing, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    // Optionally, navigate to a specific page based on notification type
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-l border-border flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {unreadCount > 0 ? (
                <BellRing className="w-6 h-6 text-indigo-500 animate-bell-ring" />
              ) : (
                <Bell className="w-6 h-6 text-muted-foreground" />
              )}
              <SheetTitle className="text-xl font-bold text-foreground">Notifications</SheetTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <SheetDescription className="text-muted-foreground">
            You have {unreadCount} unread notifications.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 flex justify-end">
            {unreadCount > 0 && (
              <Button variant="link" size="sm" onClick={markAllAsRead} className="text-indigo-500 text-xs h-auto p-0">
                Mark all as read
              </Button>
            )}
          </div>
          <Separator className="bg-border" />
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground text-sm">No notifications to display.</p>
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
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationDrawer;