import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { decryptField } from "../../../lib/crypto";
import { Member } from "../../../models/member.model";
import { createMember, getMember, listMembers, updateMember } from "../member.service";

const application = {
  applicantName: "Ananya Sharma",
  mobile: "9876543210",
  email: "ananya@example.com",
  aadharNo: "123412341234",
  address: "New Delhi",
  initiatives: ["River awareness"],
};

describe("scoped Namo Gange members", () => {
  let server: MongoMemoryServer;
  const namoId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await Member.syncIndexes();
  });
  afterEach(async () => Member.deleteMany({}));
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  it("encrypts contact, Aadhaar, and address at rest and masks Aadhaar in admin output", async () => {
    const created = await createMember(namoId, application);
    const raw = await Member.findById(created.id).select("+aadharNo").orFail();
    expect(raw.mobile).not.toContain("9876543210");
    expect(raw.email).not.toContain("ananya@example.com");
    expect(raw.address).not.toContain("New Delhi");
    expect(decryptField(raw.aadharNo!)).toBe("123412341234");

    const member = await getMember(namoId, created.id);
    expect(member.aadharNo).toBeUndefined();
    expect(member.aadharMasked).toBe("********1234");
  });

  it("deduplicates contact identifiers within an organisation but not across organisations", async () => {
    await createMember(namoId, application);
    await expect(createMember(namoId, application)).rejects.toThrow(/already exists/);
    await expect(createMember(otherId, application)).resolves.toBeDefined();
  });

  it("isolates list and update operations by organisation", async () => {
    const created = await createMember(namoId, application);
    expect(await listMembers(otherId)).toHaveLength(0);
    await expect(updateMember(otherId, created.id, { status: "ACTIVE" })).rejects.toThrow("Member not found");
    await updateMember(namoId, created.id, { status: "ACTIVE" });
    expect(await listMembers(namoId, "ACTIVE")).toHaveLength(1);
  });
});
