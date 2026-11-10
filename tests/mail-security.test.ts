import { expect, it, vi } from "vitest";
import { zh } from "@/i18n";
import type { OutboundMail } from "@/lib/mail";
import { consoleMailer } from "@/lib/mail/console";
import { prepareOutbound, safeMailAddress, singleLine } from "@/lib/mail/headers";
import { adminNewTicketNotice, deliverTicketStaffReply, orderPaidNotice } from "@/lib/mail/notices";
import { escapeHtml } from "@/lib/mail/template";

const sent: OutboundMail[] = [];

it("escapes notification HTML and refuses header injection", async () => {
  const notice = adminNewTicketNotice(
    {
      email: "user@example.com\r\nBcc: evil@example.com",
      subject: "<script>alert(1)</script>\r\nBcc: evil@example.com",
      category: "other<img>",
      url: "https://aisubscr.com/admin/tickets/abc",
    },
    zh,
  );
  expect(notice.subject).not.toMatch(/[\r\n]/);
  expect(notice.text).not.toMatch(/\r\nBcc/);
  expect(notice.html).not.toContain("<script>");
  expect(notice.html).not.toContain("<img>");
  expect(notice.html).toContain("&lt;script&gt;");
  expect(escapeHtml("it's <b>")).toBe("it&#39;s &lt;b&gt;");

  const paid = orderPaidNotice(
    {
      orderNo: "A1\r\nCc: evil@example.com",
      totalCents: 100,
      items: [{ productName: "<b>账号</b>", quantity: 1 }],
    },
    zh,
  );
  expect(paid.text).not.toMatch(/\r\nCc/);
  expect(paid.html).toContain("&lt;b&gt;");
  expect(paid.html).not.toContain("<b>");

  expect(singleLine("a\r\nb")).toBe("a b");
  expect(safeMailAddress("owner@example.com\r\nBcc: evil@example.com")).toBeNull();
  expect(prepareOutbound({
    to: "owner@example.com\r\nBcc: evil@example.com",
    subject: "ok",
    text: "body",
  })).toBeNull();
  expect(prepareOutbound({
    to: "ops@example.com",
    subject: "hi\r\nBcc: evil@example.com",
    text: "body",
  })?.subject).toBe("hi Bcc: evil@example.com");

  sent.length = 0;
  vi.spyOn(consoleMailer, "send").mockImplementation(async (mail) => {
    sent.push(mail);
  });
  await deliverTicketStaffReply({
    to: "owner@example.com\r\nBcc: evil@example.com",
    subject: "<script>x</script>",
    excerpt: "hello",
    ticketId: "abc",
  });
  expect(sent).toHaveLength(0);

  await deliverTicketStaffReply({
    to: "owner@example.com",
    subject: "<script>\r\nBcc: evil@example.com",
    excerpt: "<b>x</b>",
    ticketId: "abc",
  });
  expect(sent).toHaveLength(1);
  expect(sent[0]?.to).toBe("owner@example.com");
  expect(sent[0]?.subject).not.toMatch(/[\r\n]/);
  expect(sent[0]?.html).not.toContain("<script>");
  expect(sent[0]?.html).not.toContain("<b>");
  expect(sent[0]?.html).toContain("&lt;b&gt;");
  vi.restoreAllMocks();
});
