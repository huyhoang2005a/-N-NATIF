"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import type { AssistantChatMessage, AssistantChatResponse } from "@r2m/contracts";
import { ApiError, authFetch, SessionExpiredError } from "../../lib/api-client";
import { describeErrorCode } from "../../lib/error-messages";

/** Floating "hỏi trợ lý" widget, mounted once in `Shell` so it's available on every
 * authenticated page. v1 scope (see the AI plan artifact): general platform Q&A only —
 * no case/organization id is ever sent, the backend has no account-data access either. */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function onSend(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const history = messages.slice(-20);
    const nextMessages: AssistantChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setBusy(true);

    authFetch<AssistantChatResponse>("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ message: text, history }),
    })
      .then((res) => {
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      })
      .catch((err) => {
        if (err instanceof SessionExpiredError) {
          setError("Phiên đăng nhập đã hết hạn — tải lại trang để tiếp tục.");
          return;
        }
        setError(err instanceof ApiError ? describeErrorCode(err.code) : "Trợ lý AI đang gặp sự cố, thử lại sau.");
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
      <button
        type="button"
        className="uikit-assistant-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý AI"}
        title="Hỏi trợ lý AI về cách dùng R2M"
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
      </button>

      {open && (
        <div className="uikit-assistant-panel" role="dialog" aria-label="Trợ lý AI">
          <div className="uikit-assistant-panel__header">
            <div>
              <p className="uikit-assistant-panel__title">Trợ lý R2M</p>
              <p className="uikit-assistant-panel__subtitle">Hỏi về cách dùng nền tảng — chưa xem được dữ liệu tài khoản của bạn.</p>
            </div>
          </div>

          <div className="uikit-assistant-panel__body" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="uikit-assistant-empty">Ví dụ: "Làm sao để xác minh tổ chức?", "Case cần gì để tạo được roadmap?"</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`uikit-assistant-msg uikit-assistant-msg--${m.role}`}>
                {m.content}
              </div>
            ))}
            {busy && <div className="uikit-assistant-msg uikit-assistant-msg--assistant uikit-assistant-msg--typing">Đang trả lời…</div>}
          </div>

          {error && (
            <p className="uikit-alert-error" role="alert" style={{ margin: "0 14px 10px" }}>
              {error}
            </p>
          )}

          <form onSubmit={onSend} className="uikit-assistant-panel__form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi…"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi">
              <Send aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
