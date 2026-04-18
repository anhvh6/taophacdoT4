export interface CourseAssignmentItemError {
  videoId: string;
  link: string;
  error: string;
}

export interface CourseAssignmentResult {
  success: boolean;
  action: "assign" | "unassign";
  customerId: string;
  email: string;
  totalPrivateVideos: number;
  successCount: number;
  failedCount: number;
  failedItems: CourseAssignmentItemError[];
  error?: string;
  message?: string;
}

import { mockDB } from '../lib/mockData';

export const youtubeAccessService = {
  /**
   * Assigns a student's email to their course's private YouTube videos
   */
  assignCourseVideos: async (customerId: string): Promise<CourseAssignmentResult> => {
    try {
      const customers = await mockDB.getCustomers();
      const customer = customers.find(c => c.customer_id === customerId);
      if (!customer) throw new Error("Học viên không tồn tại");
      if (!customer.email) throw new Error("Học viên chưa có email");

      let tasks = await mockDB.getCustomPlan(customerId);
      if (!tasks || tasks.length === 0) {
        if (!customer.video_date) throw new Error("Học viên chưa có lịch phác đồ (Video Date)");
        tasks = await mockDB.getPlan(customer.video_date);
      }

      const allLinks: string[] = [];
      
      // Lấy link từ tasks
      tasks.forEach(t => { if (t.link) allLinks.push(t.link) });
      
      // Lấy link từ sidebar_blocks nếu có
      if (customer.sidebar_blocks_json && Array.isArray(customer.sidebar_blocks_json)) {
        customer.sidebar_blocks_json.forEach((sb: any) => {
          if (sb.video_link) allLinks.push(sb.video_link);
        });
      }

      const links = Array.from(new Set(allLinks.filter(l => l && (l.includes("youtube.com") || l.includes("youtu.be") || String(l).trim() !== ""))));

      const res = await fetch('/api/youtube/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'assign', email: customer.email, links })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      return {
        success: data.success,
        action: "assign",
        customerId,
        email: customer.email,
        totalPrivateVideos: links.length,
        successCount: data.successCount,
        failedCount: data.failedCount,
        failedItems: data.errors || []
      };
    } catch (error: any) {
      console.error('Error assigning YouTube videos:', error);
      return {
        success: false,
        action: "assign",
        customerId,
        email: "",
        totalPrivateVideos: 0,
        successCount: 0,
        failedCount: 0,
        failedItems: [],
        error: error.message || 'Unknown error occurred'
      };
    }
  },

  /**
   * Unassigns a student's email from their course's private YouTube videos
   */
  unassignCourseVideos: async (customerId: string): Promise<CourseAssignmentResult> => {
    try {
      const customers = await mockDB.getCustomers();
      const customer = customers.find(c => c.customer_id === customerId);
      if (!customer) throw new Error("Học viên không tồn tại");
      if (!customer.email) throw new Error("Học viên chưa có email");

      let tasks = await mockDB.getCustomPlan(customerId);
      if (!tasks || tasks.length === 0) {
        if (!customer.video_date) throw new Error("Học viên chưa có lịch phác đồ (Video Date)");
        tasks = await mockDB.getPlan(customer.video_date);
      }

      const allLinks: string[] = [];
      
      // Lấy link từ tasks
      tasks.forEach(t => { if (t.link) allLinks.push(t.link) });
      
      // Lấy link từ sidebar_blocks nếu có
      if (customer.sidebar_blocks_json && Array.isArray(customer.sidebar_blocks_json)) {
        customer.sidebar_blocks_json.forEach((sb: any) => {
           if (sb.video_link) allLinks.push(sb.video_link);
        });
      }

      const links = Array.from(new Set(allLinks.filter(l => l && (l.includes("youtube.com") || l.includes("youtu.be") || String(l).trim() !== ""))));

      const res = await fetch('/api/youtube/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'unassign', email: customer.email, links })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");

      return {
        success: data.success,
        action: "unassign",
        customerId,
        email: customer.email,
        totalPrivateVideos: links.length,
        successCount: data.successCount,
        failedCount: data.failedCount,
        failedItems: data.errors || []
      };
    } catch (error: any) {
      console.error('Error unassigning YouTube videos:', error);
      return {
        success: false,
        action: "unassign",
        customerId,
        email: "",
        totalPrivateVideos: 0,
        successCount: 0,
        failedCount: 0,
        failedItems: [],
        error: error.message || 'Unknown error occurred'
      };
    }
  }
};
