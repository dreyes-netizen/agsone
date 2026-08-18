"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildGmailComposeUrl } from "@/lib/email/gmailCompose";
import { HR_EMAIL, COMMON_HR_REQUESTS } from "@/lib/constants/hr";

export default function EmailHrPage() {
  const { dbUser } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState(false);

  const name = dbUser?.displayName ?? "";
  const department = dbUser?.department?.name ?? "";

  function handleSubmit() {
    const body = `Name: ${name}\nDepartment: ${department}\n\n${message}`;
    const url = buildGmailComposeUrl({ to: HR_EMAIL, subject, body });
    window.open(url, "_blank", "noopener,noreferrer");
    setOpened(true);
    setTimeout(() => setOpened(false), 4000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email HR</h1>
        <p className="text-gray-500 text-sm mt-1">Opens a pre-filled Gmail draft to {HR_EMAIL} — review and send it yourself.</p>
      </div>

      <div className="bg-white rounded-card border border-table-border p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input disabled value={name} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input disabled value={department || "—"} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            placeholder="What's this about?"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {COMMON_HR_REQUESTS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSubject(r)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            placeholder="Give HR the details…"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!subject.trim() || !message.trim()}
          className="inline-flex items-center gap-2 bg-command-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          <Mail className="w-4 h-4" />
          {opened ? "Opened in Gmail — review and send" : "Open in Gmail"}
        </button>
      </div>
    </div>
  );
}
