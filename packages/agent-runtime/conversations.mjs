import { randomUUID, createHash } from "node:crypto";
export function createConversationService(store, { ownership, enqueue }) {
  const { db, now } = store;
  async function requireConversation(id, customer) {
    const c = db
      .prepare("SELECT * FROM conversations WHERE id=? AND customer_id=?")
      .get(id, customer);
    if (!c)
      throw Object.assign(Error("Conversation not found"), { status: 404 });
    if (c.kind === "OWNER") {
      const current = await ownership.requireOwner(c.agent_id, customer);
      if (current.epoch !== c.owner_epoch)
        throw Object.assign(
          Error(
            "This owner conversation belongs to an earlier ownership period",
          ),
          { status: 403 },
        );
    }
    return c;
  }
  return {
    require: requireConversation,
    async open(agentId, customer, kind = "CLIENT") {
      store.professional(agentId);
      if (!["OWNER", "CLIENT"].includes(kind))
        throw Error("Choose client or owner conversation");
      const epoch =
        kind === "OWNER"
          ? (await ownership.requireOwner(agentId, customer)).epoch
          : 0;
      const prior = db
        .prepare(
          "SELECT * FROM conversations WHERE agent_id=? AND customer_id=? AND kind=? AND owner_epoch=?",
        )
        .get(agentId, customer, kind, epoch);
      if (prior) return prior;
      const id = randomUUID();
      db.prepare("INSERT INTO conversations VALUES(?,?,?,?,?,?)").run(
        id,
        agentId,
        customer,
        kind,
        epoch,
        now(),
      );
      return db.prepare("SELECT * FROM conversations WHERE id=?").get(id);
    },
    async list(customer) {
      return db
        .prepare(
          "SELECT id,agent_id,kind,created_at FROM conversations WHERE customer_id=? ORDER BY created_at DESC",
        )
        .all(customer);
    },
    async messages(id, customer) {
      await requireConversation(id, customer);
      return db
        .prepare(
          "SELECT id,sender,recipient,type,content,job_id,delivery_status,created_at FROM messages WHERE conversation_id=? ORDER BY rowid LIMIT 200",
        )
        .all(id)
        .map((m) => ({
          ...m,
          attachments: db
            .prepare(
              "SELECT id,filename,content_type,sha256 FROM source_attachments WHERE message_id=? ORDER BY rowid",
            )
            .all(m.id),
        }));
    },
    async send(id, customer, { content, requestId, attachments = [] }) {
      const c = await requireConversation(id, customer);
      if (
        typeof content !== "string" ||
        content.trim().length < 1 ||
        content.length > 8000 ||
        typeof requestId !== "string" ||
        !/^[-a-zA-Z0-9_]{8,100}$/.test(requestId)
      )
        throw Error("A bounded message and stable request ID are required");
      if (!Array.isArray(attachments) || attachments.length > 3)
        throw Error("At most three text source attachments are supported");
      let total = 0;
      const sources = attachments.map((f) => {
        if (
          typeof f.filename !== "string" ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_. -]{0,79}$/.test(f.filename) ||
          ![
            "text/csv",
            "text/plain",
            "text/markdown",
            "application/json",
          ].includes(f.contentType) ||
          typeof f.content !== "string" ||
          !f.content.trim()
        )
          throw Error(
            "A named CSV, plain-text, Markdown or JSON source is required",
          );
        total += Buffer.byteLength(f.content, "utf8");
        if (total > 16000)
          throw Error("Combined source attachments must be at most 16 KB");
        return {
          ...f,
          sha256: createHash("sha256").update(f.content).digest("hex"),
        };
      });
      const old = db
        .prepare(
          "SELECT * FROM messages WHERE conversation_id=? AND sender=? AND request_id=?",
        )
        .get(id, customer, requestId);
      if (old) {
        const prior = db
          .prepare(
            "SELECT filename,sha256,content_type AS contentType FROM source_attachments WHERE message_id=? ORDER BY rowid",
          )
          .all(old.id);
        if (
          old.content !== content ||
          JSON.stringify(prior) !==
            JSON.stringify(
              sources.map((f) => ({
                filename: f.filename,
                sha256: f.sha256,
                contentType: f.contentType,
              })),
            )
        )
          throw Error(
            "Message request ID reused with changed content or sources",
          );
        return old;
      }
      return store.transaction(() => {
        const messageId = randomUUID();
        db.prepare("INSERT INTO messages VALUES(?,?,?,?,?,?,?,?,?,?)").run(
          messageId,
          id,
          customer,
          c.agent_id,
          "HUMAN_MESSAGE",
          content,
          null,
          requestId,
          "QUEUED",
          now(),
        );
        for (const f of sources)
          db.prepare(
            "INSERT INTO source_attachments VALUES(?,?,?,?,?,?,?)",
          ).run(
            randomUUID(),
            messageId,
            f.filename,
            f.contentType,
            f.content,
            f.sha256,
            now(),
          );
        enqueue(c.agent_id, "CONVERSATION", messageId);
        return db.prepare("SELECT * FROM messages WHERE id=?").get(messageId);
      });
    },
  };
}
