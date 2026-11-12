import { randomUUID } from "node:crypto";
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
        .all(id);
    },
    async send(id, customer, { content, requestId }) {
      const c = await requireConversation(id, customer);
      if (
        typeof content !== "string" ||
        content.trim().length < 1 ||
        content.length > 8000 ||
        typeof requestId !== "string" ||
        !/^[-a-zA-Z0-9_]{8,100}$/.test(requestId)
      )
        throw Error("A bounded message and stable request ID are required");
      const old = db
        .prepare(
          "SELECT * FROM messages WHERE conversation_id=? AND sender=? AND request_id=?",
        )
        .get(id, customer, requestId);
      if (old) {
        if (old.content !== content) throw Error("Message request ID reused");
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
        enqueue(c.agent_id, "CONVERSATION", messageId);
        return db.prepare("SELECT * FROM messages WHERE id=?").get(messageId);
      });
    },
  };
}
