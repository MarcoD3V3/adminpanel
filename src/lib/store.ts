import { create } from "zustand";
import type { Notification, RemoteEvent } from "@/types";
import { mockEvents, mockNotifications } from "./mock-data";

interface AdminStore {
  notifications: Notification[];
  events: RemoteEvent[];
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  addNotification: (notification: Omit<Notification, "id" | "createdAt" | "sent" | "readCount">) => void;
  addEvent: (event: Omit<RemoteEvent, "id" | "createdAt" | "status" | "executedCount">) => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  notifications: mockNotifications,
  events: mockEvents,
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: `n${Date.now()}`,
          createdAt: new Date().toISOString(),
          sent: true,
          readCount: 0,
        },
        ...state.notifications,
      ],
    })),
  addEvent: (event) =>
    set((state) => ({
      events: [
        {
          ...event,
          id: `e${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: "pending",
          executedCount: 0,
        },
        ...state.events,
      ],
    })),
}));
