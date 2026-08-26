import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ArogyaContent } from "../../../models/arogyaContent.model";
import { create, getPublic, listAdmin, listPublic, update } from "../arogyaContent.service";

describe("scoped Arogya CMS", () => {
  let server: MongoMemoryServer;
  const arogyaId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await ArogyaContent.syncIndexes();
  });
  afterEach(async () => ArogyaContent.deleteMany({}));
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  it("keeps all legacy payload fields losslessly", async () => {
    const payload = { question: "Who can attend?", answer: "Any registered delegate.", legacyFlag: 3 };
    const entry = await create(arogyaId, { kind: "FAQ_ITEM", title: payload.question, payload });
    expect(entry.payload).toEqual(payload);
  });

  it("only publishes active records and supports slug detail", async () => {
    await create(arogyaId, { kind: "HERO", slug: "main-hero", title: "Active", payload: { title: "Welcome" }, status: "ACTIVE" });
    await create(arogyaId, { kind: "HERO", slug: "draft-hero", title: "Hidden", payload: { title: "Draft" }, status: "INACTIVE" });
    expect((await listPublic(arogyaId, "HERO")).map((entry) => entry.slug)).toEqual(["main-hero"]);
    await expect(getPublic(arogyaId, "HERO", "draft-hero")).rejects.toThrow("Content not found");
  });

  it("isolates admin reads and writes by organisation", async () => {
    const entry = await create(arogyaId, { kind: "SPEAKER_EMINENT", title: "Dr. Rao", payload: { name: "Dr. Rao" } });
    expect(await listAdmin(otherId)).toHaveLength(0);
    await expect(update(otherId, entry._id.toString(), { title: "Cross-scope" })).rejects.toThrow("Content not found");
  });

  it("permits identical slugs in separate organisations but not the same organisation and kind", async () => {
    const input = { kind: "PARTNER_CATEGORY" as const, slug: "sponsors", title: "Sponsors", payload: {} };
    await create(arogyaId, input);
    await expect(create(otherId, input)).resolves.toBeDefined();
    await expect(create(arogyaId, input)).rejects.toThrow(/already exists/);
  });
});
