import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NamoContent } from "../../../models/namoContent.model";
import { create, getPublic, listAdmin, listPublic, update } from "../namoContent.service";

describe("scoped Namo Gange CMS", () => {
  let server: MongoMemoryServer;
  const namoId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await NamoContent.syncIndexes();
  });
  afterEach(async () => NamoContent.deleteMany({}));
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  it("keeps all legacy payload fields losslessly", async () => {
    const payload = { question: "How can I join?", answer: "Submit the membership form.", category: "Membership", legacyFlag: 7 };
    const entry = await create(namoId, { kind: "FAQ", title: payload.question, payload });
    expect(entry.payload).toEqual(payload);
  });

  it("only publishes active records and supports slug detail", async () => {
    await create(namoId, { kind: "BLOG", slug: "active-post", title: "Active", payload: { description: "Published" }, status: "ACTIVE" });
    await create(namoId, { kind: "BLOG", slug: "hidden-post", title: "Hidden", payload: { description: "Draft" }, status: "INACTIVE" });
    expect((await listPublic(namoId, "BLOG")).map((entry) => entry.slug)).toEqual(["active-post"]);
    await expect(getPublic(namoId, "BLOG", "hidden-post")).rejects.toThrow("Content not found");
  });

  it("isolates admin reads and writes by organisation", async () => {
    const entry = await create(namoId, { kind: "BANNER", title: "Main", payload: { image: "https://example.test/banner.jpg" } });
    expect(await listAdmin(otherId)).toHaveLength(0);
    await expect(update(otherId, entry._id.toString(), { title: "Cross-scope" })).rejects.toThrow("Content not found");
  });

  it("permits identical slugs in separate organisations but not the same organisation and kind", async () => {
    const input = { kind: "INITIATIVE" as const, slug: "clean-ganga", title: "Clean Ganga", payload: {} };
    await create(namoId, input);
    await expect(create(otherId, input)).resolves.toBeDefined();
    await expect(create(namoId, input)).rejects.toThrow(/already exists/);
  });
});
